import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bird, Plus, Loader2, Scale, Wheat, Skull, TrendingUp, Trash2, Pencil,
  ShoppingCart, ClipboardList, Target, Sparkles, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/lib/rbac";
import { PermissionDenied } from "@/components/permission-denied";
import { useEffectivePrice } from "@/lib/effective-price";
import { toDateKey } from "@/lib/date-key";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useBroilerBatches, useBroilerDaily, useBroilerSales,
  useAddBroilerBatch, useDeleteBroilerBatch, useRecordBroilerDaily,
  useRecordBroilerSale, useUpdateBroilerSale, useDeleteBroilerDaily, useDeleteBroilerSale,
  batchStatus, ageLabel, batchAgeDays, BROILER_STATUS_LABELS, BROILER_STATUS_TONES,
  type BroilerBatch, type BroilerDaily, type BroilerSale,
} from "@/lib/broiler-data";
import { BroilerAgeAlerts, BroilerHealthPanel } from "@/components/broiler-health";
import {
  computeBatchMetrics, summarise, growthCurve, batchInsights, type BatchMetrics,
} from "@/lib/broiler-analytics";


export const Route = createFileRoute("/_authenticated/broilers")({
  head: () => ({
    meta: [
      { title: "Broiler Management — PoultryPro" },
      { name: "description", content: "Track broiler batches from day-old chicks to market: growth, feed conversion, mortality, cost per bird and sales." },
      { property: "og:title", content: "Broiler Management — PoultryPro" },
      { property: "og:description", content: "Batch-based broiler tracking with FCR, daily gain, mortality and profitability for every cycle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BroilersPage,
});

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const num = (n: number, d = 0) => n.toLocaleString("en-NG", { maximumFractionDigits: d, minimumFractionDigits: d });
const todayKey = () => toDateKey(new Date())!;

function BroilersPage() {
  const { can, loading } = usePermissions();
  const batchesQ = useBroilerBatches();
  const dailyQ = useBroilerDaily();
  const salesQ = useBroilerSales();
  const pricing = useEffectivePrice();

  const [selected, setSelected] = useState<string | null>(null);
  const [showBatch, setShowBatch] = useState(false);
  const [dailyFor, setDailyFor] = useState<BatchMetrics | null>(null);
  const [saleFor, setSaleFor] = useState<BatchMetrics | null>(null);

  const metrics = useMemo(() => {
    const batches = batchesQ.data ?? [];
    return batches.map((b) =>
      computeBatchMetrics(b, dailyQ.data ?? [], salesQ.data ?? [], pricing.feedPerKgOn),
    );
  }, [batchesQ.data, dailyQ.data, salesQ.data, pricing]);

  const summary = useMemo(() => summarise(metrics), [metrics]);
  const current = selected ? metrics.find((m) => m.batch.id === selected) ?? null : null;

  if (loading || batchesQ.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!can("rooms.read") && !can("production.read")) {
    return <PermissionDenied hint="Broiler management is available to the Farm Owner and Farm Managers." />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Bird className="h-3.5 w-3.5" /> Broilers
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-semibold text-foreground sm:text-3xl">
            Broiler Management
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every batch is tracked from day-old chick to market weight. Feed cost uses the price in
            force on the day each bag was fed, so profitability is never an estimate.
          </p>
        </div>
        {can("rooms.write") && (
          <Button onClick={() => setShowBatch(true)} className="rounded-full">
            <Plus className="mr-1.5 h-4 w-4" /> New Batch
          </Button>
        )}
      </header>

      {/* Farm-wide broiler summary */}
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Bird} label="Birds on farm" value={num(summary.birdsAlive)} sub={`${num(summary.birdsPlaced)} placed in total`} />
        <Stat icon={Skull} label="Mortality" value={`${summary.mortalityPct.toFixed(1)}%`} sub={`${num(summary.deaths)} birds lost`} tone={summary.mortalityPct >= 5 ? "bad" : "good"} />
        <Stat icon={Scale} label="Average FCR" value={summary.avgFcr != null ? summary.avgFcr.toFixed(2) : "—"} sub={`${num(summary.feedKg)} kg feed used`} />
        <Stat icon={TrendingUp} label="Cycle profit" value={naira(summary.profit)} sub={`${naira(summary.revenue)} sales · ${naira(summary.totalCost)} cost`} tone={summary.profit >= 0 ? "good" : "bad"} />
      </section>

      <BroilerAgeAlerts batches={batchesQ.data ?? []} />

      {current ? (
        <BatchDetail
          m={current}
          daily={(dailyQ.data ?? []).filter((d) => d.batch_id === current.batch.id)}
          sales={(salesQ.data ?? []).filter((s) => s.batch_id === current.batch.id)}
          onBack={() => setSelected(null)}
          onRecord={() => setDailyFor(current)}
          onSell={() => setSaleFor(current)}
          canWrite={can("production.write")}
          canSell={can("sales.write")}
          canHealthWrite={can("health.write")}
          canHealthDelete={can("health.delete")}
        />

      ) : (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Batches</h2>
          {metrics.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
              <Bird className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">No broiler batches yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Create a batch when you place day-old chicks. Record deaths, feed and weights daily and
                PoultryPro works out growth, feed conversion and profit for you.
              </p>
              {can("rooms.write") && (
                <Button onClick={() => setShowBatch(true)} className="mt-4 rounded-full">
                  <Plus className="mr-1.5 h-4 w-4" /> Create first batch
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {metrics.map((m) => (
                <BatchCard
                  key={m.batch.id}
                  m={m}
                  onOpen={() => setSelected(m.batch.id)}
                  onRecord={can("production.write") ? () => setDailyFor(m) : undefined}
                  onSell={can("sales.write") ? () => setSaleFor(m) : undefined}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {showBatch && <NewBatchDialog onClose={() => setShowBatch(false)} />}
      {dailyFor && <DailyDialog m={dailyFor} onClose={() => setDailyFor(null)} />}
      {saleFor && <SaleDialog m={saleFor} onClose={() => setSaleFor(null)} />}
    </div>
  );
}

/* ---------------------------------- cards --------------------------------- */

function Stat({ icon: Icon, label, value, sub, tone }: {
  icon: typeof Bird; label: string; value: string; sub?: string; tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={cn("mt-2 font-display text-2xl font-semibold",
        tone === "bad" ? "text-destructive" : tone === "good" ? "text-emerald-600" : "text-foreground")}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function BatchCard({ m, onOpen, onRecord, onSell }: {
  m: BatchMetrics; onOpen: () => void; onRecord?: () => void; onSell?: () => void;
}) {
  const st = batchStatus(m.batch);
  return (
    <div className="group rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onOpen} className="text-left">
          <div className="font-display text-lg font-semibold text-foreground">{m.batch.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {m.batch.breed || "Broiler"} · Day {m.ageDays} · placed {m.batch.date_placed}
          </div>
        </button>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", BROILER_STATUS_TONES[st])}>
          {BROILER_STATUS_LABELS[st]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Metric label="Birds alive" value={num(m.birdsAlive)} />
        <Metric label="Mortality" value={`${m.mortalityPct.toFixed(1)}%`} tone={m.mortalityPct >= 5 ? "bad" : undefined} />
        <Metric label="Avg weight" value={m.avgWeightG != null ? `${num(m.avgWeightG)} g` : "—"} />
        <Metric label="FCR" value={m.fcr != null ? m.fcr.toFixed(2) : "—"} />
      </div>

      {m.targetProgress != null && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Target className="h-3 w-3" /> Target {m.batch.target_weight_kg} kg</span>
            <span>{Math.round(m.targetProgress * 100)}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(m.targetProgress * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" className="rounded-full" onClick={onOpen}>Open</Button>
        {onRecord && st === "active" && (
          <Button size="sm" variant="outline" className="rounded-full" onClick={onRecord}>
            <ClipboardList className="mr-1 h-3.5 w-3.5" /> Record day
          </Button>
        )}
        {onSell && m.birdsAlive > 0 && (
          <Button size="sm" variant="outline" className="rounded-full" onClick={onSell}>
            <ShoppingCart className="mr-1 h-3.5 w-3.5" /> Sell
          </Button>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("font-semibold", tone === "bad" ? "text-destructive" : "text-foreground")}>{value}</div>
    </div>
  );
}

/* --------------------------------- detail --------------------------------- */

function BatchDetail({ m, daily, sales, onBack, onRecord, onSell, canWrite, canSell, canHealthWrite, canHealthDelete }: {
  m: BatchMetrics;
  daily: BroilerDaily[];
  sales: BroilerSale[];
  onBack: () => void; onRecord: () => void; onSell: () => void;
  canWrite: boolean; canSell: boolean;
  canHealthWrite: boolean; canHealthDelete: boolean;
}) {
  const delBatch = useDeleteBroilerBatch();
  const delDaily = useDeleteBroilerDaily();
  const delSale = useDeleteBroilerSale();
  const [editDaily, setEditDaily] = useState<BroilerDaily | null>(null);
  const [editSale, setEditSale] = useState<BroilerSale | null>(null);
  const curve = useMemo(() => growthCurve(m.batch, daily), [m.batch, daily]);
  const insights = useMemo(() => batchInsights(m), [m]);


  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All batches
        </button>
        <div className="flex flex-wrap gap-2">
          {canWrite && <Button size="sm" className="rounded-full" onClick={onRecord}><ClipboardList className="mr-1 h-3.5 w-3.5" /> Record day</Button>}
          {canSell && <Button size="sm" variant="outline" className="rounded-full" onClick={onSell}><ShoppingCart className="mr-1 h-3.5 w-3.5" /> Record sale</Button>}
          {canWrite && (
            <Button
              size="sm" variant="ghost"
              className="rounded-full text-destructive hover:text-destructive"
              onClick={() => {
                if (!confirm(`Delete ${m.batch.name} and all of its records?`)) return;
                delBatch.mutate(m.batch.id, {
                  onSuccess: () => { toast.success("Batch deleted"); onBack(); },
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
                });
              }}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete batch
            </Button>
          )}
        </div>
      </div>

      <h2 className="mt-3 font-display text-xl font-semibold text-foreground">
        {m.batch.name} <span className="text-sm font-normal text-muted-foreground">· Day {m.ageDays}</span>
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Bird} label="Birds alive" value={num(m.birdsAlive)} sub={`${num(m.batch.birds_placed)} placed · ${num(m.birdsSold)} sold`} />
        <Stat icon={Scale} label="Avg weight" value={m.avgWeightG != null ? `${num(m.avgWeightG)} g` : "—"} sub={m.adgG != null ? `${Math.round(m.adgG)} g/day gain` : "record a weight"} />
        <Stat icon={Wheat} label="Feed used" value={`${num(m.feedKg, 1)} kg`} sub={`${num(m.feedPerBirdKg, 2)} kg per bird`} />
        <Stat icon={Scale} label="FCR" value={m.fcr != null ? m.fcr.toFixed(2) : "—"} sub="kg feed per kg gain" />
        <Stat icon={Skull} label="Mortality" value={`${m.mortalityPct.toFixed(1)}%`} sub={`${num(m.deaths)} deaths`} tone={m.mortalityPct >= 5 ? "bad" : "good"} />
        <Stat icon={Wheat} label="Cost to date" value={naira(m.totalCost)} sub={`${naira(m.chickCost)} chicks · ${naira(m.feedCost)} feed`} />
        <Stat icon={ShoppingCart} label="Sales" value={naira(m.revenue)} sub={m.avgSalePricePerKg != null ? `${naira(m.avgSalePricePerKg)}/kg · ${num(m.soldWeightKg, 1)} kg` : "no sales yet"} />
        <Stat icon={TrendingUp} label="Profit" value={naira(m.profit)} sub={m.costPerKg != null ? `${naira(m.costPerKg)} cost per kg` : `${naira(m.costPerBird)} per bird`} tone={m.profit >= 0 ? "good" : "bad"} />
      </div>

      {/* Growth curve */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" /> Growth curve
        </div>
        {curve.length < 2 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Record average bird weight on at least two days to see the growth curve.
          </p>
        ) : (
          <GrowthChart points={curve} targetG={m.batch.target_weight_kg * 1000} />
        )}
      </div>

      {/* Insights */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" /> Batch insights
        </div>
        <ul className="mt-3 space-y-2">
          {insights.map((i, idx) => (
            <li key={idx} className="flex gap-2 text-sm">
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                i.tone === "bad" ? "bg-destructive" : i.tone === "warn" ? "bg-amber-500" : "bg-emerald-500")} />
              <span className="text-muted-foreground">{i.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Daily log */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-semibold text-foreground">Daily records</div>
          {daily.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr><th className="py-1.5">Date</th><th>Deaths</th><th>Feed</th><th>Weight</th><th /></tr>
                </thead>
                <tbody>
                  {daily.map((d) => (
                    <tr key={d.id} className="border-t border-border/60">
                      <td className="py-2 text-foreground">{d.entry_date}</td>
                      <td>{num(d.deaths)}</td>
                      <td>{num(Number(d.feed_kg), 1)} kg</td>
                      <td>{d.avg_weight_g ? `${num(Number(d.avg_weight_g))} g` : "—"}</td>
                      <td className="text-right">
                        {canWrite && (
                          <span className="inline-flex items-center gap-2">
                            <button className="text-muted-foreground hover:text-foreground"
                              onClick={() => setEditDaily(d)} aria-label="Edit daily record">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button className="text-muted-foreground hover:text-destructive" aria-label="Delete daily record"
                              onClick={() => {
                                if (!confirm(`Delete the record for ${d.entry_date}?`)) return;
                                delDaily.mutate(d.id, { onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed") });
                              }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-semibold text-foreground">Sales</div>
          {sales.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No birds sold from this batch yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr><th className="py-1.5">Date</th><th>Birds</th><th>Weight</th><th>Amount</th><th /></tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id} className="border-t border-border/60">
                      <td className="py-2 text-foreground">{s.entry_date}</td>
                      <td>{num(s.birds)}</td>
                      <td>{num(Number(s.total_weight_kg), 1)} kg</td>
                      <td>{naira(Number(s.amount))}</td>
                      <td className="text-right">
                        {canSell && (
                          <span className="inline-flex items-center gap-2">
                            <button className="text-muted-foreground hover:text-foreground"
                              onClick={() => setEditSale(s)} aria-label="Edit sale">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button className="text-muted-foreground hover:text-destructive" aria-label="Delete sale"
                              onClick={() => {
                                if (!confirm(`Delete the sale recorded on ${s.entry_date}?`)) return;
                                delSale.mutate(s.id, { onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed") });
                              }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Vaccination & medication register */}
      <BroilerHealthPanel batch={m.batch} canWrite={canHealthWrite} canDelete={canHealthDelete} />

      {editDaily && <DailyDialog m={m} editing={editDaily} onClose={() => setEditDaily(null)} />}
      {editSale && <SaleDialog m={m} editing={editSale} onClose={() => setEditSale(null)} />}
    </section>
  );
}


function GrowthChart({ points, targetG }: { points: { day: number; weightG: number }[]; targetG: number }) {
  const w = 640, h = 200, pad = 28;
  const maxDay = Math.max(...points.map((p) => p.day), 1);
  const maxW = Math.max(...points.map((p) => p.weightG), targetG || 1);
  const x = (d: number) => pad + (d / maxDay) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / maxW) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.day)} ${y(p.weightG)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full" role="img" aria-label="Broiler growth curve">
      {targetG > 0 && (
        <line x1={pad} x2={w - pad} y1={y(targetG)} y2={y(targetG)}
          className="stroke-primary/40" strokeDasharray="4 4" strokeWidth={1} />
      )}
      <path d={path} fill="none" className="stroke-primary" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p) => (
        <circle key={p.day} cx={x(p.day)} cy={y(p.weightG)} r={3} className="fill-primary" />
      ))}
      <text x={pad} y={h - 6} className="fill-muted-foreground text-[10px]">Day 0</text>
      <text x={w - pad} y={h - 6} textAnchor="end" className="fill-muted-foreground text-[10px]">Day {maxDay}</text>
    </svg>
  );
}

/* --------------------------------- dialogs -------------------------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function NewBatchDialog({ onClose }: { onClose: () => void }) {
  const add = useAddBroilerBatch();
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [house, setHouse] = useState("");
  const [datePlaced, setDatePlaced] = useState(todayKey());
  const [birds, setBirds] = useState("");
  const [chickCost, setChickCost] = useState("");
  const [target, setTarget] = useState("2.2");

  const submit = () => {
    if (!name.trim()) { toast.error("Give the batch a name"); return; }
    const placed = parseInt(birds, 10);
    if (!placed || placed <= 0) { toast.error("Enter how many chicks were placed"); return; }
    add.mutate({
      name, breed, house, date_placed: datePlaced, birds_placed: placed,
      chick_unit_cost: Number(chickCost) || 0,
      target_weight_kg: Number(target) || 2.2,
    }, {
      onSuccess: () => { toast.success("Batch created"); onClose(); },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create batch"),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New broiler batch</DialogTitle>
          <DialogDescription>Record a placement of day-old chicks.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Batch name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Batch 07 – March" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Breed"><input className={inputCls} value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="e.g. Ross 308" /></Field>
            <Field label="House / pen"><input className={inputCls} value={house} onChange={(e) => setHouse(e.target.value)} placeholder="e.g. Pen A" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date placed"><input type="date" className={inputCls} value={datePlaced} onChange={(e) => setDatePlaced(e.target.value)} /></Field>
            <Field label="Chicks placed"><input inputMode="numeric" className={inputCls} value={birds} onChange={(e) => setBirds(e.target.value)} placeholder="e.g. 1000" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost per chick (₦)"><input inputMode="decimal" className={inputCls} value={chickCost} onChange={(e) => setChickCost(e.target.value)} placeholder="e.g. 1200" /></Field>
            <Field label="Target weight (kg)"><input inputMode="decimal" className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={add.isPending}>{add.isPending ? "Saving…" : "Create batch"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DailyDialog({ m, editing, onClose }: { m: BatchMetrics; editing?: BroilerDaily | null; onClose: () => void }) {
  const rec = useRecordBroilerDaily();
  const [date, setDate] = useState(editing?.entry_date ?? todayKey());
  const [deaths, setDeaths] = useState(String(editing?.deaths ?? 0));
  const [feed, setFeed] = useState(editing ? String(editing.feed_kg) : "");
  const [weight, setWeight] = useState(editing?.avg_weight_g != null ? String(editing.avg_weight_g) : "");
  const [water, setWater] = useState(editing?.water_litres != null ? String(editing.water_litres) : "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const submit = () => {
    rec.mutate({
      batch_id: m.batch.id,
      entry_date: date,
      deaths: Math.max(0, parseInt(deaths, 10) || 0),
      feed_kg: Number(feed) || 0,
      avg_weight_g: weight.trim() ? Number(weight) : null,
      water_litres: water.trim() ? Number(water) : null,
      notes,
      // When editing, add back the deaths already applied so the head-count
      // reflects the corrected figure rather than double-counting.
      current_birds: m.batch.current_birds + (editing?.deaths ?? 0),
    }, {
      onSuccess: () => { toast.success(editing ? "Record updated" : "Day recorded"); onClose(); },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit day" : "Record day"} — {m.batch.name}</DialogTitle>
          <DialogDescription>Deaths, feed and weight for one day. Saving twice for the same day updates that day.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Deaths"><input inputMode="numeric" className={inputCls} value={deaths} onChange={(e) => setDeaths(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Feed used (kg)"><input inputMode="decimal" className={inputCls} value={feed} onChange={(e) => setFeed(e.target.value)} placeholder="e.g. 120" /></Field>
            <Field label="Average bird weight (g)"><input inputMode="decimal" className={inputCls} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 1450" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Water (litres)"><input inputMode="decimal" className={inputCls} value={water} onChange={(e) => setWater(e.target.value)} /></Field>
            <Field label="Notes"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={rec.isPending}>{rec.isPending ? "Saving…" : "Save day"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaleDialog({ m, onClose }: { m: BatchMetrics; onClose: () => void }) {
  const rec = useRecordBroilerSale();
  const [date, setDate] = useState(todayKey());
  const [birds, setBirds] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [customer, setCustomer] = useState("");
  const [method, setMethod] = useState("Cash");
  const amount = (Number(weightKg) || 0) * (Number(pricePerKg) || 0);

  const submit = () => {
    const count = parseInt(birds, 10);
    if (!count || count <= 0) { toast.error("Enter how many birds were sold"); return; }
    if (count > m.birdsAlive) { toast.error(`Only ${m.birdsAlive} birds are alive in this batch`); return; }
    rec.mutate({
      batch_id: m.batch.id, entry_date: date, birds: count,
      total_weight_kg: Number(weightKg) || 0,
      price_per_kg: Number(pricePerKg) || 0,
      customer, payment_method: method,
      current_birds: m.batch.current_birds,
    }, {
      onSuccess: () => { toast.success("Sale recorded"); onClose(); },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save sale"),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record sale — {m.batch.name}</DialogTitle>
          <DialogDescription>{num(m.birdsAlive)} birds are currently alive in this batch.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Birds sold"><input inputMode="numeric" className={inputCls} value={birds} onChange={(e) => setBirds(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total live weight (kg)"><input inputMode="decimal" className={inputCls} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} /></Field>
            <Field label="Price per kg (₦)"><input inputMode="decimal" className={inputCls} value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer"><input className={inputCls} value={customer} onChange={(e) => setCustomer(e.target.value)} /></Field>
            <Field label="Payment method">
              <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                {["Cash", "Transfer", "POS", "Credit"].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
          </div>
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
            Sale total: <span className="font-semibold text-foreground">{naira(amount)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={rec.isPending}>{rec.isPending ? "Saving…" : "Record sale"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
