import { createFileRoute, Link } from "@tanstack/react-router";
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
  const [unitWt, setUnitWt] = useState<string>(row ? String(row.unit_weight_kg) : "50");
  const [dirty, setDirty] = useState(false);

  const perKg = unit === "bag" ? (Number(unitWt) > 0 ? Number(price) / Number(unitWt) : 0) : Number(price);
  const line = Number(qty) * (Number.isFinite(perKg) ? perKg : 0);

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
      unit_weight_kg: unit === "bag" ? Math.max(1, Number(unitWt) || 50) : 1,
      position: row?.position ?? index,
    });
    if (isNew) {
      setName(""); setQty(""); setPrice(""); setUnitWt("50");
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
          <Field label="Qty (kg)">
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
              onChange={(e) => { setUnit(e.target.value as "kg" | "bag"); setDirty(true); }}
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
                  onClick={() => { setUnitWt(String(w)); setDirty(true); commit(); }}
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
