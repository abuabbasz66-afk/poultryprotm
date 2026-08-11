import { RequirePermission } from "@/components/require-permission";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Package, TrendingDown, Sparkles, Plus, Trash2, AlertTriangle, Wheat,
  ClipboardList, Beaker, ArrowDownRight, ArrowUpRight, Info, Check, Star, Pencil, X,
  ShoppingCart, Factory,
} from "lucide-react";
import {
  useFeedInventory,
  useFeedLedger,
  useFeedStockAnalytics,
  useAddInventoryLot,
  useDeleteInventoryLot,
  type FeedInventoryLot,
  type FeedLedgerEntry,
} from "@/lib/feed-inventory-data";
import {
  useFeedFormulas, computeFormulaCost, useCreateFormula, useUpdateFormula,
  useDeleteFormula, useDuplicateFormula, useSetActiveFormula, useUpsertIngredient, useDeleteIngredient,
  useSetFeedSource, type FeedFormulaWithIngredients, type FormulaIngredient,
} from "@/lib/feed-formulas-data";

import { useFeedIntelligence } from "@/lib/feed-intelligence";
import { useFarm } from "@/lib/farm-data";
import { toDateKey } from "@/lib/date-key";


type Tab = "overview" | "inventory" | "ledger" | "formulation";

export const Route = createFileRoute("/_authenticated/feed")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const t = search.tab;
    return t === "inventory" || t === "ledger" || t === "formulation" || t === "overview"
      ? { tab: t }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Feed Management — PoultryPro" },
      { name: "description", content: "Track feed inventory in kilograms, record daily usage, build feed formulas and get AI stock intelligence for your poultry farm." },
      { property: "og:title", content: "Feed Management & Formulation — PoultryPro" },
      { property: "og:description", content: "Feed inventory, usage ledger, formulation cost calculator and low-stock intelligence in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequirePermission permission="feed.read" hint="Feed management is not part of your access.">
      <FeedManagementPage />
    </RequirePermission>
  ),
});

function FeedManagementPage() {
  const navigate = useNavigate();
  const { tab: tabParam } = Route.useSearch();
  const tab: Tab = tabParam ?? "overview";
  const setTab = (next: Tab) => navigate({ to: "/feed", search: { tab: next }, hash: "" as never });
  const farm = useFarm();
  const stats = useFeedStockAnalytics();

  return (
    <div className="min-h-screen bg-[color:var(--bg)] pb-20">
      <header className="bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--forest-dark,#0d3520)] text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 pt-5 pb-6">
          <div className="flex items-center justify-between gap-3">
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-xs text-primary-foreground/90 hover:bg-white/10">
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] tracking-[0.18em] uppercase">Feed Ops</span>
          </div>
          <h1 className="mt-4 font-display text-2xl md:text-3xl font-semibold">Feed Management</h1>
          <p className="text-sm text-primary-foreground/80">
            Live inventory, movement ledger and predictive stock alerts for {farm.data?.name ?? "your farm"}.
          </p>

          {/* Sticky summary strip */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <StatChip label="Current Stock" value={fmtKg(stats.stockKg)} sub={`${fmtBags(stats.stockKg, stats.bagWeightKg)} bags`} tone={stats.status} />
            <StatChip label="Today's Usage" value={fmtKg(stats.todayKg)} sub={stats.todayKg > 0 ? "Auto-deducted" : "No entry yet"} />
            <StatChip label="Avg / Day" value={fmtKg(stats.avgDailyKg)} sub="Last 7 days" />
            <StatChip
              label="Days Remaining"
              value={Number.isFinite(stats.daysRemaining) ? `${Math.floor(stats.daysRemaining)}d` : "—"}
              sub={stats.depletion ? `Ends ${stats.depletion.toLocaleDateString()}` : "Add usage data"}
              tone={stats.status}
            />
          </div>
        </div>
      </header>

      {/* AI Alert Banner */}
      {stats.stockKg >= 0 && !stats.isLoading && <AlertBanner stats={stats} />}

      {/* Tabs */}
      <nav className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-2 md:px-4">
          <div className="flex gap-1 overflow-x-auto">
            <TabBtn active={tab === "overview"} onClick={() => setTab("overview")} icon={Sparkles}>Overview</TabBtn>
            <TabBtn active={tab === "inventory"} onClick={() => setTab("inventory")} icon={Package}>Warehouse</TabBtn>
            <TabBtn active={tab === "ledger"} onClick={() => setTab("ledger")} icon={ClipboardList}>Ledger</TabBtn>
            <TabBtn active={tab === "formulation"} onClick={() => setTab("formulation")} icon={Beaker}>Formulation</TabBtn>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {tab === "overview" && <OverviewTab />}
        {tab === "inventory" && <InventoryTab />}
        {tab === "ledger" && <LedgerTab />}
        {tab === "formulation" && <FormulationTab />}
      </main>
    </div>
  );
}




/* -------------------------------- Overview ------------------------------- */

