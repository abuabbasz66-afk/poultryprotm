/**
 * In-app install prompt. Captures Chrome/Android `beforeinstallprompt`, shows a
 * branded card and never re-appears once the user dismisses or installs.
 */
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "pp-install-dismissed";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* storage blocked */
    }
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (dismissed || standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function close(remember = true) {
    setVisible(false);
    if (!remember) return;
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return close();
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
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl sm:left-4 sm:right-auto"
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
            Install PoultryPro on your phone for faster access to your farm dashboard.
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => close()}
          className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={install}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Download className="h-3.5 w-3.5" /> Install
        </button>
      </div>
    </div>
  );
}
