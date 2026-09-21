import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Bird, Brain,
  CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign, Clock3, Egg,
  HeartPulse, Home, Lightbulb, Lock, PackageOpen, RefreshCw, ShieldCheck,
  Sparkles, TrendingDown, TrendingUp, Wheat,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";
import heroAsset from "@/assets/hero-layer-birds.jpg.asset.json";

export const Route = createFileRoute("/presentation")({
  head: () => ({
    meta: [
      { title: "Live Farm Command Centre — PoultryPro™" },
      { name: "description", content: "Explore PoultryPro through a premium, read-only command-centre demonstration powered by real historical farm records." },
      { property: "og:title", content: "PoultryPro™ Live Farm Command Centre" },
      { property: "og:description", content: "A seven-stage interactive PoultryPro demonstration using real historical farm records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PresentationMode,
});

type Dated = { d: string };
type RoomRow = { name: string; current: number; initial: number; mortality_pct: number | null };
type ProductionPoint = Dated & { eggs: number; crates: number };
type RoomProductionPoint = Dated & { room: string; crates: number };
type FeedPoint = Dated & { bags: number; kg: number };
type MortalityPoint = Dated & { loss: number };
type FinancePoint = Dated & { revenue: number | null; feed_cost: number | null; other_expenses: number };
type HealthRow = { date: string; name: string; scope: string; type: string };
type ExpenseRow = { label: string; amount: number };

type DemoData = {
  farm_name: string;
  farm_type: string;
  location: string;
  period_start: string | null;
  period_end: string | null;
  days_covered: number;
  egg_price: number | null;
  feed_price: number | null;
  bag_weight_kg: number;
  birds: number;
  initial_birds: number;
  houses: number;
  total_eggs: number;
  total_crates: number;
  total_feed_bags: number;
  total_feed_kg: number;
  total_mortality: number;
  health_records_count: number;
  vaccination_records_count: number;
  production_records_count: number;
  feed_records_count: number;
  mortality_records_count: number;
  total_revenue: number | null;
  total_feed_cost: number | null;
  other_expenses: number;
  gross_profit: number | null;
  avg_daily_feed_bags: number | null;
  mortality_pct: number | null;
  stock_kg: number;
  stock_days_remaining: number | null;
  rooms: RoomRow[];
  production_daily: ProductionPoint[];
  room_production: RoomProductionPoint[];
  feed_daily: FeedPoint[];
  mortality_daily: MortalityPoint[];
  recent_health: HealthRow[];
  expense_breakdown: ExpenseRow[];
  finance_daily: FinancePoint[];
};

const EMPTY: DemoData = {
  farm_name: "ABZ Global Resources", farm_type: "Layer Farm", location: "Historical demonstration records",
  period_start: null, period_end: null, days_covered: 0, egg_price: null, feed_price: null, bag_weight_kg: 25,
  birds: 0, initial_birds: 0, houses: 0, total_eggs: 0, total_crates: 0, total_feed_bags: 0,
  total_feed_kg: 0, total_mortality: 0, health_records_count: 0, vaccination_records_count: 0,
  production_records_count: 0, feed_records_count: 0, mortality_records_count: 0, total_revenue: null,
  total_feed_cost: null, other_expenses: 0, gross_profit: null, avg_daily_feed_bags: null, mortality_pct: null,
  stock_kg: 0, stock_days_remaining: null, rooms: [], production_daily: [], room_production: [], feed_daily: [],
  mortality_daily: [], recent_health: [], expense_breakdown: [], finance_daily: [],
};

const STAGES = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "production", label: "Production", icon: Egg },
  { id: "feed", label: "Feed", icon: Wheat },
  { id: "health", label: "Health", icon: HeartPulse },
  { id: "finance", label: "Finance", icon: CircleDollarSign },
  { id: "intelligence", label: "Intelligence", icon: Brain },
  { id: "action", label: "Take Action", icon: Sparkles },
] as const;
type StageId = (typeof STAGES)[number]["id"];
type Period = "7" | "30" | "90" | "all";

const number = (value: unknown) => typeof value === "number" ? value : Number(value) || 0;
const optionalNumber = (value: unknown) => value === null || value === undefined ? null : number(value);
const fmt = (value: number, digits = 0) => value.toLocaleString("en-NG", { maximumFractionDigits: digits });
const money = (value: number | null) => value === null ? null : `₦${Math.round(value).toLocaleString("en-NG")}`;
const dateLabel = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "Unavailable";
const logoUrl = (logoAsset as { url: string }).url;
const heroUrl = (heroAsset as { url: string }).url;

function normalize(raw: Partial<DemoData>): DemoData {
  return {
    ...EMPTY, ...raw, farm_name: "ABZ Global Resources",
    period_start: raw.period_start ?? null, period_end: raw.period_end ?? null,
    egg_price: optionalNumber(raw.egg_price), feed_price: optionalNumber(raw.feed_price),
    total_revenue: optionalNumber(raw.total_revenue), total_feed_cost: optionalNumber(raw.total_feed_cost),
    gross_profit: optionalNumber(raw.gross_profit), avg_daily_feed_bags: optionalNumber(raw.avg_daily_feed_bags),
    mortality_pct: optionalNumber(raw.mortality_pct), stock_days_remaining: optionalNumber(raw.stock_days_remaining),
    rooms: (raw.rooms ?? []).map((row) => ({ ...row, current: number(row.current), initial: number(row.initial), mortality_pct: optionalNumber(row.mortality_pct) })),
    production_daily: (raw.production_daily ?? []).map((row) => ({ ...row, eggs: number(row.eggs), crates: number(row.crates) })),
    room_production: (raw.room_production ?? []).map((row) => ({ ...row, crates: number(row.crates) })),
    feed_daily: (raw.feed_daily ?? []).map((row) => ({ ...row, bags: number(row.bags), kg: number(row.kg) })),
    mortality_daily: (raw.mortality_daily ?? []).map((row) => ({ ...row, loss: number(row.loss) })),
    expense_breakdown: (raw.expense_breakdown ?? []).map((row) => ({ ...row, amount: number(row.amount) })),
    finance_daily: (raw.finance_daily ?? []).map((row) => ({ ...row, revenue: optionalNumber(row.revenue), feed_cost: optionalNumber(row.feed_cost), other_expenses: number(row.other_expenses) })),
  };
}

function useDemoData() {
  const [data, setData] = useState<DemoData | null>(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null); setError(false);
    supabase.rpc("demo_greenfield_data" as never).then(({ data: response, error: requestError }) => {
      if (!active) return;
      if (requestError || !response) setError(true);
      else setData(normalize(response as Partial<DemoData>));
    });
    return () => { active = false; };
  }, [nonce]);
  return { data, error, retry: () => setNonce((value) => value + 1) };
}

