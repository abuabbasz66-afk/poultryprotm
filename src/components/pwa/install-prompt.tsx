/**
 * In-app install prompt. Captures Chrome/Android `beforeinstallprompt`, shows a
 * branded card and never re-appears once the user dismisses or installs.
 */
import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "pp-install-dismissed";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let dismissed = false;
    try {
      const until = Number(window.localStorage.getItem(DISMISS_KEY) ?? "0");
      dismissed = Number.isFinite(until) && until > Date.now();
    } catch {
      /* storage blocked */
    }
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIos(isIos);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      try {
        window.localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
    };
    const onRequest = () => setVisible(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("pp-request-install", onRequest);
    if (isIos && !dismissed) setVisible(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("pp-request-install", onRequest);
    };
  }, []);

  function close(remember = true) {
    setVisible(false);
    if (!remember) return;
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    close();
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install PoultryPro"
      className="mobile-safe-bottom fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl sm:left-4 sm:right-auto lg:bottom-3"
    >
      <button
        type="button"
        onClick={() => close()}
        aria-label="Dismiss install prompt"
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-lg" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Install PoultryPro</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ios ? "In Safari, tap Share, then Add to Home Screen." : "Add PoultryPro to this device for faster access to your farm dashboard."}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => close()}
        >
          Not now
        </Button>
        {ios ? <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground"><Share className="h-3.5 w-3.5" /> Share</span> : <Button
          type="button"
          size="sm"
          onClick={install}
          disabled={!deferred}
        >
          <Download className="h-3.5 w-3.5" /> Install
        </Button>}
      </div>
    </div>
  );
}
