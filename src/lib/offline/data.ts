/**
 * Cached reads + write routing.
 *
 * - `offlineList` keeps the last successful server response for a query in
 *   IndexedDB, serves it when there is no connection, and overlays any pending
 *   offline writes so new records appear instantly.
 * - `runOrQueue` sends a write straight to the cloud when online and falls
 *   back to the outbox when the request cannot leave the device.
 */
import { STORE_CACHE, hasIndexedDB, idbGet, idbPut, seal, unseal } from "./db";
import { applyPending, enqueue, listOutbox, newLocalId, type OutboxItem } from "./outbox";
import { isOnline, setSyncState } from "./status";

type CacheRow = { id: string; userId: string; key: string; updatedAt: string; value: Awaited<ReturnType<typeof seal>> };

function cacheId(userId: string, key: string) {
  return `${userId}::${key}`;
}

export async function readCache<T>(userId: string | null | undefined, key: string): Promise<T | undefined> {
  if (!hasIndexedDB() || !userId) return undefined;
  try {
    const row = await idbGet<CacheRow>(STORE_CACHE, cacheId(userId, key));
    if (!row) return undefined;
    return await unseal<T>(userId, row.value);
  } catch {
    return undefined;
  }
}

export async function writeCache<T>(userId: string | null | undefined, key: string, value: T): Promise<void> {
  if (!hasIndexedDB() || !userId) return;
  try {
    await idbPut<CacheRow>(STORE_CACHE, {
      id: cacheId(userId, key),
      userId,
      key,
      updatedAt: new Date().toISOString(),
      value: await seal(userId, value),
    });
  } catch {
    /* storage full or unavailable — reads simply fall back to the network */
  }
}

function looksOffline(err: unknown): boolean {
  if (!isOnline()) return true;
  const msg = String((err as { message?: string })?.message ?? err ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") ||
    msg.includes("timeout") ||
    msg.includes("fetch failed")
  );
}

/**
 * Fetch a list, cache it, and overlay pending offline writes.
 * `table` links the query to outbox entries for the same table.
 */
export async function offlineList<T extends { id: string }>(opts: {
  userId: string | null | undefined;
  cacheKey: string;
  table?: string;
  fetcher: () => Promise<T[]>;
}): Promise<T[]> {
  const { userId, cacheKey, table, fetcher } = opts;
  let rows: T[] | undefined;

  if (isOnline()) {
    try {
      rows = await fetcher();
      await writeCache(userId, cacheKey, rows);
    } catch (err) {
      if (!looksOffline(err)) throw err;
    }
  }
  if (!rows) {
    rows = (await readCache<T[]>(userId, cacheKey)) ?? [];
  }
  if (table && userId) {
    const pending = await listOutbox(userId);
    rows = applyPending(rows, pending, table);
  }
  return rows;
}

/** Same as `offlineList` but for a single cached object (farm profile etc.). */
export async function offlineValue<T>(opts: {
  userId: string | null | undefined;
  cacheKey: string;
  fetcher: () => Promise<T>;
}): Promise<T | undefined> {
  const { userId, cacheKey, fetcher } = opts;
  if (isOnline()) {
    try {
      const value = await fetcher();
      await writeCache(userId, cacheKey, value);
      return value;
    } catch (err) {
      if (!looksOffline(err)) throw err;
    }
  }
  return readCache<T>(userId, cacheKey);
}

export type WriteResult = { queued: boolean; localId?: string };

/**
 * Perform a write online, or queue it locally when the device is offline.
 * `perform` receives the row id so inserts can use the same deterministic id
 * both online and offline — that is what makes retries duplicate-free.
 */
export async function runOrQueue(opts: {
  userId: string | null | undefined;
  farmId: string | null | undefined;
  table: string;
  op: "insert" | "update" | "delete";
  rowId?: string;
  payload?: Record<string, unknown>;
  base?: Record<string, unknown> | null;
  perform: (rowId: string) => Promise<void>;
}): Promise<WriteResult> {
  const rowId = opts.rowId ?? (opts.op === "insert" ? newLocalId() : "");
  const canTry = isOnline();
  if (canTry) {
    try {
      await opts.perform(rowId);
      return { queued: false };
    } catch (err) {
      if (!looksOffline(err)) throw err;
    }
  }
  if (!opts.userId) throw new Error("Cannot save offline without a signed-in user.");
  const item = await enqueue({
    userId: opts.userId,
    farmId: opts.farmId ?? null,
    table: opts.table,
    op: opts.op,
    rowId: rowId || opts.rowId || null,
    payload: opts.payload ?? {},
    base: opts.base ?? null,
  });
  await refreshPendingCount(opts.userId);
  return { queued: true, localId: item.id };
}

export async function refreshPendingCount(userId: string | null | undefined): Promise<OutboxItem[]> {
  const items = await listOutbox(userId);
  setSyncState({
    pending: items.filter((i) => i.status !== "conflict").length,
    conflicts: items.filter((i) => i.status === "conflict").length,
  });
  return items;
}
