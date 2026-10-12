import { RequirePermission } from "@/components/require-permission";
import { useCallback, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCheck, ClipboardCheck, Info, Loader2, ShieldCheck } from "lucide-react";
import { useUnreadAlerts, SEVERITY_STYLES, CATEGORY_LABELS, alertTimeAgo } from "@/lib/alerts";
import {
  useAlertEvents,
  useAlertStates,
  useFarmIntelligence,
  useFarmPeople,
  type AlertStateRow,
} from "@/lib/intelligence/use-farm-intelligence";
import type { IntelCategory } from "@/lib/intelligence/engine";
import {
  followUp,
  isOpen,
  priorityFor,
  recurrence,
  suppressedByCooldown,
  type FollowUp,
} from "@/lib/intelligence/actions";
import { INTEL_CATEGORY_LABELS } from "@/components/intelligence/intel-alert-card";
import {
  ActionCard,
  EventList,
  PriorityBadge,
  STATUS_LABEL,
} from "@/components/intelligence/action-card";
import { RoomStatusList } from "@/components/intelligence/farm-intelligence-panel";
import { totalEggsFromRow } from "@/lib/egg-normalize";
import { toDateKey } from "@/lib/date-key";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alerts")({
  component: () => (
    <RequirePermission permission="dashboard.view" hint="Alerts are not part of your access.">
      <AlertsPage />
    </RequirePermission>
  ),
  head: () => ({
    meta: [
      { title: "Action Centre — PoultryPro" },
      {
        name: "description",
        content:
          "What needs attention on your poultry farm today, with recommended next steps, evidence and action tracking.",
      },
      { property: "og:title", content: "Action Centre — PoultryPro" },
      {
        property: "og:description",
        content:
          "Prioritised farm recommendations you can acknowledge, assign, resolve and follow up.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "today" | "progress" | "followup" | "history" | "updates";
const CATS: (IntelCategory | "all")[] = [
  "all",
  "production",
  "mortality",
  "feed",
  "health",
  "weather",
  "finance",
  "inventory",
  "operations",
];

function bySeries<T>(rows: T[], date: (r: T) => string | null, val: (r: T) => number) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = toDateKey(date(r));
    if (k) m.set(k, (m.get(k) ?? 0) + val(r));
  }
  return m;
}

const OUTCOME_TEXT: Record<FollowUp["outcome"], string> = {
  improved: "Records look better since",
  worse: "Records look worse since",
  similar: "Little change since",
  waiting: "Waiting for more days of records after",
  "no-data": "Not enough earlier records to compare",
};

function AlertsPage() {
  const { data: intel, items, input, loading, farmId } = useFarmIntelligence();
  const states = useAlertStates(intel, farmId, !loading);
  const events = useAlertEvents(farmId).data ?? [];
  const people = useFarmPeople(farmId).data ?? [];
  const legacy = useUnreadAlerts();
  const [tab, setTab] = useState<Tab>("today");
  const [cat, setCat] = useState<IntelCategory | "all">("all");

  const personName = useCallback(
    (id: string | null) => people.find((p) => p.id === id)?.name ?? "A team member",
    [people],
  );
  const eventsFor = (key: string) => events.filter((e) => e.alert_key === key);
  const repeats = useMemo(() => recurrence(events), [events]);

  const byCat = <T extends { category: string }>(rows: T[]) =>
    cat === "all" ? rows : rows.filter((r) => r.category === cat);
  const visible = items.filter((a) => {
    const row = states.rowOf(a.key);
    return (
      !suppressedByCooldown(a, row) && (!row || isOpen(row.status) || row.status === "resolved")
    );
  });
  const statusOf = (k: string) => {
    const r = states.rowOf(k);
    return r && r.status !== "resolved" ? r.status : "active";
  };
  const todayList = byCat(
    visible.filter((a) => ["active", "acknowledged"].includes(statusOf(a.key))),
  );
  const progressList = byCat(
    visible.filter((a) => ["assigned", "in_progress"].includes(statusOf(a.key))),
  );
  const closed = byCat(
    states.rows.filter((r) => r.status === "resolved" || r.status === "dismissed"),
  );
  const history = byCat(states.rows);
  const needs = items.filter((a) => a.category === "operations");

  const series = useMemo(
    () => ({
      production: bySeries(
        input.eggs,
        (r) => r.date,
        (r) => totalEggsFromRow(r),
      ),
      feed: bySeries(
        input.feed,
        (r) => r.date,
        (r) => r.bags,
      ),
      mortality: bySeries(
        input.mortality,
        (r) => r.date,
        (r) => r.loss,
      ),
    }),
    [input.eggs, input.feed, input.mortality],
  );
  const followFor = (r: AlertStateRow): FollowUp | null => {
    if (r.status !== "resolved" || !r.resolved_at) return null;
    const k = toDateKey(r.resolved_at)!;
    if (r.category === "production")
      return followUp(series.production, k, input.todayKey, "Eggs per day", true);
    if (r.category === "mortality")
      return followUp(series.mortality, k, input.todayKey, "Deaths per day", false);
    if (r.category === "feed")
      return followUp(series.feed, k, input.todayKey, "Feed bags per day", false);
    return null;
  };

  const updates = useMemo(
    () => legacy.alerts.filter((a) => !a.id.startsWith("intel:")),
    [legacy.alerts],
  );

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "today", label: "Today", count: todayList.length },
    { key: "progress", label: "In progress", count: progressList.length },
    { key: "followup", label: "Follow-up" },
    { key: "history", label: "History" },
    {
      key: "updates",
      label: "Other updates",
      count: legacy.unread.filter((a) => !a.id.startsWith("intel:")).length,
    },
  ];

  const renderCards = (list: typeof items, empty: string) =>
    list.length === 0 ? (
      <p className="mt-6 flex items-center gap-2 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-[color:var(--forest)]" />
        {empty}
      </p>
    ) : (
      <div className="mt-3 space-y-3">
        {list.map((a) => (
          <ActionCard
            key={a.key}
            item={a}
            row={states.rowOf(a.key)?.status === "resolved" ? undefined : states.rowOf(a.key)}
            events={eventsFor(a.key)}
            people={people}
            personName={personName}
            onAction={(verb, opts) =>
              states.transition(a, verb, { ...opts, priority: a.priority, evidence: a.evidence })
            }
          />
        ))}
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <header className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--forest)]/10 text-[color:var(--forest)]">
          <ClipboardCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold">Action Centre</h1>
          <p className="text-sm text-muted-foreground">
            What needs attention, what to do next, and whether it was resolved.
          </p>
        </div>
      </header>

      {(intel.dataGaps.length > 0 || needs.length > 0) && (
        <div className="mt-4 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-[12.5px] text-muted-foreground">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider">Records we need</p>
          {needs.map((n) => (
            <p key={n.key} className="flex gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {n.title} — {n.happened}
            </p>
          ))}
          {intel.dataGaps.map((g) => (
            <p key={g} className="flex gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {g}
            </p>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <div className="flex gap-1 overflow-x-auto border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition",
                  tab === t.key
                    ? "border-[color:var(--forest)] text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {t.count ? (
                  <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 text-[10px]">
                    {t.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {tab !== "updates" && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {CATS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                    cat === c
                      ? "border-[color:var(--forest)] bg-[color:var(--forest)] text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {c === "all" ? "All" : INTEL_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking your farm records…
            </p>
          ) : tab === "today" ? (
            renderCards(
              todayList,
              "Nothing needs your attention right now based on your latest records.",
            )
          ) : tab === "progress" ? (
            renderCards(progressList, "No actions are assigned or in progress.")
          ) : tab === "followup" ? (
            closed.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Resolved and dismissed items will appear here with what the records showed
                afterwards.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {closed.map((r) => {
                  const f = followFor(r);
                  const when = r.resolved_at ?? r.dismissed_at;
                  return (
                    <li
                      key={r.id}
                      className="rounded-2xl border border-border bg-card p-4 text-[13px]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <PriorityBadge priority={priorityFor(r.severity as never)} />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {INTEL_CATEGORY_LABELS[r.category as IntelCategory] ?? r.category}
                          {r.room ? ` · ${r.room}` : ""}
                        </span>
                        <span className="ml-auto rounded-full bg-secondary px-2 py-px text-[11px] font-medium">
                          {STATUS_LABEL[r.status]}
                        </span>
                      </div>
                      <p className="mt-1.5 font-semibold">{r.title}</p>
                      {r.message && <p className="text-muted-foreground">{r.message}</p>}
                      {r.resolution_note && (
                        <p className="mt-1">Action taken: “{r.resolution_note}”</p>
                      )}
                      {r.dismiss_reason && <p className="mt-1">Dismissed: {r.dismiss_reason}</p>}
                      {(repeats.get(r.alert_key) ?? 0) > 0 && (
                        <p className="mt-1 text-amber-700">
                          This has come back {repeats.get(r.alert_key)} time(s).
                        </p>
                      )}
                      {f && when && (
                        <div className="mt-2 rounded-xl bg-secondary/50 p-2.5 text-[12px]">
                          <p className="font-medium">
                            {OUTCOME_TEXT[f.outcome]}{" "}
                            {f.outcome !== "no-data" &&
                              new Date(when).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                              })}
                          </p>
                          {f.before !== null && (
                            <p className="text-muted-foreground">
                              {f.metric}: {Math.round(f.before).toLocaleString()} before (
                              {f.beforeDays} days)
                              {f.after !== null &&
                                ` → ${Math.round(f.after).toLocaleString()} after (${f.afterDays} days)`}
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            This compares records only; it does not prove the action caused the
                            change.
                          </p>
                        </div>
                      )}
                      {eventsFor(r.alert_key).length > 0 && (
                        <EventList events={eventsFor(r.alert_key)} personName={personName} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          ) : tab === "history" ? (
            history.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                History will build up here as PoultryPro watches your farm.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
                {history.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[13px]"
                  >
                    <PriorityBadge priority={priorityFor(r.severity as never)} />
                    <span className="min-w-0 flex-1 font-medium">{r.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {INTEL_CATEGORY_LABELS[r.category as IntelCategory] ?? r.category}
                      {r.room ? ` · ${r.room}` : ""}
                    </span>
                    <span className="w-full text-[11.5px] text-muted-foreground sm:w-auto">
                      {new Date(r.first_seen_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                      {" · "}
                      {STATUS_LABEL[r.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <>
              {legacy.unread.length > 0 && (
                <button
                  onClick={() => legacy.markAllRead(updates)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
              {updates.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No other updates.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {updates.map((a) => {
                    const read = legacy.isRead(a.id);
                    return (
                      <li
                        key={a.id}
                        className={cn(
                          "rounded-2xl border bg-card p-3.5",
                          read ? "border-border" : SEVERITY_STYLES[a.severity].ring,
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              read ? "bg-border" : SEVERITY_STYLES[a.severity].dot,
                            )}
                          />
                          <span className="text-sm font-semibold">{a.title}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {CATEGORY_LABELS[a.category]}
                            {a.premium ? " · AI" : ""}
                          </span>
                          <span className="ml-auto text-[11px] text-muted-foreground">
                            {alertTimeAgo(a.at)}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] text-muted-foreground">{a.message}</p>
                        <div className="mt-2 flex gap-3">
                          {a.to && (
                            <Link
                              to={a.to}
                              search={a.search as never}
                              hash={a.hash}
                              onClick={() => legacy.markRead([a.id])}
                              className="text-xs font-medium text-[color:var(--forest)] hover:underline"
                            >
                              Open details
                            </Link>
                          )}
                          {!read && (
                            <button
                              onClick={() => legacy.markRead([a.id])}
                              className="text-xs text-muted-foreground hover:underline"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Farm status
            </h2>
            <RoomStatusList rooms={intel.rooms} />
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Today's summary
            </h2>
            <p className="mt-2 text-[13px] text-foreground">{intel.summary}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
