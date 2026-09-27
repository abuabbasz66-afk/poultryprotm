import { useEffect } from "react";
import { useSyncState } from "@/lib/offline/status";

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function AppBadge() {
  const { pending, failed, conflicts } = useSyncState();

  useEffect(() => {
    const badge = navigator as BadgeNavigator;
    const count = pending + failed + conflicts;
    if (count > 0) void badge.setAppBadge?.(count).catch(() => undefined);
    else void badge.clearAppBadge?.().catch(() => undefined);
  }, [pending, failed, conflicts]);

  return null;
}