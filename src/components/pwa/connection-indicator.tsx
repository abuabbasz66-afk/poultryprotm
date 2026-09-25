/**
 * Small always-available connection indicator: persistent while offline and a
 * brief "Connected" confirmation when the network returns.
 */
import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useSyncState } from "@/lib/offline/status";
import { cn } from "@/lib/utils";

export function ConnectionIndicator() {
  const { online } = useSyncState();
  const [mounted, setMounted] = useState(false);
  const [showConnected, setShowConnected] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    if (online) {
      setShowConnected(true);
      const t = setTimeout(() => setShowConnected(false), 3000);
      return () => clearTimeout(t);
    }
    setShowConnected(false);
  }, [online, mounted]);

  if (!mounted) return null;
  if (online && !showConnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-[55] -translate-x-1/2 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-md lg:bottom-3",
        online
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
          : "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200",
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        {online ? "Connected" : "You're offline. Your farm records will sync when connection returns."}
      </span>
    </div>
  );
}
