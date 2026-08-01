import { useMemo, useState } from "react";
import {
  Egg, Wheat, Leaf, Clock, Search, Pencil, History as HistoryIcon, Trash2, Plus,
  TrendingUp, TrendingDown, AlertTriangle, Sparkles,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePrices, usePriceHistory, useFarm, useUpdatePrice, useAddPrice, useDeletePrice,
  useEggs, useFeed, type Price, type PriceHistoryRow,
} from "@/lib/farm-data";
import { categoryOf, formatEffective, previousPriceFor, deviceLabel } from "@/lib/price-timeline";
import { priceUnitLabel } from "@/lib/farm-analytics";
import { totalEggsFromRow } from "@/lib/egg-normalize";
import { toDateKey } from "@/lib/date-key";
import { cn } from "@/lib/utils";

export const naira = (n: number) => "₦" + Math.round(Number(n) || 0).toLocaleString("en-NG");

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "eggs", label: "Eggs" },
  { id: "feed", label: "Feed" },
  { id: "ingredient", label: "Ingredients" },
  { id: "medicine", label: "Medicine" },
  { id: "vaccines", label: "Vaccines" },
  { id: "other", label: "Others" },
] as const;

type SortKey = "recent" | "high" | "low" | "alpha";

const CAT_ICON: Record<string, typeof Egg> = {
  eggs: Egg, feed: Wheat, ingredient: Leaf, medicine: Sparkles, vaccines: Sparkles, other: Sparkles,
};

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Egg; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[20px] border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_28px_rgba(20,60,40,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.06),0_20px_40px_rgba(20,60,40,0.12)]">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-xl bg-[color:var(--forest)]/10 text-[color:var(--forest)]">
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </div>
      <div className="mt-3 font-[var(--font-display)] text-[1.75rem] font-semibold leading-none tracking-tight">{value}</div>
      {sub ? <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (!delta) return null;
  const up = delta > 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur",
      up ? "bg-emerald-500/12 text-emerald-700" : "bg-destructive/12 text-destructive",
    )}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? "Increased by " : "Reduced by "}{naira(Math.abs(delta))}
    </span>
  );
}

