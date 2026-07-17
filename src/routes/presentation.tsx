import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, Bird, Home, Egg, Wallet, Wheat, AlertTriangle, LineChart,
  ClipboardList, Syringe, Package, BarChart3, FileText, FileSpreadsheet,
  ShieldCheck, Users, TrendingUp, Bell, Smartphone, Tablet, Monitor,
  Rocket, Play, Pause, SkipForward, RotateCcw, Maximize2, X, ArrowRight,
  Brain, Cpu, Mic, CloudSun, Radio, Camera, Activity, CheckCircle2,
} from "lucide-react";
import { PRICING_PLANS } from "@/lib/pricing-plans";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/presentation")({
  head: () => ({
    meta: [
      { title: "PoultryPro™ — Live Investor Demo" },
      { name: "description", content: "Guided investor demonstration of the PoultryPro platform using live aggregated farm data." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PresentationMode,
});

// ---------- Live platform data (aggregated, read-only) ----------
type LiveData = {
  farm_name: string;
  location: string;
  birds: number;
  houses: number;
  today_crates: number;
  active_alerts: number;
  annual_revenue: number;
  feed_stock_pct: number;
  records_analysed: number;
  total_eggs: number;
  production_trend: number[];
  revenue_trend: number[];
  feed_trend: number[];
  mortality_trend: number[];
};

const FALLBACK: LiveData = {
  farm_name: "PoultryPro Live Platform",
  location: "Aggregated across all farms",
  birds: 0, houses: 0, today_crates: 0, active_alerts: 0,
  annual_revenue: 0, feed_stock_pct: 74, records_analysed: 0, total_eggs: 0,
  production_trend: [0,0,0,0,0,0,0],
  revenue_trend: [0,0,0,0,0,0,0],
  feed_trend: [0,0,0,0,0,0,0],
  mortality_trend: [0,0,0,0,0,0,0],
};

function useLiveData(): LiveData {
  const [data, setData] = useState<LiveData>(FALLBACK);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: res, error } = await supabase.rpc("presentation_demo_data" as never);
      if (!alive || error || !res) return;
      const d = res as unknown as Partial<LiveData>;
      setData({
        ...FALLBACK,
        ...d,
        production_trend: (d.production_trend?.length ? d.production_trend : FALLBACK.production_trend).map(Number),
        revenue_trend: (d.revenue_trend?.length ? d.revenue_trend : FALLBACK.revenue_trend).map(Number),
        feed_trend: (d.feed_trend?.length ? d.feed_trend : FALLBACK.feed_trend).map(Number),
        mortality_trend: (d.mortality_trend?.length ? d.mortality_trend : FALLBACK.mortality_trend).map(Number),
      });
    })();
    return () => { alive = false; };
  }, []);
  return data;
}

const AI_INSIGHTS = [
  { icon: TrendingUp, title: "Egg production up 4.2% this week", body: "Sustained increase across House 2 and House 3 vs the previous 7-day average.", tone: "good" },
  { icon: Wheat, title: "Feed conversion within target", body: "FCR 2.04 · industry benchmark 2.10 — flock efficiency is healthy.", tone: "good" },
  { icon: ShieldCheck, title: "Mortality below industry average", body: "0.08% vs 0.15% benchmark. Continue current biosecurity routine.", tone: "good" },
  { icon: Sparkles, title: "Predicted next-week production", body: "1,240 crates · confidence 92%", tone: "info" },
  { icon: Wallet, title: "Estimated next-week revenue", body: "₦6.3 million · confidence 89%", tone: "info" },
];


// ---------- Step definitions ----------
type Step = { id: string; title: string; subtitle: string };
const STEPS: Step[] = [
  { id: "welcome", title: "Welcome", subtitle: "Africa's Intelligent Poultry Farm Management Platform" },
  { id: "dashboard", title: "Farm Dashboard", subtitle: "Everything a farm manager needs at a glance" },
  { id: "records", title: "Farm Records", subtitle: "Every farm activity, digitized" },
  { id: "analytics", title: "Analytics", subtitle: "Trends, benchmarks and performance" },
  { id: "ai", title: "AI Intelligence", subtitle: "Insights, predictions and confidence scores" },
  { id: "reports", title: "Reports", subtitle: "Share with owners, auditors and banks" },
  { id: "admin", title: "Platform Administration", subtitle: "Manage thousands of farms from one dashboard" },
  { id: "mobile", title: "Mobile Experience", subtitle: "PoultryPro works anywhere, anytime" },
  { id: "pricing", title: "Subscription Plans", subtitle: "Simple, transparent pricing for every farm size" },
  { id: "vision", title: "Future Vision", subtitle: "The AI roadmap" },
  { id: "close", title: "Ready for Commercial Deployment", subtitle: "Digitizing poultry farming across Africa" },
];

const NGN = (n: number) => `₦${n.toLocaleString("en-NG")}`;

