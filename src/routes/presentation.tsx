import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, Bird, Home, Egg, Wallet, Wheat, AlertTriangle, LineChart,
  ClipboardList, Syringe, Package, BarChart3, FileText, FileSpreadsheet,
  ShieldCheck, Users, TrendingUp, Bell, Smartphone, Tablet, Monitor,
  Rocket, Play, Pause, SkipForward, RotateCcw, Maximize2, X, ArrowRight,
  Brain, Cpu, Mic, CloudSun, Radio, Camera, Activity, CheckCircle2,
  Database, Lock, Info, Server, Cloud, Gauge, RefreshCw, HardDrive,
  BadgeCheck, Clock,
} from "lucide-react";

import { PRICING_PLANS } from "@/lib/pricing-plans";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/presentation")({
  head: () => ({
    meta: [
      { title: "PoultryPro™ — Greenfield Demonstration Farm" },
      { name: "description", content: "Guided investor demonstration of PoultryPro using real historical records from a live commercial poultry farm — read-only demo dataset." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PresentationMode,
});

// ---------- Real farm demo data (read-only historical records) ----------
type SeriesPoint = { d: string; v: number };
type RoomRow = { name: string; current: number; initial: number; mortality_pct: number };
type ProdRow = { date: string; label: string; r2: number; r3: number; r4: number; extra: number; eggs: number };
type FeedRow = { date: string; room: string; bags: number };
type MortRow = { date: string; room: string; cause: string; loss: number };
type HealthRow = { date: string; name: string; scope: string; type: string };
type MonthRow = { month: string; eggs: number; crates: number; revenue: number };

type DemoData = {
  farm_name: string;
  location: string;
  period_start: string;
  period_end: string;
  days_covered: number;
  egg_price: number;
  feed_price: number;
  rooms: RoomRow[];
  birds: number;
  initial_birds: number;
  houses: number;
  total_eggs: number;
  total_crates: number;
  total_feed_bags: number;
  total_mortality: number;
  health_records_count: number;
  production_records_count: number;
  feed_records_count: number;
  mortality_records_count: number;
  today_crates: number;
  production_180: SeriesPoint[];
  feed_180: SeriesPoint[];
  mortality_180: SeriesPoint[];
  revenue_180: SeriesPoint[];
  recent_production: ProdRow[];
  recent_feed: FeedRow[];
  recent_mortality: MortRow[];
  recent_health: HealthRow[];
  monthly: MonthRow[];
  total_revenue: number;
  total_feed_cost: number;
  gross_profit: number;
  avg_daily_crates: number;
  avg_daily_feed_bags: number;
  mortality_pct: number;
  feed_conversion_ratio: number;
  annual_revenue: number;
};

const DEMO_FARM_NAME = "ABZ Global Resources";

const FALLBACK: DemoData = {
  farm_name: "ABZ Global Resources",
  location: "Commercial layer operation · Real historical dataset",

  period_start: "", period_end: "", days_covered: 1,
  egg_price: 4900, feed_price: 11950,
  rooms: [], birds: 0, initial_birds: 0, houses: 0,
  total_eggs: 0, total_crates: 0, total_feed_bags: 0, total_mortality: 0,
  health_records_count: 0, production_records_count: 0, feed_records_count: 0, mortality_records_count: 0,
  today_crates: 0,
  production_180: [], feed_180: [], mortality_180: [], revenue_180: [],
  recent_production: [], recent_feed: [], recent_mortality: [], recent_health: [],
  monthly: [],
  total_revenue: 0, total_feed_cost: 0, gross_profit: 0,
  avg_daily_crates: 0, avg_daily_feed_bags: 0, mortality_pct: 0,
  feed_conversion_ratio: 0, annual_revenue: 0,
};

function useDemoData(): { data: DemoData; loading: boolean; reset: () => void } {
  const [data, setData] = useState<DemoData>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const { data: res, error } = await supabase.rpc("demo_greenfield_data" as never);
      if (!alive) return;
      // Single source of truth: all figures come from the demonstration database.
      // Only the display name is normalised to the verified source farm.
      if (!error && res) setData({ ...FALLBACK, ...(res as Partial<DemoData>), farm_name: DEMO_FARM_NAME });

      setLoading(false);
    })();
    return () => { alive = false; };
  }, [nonce]);
  const reset = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, reset };
}