function filterPeriod<T extends Dated>(rows: T[], period: Period) {
  if (period === "all" || rows.length === 0) return rows;
  const latest = Math.max(...rows.map((row) => new Date(`${row.d}T12:00:00`).getTime()));
  const threshold = latest - (Number(period) - 1) * 86_400_000;
  return rows.filter((row) => new Date(`${row.d}T12:00:00`).getTime() >= threshold);
}

function PresentationMode() {
  const { data, error, retry } = useDemoData();
  const [stageIndex, setStageIndex] = useState(0);
  const stage = STAGES[stageIndex];
  const move = useCallback((next: number) => setStageIndex(Math.max(0, Math.min(STAGES.length - 1, next))), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") move(stageIndex + 1);
      if (event.key === "ArrowLeft") move(stageIndex - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, stageIndex]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="mobile-safe-top sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="Return to PoultryPro" className="flex shrink-0 items-center gap-2">
            <img src={logoUrl} alt="PoultryPro" className="h-10 w-10 object-contain" />
            <span className="hidden font-semibold sm:inline">PoultryPro</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium sm:inline-flex"><Lock className="h-3.5 w-3.5" /> Read-only</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"><span className="h-2 w-2 rounded-full bg-accent" /> Live Demo</span>
          </div>
        </div>
        <div className="h-1 bg-secondary"><div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${((stageIndex + 1) / STAGES.length) * 100}%` }} /></div>
      </header>

      {!data && !error && <LoadingState />}
      {error && <ErrorState retry={retry} />}
      {data && (
        <>
          <nav aria-label="Demo stages" className="border-b border-border bg-card">
            <div className="mx-auto flex max-w-7xl overflow-x-auto px-3 sm:px-6">
              {STAGES.map((item, index) => {
                const Icon = item.icon;
                return <button key={item.id} type="button" onClick={() => setStageIndex(index)} aria-current={index === stageIndex ? "step" : undefined} className={`flex min-h-14 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${index === stageIndex ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Icon className="h-4 w-4" />{item.label}</button>;
              })}
            </div>
          </nav>
          <section key={stage.id} className="animate-fade-in">
            <StageContent id={stage.id} data={data} goTo={(id) => setStageIndex(STAGES.findIndex((item) => item.id === id))} />
          </section>
          <footer className="mobile-safe-bottom sticky bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl">
            <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
              <Button variant="outline" onClick={() => move(stageIndex - 1)} disabled={stageIndex === 0}><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Previous</span></Button>
              <div className="text-center"><div className="text-xs font-semibold text-primary">Step {stageIndex + 1} of 7</div><div className="text-sm text-muted-foreground">{stage.label}</div></div>
              {stageIndex < STAGES.length - 1 ? <Button onClick={() => move(stageIndex + 1)}><span className="hidden sm:inline">Next</span><ArrowRight className="h-4 w-4" /></Button> : <Button asChild><Link to="/auth">Create account<ArrowRight className="h-4 w-4" /></Link></Button>}
            </div>
          </footer>
        </>
      )}
    </main>
  );
}