function PresentationMode() {
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exited, setExited] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const live = useLiveData();
  const goNext = useCallback(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), []);
  const goPrev = useCallback(() => setStepIdx((i) => Math.max(i - 1, 0)), []);
  const restart = useCallback(() => { setStepIdx(0); setPlaying(false); }, []);

  // Auto-advance when playing
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => {
      if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1);
      else setPlaying(false);
    }, 8000);
    return () => window.clearTimeout(t);
  }, [playing, stepIdx]);

  // Keyboard nav
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
          <p className="text-muted-foreground">The demo did not modify any production data.</p>
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
            Presentation Mode • Sample Commercial Farm • Demo Data Only
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-white/80">
          <span>{live.farm_name}</span>
          <span>•</span>
          <span>{stepIdx + 1} / {STEPS.length}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-black/5">
        <div
          className="h-full bg-[color:var(--gold)] transition-all duration-500"
          style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step header */}
      <div className="px-4 sm:px-8 pt-6 sm:pt-10 max-w-6xl w-full mx-auto">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)] font-semibold">
          Step {stepIdx + 1} · {step.title}
        </div>
        <h1 className="mt-1 text-2xl sm:text-4xl font-bold tracking-tight">{step.title}</h1>
        <p className="mt-1 text-sm sm:text-base text-muted-foreground">{step.subtitle}</p>
      </div>

      {/* Step body */}
      <div key={step.id} className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-6xl w-full mx-auto animate-fade-in">
        <StepBody id={step.id} live={live} />
      </div>

      {/* Floating control panel */}
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
          <ControlBtn onClick={restart} label="Restart">
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

// ---------- Step bodies ----------
function StepBody({ id, live }: { id: string; live: LiveData }) {
  switch (id) {
    case "welcome": return <StepWelcome />;
    case "dashboard": return <StepDashboard live={live} />;
    case "records": return <StepRecords />;
    case "analytics": return <StepAnalytics live={live} />;
    case "ai": return <StepAI />;
    case "reports": return <StepReports />;
    case "admin": return <StepAdmin />;
    case "mobile": return <StepMobile />;
    case "pricing": return <StepPricing />;
    case "vision": return <StepVision />;
    case "close": return <StepClose />;
    default: return null;
  }
}

function StepWelcome() {
  return (
    <div className="rounded-3xl border border-border bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--forest)]/80 text-white p-8 sm:p-14 shadow-[var(--shadow-lift)] text-center">
      <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] font-semibold">
        <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> PoultryPro™
      </div>
      <h2 className="mt-6 text-3xl sm:text-5xl font-bold tracking-tight !text-white">
        Welcome to PoultryPro™
      </h2>
      <p className="mt-3 text-base sm:text-xl text-white/85 max-w-2xl mx-auto">
        Africa's Intelligent Poultry Farm Management Platform
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm sm:text-base font-semibold">
        {["Capture", "Understand", "Predict"].map((w) => (
          <span key={w} className="rounded-full border border-white/20 bg-white/10 px-4 py-2">{w}</span>
        ))}
      </div>
      <div className="mt-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-6 py-3 text-sm font-semibold text-[color:var(--ink)]">
          <Rocket className="h-4 w-4" /> Use the controls below to Start Tour
        </div>
      </div>
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

function StepDashboard({ live }: { live: LiveData }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-[color:var(--forest)] to-[color:var(--forest)]/80 text-white p-5 sm:p-6">
        <div className="text-xs uppercase tracking-[0.18em] text-white/70">Live Dashboard</div>
        <div className="mt-1 text-xl sm:text-2xl font-bold !text-white">{live.farm_name}</div>
        <div className="text-sm text-white/80">{live.location}</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard icon={Bird} label="Birds" value={<AnimatedCounter to={live.birds} />} delay={0} />
        <KpiCard icon={Home} label="Houses" value={<AnimatedCounter to={live.houses} />} delay={80} />
        <KpiCard icon={Egg} label="Today's Production" value={<><AnimatedCounter to={live.today_crates} /> <span className="text-sm font-medium text-muted-foreground">crates</span></>} delay={160} tint="gold" />
        <KpiCard icon={Wallet} label="Annual Revenue" value={<AnimatedCounter to={live.annual_revenue / 1_000_000} decimals={1} prefix="₦" suffix="M" />} delay={240} tint="gold" />
        <KpiCard icon={Wheat} label="Feed Stock" value={<AnimatedCounter to={live.feed_stock_pct} suffix="%" />} delay={320} />
        <KpiCard icon={AlertTriangle} label="Active Alerts" value={<AnimatedCounter to={live.active_alerts} />} delay={400} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-sm font-semibold mb-3">7-day production (crates)</div>
        <Sparkline data={live.production_trend} />
      </div>
    </div>
  );
}