export function PricingDashboard({ compact = false }: { compact?: boolean }) {
  const pricesQ = usePrices();
  const historyQ = usePriceHistory();
  const farmQ = useFarm();
  const eggsQ = useEggs();
  const feedQ = useFeed();
  const updateM = useUpdatePrice();
  const addM = useAddPrice();
  const delM = useDeletePrice();

  const prices = pricesQ.data ?? [];
  const history: PriceHistoryRow[] = historyQ.data ?? [];
  const bagKg = farmQ.data?.bag_weight_kg && farmQ.data.bag_weight_kg > 0 ? Number(farmQ.data.bag_weight_kg) : 25;

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [editing, setEditing] = useState<Price | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    // One active price per logical item — collapse anything that shares a key
    // (defensive: the database also enforces this with a unique index).
    const byKey = new Map<string, Price>();
    for (const p of prices) {
      const k = priceKeyOf(p.item, p.category);
      const existing = byKey.get(k);
      if (!existing || String(p.effective_from ?? "") > String(existing.effective_from ?? "")) byKey.set(k, p);
    }
    const list = Array.from(byKey.values()).map(p => {
      const category = categoryOf(p.item, p.category);
      const prev = previousPriceFor(history, p.item, p.category);
      return {
        ...p,
        category,
        prev,
        delta: prev ? p.price - prev.price : 0,
        effective: p.effective_from ?? null,
      };
    });
    const filtered = list.filter(r =>
      (cat === "all" || r.category === cat) &&
      (!query.trim() || r.item.toLowerCase().includes(query.trim().toLowerCase())));
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "alpha") return a.item.localeCompare(b.item);
      if (sort === "high") return b.price - a.price;
      if (sort === "low") return a.price - b.price;
      return String(b.effective ?? "").localeCompare(String(a.effective ?? ""));
    });
    return sorted;
  }, [prices, history, cat, query, sort]);

  const activePrices = useMemo(() => {
    const byKey = new Map<string, Price>();
    for (const p of prices) {
      const k = priceKeyOf(p.item, p.category);
      const existing = byKey.get(k);
      if (!existing || String(p.effective_from ?? "") > String(existing.effective_from ?? "")) byKey.set(k, p);
    }
    return Array.from(byKey.values());
  }, [prices]);

  const eggRow = activePrices.find(p => priceKeyOf(p.item, p.category) === "eggs");
  const feedRow = activePrices.find(p => priceKeyOf(p.item, p.category) === "feed");
  const trackedCount = activePrices.length;
  const lastUpdated = useMemo(() => {
    const fromPrices = activePrices.map(p => p.effective_from).filter(Boolean) as string[];
    const all = [...fromPrices, ...history.map(h => h.effective_from)].filter(Boolean);
    return all.length ? all.slice().sort().pop()! : null;
  }, [activePrices, history]);

  // ----- price analytics series -----
  const seriesFor = (match: RegExp) => {
    const pts = history
      .filter(h => match.test(h.item))
      .slice()
      .sort((a, b) => a.effective_from.localeCompare(b.effective_from))
      .map(h => ({
        label: new Date(h.effective_from).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        price: Number(h.new_price),
      }));
    return pts;
  };
  const eggSeries = seriesFor(/egg/i);
  const feedSeries = seriesFor(/feed/i);
  const ingredientMovement = useMemo(() => {
    const byItem = new Map<string, PriceHistoryRow[]>();
    history.filter(h => h.category === "ingredient").forEach(h => {
      const k = h.item.trim();
      byItem.set(k, [...(byItem.get(k) ?? []), h]);
    });
    return Array.from(byItem.entries()).map(([item, rowsForItem]) => {
      const sorted = rowsForItem.slice().sort((a, b) => a.effective_from.localeCompare(b.effective_from));
      const first = sorted[0], last = sorted[sorted.length - 1];
      return { item, change: Number(last.new_price) - Number(first.old_price ?? first.new_price) };
    }).filter(r => r.change !== 0).slice(0, 10);
  }, [history]);

  // ----- financial impact of the most recent change -----
  const impact = useMemo(() => {
    const eggs = eggsQ.data ?? [];
    const feed = feedQ.data ?? [];
    const days = new Set(eggs.map(e => toDateKey(e.date)).filter(Boolean)).size || 1;
    const avgCratesPerDay = eggs.reduce((s, e) => s + totalEggsFromRow(e), 0) / 30 / days;
    const feedDays = new Set(feed.map(f => toDateKey(f.date)).filter(Boolean)).size || 1;
    const avgBagsPerDay = feed.reduce((s, f) => s + Number(f.bags || 0), 0) / feedDays;

    const eggPrev = eggRow ? previousPriceFor(history, eggRow.item) : null;
    const feedPrev = feedRow ? previousPriceFor(history, feedRow.item) : null;
    const eggDelta = eggRow && eggPrev ? eggRow.price - eggPrev.price : 0;
    const feedDelta = feedRow && feedPrev ? feedRow.price - feedPrev.price : 0;

    const dailyRevenueChange = avgCratesPerDay * eggDelta;
    const dailyFeedCostChange = avgBagsPerDay * feedDelta;
    const todayProfit = avgCratesPerDay * (eggRow?.price ?? 0) - avgBagsPerDay * (feedRow?.price ?? 0);

    const eggDropPct = eggRow && eggPrev && eggPrev.price > 0 ? (eggDelta / eggPrev.price) * 100 : 0;
    const feedRisePct = feedRow && feedPrev && feedPrev.price > 0 ? (feedDelta / feedPrev.price) * 100 : 0;

    return {
      dailyRevenueChange,
      dailyFeedCostChange,
      todayProfit,
      weeklyProfit: todayProfit * 7,
      monthlyProfit: todayProfit * 30,
      monthlyRevenueChange: dailyRevenueChange * 30,
      monthlyFeedCostChange: dailyFeedCostChange * 30,
      eggDropPct,
      feedRisePct,
    };
  }, [eggsQ.data, feedQ.data, eggRow, feedRow, history]);

  const loading = pricesQ.isLoading || historyQ.isLoading;

  const onDelete = async (p: Price) => {
    if (!window.confirm(`Delete ${p.item} from the price list?`)) return;
    await delM.mutateAsync(p.id);
    toast.success(`${p.item} removed from the price list.`);
  };

  return (
    <div className="space-y-8">
      {/* KPI summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? [0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[118px] rounded-[20px]" />) : (
          <>
            <Kpi icon={Egg} label="Egg Price" value={eggRow ? naira(eggRow.price) : "—"} sub={eggRow ? `per ${priceUnitLabel(eggRow.item, eggRow.unit, bagKg)}` : "Not set"} />
            <Kpi icon={Wheat} label="Feed Price" value={feedRow ? naira(feedRow.price) : "—"}
              sub={feedRow ? `per ${bagKg}kg · ≈ ${naira(feedRow.price / bagKg)}/kg` : "Not set"} />
            <Kpi icon={Leaf} label="Ingredients" value={String(ingredientCount)} sub="active tracked items" />
            <Kpi icon={Clock} label="Last Updated" value={lastUpdated ? formatEffective(lastUpdated).split(",")[0] : "—"}
              sub={lastUpdated ? formatEffective(lastUpdated) : "No changes recorded"} />
          </>
        )}
      </div>

      {/* Smart alerts */}
      {impact.eggDropPct <= -10 && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/8 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>Egg price has decreased significantly. Projected monthly revenue may reduce by approximately <strong>{naira(Math.abs(impact.monthlyRevenueChange))}</strong> based on your current production.</span>
        </div>
      )}
      {impact.feedRisePct >= 10 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>Feed costs have increased. Estimated monthly feed expenses may increase by <strong>{naira(Math.abs(impact.monthlyFeedCostChange))}</strong>.</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search price item…" className="h-11 rounded-2xl pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)}
              className={cn("rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
                cat === c.id ? "border-transparent bg-[color:var(--forest)] text-white shadow-sm" : "bg-card hover:border-[color:var(--forest)]/40")}>
              {c.label}
            </button>
          ))}
          <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
            className="h-9 rounded-full border bg-card px-3 text-xs font-medium">
            <option value="recent">Recently updated</option>
            <option value="high">Highest price</option>
            <option value="low">Lowest price</option>
            <option value="alpha">Alphabetically</option>
          </select>
          <Button onClick={() => setCreating(true)} className="h-9 rounded-full" size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add item
          </Button>
        </div>
      </div>

      {/* Price cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-56 rounded-[20px]" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[20px] border border-dashed p-10 text-center text-sm text-muted-foreground">
          No price items match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(r => {
            const Icon = CAT_ICON[r.category] ?? Sparkles;
            const unit = priceUnitLabel(r.item, r.unit, bagKg);
            const perKg = /feed/i.test(r.item) && bagKg > 0 ? r.price / bagKg : null;
            return (
              <div key={r.id}
                className="group rounded-[20px] border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_28px_rgba(20,60,40,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_24px_48px_rgba(20,60,40,0.12)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[color:var(--forest)]/10 text-[color:var(--forest)]">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <div className="font-medium leading-tight">{r.item}</div>
                      <div className="text-xs capitalize text-muted-foreground">{r.category}</div>
                    </div>
                  </div>
                  <DeltaBadge delta={r.delta} />
                </div>

                <div className="mt-5">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Current price</div>
                  <div className="mt-1 font-[var(--font-display)] text-[2.25rem] font-bold leading-none tracking-tight">{naira(r.price)}</div>
                  <div className="mt-1.5 text-sm text-muted-foreground">
                    {unit}{perKg ? ` · ≈ ${naira(perKg)}/kg` : ""}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-muted/50 p-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Effective since</div>
                    <div className="mt-0.5 font-medium">{r.effective ? formatEffective(r.effective) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Previous price</div>
                    <div className="mt-0.5 font-medium">
                      {r.prev ? naira(r.prev.price) : "—"}
                      {r.prev ? <span className="block text-muted-foreground">changed {formatEffective(r.prev.at).split(",")[0]}</span> : null}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => setEditing(r)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="rounded-full">
                    <Link to="/price-history" search={{ item: r.item }}>
                      <HistoryIcon className="mr-1 h-3.5 w-3.5" /> History
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="ml-auto rounded-full text-destructive hover:text-destructive"
                    onClick={() => onDelete(r)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!compact && (
        <>
          {/* Financial impact */}
          <div className="rounded-[20px] border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_28px_rgba(20,60,40,0.05)]">
            <h3 className="text-lg">Financial impact</h3>
            <p className="mt-1 text-sm text-muted-foreground">Projected using your average daily production and feed usage at the current effective prices.</p>
            <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
              {[
                { label: "Revenue change / day", value: impact.dailyRevenueChange, signed: true },
                { label: "Feed cost change / day", value: impact.dailyFeedCostChange, signed: true, invert: true },
                { label: "Today's expected profit", value: impact.todayProfit },
                { label: "Weekly projected profit", value: impact.weeklyProfit },
                { label: "Monthly projected profit", value: impact.monthlyProfit },
              ].map(m => {
                const good = m.invert ? m.value <= 0 : m.value >= 0;
                return (
                  <div key={m.label} className="rounded-2xl bg-muted/50 p-4">
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                    <div className={cn("mt-1.5 text-lg font-semibold", good ? "text-emerald-700" : "text-destructive")}>
                      {m.signed && m.value > 0 ? "+" : ""}{naira(m.value)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Egg price trend">
              {eggSeries.length > 1 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={eggSeries} margin={{ left: 4, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={56} />
                    <Tooltip formatter={(v: number) => naira(v)} />
                    <Line type="monotone" dataKey="price" stroke="var(--forest)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </ChartCard>
            <ChartCard title="Feed price trend">
              {feedSeries.length > 1 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={feedSeries} margin={{ left: 4, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={56} />
                    <Tooltip formatter={(v: number) => naira(v)} />
                    <Line type="monotone" dataKey="price" stroke="var(--gold)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </ChartCard>
            <ChartCard title="Ingredient price movement" className="xl:col-span-2">
              {ingredientMovement.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={ingredientMovement} margin={{ left: 4, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="item" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={56} />
                    <Tooltip formatter={(v: number) => naira(v)} />
                    <Bar dataKey="change" fill="var(--forest)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </ChartCard>
          </div>
        </>
      )}

      <PriceSheet
        open={!!editing || creating}
        price={editing}
        bagKg={bagKg}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={async ({ item, unit, price, category, note, effectiveFrom }) => {
          if (editing) {
            await updateM.mutateAsync({
              id: editing.id, item, unit, price, category, note,
              effective_from: effectiveFrom,
              updated: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
              last_device: deviceLabel(),
            } as never);
          } else {
            await addM.mutateAsync({
              item, unit, price, category, note,
              effective_from: effectiveFrom,
              updated: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
              last_device: deviceLabel(),
            } as never);
          }
          setEditing(null); setCreating(false);
          toast.success("Price updated successfully", {
            description: "This price will automatically be used for all new records from today onward. Historical records remain unchanged.",
          });
        }}
      />
    </div>
  );
}

function Empty() {
  return <div className="grid h-[200px] place-items-center text-sm text-muted-foreground">Not enough price changes recorded yet.</div>;
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[20px] border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_28px_rgba(20,60,40,0.05)]", className)}>
      <h3 className="mb-4 text-base font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function PriceSheet({ open, price, bagKg, onClose, onSave }: {
  open: boolean;
  price: Price | null;
  bagKg: number;
  onClose: () => void;
  onSave: (v: { item: string; unit: string; price: number; category: string; note: string | null; effectiveFrom: string }) => Promise<void>;
}) {
  const [item, setItem] = useState("");
  const [unit, setUnit] = useState("");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState("other");
  const [note, setNote] = useState("");
  const [effective, setEffective] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<string | null>(null);

  // Re-seed the form whenever a different item is opened.
  const seedKey = `${open}:${price?.id ?? "new"}`;
  if (key !== seedKey) {
    setKey(seedKey);
    setItem(price?.item ?? "");
    setUnit(price?.unit ?? "");
    setValue(price ? String(price.price) : "");
    setCategory(categoryOf(price?.item ?? "", price?.category));
    setNote(price?.note ?? "");
    setEffective(new Date().toISOString().slice(0, 16));
  }

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{price ? "Update price" : "Add price item"}</SheetTitle>
          <SheetDescription>
            New prices take effect from the date and time you choose. Records already saved keep the price that was active on their own date.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Item</Label>
            <Input value={item} onChange={e => setItem(e.target.value)} placeholder="e.g. Table Eggs" className="rounded-xl" />
          </div>
          {price ? (
            <div className="rounded-2xl bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Current price</span>
              <div className="text-lg font-semibold">{naira(price.price)}</div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>New price (₦)</Label>
              <Input type="number" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder={`Crate / ${bagKg}kg Bag`} className="rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="h-10 w-full rounded-xl border bg-background px-3 text-sm">
              {CATEGORIES.filter(c => c.id !== "all").map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Effective from</Label>
            <Input type="datetime-local" value={effective} onChange={e => setEffective(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className="rounded-xl" placeholder="Reason for the change…" />
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Button
            className="flex-1 rounded-full"
            disabled={busy || !item.trim() || !Number(value)}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave({
                  item: item.trim(),
                  unit: unit.trim() || "unit",
                  price: Number(value),
                  category,
                  note: note.trim() || null,
                  effectiveFrom: new Date(effective || Date.now()).toISOString(),
                });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not save the price.");
              } finally {
                setBusy(false);
              }
            }}>
            {busy ? "Saving…" : "Save price"}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={onClose}>Cancel</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
