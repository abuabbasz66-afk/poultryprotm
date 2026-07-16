import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Egg, Bird, TrendingDown, TrendingUp, Wheat, DollarSign,
  Skull, Syringe, Droplets, Pill, Stethoscope, Eye, Plus, Pencil, Trash2, MapPin,
  Sparkles, ArrowLeft, LayoutDashboard, LineChart as LineChartIcon,
  Brain, Activity, AlertTriangle, Gauge, Radar, Lightbulb, ArrowRight, LogOut, Upload,
  ChevronDown, MoreVertical, Menu, X as CloseIcon,
} from "lucide-react";

import logoAsset from "@/assets/poultrypro-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import {
  useRooms, useEggs, useMortality, useHealth, useFeed, usePrices, useFarm, useFarmId,
  useAddRoom, useDeleteRoom,
  useAddEgg, useAddMortality, useAddHealth, useAddFeed,
  useAddPrice, useDeletePrice, useDeleteMortality, useDeleteFeed,
  useDeleteEgg, useUpdateEgg, useUpdateMortality, useUpdateHealth, useUpdateFeed,
  useDeleteHealth,
  HEALTH_TYPES, normalizeHealthType,
  type Room, type EggRow, type Mortality, type Health, type HealthType, type Feed, type Price,
} from "@/lib/farm-data";
import { ProductionDeclineIntelligence } from "@/components/production-decline-card";
import { MortalityPatternIntelligence } from "@/components/mortality-pattern-card";
import { FarmInsightsIntelligence } from "@/components/farm-insights-card";
import { RecordDialogs, RecordConfirmDialog, type RecordDialogState } from "@/components/record-dialogs";
import { UpgradeDialog, type UpgradeTier } from "@/components/upgrade-dialog";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { normaliseEggRow, totalEggsFromRow } from "@/lib/egg-normalize";
import { toDateKey, toLocalDate } from "@/lib/date-key";
import {
  fmtNum, fmtSigned, parseShortDate,
  computeForecast, type ForecastResult,
  computeMortalityRisk, riskTone, classifyRisk,
  type MortalityAnalysis, type RoomRisk, type RiskLevel, type PatternLabel,
  computeFeedEfficiency,
  type FeedEffAnalysis, type MatchedDay, type RoomEffRow, type EffStatus, type MovementLabel,
  computeAbnormalActivity, classifyActivity, signalPretty,
  type AbnormalAnalysis, type RoomActivityRow, type ActivityLevel, type SignalKey,
} from "@/lib/intelligence-modules";
import { format as formatDate, parseISO, isValid as isValidDate } from "date-fns";

function formatDayLabel(iso: string): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValidDate(d) ? formatDate(d, "d MMM yyyy") : iso;
}
function birdsLabel(n: number): string {
  const abs = Math.abs(Number(n) || 0);
  return `${abs} ${abs === 1 ? "bird" : "birds"}`;
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Farm Dashboard — PoultryPro" },
      { name: "description", content: "Live poultry farm operations: production, feed, health, mortality and profitability." },
      { property: "og:title", content: "Farm Dashboard — PoultryPro" },
      { property: "og:description", content: "Real-time visibility into every bird, egg, and naira." },
    ],
  }),
  component: Dashboard,
});

// ---------- Helpers ----------
const naira = (n: number) => "₦" + n.toLocaleString("en-NG");