function LoadingState() {
  return <div className="mx-auto grid min-h-[75vh] max-w-lg place-items-center px-6 text-center"><div><img src={logoUrl} alt="" className="mx-auto h-20 w-20 animate-pulse object-contain" /><h1 className="mt-6 text-3xl font-semibold">Preparing your farm intelligence…</h1><p className="mt-2 text-muted-foreground">Securely assembling the historical demonstration records.</p><div className="mx-auto mt-8 h-1.5 max-w-xs overflow-hidden rounded-full bg-secondary"><div className="h-full w-2/3 animate-pulse rounded-full bg-accent" /></div></div></div>;
}

function ErrorState({ retry }: { retry: () => void }) {
  return <div className="mx-auto grid min-h-[75vh] max-w-xl place-items-center px-6 text-center"><div><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /><h1 className="mt-5 text-3xl font-semibold">Demo data could not be loaded</h1><p className="mt-2 text-muted-foreground">The command centre could not reach the read-only demonstration records.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Button onClick={retry}><RefreshCw className="h-4 w-4" />Retry Demo</Button><Button asChild variant="outline"><Link to="/">Return to PoultryPro</Link></Button></div></div></div>;
}

function StageContent({ id, data, goTo }: { id: StageId; data: DemoData; goTo: (id: StageId) => void }) {
  if (id === "overview") return <Overview data={data} goTo={goTo} />;
  if (id === "production") return <Production data={data} />;
  if (id === "feed") return <Feed data={data} />;
  if (id === "health") return <Health data={data} />;
  if (id === "finance") return <Finance data={data} />;
  if (id === "intelligence") return <Intelligence data={data} />;
  return <TakeAction />;
}

