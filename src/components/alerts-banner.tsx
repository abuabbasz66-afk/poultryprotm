import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, BellRing, ShieldCheck } from "lucide-react";
import { useUnreadAlerts, SEVERITY_STYLES, CATEGORY_LABELS, alertTimeAgo } from "@/lib/alerts";
import { cn } from "@/lib/utils";

/**
 * Priority alert strip. Rendered at the very top of the dashboard so the
 * farm owner sees what needs attention before anything else.
 */
export function AlertsBanner() {
  const { alerts, unread, markRead, loading } = useUnreadAlerts();
  if (loading) return null;

  const priority = unread.filter((a) => a.severity !== "info").slice(0, 3);
  const shown = priority.length > 0 ? priority : unread.slice(0, 2);

  if (shown.length === 0) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3">
        <ShieldCheck className="h-4.5 w-4.5 shrink-0 text-emerald-600" />
        <p className="min-w-0 flex-1 text-[13px] text-foreground">
          All clear — no alerts need your attention right now.
        </p>
        <Link to="/alerts" className="shrink-0 text-xs font-medium text-[color:var(--forest)] hover:underline">
          Alerts
        </Link>
      </section>
    );
  }

  const worst = shown.some((a) => a.severity === "critical");

  return (
    <section
      className={cn(
        "rounded-2xl border p-4",
        worst ? "border-destructive/35 bg-destructive/6" : "border-amber-400/40 bg-amber-400/8",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 font-display text-sm font-semibold text-foreground">
          {worst ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <BellRing className="h-4 w-4 text-amber-600" />}
          Needs your attention
          <span className="rounded-full bg-foreground/10 px-2 py-px text-[10px] font-semibold">{unread.length}</span>
        </h2>
        <Link to="/alerts" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[color:var(--forest)] hover:underline">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <ul className="mt-3 space-y-2">
        {shown.map((a) => {
          const s = SEVERITY_STYLES[a.severity];
          return (
            <li key={a.id} className="flex items-start gap-2.5 rounded-xl bg-card/70 px-3 py-2.5">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", s.dot)} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-foreground">{a.title}</span>
                  <span className={cn("rounded-full border px-1.5 py-px text-[9px] uppercase tracking-wider", s.badge)}>
                    {CATEGORY_LABELS[a.category]}
                  </span>
                  <span className="ml-auto text-[10.5px] text-muted-foreground">{alertTimeAgo(a.at)}</span>
                </div>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{a.message}</p>
                <div className="mt-1.5 flex items-center gap-3">
                  {a.to && (
                    <Link
                      to={a.to}
                      search={a.search as never}
                      hash={a.hash}
                      onClick={() => markRead([a.id])}
                      className="text-[11.5px] font-medium text-[color:var(--forest)] hover:underline"
                    >
                      Take action
                    </Link>
                  )}
                  <button onClick={() => markRead([a.id])} className="text-[11.5px] text-muted-foreground hover:underline">
                    Dismiss
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
