import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import {
  useUnreadAlerts, SEVERITY_STYLES, CATEGORY_LABELS, alertTimeAgo,
  type AlertCategory,
} from "@/lib/alerts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alerts")({
  component: () => (
    <RequirePermission permission="dashboard.view" hint="Alerts are not part of your access.">
      <AlertsPage />
    </RequirePermission>
  ),
  head: () => ({
    meta: [
      { title: "Alerts & Notifications — PoultryPro" },
      { name: "description", content: "Every price change, health risk, operational gap and team action on your poultry farm, in one prioritised alert feed." },
      { property: "og:title", content: "Alerts & Notifications — PoultryPro" },
      { property: "og:description", content: "Prioritised farm alerts: price changes, disease risk, missed records and staff activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const FILTERS: { key: "all" | AlertCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "price", label: "Price" },
  { key: "health", label: "Health" },
  { key: "operations", label: "Operations" },
  { key: "activity", label: "Activity" },
];

function AlertsPage() {
  const { alerts, unread, isRead, markRead, markAllRead, loading } = useUnreadAlerts();
  const [filter, setFilter] = useState<"all" | AlertCategory>("all");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const shown = useMemo(
    () => alerts.filter((a) =>
      (filter === "all" || a.category === filter) && (!onlyUnread || !isRead(a.id))),
    [alerts, filter, onlyUnread, isRead],
  );

  return (
    <div className="container-x py-6 md:py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 font-display text-2xl font-semibold text-foreground">
            <Bell className="h-5 w-5 text-[color:var(--forest)]" /> Alerts &amp; Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Price changes, health risks, missed records and team activity — newest first.
          </p>
        </div>
        {unread.length > 0 && (
          <button
            onClick={() => markAllRead(alerts)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read ({unread.length})
          </button>
        )}
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              filter === f.key
                ? "border-[color:var(--forest)] bg-[color:var(--forest)] text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setOnlyUnread((v) => !v)}
          className={cn(
            "ml-auto rounded-full border px-3 py-1.5 text-xs font-medium transition",
            onlyUnread ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          {onlyUnread ? "Showing unread" : "Show unread only"}
        </button>
      </div>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking your farm records…
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No alerts here. PoultryPro will notify you the moment something changes.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {shown.map((a) => {
            const s = SEVERITY_STYLES[a.severity];
            const read = isRead(a.id);
            return (
              <li key={a.id}>
                <div className={cn("rounded-2xl border bg-card p-4 transition", read ? "border-border" : s.ring)}>
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", read ? "bg-border" : s.dot)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-foreground">{a.title}</h2>
                        <span className={cn("rounded-full border px-2 py-px text-[10px] font-semibold uppercase tracking-wider", s.badge)}>
                          {CATEGORY_LABELS[a.category]}
                        </span>
                        {a.premium && (
                          <span className="rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/15 px-2 py-px text-[10px] uppercase tracking-wider text-[color:var(--gold)]">
                            AI
                          </span>
                        )}
                        <span className="ml-auto text-[11px] text-muted-foreground">{alertTimeAgo(a.at)}</span>
                      </div>
                      <p className="mt-1.5 text-[13px] text-muted-foreground">{a.message}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-3">
                        {a.to && (
                          <Link
                            to={a.to}
                            search={a.search as never}
                            hash={a.hash}
                            onClick={() => markRead([a.id])}
                            className="text-xs font-medium text-[color:var(--forest)] hover:underline"
                          >
                            Open details
                          </Link>
                        )}
                        {!read && (
                          <button
                            onClick={() => markRead([a.id])}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            Mark as read
                          </button>
                        )}
                        <span className="text-[11px] text-muted-foreground">{read ? "Read" : "Unread"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