function Overview({ data, goTo }: { data: DemoData; goTo: (id: StageId) => void }) {
  const records = data.production_records_count + data.feed_records_count + data.mortality_records_count + data.health_records_count;
  return <>
    <div className="relative min-h-[520px] overflow-hidden bg-primary">
      <img src={heroUrl} alt="Layer birds at a poultry farm" className="absolute inset-0 h-full w-full object-cover opacity-45" />
      <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/85 to-primary/25" />
      <div className="relative mx-auto flex min-h-[520px] max-w-7xl items-center px-4 py-16 sm:px-6">
        <div className="max-w-3xl text-primary-foreground">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary/50 px-3 py-1.5 text-xs font-semibold"><ShieldCheck className="h-4 w-4 text-accent" /> Real historical records · Read-only</div>
          <h1 className="mt-6 text-4xl font-semibold sm:text-6xl">PoultryPro Farm Command Centre</h1>
          <p className="mt-4 max-w-2xl text-lg text-primary-foreground/85 sm:text-xl">See how {data.farm_name} turns everyday farm records into clear operational decisions.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Button size="lg" variant="secondary" onClick={() => goTo("production")}>Start Farm Walkthrough<ArrowRight className="h-4 w-4" /></Button><Button size="lg" variant="outline" className="border-primary-foreground/40 bg-primary/25 text-primary-foreground hover:bg-primary/40 hover:text-primary-foreground" onClick={() => goTo("intelligence")}>Explore Intelligence</Button></div>
        </div>
      </div>
    </div>
    <PageShell eyebrow="Farm at a glance" title="One command centre. Every critical signal." description={`${fmt(records)} real records from ${dateLabel(data.period_start)} to ${dateLabel(data.period_end)}.`}>
      <MetricGrid><Metric icon={<Bird />} label="Birds on farm" value={fmt(data.birds)} detail={`Across ${data.houses} houses`} /><Metric icon={<CalendarDays />} label="History covered" value={`${fmt(data.days_covered)} days`} detail="Historical operating period" /><Metric icon={<Wheat />} label="Feed recorded" value={`${fmt(data.total_feed_bags, 1)} bags`} detail={`${fmt(data.feed_records_count)} usage entries`} /><Metric icon={<HeartPulse />} label="Health activity" value={fmt(data.health_records_count)} detail="Recorded health events" /></MetricGrid>
      <Callout icon={<Lightbulb />} title="Why this matters">Farm owners can see production, feed, health and money together instead of piecing decisions together from notebooks.</Callout>
    </PageShell>
  </>;
}