function OverviewTab() {
  const stats = useFeedStockAnalytics();
  const inv = useFeedInventory();
  const lots = inv.data ?? [];
  const activeLots = lots.filter((l) => l.remaining_kg > 0);
  const runwayPct = Number.isFinite(stats.daysRemaining)
    ? Math.min(100, Math.max(0, (stats.daysRemaining / 30) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* Runway card */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Feed Runway</h2>
          <span className={"rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest " + statusChip(stats.status)}>
            {stats.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          At current consumption ({fmtKg(stats.avgDailyKg)}/day) your inventory covers{" "}
          <span className="font-medium text-foreground">
            {Number.isFinite(stats.daysRemaining) ? `${Math.floor(stats.daysRemaining)} days` : "—"}
          </span>
          {stats.depletion && (
            <> · depletes around <span className="font-medium text-foreground">{stats.depletion.toLocaleDateString()}</span></>
          )}
          .
        </p>
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={"h-full rounded-full transition-all " + progressColor(stats.status)}
            style={{ width: `${runwayPct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>0 days</span><span>15 days</span><span>30+ days</span>
        </div>
      </section>

      {/* KPI grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Current Stock" value={fmtKg(stats.stockKg)} sub={`${fmtBags(stats.stockKg, stats.bagWeightKg)} bags`} />
        <KpiCard label="Purchased (all-time)" value={fmtKg(stats.purchasedKg)} sub={`${lots.length} lots`} />
        <KpiCard label="Consumed" value={fmtKg(stats.usedKg)} sub="Since inception" />
        <KpiCard label="Active Lots" value={String(activeLots.length)} sub={activeLots.length ? "In circulation" : "Empty"} />
        <KpiCard label="Last 7 Days" value={fmtKg(stats.last7Kg)} sub={`Avg ${fmtKg(stats.avgDailyKg)}/day`} />
        <KpiCard label="Last 30 Days" value={fmtKg(stats.last30Kg)} sub="Rolling total" />
        <KpiCard label="Recommend Buy" value={stats.recommendPurchaseKg > 0 ? `${stats.recommendPurchaseBags} bags` : "OK"} sub={stats.recommendPurchaseKg > 0 ? `${fmtKg(stats.recommendPurchaseKg)}` : "30-day cover met"} />
        <KpiCard label="Bag Weight" value={`${stats.bagWeightKg} kg`} sub="Farm setting" />
      </section>

      <div id="feed-intelligence" className="scroll-mt-24" />
      <FeedIntelligencePanel />
    </div>
  );
}

/* ------------------------- AI Feed Intelligence -------------------------- */

function FeedIntelligencePanel() {
  const ai = useFeedIntelligence();

  const money = (n: number | null) =>
    n === null || !Number.isFinite(n) ? "—" : `₦${Math.round(n).toLocaleString()}`;
  const pct = (n: number | null) =>
    n === null || !Number.isFinite(n) ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
  const kg = (n: number) => `${Math.round(n).toLocaleString()} kg`;

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--gold)]/15 text-[color:var(--gold)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold">AI Feed Intelligence</h2>
            <p className="text-xs text-muted-foreground">Forecasts, efficiency and cost signals derived from your live records.</p>
          </div>
        </div>
        <span className="rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[color:var(--gold)]">
          Live
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <IntelStat
          label="Feed / bird / day"
          value={ai.gramsPerBirdPerDay !== null ? `${ai.gramsPerBirdPerDay.toFixed(0)} g` : "—"}
          sub={ai.efficiencyDeltaPct !== null
            ? `${pct(ai.efficiencyDeltaPct)} vs ${ai.benchmarkGramsPerBird}g target`
            : `${ai.totalBirds.toLocaleString()} birds`}
          tone={ai.efficiencyDeltaPct === null ? "neutral"
            : Math.abs(ai.efficiencyDeltaPct) > 15 ? "warn"
            : "good"}
        />
        <IntelStat
          label="Feed conversion"
          value={ai.kgPerCrate !== null ? `${ai.kgPerCrate.toFixed(2)} kg/crate` : "—"}
          sub={ai.fcrKgPerEgg !== null ? `${(ai.fcrKgPerEgg * 1000).toFixed(0)} g / egg (30d)` : "Awaiting production data"}
          tone="neutral"
        />
        <IntelStat
          label="Cost per crate"
          value={money(ai.costPerCrate)}
          sub={ai.inventoryUnitCost > 0 ? `Feed @ ${money(ai.inventoryUnitCost)}/kg` : "No priced stock"}
          tone="neutral"
        />
        <IntelStat
          label="7-day trend"
          value={pct(ai.trendPct)}
          sub={`${kg(ai.avg7Kg)}/day avg · prev ${kg(ai.prev7Kg / 7)}/day`}
          tone={Math.abs(ai.trendPct) < 10 ? "good" : ai.trendPct > 0 ? "warn" : "neutral"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-secondary/40 p-4">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Reorder planning</div>
          <div className="mt-1 font-display text-2xl font-semibold">
            {ai.reorderByDate ? ai.reorderByDate.toLocaleDateString() : "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {ai.daysUntilReorder !== null
              ? `Order in ${ai.daysUntilReorder} day${ai.daysUntilReorder === 1 ? "" : "s"} (assumes ${ai.leadTimeDays}-day supplier lead time)`
              : "Log daily feed to generate a reorder date."}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/40 p-4">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Buy vs produce</div>
          <div className="mt-1 font-display text-2xl font-semibold">
            {ai.buyVsProduceDeltaPct !== null ? pct(ai.buyVsProduceDeltaPct) : "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {ai.activeFormulaCost !== null && ai.marketBuyCost !== null
              ? `Formula ${money(ai.activeFormulaCost)}/kg · Market ${money(ai.marketBuyCost)}/kg`
              : "Set a market feed price and active formula to compare."}
          </div>
        </div>
      </div>

      {ai.insights.length > 0 && (
        <ul className="mt-4 space-y-2">
          {ai.insights.map((i) => (
            <li key={i.id} className={"rounded-2xl border p-3 text-sm " + insightTone(i.severity)}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">{insightIcon(i.severity)}</span>
                <div className="flex-1">
                  <div className="font-medium">{i.title}</div>
                  <div className="text-[13px] opacity-90">{i.detail}</div>
                  {i.action && (
                    <div className="mt-1 text-[11px] uppercase tracking-widest opacity-75">
                      Recommended · {i.action}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IntelStat({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string; tone: "good" | "warn" | "neutral" }) {
  const cls =
    tone === "good" ? "border-emerald-500/30 bg-emerald-50/40"
    : tone === "warn" ? "border-amber-500/40 bg-amber-50/40"
    : "border-border bg-secondary/40";
  return (
    <div className={"rounded-2xl border p-3 " + cls}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function insightTone(s: "critical" | "warning" | "info" | "positive") {
  switch (s) {
    case "critical": return "border-destructive/30 bg-destructive/5 text-destructive";
    case "warning": return "border-amber-500/40 bg-amber-50/50 text-amber-900";
    case "positive": return "border-emerald-500/30 bg-emerald-50/50 text-emerald-900";
    default: return "border-border bg-secondary text-foreground";
  }
}
function insightIcon(s: "critical" | "warning" | "info" | "positive") {
  if (s === "critical") return <AlertTriangle className="h-4 w-4" />;
  if (s === "warning") return <AlertTriangle className="h-4 w-4" />;
  if (s === "positive") return <Check className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

/* ------------------------------- Warehouse ------------------------------- */

const DAY_MS = 86400000;
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr + "T00:00:00").getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / DAY_MS);
}

type LotFilter = "all" | "active" | "empty" | "expiring" | "expired";
type LotSort = "oldest" | "newest" | "remaining_desc" | "remaining_asc" | "value_desc";

function InventoryTab() {
  const inv = useFeedInventory();
  const del = useDeleteInventoryLot();
  const farm = useFarm();
  const bagKg = farm.data?.bag_weight_kg ?? 25;
  const lots = inv.data ?? [];
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LotFilter>("all");
  const [sort, setSort] = useState<LotSort>("oldest");

  const kpis = useMemo(() => {
    const active = lots.filter((l) => l.remaining_kg > 0);
    const empty = lots.filter((l) => l.remaining_kg <= 0);
    const expiring = active.filter((l) => {
      const d = daysUntil(l.expiry_date);
      return d !== null && d >= 0 && d <= 14;
    });
    const expired = active.filter((l) => {
      const d = daysUntil(l.expiry_date);
      return d !== null && d < 0;
    });
    const totalKg = active.reduce((s, l) => s + l.remaining_kg, 0);
    const totalValue = active.reduce((s, l) => s + l.remaining_kg * l.unit_cost_per_kg, 0);
    const supplierMap = new Map<string, { kg: number; value: number; lots: number }>();
    for (const l of active) {
      const key = (l.supplier || "Unknown").trim() || "Unknown";
      const cur = supplierMap.get(key) ?? { kg: 0, value: 0, lots: 0 };
      cur.kg += l.remaining_kg;
      cur.value += l.remaining_kg * l.unit_cost_per_kg;
      cur.lots += 1;
      supplierMap.set(key, cur);
    }
    const suppliers = Array.from(supplierMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 5);
    const feedTypeMap = new Map<string, number>();
    for (const l of active) feedTypeMap.set(l.feed_type, (feedTypeMap.get(l.feed_type) ?? 0) + l.remaining_kg);
    const feedTypes = Array.from(feedTypeMap.entries()).sort((a, b) => b[1] - a[1]);
    return { active, empty, expiring, expired, totalKg, totalValue, suppliers, feedTypes };
  }, [lots]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = lots.filter((l) => {
      if (q && !`${l.feed_type} ${l.supplier ?? ""} ${l.batch_number ?? ""}`.toLowerCase().includes(q)) return false;
      const d = daysUntil(l.expiry_date);
      switch (filter) {
        case "active": return l.remaining_kg > 0;
        case "empty": return l.remaining_kg <= 0;
        case "expiring": return l.remaining_kg > 0 && d !== null && d >= 0 && d <= 14;
        case "expired": return l.remaining_kg > 0 && d !== null && d < 0;
        default: return true;
      }
    });
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "newest": return b.purchase_date.localeCompare(a.purchase_date);
        case "remaining_desc": return b.remaining_kg - a.remaining_kg;
        case "remaining_asc": return a.remaining_kg - b.remaining_kg;
        case "value_desc": return b.remaining_kg * b.unit_cost_per_kg - a.remaining_kg * a.unit_cost_per_kg;
        default: return a.purchase_date.localeCompare(b.purchase_date); // oldest (FIFO)
      }
    });
    return rows;
  }, [lots, query, filter, sort]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Feed Warehouse</h2>
          <p className="text-xs text-muted-foreground">Multi-batch inventory with FIFO consumption, expiry tracking and supplier insights.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--forest)] px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Feed
        </button>
      </div>

      {/* Warehouse KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <WhKpi label="Total Stock" value={fmtKg(kpis.totalKg)} sub={`${fmtBags(kpis.totalKg, bagKg)} bags`} />
        <WhKpi label="Inventory Value" value={`₦${Math.round(kpis.totalValue).toLocaleString()}`} sub={`${kpis.active.length} active lot${kpis.active.length === 1 ? "" : "s"}`} />
        <WhKpi
          label="Expiring ≤14d"
          value={String(kpis.expiring.length)}
          sub={kpis.expiring.length ? "Use these first" : "None expiring"}
          tone={kpis.expiring.length ? "warn" : "ok"}
        />
        <WhKpi
          label="Expired in stock"
          value={String(kpis.expired.length)}
          sub={kpis.expired.length ? "Review & discard" : "All fresh"}
          tone={kpis.expired.length ? "bad" : "ok"}
        />
      </div>

      {adding && <AddLotForm onClose={() => setAdding(false)} />}

      {/* Filters */}
      {lots.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search feed type, supplier, batch…"
              className={inputCls}
            />
          </div>
          <select className={inputCls + " max-w-[160px]"} value={filter} onChange={(e) => setFilter(e.target.value as LotFilter)}>
            <option value="all">All lots</option>
            <option value="active">Active</option>
            <option value="empty">Empty</option>
            <option value="expiring">Expiring ≤14d</option>
            <option value="expired">Expired</option>
          </select>
          <select className={inputCls + " max-w-[180px]"} value={sort} onChange={(e) => setSort(e.target.value as LotSort)}>
            <option value="oldest">Oldest first (FIFO)</option>
            <option value="newest">Newest first</option>
            <option value="remaining_desc">Most remaining</option>
            <option value="remaining_asc">Least remaining</option>
            <option value="value_desc">Highest value</option>
          </select>
        </div>
      )}

      {inv.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading warehouse…</p>
      ) : lots.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-secondary/40 p-8 text-center">
          <Wheat className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Warehouse is empty</p>
          <p className="text-xs text-muted-foreground">Record a purchase or produced batch to start tracking stock.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-secondary/40 p-6 text-center text-xs text-muted-foreground">
          No lots match the current filter.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((l) => (
            <LotCard key={l.id} lot={l} bagKg={bagKg} onDelete={() => {
              if (confirm(`Delete this ${l.feed_type} lot? This will not restore any usage already recorded.`)) del.mutate(l.id);
            }} />
          ))}
        </ul>
      )}

      {/* Supplier & feed-type breakdown */}
      {kpis.suppliers.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-4">
            <h3 className="font-display text-sm font-semibold">Top Suppliers</h3>
            <ul className="mt-3 space-y-2">
              {kpis.suppliers.map((s) => {
                const pct = kpis.totalKg > 0 ? (s.kg / kpis.totalKg) * 100 : 0;
                return (
                  <li key={s.name}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate">{s.name}</span>
                      <span className="text-muted-foreground">{fmtKg(s.kg)} · ₦{Math.round(s.value).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-[color:var(--forest)]" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rounded-3xl border border-border bg-card p-4">
            <h3 className="font-display text-sm font-semibold">Stock by Feed Type</h3>
            <ul className="mt-3 space-y-2">
              {kpis.feedTypes.map(([name, kg]) => {
                const pct = kpis.totalKg > 0 ? (kg / kpis.totalKg) * 100 : 0;
                return (
                  <li key={name}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate">{name}</span>
                      <span className="text-muted-foreground">{fmtKg(kg)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-[color:var(--gold,#c8a95a)]" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function WhKpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "bad" }) {
  const toneCls =
    tone === "bad"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "warn"
      ? "border-[color:var(--gold,#c8a95a)]/50 bg-[color:var(--gold,#c8a95a)]/10"
      : "border-border bg-card";
  return (
    <div className={"rounded-2xl border p-3 " + toneCls}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}


function LotCard({ lot, bagKg = 25, onDelete }: { lot: FeedInventoryLot; bagKg?: number; onDelete: () => void }) {
  const usedKg = Math.max(0, lot.initial_kg - lot.remaining_kg);
  const usedPct = lot.initial_kg > 0 ? (usedKg / lot.initial_kg) * 100 : 0;
  const empty = lot.remaining_kg <= 0;
  const daysLeft = daysUntil(lot.expiry_date);
  const expiryBadge =
    daysLeft === null || empty ? null
    : daysLeft < 0 ? { label: "Expired", cls: "bg-destructive/15 text-destructive" }
    : daysLeft <= 14 ? { label: `Expires in ${daysLeft}d`, cls: "bg-[color:var(--gold,#c8a95a)]/20 text-[color:var(--gold,#c8a95a)]" }
    : null;
  const lotValue = lot.remaining_kg * lot.unit_cost_per_kg;
  return (
    <li className={"rounded-2xl border p-4 " + (empty ? "border-border bg-secondary/50 opacity-70" : expiryBadge?.label === "Expired" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium truncate">{lot.feed_type}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{lot.source}</span>
            {empty && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Empty</span>}
            {expiryBadge && <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium " + expiryBadge.cls}>{expiryBadge.label}</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(lot.purchase_date).toLocaleDateString()}
            {lot.supplier ? ` · ${lot.supplier}` : ""}
            {lot.batch_number ? ` · #${lot.batch_number}` : ""}
            {lot.expiry_date ? ` · exp ${new Date(lot.expiry_date).toLocaleDateString()}` : ""}
          </p>
        </div>
        <button onClick={onDelete} className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete lot">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="font-display text-2xl font-semibold">{fmtKg(lot.remaining_kg)}</p>
          <p className="text-xs text-muted-foreground">of {fmtKg(lot.initial_kg)} · {fmtBags(lot.remaining_kg, bagKg)} bags left</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {lot.unit_cost_per_kg > 0 && <p>₦{lot.unit_cost_per_kg.toLocaleString()}/kg</p>}
          {lotValue > 0 && <p className="text-foreground font-medium">₦{Math.round(lotValue).toLocaleString()}</p>}
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-[color:var(--forest)]" style={{ width: `${Math.min(100, usedPct)}%` }} />
      </div>
    </li>
  );
}


function AddLotForm({ onClose }: { onClose: () => void }) {
  const farm = useFarm();
  const add = useAddInventoryLot();
  const bagWeight = farm.data?.bag_weight_kg ?? 25;
  const [form, setForm] = useState({
    feed_type: "Layer Feed",
    source: "purchase" as "purchase" | "production",
    mode: "bags" as "bags" | "kg",
    bags: "" as string | number,
    kg: "" as string | number,
    unit_cost_per_kg: "" as string | number,
    supplier: "",
    batch_number: "",
    purchase_date: toDateKey(new Date()) ?? new Date().toISOString().slice(0, 10),
    expiry_date: "",
  });

  const quantityKg =
    form.mode === "bags"
      ? Number(form.bags || 0) * bagWeight
      : Number(form.kg || 0);
  const totalCost = quantityKg * Number(form.unit_cost_per_kg || 0);

  return (
    <form
      className="rounded-3xl border border-border bg-card p-4 md:p-5 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await add.mutateAsync({
            feed_type: form.feed_type,
            source: form.source,
            quantity_kg: quantityKg,
            unit_cost_per_kg: Number(form.unit_cost_per_kg || 0),
            supplier: form.supplier || null,
            batch_number: form.batch_number || null,
            purchase_date: form.purchase_date,
            expiry_date: form.expiry_date || null,
          });
          onClose();
        } catch (err) {
          alert(err instanceof Error ? err.message : "Failed to save");
        }
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Add Feed to Inventory</h3>
        <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Feed type">
          <input className={inputCls} value={form.feed_type} onChange={(e) => setForm({ ...form, feed_type: e.target.value })} placeholder="Layer Feed" />
        </Field>
        <Field label="Source">
          <select className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as "purchase" | "production" })}>
            <option value="purchase">Purchase</option>
            <option value="production">Produced (formulated)</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Enter as">
          <select className={inputCls} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as "bags" | "kg" })}>
            <option value="bags">Bags</option>
            <option value="kg">Kilograms</option>
          </select>
        </Field>
        {form.mode === "bags" ? (
          <Field label={`Bags (${bagWeight} kg each)`}>
            <input type="number" inputMode="decimal" min={0} step="any" className={inputCls} value={form.bags} onChange={(e) => setForm({ ...form, bags: e.target.value })} />
          </Field>
        ) : (
          <Field label="Kilograms">
            <input type="number" inputMode="decimal" min={0} step="any" className={inputCls} value={form.kg} onChange={(e) => setForm({ ...form, kg: e.target.value })} />
          </Field>
        )}
        <Field label="Cost / kg (₦)">
          <input type="number" inputMode="decimal" min={0} step="any" className={inputCls} value={form.unit_cost_per_kg} onChange={(e) => setForm({ ...form, unit_cost_per_kg: e.target.value })} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Supplier"><input className={inputCls} value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></Field>
        <Field label="Batch #"><input className={inputCls} value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} /></Field>
        <Field label="Purchase date"><input type="date" className={inputCls} value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></Field>
        <Field label="Expiry date"><input type="date" className={inputCls} value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></Field>
      </div>

      <div className="rounded-2xl bg-secondary/60 p-3 text-xs text-muted-foreground">
        Total: <b className="text-foreground">{fmtKg(quantityKg)}</b>
        {" · "}<b className="text-foreground">{fmtBags(quantityKg, bagWeight)} bags</b>
        {totalCost > 0 && <> · Cost <b className="text-foreground">₦{totalCost.toLocaleString()}</b></>}
      </div>

      <button
        type="submit"
        disabled={add.isPending || quantityKg <= 0}
        className="w-full rounded-full bg-[color:var(--forest)] py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {add.isPending ? "Saving…" : "Add to Inventory"}
      </button>
    </form>
  );
}

