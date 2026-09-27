/**
 * Pending-write queue ("outbox").
 *
 * Every record captured while offline lands here with a local id, farm id,
 * user id, timestamp and sync status. Nothing is removed until the server
 * confirms the write.
 */
import {
  STORE_OUTBOX,
  idbDelete,
  idbGet,
  idbGetAll,
  idbPut,
  seal,
  unseal,
  hasIndexedDB,
  type Sealed,
} from "./db";
import { businessKeyOf, coalesce } from "./sync-rules";

export type OutboxOp = "insert" | "update" | "delete";
/**
 * pending  — waiting to upload (retried automatically)
 * conflict — cloud changed too; user must choose a version
 * error    — permanently rejected; kept until the user retries or discards
 * (A synced item is removed from the outbox, so "synced" is its absence.)
 */
export type OutboxStatus = "pending" | "conflict" | "error";

/** Row shape as stored in IndexedDB — payload is encrypted. */
type OutboxRow = {
  id: string;
  userId: string;
  farmId: string | null;
  table: string;
  op: OutboxOp;
  rowId: string | null;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  createdOffline: boolean;
  payload: Sealed;
  /** Snapshot of the cloud row at edit time — used to detect conflicts. */
  base: Sealed | null;
  /** Cloud version captured when a conflict was detected. */
  cloud: Sealed | null;
};

export type OutboxItem = {
  id: string;
  userId: string;
  farmId: string | null;
  table: string;
  op: OutboxOp;
  rowId: string | null;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  createdOffline: boolean;
  payload: Record<string, unknown>;
  base: Record<string, unknown> | null;
  cloud: Record<string, unknown> | null;
};

const listeners = new Set<() => void>();
export function onOutboxChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function newLocalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function enqueue(input: {
  userId: string;
  farmId: string | null;
  table: string;
  op: OutboxOp;
  rowId?: string | null;
  payload: Record<string, unknown>;
  base?: Record<string, unknown> | null;
  createdOffline?: boolean;
}): Promise<OutboxItem> {
  // Fold into an unsynced write for the same record/day instead of stacking
  // a second one — keeps repeated taps and edit-before-sync duplicate-free.
  const queued = await listOutbox(input.userId);
  const action = coalesce(queued, {
    table: input.table,
    op: input.op,
    rowId: input.rowId ?? null,
    farmId: input.farmId ?? null,
    payload: input.payload,
  });
  if (action.kind === "merge-into") {
    await updateOutbox(action.target.id, {
      userId: input.userId,
      payload: action.payload,
      status: "pending",
      attempts: 0,
      lastError: null,
    });
    return { ...action.target, payload: action.payload, status: "pending", attempts: 0, lastError: null };
  }
  if (action.kind === "drop-insert") {
    await removeOutbox(action.target.id);
    return action.target;
  }
  const id = newLocalId();
  const createdAt = new Date().toISOString();
  const row: OutboxRow = {
    id,
    userId: input.userId,
    farmId: input.farmId ?? null,
    table: input.table,
    op: input.op,
    rowId: input.rowId ?? (input.op === "insert" ? id : null),
    status: "pending",
    attempts: 0,
    lastError: null,
    createdAt,
    createdOffline: input.createdOffline ?? true,
    payload: await seal(input.userId, input.payload),
    base: input.base ? await seal(input.userId, input.base) : null,
    cloud: null,
  };
  await idbPut(STORE_OUTBOX, row);
  emit();
  return {
    ...row,
    payload: input.payload,
    base: input.base ?? null,
    cloud: null,
  };
}

export async function listOutbox(userId: string | null | undefined): Promise<OutboxItem[]> {
  if (!hasIndexedDB() || !userId) return [];
  try {
    const rows = (await idbGetAll<OutboxRow>(STORE_OUTBOX)).filter((r) => r.userId === userId);
    rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return Promise.all(
      rows.map(async (r) => ({
        ...r,
        payload: (await unseal<Record<string, unknown>>(userId, r.payload)) ?? {},
        base: r.base ? ((await unseal<Record<string, unknown>>(userId, r.base)) ?? null) : null,
        cloud: r.cloud ? ((await unseal<Record<string, unknown>>(userId, r.cloud)) ?? null) : null,
      })),
    );
  } catch {
    return [];
  }
}

export async function updateOutbox(
  id: string,
  patch: Partial<Pick<OutboxRow, "status" | "attempts" | "lastError">> & {
    payload?: Record<string, unknown>;
    base?: Record<string, unknown> | null;
    cloud?: Record<string, unknown> | null;
    userId: string;
  },
): Promise<void> {
  const row = await idbGet<OutboxRow>(STORE_OUTBOX, id);
  if (!row) return;
  const next: OutboxRow = {
    ...row,
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.attempts != null ? { attempts: patch.attempts } : {}),
    ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
    ...(patch.payload ? { payload: await seal(patch.userId, patch.payload) } : {}),
    ...(patch.base !== undefined
      ? { base: patch.base ? await seal(patch.userId, patch.base) : null }
      : {}),
    ...(patch.cloud !== undefined
      ? { cloud: patch.cloud ? await seal(patch.userId, patch.cloud) : null }
      : {}),
  };
  await idbPut(STORE_OUTBOX, next);
  emit();
}

export async function removeOutbox(id: string): Promise<void> {
  await idbDelete(STORE_OUTBOX, id);
  emit();
}

/**
 * Apply every pending write for a table on top of a list of server rows, so
 * the UI shows offline records immediately.
 */
export function applyPending<T extends { id: string }>(
  rows: T[],
  pending: OutboxItem[],
  table: string,
  farmId?: string | null,
): T[] {
  // Only overlay writes for the farm being viewed — a multi-farm user must
  // never see Farm B's queued records inside Farm A's lists.
  const relevant = pending.filter(
    (p) => p.table === table && p.status !== "conflict" && (!farmId || !p.farmId || p.farmId === farmId),
  );
  if (!relevant.length) return rows;
  let out = rows.slice();
  for (const item of relevant) {
    if (item.op === "insert") {
      if (out.some((r) => r.id === item.rowId)) continue;
      // Natural-key tables (one egg record per farm/day): show the offline
      // version in place of the cached one rather than as a second row.
      const key = businessKeyOf(table, { farm_id: item.farmId, ...item.payload });
      const idx = key
        ? out.findIndex((r) => businessKeyOf(table, { farm_id: item.farmId, ...(r as object) }) === key)
        : -1;
      if (idx >= 0) out[idx] = { ...out[idx], ...(item.payload as object) } as T;
      else out.unshift({ id: item.rowId!, ...(item.payload as object) } as T);
    } else if (item.op === "update") {
      out = out.map((r) => (r.id === item.rowId ? ({ ...r, ...(item.payload as object) } as T) : r));
    } else if (item.op === "delete") {
      out = out.filter((r) => r.id !== item.rowId);
    }
  }
  return out;
}