function Production({ data }: { data: DemoData }) {
  const [period, setPeriod] = useState<Period>("30");
  const [room, setRoom] = useState("all");
  const filtered = useMemo(() => {
    if (room === "all") return filterPeriod(data.production_daily, period).map((point) => ({ d: point.d, v: point.crates }));
    return filterPeriod(data.room_production.filter((point) => point.room === room), period).map((point) => ({ d: point.d, v: point.crates }));
  }, [data, period, room]);
  const total = filtered.reduce((sum, point) => sum + point.v, 0);
  return <PageShell eyebrow="Stage 2 · Production" title="Understand laying performance by period and room" description="Every figure below comes from the fixed demonstration farm records.">
    <ControlRow period={period} setPeriod={setPeriod}><label className="relative"><span className="sr-only">Select room</span><select value={room} onChange={(event) => setRoom(event.target.value)} className="h-10 appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm"><option value="all">All rooms</option>{data.rooms.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4" /></label></ControlRow>
    {data.production_records_count === 0 ? <Unavailable icon={<Egg />} title="Production records are not available in this demonstration" description="PoultryPro does not invent egg totals, laying rates or room comparisons when source records are absent." /> : <><MetricGrid><Metric icon={<Egg />} label="Eggs recorded" value={fmt(total * 30)} detail={periodName(period)} /><Metric icon={<PackageOpen />} label="Crates recorded" value={fmt(total, 1)} detail={room === "all" ? "All rooms" : room} /><Metric icon={<BarChart3 />} label="Entries" value={fmt(data.production_records_count)} detail="Verified records" /></MetricGrid><ChartCard title="Crates over time" subtitle={`${room === "all" ? "All rooms" : room} · ${periodName(period)}`}><AreaChart points={filtered} /></ChartCard></>}
    <Callout icon={<Lightbulb />} title="What PoultryPro would reveal">With production entries, farmers can compare rooms, spot drops early and connect output with feed, flock health and cost.</Callout>
  </PageShell>;
}

function Feed({ data }: { data: DemoData }) {
  const [period, setPeriod] = useState<Period>("30");
  const rows = filterPeriod(data.feed_daily, period);
  const bags = rows.reduce((sum, row) => sum + row.bags, 0);
  const average = rows.length ? bags / rows.length : null;
  const cost = data.feed_price === null ? null : bags * data.feed_price;
  return <PageShell eyebrow="Stage 3 · Feed" title="Turn the farm’s biggest recurring input into a managed signal" description="Review consumption, cost and inventory readiness without exposing private farm controls.">
    <ControlRow period={period} setPeriod={setPeriod} />
    <MetricGrid><Metric icon={<Wheat />} label="Feed used" value={`${fmt(bags, 1)} bags`} detail={periodName(period)} /><Metric icon={<Clock3 />} label="Daily average" value={average === null ? null : `${fmt(average, 1)} bags`} detail={`${fmt(rows.length)} recorded days`} /><Metric icon={<CircleDollarSign />} label="Estimated feed cost" value={money(cost)} detail={data.feed_price === null ? undefined : `At ${money(data.feed_price)} per bag`} /><Metric icon={<PackageOpen />} label="Inventory runway" value={data.stock_days_remaining === null ? null : `${fmt(data.stock_days_remaining, 1)} days`} detail={data.stock_kg > 0 ? `${fmt(data.stock_kg, 1)} kg in stock` : undefined} /></MetricGrid>
    <ChartCard title="Feed usage trend" subtitle={periodName(period)}><AreaChart points={rows.map((row) => ({ d: row.d, v: row.bags }))} /></ChartCard>
    <Callout icon={<Lightbulb />} title="What the data says">The farm recorded {fmt(data.total_feed_bags, 1)} bags across {fmt(data.feed_records_count)} entries. {data.stock_days_remaining === null ? "No current inventory runway can be supported by the demonstration records." : `Current recorded stock supports approximately ${fmt(data.stock_days_remaining, 1)} days.`}</Callout>
  </PageShell>;
}

function Health({ data }: { data: DemoData }) {
  const [period, setPeriod] = useState<Period>("30");
  const mortality = filterPeriod(data.mortality_daily, period);
  const losses = mortality.reduce((sum, row) => sum + row.loss, 0);
  return <PageShell eyebrow="Stage 4 · Health" title="See flock risk before it becomes invisible" description="Mortality and treatment activity are shown as operational signals, not veterinary diagnoses.">
    <ControlRow period={period} setPeriod={setPeriod} />
    <MetricGrid><Metric icon={<TrendingDown />} label="Mortality recorded" value={fmt(losses)} detail={periodName(period)} /><Metric icon={<Activity />} label="All-time mortality rate" value={data.mortality_pct === null ? null : `${fmt(data.mortality_pct, 2)}%`} detail="Against initial birds" /><Metric icon={<HeartPulse />} label="Health records" value={fmt(data.health_records_count)} detail="Treatments and observations" /><Metric icon={<CheckCircle2 />} label="Vaccinations" value={data.vaccination_records_count > 0 ? fmt(data.vaccination_records_count) : null} detail="Recorded completed events" /></MetricGrid>
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]"><ChartCard title="Mortality trend" subtitle={periodName(period)}><AreaChart points={mortality.map((row) => ({ d: row.d, v: row.loss }))} tone="danger" /></ChartCard><div className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-5"><h3 className="font-semibold">Recent health activity</h3><div className="mt-4 space-y-3">{data.recent_health.length ? data.recent_health.slice(0, 6).map((item, index) => <div key={`${item.date}-${item.name}-${index}`} className="flex gap-3 border-b border-border pb-3"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" /><div><div className="text-sm font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{dateLabel(item.date)} · {item.scope || item.type}</div></div></div>) : <p className="text-sm text-muted-foreground">No health activity is available.</p>}</div></div></div>
    <Callout icon={<ShieldCheck />} title="Responsible intelligence">PoultryPro can highlight unusual changes and overdue actions; diagnosis and treatment decisions remain with a qualified veterinary professional.</Callout>
  </PageShell>;
}

