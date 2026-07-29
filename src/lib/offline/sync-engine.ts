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

/** Compare the cloud row against the snapshot taken when the edit was made. */
function detectConflict(base: Record<string, unknown> | null, cloud: Record<string, unknown> | null, patch: Record<string, unknown>) {
  if (!base || !cloud) return false;
  return Object.keys(patch).some((k) => {
    if (!(k in base)) return false;
    const a = base[k];
    const b = (cloud as Record<string, unknown>)[k];
    return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  });
}

async function pushItem(item: OutboxItem): Promise<"done" | "conflict" | "retry"> {
  try {
    if (item.op === "insert") {
      const row = { id: item.rowId, created_at: item.createdAt, ...item.payload };
      const { error } = await table(item.table).upsert(row, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
      return "done";
    }

    if (item.op === "delete") {
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
    const msg = String((err as { message?: string })?.message ?? err);
    await updateOutbox(item.id, {
      userId: item.userId,
      attempts: item.attempts + 1,
      lastError: msg,
      status: item.attempts + 1 >= 8 ? "error" : "pending",
    });
    return "retry";
  }
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
  if (!opts.silent) notify("syncing", "Synchronising records…");

  let uploaded = 0;
  let failed = 0;
  let conflicted = 0;

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
    setSyncState({ phase: conflicted ? "online" : "synced", lastSyncAt: now, lastError: null });
    if (uploaded && !opts.silent) {
      notify("done", `All records successfully synchronised (${uploaded}).`);
    }
    if (conflicted) notify("conflict", `${conflicted} record${conflicted > 1 ? "s" : ""} need your review.`);
    onDrained?.();
  } else {
    backoff = Math.min(backoff ? backoff * 2 : 5_000, 120_000);
    setSyncState({ phase: isOnline() ? "online" : "offline", lastError: "Some records are still waiting to upload." });
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
    notify("restored", "Internet connection restored.");
    void syncNow();
  });

  window.addEventListener("offline", () => {
    setSyncState({ online: false, phase: "offline" });
    notify("offline", "Working offline. Your records are being saved on this device.");
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
