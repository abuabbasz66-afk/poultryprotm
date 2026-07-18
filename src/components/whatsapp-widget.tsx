import { useEffect, useState, lazy, Suspense } from "react";
import { useRouterState } from "@tanstack/react-router";

const PANEL = lazy(() => import("./whatsapp-widget-panel"));

const WHATSAPP_NUMBER = "2348065301413";
const DEFAULT_MSG =
  "Hello PoultryPro Team,\n\nI would like to know more about PoultryPro. Please provide me with more information.\n\nThank you.";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_MSG)}`;

const HIDE_PREFIXES = ["/_authenticated", "/dashboard", "/onboarding", "/import", "/super-admin", "/presentation", "/lovable"];
const DISMISS_KEY = "pp_wa_dismissed";

export function WhatsAppWidget() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {}
  }, []);

  if (!mounted) return null;
  if (HIDE_PREFIXES.some((p) => path.startsWith(p))) return null;
  if (dismissed) return null;

  const trackClick = () => {
    try {
      // Fire-and-forget analytics ping; safe to fail silently.
      void fetch("/api/public/whatsapp-click", { method: "POST", keepalive: true }).catch(() => {});
    } catch {}
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3 print:hidden">
      {open && (
        <Suspense fallback={null}>
          <PANEL onClose={() => setOpen(false)} onCtaClick={trackClick} />
        </Suspense>
      )}
      <div className="flex items-center gap-2">
        {!open && (
          <button
            onClick={() => { setDismissed(true); try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {} }}
            aria-label="Dismiss chat"
            className="h-8 w-8 rounded-full bg-white/90 text-[color:var(--ink)] text-sm shadow-md hover:bg-white"
          >
            ×
          </button>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Minimize chat" : "Open chat"}
          className="group relative flex items-center gap-2 rounded-full bg-[#25D366] pl-3 pr-4 py-3 text-white shadow-[0_10px_30px_-8px_rgba(37,211,102,0.65)] hover:brightness-105 transition"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <svg viewBox="0 0 32 32" className="h-5 w-5 fill-white" aria-hidden>
              <path d="M19.11 17.24c-.28-.14-1.63-.8-1.88-.9-.25-.09-.44-.14-.62.14-.19.28-.71.9-.87 1.08-.16.19-.32.21-.6.07-.28-.14-1.17-.43-2.22-1.37-.82-.73-1.37-1.63-1.53-1.91-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.49.14-.16.19-.28.28-.46.09-.19.05-.35-.02-.49-.07-.14-.62-1.5-.85-2.06-.22-.54-.45-.47-.62-.47-.16-.01-.35-.01-.53-.01-.19 0-.49.07-.75.35-.26.28-.98.96-.98 2.34s1 2.72 1.14 2.9c.14.19 1.97 3 4.77 4.2.67.29 1.19.46 1.6.59.67.21 1.28.18 1.76.11.54-.08 1.63-.66 1.86-1.3.23-.63.23-1.17.16-1.3-.07-.13-.26-.21-.54-.35zM16.03 5.33c-5.9 0-10.7 4.8-10.7 10.7 0 1.89.5 3.74 1.45 5.37L5 27.33l6.08-1.59a10.7 10.7 0 004.94 1.26h.01c5.9 0 10.7-4.8 10.7-10.7 0-2.86-1.11-5.55-3.13-7.57a10.63 10.63 0 00-7.57-3.4zm0 19.42h-.01a8.72 8.72 0 01-4.44-1.22l-.32-.19-3.61.95.96-3.52-.21-.36a8.7 8.7 0 01-1.34-4.65c0-4.81 3.91-8.72 8.73-8.72 2.33 0 4.52.91 6.17 2.56a8.66 8.66 0 012.56 6.17c0 4.81-3.92 8.73-8.73 8.73z"/>
            </svg>
          </span>
          <span className="text-sm font-semibold hidden sm:inline">Chat with us</span>
        </button>
      </div>
    </div>
  );
}