function Finance({ data }: { data: DemoData }) {
  const [period, setPeriod] = useState<Period>("30");
  const rows = filterPeriod(data.finance_daily, period);
  const revenueAvailable = data.production_records_count > 0 && data.egg_price !== null;
  const revenue = revenueAvailable ? rows.reduce((sum, row) => sum + (row.revenue ?? 0), 0) : null;
  const feedCost = data.feed_price === null ? null : rows.reduce((sum, row) => sum + (row.feed_cost ?? 0), 0);
  const expenses = rows.reduce((sum, row) => sum + row.other_expenses, 0);
  const profit = revenue === null || feedCost === null ? null : revenue - feedCost - expenses;
  return <PageShell eyebrow="Stage 5 · Finance" title="Know where the farm’s money is moving" description="Prices, usage and recorded expenses are combined only where the source data supports the calculation.">
    <ControlRow period={period} setPeriod={setPeriod} />
    <MetricGrid><Metric icon={<TrendingUp />} label="Revenue" value={money(revenue)} detail={revenue === null ? undefined : periodName(period)} /><Metric icon={<Wheat />} label="Feed cost" value={money(feedCost)} detail={periodName(period)} /><Metric icon={<CircleDollarSign />} label="Other expenses" value={money(expenses)} detail="Recorded costs" /><Metric icon={profit !== null && profit < 0 ? <TrendingDown /> : <TrendingUp />} label="Profit" value={money(profit)} detail="Revenue − feed − other costs" /></MetricGrid>
    {revenue === null && <Unavailable icon={<CircleDollarSign />} title="Revenue and profit are not available for this period" description="The fixed demo farm has feed and expense records, but no production entries to support an egg-revenue calculation." compact />}
    <ChartCard title="Cost movement" subtitle={periodName(period)}><AreaChart points={rows.map((row) => ({ d: row.d, v: (row.feed_cost ?? 0) + row.other_expenses }))} /></ChartCard>
    <div className="grid gap-3 sm:grid-cols-2">{data.expense_breakdown.map((item) => <div key={item.label} className="flex items-center justify-between border-b border-border py-3 text-sm"><span>{item.label || "Other"}</span><strong>{money(item.amount)}</strong></div>)}</div>
  </PageShell>;
}

