/**
 * Shows a banner when a newer build has been installed by the service worker
 * and lets the user activate it immediately.
 */
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

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

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 top-3 z-[60] mx-auto max-w-sm rounded-xl border border-border bg-card p-3 shadow-lg"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-foreground">New PoultryPro version available.</p>
        <button
          type="button"
          onClick={() => {
            waiting.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Update
        </button>
      </div>
    </div>
  );
}
