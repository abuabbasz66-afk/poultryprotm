import { RequirePermission } from "@/components/require-permission";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CheckCheck, Info, Loader2, ShieldCheck } from "lucide-react";
import { useUnreadAlerts, SEVERITY_STYLES, CATEGORY_LABELS, alertTimeAgo } from "@/lib/alerts";
import { useAlertStates, useFarmIntelligence } from "@/lib/intelligence/use-farm-intelligence";
import type { IntelCategory, IntelSeverity } from "@/lib/intelligence/engine";
import {
  IntelAlertCard, INTEL_CATEGORY_LABELS, SeverityBadge,
} from "@/components/intelligence/intel-alert-card";
import { RoomStatusList } from "@/components/intelligence/farm-intelligence-panel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alerts")({
  component: () => (
    <RequirePermission permission="dashboard.view" hint="Alerts are not part of your access.">
      <AlertsPage />
    </RequirePermission>
  ),
  head: () => ({
    meta: [
      { title: "Farm Alerts — PoultryPro" },
      { name: "description", content: "What needs attention on your poultry farm today: production, mortality, feed, health, weather and finance alerts with clear next steps." },
      { property: "og:title", content: "Farm Alerts — PoultryPro" },
      { property: "og:description", content: "Prioritised farm alerts with what happened, why it matters and what to check next." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "active" | "acknowledged" | "history" | "updates";
const CATS: (IntelCategory | "all")[] = ["all", "production", "mortality", "feed", "health", "weather", "finance", "inventory", "operations"];

function AlertsPage() {
  const { data: intel, loading, farmId } = useFarmIntelligence();
  const states = useAlertStates(intel, farmId, !loading);
  const legacy = useUnreadAlerts();
  const [tab, setTab] = useState<Tab>("active");
  const [cat, setCat] = useState<IntelCategory | "all">("all");

  const byCat = <T extends { category: string }>(rows: T[]) => (cat === "all" ? rows : rows.filter((r) => r.category === cat));
  const active = byCat(intel.alerts.filter((a) => states.statusOf(a.key) === "active"));
  const acked = byCat(intel.alerts.filter((a) => states.statusOf(a.key) === "acknowledged"));
  const history = byCat(states.rows);
  const updates = useMemo(() => legacy.alerts.filter((a) => !a.id.startsWith("intel:")), [legacy.alerts]);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "active", label: "Needs attention", count: intel.alerts.filter((a) => states.statusOf(a.key) === "active").length },
    { key: "acknowledged", label: "Seen", count: intel.alerts.filter((a) => states.statusOf(a.key) === "acknowledged").length },
    { key: "history", label: "History" },
    { key: "updates", label: "Other updates", count: legacy.unread.filter((a) => !a.id.startsWith("intel:")).length },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <header className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--forest)]/10 text-[color:var(--forest)]"><Bell className="h-5 w-5" /></span>
        <div>
          <h1 className="font-display text-2xl font-semibold">Farm Alerts</h1>
          <p className="text-sm text-muted-foreground">What deserves your attention on the farm, and what to check next.</p>
        </div>
      </header>

      {intel.dataGaps.length > 0 && (
        <div className="mt-4 space-y-1 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-[12.5px] text-muted-foreground">
          {intel.dataGaps.map((g) => <p key={g} className="flex gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{g}</p>)}
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <div className="flex gap-1 overflow-x-auto border-b border-border">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn("shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition", tab === t.key ? "border-[color:var(--forest)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {t.label}{t.count ? <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 text-[10px]">{t.count}</span> : null}
              </button>
            ))}
          </div>

          {tab !== "updates" && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {CATS.map((c) => (
                <button key={c} onClick={() => setCat(c)}
                  className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-medium", cat === c ? "border-[color:var(--forest)] bg-[color:var(--forest)] text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted")}>
                  {c === "all" ? "All" : INTEL_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking your farm records…</p>
          ) : tab === "active" || tab === "acknowledged" ? (
            (tab === "active" ? active : acked).length === 0 ? (
              <p className="mt-6 flex items-center gap-2 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-[color:var(--forest)]" />
                {tab === "active" ? "Nothing needs your attention right now based on your latest records." : "No alerts marked as seen."}
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {(tab === "active" ? active : acked).map((a) => (
                  <IntelAlertCard key={a.key} alert={a} status={states.statusOf(a.key)} onAcknowledge={() => void states.acknowledge(a)} />
                ))}
              </div>
            )
          ) : tab === "history" ? (
            history.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">Alert history will build up here as PoultryPro watches your farm.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
                {history.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[13px]">
                    <SeverityBadge severity={r.severity as IntelSeverity} />
                    <span className="min-w-0 flex-1 font-medium">{r.title}</span>
                    <span className="text-xs text-muted-foreground">{INTEL_CATEGORY_LABELS[r.category as IntelCategory] ?? r.category}{r.room ? ` · ${r.room}` : ""}</span>
                    <span className="w-full text-[11.5px] text-muted-foreground sm:w-auto">
                      {new Date(r.first_seen_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {" · "}
                      {r.status === "resolved" && r.resolved_at
                        ? `Resolved ${new Date(r.resolved_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                        : r.status === "acknowledged" ? "Seen" : "Active"}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <>
              {legacy.unread.length > 0 && (
                <button onClick={() => legacy.markAllRead(updates)} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
              {updates.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">No other updates.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {updates.map((a) => {
                    const read = legacy.isRead(a.id);
                    return (
                      <li key={a.id} className={cn("rounded-2xl border bg-card p-3.5", read ? "border-border" : SEVERITY_STYLES[a.severity].ring)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", read ? "bg-border" : SEVERITY_STYLES[a.severity].dot)} />
                          <span className="text-sm font-semibold">{a.title}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{CATEGORY_LABELS[a.category]}{a.premium ? " · AI" : ""}</span>
                          <span className="ml-auto text-[11px] text-muted-foreground">{alertTimeAgo(a.at)}</span>
                        </div>
                        <p className="mt-1 text-[13px] text-muted-foreground">{a.message}</p>
                        <div className="mt-2 flex gap-3">
                          {a.to && <Link to={a.to} search={a.search as never} hash={a.hash} onClick={() => legacy.markRead([a.id])} className="text-xs font-medium text-[color:var(--forest)] hover:underline">Open details</Link>}
                          {!read && <button onClick={() => legacy.markRead([a.id])} className="text-xs text-muted-foreground hover:underline">Mark read</button>}
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
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Farm status</h2>
            <RoomStatusList rooms={intel.rooms} />
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Today's summary</h2>
            <p className="mt-2 text-[13px] text-foreground">{intel.summary}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