function Intelligence({ data }: { data: DemoData }) {
  const recentFeed = filterPeriod(data.feed_daily, "30");
  const previousFeed = data.feed_daily.slice(Math.max(0, data.feed_daily.length - 60), Math.max(0, data.feed_daily.length - 30));
  const recentAverage = recentFeed.length ? recentFeed.reduce((sum, row) => sum + row.bags, 0) / recentFeed.length : null;
  const previousAverage = previousFeed.length ? previousFeed.reduce((sum, row) => sum + row.bags, 0) / previousFeed.length : null;
  const feedChange = recentAverage !== null && previousAverage ? ((recentAverage - previousAverage) / previousAverage) * 100 : null;
  const recentMortality = filterPeriod(data.mortality_daily, "30").reduce((sum, row) => sum + row.loss, 0);
  return <PageShell eyebrow="Stage 6 · Intelligence" title="From records to decisions" description="PoultryPro’s intelligence layer brings supported signals together without fabricating confidence or missing measurements.">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Insight icon={<Wheat />} status="Feed signal" title={feedChange === null ? "Baseline available" : `${Math.abs(feedChange).toFixed(1)}% ${feedChange >= 0 ? "higher" : "lower"} daily feed use`} body={feedChange === null ? `${fmt(data.feed_records_count)} feed records are ready for trend analysis.` : "Compared with the preceding recorded 30-day window."} />
      <Insight icon={<HeartPulse />} status="Health signal" title={`${fmt(recentMortality)} losses in latest 30 recorded days`} body={`${fmt(data.health_records_count)} health records add operational context. This is not a diagnosis.`} />
      <Insight icon={<CircleDollarSign />} status="Finance signal" title={data.gross_profit === null ? "Profit cannot yet be supported" : `${money(data.gross_profit)} gross profit`} body={data.gross_profit === null ? "Production revenue is unavailable, so PoultryPro withholds the profit figure." : "Based on recorded output, prices, feed and other expenses."} />
      <Insight icon={<Egg />} status="Production signal" title={data.production_records_count ? `${fmt(data.total_crates)} crates recorded` : "Production data unavailable"} body={data.production_records_count ? "Room and period comparison is available." : "No egg performance claim is made without source entries."} />
      <Insight icon={<PackageOpen />} status="Inventory signal" title={data.stock_days_remaining === null ? "Runway unavailable" : `${fmt(data.stock_days_remaining, 1)} days of feed`} body={data.stock_days_remaining === null ? "No positive inventory balance supports a runway estimate." : "Estimated from recorded stock and recent consumption."} />
      <Insight icon={<AlertTriangle />} status="Weather signal" title="Weather unavailable for this demonstration" body="No valid fixed-farm weather record is exposed, so no weather advice is shown." />
    </div>
    <Callout icon={<Brain />} title="The command-centre advantage">One trusted view can connect daily recording, early warnings, cost visibility and practical next actions for the farmer.</Callout>
  </PageShell>;
}

function TakeAction() {
  return <PageShell eyebrow="Stage 7 · Take Action" title="Now imagine this for your farm" description="Build a reliable operating history, understand what is changing and act earlier.">
    <div className="grid gap-px overflow-hidden border-y border-border bg-border md:grid-cols-3"><ActionColumn number="01" title="Capture" text="Record production, feed, mortality, health, inventory and expenses from the farm." /><ActionColumn number="02" title="Understand" text="See the farm by room, flock, period and cost in one clear command centre." /><ActionColumn number="03" title="Predict" text="Use your own history to surface risks, trends and the next best action." /></div>
    <div className="mt-10 bg-primary px-5 py-12 text-center text-primary-foreground sm:px-10"><Sparkles className="mx-auto h-9 w-9 text-accent" /><h2 className="mt-4 text-3xl font-semibold text-primary-foreground sm:text-5xl">Run your farm with clarity.</h2><p className="mx-auto mt-4 max-w-2xl text-primary-foreground/80">Start building the records that make stronger farm decisions possible.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button asChild size="lg" variant="secondary"><Link to="/auth">Create Free Account<ArrowRight className="h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-primary text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><a href="mailto:greenfieldcontractsagroltd@gmail.com?subject=PoultryPro%20Demo%20Request">Request a Demo</a></Button><Button asChild size="lg" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link to="/">Return to PoultryPro</Link></Button></div></div>
  </PageShell>;
}

function PageShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14"><div className="max-w-3xl"><div className="text-xs font-semibold uppercase text-primary">{eyebrow}</div><h1 className="mt-2 text-3xl font-semibold sm:text-5xl">{title}</h1><p className="mt-3 text-base leading-7 text-muted-foreground">{description}</p></div><div className="mt-9 space-y-8">{children}</div></div>;
}

