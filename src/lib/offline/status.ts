/**
 * Connectivity + synchronisation status, exposed as a tiny external store so
 * any component can subscribe without prop drilling.
 */
import { useSyncExternalStore } from "react";

export type SyncPhase = "online" | "offline" | "syncing" | "synced";

export type SyncState = {
  online: boolean;
  phase: SyncPhase;
  pending: number;
  conflicts: number;
  lastSyncAt: string | null;
  lastError: string | null;
};

let state: SyncState = {
  online: true,
  phase: "online",
  pending: 0,
  conflicts: 0,
  lastSyncAt: null,
  lastError: null,
};

const listeners = new Set<() => void>();

export function getSyncState(): SyncState {
  return state;
}

export function setSyncState(patch: Partial<SyncState>) {
  const next = { ...state, ...patch };
  if (
    next.online === state.online &&
    next.phase === state.phase &&
    next.pending === state.pending &&
    next.conflicts === state.conflicts &&
    next.lastSyncAt === state.lastSyncAt &&
    next.lastError === state.lastError
  ) {
    return;
  }
  state = next;
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const SERVER_SNAPSHOT: SyncState = {
  online: true,
  phase: "online",
  pending: 0,
  conflicts: 0,
  lastSyncAt: null,
  lastError: null,
};

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, getSyncState, () => SERVER_SNAPSHOT);
}

/** True when the browser believes it has a connection. SSR-safe. */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}