/* -------------------------------- Ledger --------------------------------- */

function LedgerTab() {
  const q = useFeedLedger(300);
  const rows = q.data ?? [];
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold">Feed Ledger</h2>
        <p className="text-xs text-muted-foreground">Every purchase, production batch, daily usage and adjustment — with running balance.</p>
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading ledger…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-secondary/40 p-8 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No movements yet</p>
          <p className="text-xs text-muted-foreground">Add a feed lot or record daily usage — entries appear here automatically.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-3xl border border-border bg-card overflow-hidden">
          {rows.map((r) => <LedgerRow key={r.id} row={r} />)}
        </ul>
      )}
    </section>
  );
}

function LedgerRow({ row }: { row: FeedLedgerEntry }) {
  const isIn = row.quantity_kg > 0;
  const Icon = isIn ? ArrowUpRight : row.quantity_kg < 0 ? ArrowDownRight : Info;
  const tone = isIn ? "text-emerald-600" : row.quantity_kg < 0 ? "text-destructive" : "text-muted-foreground";
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={"grid h-8 w-8 place-items-center rounded-full bg-secondary " + tone}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium capitalize">{row.action}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {new Date(row.entry_date).toLocaleDateString()}
            {row.note ? ` · ${row.note}` : ""}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className={"text-sm font-semibold " + tone}>{isIn ? "+" : ""}{fmtKg(row.quantity_kg)}</p>
        <p className="text-[11px] text-muted-foreground">Bal {fmtKg(row.balance_after_kg)}</p>
      </div>
    </li>
  );
}

