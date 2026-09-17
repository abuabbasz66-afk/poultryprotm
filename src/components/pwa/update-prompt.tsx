/**
 * Shows a banner when a newer build has been installed by the service worker
 * and lets the user activate it immediately.
 */
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [later, setLater] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelled = false;

    navigator.serviceWorker.getRegistration("/").then((reg) => {
      if (!reg || cancelled) return;
      if (reg.waiting) setWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener("statechange", () => {
          if (next.state === "installed" && navigator.serviceWorker.controller) setWaiting(next);
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!waiting || later) return null;

  return (
    <div
      role="status"
      className="mobile-safe-top fixed inset-x-3 top-0 z-[60] mx-auto max-w-sm rounded-xl border border-border bg-card p-3 shadow-lg sm:top-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-medium text-foreground">New PoultryPro version available.</p><p className="mt-0.5 text-[11px] text-muted-foreground">Update now to get the latest improvements.</p></div>
        <div className="flex shrink-0 gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => setLater(true)}>Later</Button><Button
          type="button"
          onClick={() => {
            waiting.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          }}
          size="sm"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Update
        </Button></div>
      </div>
    </div>
  );
}