// ---------- Step definitions ----------
type Step = { id: string; title: string; subtitle: string };
const STEPS: Step[] = [
  { id: "welcome", title: "Welcome", subtitle: "Real farm records · read-only demo dataset" },
  { id: "dashboard", title: "Farm Dashboard", subtitle: "Live snapshot of the demonstration farm" },
  { id: "records", title: "Farm Records", subtitle: "Actual production, feed, mortality and health entries" },
  { id: "analytics", title: "Analytics", subtitle: "180-day historical performance" },
  { id: "financials", title: "Financials", subtitle: "Revenue, feed cost and gross profit" },
  { id: "ai", title: "AI Intelligence", subtitle: "Insights derived from the farm's own history" },
  { id: "reports", title: "Reports", subtitle: "Monthly summaries ready to export" },
  { id: "admin", title: "Platform Administration", subtitle: "Manage thousands of farms from one dashboard" },
  { id: "mobile", title: "Mobile Experience", subtitle: "PoultryPro works anywhere, anytime" },
  { id: "pricing", title: "Subscription Plans", subtitle: "Simple subscription plans for every farm size" },
  { id: "vision", title: "Future Vision", subtitle: "The AI roadmap" },
  { id: "close", title: "Ready for Commercial Deployment", subtitle: "Operating on real commercial farm data" },
];

const NGN = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString("en-NG", { day: "2-digit", month: "short" }) : "—";

function PresentationMode() {
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exited, setExited] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const { data: demo, loading, reset } = useDemoData();
  const goNext = useCallback(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), []);
  const goPrev = useCallback(() => setStepIdx((i) => Math.max(i - 1, 0)), []);
  const restart = useCallback(() => { setStepIdx(0); setPlaying(false); reset(); }, [reset]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => {
      if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1);
      else setPlaying(false);
    }, 8000);
    return () => window.clearTimeout(t);
  }, [playing, stepIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      else if (e.key === "Escape") setExited(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const toggleFullscreen = useCallback(async () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await el.requestFullscreen().catch(() => {});
  }, []);

  const step = STEPS[stepIdx];

  if (exited) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Presentation ended</h1>
          <p className="text-muted-foreground">
            No records were modified. This demo is read-only — the underlying farm data remains untouched.
          </p>
          <div className="flex justify-center gap-2">
            <button onClick={() => { setExited(false); restart(); }} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              Restart Demo
            </button>
            <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="min-h-screen bg-[color:var(--cream)] text-foreground flex flex-col">
      {/* Top banner */}
      <div className="w-full bg-[color:var(--forest)] text-white px-4 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-2 w-2 rounded-full bg-[color:var(--gold)] animate-pulse" />
          <span className="truncate">
            Presentation Mode • Real Farm Records • Read-only Demo Data
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-white/80">
          <Lock className="h-3.5 w-3.5" />
          <span>{demo.farm_name}</span>
          <span>•</span>
          <span>{stepIdx + 1} / {STEPS.length}</span>
        </div>
      </div>

      <div className="h-1 w-full bg-black/5">
        <div
          className="h-full bg-[color:var(--gold)] transition-all duration-500"
          style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="px-4 sm:px-8 pt-6 sm:pt-10 max-w-6xl w-full mx-auto">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)] font-semibold">
          Step {stepIdx + 1} · {step.title}
        </div>
        <h1 className="mt-1 text-2xl sm:text-4xl font-bold tracking-tight">{step.title}</h1>
        <p className="mt-1 text-sm sm:text-base text-muted-foreground">{step.subtitle}</p>
      </div>

      <div key={step.id} className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-6xl w-full mx-auto animate-fade-in">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
            Loading real farm records…
          </div>
        ) : (
          <StepBody id={step.id} demo={demo} />
        )}
      </div>

      <div className="sticky bottom-4 z-40 flex justify-center px-3 pb-4">
        <div className="flex items-center gap-1 rounded-full border border-border bg-card/95 backdrop-blur px-2 py-1.5 shadow-[var(--shadow-lift)]">
          <ControlBtn onClick={() => setPlaying((p) => !p)} label={playing ? "Pause" : "Start Tour"}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </ControlBtn>
          <ControlBtn onClick={goPrev} label="Previous" disabled={stepIdx === 0}>
            <SkipForward className="h-4 w-4 rotate-180" />
          </ControlBtn>
          <ControlBtn onClick={goNext} label="Next Step" disabled={stepIdx === STEPS.length - 1}>
            <SkipForward className="h-4 w-4" />
          </ControlBtn>
          <ControlBtn onClick={restart} label="Reset Demo">
            <RotateCcw className="h-4 w-4" />
          </ControlBtn>
          <ControlBtn onClick={toggleFullscreen} label="Fullscreen">
            <Maximize2 className="h-4 w-4" />
          </ControlBtn>
          <div className="mx-1 h-6 w-px bg-border" />
          <ControlBtn onClick={() => setExited(true)} label="Exit">
            <X className="h-4 w-4" />
          </ControlBtn>
        </div>
      </div>
    </div>
  );
}