/* ------------------------------ Formulation ------------------------------ */

const DEFAULT_INGREDIENTS = [
  "Maize", "Soybean Meal", "Wheat Bran", "Layer Concentrate", "Limestone",
  "DCP", "Salt", "Lysine", "Methionine", "Premix", "Toxin Binder",
];

function FormulationTab() {
  const farm = useFarm();
  const bagKg = farm.data?.bag_weight_kg && farm.data.bag_weight_kg > 0 ? farm.data.bag_weight_kg : 25;
  const list = useFeedFormulas();
  const setSource = useSetFeedSource();
  const create = useCreateFormula();
  const setActive = useSetActiveFormula();
  const del = useDeleteFormula();
  const dup = useDuplicateFormula();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const formulas = list.data ?? [];
  const activeFormula = formulas.find((f) => f.is_active) ?? null;
  const selected = formulas.find((f) => f.id === selectedId) ?? formulas[0] ?? null;
  useEffect(() => {
    if (!selectedId && formulas[0]) setSelectedId(formulas[0].id);
  }, [selectedId, formulas]);

  const source = farm.data?.feed_source ?? "purchased";

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const id = await create.mutateAsync({ name });
    setSelectedId(id);
    setNewName("");
  }

  async function handleDuplicate() {
    if (!selected) return;
    const id = await dup.mutateAsync(selected);
    setSelectedId(id);
  }


  return (
    <div className="space-y-6">
      {/* Feed Source Selector */}
      <section className="rounded-3xl border border-border bg-card p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-[color:var(--forest)]/10 p-2.5">
            <Factory className="h-5 w-5 text-[color:var(--forest)]" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold">Feed Source</h2>
            <p className="text-xs text-muted-foreground">Choose how your farm sources feed. This decides which cost powers the profit engine.</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SourceCard
            active={source === "purchased"}
            onClick={() => setSource.mutate("purchased")}
            icon={ShoppingCart}
            title="Purchased Feed"
            desc="Uses the bag price from your Prices module."
          />
          <SourceCard
            active={source === "self_produced"}
            onClick={() => setSource.mutate("self_produced")}
            icon={Beaker}
            title="Self-Produced Feed"
            desc={activeFormula ? `Uses active formula "${activeFormula.name}".` : "Requires an Active Formula below."}
            disabled={!activeFormula && source !== "self_produced"}
          />
        </div>
        {source === "self_produced" && !activeFormula && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-[color:var(--gold)]" />
            <p>Select an <strong>Active Formula</strong> below — profit will otherwise fall back to purchased-feed pricing.</p>
          </div>
        )}
      </section>

      {/* Formula picker + create */}
      <section className="rounded-3xl border border-border bg-card p-4 md:p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display text-lg font-semibold">Your Formulas</h2>
            <p className="text-xs text-muted-foreground">{formulas.length} saved · unlimited ingredients per formula</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Layer Mash 18%"
              className={inputCls + " w-48"}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || create.isPending}
              className="inline-flex items-center gap-1 rounded-xl bg-[color:var(--forest)] px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          </div>
        </div>
        {formulas.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {formulas.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedId(f.id)}
                className={
                  "whitespace-nowrap rounded-xl border px-3 py-2 text-sm flex items-center gap-1.5 " +
                  (selected?.id === f.id
                    ? "border-[color:var(--forest)] bg-[color:var(--forest)]/5 text-[color:var(--forest)]"
                    : "border-border hover:bg-muted/50")
                }
              >
                {f.is_active && <Star className="h-3.5 w-3.5 fill-[color:var(--gold)] text-[color:var(--gold)]" />}
                {f.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Editor */}
      {selected ? (
        <FormulaEditor
          key={selected.id}
          formula={selected}
          bagKg={bagKg}
          onSetActive={() => setActive.mutate(selected.is_active ? null : selected.id)}
          onDuplicate={handleDuplicate}
          onDelete={async () => {
            if (!confirm(`Delete formula "${selected.name}"? This cannot be undone.`)) return;
            await del.mutateAsync(selected.id);
            setSelectedId(null);
          }}
        />

      ) : (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
          <Beaker className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Create your first formula to start costing feed production.</p>
        </div>
      )}
    </div>
  );
}

