/**
 * Automatic synchronisation engine.
 *
 * Listens for connectivity, focus and a periodic heartbeat, then drains the
 * outbox in creation order. Retries use exponential backoff, uploads are
 * idempotent (deterministic row ids + upsert), and an item is only removed
 * once the server confirms it.
 */
import { supabase } from "@/integrations/supabase/client";
import { metaGet, metaSet, wipeUser } from "./db";
import { listOutbox, removeOutbox, updateOutbox, type OutboxItem } from "./outbox";
import { isOnline, setSyncState, getSyncState } from "./status";
import { refreshPendingCount } from "./data";
import { BUSINESS_KEYS, MAX_TEMP_ATTEMPTS, classifySyncError, detectConflict, differsFrom } from "./sync-rules";

type Notify = (kind: "offline" | "restored" | "syncing" | "done" | "error" | "conflict", msg: string) => void;

let notify: Notify = () => {};
export function setSyncNotifier(fn: Notify) {
  notify = fn;
}

let currentUserId: string | null = null;
let running = false;
let started = false;
let timer: ReturnType<typeof setInterval> | undefined;
let backoff = 0;
let onDrained: (() => void) | undefined;

export function setSyncUser(userId: string | null) {
  currentUserId = userId;
  if (userId) void refreshPendingCount(userId);
}

export function setSyncCompleteHandler(fn: () => void) {
  onDrained = fn;
}

export async function forgetUser(userId: string) {
  await wipeUser(userId);
  setSyncState({ pending: 0, conflicts: 0, lastSyncAt: null });
}

const LAST_SYNC_KEY = "lastSyncAt";

function table(name: string) {
  return supabase.from(name as never) as any;
}

type PushResult = "done" | "conflict" | "retry" | "failed";

/**
 * egg_production is unique on (farm_id, date). An offline "add" must land on
 * that day's existing record, never a second row. If the cloud already holds
 * different numbers for the day, surface a conflict instead of overwriting;
 * once the user picks "keep mine", `base` holds the cloud snapshot they saw.
 */
async function pushNaturalKeyInsert(item: OutboxItem, cols: readonly string[]): Promise<PushResult> {
  const payload: Record<string, unknown> = { ...item.payload };
  delete payload.id;
  delete payload.created_at;
  if (item.farmId) payload.farm_id = item.farmId;
  let q = table(item.table).select("*");
  for (const c of cols) q = q.eq(c, payload[c]);
  const { data: cloud, error: readErr } = await q.maybeSingle();
  if (readErr) throw readErr;

  if (cloud) {
    const reviewed = item.base != null;
    const changed = reviewed ? detectConflict(item.base, cloud, payload) : differsFrom(cloud, payload);
    if (changed) {
      await updateOutbox(item.id, { userId: item.userId, status: "conflict", cloud });
      return "conflict";
    }
    if (!reviewed) return "done"; // identical record already in the cloud
    const patch = { ...payload };
    for (const c of cols) delete patch[c];
    const { error } = await table(item.table).update(patch).eq("id", cloud.id);
    if (error) throw error;
    return "done";
  }

  const { error } = await table(item.table).insert({ id: item.rowId, created_at: item.createdAt, ...payload });
  // Someone created the same day between our read and insert: re-check next pass.
  if (error?.code === "23505") return pushNaturalKeyInsert(item, cols);
  if (error) throw error;
  return "done";
}

