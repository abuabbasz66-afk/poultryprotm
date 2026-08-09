import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useUnreadAlerts, SEVERITY_STYLES, CATEGORY_LABELS, alertTimeAgo } from "@/lib/alerts";
import { cn } from "@/lib/utils";

/** Notification bell with unread badge and a quick preview panel. */
export function AlertsBell({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { alerts, unread, count, isRead, markRead, markAllRead, loading } = useUnreadAlerts();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const top = alerts.slice(0, 6);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
          tone === "light"
            ? "border-white/20 text-primary-foreground hover:bg-white/10"
            : "border-border text-foreground hover:bg-muted",
        )}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[17px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-[17px] text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="font-display text-sm font-semibold">Alerts</div>
            {unread.length > 0 && (
              <button
                onClick={() => markAllRead(alerts)}
                className="inline-flex items-center gap-1 text-[11px] text-[color:var(--forest)] hover:underline"
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[52vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking your farm…
              </div>
            ) : top.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Nothing needs your attention right now.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {top.map((a) => {
                  const s = SEVERITY_STYLES[a.severity];
                  const read = isRead(a.id);
                  return (
                    <li key={a.id}>
                      <Link
                        to={a.to ?? "/alerts"}
                        search={a.search as never}
                        hash={a.hash}
                        onClick={() => { markRead([a.id]); setOpen(false); }}
                        className={cn("flex gap-2.5 px-4 py-3 transition hover:bg-muted/60", !read && "bg-muted/30")}
                      >
                        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", read ? "bg-border" : s.dot)} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-semibold">{a.title}</span>
                            <span className={cn("shrink-0 rounded-full border px-1.5 py-px text-[9px] uppercase tracking-wider", s.badge)}>
                              {CATEGORY_LABELS[a.category]}
                            </span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-[12px] text-muted-foreground">{a.message}</span>
                          <span className="mt-1 block text-[10.5px] text-muted-foreground">{alertTimeAgo(a.at)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link
            to="/alerts"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-2.5 text-center text-[12px] font-medium text-[color:var(--forest)] hover:bg-muted"
          >
            View all alerts
          </Link>
        </div>
      )}
    </div>
  );
}