function SourceCard({
  active, onClick, icon: Icon, title, desc, disabled,
}: {
  active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "text-left rounded-2xl border p-3 transition-all " +
        (active
          ? "border-[color:var(--forest)] bg-[color:var(--forest)]/5 ring-2 ring-[color:var(--forest)]/20"
          : disabled
          ? "border-border opacity-50 cursor-not-allowed"
          : "border-border hover:border-[color:var(--forest)]/40 hover:bg-muted/40")
      }
    >
      <div className="flex items-center gap-2">
        <Icon className={"h-4 w-4 " + (active ? "text-[color:var(--forest)]" : "text-muted-foreground")} />
        <p className="text-sm font-semibold">{title}</p>
        {active && <Check className="ml-auto h-4 w-4 text-[color:var(--forest)]" />}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{desc}</p>
    </button>
  );
}

function FormulaEditor({
  formula, bagKg, onSetActive, onDuplicate, onDelete,
}: {
  formula: FeedFormulaWithIngredients;
  bagKg: number;
  onSetActive: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const update = useUpdateFormula();
  const upsertIng = useUpsertIngredient();
  const delIng = useDeleteIngredient();


  const [name, setName] = useState(formula.name);
  const [notes, setNotes] = useState(formula.notes ?? "");
  const [bagOverride, setBagOverride] = useState<string>(formula.bag_weight_kg ? String(formula.bag_weight_kg) : "");

  const effectiveBagKg = Number(bagOverride) > 0 ? Number(bagOverride) : bagKg;
  const cost = useMemo(() => computeFormulaCost(formula, effectiveBagKg), [formula, effectiveBagKg]);

  async function saveMeta() {
    await update.mutateAsync({
      id: formula.id,
      patch: {
        name: name.trim() || formula.name,
        notes: notes.trim() || null,
        bag_weight_kg: bagOverride.trim() === "" ? null : Number(bagOverride),
      },
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-3xl border border-border bg-card p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveMeta}
              className="w-full bg-transparent font-display text-xl font-semibold focus:outline-none border-b border-transparent focus:border-[color:var(--forest)]/40 pb-1"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveMeta}
              rows={1}
              placeholder="Add notes (target birds, mix instructions…)"
              className="mt-2 w-full resize-none bg-transparent text-xs text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSetActive}
              className={
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium " +
                (formula.is_active
                  ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10 text-foreground"
                  : "border-border hover:bg-muted/50")
              }
            >
              <Star className={"h-3.5 w-3.5 " + (formula.is_active ? "fill-[color:var(--gold)] text-[color:var(--gold)]" : "")} />
              {formula.is_active ? "Active" : "Set Active"}
            </button>
            <button
              onClick={onDuplicate}
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs hover:bg-muted/50"
            >
              <Plus className="h-3.5 w-3.5" /> Duplicate
            </button>
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1 rounded-xl border border-destructive/40 px-3 py-2 text-xs text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>


        {/* Cost breakdown */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">
          <KpiCard label="Total Weight" value={fmtKg(cost.totalKg)} sub={`${cost.rows.length} ingredients`} />
          <KpiCard label="Total Cost" value={"₦" + Math.round(cost.totalCost).toLocaleString()} />
          <KpiCard label="Cost / kg" value={"₦" + cost.costPerKg.toFixed(2)} />
          <KpiCard label={`Cost / ${effectiveBagKg}kg bag`} value={"₦" + Math.round(cost.costPerBag).toLocaleString()} />
          <KpiCard label="Bags Produced" value={cost.bagsProduced.toFixed(1)} sub={`${effectiveBagKg} kg/bag`} />
        </div>

        <div className="mt-3">
          <Field label={`Bag weight for this formula (kg) — defaults to farm setting (${bagKg} kg)`}>
            <input
              type="number"
              min={1}
              step="any"
              value={bagOverride}
              onChange={(e) => setBagOverride(e.target.value)}
              onBlur={saveMeta}
              placeholder={String(bagKg)}
              className={inputCls + " max-w-[200px]"}
            />
          </Field>
        </div>
      </section>

      {/* Ingredients table */}
      <section className="rounded-3xl border border-border bg-card p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold">Ingredients</h3>
            <p className="text-xs text-muted-foreground">Add any ingredient — maize, soybean, limestone, premix, DCP, lysine…</p>
          </div>
        </div>

        {/* Preset quick-add chips */}
        {(() => {
          const existing = new Set(cost.rows.map((r) => r.name.toLowerCase()));
          const remaining = DEFAULT_INGREDIENTS.filter((n) => !existing.has(n.toLowerCase()));
          if (!remaining.length) return null;
          return (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Quick add</p>
              <div className="flex flex-wrap gap-1.5">
                {remaining.map((n, idx) => (
                  <button
                    key={n}
                    onClick={() =>
                      upsertIng.mutateAsync({
                        formula_id: formula.id,
                        name: n,
                        quantity_kg: 0,
                        price_per_unit: 0,
                        unit: "kg",
                        unit_weight_kg: 1,
                        position: cost.rows.length + idx + 1,
                      })
                    }
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] hover:border-[color:var(--forest)]/40 hover:bg-[color:var(--forest)]/5"
                  >
                    + {n}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="mt-3 space-y-2">
          {cost.rows.map((row, i) => (
            <IngredientRow
              key={row.id}
              row={row}
              index={i + 1}
              onSave={(patch) => upsertIng.mutateAsync({ id: row.id, formula_id: formula.id, ...patch })}
              onDelete={() => delIng.mutate(row.id)}
            />
          ))}
          <IngredientRow
            key="new"
            row={null}
            index={cost.rows.length + 1}
            onSave={(patch) =>
              upsertIng.mutateAsync({ formula_id: formula.id, ...patch })
            }
          />
        </div>



        {/* Share bar */}
        {cost.totalCost > 0 && (
          <div className="mt-4 space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Cost composition</p>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
              {cost.rows.map((r, i) => (
                <div
                  key={r.id}
                  style={{ width: `${r.sharePct}%`, background: shareColor(i) }}
                  title={`${r.name}: ${r.sharePct.toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              {cost.rows.map((r, i) => (
                <span key={r.id} className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: shareColor(i) }} />
                  {r.name} {r.sharePct.toFixed(0)}%
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function IngredientRow({
  row, index, onSave, onDelete,
}: {
  row: (FormulaIngredient & { pricePerKg: number; lineCost: number; sharePct: number }) | null;
  index: number;
  onSave: (patch: {
    name: string; quantity_kg: number; price_per_unit: number;
    unit: "kg" | "bag"; unit_weight_kg: number; position: number;
  }) => Promise<unknown>;
  onDelete?: () => void;
}) {
  const isNew = !row;
  const [name, setName] = useState(row?.name ?? "");
  const [qty, setQty] = useState<string>(row ? String(row.quantity_kg) : "");
  const [price, setPrice] = useState<string>(row ? String(row.price_per_unit) : "");
  const [unit, setUnit] = useState<"kg" | "bag">(row?.unit ?? "kg");
  const [unitWt, setUnitWt] = useState<string>(
    row && row.unit === "bag" && row.unit_weight_kg > 0 ? String(row.unit_weight_kg) : "25",
  );
  const [dirty, setDirty] = useState(false);

  const qtyNum = Number(qty) || 0;
  const priceNum = Number(price) || 0;
  const bagWtNum = Number(unitWt) || 0;
  const weightKg = unit === "bag" ? qtyNum * bagWtNum : qtyNum;
  const line = qtyNum * priceNum; // price already matches the chosen unit
  const perKg = weightKg > 0 ? line / weightKg : 0;

  function changeUnit(next: "kg" | "bag") {
    setUnit(next);
    if (next === "bag" && (!(Number(unitWt) > 1))) setUnitWt("25");
    setDirty(true);
  }

  async function commit() {
    const n = name.trim();
    const q = Number(qty);
    const p = Number(price);
    if (!n || !Number.isFinite(q) || q <= 0) return;
    await onSave({
      name: n,
      quantity_kg: q,
      price_per_unit: Number.isFinite(p) ? p : 0,
      unit,
      unit_weight_kg: unit === "bag" ? Math.max(1, Number(unitWt) || 25) : 1,
      position: row?.position ?? index,
    });
    if (isNew) {
      setName(""); setQty(""); setPrice(""); setUnitWt("25");
    }
    setDirty(false);
  }

  return (
    <div className={"rounded-2xl border p-3 " + (isNew ? "border-dashed border-[color:var(--forest)]/30 bg-[color:var(--forest)]/5" : "border-border")}>
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-12 md:col-span-3">
          <Field label={isNew ? "Add ingredient" : `#${index} name`}>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setDirty(true); }}
              onBlur={() => dirty && commit()}
              placeholder="e.g. Maize"
              className={inputCls}
            />
          </Field>
        </div>
        <div className="col-span-4 md:col-span-2">
          <Field label={unit === "bag" ? "Qty (bags)" : "Qty (kg)"}>
            <input
              type="number" min={0} step="any"
              value={qty}
              onChange={(e) => { setQty(e.target.value); setDirty(true); }}
              onBlur={() => dirty && commit()}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="col-span-4 md:col-span-2">
          <Field label="Unit">
            <select
              value={unit}
              onChange={(e) => changeUnit(e.target.value as "kg" | "bag")}
              onBlur={() => dirty && commit()}
              className={inputCls}
            >
              <option value="kg">per kg</option>
              <option value="bag">per bag</option>
            </select>
          </Field>
        </div>
        <div className="col-span-4 md:col-span-2">
          <Field label={unit === "bag" ? "Price / bag (₦)" : "Price / kg (₦)"}>
            <input
              type="number" min={0} step="any"
              value={price}
              onChange={(e) => { setPrice(e.target.value); setDirty(true); }}
              onBlur={() => dirty && commit()}
              className={inputCls}
            />
          </Field>
        </div>
        {unit === "bag" && (
          <div className="col-span-6 md:col-span-1">
            <Field label="Bag kg">
              <input
                type="number" min={1} step="any"
                value={unitWt}
                onChange={(e) => { setUnitWt(e.target.value); setDirty(true); }}
                onBlur={() => dirty && commit()}
                className={inputCls}
              />
            </Field>
            <div className="mt-1 flex gap-1">
              {[25, 50, 100].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={async () => {
                    setUnitWt(String(w));
                    setDirty(true);
                    const n = name.trim();
                    const q = Number(qty);
                    const p = Number(price);
                    if (!n || !Number.isFinite(q) || q <= 0) return;
                    await onSave({
                      name: n,
                      quantity_kg: q,
                      price_per_unit: Number.isFinite(p) ? p : 0,
                      unit,
                      unit_weight_kg: unit === "bag" ? Math.max(1, w) : 1,
                      position: row?.position ?? index,
                    });
                    setDirty(false);
                  }}
                  className={
                    "rounded-md border px-1.5 py-0.5 text-[10px] " +
                    (Number(unitWt) === w
                      ? "border-[color:var(--forest)] bg-[color:var(--forest)]/10 text-[color:var(--forest)]"
                      : "border-border text-muted-foreground hover:bg-muted/50")
                  }
                >
                  {w}kg
                </button>
              ))}
            </div>
          </div>

        )}
        <div className={"col-span-" + (unit === "bag" ? "6" : "12") + " md:col-span-2 flex items-center justify-end gap-2"}>
          {!isNew && (
            <div className="text-right mr-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Line cost</p>
              <p className="text-sm font-semibold">₦{Math.round(line).toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">₦{perKg.toFixed(2)}/kg · {row?.sharePct.toFixed(0)}%</p>
            </div>
          )}
          {isNew ? (
            <button
              onClick={commit}
              disabled={!name.trim() || !(Number(qty) > 0)}
              className="inline-flex items-center gap-1 rounded-xl bg-[color:var(--forest)] px-3 py-2 text-xs text-primary-foreground disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          ) : (
            <button
              onClick={onDelete}
              className="rounded-xl border border-border p-2 text-muted-foreground hover:text-destructive hover:border-destructive/40"
              aria-label="Delete ingredient"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {qtyNum > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {unit === "bag"
            ? `${qtyNum} bag${qtyNum === 1 ? "" : "s"} × ${bagWtNum || 0} kg = ${weightKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`
            : `${qtyNum.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`}
          {priceNum > 0 && weightKg > 0 && (
            <span> · ₦{perKg.toLocaleString(undefined, { maximumFractionDigits: 2 })}/kg</span>
          )}
        </p>
      )}
    </div>
  );
}

const SHARE_COLORS = ["#0d3520", "#c9a24b", "#4a8f5f", "#8c6c2e", "#2b5c3d", "#d4b25c", "#6a4a1e", "#a5c0a0"];
function shareColor(i: number) { return SHARE_COLORS[i % SHARE_COLORS.length]; }



/* --------------------------------- UI bits ------------------------------- */

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--forest)]/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors " +
        (active
          ? "border-[color:var(--forest)] text-[color:var(--forest)]"
          : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function StatChip({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "healthy" | "low" | "critical" | "empty" }) {
  return (
    <div className={"rounded-2xl border p-3 backdrop-blur " + (tone === "critical" || tone === "empty"
      ? "border-destructive/40 bg-destructive/10"
      : tone === "low"
      ? "border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10"
      : "border-white/15 bg-white/5")}>
      <p className="text-[9px] uppercase tracking-widest text-primary-foreground/70">{label}</p>
      <p className="font-display text-lg font-semibold text-primary-foreground">{value}</p>
      {sub && <p className="text-[10px] text-primary-foreground/70">{sub}</p>}
    </div>
  );
}

function AlertBanner({ stats }: { stats: ReturnType<typeof useFeedStockAnalytics> }) {
  if (stats.status === "healthy" || stats.status === "empty") return null;
  const critical = stats.status === "critical";
  return (
    <div className={"mx-auto max-w-6xl px-4 pt-4"}>
      <div className={"flex items-start gap-3 rounded-2xl border p-3 " + (critical ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 text-foreground")}>
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium">{critical ? "Critical feed level" : "Feed running low"}</p>
          <p className="text-xs opacity-80">
            {Number.isFinite(stats.daysRemaining) ? `${Math.floor(stats.daysRemaining)} days` : "Unknown"} of feed remaining.
            {stats.recommendPurchaseBags > 0 && ` Recommend purchasing ${stats.recommendPurchaseBags} bags.`}
          </p>
        </div>
      </div>
    </div>
  );
}


/* --------------------------------- utils --------------------------------- */

function fmtKg(kg: number) {
  const v = Math.round(kg * 10) / 10;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}t`;
  return `${v.toLocaleString()} kg`;
}
function fmtBags(kg: number, bagWeight: number) {
  const b = kg / (bagWeight || 25);
  return (Math.round(b * 10) / 10).toLocaleString();
}
function statusChip(s: "healthy" | "low" | "critical" | "empty") {
  return s === "critical" || s === "empty"
    ? "bg-destructive/15 text-destructive"
    : s === "low"
    ? "bg-[color:var(--gold)]/20 text-foreground"
    : "bg-emerald-500/15 text-emerald-700";
}
function progressColor(s: "healthy" | "low" | "critical" | "empty") {
  return s === "critical" || s === "empty"
    ? "bg-destructive"
    : s === "low"
    ? "bg-[color:var(--gold)]"
    : "bg-[color:var(--forest)]";
}
