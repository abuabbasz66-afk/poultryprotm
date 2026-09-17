import { useEffect } from "react";
import { useSyncState } from "@/lib/offline/status";

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function AppBadge() {
  const { pending, conflicts } = useSyncState();

  useEffect(() => {
    const badge = navigator as BadgeNavigator;
    const count = pending + conflicts;
    if (count > 0) void badge.setAppBadge?.(count).catch(() => undefined);
    else void badge.clearAppBadge?.().catch(() => undefined);
  }, [pending, conflicts]);

  return null;
}