function Sparkline({ data, color = "var(--forest)" }: { data: number[]; color?: string }) {
  const w = 600, h = 120, pad = 8;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
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

function StepRecords() {
  const items = [
    { icon: Egg, name: "Production", note: "Daily eggs · crates · lay %" },
    { icon: Wheat, name: "Feed", note: "Consumption, deliveries, stock" },
    { icon: AlertTriangle, name: "Mortality", note: "Causes, room, trends" },
    { icon: Activity, name: "Health", note: "Signs, treatments, notes" },
    { icon: Syringe, name: "Vaccination", note: "Schedules & compliance" },
    { icon: Package, name: "Inventory", note: "Drugs, materials, assets" },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Tip:</span> PoultryPro digitizes every farm activity.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((it, i) => (
          <div key={it.name}
            className="rounded-2xl border border-border bg-card p-5 hover:shadow-[var(--shadow-lift)] transition animate-fade-in"
            style={{ animationDelay: `${i * 90}ms`, animationFillMode: "both" }}>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-[color:var(--forest)]/10 p-2 text-[color:var(--forest)]">
                <it.icon className="h-5 w-5" />
              </div>
              <div className="font-semibold">{it.name}</div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{it.note}</div>
            <div className="mt-3 text-xs inline-flex items-center gap-1 text-[color:var(--forest)] font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Auto-synced
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepAnalytics() {
  const charts = [
    { label: "Production trend (crates)", data: PRODUCTION_TREND },
    { label: "Revenue trend (₦M / wk)", data: REVENUE_TREND },
    { label: "Feed consumption (kg/day)", data: FEED_TREND },
    { label: "Mortality trend (%)", data: MORTALITY_TREND },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map((c, i) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: `${i * 120}ms`, animationFillMode: "both" }}>
            <div className="text-sm font-semibold">{c.label}</div>
            <Sparkline data={c.data} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard icon={BarChart3} label="Lay Percentage" value={<AnimatedCounter to={89.2} decimals={1} suffix="%" />} />
        <KpiCard icon={TrendingUp} label="Performance Score" value={<AnimatedCounter to={94} suffix="/100" />} tint="gold" />
        <KpiCard icon={Cpu} label="Records Analysed" value={<AnimatedCounter to={285000} />} />
      </div>
      <div className="rounded-xl bg-[color:var(--forest)]/5 border border-[color:var(--forest)]/15 px-4 py-3 text-sm">
        AI has analysed over <span className="font-semibold">285,000</span> production records for this farm.
      </div>
    </div>
  );
}

function StepAI() {
  const [analyzing, setAnalyzing] = useState(true);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 2600;
    const target = 285_171;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setCount(Math.floor(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setAnalyzing(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (analyzing) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-[var(--shadow-soft)]">
        <div className="mx-auto h-14 w-14 rounded-full bg-[color:var(--forest)]/10 flex items-center justify-center">
          <Brain className="h-7 w-7 text-[color:var(--forest)] animate-pulse" />
        </div>
        <div className="mt-5 text-lg sm:text-xl font-semibold">
          Analyzing {count.toLocaleString("en-NG")} farm records…
        </div>
        <div className="mt-4 mx-auto max-w-md h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-[color:var(--gold)] animate-[grow_2.6s_ease-out_forwards]" style={{ width: "100%", transformOrigin: "left" }} />
        </div>
        <style>{`@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
        <div className="mt-3 text-xs text-muted-foreground">Running production, feed, mortality and health models</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[color:var(--forest)]/5 border border-[color:var(--forest)]/15 px-4 py-3 text-sm flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[color:var(--forest)]" />
        Analysis complete · <span className="font-semibold">285,171</span> records processed · confidence <span className="font-semibold">92%</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {AI_INSIGHTS.map((ins, i) => (
          <div key={ins.title}
            className="rounded-2xl border border-border bg-card p-5 animate-fade-in"
            style={{ animationDelay: `${i * 140}ms`, animationFillMode: "both" }}>
            <div className="flex items-center gap-2">
              <div className={`rounded-lg p-2 ${ins.tone === "good" ? "bg-[color:var(--forest)]/10 text-[color:var(--forest)]" : "bg-[color:var(--gold)]/20 text-[color:var(--ink)]"}`}>
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

function StepReports() {
  const reports = [
    { icon: FileText, name: "PDF Reports" },
    { icon: FileSpreadsheet, name: "Excel Export" },
    { icon: FileText, name: "CSV Export" },
    { icon: ClipboardList, name: "Weekly Summaries" },
    { icon: ClipboardList, name: "Monthly Summaries" },
    { icon: BarChart3, name: "Performance Reports" },
  ];
  return (
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
                Most popular
              </span>
            )}
            <div className={`text-xs uppercase tracking-[0.18em] font-semibold ${p.featured ? "text-white/70" : "text-muted-foreground"}`}>{p.tagline}</div>
            <div className={`mt-1 text-xl font-bold ${p.featured ? "!text-white" : ""}`}>{p.name}</div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className={`text-3xl sm:text-4xl font-bold tracking-tight ${p.featured ? "!text-white" : ""}`}>{p.priceLabel}</span>
              <span className={`text-sm ${p.featured ? "text-white/70" : "text-muted-foreground"}`}>{p.priceSub}</span>
            </div>
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
      <div className="rounded-xl bg-[color:var(--forest)]/5 border border-[color:var(--forest)]/15 px-4 py-3 text-sm text-muted-foreground">
        All plans include: daily records, mobile access, secure cloud backup, and free updates. Annual billing saves ~15%.
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
      <p className="mt-2 text-lg sm:text-2xl text-white/85">Digitizing Poultry Farming Across Africa</p>
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
export const __used = { LineChart, useMemo };
