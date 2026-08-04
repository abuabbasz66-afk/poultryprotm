import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, Bell } from "lucide-react";
import { usePermissions } from "@/lib/rbac";
import { useSecurityEvents } from "@/routes/_authenticated/activity";
import { describeEvent, timeAgo } from "@/lib/security-events";
import { cn } from "@/lib/utils";

const SEEN_KEY = "pp.staff-activity.seen";

/**
 * Owner-only "Recent Staff Activity" widget. Polls the immutable security
 * event feed and raises a browser notification for staff logins the owner has
 * not seen yet (delivered on next open when the app was closed).
 */
export function RecentStaffActivity() {
  const { can, loading } = usePermissions();
  const enabled = !loading && can("audit.read");
  const q = useSecurityEvents(enabled, 25);
  const notified = useRef<Set<string>>(new Set());

  const events = (q.data ?? []).filter((e) => e.actor_role !== "owner");

  useEffect(() => {
    if (!enabled || events.length === 0) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    let lastSeen = "";
    try { lastSeen = window.localStorage.getItem(SEEN_KEY) ?? ""; } catch { /* ignore */ }

    for (const e of [...events].reverse()) {
      if (e.created_at <= lastSeen || notified.current.has(e.id)) continue;
      if (e.event_type !== "login" && e.event_type !== "login_failed") continue;
      notified.current.add(e.id);
      try {
        new Notification(e.event_type === "login" ? "🔔 Staff login" : "🔴 Failed login attempt", {
          body: describeEvent(e),
          tag: e.id,
        });
      } catch { /* ignore */ }
    }
    try { window.localStorage.setItem(SEEN_KEY, events[0]!.created_at); } catch { /* ignore */ }
  }, [enabled, events]);

  if (!enabled) return null;

  const askPermission = () => {
    if (typeof window !== "undefined" && "Notification" in window) void Notification.requestPermission();
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 font-display text-base font-semibold text-foreground">
          <Activity className="h-4 w-4 text-[color:var(--forest)]" /> Recent Staff Activity
        </h3>
        <div className="flex items-center gap-2">
          {typeof window !== "undefined" && "Notification" in window && Notification.permission === "default" && (
            <button onClick={askPermission} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted">
              <Bell className="h-3 w-3" /> Enable alerts
            </button>
          )}
          <Link to="/activity" className="inline-flex items-center gap-1 text-xs text-[color:var(--forest)] hover:underline">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {q.isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading activity…</p>
      ) : events.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No staff activity yet. Sign-ins by your team will appear here.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {events.slice(0, 6).map((e) => (
            <li key={e.id} className="flex items-start gap-2.5 text-sm">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", e.event_type === "login_failed" ? "bg-destructive" : "bg-emerald-500")} />
              <span className="min-w-0 flex-1 text-muted-foreground">
                <span className="text-foreground">{describeEvent(e)}</span>{" "}
                <span className="whitespace-nowrap text-xs">— {timeAgo(e.created_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