const HEALTH_TYPE_STYLES: Record<HealthType, { icon: typeof Syringe; wrap: string; badge: string }> = {
  Vaccination: { icon: Syringe,     wrap: "bg-blue-500/10 text-blue-600",                                       badge: "bg-blue-500/10 text-blue-700" },
  Vitamin:     { icon: Droplets,    wrap: "bg-[color:var(--forest)]/10 text-[color:var(--forest)]",             badge: "bg-[color:var(--forest)]/10 text-[color:var(--forest)]" },
  Medication:  { icon: Pill,        wrap: "bg-purple-500/10 text-purple-600",                                   badge: "bg-purple-500/10 text-purple-700" },
  Treatment:   { icon: Stethoscope, wrap: "bg-amber-500/10 text-amber-600",                                     badge: "bg-amber-500/10 text-amber-700" },
  Observation: { icon: Eye,         wrap: "bg-slate-500/10 text-slate-600",                                     badge: "bg-slate-500/10 text-slate-700" },
};
function healthTypeStyle(t: string) {
  return HEALTH_TYPE_STYLES[(t as HealthType)] ?? HEALTH_TYPE_STYLES.Observation;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function todayShortLabel() {
  return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const farmIdQ = useFarmId();
  const farmQ = useFarm();
  const farm = farmQ.data;
  const roomsQ = useRooms();
  const eggsQ = useEggs();
  const mortalityQ = useMortality();
  const healthQ = useHealth();
  const feedQ = useFeed();
  const pricesQ = usePrices();

  const rooms: Room[] = roomsQ.data ?? [];
  const eggs: EggRow[] = eggsQ.data ?? [];
  const mortality: Mortality[] = mortalityQ.data ?? [];
  const health: Health[] = healthQ.data ?? [];
  const feed: Feed[] = feedQ.data ?? [];
  const prices: Price[] = pricesQ.data ?? [];

  const addRoomM = useAddRoom();
  const delRoomM = useDeleteRoom();
  const addEggM = useAddEgg();
  const addMortalityM = useAddMortality();
  const addHealthM = useAddHealth();
  const addFeedM = useAddFeed();
  const addPriceM = useAddPrice();
  const delPriceM = useDeletePrice();
  const delMortalityM = useDeleteMortality();
  const delFeedM = useDeleteFeed();
  const delEggM = useDeleteEgg();
  const delHealthM = useDeleteHealth();
  const updEggM = useUpdateEgg();
  const updMortalityM = useUpdateMortality();
  const updHealthM = useUpdateHealth();
  const updFeedM = useUpdateFeed();

  const [feedTab, setFeedTab] = useState<"Usage" | "Formulas">("Usage");
  const [area, setArea] = useState<"records" | "analytics" | "ai">("records");
  const [upgradeTier, setUpgradeTier] = useState<UpgradeTier | null>(null);
  const [forecastOpen, setForecastOpen] = useState(false);
  const [mortalityOpen, setMortalityOpen] = useState(false);
  const [feedEffOpen, setFeedEffOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [bagWeightKg, setBagWeightKg] = useState<number | null>(null);
  const [mortShowAll, setMortShowAll] = useState(false);
  const [feedShowAll, setFeedShowAll] = useState(false);
  const [expandedMortDate, setExpandedMortDate] = useState<string | null>(null);
  const [expandedFeedDate, setExpandedFeedDate] = useState<string | null>(null);
  const [eggShowAll, setEggShowAll] = useState(false);
  const [healthShowAll, setHealthShowAll] = useState(false);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; confirmLabel?: string; onConfirm: () => void | Promise<void> } | null>(null);
  const askDelete = (title: string, message: string, onConfirm: () => void | Promise<void>) =>
    setConfirmState({ title, message, onConfirm });
  const [dialog, setDialog] = useState<RecordDialogState | null>(null);
  const openDialog = (s: RecordDialogState) => setDialog(s);

  // Derived
  const totalBirds = rooms.reduce((s, r) => s + r.current, 0);
  const totalLoss = rooms.reduce((s, r) => s + (r.initial - r.current), 0);
  const today = eggs[0];
  const todayNorm = today ? normaliseEggRow(today) : { crates: 0, extra: 0, totalEggs: 0 };
  const todayCrates = todayNorm.crates;
  const todayExtra = todayNorm.extra;
  const todayEggs = todayNorm.totalEggs;
  const yesterdayEggs = eggs[1] ? totalEggsFromRow(eggs[1]) : todayEggs;
  const diffPct = yesterdayEggs ? ((todayEggs - yesterdayEggs) / yesterdayEggs) * 100 : 0;
  const totalEggs = eggs.reduce((s, r) => s + totalEggsFromRow(r), 0);
  const totalCrates = Math.floor(totalEggs / 30);
  const monthlyMortality = mortality.reduce((s, m) => s + Math.abs(m.loss), 0);
  const latestFeedDate = feed[0]?.date;
  const feedToday = latestFeedDate ? feed.filter(f => f.date === latestFeedDate).reduce((s, f) => s + f.bags, 0) : 0;
  const productionRate = totalBirds ? Math.round((todayEggs / totalBirds) * 100) : 0;
  const last7Eggs = eggs.slice(0, 7);
  const sevenDayAvgEggs = last7Eggs.length
    ? Math.round(last7Eggs.reduce((s, r) => s + totalEggsFromRow(r), 0) / last7Eggs.length)
    : 0;
  // Current Lay Rate: today's total eggs vs active birds. Guard against 0/missing birds
  // and impossible >100% results so the dashboard never shows Infinity or NaN.
  const rawLayRate = totalBirds > 0 && todayEggs > 0 ? (todayEggs / totalBirds) * 100 : null;
  const layRateValid = rawLayRate !== null && Number.isFinite(rawLayRate) && rawLayRate <= 100;
  const currentLayRateDisplay = rawLayRate === null
    ? "—"
    : layRateValid
      ? `${rawLayRate.toFixed(1)}%`
      : "—";
  const eggPrice = prices.find(p => p.item === "Egg")?.price ?? 4900;
  const feedPrice = prices.find(p => p.item.startsWith("Feed"))?.price ?? 13600;
  const todayRevenue = Math.round((todayEggs / 30) * eggPrice);
  const todayCost = Math.round(feedToday * feedPrice);
  const todayProfit = todayRevenue - todayCost;
  void totalCrates;

  const chartData = useMemo(
    () => [...eggs].reverse().map(e => ({
      name: e.label.replace(/^[A-Za-z]{3}, /, ""),
      "ROOM 2": e.r2, "ROOM 3": e.r3, "ROOM 4": e.r4, "Extra Eggs": e.extra,
    })),
    [eggs],
  );

  const profitData = useMemo(
    () => [...eggs].reverse().map(e => {
      const rev = ((e.r2 + e.r3 + e.r4) * 30 + e.extra) / 30 * eggPrice;
      const cost = 19 * feedPrice; // stable ~19 bags/day baseline
      return { name: e.label.replace(/^[A-Za-z]{3}, /, ""), Revenue: Math.round(rev), Cost: cost, Profit: Math.round(rev - cost) };
    }),
    [eggs, eggPrice, feedPrice],
  );

  const handleSignOut = async () => {
    // Stop in-flight protected queries so cleared-session 401s don't storm the UI,
    // drop cached farm data so Back can't restore the previous farm's dashboard,
    // then sign out and REPLACE history so /dashboard is off the back stack.
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const runDelete = <T,>(mutateAsync: (v: T) => Promise<unknown>, value: T, label: string) => async () => {
    try {
      await mutateAsync(value);
      toast.success(`${label} deleted`);
    } catch (e) {
      toast.error(`Failed to delete ${label.toLowerCase()}`, { description: (e as Error).message });
    }
  };

  // Actions (modal dialogs)
  const addRoom = () => openDialog({ kind: "room-add" });
  const delRoom = (id: string) => {
    const r = rooms.find(x => x.id === id);
    askDelete("Delete room?", `This will permanently remove ${r?.name ?? "this room"} and cannot be undone.`,
      runDelete((v: string) => delRoomM.mutateAsync(v), id, "Room"));
  };

  const recordProduction = () => openDialog({ kind: "egg-add" });
  const editEgg = (e: EggRow) => openDialog({ kind: "egg-edit", item: e });
  const delEgg = (e: EggRow) => {
    askDelete(
      `Delete production record?`,
      `This will permanently remove the production record for ${e.label}. This action cannot be undone.`,
      runDelete((v: string) => delEggM.mutateAsync(v), e.id, "Production record"),
    );
  };

  const addMortality = () => openDialog({ kind: "mortality-add" });
  const editMortality = (m: Mortality) => openDialog({ kind: "mortality-edit", item: m });
  const delMortalityRow = (m: Mortality) => {
    askDelete(
      `Delete this mortality record?`,
      `This will update mortality analytics and farm intelligence. Removing the ${birdsLabel(Math.abs(m.loss))} loss for ${m.room} on ${formatDayLabel(m.date)} (${m.cause}).`,
      runDelete((v: string) => delMortalityM.mutateAsync(v), m.id, "Mortality record"),
    );

  };

  const addHealth = () => openDialog({ kind: "health-add" });
  const editHealth = (h: Health) => openDialog({ kind: "health-edit", item: h });
  const delHealthRow = (h: Health) => {
    askDelete(
      `Delete health record?`,
      `This will permanently remove "${h.name}" (${h.type.toLowerCase()}) from ${h.date}.`,
      runDelete((v: string) => delHealthM.mutateAsync(v), h.id, "Health record"),
    );
  };

  const recordFeed = () => openDialog({ kind: "feed-add" });
  const editFeed = (f: Feed) => openDialog({ kind: "feed-edit", item: f });
  const delFeedRow = (f: Feed) => {
    askDelete(
      `Delete feed record?`,
      `This will permanently remove the ${f.bags}-bag feed record for ${f.room} on ${f.date}.`,
      runDelete((v: string) => delFeedM.mutateAsync(v), f.id, "Feed record"),
    );
  };
  const editFeedDay = (items: Feed[]) => openDialog({ kind: "feed-day-edit", items });

  const addPrice = () => openDialog({ kind: "price-add" });
  const delPrice = (id: string) => {
    const p = prices.find(x => x.id === id);
    askDelete("Delete price item?", `This will permanently remove ${p?.item ?? "the item"} from the price list.`,
      runDelete((v: string) => delPriceM.mutateAsync(v), id, "Price item"));
  };


  // --- Mortality aggregation (grouped by date, preserving arrival order) ---
  type MortGroup = { date: string; total: number; byRoom: Record<string, number>; causes: string[]; items: Mortality[] };
  const mortalityByDate = useMemo<MortGroup[]>(() => {
    const map = new Map<string, MortGroup>();
    for (const m of mortality) {
      let g = map.get(m.date);
      if (!g) { g = { date: m.date, total: 0, byRoom: {}, causes: [], items: [] }; map.set(m.date, g); }
      const loss = Math.abs(m.loss);
      g.total += loss;
      g.byRoom[m.room] = (g.byRoom[m.room] ?? 0) + loss;
      if (!g.causes.includes(m.cause)) g.causes.push(m.cause);
      g.items.push(m);
    }

  return Array.from(map.values());
  }, [mortality]);

  // --- Health sorted by date newest → oldest ---
  const healthByDate = useMemo<Health[]>(() => {
    return [...health].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [health]);

  const totalInitialBirds = rooms.reduce((s, r) => s + r.initial, 0);
  const mortalityRatePct = totalInitialBirds ? (monthlyMortality / totalInitialBirds) * 100 : 0;
  const leadingCause = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of mortality) c[m.cause] = (c[m.cause] ?? 0) + Math.abs(m.loss);
    const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return top?.[0] ?? "—";
  }, [mortality]);

  // --- Feed aggregation (grouped by date, dynamic rooms) ---
  type FeedGroup = { date: string; byRoom: Record<string, number>; total: number; items: Feed[] };
  const feedByDate = useMemo<FeedGroup[]>(() => {
    const map = new Map<string, FeedGroup>();
    for (const f of feed) {
      let g = map.get(f.date);
      if (!g) { g = { date: f.date, byRoom: {}, total: 0, items: [] }; map.set(f.date, g); }
      g.byRoom[f.room] = (g.byRoom[f.room] ?? 0) + f.bags;
      g.total += f.bags;
      g.items.push(f);
    }
    return Array.from(map.values());
  }, [feed]);

  const feedRoomNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of rooms) set.add(r.name);
    for (const f of feed) set.add(f.room);
    return Array.from(set).sort();
  }, [rooms, feed]);

  const feed7 = feedByDate.slice(0, 7);
  const feed30 = feedByDate.slice(0, 30);
  const feed7Avg = feed7.length ? feed7.reduce((s, g) => s + g.total, 0) / feed7.length : 0;
  const feed30Total = feed30.reduce((s, g) => s + g.total, 0);
  const bagKg = bagWeightKg ?? 25;
  const feedPerBirdG = totalBirds ? (feedToday * bagKg * 1000) / totalBirds : 0;

  // Do not render any farm-scoped UI until the current user's farm id has
  // resolved. This prevents a moment where cached "Your Farm" fallbacks or
  // empty-array derivations render before farm-specific queries begin.
  const farmContextReady = !farmIdQ.isPending && !!farmIdQ.data && !farmQ.isPending;
  if (!farmContextReady) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 rounded-full border-2 border-[color:var(--forest)]/30 border-t-[color:var(--forest)] animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your farm…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-14 overflow-x-hidden">
      {/* Header */}
      <header className="bg-[color:var(--forest)] text-primary-foreground">
        <div className="container-x flex items-center justify-between py-3 md:py-4">
          {/* Mobile: logo left, menu right. Desktop: back-link left, actions right. */}
          <Link to="/" className="hidden md:inline-flex items-center gap-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
          <div className="md:hidden flex items-center gap-2">
            <img src={logoAsset.url} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="font-display font-semibold text-[15px]">PoultryPro™</span>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img src={logoAsset.url} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
              <span className="font-display font-semibold">PoultryPro™</span>
            </div>
            <Link
              to="/import"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-xs text-primary-foreground/90 hover:bg-white/10"
              title="Import historical records from CSV"
            >
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </Link>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-xs text-primary-foreground/90 hover:bg-white/10"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>

          <MobileMenu onSignOut={handleSignOut} />
        </div>
        <div className="container-x pb-6 pt-3 md:pb-10 md:pt-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] md:text-[11px] uppercase tracking-[0.18em] md:tracking-[0.22em] text-[color:var(--gold)]">
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3 w-3 md:h-3.5 md:w-3.5" /> Capture</span>
            <ArrowRight className="h-3 w-3 opacity-60" />
            <span>Understand</span>
            <ArrowRight className="h-3 w-3 opacity-60" />
            <span>Predict</span>
          </div>
          <div className="mt-1.5 text-[11px] md:text-xs text-primary-foreground/70 max-w-2xl leading-snug">
            Farm Records &amp; Analytics active · AI Intelligence rolling out on Premium
          </div>
          <h1 className="mt-2 font-display font-semibold farm-name md:!text-[2.25rem] lg:!text-4xl md:!leading-tight">{farm?.name ?? "Your Farm"}</h1>
          {(farm?.state || farm?.country || farm?.location) && (
            <div className="mt-2 flex items-center gap-1.5 text-[12px] md:text-sm text-primary-foreground/80">
              <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
              <span className="truncate">{[farm?.location, farm?.state, farm?.country].filter(Boolean).join(", ")}</span>
            </div>
          )}
          <div className="mt-1 text-[12px] md:text-sm text-primary-foreground/70">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="mt-3 md:mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 md:px-4 md:py-1.5 text-[12px] md:text-sm max-w-full">
            <Bird className="h-3.5 w-3.5 md:h-4 md:w-4 text-[color:var(--gold)] shrink-0" />
            <span className="font-semibold whitespace-nowrap">{totalBirds.toLocaleString()} birds</span>
            <span className="text-primary-foreground/60">·</span>
            <span className="text-primary-foreground/80 whitespace-nowrap">{rooms.length} rooms</span>
          </div>
        </div>
      </header>

      <main className="container-x -mt-4 md:-mt-6 space-y-5 md:space-y-6">
        {/* Product-area navigation: Capture → Understand → Predict */}
        <nav aria-label="Dashboard areas" className="rounded-2xl md:rounded-3xl bg-card border border-border p-1.5 md:p-2 shadow-[var(--shadow-soft)]">
          <div className="grid grid-cols-3 gap-1 md:gap-1.5">
            <AreaTab
              active={area === "records"} onClick={() => setArea("records")}
              num="01" stage="CAPTURE" title="Farm Records" shortLabel="Capture" plan="Basic" icon={LayoutDashboard}
            />
            <AreaTab
              active={area === "analytics"} onClick={() => setArea("analytics")}
              num="02" stage="UNDERSTAND" title="Farm Analytics" shortLabel="Analytics" plan="Standard" icon={LineChartIcon}
            />
            <AreaTab
              active={area === "ai"} onClick={() => setArea("ai")}
              num="03" stage="PREDICT" title="AI Intelligence" shortLabel="AI" plan="Premium" icon={Brain} premium
            />
          </div>
        </nav>


        {area === "analytics" && (
          <div className="space-y-6">
            <SectionIntro
              stage="UNDERSTAND" plan="Standard" title="Farm Analytics"
              body="Turn structured farm records into production, financial and operational intelligence."
            />

            {/* Operational Intelligence Summary — computed from existing records */}
            <Card>
              <CardHeader
                title={<span className="inline-flex items-center gap-2"><Gauge className="h-5 w-5 text-[color:var(--forest)]" /> Operational Intelligence Summary</span>}
                subtitle="Executive view calculated from your live farm records"
              />
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <InsightRow
                  label="Production vs 80% target"
                  value={`${productionRate}%`}
                  detail={productionRate >= 80
                    ? `${productionRate - 80} pts above target`
                    : `${80 - productionRate} pts below target`}
                  positive={productionRate >= 80}
                />
                <InsightRow
                  label="Today vs previous recorded day"
                  value={`${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%`}
                  detail={`${todayEggs.toLocaleString()} eggs today · ${yesterdayEggs.toLocaleString()} prior`}
                  positive={diffPct >= 0}
                />
                <InsightRow
                  label="Highest producing room today"
                  value={(() => {
                    if (!today) return "—";
                    const arr = [
                      { name: "ROOM 2", v: today.r2 },
                      { name: "ROOM 3", v: today.r3 },
                      { name: "ROOM 4", v: today.r4 },
                    ].sort((a, b) => b.v - a.v);
                    return `${arr[0].name} · ${arr[0].v} crates`;
                  })()}
                  detail="Based on latest recorded production"
                  positive
                />
                <InsightRow
                  label="Monthly mortality total"
                  value={String(monthlyMortality)}
                  detail={`${feedToday} bags fed today · today's profit ${naira(todayProfit)}`}
                  positive={monthlyMortality <= 5}
                />
              </div>
            </Card>


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard tone="mint" icon={Egg} label="Today's Eggs" value={todayEggs.toLocaleString()}
            hint={`${todayCrates} crates + ${todayExtra} extra`}
            trend={diffPct >= 0 ? { up: true, text: `${diffPct.toFixed(1)}% vs yesterday` } : { up: false, text: `${Math.abs(diffPct).toFixed(1)}% vs yesterday` }} />
          <KpiCard tone="plain" icon={Bird} label="Total Birds" value={totalBirds.toLocaleString()} hint={`Across ${rooms.length} rooms`} />
          <KpiCard tone="sky" icon={TrendingUp} label="Production Rate" value={`${productionRate}%`} hint="Target: 80%" />
          <KpiCard tone="peach" icon={Skull} label="Monthly Mortality" value={String(monthlyMortality)} hint="This month" />
          <KpiCard tone="plain" icon={Wheat} label="Feed Today" value={`${feedToday} bags`} hint="All rooms" />
          <KpiCard tone="mint" icon={DollarSign} label="Today's Profit" value={naira(todayProfit)} hint={`Revenue: ${naira(todayRevenue)}`} />
        </div>

        {/* Monthly Egg Production */}
        <Card>
          <CardHeader
            title="Monthly Egg Production"
            subtitle="Crates per room & extra eggs (this month)"
            right={<div className="text-right"><div className="font-display text-2xl font-semibold text-[color:var(--forest)]">{totalEggs.toLocaleString()}</div><div className="text-xs text-muted-foreground">total eggs</div></div>}
          />
          <div className="h-72 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 85)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ROOM 2" fill="oklch(0.32 0.06 155)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="ROOM 3" fill="oklch(0.78 0.15 78)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="ROOM 4" fill="oklch(0.55 0.15 240)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Extra Eggs" fill="oklch(0.55 0.22 15)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Monthly Profit */}
        <Card>
          <CardHeader
            title="Monthly Profit Overview"
            subtitle="Revenue vs feed cost (this month)"
            right={<div className="text-right"><div className="font-display text-2xl font-semibold text-[color:var(--forest)]">{naira(profitData.reduce((s, d) => s + d.Profit, 0))}</div><div className="text-xs text-muted-foreground">from {naira(profitData.reduce((s, d) => s + d.Revenue, 0))} revenue</div></div>}
          />
          <div className="h-72 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitData} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 85)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => "₦" + (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: number) => naira(v)} contentStyle={{ borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Revenue" stroke="oklch(0.32 0.06 155)" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Cost" stroke="oklch(0.78 0.15 78)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
          </div>
        )}

        {area === "records" && (
          <div className="space-y-6">
            <SectionIntro
              stage="CAPTURE" plan="Basic" title="Farm Records"
              body="Digitise daily poultry activities and maintain structured operational records across production, feed, flock health, mortality and farm rooms."
            />

        {/* Daily Egg Production table */}
        <Card>
          <CardHeader
            title={<span className="inline-flex items-center gap-2"><Egg className="h-5 w-5 text-[color:var(--forest)]" /> Daily Egg Production</span>}
            subtitle="One row per room per date — click Record to add a new day"
            right={<ActionBtn onClick={recordProduction} icon={Plus}>Record Production</ActionBtn>}
          />
          <div className="grid grid-cols-3 gap-3 mt-4">
            <MiniStat label="Today's Production" value={`${todayCrates} cr`} tone="mint" />
            <MiniStat label="7-Day Avg" value={`${sevenDayAvgEggs.toLocaleString()} eggs`} tone="sky" />
            <MiniStat label="Current Lay Rate" value={currentLayRateDisplay} tone="plain" />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  {rooms.map(r => (
                    <th key={r.id} className="py-2 pr-4 font-medium whitespace-nowrap">{r.name.replace(/^ROOM\s*/i, "R")}</th>
                  ))}
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Extra</th>
                  <th className="py-2 pr-2 font-medium w-6"></th>
                </tr>
              </thead>
              <tbody>
                {(eggShowAll ? eggs : eggs.slice(0, 7)).map(e => {
                  const roomVal = (name: string): number | null => {
                    const n = name.toUpperCase();
                    if (n === "ROOM 2") return e.r2;
                    if (n === "ROOM 3") return e.r3;
                    if (n === "ROOM 4") return e.r4;
                    return null;
                  };
                  const norm = normaliseEggRow(e);
                  return (
                    <tr key={e.id ?? e.date + e.label} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 whitespace-nowrap">{e.label}</td>
                      {rooms.map(r => {
                        const v = roomVal(r.name);
                        return (
                          <td key={r.id} className="py-2.5 pr-4 tabular-nums">
                            {v === null ? <span className="text-muted-foreground/50" title="Not recorded">—</span> : v}
                          </td>
                        );
                      })}
                      <td className="py-2.5 pr-4">
                        <span className="inline-flex items-center rounded-full bg-[color:var(--forest)] text-primary-foreground px-2.5 py-0.5 text-xs font-medium">
                          {norm.crates}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{norm.extra ? `+${norm.extra}` : "—"}</td>
                      <td className="py-2.5 pr-2 text-right"><RowActions onEdit={() => editEgg(e)} onDelete={() => delEgg(e)} /></td>
                    </tr>
                  );
                })}

                {eggs.length === 0 && (
                  <tr><td colSpan={rooms.length + 4} className="py-4 text-center text-muted-foreground text-xs">
                    <span className="font-medium">Pending entry</span> — no production records yet.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {eggs.length > 7 && (
            <div className="mt-3 text-center">
              <button onClick={() => setEggShowAll(v => !v)} className="text-xs font-medium text-[color:var(--forest)] hover:underline">
                {eggShowAll ? "Show latest 7 only" : `View all ${eggs.length} production records`}
              </button>
            </div>
          )}
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Room overview */}
          <Card>
            <CardHeader title="Room Overview" subtitle="Current status per room" />
            <div className="mt-4 space-y-2">
              {rooms.map(r => {
                const todayR = today ? (r.name === "ROOM 2" ? today.r2 : r.name === "ROOM 3" ? today.r3 : r.name === "ROOM 4" ? today.r4 : 0) : 0;
                const loss = r.initial - r.current;
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-2xl bg-secondary/50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--forest)]/10 text-[color:var(--forest)]"><Bird className="h-4 w-4" /></span>
                      <div>
                        <div className="font-semibold text-sm">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.current.toLocaleString()} birds</div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="inline-flex items-center gap-1 text-[color:var(--forest)]"><Egg className="h-3.5 w-3.5" /> {todayR} <span className="text-muted-foreground text-xs">crates</span></div>
                      {loss > 0 && <div className="text-xs text-destructive flex items-center gap-1 justify-end mt-0.5"><TrendingDown className="h-3 w-3" /> {loss}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Mortality */}
          <Card>
            <CardHeader title="Mortality Log" subtitle="Grouped by date" right={<ActionBtn onClick={addMortality} icon={Plus}>Add</ActionBtn>} />
            <div className="grid grid-cols-3 gap-3 mt-4">
              <MiniStat label="Total Loss" value={String(monthlyMortality)} tone="peach" />
              <MiniStat label="Mortality Rate" value={mortalityRatePct.toFixed(2) + "%"} tone="plain" />
              <MiniStat label="Leading Cause" value={leadingCause} tone="mint" />
            </div>
            <div className="mt-4 space-y-2">
              {(mortShowAll ? mortalityByDate : mortalityByDate.slice(0, 7)).map(g => {
                const isOpen = expandedMortDate === g.date;
                const cause = g.causes.length > 1 ? "Mixed" : (g.causes[0] ?? "—");
                const breakdown = Object.entries(g.byRoom)
                  .map(([r, n]) => `${r.replace(/^ROOM\s*/i, "R")}: ${n}`)
                  .join(" · ");
                return (
                  <div key={g.date} className="rounded-xl bg-destructive/5 border border-destructive/10 overflow-hidden">
                    <button
                      onClick={() => setExpandedMortDate(isOpen ? null : g.date)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive"><Skull className="h-3.5 w-3.5" /></span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{formatDayLabel(g.date)} <span className="text-destructive">· {birdsLabel(g.total)}</span></div>
                          <div className="text-xs text-muted-foreground truncate">{breakdown || "—"} <span className="opacity-70">| {cause}</span></div>
                        </div>
                      </div>
                      <ChevronDown className={"h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (isOpen ? "rotate-180" : "")} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-destructive/10 bg-background/60 px-3 py-2 space-y-1.5">
                        {g.items.map(m => (
                          <div key={m.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium">{m.room}</span>
                              <span className="text-muted-foreground truncate">· {m.cause}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-destructive font-semibold">{Math.abs(m.loss)}</span>
                              <RowActions onEdit={() => editMortality(m)} onDelete={() => delMortalityRow(m)} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {mortalityByDate.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">No mortality records yet.</div>
              )}
            </div>
            {mortalityByDate.length > 7 && (
              <div className="mt-3 text-center">
                <button onClick={() => setMortShowAll(v => !v)} className="text-xs font-medium text-[color:var(--forest)] hover:underline">
                  {mortShowAll ? "Show latest 7 only" : `View all mortality records (${mortalityByDate.length})`}
                </button>
              </div>
            )}
          </Card>
        </div>

        {/* Health */}
        <Card>
          <CardHeader title="Health Records" subtitle="Vaccinations, vitamins & observations" right={<ActionBtn onClick={addHealth} icon={Plus}>Add</ActionBtn>} />
          <div className="mt-4 space-y-2">
            {(healthShowAll ? healthByDate : healthByDate.slice(0, 5)).map(h => {
              const style = healthTypeStyle(h.type);
              const Icon = style.icon;
              return (
              <div key={h.id} className="flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={"grid h-9 w-9 place-items-center rounded-lg " + style.wrap}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{h.name}</div>
                    <div className="text-xs text-muted-foreground">{h.scope}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + style.badge}>{h.type}</span>
                    <div className="text-xs text-muted-foreground mt-1">{h.date}</div>
                  </div>
                  <RowActions onEdit={() => editHealth(h)} onDelete={() => delHealthRow(h)} />
                </div>
              </div>
              );
            })}
            {healthByDate.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">No health records yet.</div>
            )}
          </div>
          {healthByDate.length > 5 && (
            <div className="mt-3 text-center">
              <button onClick={() => setHealthShowAll(v => !v)} className="text-xs font-medium text-[color:var(--forest)] hover:underline">
                {healthShowAll ? "Show recent records" : `View all health records (${healthByDate.length})`}
              </button>
            </div>
          )}
        </Card>

        {/* Room Management */}
        <Card>
          <CardHeader
            title={<span className="inline-flex items-center gap-2"><Bird className="h-5 w-5 text-[color:var(--forest)]" /> Room Management</span>}
            subtitle="Add, edit or remove poultry rooms — scalable for unlimited rooms"
            right={<ActionBtn onClick={addRoom} icon={Plus}>Add Room</ActionBtn>}
          />
          <div className="grid grid-cols-3 gap-3 mt-4">
            <MiniStat label="Total Birds" value={totalBirds.toLocaleString()} tone="sky" />
            <MiniStat label="Active Rooms" value={String(rooms.length)} tone="mint" />
            <MiniStat label="Total Loss" value={String(totalLoss)} tone="peach" />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Room</th>
                  <th className="py-2 pr-4 font-medium">Current</th>
                  <th className="py-2 pr-4 font-medium">Initial</th>
                  <th className="py-2 pr-4 font-medium">Loss</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(r => {
                  const loss = r.initial - r.current;
                  const pct = ((loss / (r.initial || 1)) * 100).toFixed(1);
                  return (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-3 pr-4 flex items-center gap-2"><Bird className="h-4 w-4 text-[color:var(--forest)]" />{r.name}</td>
                      <td className="py-3 pr-4">{r.current.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{r.initial.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-destructive">-{loss} <span className="text-xs">({pct}%)</span></td>
                      <td className="py-3 pr-4"><span className="inline-flex rounded-full bg-[color:var(--forest)] text-primary-foreground px-2.5 py-0.5 text-xs font-medium">Healthy</span></td>
                      <td className="py-3 pr-4 text-right">
                        <button onClick={() => delRoom(r.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4 inline" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Feed Management */}
        <Card>
          <CardHeader
            title="Feed Management"
            subtitle="Formulas & daily usage"
            right={
              <div className="inline-flex rounded-full bg-secondary p-1 text-xs font-medium">
                {(["Usage", "Formulas"] as const).map(t => (
                  <button key={t} onClick={() => setFeedTab(t)} className={"px-3 py-1 rounded-full transition " + (feedTab === t ? "bg-[color:var(--forest)] text-primary-foreground" : "text-muted-foreground")}>{t}</button>
                ))}
              </div>
            }
          />
          <div className="mt-4 flex justify-end">
            <ActionBtn onClick={recordFeed} icon={Plus}>Record Feed</ActionBtn>
          </div>
          {feedTab === "Usage" ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <MiniStat label="Today's Feed" value={`${feedToday} bags`} tone="sky" />
                <MiniStat label="7-Day Avg" value={`${feed7Avg.toFixed(1)} bags`} tone="mint" />
                <MiniStat label="Feed / Bird" value={`${feedPerBirdG.toFixed(0)} g`} tone="plain" />
                <MiniStat label="30-Day Usage" value={`${feed30Total.toFixed(1)} bags`} tone="peach" />
              </div>
              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground bg-[color:var(--gold)]/10">
                      <th className="py-2 px-3 font-medium">Date</th>
                      {feedRoomNames.map(rn => (
                        <th key={rn} className="py-2 px-3 font-medium text-right whitespace-nowrap">{rn.replace(/^ROOM\s*/i, "R")}</th>
                      ))}
                      <th className="py-2 px-3 font-medium text-right whitespace-nowrap">Total</th>
                      <th className="py-2 px-2 w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(feedShowAll ? feedByDate : feedByDate.slice(0, 7)).map(g => {
                      const isOpen = expandedFeedDate === g.date;
                      return (
                        <Fragment key={g.date}>
                          <tr key={g.date} className="border-t border-border/60 hover:bg-[color:var(--gold)]/5 cursor-pointer" onClick={() => setExpandedFeedDate(isOpen ? null : g.date)}>
                            <td className="py-2 px-3 font-medium whitespace-nowrap">{g.date}</td>
                            {feedRoomNames.map(rn => (
                              <td key={rn} className="py-2 px-3 text-right tabular-nums">{g.byRoom[rn] ? g.byRoom[rn] : <span className="text-muted-foreground/50">—</span>}</td>
                            ))}
                            <td className="py-2 px-3 text-right font-semibold tabular-nums whitespace-nowrap">{g.total} bags</td>
                            <td className="py-2 px-2 text-muted-foreground"><ChevronDown className={"h-3.5 w-3.5 transition-transform " + (isOpen ? "rotate-180" : "")} /></td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-background/60">
                              <td colSpan={feedRoomNames.length + 3} className="px-3 py-2">
                                <div className="mb-2 flex justify-end">
                                  <button onClick={(e) => { e.stopPropagation(); editFeedDay(g.items); }} className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--forest)] hover:underline">
                                    <Pencil className="h-3 w-3" /> Edit daily feed usage
                                  </button>
                                </div>
                                <div className="space-y-1">
                                  {g.items.map(f => (
                                    <div key={f.id} className="flex items-center justify-between text-xs">
                                      <span className="font-medium">{f.room}</span>
                                      <div className="flex items-center gap-3">
                                        <span className="tabular-nums">{f.bags} bags</span>
                                        <RowActions onEdit={() => editFeed(f)} onDelete={() => delFeedRow(f)} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {feedByDate.length === 0 && (
                      <tr><td colSpan={feedRoomNames.length + 3} className="py-4 text-center text-muted-foreground">No feed records yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {feedByDate.length > 7 && (
                <div className="mt-3 text-center">
                  <button onClick={() => setFeedShowAll(v => !v)} className="text-xs font-medium text-[color:var(--forest)] hover:underline">
                    {feedShowAll ? "Show latest 7 only" : `View all feed records (${feedByDate.length})`}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="mt-4 p-6 text-center text-muted-foreground text-sm bg-secondary/40 rounded-xl">No custom formulas yet.</div>
          )}
        </Card>

        {/* Prices */}
        <Card>
          <CardHeader
            title={<span className="inline-flex items-center gap-2"><DollarSign className="h-5 w-5 text-[color:var(--forest)]" /> Current Prices</span>}
            subtitle="Update egg, feed, and ingredient prices anytime"
            right={<ActionBtn onClick={addPrice} icon={Plus}>Add Price Item</ActionBtn>}
          />
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Item</th>
                  <th className="py-2 pr-4 font-medium">Unit</th>
                  <th className="py-2 pr-4 font-medium">Price (₦)</th>
                  <th className="py-2 pr-4 font-medium">Last Updated</th>
                  <th className="py-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {prices.map(p => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-3 pr-4">{p.item}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{p.unit}</td>
                    <td className="py-3 pr-4 font-semibold">{naira(p.price)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{p.updated}</td>
                    <td className="py-3 pr-4 text-right space-x-3">
                      <button onClick={() => openDialog({ kind: "price-edit", item: p })} className="text-muted-foreground hover:text-foreground" aria-label={`Edit ${p.item}`}><Pencil className="h-4 w-4 inline" /></button>
                      <button onClick={() => delPrice(p.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4 inline" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
          </div>
        )}

        {area === "ai" && (
          <div className="space-y-6">
            <SectionIntro
              stage="PREDICT" plan="Premium" title="PoultryPro AI Intelligence" premium
              body="Progressively applying artificial intelligence to detect abnormal farm patterns, forecast production and support earlier evidence-based decisions."
            />
            {/* AI-Supported Farm Insights — final summary layer combining PoultryPro modules */}
            <FarmInsightsIntelligence
              eggs={eggs} rooms={rooms} mortality={mortality} feed={feed} health={health} prices={prices}
              bagWeightKg={bagWeightKg}
              loading={eggsQ.isLoading || roomsQ.isLoading || mortalityQ.isLoading || feedQ.isLoading || healthQ.isLoading || pricesQ.isLoading}
            />

            {/* Production Decline Detection — real-time from farm records */}
            <ProductionDeclineIntelligence eggs={eggs} rooms={rooms} mortality={mortality} feed={feed} health={health} />

            {/* Mortality Pattern Detection — real-time from farm records */}
            <MortalityPatternIntelligence eggs={eggs} rooms={rooms} mortality={mortality} feed={feed} health={health} />


            {/* AI Intelligence Preview — computed from real records */}
            <div className="rounded-3xl border border-[color:var(--gold)]/40 bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--ink)] text-primary-foreground p-6 md:p-7 shadow-[var(--shadow-lift)]">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
                <Sparkles className="h-3.5 w-3.5" /> AI Intelligence Preview
              </div>
              <h3 className="mt-1 font-display text-2xl md:text-3xl font-semibold">Analytical decision-support preview</h3>
              <p className="mt-1 text-sm text-primary-foreground/70 max-w-2xl">
                Rule-based observations generated from your existing farm records while full ML models progressively roll out.
              </p>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                <PreviewInsight
                  kicker="Production Monitoring"
                  metric={`${productionRate}%`}
                  metricLabel={`Farm target: 80%`}
                  observation={
                    productionRate >= 80
                      ? `Current production is ${productionRate - 80} percentage points above the configured farm target.`
                      : `Current production is ${80 - productionRate} percentage point${80 - productionRate === 1 ? "" : "s"} below the configured farm target.`
                  }
                  action="Review recent production, feed and health records for changes that may require investigation."
                />
                <PreviewInsight
                  kicker="Production Trend"
                  metric={`${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%`}
                  metricLabel="vs previous recorded day"
                  observation={
                    diffPct >= 0
                      ? `Today's recorded production is ${diffPct.toFixed(1)}% higher than the previous recorded day.`
                      : `Today's recorded production is ${Math.abs(diffPct).toFixed(1)}% lower than the previous recorded day.`
                  }
                  action="Continue monitoring the next production records to determine whether this movement is temporary or developing into a trend."
                />
                <PreviewInsight
                  kicker="Mortality Watch"
                  metric={String(monthlyMortality)}
                  metricLabel="losses this month"
                  observation={
                    monthlyMortality === 0
                      ? "No mortality has been recorded this month across active rooms."
                      : `${monthlyMortality} bird loss${monthlyMortality === 1 ? "" : "es"} recorded this month across active rooms.`
                  }
                  action="Cross-check mortality entries against recent health records and feed batches for any correlated changes."
                />
                <PreviewInsight
                  kicker="Feed vs Production"
                  metric={`${feedToday} bags`}
                  metricLabel={`for ${todayEggs.toLocaleString()} eggs today`}
                  observation={`Today's feed usage is ${feedToday} bags against ${todayEggs.toLocaleString()} eggs produced across ${rooms.length} rooms.`}
                  action="Watch for feed usage rising while egg output stays flat — an early signal of efficiency change."
                />
              </div>

              <div className="mt-5 text-[11px] text-primary-foreground/60 border-t border-white/10 pt-3">
                PoultryPro AI Intelligence provides operational decision support and does not replace veterinary diagnosis or professional farm management judgement.
              </div>
            </div>

            {/* Capability cards — Progressive Rollout */}
            <Card>
              <CardHeader
                title={<span className="inline-flex items-center gap-2"><Brain className="h-5 w-5 text-[color:var(--forest)]" /> Premium AI Capabilities</span>}
                subtitle="Progressively rolling out on the Premium plan"
              />
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <AiCard icon={LineChartIcon} title="Production Forecasting"
                  desc="Analyse historical egg production patterns to support short-term production forecasting."
                  active={forecastOpen}
                  onClick={() => setForecastOpen(v => !v)}
                  actionLabel={forecastOpen ? "Hide 7-day forecast" : "Open 7-day forecast"}
                  badge="Early Predictive Model" />
                <AiCard icon={TrendingDown} title="Production Decline Detection"
                  desc="Monitor production trends and flag unusual declines for earlier investigation." />
                <AiCard icon={AlertTriangle} title="Mortality Risk Monitoring"
                  desc="Analyse mortality patterns across rooms and flocks to identify abnormal changes."
                  active={mortalityOpen}
                  onClick={() => setMortalityOpen(v => !v)}
                  actionLabel={mortalityOpen ? "Hide mortality risk monitor" : "Open mortality risk monitor"}
                  badge="Early Risk Model" />
                <AiCard icon={Wheat} title="Feed Efficiency Monitoring"
                  desc="Compare feed usage with production performance to identify possible efficiency changes."
                  active={feedEffOpen}
                  onClick={() => setFeedEffOpen(v => !v)}
                  actionLabel={feedEffOpen ? "Hide feed efficiency monitor" : "Open feed efficiency monitor"}
                  badge="Early Efficiency Model" />
                <AiCard icon={Radar} title="Abnormal Farm Activity Detection"
                  desc="Cross-analyse production, mortality, feed and health records to detect unusual operational patterns."
                  active={activityOpen}
                  onClick={() => setActivityOpen(v => !v)}
                  actionLabel={activityOpen ? "Hide activity monitor" : "Open activity monitor"}
                  badge="Early Anomaly Model" />
                <AiCard icon={Lightbulb} title="AI-Supported Farm Insights"
                  desc="Transform farm data patterns into clear operational observations and decision-support recommendations." />
              </div>
            </Card>

            {forecastOpen && (
              <ProductionForecast eggs={eggs} totalBirds={totalBirds} />
            )}

            {mortalityOpen && (
              <MortalityRiskMonitor rooms={rooms} mortality={mortality} eggs={eggs} health={health} />
            )}

            {feedEffOpen && (
              <FeedEfficiencyMonitor
                rooms={rooms} feed={feed} eggs={eggs} mortality={mortality} health={health}
                bagWeightKg={bagWeightKg} onBagWeightChange={setBagWeightKg}
              />
            )}

            {activityOpen && (
              <AbnormalActivityMonitor
                rooms={rooms} eggs={eggs} feed={feed} mortality={mortality} health={health}
                bagWeightKg={bagWeightKg}
              />
            )}
          </div>
        )}

        <div className="pt-6 text-center text-xs text-muted-foreground">
          {new Date().getFullYear()} {farm?.name ?? "Your Farm"} — Poultry Farm Management System
        </div>
      </main>
      <RecordDialogs state={dialog} onClose={() => setDialog(null)} rooms={rooms} />
      <RecordConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />

    </div>
  );
}

/* ------------------ small building blocks ------------------ */

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-3xl bg-card border border-border p-5 md:p-6 shadow-[var(--shadow-soft)]">{children}</section>;
}

function CardHeader({ title, subtitle, right }: { title: React.ReactNode; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-xl md:text-2xl font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

const toneMap = {
  mint: "bg-[color:var(--forest)]/8 border-[color:var(--forest)]/15",
  sky: "bg-blue-500/8 border-blue-500/15",
  peach: "bg-[color:var(--gold)]/15 border-[color:var(--gold)]/25",
  plain: "bg-card border-border",
} as const;

function KpiCard({ tone, icon: Icon, label, value, hint, trend }: {
  tone: keyof typeof toneMap; icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; hint?: string;
  trend?: { up: boolean; text: string };
}) {
  return (
    <div className={"rounded-2xl border p-5 " + toneMap[tone]}>
      <div className="flex items-start justify-between">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-background/60"><Icon className="h-4 w-4 text-[color:var(--forest)]" /></span>
      </div>
      <div className="mt-3 font-display text-3xl md:text-4xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      {trend && (
        <div className={"mt-2 text-xs inline-flex items-center gap-1 " + (trend.up ? "text-[color:var(--forest)]" : "text-destructive")}>
          {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} {trend.text}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: keyof typeof toneMap }) {
  return (
    <div className={"rounded-xl border p-3 " + toneMap[tone]}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Egg className="h-3.5 w-3.5" /> {label}</div>
      <div className="font-display text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function ActionBtn({ onClick, icon: Icon, children }: { onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--forest)] text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition">
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function RowActions({ onEdit, onDelete, extra }: { onEdit: () => void; onDelete: () => void; extra?: { label: string; onClick: () => void } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Row actions"
        onClick={() => setOpen(v => !v)}
        className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-30 min-w-[160px] rounded-xl border border-border bg-background shadow-lg overflow-hidden">
            {extra && (
              <button onClick={() => { setOpen(false); extra.onClick(); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-secondary">
                <Pencil className="h-3.5 w-3.5" /> {extra.label}
              </button>
            )}
            <button onClick={() => { setOpen(false); onEdit(); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-secondary">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}



function AreaTab({ active, onClick, num, stage, title, shortLabel, plan, icon: Icon, premium }: {
  active: boolean; onClick: () => void; num: string; stage: string; title: string; shortLabel?: string; plan: string;
  icon: React.ComponentType<{ className?: string }>; premium?: boolean;
}) {
  const label = shortLabel ?? title;
  return (
    <button
      onClick={onClick}
      className={
        "group text-left rounded-xl md:rounded-2xl border px-2 py-2 md:p-4 transition min-w-0 " +
        (active
          ? (premium
              ? "bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--ink)] text-primary-foreground border-[color:var(--gold)]/50 shadow-[var(--shadow-soft)]"
              : "bg-[color:var(--forest)] text-primary-foreground border-[color:var(--forest)] shadow-[var(--shadow-soft)]")
          : "bg-card text-[color:var(--forest)] border-border hover:border-[color:var(--forest)]/40")
      }
    >
      <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
        <span className={"grid h-7 w-7 md:h-8 md:w-8 shrink-0 place-items-center rounded-lg " + (active ? "bg-white/10 text-[color:var(--gold)]" : "bg-[color:var(--forest)]/8 text-[color:var(--forest)]")}>
          <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className={"hidden md:block text-[10px] uppercase tracking-[0.18em] " + (active ? "text-[color:var(--gold)]" : "text-muted-foreground")}>
            {num} · {stage}
          </div>
          {/* Mobile: short label; Desktop: full title */}
          <div className="text-[13px] md:text-base font-semibold leading-tight">
            <span className="md:hidden">{label}</span>
            <span className="hidden md:inline">{title}</span>
          </div>
        </div>
      </div>
      <div className={"mt-2 hidden md:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " + (active ? "bg-white/10 text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
        {plan} plan
      </div>
    </button>
  );
}

function MobileMenu({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-primary-foreground hover:bg-white/10"
      >
        {open ? <CloseIcon className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-[var(--shadow-lift)]">
            <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-secondary">
              <ArrowLeft className="h-4 w-4 text-[color:var(--forest)]" /> Back to site
            </Link>
            <Link to="/import" onClick={() => setOpen(false)} className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm hover:bg-secondary">
              <Upload className="h-4 w-4 text-[color:var(--forest)]" /> Import CSV
            </Link>
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-sm text-destructive hover:bg-destructive/5"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}


function SectionIntro({ stage, plan, title, body, premium }: {
  stage: string; plan: string; title: string; body: string; premium?: boolean;
}) {
  return (
    <div className={"rounded-3xl border p-5 md:p-6 " + (premium
      ? "bg-gradient-to-br from-[color:var(--forest)]/5 to-[color:var(--gold)]/10 border-[color:var(--gold)]/30"
      : "bg-card border-border")}>
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)]">
        <span>{stage}</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="rounded-full bg-[color:var(--forest)]/8 px-2 py-0.5 text-[10px] tracking-[0.16em] text-[color:var(--forest)]">{plan} plan</span>
        {premium && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] tracking-[0.16em] text-[color:var(--ink)]">
            <Sparkles className="h-3 w-3" /> Progressive rollout
          </span>
        )}
      </div>
      <h2 className="mt-1 font-display text-2xl md:text-3xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-3xl">{body}</p>
    </div>
  );
}

function InsightRow({ label, value, detail, positive }: {
  label: string; value: string; detail: string; positive: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground min-w-0">{label}</div>
        <span className={"shrink-0 inline-flex items-center gap-1 text-xs " + (positive ? "text-[color:var(--forest)]" : "text-destructive")}>
          <Activity className="h-3 w-3" />
        </span>
      </div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function PreviewInsight({ kicker, metric, metricLabel, observation, action }: {
  kicker: string; metric: string; metricLabel: string; observation: string; action: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--gold)]">{kicker}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <div className="font-display text-2xl font-semibold text-primary-foreground">{metric}</div>
        <div className="text-[11px] text-primary-foreground/60">{metricLabel}</div>
      </div>
      <div className="mt-2 text-xs text-primary-foreground/85 leading-relaxed">
        <span className="text-primary-foreground/60">Observation: </span>{observation}
      </div>
      <div className="mt-1.5 text-xs text-primary-foreground/85 leading-relaxed">
        <span className="text-primary-foreground/60">Suggested action: </span>{action}
      </div>
    </div>
  );
}

function AiCard({ icon: Icon, title, desc, active, onClick, actionLabel, badge }: {
  icon: React.ComponentType<{ className?: string }>; title: string; desc: string;
  active?: boolean; onClick?: () => void; actionLabel?: string; badge?: string;
}) {
  const interactive = typeof onClick === "function";
  const Wrap: React.ElementType = interactive ? "button" : "div";
  return (
    <Wrap
      {...(interactive ? { onClick, type: "button" } : {})}
      className={
        "relative text-left rounded-2xl border p-4 transition w-full " +
        (interactive
          ? (active
              ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10 shadow-[var(--shadow-soft)]"
              : "border-border bg-secondary/30 hover:border-[color:var(--forest)]/40 hover:bg-secondary/50")
          : "border-border bg-secondary/30")
      }
    >
      <span className="absolute right-3 top-3 rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase text-[color:var(--ink)]">
        {badge ?? "Progressive Rollout"}
      </span>
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--forest)]/10 text-[color:var(--forest)]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="mt-3 font-display text-base md:text-lg font-semibold pr-24">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{desc}</div>
      {interactive && (
        <div className={"mt-3 inline-flex items-center gap-1 text-xs font-medium " + (active ? "text-[color:var(--forest)]" : "text-[color:var(--forest)]/80")}>
          <Sparkles className="h-3 w-3" /> {actionLabel}
          <ArrowRight className="h-3 w-3" />
        </div>
      )}
    </Wrap>
  );
}

/* ------------------ Production Forecast ------------------ */

function ProductionForecast({ eggs, totalBirds }: { eggs: EggRow[]; totalBirds: number }) {
  const forecast = useMemo(() => computeForecast(eggs, totalBirds), [eggs, totalBirds]);

  if (!forecast) {
    return (
      <Card>
        <CardHeader
          title="7-Day Production Forecast"
          subtitle="Short-term production outlook calculated from recent farm production patterns."
        />
        <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Not enough historical production records yet to generate a forecast. Add a few more daily egg-production entries to unlock the 7-day outlook.
        </div>
      </Card>
    );
  }

  const {
    latestTotal, latestPct, avgForecast, low, high, direction, chartData, boundaryLabel,
  } = forecast;

  const isDeclining = direction === "Declining" || direction === "Stable with downward movement";
  const isImproving = direction === "Increasing" || direction === "Stable with upward movement";
  const directionTone =
    direction === "Increasing" ? "text-[color:var(--forest)]"
    : direction === "Declining" ? "text-destructive"
    : direction === "Stable with upward movement" ? "text-[color:var(--forest)]/80"
    : direction === "Stable with downward movement" ? "text-destructive/80"
    : "text-muted-foreground";
  const DirectionIcon =
    isImproving ? TrendingUp
    : isDeclining ? TrendingDown
    : Activity;

  const observation =
    direction === "Increasing"
      ? "Recent production records indicate a clearly improving production pattern."
      : direction === "Stable with upward movement"
        ? "Recent production remains within its normal range but shows a mild upward movement."
        : direction === "Declining"
          ? "Recent production records indicate a clearly softening production pattern that warrants attention."
          : direction === "Stable with downward movement"
            ? "Recent production remains within its normal range but shows a mild downward movement worth monitoring."
            : "Recent production records indicate a relatively stable production pattern with minimal movement.";
  const outlook =
    direction === "Declining"
      ? `Projected daily production over the next 7 days is around ${avgForecast.toLocaleString()} eggs, within a ${low.toLocaleString()}–${high.toLocaleString()} range if the current downward movement continues.`
      : `Production is projected to remain within roughly ${low.toLocaleString()}–${high.toLocaleString()} eggs per day (average ~${avgForecast.toLocaleString()}) if current operating conditions remain similar.`;
  const action =
    direction === "Declining"
      ? "Investigate recent feed, health and mortality records for changes that may be driving the decline, and continue monitoring daily production closely."
      : direction === "Stable with downward movement"
        ? "Continue monitoring feed, health and daily egg production to confirm whether the mild downward movement remains within normal variation."
        : "Continue monitoring feed usage, mortality and daily egg production for changes that may affect the projected trend.";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)]">
            <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> Predict</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] tracking-[0.16em] text-[color:var(--ink)]">Early Predictive Model</span>
          </div>
          <h2 className="mt-1 font-display text-2xl md:text-3xl font-semibold">7-Day Production Forecast</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Short-term production outlook calculated from recent farm production patterns.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <ForecastStat
          label="Current Production"
          value={latestTotal.toLocaleString()}
          hint={`${latestPct}% production rate${totalBirds ? ` · ${totalBirds.toLocaleString()} birds` : ""}`}
        />
        <ForecastStat
          label="7-Day Forecast (avg/day)"
          value={avgForecast.toLocaleString()}
          hint="Projected average daily eggs"
        />
        <ForecastStat
          label="Expected Range"
          value={`${low.toLocaleString()}–${high.toLocaleString()}`}
          hint="Based on recent variation"
        />
        <ForecastStat
          label="Forecast Direction"
          value={direction}
          hint="From recent production trend"
          valueClassName={directionTone}
          icon={DirectionIcon}
        />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold">Production Trend &amp; 7-Day Outlook</h3>
            <p className="text-xs text-muted-foreground">Historical daily eggs on the left of the marker · forecast on the right.</p>
          </div>
        </div>
        <div className="h-72 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 85)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine x={boundaryLabel} stroke="oklch(0.55 0.15 60)" strokeDasharray="4 4"
                label={{ value: "Forecast starts", position: "top", fill: "oklch(0.45 0.12 60)", fontSize: 10 }} />
              <Line type="monotone" dataKey="Historical" stroke="oklch(0.32 0.06 155)" strokeWidth={2.5} dot={{ r: 2 }} connectNulls={false} />
              <Line type="monotone" dataKey="Forecast" stroke="oklch(0.55 0.15 60)" strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 2 }} connectNulls={false} />
              <Line type="monotone" dataKey="Upper" stroke="oklch(0.55 0.15 60)" strokeOpacity={0.35} strokeWidth={1} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="Lower" stroke="oklch(0.55 0.15 60)" strokeOpacity={0.35} strokeWidth={1} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/8 p-4 md:p-5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink)]">
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> PoultryPro Insight
        </div>
        <div className="mt-2 text-sm leading-relaxed">
          <div><span className="text-muted-foreground">Observation: </span>{observation}</div>
          <div className="mt-1.5"><span className="text-muted-foreground">7-Day Outlook: </span>{outlook}</div>
          <div className="mt-1.5"><span className="text-muted-foreground">Suggested Action: </span>{action}</div>
        </div>
        {direction === "Declining" && (
          <div className="mt-3 inline-flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Recent production shows a downward movement — flagged for attention. This is a pattern signal only and does not diagnose disease.</span>
          </div>
        )}
      </div>

      <div className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
        Forecast generated from historical farm production patterns and recent production trends. Forecasts provide operational decision support and may change as new farm records are added.
      </div>
    </Card>
  );
}

function ForecastStat({ label, value, hint, valueClassName, icon: Icon }: {
  label: string; value: string; hint?: string; valueClassName?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={"mt-1.5 font-display text-2xl md:text-3xl font-semibold inline-flex items-center gap-2 " + (valueClassName ?? "")}>
        {Icon && <Icon className="h-5 w-5" />} {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}


/* ------------------ Mortality Risk Monitor ------------------ */


type MortalityRiskProps = {
  rooms: Room[];
  mortality: Mortality[];
  eggs: EggRow[];
  health: Health[];
};

function MortalityRiskMonitor({ rooms, mortality, eggs, health }: MortalityRiskProps) {
  const analysis = useMemo(
    () => computeMortalityRisk(rooms, mortality, eggs, health),
    [rooms, mortality, eggs, health],
  );

  if (!analysis) {
    return (
      <Card>
        <CardHeader
          title="Mortality Risk Monitor"
          subtitle="Early operational risk monitoring based on mortality patterns and farm records."
        />
        <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Not enough mortality or room records yet to generate a risk analysis.
        </div>
      </Card>
    );
  }

  const {
    levelLabel, levelTone, score, monthlyMortality, mostAffectedRoom,
    patternLabel, rooms: roomRows, timeline, insight, periodLabel,
  } = analysis;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)]">
            <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> Predict</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] tracking-[0.16em] text-[color:var(--ink)]">Early Risk Model</span>
          </div>
          <h2 className="mt-1 font-display text-2xl md:text-3xl font-semibold">Mortality Risk Monitor</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Early operational risk monitoring based on mortality patterns and farm records.
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Analysis window: {periodLabel}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <ForecastStat
          label="Current Risk Level"
          value={levelLabel}
          hint={`Risk score ${score}/100`}
          valueClassName={levelTone}
          icon={AlertTriangle}
        />
        <ForecastStat
          label="Mortality This Month"
          value={String(monthlyMortality)}
          hint="Total bird losses recorded this month"
        />
        <ForecastStat
          label="Most Affected Room"
          value={mostAffectedRoom ? mostAffectedRoom.name : "—"}
          hint={mostAffectedRoom
            ? `${mostAffectedRoom.lost} lost · ${mostAffectedRoom.events} event${mostAffectedRoom.events === 1 ? "" : "s"}`
            : "No mortality recorded in period"}
        />
        <ForecastStat
          label="Recent Mortality Pattern"
          value={patternLabel}
          hint="Based on frequency and concentration"
        />
      </div>

      {/* Room-level risk analysis */}
      <div className="mt-6">
        <h3 className="font-display text-lg font-semibold">Room-Level Risk Analysis</h3>
        <p className="text-xs text-muted-foreground">Each active room analysed separately from stored mortality and bird records.</p>

        {/* Mobile: stacked cards */}
        <div className="mt-3 grid gap-3 md:hidden">
          {roomRows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No active rooms configured.</div>
          )}
          {roomRows.map(r => (
            <div key={r.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{r.name}</div>
                <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + riskBadgeClass(r.levelLabel)}>
                  {r.levelLabel} · {r.score}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Live Birds</dt><dd>{r.current.toLocaleString()}</dd></div>
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Lost (period)</dt><dd>{r.lost}</dd></div>
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Mortality %</dt><dd>{r.ratePct.toFixed(2)}%</dd></div>
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Events</dt><dd>{r.events}</dd></div>
                <div className="col-span-2"><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Last Event</dt><dd className="text-muted-foreground">{r.lastEventLabel ?? "—"}</dd></div>
              </dl>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="mt-3 hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-4 font-medium">Room</th>
                <th className="py-2 pr-4 font-medium">Live Birds</th>
                <th className="py-2 pr-4 font-medium">Lost (period)</th>
                <th className="py-2 pr-4 font-medium">Mortality %</th>
                <th className="py-2 pr-4 font-medium">Events</th>
                <th className="py-2 pr-4 font-medium">Last Event</th>
                <th className="py-2 pr-4 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {roomRows.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-3 pr-4 font-medium">{r.name}</td>
                  <td className="py-3 pr-4">{r.current.toLocaleString()}</td>
                  <td className="py-3 pr-4">{r.lost}</td>
                  <td className="py-3 pr-4">{r.ratePct.toFixed(2)}%</td>
                  <td className="py-3 pr-4">{r.events}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{r.lastEventLabel ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + riskBadgeClass(r.levelLabel)}>
                      {r.levelLabel} · {r.score}
                    </span>
                  </td>
                </tr>
              ))}
              {roomRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-muted-foreground">No active rooms configured.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-6">
        <h3 className="font-display text-lg font-semibold">Mortality Pattern Timeline</h3>
        <p className="text-xs text-muted-foreground">Bird losses by date and room — repeated events in the same room stack together.</p>
        <div className="h-64 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeline.data} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 85)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {timeline.roomKeys.map((key, idx) => (
                <Bar key={key} dataKey={key} stackId="m" fill={TIMELINE_COLORS[idx % TIMELINE_COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {timeline.data.length === 0 && (
          <div className="mt-2 text-xs text-muted-foreground">No mortality events in the current analysis window.</div>
        )}
      </div>

      {/* Insight */}
      <div className="mt-6 rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/8 p-4 md:p-5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink)]">
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> PoultryPro Risk Insight
        </div>
        <div className="mt-2 text-sm leading-relaxed">
          <div><span className="text-muted-foreground">Observation: </span>{insight.observation}</div>
          <div className="mt-1.5"><span className="text-muted-foreground">Risk Interpretation: </span>{insight.interpretation}</div>
          <div className="mt-1.5"><span className="text-muted-foreground">Suggested Action: </span>{insight.action}</div>
        </div>
        {insight.repeatedRoom && (
          <div className="mt-3 inline-flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Repeated mortality events recorded in {insight.repeatedRoom} within the analysis period.
              Pattern is concentrated in one production room rather than evenly distributed across the farm.
            </span>
          </div>
        )}
      </div>

      {/* Methodology */}
      <div className="mt-4 rounded-2xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed">
        <div className="font-medium text-[color:var(--ink)]">Risk Methodology (transparent weighted score, 0–100)</div>
        <ul className="mt-1.5 grid gap-1 md:grid-cols-2 text-muted-foreground">
          <li>Mortality Rate — 40%</li>
          <li>Mortality Event Frequency — 30%</li>
          <li>Room Concentration — 20%</li>
          <li>Recent Trend — 10%</li>
        </ul>
        <div className="mt-2 text-muted-foreground">
          Classification: 0–24 LOW · 25–49 MODERATE · 50–74 ELEVATED · 75–100 HIGH.
        </div>
        <div className="mt-2 text-muted-foreground">
          Risk monitoring is generated from recorded farm mortality and operational patterns. It provides early decision
          support and does not constitute veterinary diagnosis.
        </div>
      </div>
    </Card>
  );
}

const TIMELINE_COLORS = [
  "oklch(0.55 0.15 60)",
  "oklch(0.45 0.12 155)",
  "oklch(0.6 0.14 25)",
  "oklch(0.5 0.12 250)",
  "oklch(0.6 0.14 320)",
];

function riskBadgeClass(level: RiskLevel): string {
  switch (level) {
    case "HIGH": return "bg-destructive text-destructive-foreground";
    case "ELEVATED": return "bg-[color:var(--gold)]/30 text-[color:var(--ink)]";
    case "MODERATE": return "bg-[color:var(--gold)]/15 text-[color:var(--ink)]";
    default: return "bg-[color:var(--forest)] text-primary-foreground";
  }
}


/* ------------------ Feed Efficiency Monitor ------------------ */

type FeedEfficiencyProps = {
  rooms: Room[];
  feed: Feed[];
  eggs: EggRow[];
  mortality: Mortality[];
  health: Health[];
  bagWeightKg: number | null;
  onBagWeightChange: (v: number | null) => void;
};


function FeedEfficiencyMonitor({
  rooms, feed, eggs, mortality, health, bagWeightKg, onBagWeightChange,
}: FeedEfficiencyProps) {
  const analysis = useMemo(
    () => computeFeedEfficiency(rooms, feed, eggs, mortality, health, bagWeightKg),
    [rooms, feed, eggs, mortality, health, bagWeightKg],
  );

  const hasWeight = typeof bagWeightKg === "number" && bagWeightKg > 0;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)]">
            <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> Predict</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] tracking-[0.16em] text-[color:var(--ink)]">Early Efficiency Model</span>
          </div>
          <h2 className="mt-1 font-display text-2xl md:text-3xl font-semibold">Feed Efficiency Monitor</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Operational efficiency monitoring based on feed usage and egg production patterns.
          </p>
          {analysis && (
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Matched records: {analysis.matched.length} · Latest matched date: {analysis.latestLabel ?? "—"}
            </p>
          )}
        </div>
      </div>

      {/* Farm configuration */}
      <div className="mt-5 rounded-2xl border border-border bg-secondary/30 p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Standard Feed Bag Weight (kg)
            </label>
            <input
              type="number" inputMode="decimal" min={0} step={0.5}
              value={hasWeight ? String(bagWeightKg) : ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onBagWeightChange(Number.isFinite(v) && v > 0 ? v : null);
              }}
              placeholder="Configure bag weight in kg"
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Configurable by the farm administrator. Used to convert bag-based feed records into kilogrammes.
            </p>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {hasWeight
              ? `1 bag = ${bagWeightKg} kg`
              : "Feed weight configuration required for kg-based efficiency calculations."}
          </div>
        </div>
      </div>

      {!analysis && (() => {
        const prodKeys = new Set(eggs.map(e => toDateKey(e.date)).filter((k): k is string => !!k));
        const feedKeys = new Set(feed.map(f => toDateKey(f.date)).filter((k): k is string => !!k));
        const matchedCount = [...feedKeys].filter(k => prodKeys.has(k)).length;
        const reason =
          prodKeys.size === 0
            ? "No production records available yet. Record daily egg production to begin feed efficiency analysis."
            : feedKeys.size === 0
              ? "No feed records available yet. Record daily feed usage to begin feed efficiency analysis."
              : `${matchedCount} matched feed and production day${matchedCount === 1 ? "" : "s"} found. At least 7 matched days are required for feed efficiency analysis.`;
        return (
          <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            <div>{reason}</div>
            <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
              Production days recorded: {prodKeys.size} · Feed days recorded: {feedKeys.size} · Matched: {matchedCount}
            </div>
          </div>
        );
      })()}

      {analysis && (
        <>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ForecastStat
              label="Current Efficiency Status"
              value={analysis.status}
              hint={analysis.hasBaseline
                ? `Movement score ${analysis.score} (negative = improving)`
                : "At least 3 preceding matched records required for a movement score"}
              valueClassName={effTone(analysis.status)}
              icon={Gauge}
            />
            <ForecastStat
              label="Feed Used — Latest Matched Date"
              value={`${fmtNum(analysis.latest.bags)} bags`}
              hint={hasWeight ? `${fmtNum(analysis.latest.bags * (bagWeightKg as number))} kg` : "Configure bag weight for kg"}
            />
            <ForecastStat
              label="Egg Output — Latest Matched Date"
              value={analysis.latest.eggs.toLocaleString()}
              hint={`Matched date: ${analysis.latest.label}`}
            />
            <ForecastStat
              label="Feed per Egg — Latest Matched Date"
              value={hasWeight && analysis.latest.feedPerEggG !== undefined ? `${fmtNum(analysis.latest.feedPerEggG)} g` : "—"}
              hint={hasWeight && analysis.latest.feedPerEggKg !== undefined
                ? `${fmtNum(analysis.latest.feedPerEggKg, 3)} kg per egg`
                : "Bag weight required"}
            />
          </div>

          {!analysis.hasBaseline && (
            <div className="mt-4 rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-4 text-sm">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink)]">Baseline Unavailable</div>
              <p className="mt-1 text-muted-foreground">
                More matched feed and production records are required to establish a reliable efficiency baseline.
                Current feed-per-egg values are still shown above.
              </p>
            </div>
          )}

          {/* Trend chart */}
          <div className="mt-6">
            <h3 className="font-display text-lg font-semibold">Feed and Production Trend</h3>
            <p className="text-xs text-muted-foreground">
              Only dates where valid matching feed and production records exist are compared. Missing records are not treated as zero.
            </p>
            <div className="h-72 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysis.chartData} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 85)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="left" type="monotone" dataKey="Eggs" stroke="oklch(0.32 0.06 155)" strokeWidth={2.5} dot={{ r: 2 }} connectNulls={false} />
                  <Line yAxisId="right" type="monotone" dataKey="Feed (bags)" stroke="oklch(0.55 0.15 60)" strokeWidth={2.5} dot={{ r: 2 }} connectNulls={false} />
                  {hasWeight && (
                    <Line yAxisId="right" type="monotone" dataKey="Feed per Egg (g)" stroke="oklch(0.5 0.12 250)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} connectNulls={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Room-level */}
          <div className="mt-6">
            <h3 className="font-display text-lg font-semibold">Room-Level Feed Efficiency</h3>
            <p className="text-xs text-muted-foreground">
              Rooms with matched feed and production records analysed separately. Unmatched dates are excluded.
            </p>

            {/* Mobile cards */}
            <div className="mt-3 grid gap-3 md:hidden">
              {analysis.roomRows.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No rooms with matched feed and production records in the analysis window.
                </div>
              )}
              {analysis.roomRows.map(r => (
                <div key={r.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{r.name}</div>
                    <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + movementBadgeClass(r.movement)}>
                      {r.movement}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Live Birds</dt><dd>{r.current.toLocaleString()}</dd></div>
                    <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Feed Used</dt><dd>{fmtNum(r.bags)} bags{r.kg !== null ? ` · ${fmtNum(r.kg)} kg` : ""}</dd></div>
                    <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Eggs Produced</dt><dd>{r.eggs.toLocaleString()}</dd></div>
                    <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Feed per Bird</dt><dd>{r.feedPerBirdG !== null ? `${fmtNum(r.feedPerBirdG)} g` : "—"}</dd></div>
                    <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Feed per Egg</dt><dd>{r.feedPerEggG !== null ? `${fmtNum(r.feedPerEggG)} g` : "—"}</dd></div>
                  </dl>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="mt-3 hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-2 pr-4 font-medium">Room</th>
                    <th className="py-2 pr-4 font-medium">Live Birds</th>
                    <th className="py-2 pr-4 font-medium">Feed Used</th>
                    <th className="py-2 pr-4 font-medium">Eggs Produced</th>
                    <th className="py-2 pr-4 font-medium">Feed / Bird</th>
                    <th className="py-2 pr-4 font-medium">Feed / Egg</th>
                    <th className="py-2 pr-4 font-medium">Efficiency Movement</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.roomRows.map(r => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-3 pr-4 font-medium">{r.name}</td>
                      <td className="py-3 pr-4">{r.current.toLocaleString()}</td>
                      <td className="py-3 pr-4">{fmtNum(r.bags)} bags{r.kg !== null ? ` · ${fmtNum(r.kg)} kg` : ""}</td>
                      <td className="py-3 pr-4">{r.eggs.toLocaleString()}</td>
                      <td className="py-3 pr-4">{r.feedPerBirdG !== null ? `${fmtNum(r.feedPerBirdG)} g` : "—"}</td>
                      <td className="py-3 pr-4">{r.feedPerEggG !== null ? `${fmtNum(r.feedPerEggG)} g` : "—"}</td>
                      <td className="py-3 pr-4">
                        <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + movementBadgeClass(r.movement)}>
                          {r.movement}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {analysis.roomRows.length === 0 && (
                    <tr><td colSpan={7} className="py-4 text-muted-foreground">No rooms with matched feed and production records.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insight */}
          <div className="mt-6 rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/8 p-4 md:p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink)]">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> PoultryPro Efficiency Insight
            </div>
            <div className="mt-2 text-sm leading-relaxed">
              <div><span className="text-muted-foreground">Observation: </span>{analysis.insight.observation}</div>
              <div className="mt-1.5"><span className="text-muted-foreground">Efficiency Interpretation: </span>{analysis.insight.interpretation}</div>
              <div className="mt-1.5"><span className="text-muted-foreground">Suggested Action: </span>{analysis.insight.action}</div>
            </div>
          </div>

          {/* Methodology */}
          <div className="mt-4 rounded-2xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed">
            <div className="font-medium text-[color:var(--ink)]">Efficiency Methodology (transparent weighted movement)</div>
            <ul className="mt-1.5 grid gap-1 md:grid-cols-2 text-muted-foreground">
              <li>Feed-per-Egg Change — 50%</li>
              <li>Production Movement — 25%</li>
              <li>Feed Usage Movement — 15%</li>
              <li>Room-Level Variation — 10%</li>
            </ul>
            <div className="mt-2 text-muted-foreground">
              {analysis.hasBaseline ? (
                <>
                  Latest matched date vs preceding matched baseline:
                  feed-per-egg {fmtSigned(analysis.movements.feedPerEggPct)}% ·
                  production {fmtSigned(analysis.movements.productionPct)}% ·
                  feed usage {fmtSigned(analysis.movements.feedPct)}% ·
                  room variation {fmtNum(analysis.movements.roomVariationPct)}%.
                </>
              ) : (
                <>
                  Movement metrics: BASELINE UNAVAILABLE — feed-per-egg, production, feed usage and
                  room-level variation percentages will appear once at least 3 preceding matched
                  daily records exist.
                </>
              )}
            </div>
            <div className="mt-2 text-muted-foreground">
              Classification: Strong positive improvement → EFFICIENT · Minimal material change → STABLE ·
              Moderate negative movement → WATCH · Sustained significant negative movement → DECLINING.
            </div>
            <div className="mt-2 text-muted-foreground">
              Feed efficiency monitoring is generated from recorded feed usage and egg production patterns. Results
              depend on the completeness and accuracy of farm records and provide operational decision support.
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function effTone(s: EffStatus): string {
  switch (s) {
    case "EFFICIENT": return "text-[color:var(--forest)]";
    case "STABLE": return "text-muted-foreground";
    case "WATCH": return "text-[color:var(--gold)]";
    case "DECLINING": return "text-destructive";
    case "INSUFFICIENT DATA": return "text-muted-foreground";
  }
}

function movementBadgeClass(m: MovementLabel): string {
  switch (m) {
    case "IMPROVING": return "bg-[color:var(--forest)] text-primary-foreground";
    case "STABLE": return "bg-secondary text-[color:var(--ink)]";
    case "WATCH": return "bg-[color:var(--gold)]/25 text-[color:var(--ink)]";
    case "DECLINING": return "bg-destructive text-destructive-foreground";
    case "INSUFFICIENT DATA": return "bg-secondary text-muted-foreground";
  }
}


/* ------------------ Abnormal Farm Activity Detection ------------------ */

type AbnormalProps = {
  rooms: Room[];
  eggs: EggRow[];
  feed: Feed[];
  mortality: Mortality[];
  health: Health[];
  bagWeightKg: number | null;
};


function activityBadgeClass(level: ActivityLevel): string {
  switch (level) {
    case "HIGH": return "bg-destructive text-destructive-foreground";
    case "ELEVATED": return "bg-[color:var(--gold)]/30 text-[color:var(--ink)]";
    case "WATCH": return "bg-[color:var(--gold)]/15 text-[color:var(--ink)]";
    default: return "bg-[color:var(--forest)] text-primary-foreground";
  }
}

function activityTone(level: ActivityLevel): string {
  switch (level) {
    case "HIGH": return "text-destructive";
    case "ELEVATED": return "text-[color:var(--gold)]";
    case "WATCH": return "text-[color:var(--ink)]";
    default: return "text-[color:var(--forest)]";
  }
}

function AbnormalActivityMonitor({ rooms, eggs, feed, mortality, health, bagWeightKg }: AbnormalProps) {
  const analysis = useMemo(
    () => computeAbnormalActivity(rooms, eggs, feed, mortality, health, bagWeightKg),
    [rooms, eggs, feed, mortality, health, bagWeightKg],
  );

  if (!analysis) {
    return (
      <Card>
        <CardHeader
          title="Abnormal Farm Activity Monitor"
          subtitle="Cross-signal operational monitoring based on production, mortality, feed and health records."
        />
        <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Not enough farm records yet to run cross-signal activity detection.
        </div>
      </Card>
    );
  }

  const { score, level, periodLabel, signalsAnalysed, roomsMonitored, mostAffected, rooms: roomRows, insight, limited } = analysis;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)]">
            <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> Predict</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] tracking-[0.16em] text-[color:var(--ink)]">Early Anomaly Model</span>
          </div>
          <h2 className="mt-1 font-display text-2xl md:text-3xl font-semibold">Abnormal Farm Activity Monitor</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Cross-signal operational monitoring based on production, mortality, feed and health records.
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Analysis window: {periodLabel}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <ForecastStat
          label="Current Activity Status"
          value={level}
          hint={`Abnormal activity score ${score}/100`}
          valueClassName={activityTone(level)}
          icon={Radar}
        />
        <ForecastStat
          label="Signals Analysed"
          value={String(signalsAnalysed.length)}
          hint={signalsAnalysed.length ? signalsAnalysed.join(" · ") : "No signals with sufficient data"}
        />
        <ForecastStat
          label="Rooms Monitored"
          value={String(roomsMonitored)}
          hint="Each active room analysed independently"
        />
        <ForecastStat
          label="Most Affected Room"
          value={mostAffected ? mostAffected.name : "—"}
          hint={mostAffected ? `${mostAffected.level} · score ${mostAffected.score}` : "No cross-signal pattern detected"}
        />
      </div>

      {limited && (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/30 p-4 text-sm">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Limited Signal Data</div>
          <div className="mt-1 text-muted-foreground">
            PoultryPro is monitoring available farm records. Additional matched production, feed, mortality and health records will strengthen cross-signal activity detection.
          </div>
        </div>
      )}

      {score >= 50 && mostAffected && (
        <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Cross-signal activity detected in {mostAffected.name}</div>
              <div className="mt-1 text-destructive/90">
                {mostAffected.triggered.length >= 2
                  ? `${mostAffected.triggered.map(s => signalPretty(s)).join(" and ")} signals occurred together within the current analysis window. Review recent ${mostAffected.name} operational and health records.`
                  : `${signalPretty(mostAffected.triggered[0] ?? "production")} signal is elevated. Review recent ${mostAffected.name} operational and health records.`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room-level table */}
      <div className="mt-6">
        <h3 className="font-display text-lg font-semibold">Room-Level Anomaly Analysis</h3>
        <p className="text-xs text-muted-foreground">Each active room analysed independently from its own production, mortality, feed and health records.</p>

        {/* Mobile stacked cards */}
        <div className="mt-3 grid gap-3 md:hidden">
          {roomRows.map(r => (
            <div key={r.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{r.name}</div>
                <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + activityBadgeClass(r.level)}>
                  {r.level} · {r.score}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Production</dt><dd>{r.signals.production.label}</dd></div>
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Mortality</dt><dd>{r.signals.mortality.label}</dd></div>
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Feed</dt><dd>{r.signals.feed.label}</dd></div>
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Health context</dt><dd>{r.signals.health.label}</dd></div>
              </dl>
            </div>
          ))}
          {roomRows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No active rooms configured.</div>
          )}
        </div>

        {/* Desktop table */}
        <div className="mt-3 hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-4 font-medium">Room</th>
                <th className="py-2 pr-4 font-medium">Production Signal</th>
                <th className="py-2 pr-4 font-medium">Mortality Signal</th>
                <th className="py-2 pr-4 font-medium">Feed Signal</th>
                <th className="py-2 pr-4 font-medium">Health Context</th>
                <th className="py-2 pr-4 font-medium">Activity Score</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {roomRows.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-3 pr-4 font-medium">{r.name}</td>
                  <td className="py-3 pr-4">{r.signals.production.label}</td>
                  <td className="py-3 pr-4">{r.signals.mortality.label}</td>
                  <td className="py-3 pr-4">{r.signals.feed.label}</td>
                  <td className="py-3 pr-4">{r.signals.health.label}</td>
                  <td className="py-3 pr-4">{r.score}</td>
                  <td className="py-3 pr-4">
                    <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + activityBadgeClass(r.level)}>
                      {r.level}
                    </span>
                  </td>
                </tr>
              ))}
              {roomRows.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-muted-foreground">No active rooms configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insight */}
      <div className="mt-6 rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/8 p-4 md:p-5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink)]">
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> PoultryPro Cross-Signal Insight
        </div>
        <div className="mt-2 text-sm leading-relaxed">
          <div><span className="text-muted-foreground">Observation: </span>{insight.observation}</div>
          <div className="mt-1.5"><span className="text-muted-foreground">Signal Connection: </span>{insight.connection}</div>
          <div className="mt-1.5"><span className="text-muted-foreground">Risk Interpretation: </span>{insight.interpretation}</div>
          <div className="mt-1.5"><span className="text-muted-foreground">Suggested Action: </span>{insight.action}</div>
        </div>
      </div>

      {/* Methodology */}
      <div className="mt-4 rounded-2xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed">
        <div className="font-medium text-[color:var(--ink)]">Abnormal Activity Detection Methodology (0–100)</div>
        <ul className="mt-1.5 grid gap-1 md:grid-cols-2 text-muted-foreground">
          <li>Production Anomaly — 30%</li>
          <li>Mortality Pattern — 30%</li>
          <li>Feed Efficiency Anomaly — 25%</li>
          <li>Health Record Context — 15%</li>
        </ul>
        <div className="mt-2 text-muted-foreground">
          Available weights are re-normalised when a signal has insufficient data. Classification: 0–24 NORMAL · 25–49 WATCH · 50–74 ELEVATED · 75–100 HIGH.
        </div>
        <div className="mt-2 text-muted-foreground">
          PoultryPro Abnormal Farm Activity Detection provides early operational decision support based on recorded farm patterns. It does not constitute veterinary diagnosis or confirm disease.
        </div>
      </div>
    </Card>
  );
}