function MetricGrid({ children }: { children: ReactNode }) { return <div className="grid gap-px overflow-hidden border-y border-border bg-border sm:grid-cols-2 xl:grid-cols-4">{children}</div>; }
function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string | null; detail?: string }) {
  return <div className="min-h-36 bg-background p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span>{label}</div>{value === null ? <div className="mt-5 text-base font-semibold">Not available</div> : <div className="mt-4 text-3xl font-semibold">{value}</div>}<div className="mt-2 text-xs text-muted-foreground">{value === null ? "Not available in this demonstration" : detail}</div></div>;
}
function ControlRow({ period, setPeriod, children }: { period: Period; setPeriod: (period: Period) => void; children?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3"><div className="flex flex-wrap gap-1">{(["7", "30", "90", "all"] as Period[]).map((value) => <Button key={value} size="sm" variant={period === value ? "default" : "ghost"} onClick={() => setPeriod(value)}>{value === "all" ? "All time" : `${value} days`}</Button>)}</div>{children}</div>;
}
function periodName(period: Period) { return period === "all" ? "All historical records" : `Latest ${period} recorded days`; }
function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) { return <div className="border-y border-border py-5"><div className="mb-4 flex items-end justify-between gap-4"><div><h3 className="font-semibold">{title}</h3><p className="text-xs text-muted-foreground">{subtitle}</p></div></div>{children}</div>; }
function AreaChart({ points, tone = "default" }: { points: { d: string; v: number }[]; tone?: "default" | "danger" }) {
  if (!points.length) return <div className="grid h-64 place-items-center bg-secondary/40 px-4 text-center text-sm text-muted-foreground">No records available for this view.</div>;
  const width = 900, height = 260, inset = 20, max = Math.max(...points.map((point) => point.v), 1);
  const coords = points.map((point, index) => ({ ...point, x: inset + (index / Math.max(points.length - 1, 1)) * (width - inset * 2), y: height - inset - (point.v / max) * (height - inset * 2) }));
  const path = coords.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const fill = `${path} L${coords[coords.length - 1].x},${height - inset} L${coords[0].x},${height - inset} Z`;
  return <div className="h-64 w-full"><svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label={`${points.length} historical data points`} preserveAspectRatio="none"><defs><linearGradient id={`chart-${tone}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={tone === "danger" ? "currentColor" : "var(--primary)"} stopOpacity="0.28" /><stop offset="1" stopColor={tone === "danger" ? "currentColor" : "var(--primary)"} stopOpacity="0" /></linearGradient></defs><g className={tone === "danger" ? "text-destructive" : "text-primary"}><path d={fill} fill={`url(#chart-${tone})`} /><path d={path} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" /></g></svg></div>;
}
function Callout({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) { return <div className="flex gap-4 border-l-4 border-accent bg-secondary/50 p-5"><span className="mt-0.5 shrink-0 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span><div><h3 className="font-semibold">{title}</h3><div className="mt-1 text-sm leading-6 text-muted-foreground">{children}</div></div></div>; }
function Unavailable({ icon, title, description, compact = false }: { icon: ReactNode; title: string; description: string; compact?: boolean }) { return <div className={`border-y border-border bg-secondary/35 px-5 text-center ${compact ? "py-6" : "py-14"}`}><span className="mx-auto block w-fit text-muted-foreground [&>svg]:h-8 [&>svg]:w-8">{icon}</span><h3 className="mt-3 font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p></div>; }
function Insight({ icon, status, title, body }: { icon: ReactNode; status: string; title: string; body: string }) { return <div className="border-t-2 border-primary bg-card p-5"><div className="flex items-center justify-between text-primary"><span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span><span className="text-xs font-semibold uppercase">{status}</span></div><h3 className="mt-6 text-xl font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></div>; }
function ActionColumn({ number: value, title, text }: { number: string; title: string; text: string }) { return <div className="min-h-60 bg-background p-6"><div className="text-sm font-semibold text-accent">{value}</div><h3 className="mt-12 text-3xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></div>; }
