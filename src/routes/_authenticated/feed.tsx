import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Package, TrendingDown, Sparkles, Plus, Trash2, AlertTriangle, Wheat, ClipboardList, Beaker, ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import {
  useFeedInventory,
  useFeedLedger,
  useFeedStockAnalytics,
  useAddInventoryLot,
  useDeleteInventoryLot,
  type FeedInventoryLot,
  type FeedLedgerEntry,
} from "@/lib/feed-inventory-data";
import { useFarm } from "@/lib/farm-data";
import { toDateKey } from "@/lib/date-key";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Feed Management — PoultryPro" },
      { name: "description", content: "Track feed inventory, ledger movements and AI-powered stock intelligence for your farm." },
    ],
  }),
  component: FeedManagementPage,
});

type Tab = "overview" | "inventory" | "ledger" | "formulation";

function FeedManagementPage() {
  const [tab, setTab] = useState<Tab>("overview");
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
            <TabBtn active={tab === "inventory"} onClick={() => setTab("inventory")} icon={Package}>Inventory</TabBtn>
            <TabBtn active={tab === "ledger"} onClick={() => setTab("ledger")} icon={ClipboardList}>Ledger</TabBtn>
            <TabBtn active={tab === "formulation"} onClick={() => setTab("formulation")} icon={Beaker}>Formulation</TabBtn>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {tab === "overview" && <OverviewTab />}
        {tab === "inventory" && <InventoryTab />}
        {tab === "ledger" && <LedgerTab />}
        {tab === "formulation" && <FormulationPlaceholder />}
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

      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-[color:var(--gold)]" /> AI Feed Intelligence
        </div>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {stats.stockKg <= 0 && (
            <li className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-destructive">
              <b>Out of feed.</b> Record a purchase or produced batch to restart tracking.
            </li>
          )}
          {stats.status === "critical" && (
            <li className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-destructive">
              <b>Critical — less than 5 days remaining.</b> Purchase {stats.recommendPurchaseBags} bags ({fmtKg(stats.recommendPurchaseKg)}) to restore a 30-day buffer.
            </li>
          )}
          {stats.status === "low" && (
            <li className="rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-3 text-foreground">
              <b>Feed running low.</b> Ordering ~{stats.recommendPurchaseBags} bags before {stats.depletion?.toLocaleDateString() ?? "next week"} keeps operations smooth.
            </li>
          )}
          {stats.status === "healthy" && stats.stockKg > 0 && (
            <li className="rounded-2xl border border-emerald-500/30 bg-emerald-50/50 p-3 text-emerald-900">
              <b>Stock is healthy.</b> Runway exceeds 10 days at current consumption.
            </li>
          )}
          {stats.avgDailyKg === 0 && (
            <li className="rounded-2xl border border-border bg-secondary p-3">
              <Info className="mr-1 inline h-3.5 w-3.5" /> No feed usage recorded in the last 30 days. Recommendations improve as you log daily feed.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------- Inventory ------------------------------- */

function InventoryTab() {
  const inv = useFeedInventory();
  const del = useDeleteInventoryLot();
  const lots = inv.data ?? [];
  const [adding, setAdding] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Feed Inventory</h2>
          <p className="text-xs text-muted-foreground">FIFO ledger — oldest lot is consumed first.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--forest)] px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Feed
        </button>
      </div>

      {adding && <AddLotForm onClose={() => setAdding(false)} />}

      {inv.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading inventory…</p>
      ) : lots.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-secondary/40 p-8 text-center">
          <Wheat className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No feed in inventory</p>
          <p className="text-xs text-muted-foreground">Record a purchase or produced batch to start tracking stock.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lots.map((l) => (
            <LotCard key={l.id} lot={l} onDelete={() => {
              if (confirm(`Delete this ${l.feed_type} lot? This will not restore any usage already recorded.`)) del.mutate(l.id);
            }} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LotCard({ lot, onDelete }: { lot: FeedInventoryLot; onDelete: () => void }) {
  const usedKg = Math.max(0, lot.initial_kg - lot.remaining_kg);
  const usedPct = lot.initial_kg > 0 ? (usedKg / lot.initial_kg) * 100 : 0;
  const empty = lot.remaining_kg <= 0;
  return (
    <li className={"rounded-2xl border p-4 " + (empty ? "border-border bg-secondary/50 opacity-70" : "border-border bg-card")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{lot.feed_type}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{lot.source}</span>
            {empty && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Empty</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(lot.purchase_date).toLocaleDateString()}
            {lot.supplier ? ` · ${lot.supplier}` : ""}
            {lot.batch_number ? ` · #${lot.batch_number}` : ""}
          </p>
        </div>
        <button onClick={onDelete} className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete lot">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="font-display text-2xl font-semibold">{fmtKg(lot.remaining_kg)}</p>
          <p className="text-xs text-muted-foreground">of {fmtKg(lot.initial_kg)} · {fmtBags(lot.remaining_kg, 25)} bags left</p>
        </div>
        {lot.unit_cost_per_kg > 0 && (
          <p className="text-right text-xs text-muted-foreground">
            ₦{lot.unit_cost_per_kg.toLocaleString()}/kg
          </p>
        )}
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

/* ----------------------------- Formulation stub -------------------------- */

function FormulationPlaceholder() {
  return (
    <section className="rounded-3xl border border-dashed border-[color:var(--gold)]/50 bg-gradient-to-br from-[color:var(--gold)]/8 to-transparent p-8 text-center">
      <Beaker className="mx-auto h-10 w-10 text-[color:var(--gold)]" />
      <h2 className="mt-3 font-display text-xl font-semibold">Feed Formulation — Coming next</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Build unlimited formulas (Layer, Broiler, Grower…) with automatic ingredient costing, production overheads and cost per 25 kg bag. When active, its cost per kg powers your profit engine automatically.
      </p>
      <p className="mt-3 text-[11px] uppercase tracking-widest text-[color:var(--gold)]">Phase 2 · Ships next</p>
    </section>
  );
}

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

function FormulationTab() { return <FormulationPlaceholder />; }
void FormulationTab; // reserved for phase 2

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