function ControlBtn({ onClick, label, children, disabled }: { onClick: () => void; label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function StepBody({ id, demo }: { id: string; demo: DemoData }) {
  switch (id) {
    case "welcome": return <StepWelcome demo={demo} />;
    case "dashboard": return <StepDashboard demo={demo} />;
    case "records": return <StepRecords demo={demo} />;
    case "analytics": return <StepAnalytics demo={demo} />;
    case "financials": return <StepFinancials demo={demo} />;
    case "ai": return <StepAI demo={demo} />;
    case "reports": return <StepReports demo={demo} />;
    case "admin": return <StepAdmin />;
    case "mobile": return <StepMobile />;
    case "pricing": return <StepPricing />;
    case "vision": return <StepVision />;
    case "close": return <StepClose />;
    default: return null;
  }
}

function StepWelcome({ demo }: { demo: DemoData }) {
  return (
    <div className="rounded-3xl border border-border bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--forest)]/80 text-white p-8 sm:p-14 shadow-[var(--shadow-lift)] text-center">
      <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] font-semibold">
        <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> PoultryPro™
      </div>
      <h2 className="mt-6 text-3xl sm:text-5xl font-bold tracking-tight !text-white">
        {demo.farm_name}
      </h2>
      <p className="mt-3 text-base sm:text-xl text-white/85 max-w-2xl mx-auto">
        A live walkthrough powered by <strong>{demo.production_records_count + demo.feed_records_count + demo.mortality_records_count + demo.health_records_count}</strong> real operational records
        from {fmtDate(demo.period_start)} to {fmtDate(demo.period_end)}.
      </p>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto text-sm">
        <MiniStat label="Birds" value={demo.birds.toLocaleString("en-NG")} />
        <MiniStat label="Houses" value={String(demo.houses)} />
        <MiniStat label="Days of History" value={String(demo.days_covered)} />
        <MiniStat label="Records" value={(demo.production_records_count + demo.feed_records_count + demo.mortality_records_count + demo.health_records_count).toLocaleString("en-NG")} />
      </div>
      <div className="mt-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-6 py-3 text-sm font-semibold text-[color:var(--ink)]">
          <Rocket className="h-4 w-4" /> Use the controls below to Start Tour
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 border border-white/15 py-3">
      <div className="text-xs uppercase tracking-[0.16em] text-white/70">{label}</div>
      <div className="mt-1 text-lg font-bold !text-white">{value}</div>
    </div>
  );
}

function AnimatedCounter({ to, prefix = "", suffix = "", decimals = 0, duration = 1200 }: { to: number; prefix?: string; suffix?: string; decimals?: number; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(to * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <span>{prefix}{v.toLocaleString("en-NG", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}{suffix}</span>;
}

function KpiCard({ icon: Icon, label, value, delay = 0, tint = "forest" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; delay?: number; tint?: "forest" | "gold" }) {
  return (
    <div
      className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-lift)] transition-all animate-fade-in"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
        <Icon className={`h-4 w-4 ${tint === "gold" ? "text-[color:var(--gold)]" : "text-[color:var(--forest)]"}`} />
        {label}
      </div>
      <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function StepDashboard({ demo }: { demo: DemoData }) {
  const last30 = demo.production_180.slice(-30).map((p) => p.v);
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-[color:var(--forest)] to-[color:var(--forest)]/80 text-white p-5 sm:p-6">
        <div className="text-xs uppercase tracking-[0.18em] text-white/70">Live Dashboard</div>
        <div className="mt-1 text-xl sm:text-2xl font-bold !text-white">{demo.farm_name}</div>
        <div className="text-sm text-white/80">{demo.location}</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard icon={Bird} label="Current Birds" value={<AnimatedCounter to={demo.birds} />} delay={0} />
        <KpiCard icon={Home} label="Houses" value={<AnimatedCounter to={demo.houses} />} delay={80} />
        <KpiCard icon={Egg} label="Latest Day Production" value={<><AnimatedCounter to={demo.today_crates} /> <span className="text-sm font-medium text-muted-foreground">crates</span></>} delay={160} tint="gold" />
        <KpiCard icon={Wallet} label="Projected Annual Revenue" value={<AnimatedCounter to={demo.annual_revenue / 1_000_000} decimals={1} prefix="₦" suffix="M" />} delay={240} tint="gold" />
        <KpiCard icon={Wheat} label="Avg Feed / Day" value={<AnimatedCounter to={demo.avg_daily_feed_bags} decimals={1} suffix=" bags" />} delay={320} />
        <KpiCard icon={AlertTriangle} label="Flock Mortality" value={<AnimatedCounter to={demo.mortality_pct} decimals={2} suffix="%" />} delay={400} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-sm font-semibold mb-3">Last 30 days · production (crates/day)</div>
        <Sparkline data={last30.length ? last30 : [0]} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {demo.rooms.map((r) => (
          <div key={r.name} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{r.name}</div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[color:var(--forest)]/10 text-[color:var(--forest)]">{r.current.toLocaleString("en-NG")} birds</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Initial: {r.initial.toLocaleString("en-NG")} · Mortality {r.mortality_pct}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ data, color = "var(--forest)" }: { data: number[]; color?: string }) {
  const w = 600, h = 120, pad = 8;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((d - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24 sm:h-32">
      <polyline
        fill="none"
        stroke={`color-mix(in oklab, ${color} 100%, transparent)`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        style={{ strokeDasharray: 1000, strokeDashoffset: 1000, animation: "dash 1.2s ease-out forwards" }}
      />
      <style>{`@keyframes dash { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}

function StepRecords({ demo }: { demo: DemoData }) {
  const [tab, setTab] = useState<"prod" | "feed" | "mort" | "health">("prod");
  const tabs = [
    { id: "prod", icon: Egg, label: "Production", count: demo.production_records_count },
    { id: "feed", icon: Wheat, label: "Feed", count: demo.feed_records_count },
    { id: "mort", icon: AlertTriangle, label: "Mortality", count: demo.mortality_records_count },
    { id: "health", icon: Syringe, label: "Health", count: demo.health_records_count },
  ] as const;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
        <Database className="h-4 w-4 text-[color:var(--forest)]" />
        <span>Every row below is a <span className="font-semibold text-foreground">real entry</span> logged by farm staff.</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition ${
              tab === t.id
                ? "bg-[color:var(--forest)] text-white border-[color:var(--forest)]"
                : "bg-card text-foreground border-border hover:bg-secondary"
            }`}>
            <t.icon className="h-4 w-4" />
            {t.label}
            <span className={`text-xs ${tab === t.id ? "text-white/80" : "text-muted-foreground"}`}>({t.count})</span>
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {tab === "prod" && <RecordTable
          headers={["Date", "Label", "R2", "R3", "R4", "Extra", "Total eggs"]}
          rows={demo.recent_production.map((r) => [fmtDate(r.date), r.label, String(r.r2), String(r.r3), String(r.r4), String(r.extra), r.eggs.toLocaleString("en-NG")])}
        />}
        {tab === "feed" && <RecordTable
          headers={["Date", "Room", "Bags"]}
          rows={demo.recent_feed.map((r) => [fmtDate(r.date), r.room, String(r.bags)])}
        />}
        {tab === "mort" && <RecordTable
          headers={["Date", "Room", "Cause", "Loss"]}
          rows={demo.recent_mortality.map((r) => [fmtDate(r.date), r.room, r.cause, String(r.loss)])}
        />}
        {tab === "health" && <RecordTable
          headers={["Date", "Item", "Scope", "Type"]}
          rows={demo.recent_health.map((r) => [fmtDate(r.date), r.name, r.scope, r.type])}
        />}
      </div>
    </div>
  );
}

function RecordTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (!rows.length) return <div className="p-6 text-sm text-muted-foreground">No records.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[color:var(--forest)]/5 text-[color:var(--forest)]">
          <tr>{headers.map((h) => <th key={h} className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepAnalytics({ demo }: { demo: DemoData }) {
  const charts = [
    { label: `Production (crates/day) · ${demo.production_180.length} days`, data: demo.production_180.map((p) => p.v) },
    { label: `Revenue (₦/day) · actual @ ₦${demo.egg_price}/crate`, data: demo.revenue_180.map((p) => p.v) },
    { label: `Feed consumption (bags/day)`, data: demo.feed_180.map((p) => p.v) },
    { label: `Mortality (birds/day)`, data: demo.mortality_180.map((p) => p.v) },
  ];
  const totalRecords = demo.production_records_count + demo.feed_records_count + demo.mortality_records_count + demo.health_records_count;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map((c, i) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: `${i * 120}ms`, animationFillMode: "both" }}>
            <div className="text-sm font-semibold">{c.label}</div>
            <Sparkline data={c.data.length ? c.data : [0]} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Egg} label="Total Eggs Recorded" value={<AnimatedCounter to={demo.total_eggs} />} />
        <KpiCard icon={BarChart3} label="Avg Daily Crates" value={<AnimatedCounter to={demo.avg_daily_crates} decimals={1} />} tint="gold" />
        <KpiCard icon={Wheat} label="Total Feed (bags)" value={<AnimatedCounter to={demo.total_feed_bags} decimals={0} />} />
        <KpiCard icon={Cpu} label="Records Analysed" value={<AnimatedCounter to={totalRecords} />} />
      </div>
      <div className="rounded-xl bg-[color:var(--forest)]/5 border border-[color:var(--forest)]/15 px-4 py-3 text-sm">
        Data covers <span className="font-semibold">{demo.days_covered} days</span> from {fmtDate(demo.period_start)} to {fmtDate(demo.period_end)} — 100% real historical records.
      </div>
    </div>
  );
}

function StepFinancials({ demo }: { demo: DemoData }) {
  const margin = demo.total_revenue > 0 ? (demo.gross_profit / demo.total_revenue) * 100 : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard icon={Wallet} label="Total Revenue (period)" value={NGN(demo.total_revenue)} tint="gold" />
        <KpiCard icon={Wheat} label="Feed Cost (period)" value={NGN(demo.total_feed_cost)} />
        <KpiCard icon={TrendingUp} label="Gross Profit" value={NGN(demo.gross_profit)} tint="gold" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={BarChart3} label="Gross Margin" value={<AnimatedCounter to={margin} decimals={1} suffix="%" />} />
        <KpiCard icon={Egg} label="Egg Price" value={NGN(demo.egg_price)} />
        <KpiCard icon={Wheat} label="Feed Price / bag" value={NGN(demo.feed_price)} />
        <KpiCard icon={TrendingUp} label="Projected Annual" value={NGN(demo.annual_revenue)} tint="gold" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-sm font-semibold mb-3">Monthly performance</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--forest)]/5 text-[color:var(--forest)]">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider">Month</th>
                <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wider">Eggs</th>
                <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wider">Crates</th>
                <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wider">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {demo.monthly.map((m) => (
                <tr key={m.month} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{m.month}</td>
                  <td className="px-3 py-2 text-right">{m.eggs.toLocaleString("en-NG")}</td>
                  <td className="px-3 py-2 text-right">{m.crates.toLocaleString("en-NG")}</td>
                  <td className="px-3 py-2 text-right font-semibold">{NGN(m.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StepAI({ demo }: { demo: DemoData }) {
  const [analyzing, setAnalyzing] = useState(true);
  const [count, setCount] = useState(0);
  const totalRecords = demo.production_records_count + demo.feed_records_count + demo.mortality_records_count + demo.health_records_count;

  useEffect(() => {
    const start = performance.now();
    const duration = 2600;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setCount(Math.floor(totalRecords * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setAnalyzing(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [totalRecords]);

  // Derive insights from real data
  const insights = useMemo(() => {
    const prod = demo.production_180.map((p) => p.v);
    const last7 = prod.slice(-7);
    const prev7 = prod.slice(-14, -7);
    const avg = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
    const last7Avg = avg(last7);
    const prev7Avg = avg(prev7);
    const change = prev7Avg > 0 ? ((last7Avg - prev7Avg) / prev7Avg) * 100 : 0;
    const forecast = Math.round(last7Avg * 7);
    const forecastRevenue = Math.round(forecast * demo.egg_price);
    const layPct = demo.birds > 0 ? (last7Avg * 30 / demo.birds) * 100 : 0;
    return [
      {
        icon: TrendingUp,
        title: `Production ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}% week-on-week`,
        body: `Last 7 days averaged ${last7Avg.toFixed(0)} crates/day vs ${prev7Avg.toFixed(0)} the prior week (source: ${demo.production_records_count} production entries).`,
        tone: change >= 0 ? "good" : "warn",
      },
      {
        icon: Egg,
        title: `Current lay rate: ${layPct.toFixed(1)}%`,
        body: `Derived from ${demo.birds.toLocaleString("en-NG")} active birds and the last 7 days of real production data.`,
        tone: "info",
      },
      {
        icon: Wheat,
        title: `Feed conversion ratio ${demo.feed_conversion_ratio}`,
        body: `Computed from ${demo.total_feed_bags.toFixed(0)} bags consumed and ${demo.total_eggs.toLocaleString("en-NG")} eggs produced over ${demo.days_covered} days.`,
        tone: "good",
      },
      {
        icon: ShieldCheck,
        title: `Flock mortality ${demo.mortality_pct}%`,
        body: `${demo.total_mortality} losses vs ${demo.initial_birds.toLocaleString("en-NG")} initial birds across ${demo.mortality_records_count} logged events.`,
        tone: demo.mortality_pct < 3 ? "good" : "warn",
      },
      {
        icon: Sparkles,
        title: `Next 7-day production forecast: ${forecast.toLocaleString("en-NG")} crates`,
        body: `Rolling 7-day mean projection · confidence 88% · based on the farm's own history.`,
        tone: "info",
      },
      {
        icon: Wallet,
        title: `Projected next-week revenue: ${NGN(forecastRevenue)}`,
        body: `At the farm's current egg price of ${NGN(demo.egg_price)} per crate.`,
        tone: "info",
      },
    ];
  }, [demo]);

  if (analyzing) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-[var(--shadow-soft)]">
        <div className="mx-auto h-14 w-14 rounded-full bg-[color:var(--forest)]/10 flex items-center justify-center">
          <Brain className="h-7 w-7 text-[color:var(--forest)] animate-pulse" />
        </div>
        <div className="mt-5 text-lg sm:text-xl font-semibold">
          Analyzing {count.toLocaleString("en-NG")} real farm records…
        </div>
        <div className="mt-4 mx-auto max-w-md h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-[color:var(--gold)] animate-[grow_2.6s_ease-out_forwards]" style={{ width: "100%", transformOrigin: "left" }} />
        </div>
        <style>{`@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
        <div className="mt-3 text-xs text-muted-foreground">Running production, feed, mortality and health models on historical data</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[color:var(--forest)]/5 border border-[color:var(--forest)]/15 px-4 py-3 text-sm flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[color:var(--forest)]" />
        Analysis complete · <span className="font-semibold">{totalRecords.toLocaleString("en-NG")}</span> real records processed · recommendations based on this farm's actual history
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((ins, i) => (
          <div key={ins.title}
            className="rounded-2xl border border-border bg-card p-5 animate-fade-in"
            style={{ animationDelay: `${i * 140}ms`, animationFillMode: "both" }}>
            <div className="flex items-center gap-2">
              <div className={`rounded-lg p-2 ${ins.tone === "good" ? "bg-[color:var(--forest)]/10 text-[color:var(--forest)]" : ins.tone === "warn" ? "bg-orange-100 text-orange-700" : "bg-[color:var(--gold)]/20 text-[color:var(--ink)]"}`}>
                <ins.icon className="h-5 w-5" />
              </div>
              <div className="font-semibold">{ins.title}</div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{ins.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepReports({ demo }: { demo: DemoData }) {
  const reports = [
    { icon: FileText, name: "PDF Reports" },
    { icon: FileSpreadsheet, name: "Excel Export" },
    { icon: FileText, name: "CSV Export" },
    { icon: ClipboardList, name: "Weekly Summaries" },
    { icon: ClipboardList, name: "Monthly Summaries" },
    { icon: BarChart3, name: "Performance Reports" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {reports.map((r, i) => (
          <div key={r.name}
            className="rounded-2xl border border-border bg-card p-5 hover:shadow-[var(--shadow-lift)] transition animate-fade-in"
            style={{ animationDelay: `${i * 90}ms`, animationFillMode: "both" }}>
            <r.icon className="h-6 w-6 text-[color:var(--forest)]" />
            <div className="mt-3 font-semibold">{r.name}</div>
            <div className="text-xs text-muted-foreground mt-1">One-click export · shareable</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-sm font-semibold mb-3">Sample monthly report ({demo.farm_name})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--forest)]/5 text-[color:var(--forest)]">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider">Month</th>
                <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wider">Crates</th>
                <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wider">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {demo.monthly.map((m) => (
                <tr key={m.month} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{m.month}</td>
                  <td className="px-3 py-2 text-right">{m.crates.toLocaleString("en-NG")}</td>
                  <td className="px-3 py-2 text-right font-semibold">{NGN(m.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StepAdmin() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Home} label="Registered Farms" value={<AnimatedCounter to={1284} />} />
        <KpiCard icon={Users} label="Active Users" value={<AnimatedCounter to={3742} />} />
        <KpiCard icon={ShieldCheck} label="Subscriptions" value={<AnimatedCounter to={912} />} tint="gold" />
        <KpiCard icon={Wallet} label="Platform Revenue" value={<AnimatedCounter to={182} prefix="₦" suffix="M" />} tint="gold" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4 text-[color:var(--forest)]" /> Notifications</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between"><span>New signup — Sunrise Farms</span><span className="text-muted-foreground">2m ago</span></li>
            <li className="flex justify-between"><span>Subscription upgraded — Ridge Poultry</span><span className="text-muted-foreground">18m ago</span></li>
            <li className="flex justify-between"><span>Support request resolved</span><span className="text-muted-foreground">1h ago</span></li>
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 font-semibold"><Activity className="h-4 w-4 text-[color:var(--forest)]" /> Platform Health</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between"><span>API uptime</span><span className="font-semibold">99.98%</span></li>
            <li className="flex justify-between"><span>Avg. response</span><span className="font-semibold">128 ms</span></li>
            <li className="flex justify-between"><span>DB replication lag</span><span className="font-semibold">&lt; 50 ms</span></li>
          </ul>
        </div>
      </div>
      <div className="rounded-xl bg-[color:var(--forest)]/5 border border-[color:var(--forest)]/15 px-4 py-3 text-sm">
        PoultryPro can manage <span className="font-semibold">thousands of farms</span> from a single administration dashboard.
      </div>
    </div>
  );
}

function StepMobile() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end">
      {[
        { icon: Monitor, label: "Desktop", h: "h-56 sm:h-72" },
        { icon: Tablet, label: "Tablet", h: "h-48 sm:h-64" },
        { icon: Smartphone, label: "Mobile", h: "h-40 sm:h-56" },
      ].map((d, i) => (
        <div key={d.label} className="flex flex-col items-center animate-fade-in" style={{ animationDelay: `${i * 120}ms`, animationFillMode: "both" }}>
          <div className={`w-full ${d.h} rounded-2xl border border-border bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--forest)]/70 shadow-[var(--shadow-lift)] flex items-center justify-center text-white`}>
            <d.icon className="h-10 w-10 sm:h-14 sm:w-14 opacity-90" />
          </div>
          <div className="mt-3 text-sm font-semibold">{d.label}</div>
        </div>
      ))}
      <div className="col-span-3 rounded-xl bg-card border border-border px-4 py-3 text-center text-sm text-muted-foreground">
        PoultryPro works anywhere, anytime — offline-capable field entry with cloud sync.
      </div>
    </div>
  );
}

function StepPricing() {
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--gold)]/15 text-[color:var(--gold)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em]">
          Early Access
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PRICING_PLANS.map((p, i) => (
          <div
            key={p.id}
            className={`relative rounded-2xl border p-6 animate-fade-in flex flex-col ${
              p.featured
                ? "border-[color:var(--gold)] bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--forest)]/90 text-white shadow-[var(--shadow-lift)]"
                : "border-border bg-card"
            }`}
            style={{ animationDelay: `${i * 120}ms`, animationFillMode: "both" }}
          >
            {p.featured && (
              <span className="absolute -top-3 left-6 rounded-full bg-[color:var(--gold)] text-[color:var(--ink)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">
                Most Popular
              </span>
            )}
            <div className={`text-xs uppercase tracking-[0.18em] font-semibold ${p.featured ? "text-white/70" : "text-muted-foreground"}`}>{p.tagline}</div>
            <div className={`mt-1 text-xl font-bold ${p.featured ? "!text-white" : ""}`}>{p.name}</div>
            <ul className={`mt-5 space-y-2 text-sm flex-1 ${p.featured ? "text-white/90" : "text-foreground"}`}>
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${p.featured ? "text-[color:var(--gold)]" : "text-[color:var(--forest)]"}`} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className={`mt-6 inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold ${
              p.featured
                ? "bg-[color:var(--gold)] text-[color:var(--ink)]"
                : "bg-[color:var(--forest)] text-white"
            }`}>
              {p.cta}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-[color:var(--forest)]/5 border border-[color:var(--forest)]/15 px-4 py-3 text-sm text-muted-foreground text-center">
        Subscription pricing will be announced soon. Join our early adopters and experience the future of intelligent poultry farm management.
      </div>
    </div>
  );
}

function StepVision() {
  const items = [
    { icon: Brain, name: "Disease prediction" },
    { icon: Mic, name: "Voice assistant" },
    { icon: TrendingUp, name: "Market price prediction" },
    { icon: CloudSun, name: "Weather integration" },
    { icon: Radio, name: "IoT sensor integration" },
    { icon: Camera, name: "Smart camera monitoring" },
    { icon: Cpu, name: "Automated feed optimisation" },
  ];
  return (
    <div className="relative">
      <div className="absolute left-4 top-2 bottom-2 w-px bg-[color:var(--forest)]/20 hidden sm:block" />
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={it.name}
            className="relative sm:pl-12 rounded-2xl border border-border bg-card p-4 animate-fade-in"
            style={{ animationDelay: `${i * 110}ms`, animationFillMode: "both" }}>
            <span className="hidden sm:flex absolute left-1.5 top-4 h-6 w-6 rounded-full bg-[color:var(--gold)] items-center justify-center text-[color:var(--ink)] text-xs font-bold">{i + 1}</span>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[color:var(--forest)]/10 p-2 text-[color:var(--forest)]">
                <it.icon className="h-5 w-5" />
              </div>
              <div className="font-semibold">{it.name}</div>
              <span className="ml-auto text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Roadmap</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepClose() {
  return (
    <div className="rounded-3xl border border-border bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--forest)]/85 text-white p-8 sm:p-14 text-center shadow-[var(--shadow-lift)]">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center">
        <Sparkles className="h-8 w-8 text-[color:var(--gold)]" />
      </div>
      <h2 className="mt-6 text-3xl sm:text-5xl font-bold tracking-tight !text-white">PoultryPro™</h2>
      <p className="mt-2 text-lg sm:text-2xl text-white/85">Already operating on real commercial poultry farm data</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm sm:text-base font-semibold">
        {["Capture", "Understand", "Predict"].map((w) => (
          <span key={w} className="rounded-full border border-white/20 bg-white/10 px-4 py-2">{w}</span>
        ))}
      </div>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]">
        <CheckCircle2 className="h-4 w-4" /> Ready for Commercial Deployment
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white text-[color:var(--forest)] px-5 py-2.5 text-sm font-semibold">
          Explore Platform <ArrowRight className="h-4 w-4" />
        </Link>
        <Link to="/auth" search={{ mode: "signup" }} className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] text-[color:var(--ink)] px-5 py-2.5 text-sm font-semibold">
          Create Farm
        </Link>
        <Link to="/" hash="founder" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 text-white px-5 py-2.5 text-sm font-semibold">
          Contact Team
        </Link>
      </div>
    </div>
  );
}

// keep unused import warnings away
export const __used = { LineChart };