async function pushItem(item: OutboxItem): Promise<PushResult> {
  try {
    const payloadFarm = (item.payload as { farm_id?: unknown }).farm_id;
    if (item.farmId && payloadFarm != null && payloadFarm !== item.farmId) {
      throw Object.assign(new Error("farm mismatch"), { code: "42501" });
    }
    if (item.op === "insert") {
      const cols = BUSINESS_KEYS[item.table];
      if (cols) return await pushNaturalKeyInsert(item, cols);
      const row = { id: item.rowId, created_at: item.createdAt, ...item.payload };
      const { error } = await table(item.table).upsert(row, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
      return "done";
    }

    if (item.op === "delete") {
      // Deletes target one exact row id, so they can never hit another record.
      const { error } = await table(item.table).delete().eq("id", item.rowId);
      if (error) throw error;
      return "done";
    }

    // update — check for a competing cloud change first
    const { data: cloud, error: readErr } = await table(item.table).select("*").eq("id", item.rowId).maybeSingle();
    if (readErr) throw readErr;
    if (!cloud) return "done"; // row disappeared upstream; nothing to apply
    if (detectConflict(item.base, cloud, item.payload)) {
      await updateOutbox(item.id, { userId: item.userId, status: "conflict", cloud });
      return "conflict";
    }
    const { error } = await table(item.table).update(item.payload).eq("id", item.rowId);
    if (error) throw error;
    return "done";
  } catch (err) {
    const c = isOnline() ? classifySyncError(err) : classifySyncError(new Error("network"));
    const attempts = item.attempts + 1;
    const giveUp = c.kind === "permanent" || attempts >= MAX_TEMP_ATTEMPTS;
    await updateOutbox(item.id, {
      userId: item.userId,
      attempts,
      lastError: giveUp && c.kind === "temporary" ? "Could not sync after many attempts. Tap Retry." : c.message,
      status: giveUp ? "error" : "pending",
    });
    return giveUp ? "failed" : "retry";
  }
}

/** Move every failed record back to pending (payload/farm/user untouched) and sync. */
export async function retryFailed(): Promise<number> {
  if (!currentUserId) return 0;
  const failed = (await listOutbox(currentUserId)).filter((i) => i.status === "error");
  for (const item of failed) {
    await updateOutbox(item.id, { userId: item.userId, status: "pending", attempts: 0, lastError: null });
  }
  await refreshPendingCount(currentUserId);
  backoff = 0;
  await syncNow();
  return failed.length;
}

/** Discard one failed record after the user has reviewed it. */
export async function discardFailed(id: string): Promise<void> {
  await removeOutbox(id);
  await refreshPendingCount(currentUserId);
}

export async function syncNow(opts: { silent?: boolean } = {}): Promise<void> {
  if (running || !currentUserId) return;
  if (!isOnline()) {
    setSyncState({ online: false, phase: "offline" });
    return;
  }
  const items = (await listOutbox(currentUserId)).filter((i) => i.status === "pending");
  if (!items.length) {
    setSyncState({ online: true, phase: getSyncState().conflicts ? "online" : "synced" });
    await refreshPendingCount(currentUserId);
    return;
  }

  running = true;
  setSyncState({ online: true, phase: "syncing", lastError: null });
  if (!opts.silent) notify("syncing", "Syncing farm records...");

  let uploaded = 0;
  let failed = 0;
  let conflicted = 0;
  let rejected = 0;

  // Batched so a very large queue never blocks the UI thread.
  const BATCH = 25;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    for (const item of batch) {
      if (!isOnline()) {
        failed++;
        break;
      }
      const result = await pushItem(item);
      if (result === "done") {
        await removeOutbox(item.id);
        uploaded++;
      } else if (result === "conflict") {
        conflicted++;
      } else if (result === "failed") {
        rejected++;
      } else {
        failed++;
      }
    }
    await new Promise((r) => setTimeout(r, 0));
  }

  running = false;
  await refreshPendingCount(currentUserId);
  const now = new Date().toISOString();

  if (failed === 0) {
    backoff = 0;
    await metaSet(LAST_SYNC_KEY, now);
    setSyncState({ phase: conflicted || rejected ? "online" : "synced", lastSyncAt: now, lastError: null });
    if (uploaded && !opts.silent) {
      notify("done", `All farm records are synced (${uploaded}).`);
    }
    if (conflicted) notify("conflict", `${conflicted} record${conflicted > 1 ? "s" : ""} need your review.`);
    if (rejected) notify("error", `${rejected} record${rejected > 1 ? "s" : ""} could not be saved. Open sync status to review.`);
    if (rejected) setSyncState({ lastError: "Some records were rejected by the server." });
    onDrained?.();
  } else {
    backoff = Math.min(backoff ? backoff * 2 : 5_000, 120_000);
    setSyncState({ phase: isOnline() ? "online" : "offline", lastError: "Some records could not sync. Tap to review." });
    if (!opts.silent) notify("error", "Some records could not sync. Tap to review.");
    setTimeout(() => void syncNow({ silent: true }), backoff);
  }
  if (uploaded) onDrained?.();
}

/** Wire connectivity listeners once, on the client only. */
export function startSyncEngine() {
  if (started || typeof window === "undefined") return;
  started = true;

  void metaGet<string>(LAST_SYNC_KEY).then((v) => v && setSyncState({ lastSyncAt: v }));
  setSyncState({ online: isOnline(), phase: isOnline() ? "online" : "offline" });

  window.addEventListener("online", () => {
    setSyncState({ online: true, phase: "online" });
    notify("restored", "Connected");
    void syncNow();
  });

  window.addEventListener("offline", () => {
    setSyncState({ online: false, phase: "offline" });
    notify("offline", "You're offline. Your farm records will sync when connection returns.");
  });

  window.addEventListener("focus", () => {
    if (isOnline()) void syncNow({ silent: true });
  });

  timer = setInterval(() => {
    if (isOnline()) void syncNow({ silent: true });
  }, 60_000);

  // Background Sync where supported (Chromium); harmless elsewhere.
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready
      .then((reg) => (reg as unknown as { sync?: { register: (t: string) => Promise<void> } }).sync?.register("poultrypro-sync"))
      .catch(() => {});
    navigator.serviceWorker.addEventListener?.("message", (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === "poultrypro-sync") void syncNow({ silent: true });
    });
  }
}

export function stopSyncEngine() {
  if (timer) clearInterval(timer);
  timer = undefined;
  started = false;
}
