import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Egg, Plus, Loader2, Scale, Wheat, Skull, Droplets, Syringe, CalendarClock,
  Trash2, ArrowLeft, Sparkles, Settings2, Bell, ArrowRightLeft, Thermometer,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/lib/rbac";
import { PermissionDenied } from "@/components/permission-denied";
import { useRooms } from "@/lib/farm-data";
import { toDateKey } from "@/lib/date-key";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useLayerBatches, useLayerDaily, useLayerWeights, useLayerHealth, useRearingSettings,
  useAddLayerBatch, useDeleteLayerBatch, useRecordLayerDaily, useDeleteLayerDaily,
  useRecordLayerWeight, useDeleteLayerWeight, useRecordLayerHealth, useDeleteLayerHealth,
  useSaveRearingSettings, useTransferToProduction,
  computeBatchMetrics, mortalityLedger, waterAlerts, batchNotifications, targetWeight,
  DEFAULT_STAGES, LAYER_STATUS_LABELS, LAYER_STATUS_TONES, LAYER_HEALTH_KINDS,
  type BatchMetrics, type RearingSettings,
} from "@/lib/layer-rearing";

export const Route = createFileRoute("/_authenticated/rearing")({
  head: () => ({
    meta: [
      { title: "Layer Brooding & Rearing — PoultryPro" },
      { name: "description", content: "Track layer flocks from day-old chicks through brooding, grower, developer and pre-lay stages until point of lay." },
      { property: "og:title", content: "Layer Brooding & Rearing — PoultryPro" },
      { property: "og:description", content: "Batch-based layer rearing: age tracking, growth stages, weekly weights, feed, water, mortality, vaccination reminders and transfer to layer production." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RearingPage,
});

const num = (n: number, d = 0) => n.toLocaleString("en-NG", { maximumFractionDigits: d, minimumFractionDigits: d });
const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const todayKey = () => toDateKey(new Date())!;
const input = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

const TIMELINE = ["Day-old", "Brooding", "Grower", "Developer", "Pre-Lay", "Point of Lay", "Layer Production"];

function RearingPage() {
  const { can, loading } = usePermissions();
  const batchesQ = useLayerBatches();
  const dailyQ = useLayerDaily();
  const weightsQ = useLayerWeights();
  const healthQ = useLayerHealth();
  const settingsQ = useRearingSettings();

  const [selected, setSelected] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const settings = settingsQ.data;
  const metrics = useMemo<BatchMetrics[]>(() => {
    if (!settings) return [];
    return (batchesQ.data ?? []).map((b) =>
      computeBatchMetrics(b, dailyQ.data ?? [], weightsQ.data ?? [], healthQ.data ?? [], settings),
    );
  }, [batchesQ.data, dailyQ.data, weightsQ.data, healthQ.data, settings]);

  const notifications = useMemo(
    () => (settings ? metrics.flatMap((m) => batchNotifications(m, settings)).slice(0, 6) : []),
    [metrics, settings],
  );

  const current = selected ? metrics.find((m) => m.batch.id === selected) ?? null : null;

  if (loading || batchesQ.isLoading || settingsQ.isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!can("rooms.read")) {
    return <PermissionDenied hint="Layer Brooding & Rearing is available to the Farm Owner and Farm Managers." />;
  }
  const writable = can("rooms.write");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Egg className="h-3.5 w-3.5" /> Layer Lifecycle
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-semibold sm:text-3xl">Layer Brooding &amp; Rearing</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Day-old chicks tracked through brooding, grower, developer and pre-lay until point of lay — then transferred into Layer Production with their full history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {writable && (
            <button onClick={() => setShowSettings(true)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm font-medium hover:bg-secondary">
              <Settings2 className="h-4 w-4" /> Stage settings
            </button>
          )}
          {writable && (
            <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--forest)] px-4 py-2 text-sm font-semibold text-primary-foreground">
              <Plus className="h-4 w-4" /> Create Brooding Batch
            </button>
          )}
        </div>
      </header>

      {notifications.length > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800"><Bell className="h-3.5 w-3.5" /> Notifications</div>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {notifications.map((n, i) => <li key={i}>🔔 {n}</li>)}
          </ul>
        </div>
      )}

      {current ? (
        <BatchDashboard m={current} settings={settings!} writable={writable} onBack={() => setSelected(null)} />
      ) : (
        <BatchList metrics={metrics} onOpen={setSelected} />
      )}

      {showNew && <NewBatchDialog onClose={() => setShowNew(false)} />}
      {showSettings && settings && <SettingsDialog settings={settings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- batch list

function BatchList({ metrics, onOpen }: { metrics: BatchMetrics[]; onOpen: (id: string) => void }) {
  const active = metrics.filter((m) => m.batch.status === "rearing");
  const past = metrics.filter((m) => m.batch.status !== "rearing");

  if (!metrics.length) {
    return (
      <div className="mt-8 rounded-3xl border border-dashed border-border p-10 text-center">
        <Egg className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 font-display text-lg font-semibold">No rearing batches yet</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Create a brooding batch when you place day-old layer chicks. Existing mature layer flocks stay in Layer Production — nothing is moved automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <Section title="Active brooding / rearing batches">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {active.map((m) => <BatchCard key={m.batch.id} m={m} onOpen={onOpen} />)}
          {!active.length && <p className="text-sm text-muted-foreground">No active batches.</p>}
        </div>
      </Section>
      {past.length > 0 && (
        <Section title="Transferred & closed batches">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {past.map((m) => <BatchCard key={m.batch.id} m={m} onOpen={onOpen} />)}
          </div>
        </Section>
      )}
    </div>
  );
}

function BatchCard({ m, onOpen }: { m: BatchMetrics; onOpen: (id: string) => void }) {
  return (
    <button onClick={() => onOpen(m.batch.id)} className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-[color:var(--forest)]/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-display text-base font-semibold">{m.batch.name}</div>
          <div className="text-xs text-muted-foreground">{m.batch.breed || "Layer"} · placed {m.batch.placement_date}</div>
        </div>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase", LAYER_STATUS_TONES[m.batch.status] ?? LAYER_STATUS_TONES.rearing)}>
          {LAYER_STATUS_LABELS[m.batch.status] ?? m.batch.status}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Mini label="Birds" value={num(m.batch.current_birds)} />
        <Mini label="Age" value={`${m.weeks}w / ${m.days}d`} />
        <Mini label="Stage" value={m.stage.label} />
      </div>
      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-[color:var(--forest)]" style={{ width: `${m.progress}%` }} />
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">{Math.round(m.progress)}% to point of lay</div>
      </div>
    </button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/50 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ----------------------------------------------------------- batch dashboard

const TABS = ["overview", "daily", "weights", "feed", "water", "mortality", "health", "timeline"] as const;
type Tab = (typeof TABS)[number];

function BatchDashboard({ m, settings, writable, onBack }: { m: BatchMetrics; settings: RearingSettings; writable: boolean; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [showDaily, setShowDaily] = useState(false);
  const [showWeight, setShowWeight] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const del = useDeleteLayerBatch();

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All batches
        </button>
        {writable && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowDaily(true)}>Record daily</Button>
            <Button size="sm" variant="outline" onClick={() => setShowWeight(true)}>Weekly weight</Button>
            <Button size="sm" variant="outline" onClick={() => setShowHealth(true)}>Health / vaccination</Button>
            <Button
              size="sm" variant="ghost"
              onClick={() => { if (confirm(`Delete ${m.batch.name} and all its rearing records?`)) del.mutate(m.batch.id, { onSuccess: () => { toast.success("Batch deleted"); onBack(); } }); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Layer Brooding</div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-semibold">{m.batch.name}</h2>
          <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase", LAYER_STATUS_TONES[m.batch.status] ?? LAYER_STATUS_TONES.rearing)}>
            {m.stage.label}
          </span>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Fact k="Birds Started" v={num(m.batch.birds_placed)} />
          <Fact k="Current Birds" v={num(m.batch.current_birds)} />
          <Fact k="Current Age" v={m.ageLabel} />
          <Fact k="Breed" v={m.batch.breed || "—"} />
          <Fact k="Placement Date" v={m.batch.placement_date} />
          <Fact k="Housing" v={m.batch.room || "—"} />
        </dl>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Egg} label="Current Birds" value={num(m.batch.current_birds)} />
        <Kpi icon={Skull} label="Mortality" value={`${num(m.deaths)}${m.mortalityPct !== null ? ` · ${m.mortalityPct.toFixed(2)}%` : ""}`} />
        <Kpi icon={Wheat} label="Feed Used" value={`${num(m.feedKg, 1)} kg`} />
        <Kpi icon={Droplets} label="Water Used" value={`${num(m.waterLitres, 1)} L`} />
        <Kpi icon={Scale} label="Average Weight" value={m.lastWeight ? `${num(m.lastWeight.avg_weight_g)} g` : "—"} />
        <Kpi icon={Sparkles} label="Growth Status" value={m.growthStatus} />
        <Kpi icon={Syringe} label="Upcoming Vaccination" value={m.nextVaccination ? `${m.nextVaccination.name} · ${m.nextVaccination.entry_date}` : "None scheduled"} />
        <Kpi icon={CalendarClock} label="Days to Next Milestone" value={m.nextMilestone ? `${Math.max(0, m.nextMilestone.inDays)} · ${m.nextMilestone.title}` : "—"} />
      </div>

      {m.ready && m.batch.status === "rearing" && (
        <section className="rounded-3xl border border-[color:var(--forest)]/40 bg-[color:var(--forest)]/8 p-5">
          <h3 className="font-display text-lg font-semibold">🎉 Flock ready for layer production</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Fact k="Current Age" v={m.ageLabel} />
            <Fact k="Current Birds" v={num(m.batch.current_birds)} />
            <Fact k="Average Body Weight" v={m.lastWeight ? `${num(m.lastWeight.avg_weight_g)} g` : "Not recorded"} />
            <Fact k="Mortality Rate" v={m.mortalityPct !== null ? `${m.mortalityPct.toFixed(2)}%` : "N/A"} />
            <Fact k="Feed Performance" v={m.feedPerBirdKg !== null ? `${num(m.feedPerBirdKg, 2)} kg/bird` : "N/A"} />
            <Fact k="Health Status" v={`${m.health.length} record${m.health.length === 1 ? "" : "s"}`} />
            <Fact k="Vaccination Status" v={`${m.health.filter((h) => h.kind === "vaccination").length} given`} />
            <Fact k="Production Readiness" v={m.growthStatus} />
          </dl>
          {writable && (
            <button onClick={() => setShowTransfer(true)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[color:var(--forest)] px-4 py-2 text-sm font-semibold text-primary-foreground">
              <ArrowRightLeft className="h-4 w-4" /> Transfer to Layer Production
            </button>
          )}
        </section>
      )}

      {m.batch.status === "transferred" && (
        <p className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-900">
          This flock is now in Layer Production — <strong>reared in PoultryPro from Day 1</strong>. Its rearing history below stays intact.
        </p>
      )}

      <Timeline m={m} />

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-semibold capitalize", tab === t ? "bg-[color:var(--forest)] text-primary-foreground" : "border border-border text-muted-foreground hover:bg-secondary")}>
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab m={m} />}
      {tab === "daily" && <DailyTab m={m} writable={writable} />}
      {tab === "weights" && <WeightsTab m={m} settings={settings} />}
      {tab === "feed" && <FeedTab m={m} />}
      {tab === "water" && <WaterTab m={m} />}
      {tab === "mortality" && <MortalityTab m={m} />}
      {tab === "health" && <HealthTab m={m} writable={writable} />}
      {tab === "timeline" && <ScheduleTab m={m} settings={settings} />}

      {showDaily && <DailyDialog m={m} onClose={() => setShowDaily(false)} />}
      {showWeight && <WeightDialog m={m} settings={settings} onClose={() => setShowWeight(false)} />}
      {showHealth && <HealthDialog m={m} onClose={() => setShowHealth(false)} />}
      {showTransfer && <TransferDialog m={m} onClose={() => setShowTransfer(false)} />}
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Egg; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1.5 font-display text-lg font-semibold">{value}</div>
    </div>
  );
}

function Timeline({ m }: { m: BatchMetrics }) {
  const idx = Math.min(m.stageIdx, TIMELINE.length - 1);
  const at = m.batch.status === "transferred" ? TIMELINE.length - 1 : idx;
  return (
    <Section title="Progress timeline">
      <ol className="space-y-1.5 text-sm">
        {TIMELINE.map((label, i) => (
          <li key={label} className={cn("flex items-center gap-2 rounded-xl px-3 py-2",
            i === at ? "bg-[color:var(--forest)]/10 font-semibold text-[color:var(--forest)]" : i < at ? "text-muted-foreground" : "text-muted-foreground/70")}>
            <span className="w-4">{i < at ? "✓" : i === at ? "→" : "○"}</span>
            <span>{i === at ? `YOU ARE HERE — ${label}` : label}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function OverviewTab({ m }: { m: BatchMetrics }) {
  const alerts = waterAlerts(m);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Feed summary">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Fact k="Today" v={`${num(m.feedToday, 1)} kg`} />
          <Fact k="This week" v={`${num(m.feedWeek, 1)} kg`} />
          <Fact k="Cumulative" v={`${num(m.feedKg, 1)} kg`} />
          <Fact k="Feed / bird" v={m.feedPerBirdKg !== null ? `${num(m.feedPerBirdKg, 2)} kg` : "N/A"} />
          <Fact k="Feed cost" v={naira(m.feedCost)} />
        </dl>
      </Section>
      <Section title="Water summary">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Fact k="Today" v={`${num(m.waterToday, 1)} L`} />
          <Fact k="Cumulative" v={`${num(m.waterLitres, 1)} L`} />
          <Fact k="Water / bird" v={m.waterPerBird !== null ? `${num(m.waterPerBird, 2)} L` : "N/A"} />
        </dl>
        {alerts.map((a) => (
          <p key={a.date} className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900">
            Water intake on {a.date} is {a.change > 0 ? "+" : ""}{a.change.toFixed(0)}% versus this flock's recent pattern. Worth a check.
          </p>
        ))}
      </Section>
    </div>
  );
}

function DailyTab({ m, writable }: { m: BatchMetrics; writable: boolean }) {
  const del = useDeleteLayerDaily();
  return (
    <Section title="Daily records">
      <div className="-mx-2 overflow-x-auto px-2">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><Th>Date</Th><Th>Feed</Th><Th>Water</Th><Th>Deaths</Th><Th>Weight</Th><Th>Temp</Th><Th>Notes</Th><Th /></tr>
          </thead>
          <tbody>
            {m.daily.map((d) => (
              <tr key={d.id} className="border-t border-border/60">
                <Td>{d.entry_date}</Td>
                <Td>{num(d.feed_kg, 1)} kg</Td>
                <Td>{num(d.water_litres, 1)} L</Td>
                <Td>{d.deaths}</Td>
                <Td>{d.avg_weight_g ? `${num(d.avg_weight_g)} g` : "—"}</Td>
                <Td>{d.temperature_c !== null ? `${d.temperature_c}°C` : "—"}</Td>
                <Td className="max-w-[220px] truncate">{[d.observation, d.notes].filter(Boolean).join(" · ") || "—"}</Td>
                <Td>{writable && <button onClick={() => del.mutate(d.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}</Td>
              </tr>
            ))}
            {!m.daily.length && <tr><td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">No daily records yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function WeightsTab({ m, settings }: { m: BatchMetrics; settings: RearingSettings }) {
  const del = useDeleteLayerWeight();
  const rows = m.weights.map((w) => {
    const target = w.target_weight_g ?? targetWeight(settings, m.batch.breed, w.week);
    const diff = target !== null ? w.avg_weight_g - target : null;
    const status = diff === null ? "No target configured"
      : diff >= 0 ? "On/above target"
      : Math.abs(diff) / (target || 1) <= 0.05 ? "Slightly below target" : "Below target";
    return { ...w, target, diff, status };
  });
  const max = Math.max(1, ...rows.flatMap((r) => [r.avg_weight_g, r.target ?? 0]));

  return (
    <Section title="Weekly weight monitoring">
      <div className="-mx-2 overflow-x-auto px-2">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><Th>Week</Th><Th>Birds weighed</Th><Th>Average</Th><Th>Target</Th><Th>Difference</Th><Th>Status</Th><Th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <Td>Week {r.week}</Td>
                <Td>{r.birds_weighed}</Td>
                <Td>{num(r.avg_weight_g)} g</Td>
                <Td>{r.target !== null ? `${num(r.target)} g` : "—"}</Td>
                <Td>{r.diff !== null ? `${r.diff > 0 ? "+" : ""}${num(r.diff)} g` : "—"}</Td>
                <Td>{r.status}</Td>
                <Td><button onClick={() => del.mutate(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></Td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="py-6 text-center text-xs text-muted-foreground">No weight records yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[color:var(--forest)]" /> Actual</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> Target</span>
          </div>
          <div className="flex items-end gap-2 overflow-x-auto">
            {rows.map((r) => (
              <div key={r.id} className="flex w-12 shrink-0 flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end justify-center gap-1">
                  <div className="w-3 rounded-t bg-[color:var(--forest)]" style={{ height: `${(r.avg_weight_g / max) * 100}%` }} />
                  <div className="w-3 rounded-t bg-muted-foreground/40" style={{ height: `${((r.target ?? 0) / max) * 100}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">W{r.week}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

function FeedTab({ m }: { m: BatchMetrics }) {
  const rows = m.daily.filter((d) => d.feed_kg > 0);
  return (
    <Section title="Feed management">
      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Mini label="Today" value={`${num(m.feedToday, 1)} kg`} />
        <Mini label="This week" value={`${num(m.feedWeek, 1)} kg`} />
        <Mini label="Cumulative" value={`${num(m.feedKg, 1)} kg`} />
        <Mini label="Feed / bird" value={m.feedPerBirdKg !== null ? `${num(m.feedPerBirdKg, 2)} kg` : "N/A"} />
        <Mini label="Feed cost" value={naira(m.feedCost)} />
      </div>
      <div className="-mx-2 overflow-x-auto px-2">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><Th>Date</Th><Th>Feed type</Th><Th>Quantity</Th><Th>Cost</Th><Th>Notes</Th></tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-border/60">
                <Td>{d.entry_date}</Td><Td>{d.feed_type || "—"}</Td><Td>{num(d.feed_kg, 1)} kg</Td>
                <Td>{d.feed_cost ? naira(d.feed_cost) : "—"}</Td><Td className="max-w-[220px] truncate">{d.notes || "—"}</Td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">No feed recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function WaterTab({ m }: { m: BatchMetrics }) {
  const rows = m.daily.filter((d) => d.water_litres > 0);
  const alerts = waterAlerts(m);
  return (
    <Section title="Water management">
      {alerts.map((a) => (
        <p key={a.date} className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900">
          Water intake on {a.date} changed {a.change > 0 ? "+" : ""}{a.change.toFixed(0)}% against this flock's recent average.
        </p>
      ))}
      <div className="-mx-2 overflow-x-auto px-2">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><Th>Date</Th><Th>Water used</Th><Th>Birds</Th><Th>Water / bird</Th><Th>Notes</Th></tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const birds = d.birds_count ?? m.batch.current_birds;
              return (
                <tr key={d.id} className="border-t border-border/60">
                  <Td>{d.entry_date}</Td><Td>{num(d.water_litres, 1)} L</Td><Td>{num(birds)}</Td>
                  <Td>{birds ? `${(d.water_litres / birds).toFixed(3)} L` : "N/A"}</Td>
                  <Td className="max-w-[220px] truncate">{d.notes || "—"}</Td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">No water recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function MortalityTab({ m }: { m: BatchMetrics }) {
  const rows = mortalityLedger(m);
  return (
    <Section title="Mortality log">
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Mini label="Starting birds" value={num(m.batch.birds_placed)} />
        <Mini label="Current birds" value={num(m.batch.current_birds)} />
        <Mini label="Cumulative mortality" value={num(m.deaths)} />
        <Mini label="Mortality rate" value={m.mortalityPct !== null ? `${m.mortalityPct.toFixed(2)}%` : "N/A"} />
      </div>
      <div className="-mx-2 overflow-x-auto px-2">
        <table className="w-full min-w-[440px] text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><Th>Date</Th><Th>Mortality</Th><Th>Remaining birds</Th><Th>Reason</Th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <Td>{r.entry_date}</Td><Td>{r.deaths}</Td><Td>{num(r.remaining)}</Td><Td>{r.death_reason || "Unknown"}</Td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">No mortality recorded.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function HealthTab({ m, writable }: { m: BatchMetrics; writable: boolean }) {
  const del = useDeleteLayerHealth();
  return (
    <Section title="Health, medication & vaccination">
      <div className="-mx-2 overflow-x-auto px-2">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><Th>Date</Th><Th>Type</Th><Th>Name</Th><Th>Dosage</Th><Th>By</Th><Th>Status</Th><Th>Notes</Th><Th /></tr>
          </thead>
          <tbody>
            {m.health.map((h) => (
              <tr key={h.id} className="border-t border-border/60">
                <Td>{h.entry_date}</Td><Td className="capitalize">{h.kind}</Td><Td>{h.name}</Td>
                <Td>{h.dosage || "—"}</Td><Td>{h.administered_by || "—"}</Td><Td className="capitalize">{h.status}</Td>
                <Td className="max-w-[200px] truncate">{h.notes || "—"}</Td>
                <Td>{writable && <button onClick={() => del.mutate(h.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}</Td>
              </tr>
            ))}
            {!m.health.length && <tr><td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">No health records yet. Vaccination schedules are set by your farm or veterinarian.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function ScheduleTab({ m, settings }: { m: BatchMetrics; settings: RearingSettings }) {
  const items = [...settings.schedule].sort((a, b) => a.day - b.day);
  return (
    <Section title="Management & reminder timeline">
      <ol className="space-y-2 text-sm">
        {items.map((s) => {
          const done = m.days >= s.day;
          return (
            <li key={s.key} className={cn("flex items-start gap-3 rounded-xl border border-border px-3 py-2", done && "bg-secondary/40")}>
              <span className="w-4 pt-0.5">{done ? "✓" : "○"}</span>
              <div className="min-w-0">
                <div className="font-medium">{s.day < 7 ? `Day ${s.day}` : `Week ${Math.floor(s.day / 7)} · Day ${s.day}`} — {s.title}</div>
                {s.note && <div className="text-xs text-muted-foreground">{s.note}</div>}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        Vaccination and health schedules are configurable by your farm or veterinarian. PoultryPro never prescribes medication automatically.
      </p>
    </Section>
  );
}

const Th = ({ children }: { children?: React.ReactNode }) => <th className="px-2 py-2 text-left font-semibold">{children}</th>;
const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => <td className={cn("px-2 py-2", className)}>{children}</td>;

// -------------------------------------------------------------------- forms

function NewBatchDialog({ onClose }: { onClose: () => void }) {
  const add = useAddLayerBatch();
  const roomsQ = useRooms();
  const [f, setF] = useState({
    name: "", breed: "", birds: "" as string, date: todayKey(), startAge: "0",
    room: "", newRoom: "", source: "", notes: "",
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const birds = Number(f.birds);
    if (!f.name.trim() || !birds) { toast.error("Batch name and number of chicks are required"); return; }
    add.mutate({
      name: f.name, breed: f.breed, birds_placed: birds, placement_date: f.date,
      start_age_days: Number(f.startAge) || 0,
      room: f.newRoom.trim() || f.room, source: f.source, notes: f.notes,
    }, { onSuccess: () => { toast.success("Brooding batch created"); onClose(); }, onError: (e2) => toast.error((e2 as Error).message) });
  };
  return (
    <Shell title="Create Brooding Batch" desc="Day-old layer chicks. Age is calculated from the placement date and updates every day." onClose={onClose} onSubmit={submit} pending={add.isPending}>
      <Field label="Batch Name / ID"><input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Layer Batch 001" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bird type"><input className={input} value="Layer" readOnly /></Field>
        <Field label="Breed"><input className={input} value={f.breed} onChange={(e) => setF({ ...f, breed: e.target.value })} placeholder="ISA Brown" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Number of day-old chicks"><input type="number" min={1} className={input} value={f.birds} onChange={(e) => setF({ ...f, birds: e.target.value })} placeholder="500" /></Field>
        <Field label="Placement / hatch date"><input type="date" className={input} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      </div>
      <Field label="Starting age (days)"><input type="number" min={0} className={input} value={f.startAge} onChange={(e) => setF({ ...f, startAge: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Existing room">
          <select className={input} value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })}>
            <option value="">Select…</option>
            {(roomsQ.data ?? []).map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Or new brooding room"><input className={input} value={f.newRoom} onChange={(e) => setF({ ...f, newRoom: e.target.value })} placeholder="Brooder House A" /></Field>
      </div>
      <Field label="Source / hatchery (optional)"><input className={input} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /></Field>
      <Field label="Notes (optional)"><textarea className={input} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </Shell>
  );
}

function DailyDialog({ m, onClose }: { m: BatchMetrics; onClose: () => void }) {
  const rec = useRecordLayerDaily();
  const [f, setF] = useState({
    date: todayKey(), deaths: "0", reason: "", feed: "0", feedType: "", cost: "0",
    water: "0", weight: "", birds: String(m.batch.current_birds), temp: "", observation: "", notes: "",
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    rec.mutate({
      batch_id: m.batch.id, entry_date: f.date, deaths: Number(f.deaths) || 0, death_reason: f.reason,
      feed_kg: Number(f.feed) || 0, feed_type: f.feedType, feed_cost: Number(f.cost) || 0,
      water_litres: Number(f.water) || 0,
      avg_weight_g: f.weight ? Number(f.weight) : null,
      birds_count: f.birds ? Number(f.birds) : null,
      temperature_c: f.temp ? Number(f.temp) : null,
      observation: f.observation, notes: f.notes, current_birds: m.batch.current_birds,
    }, { onSuccess: () => { toast.success("Daily record saved"); onClose(); }, onError: (e2) => toast.error((e2 as Error).message) });
  };
  return (
    <Shell title={`Daily record — ${m.batch.name}`} desc={`${m.ageLabel} · ${m.stage.label}`} onClose={onClose} onSubmit={submit} pending={rec.isPending}>
      <Field label="Date"><input type="date" className={input} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Feed used (kg)"><input type="number" step="0.01" className={input} value={f.feed} onChange={(e) => setF({ ...f, feed: e.target.value })} /></Field>
        <Field label="Feed type"><input className={input} value={f.feedType} onChange={(e) => setF({ ...f, feedType: e.target.value })} placeholder="Chick mash" /></Field>
        <Field label="Feed cost (₦)"><input type="number" step="1" className={input} value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></Field>
        <Field label="Water used (L)"><input type="number" step="0.1" className={input} value={f.water} onChange={(e) => setF({ ...f, water: e.target.value })} /></Field>
        <Field label="Mortality (birds)"><input type="number" min={0} className={input} value={f.deaths} onChange={(e) => setF({ ...f, deaths: e.target.value })} /></Field>
        <Field label="Reason"><input className={input} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Weak chick" /></Field>
        <Field label="Average weight (g)"><input type="number" className={input} value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></Field>
        <Field label="Number of birds"><input type="number" className={input} value={f.birds} onChange={(e) => setF({ ...f, birds: e.target.value })} /></Field>
      </div>
      <Field label="Temperature (°C)"><input type="number" step="0.1" className={input} value={f.temp} onChange={(e) => setF({ ...f, temp: e.target.value })} /></Field>
      <Field label="Health observation"><input className={input} value={f.observation} onChange={(e) => setF({ ...f, observation: e.target.value })} placeholder="Birds active, litter dry" /></Field>
      <Field label="Notes"><textarea className={input} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </Shell>
  );
}

function WeightDialog({ m, settings, onClose }: { m: BatchMetrics; settings: RearingSettings; onClose: () => void }) {
  const rec = useRecordLayerWeight();
  const week = Math.max(1, m.weeks);
  const preTarget = targetWeight(settings, m.batch.breed, week);
  const [f, setF] = useState({ week: String(week), date: todayKey(), birds: "", avg: "", target: preTarget !== null ? String(preTarget) : "", notes: "" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.avg) { toast.error("Average body weight is required"); return; }
    rec.mutate({
      batch_id: m.batch.id, week: Number(f.week) || week, entry_date: f.date,
      birds_weighed: Number(f.birds) || 0, avg_weight_g: Number(f.avg),
      target_weight_g: f.target ? Number(f.target) : null, notes: f.notes,
    }, { onSuccess: () => { toast.success("Weight recorded"); onClose(); }, onError: (e2) => toast.error((e2 as Error).message) });
  };
  return (
    <Shell title="Weekly weight check" desc="Targets come from your configured breed table — none are assumed." onClose={onClose} onSubmit={submit} pending={rec.isPending}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Week"><input type="number" min={1} className={input} value={f.week} onChange={(e) => setF({ ...f, week: e.target.value })} /></Field>
        <Field label="Date"><input type="date" className={input} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Birds weighed"><input type="number" min={0} className={input} value={f.birds} onChange={(e) => setF({ ...f, birds: e.target.value })} /></Field>
        <Field label="Average weight (g)"><input type="number" className={input} value={f.avg} onChange={(e) => setF({ ...f, avg: e.target.value })} /></Field>
        <Field label="Target weight (g)"><input type="number" className={input} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
      </div>
      <Field label="Notes"><textarea className={input} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </Shell>
  );
}

function HealthDialog({ m, onClose }: { m: BatchMetrics; onClose: () => void }) {
  const rec = useRecordLayerHealth();
  const [f, setF] = useState({ kind: "vaccination", name: "", date: todayKey(), dosage: "", by: "", status: "done", notes: "" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) { toast.error("Name is required"); return; }
    rec.mutate({
      batch_id: m.batch.id, kind: f.kind, name: f.name, entry_date: f.date,
      dosage: f.dosage, administered_by: f.by, status: f.status, notes: f.notes,
    }, { onSuccess: () => { toast.success("Health record saved"); onClose(); }, onError: (e2) => toast.error((e2 as Error).message) });
  };
  return (
    <Shell title="Health / vaccination record" desc="Schedules are set by your farm or veterinarian." onClose={onClose} onSubmit={submit} pending={rec.isPending}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select className={input} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            {LAYER_HEALTH_KINDS.map((k) => <option key={k} value={k} className="capitalize">{k}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className={input} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="done">Done</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </Field>
        <Field label="Name"><input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Newcastle (as advised)" /></Field>
        <Field label="Date"><input type="date" className={input} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Dosage"><input className={input} value={f.dosage} onChange={(e) => setF({ ...f, dosage: e.target.value })} /></Field>
        <Field label="Administered by"><input className={input} value={f.by} onChange={(e) => setF({ ...f, by: e.target.value })} /></Field>
      </div>
      <Field label="Notes"><textarea className={input} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </Shell>
  );
}

function TransferDialog({ m, onClose }: { m: BatchMetrics; onClose: () => void }) {
  const roomsQ = useRooms();
  const transfer = useTransferToProduction();
  const [roomId, setRoomId] = useState("");
  const [roomName, setRoomName] = useState(m.batch.room || m.batch.name);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    transfer.mutate({ batch: m.batch, roomName, existingRoomId: roomId || null }, {
      onSuccess: () => { toast.success("Flock transferred to Layer Production", { description: "All rearing history stays attached to this batch." }); onClose(); },
      onError: (e2) => toast.error((e2 as Error).message),
    });
  };
  return (
    <Shell title="Transfer to Layer Production" desc="The flock is moved, not duplicated. Every rearing record is preserved." onClose={onClose} onSubmit={submit} pending={transfer.isPending} cta="Confirm transfer">
      <Field label="Link to an existing production room">
        <select className={input} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="">Create a new room</option>
          {(roomsQ.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>
      {!roomId && <Field label="New room name"><input className={input} value={roomName} onChange={(e) => setRoomName(e.target.value)} /></Field>}
      <p className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
        {num(m.batch.current_birds)} birds · placed {m.batch.placement_date} · {m.ageLabel}. The production room inherits the placement date, so its age keeps counting from Day 1.
      </p>
    </Shell>
  );
}

function SettingsDialog({ settings, onClose }: { settings: RearingSettings; onClose: () => void }) {
  const save = useSaveRearingSettings();
  const [maturity, setMaturity] = useState(String(settings.maturity_weeks));
  const [stages, setStages] = useState(settings.stages.length ? settings.stages : DEFAULT_STAGES);
  const [breed, setBreed] = useState("default");
  const [targets, setTargets] = useState(() => JSON.stringify(settings.weight_targets?.[breed] ?? {}, null, 0));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let parsed: Record<string, number> = {};
    try { parsed = targets.trim() ? JSON.parse(targets) : {}; }
    catch { toast.error('Target weights must look like {"4":320,"8":700}'); return; }
    save.mutate({
      maturity_weeks: Number(maturity) || settings.maturity_weeks,
      stages,
      weight_targets: { ...settings.weight_targets, [breed.trim().toLowerCase() || "default"]: parsed },
      schedule: settings.schedule,
    }, { onSuccess: () => { toast.success("Rearing settings saved"); onClose(); }, onError: (e2) => toast.error((e2 as Error).message) });
  };

  return (
    <Shell title="Rearing settings" desc="Stage boundaries, maturity threshold and breed target weights are yours to configure." onClose={onClose} onSubmit={submit} pending={save.isPending}>
      <Field label="Point-of-lay / maturity threshold (weeks)">
        <input type="number" min={10} className={input} value={maturity} onChange={(e) => setMaturity(e.target.value)} />
      </Field>
      <div className="space-y-2">
        <span className="text-sm font-medium">Stage start day</span>
        {stages.map((s, i) => (
          <div key={s.key} className="grid grid-cols-[1fr_100px] items-center gap-2">
            <span className="text-sm text-muted-foreground">{s.label}</span>
            <input type="number" min={0} className={input} value={s.fromDay}
              onChange={(e) => setStages(stages.map((x, xi) => xi === i ? { ...x, fromDay: Number(e.target.value) || 0 } : x))} />
          </div>
        ))}
      </div>
      <Field label="Breed for target table"><input className={input} value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="default or ISA Brown" /></Field>
      <Field label='Target body weights by week, e.g. {"4":320,"8":700}'>
        <textarea className={input} rows={3} value={targets} onChange={(e) => setTargets(e.target.value)} />
      </Field>
    </Shell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span>{children}</label>;
}

function Shell({ title, desc, children, onClose, onSubmit, pending, cta = "Save" }: {
  title: string; desc?: string; children: React.ReactNode; onClose: () => void;
  onSubmit: (e: React.FormEvent) => void; pending?: boolean; cta?: string;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {desc && <DialogDescription>{desc}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {children}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{cta}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
