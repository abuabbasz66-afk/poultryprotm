import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAuthUserId } from "@/lib/farm-data";
import { useFarmContext } from "@/lib/rbac";
import { isResumablePath, saveLastLocation, type SavedLocation } from "@/lib/last-location";

/** Search keys that identify a room / flock / batch context worth restoring. */
const CONTEXT_KEYS: Array<[string, string]> = [
  ["batch", "batch"],
  ["batchId", "batch"],
  ["flock", "flock"],
  ["room", "room"],
  ["roomId", "room"],
];

/**
 * Persists the signed-in user's current location (page + tab/section + farm +
 * room/flock context) whenever they navigate. Mounted once inside the
 * authenticated shell.
 */
export function useLocationTracker() {
  const { data: userId } = useAuthUserId();
  const { data: ctx } = useFarmContext();
  const location = useRouterState({ select: (s) => s.location });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    const pathname = location.pathname;
    if (!isResumablePath(pathname)) return;

    const rawSearch = (location.search ?? {}) as Record<string, unknown>;
    const search: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawSearch)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        search[k] = String(v);
      }
    }

    let contextKind: string | null = null;
    let contextId: string | null = null;
    for (const [key, kind] of CONTEXT_KEYS) {
      if (search[key]) {
        contextKind = kind;
        contextId = search[key];
        break;
      }
    }

    const payload: SavedLocation = {
      pathname,
      search,
      hash: location.hash ? location.hash.replace(/^#/, "") : null,
      farmId: ctx?.farmId ?? null,
      contextKind,
      contextId,
    };

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveLastLocation(userId, payload), 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [userId, ctx?.farmId, location.pathname, location.searchStr, location.hash]);
}
