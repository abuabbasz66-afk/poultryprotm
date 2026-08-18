import * as React from "react";
import { createFileRoute, Link, useNavigate, Navigate } from "@tanstack/react-router";
import { usePermissions, homeRouteForRole } from "@/lib/rbac";
import { eggSlots, productionRooms, roomStatus, ROOM_STATUS_LABELS, ROOM_STATUS_TONES } from "@/lib/rooms";
import { PermissionDenied } from "@/components/permission-denied";
import { RecentStaffActivity } from "@/components/recent-staff-activity";
import { BrokenEggsCard } from "@/components/broken-eggs-card";
import { RecentActivitiesCard } from "@/components/recent-activities-card";
import { RoomComparisonCard } from "@/components/room-comparison-card";

import { AlertsBanner } from "@/components/alerts-banner";


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
  ChevronDown, MoreVertical,
} from "lucide-react";


import { supabase } from "@/integrations/supabase/client";
import { flushCurrentLocation } from "@/lib/last-location";
import { logSecurityEvent } from "@/lib/security-events";
import { useActiveFormulaCostPerKg } from "@/lib/feed-formulas-data";

import {
  useRooms, useEggs, useMortality, useHealth, useFeed, usePrices, usePriceHistory, useFarm, useFarmId,
  useAddRoom, useDeleteRoom, useUpdateRoom,
  useAddEgg, useAddMortality, useAddHealth, useAddFeed,
  useAddPrice, useDeletePrice, useDeleteMortality, useDeleteFeed,
  useDeleteEgg, useUpdateEgg, useUpdateMortality, useUpdateHealth, useUpdateFeed,
  useDeleteHealth, useUpdateFarmBagWeight,
  HEALTH_TYPES, normalizeHealthType,
  type Room, type EggRow, type Mortality, type Health, type HealthType, type Feed, type Price,
} from "@/lib/farm-data";
import { ProductionDeclineIntelligence } from "@/components/production-decline-card";
import { MortalityPatternIntelligence } from "@/components/mortality-pattern-card";
import { FarmInsightsIntelligence } from "@/components/farm-insights-card";
import { RecordDialogs, RecordConfirmDialog, type RecordDialogState } from "@/components/record-dialogs";
import { FlockAgeDialog } from "@/components/flock-age-dialog";
import { flockAge, hasAge, roomsMissingAge, flockStage } from "@/lib/flock-age";
import { useToday } from "@/lib/use-today";
import { UpgradeDialog, type UpgradeTier } from "@/components/upgrade-dialog";
import { TrialBanner } from "@/components/trial-banner";
import { useSubscription } from "@/lib/subscription";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { normaliseEggRow, totalEggsFromRow } from "@/lib/egg-normalize";
import { computeProductionSeries, fmtPct } from "@/lib/production-percent";
import { computeDailyMortality, mortalityRoomColumns, recentMortality } from "@/lib/mortality-percent";

import { toDateKey, toLocalDate } from "@/lib/date-key";
import { computeDashboardMetrics, priceUnitLabel } from "@/lib/farm-analytics";
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

function formatDayLabel(input: string | null | undefined): string {
  if (!input) return "—";
  // Route every record date through the shared normaliser so legacy short
  // strings like "6 aPR" (missing year, mixed case) render identically to
  // fresh ISO values ("2026-04-06"). Only fall back to the raw string when
  // even the shared normaliser cannot understand it.
  const localDate = toLocalDate(input);
  if (localDate) return formatDate(localDate, "d MMM yyyy");
  const iso = parseISO(String(input));
  return isValidDate(iso) ? formatDate(iso, "d MMM yyyy") : String(input);
}
function birdsLabel(n: number): string {
  const abs = Math.abs(Number(n) || 0);
  return `${abs} ${abs === 1 ? "bird" : "birds"}`;
}

type DashboardArea = "records" | "analytics" | "ai";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (search: Record<string, unknown>): { area?: DashboardArea } => {
    const a = search.area;
    return a === "analytics" || a === "ai" || a === "records" ? { area: a } : {};
  },
  head: () => ({
    meta: [
      { title: "Farm Dashboard — PoultryPro" },
      { name: "description", content: "Live poultry farm operations: production, feed, health, mortality and profitability." },
      { property: "og:title", content: "Farm Dashboard — PoultryPro" },
      { property: "og:description", content: "Real-time visibility into every bird, egg, and naira." },
    ],
  }),
  component: DashboardRouter,
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

function DashboardRouter() {
  // Roles without dashboard access (e.g. Sales Officer) land on the surface
  // their permissions actually cover instead of an empty owner dashboard.
  const { can, loading, role } = usePermissions();
  if (loading) return null;
  if (!can("dashboard.view")) {
    if (can("sales.read")) return <Navigate to={homeRouteForRole(role)} replace />;
    return <PermissionDenied hint="Your role does not include the farm dashboard." />;
  }
  return <Dashboard />;
}

function Dashboard() {
  const navigate = useNavigate();
  // Re-renders at local midnight so bird age (days/weeks) advances on its own.
  const ageToday = useToday();
  const qc = useQueryClient();
  const farmIdQ = useFarmId();
  const farmQ = useFarm();
  const farm = farmQ.data;
  const { data: subscription } = useSubscription();
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
  const updRoomM = useUpdateRoom();
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
  // Role gates. Managers record operations only: no pricing, no analytics,
  // no AI, no audit. Everything below is additionally enforced by RLS.
  const { can } = usePermissions();
  const canPrices = can("prices.read");
  const canAnalyticsArea = can("reports.read") || can("financials.read");
  const canAIArea = can("ai.view");
  const canAudit = can("audit.read");
  /** Only the owner, or a manager explicitly granted "rooms.age", may set flock age. */
  const canManageAge = can("rooms.age");
  const missingAgeRooms = useMemo(() => roomsMissingAge(rooms), [rooms]);
  const search = Route.useSearch();
  const requestedArea: DashboardArea = search.area ?? "records";
  const area: DashboardArea = requestedArea;
  const setArea = (next: DashboardArea) =>
    navigate({ to: "/dashboard", search: { area: next }, hash: "" as never });

  const [upgradeTier, setUpgradeTier] = useState<UpgradeTier | null>(null);
  const [forecastOpen, setForecastOpen] = useState(false);
  const [mortalityOpen, setMortalityOpen] = useState(false);
  const [feedEffOpen, setFeedEffOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
// Bag weight (kg per bag) is persisted per farm. Kilograms are the source of
// truth for feed input; bag counts are a derived display value. If the farm
// changes the weight later, all bag-count displays recalculate automatically.
const updBagWeightM = useUpdateFarmBagWeight();
const bagWeightKg: number | null = farmQ.data?.bag_weight_kg ?? null;
const setBagWeightKg = (v: number | null) => {
  if (!farmIdQ.data || v == null || !Number.isFinite(v) || v <= 0) return;
  updBagWeightM.mutate({ farmId: farmIdQ.data, bagWeightKg: v });
};
  const [mortShowAll, setMortShowAll] = useState(false);
  const [feedShowAll, setFeedShowAll] = useState(false);
  const [expandedMortDate, setExpandedMortDate] = useState<string | null>(null);
  const [expandedFeedDate, setExpandedFeedDate] = useState<string | null>(null);
  const [eggShowAll, setEggShowAll] = useState(false);
  const [expandedEggDate, setExpandedEggDate] = useState<string | null>(null);
  const [expandedHealthId, setExpandedHealthId] = useState<string | null>(null);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [healthShowAll, setHealthShowAll] = useState(false);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; confirmLabel?: string; onConfirm: () => void | Promise<void> } | null>(null);
  const askDelete = (title: string, message: string, onConfirm: () => void | Promise<void>) =>
    setConfirmState({ title, message, onConfirm });
  const [dialog, setDialog] = useState<RecordDialogState | null>(null);
  const [ageRoom, setAgeRoom] = useState<Room | null>(null);
  const openDialog = (s: RecordDialogState) => setDialog(s);

  // ---------------------------------------------------------------------------
  // Derived — every figure is calculated from live records via the analytics
  // engine so daily/monthly/all-time counts never leak into each other.
  // ---------------------------------------------------------------------------
  const activeFormulaCostPerKg = useActiveFormulaCostPerKg();
  const useFormulaCost = farm?.feed_source === "self_produced" && activeFormulaCostPerKg != null;
  const priceHistory = usePriceHistory().data ?? [];
  const metrics = useMemo(
    () => computeDashboardMetrics({
      rooms, eggs, feed, mortality, health, prices, priceHistory, bagWeightKg,
      costPerKgOverride: useFormulaCost ? activeFormulaCostPerKg : null,
    }),
    [rooms, eggs, feed, mortality, health, prices, priceHistory, bagWeightKg, useFormulaCost, activeFormulaCostPerKg],
  );


  const totalBirds = metrics.population.totalLiveBirds;
  const totalLoss = metrics.population.totalMortalityAllTime;
  const today = eggs[0];
  const todayNorm = today ? normaliseEggRow(today) : { crates: 0, extra: 0, totalEggs: 0 };
  const todayCrates = todayNorm.crates;
  const todayExtra = todayNorm.extra;
  const todayEggs = todayNorm.totalEggs;
  const yesterdayEggs = metrics.comparison.previousEggs;
  const diffPct = metrics.comparison.deltaPct ?? 0;
  const hasComparison = metrics.comparison.hasComparison;
  const totalEggs = metrics.allTime.eggs;
  const totalCrates = metrics.allTime.crates;

  // Period mortality — filtered by calendar date, not cumulative
  const todayMortality = metrics.todayMortality;
  const monthlyMortality = metrics.monthlyMortality;
  const allTimeMortality = metrics.allTimeMortality;

  // Feed
  const feedToday = metrics.feed.todayBags;
  const feedMonth = metrics.feed.monthlyBags;
  const feedAllTime = metrics.feed.allTimeBags;

  // Production rate — one decimal place preserved for AI + display
  const productionRatePct = metrics.productionRate.currentPct;
  const productionRate = productionRatePct !== null ? Math.round(productionRatePct * 10) / 10 : 0;

  const last7Eggs = eggs.slice(0, 7);
  const sevenDayAvgEggs = last7Eggs.length
    ? Math.round(last7Eggs.reduce((s, r) => s + totalEggsFromRow(r), 0) / last7Eggs.length)
    : 0;

  void productionRatePct;

  const eggPrice = metrics.eggPrice;
  const feedPrice = metrics.feedPrice;
  const todayRevenue = metrics.todayRevenue;
  const monthlyRevenue = metrics.monthlyRevenue;
  const allTimeRevenue = metrics.allTimeRevenue;
  // Financials come from the shared analytics engine so KPI cards, charts,
  // reports, exports and Super Admin all agree to the naira. Never recompute
  // revenue/cost/profit locally — extend the engine instead.
  const todayCost = metrics.todayFeedCost;
  const todayProfit = metrics.todayProfit;
  void totalCrates; void allTimeRevenue; void feedAllTime; void feedPrice; void todayCost;

  // Rooms are stored positionally in r2/r3/r4 (schema legacy). The chart
  // series are generated dynamically from the farm's actual rooms so the
  // legend always reflects real room names — never hardcoded.
  // Egg columns r2/r3/r4 belong to ROOM 2/3/4 — mapped by room number, never
  // by list position, and limited to rooms still in production.
  const eggRoomSlots = useMemo(() => eggSlots(rooms), [rooms]);
  // Daily lay percentages per room + flock, recomputed whenever production,
  // rooms or mortality change (historical populations are reconstructed).
  const productionSeries = useMemo(
    () => computeProductionSeries(eggs, rooms, mortality),
    [eggs, rooms, mortality],
  );
  const productionByDate = useMemo(
    () => new Map(productionSeries.map((p) => [p.date, p] as const)),
    [productionSeries],
  );
  const todayProduction = productionSeries[0] ?? null;
  // Current lay rate = the overall lay percentage for the latest production day.
  const currentLayRateDisplay = fmtPct(todayProduction?.overallPct ?? null);
  const roomSeries = useMemo(
    () => eggRoomSlots.map((s) => ({ name: s.room.name, key: s.key })),
    [eggRoomSlots],
  );
  const chartData = useMemo(
    () => [...eggs].reverse().map(e => {
      const row: Record<string, string | number> = {
        name: e.label.replace(/^[A-Za-z]{3}, /, ""),
        "Extra Eggs": e.extra,
      };
      for (const s of roomSeries) row[s.name] = e[s.key];
      return row;
    }),
    [eggs, roomSeries],
  );

  // Monthly profit chart — one point per calendar day, joining production and
  // feed by date via the shared engine. Cost is real (not a baseline).
  const profitData = useMemo(
    () => metrics.dailySeriesMonth.map(d => ({
      name: d.label,
      Revenue: d.revenue,
      Cost: d.feedCost,
      Profit: d.profit,
    })),
    [metrics.dailySeriesMonth],
  );

  // All-time profit series — cumulative totals from farm's first recorded day
  // through today. Runs entirely off the shared analytics engine so the
  // numbers match Monthly Profit Overview and every other financial widget.
  const allTimeSeries = useMemo(() => {
    let cumRev = 0, cumCost = 0, cumProfit = 0, cumEggs = 0;
    return metrics.dailySeriesAllTime.map(d => {
      cumRev += d.revenue;
      cumCost += d.feedCost;
      cumProfit += d.profit;
      cumEggs += d.eggs;
      return {
        name: d.label,
        date: d.date,
        dailyRevenue: d.revenue,
        dailyFeedCost: d.feedCost,
        dailyProfit: d.profit,
        Revenue: cumRev,
        "Feed Cost": cumCost,
        Profit: cumProfit,
        lifetimeEggs: cumEggs,
        lifetimeCrates: Math.floor(cumEggs / 30),
      };
    });
  }, [metrics.dailySeriesAllTime]);

  const allTimeStats = useMemo(() => {
    const days = allTimeSeries.length;
    const last = allTimeSeries[days - 1];
    const totalRevenue = last?.Revenue ?? 0;
    const totalFeedCost = last?.["Feed Cost"] ?? 0;
    const totalProfit = last?.Profit ?? 0;
    const roi = totalFeedCost > 0 ? (totalProfit / totalFeedCost) * 100 : null;
    const avgDaily = days > 0 ? totalProfit / days : 0;
    const lifetimeEggs = last?.lifetimeEggs ?? 0;
    const lifetimeCrates = Math.floor(lifetimeEggs / 30);
    const startDate = allTimeSeries[0]?.date ?? null;
    const endDate = last?.date ?? null;
    return { days, totalRevenue, totalFeedCost, totalProfit, roi, avgDaily, lifetimeEggs, lifetimeCrates, startDate, endDate };
  }, [allTimeSeries]);



  const handleSignOut = async () => {
    // Stop in-flight protected queries so cleared-session 401s don't storm the UI,
    // drop cached farm data so Back can't restore the previous farm's dashboard,
    // then sign out and REPLACE history so /dashboard is off the back stack.
    await logSecurityEvent("logout");
    await qc.cancelQueries();
    qc.clear();
    try { await flushCurrentLocation(); } catch { /* non-blocking */ }
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
  const editRoom = (r: Room) => openDialog({ kind: "room-edit", item: r });
  const cullRoom = (r: Room) => openDialog({ kind: "room-cull", item: r });
  const archiveRoom = (r: Room) => {
    const next = roomStatus(r) === "inactive" ? "active" : "inactive";
    updRoomM.mutate(
      { id: r.id, status: next },
      {
        onSuccess: () => toast.success(next === "active" ? `${r.name} restored` : `${r.name} archived`),
        onError: (err) => toast.error("Failed to update room", { description: (err as Error).message }),
      },
    );
  };
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
      `This will permanently remove the ${Math.round(f.bags * (farmQ.data?.bag_weight_kg ?? 25) * 10) / 10} kg feed record for ${f.room} on ${f.date}.`,
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


  // --- Mortality aggregation (grouped by date, with historical rates) ---
  const mortalityByDate = useMemo(
    () => computeDailyMortality(mortality, rooms),
    [mortality, rooms],
  );
  const mortRoomCols = useMemo(
    () => mortalityRoomColumns(rooms, mortality),
    [rooms, mortality],
  );

  // --- Health sorted by date newest → oldest ---
  const healthByDate = useMemo<Health[]>(() => {
    return [...health].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [health]);

  const totalInitialBirds = rooms.reduce((s, r) => s + r.initial, 0);
  const totalMortality = useMemo(
    () => mortality.reduce((s, m) => s + Math.abs(Number(m.loss) || 0), 0),
    [mortality],
  );
  const sevenDayMortality = useMemo(() => recentMortality(mortality, 7), [mortality]);
  const currentFlock = rooms.reduce((s, r) => s + (Number(r.current) || 0), 0);
  const mortalityRatePct = totalInitialBirds ? (totalMortality / totalInitialBirds) * 100 : 0;


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

  // 7-day / 30-day feed averages: window is the last N calendar days ending
  // today (local time). Average is TOTAL bags in the window ÷ number of days
  // that actually had a record (so a single 12.5 kg entry averages to 12.5 kg
  // rather than being diluted across empty days).
  const bagKg = bagWeightKg ?? 25;
  const todayKeyLocal = (() => {
    const d = new Date();
    const p = (n: number) => (n < 10 ? `0${n}` : String(n));
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();
  const daysAgoKey = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    const p = (x: number) => (x < 10 ? `0${x}` : String(x));
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const feedWindow = (days: number) => {
    const start = daysAgoKey(days - 1);
    const inWin = feedByDate.filter(g => {
      const k = toDateKey(g.date) ?? g.date;
      return k >= start && k <= todayKeyLocal;
    });
    const totalBags = inWin.reduce((s, g) => s + g.total, 0);
    return { totalBags, daysWithRecords: inWin.length };
  };
  const w7 = feedWindow(7);
  const w30 = feedWindow(30);
  const feed7Avg = w7.daysWithRecords ? w7.totalBags / w7.daysWithRecords : 0;
  const feed30Avg = w30.daysWithRecords ? w30.totalBags / w30.daysWithRecords : 0;
  const feedPerBirdG = totalBirds ? (feedToday * bagKg * 1000) / totalBirds : 0;
  // Kilograms are the source of truth; bags are derived from bagKg.
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const feedFmt = (bags: number) => `${round1(bags * bagKg)} kg (${round1(bags)} bags)`;

  // Per-room snapshot used by Room Management and Room Overview. Every figure
  // comes from existing records; unknown values stay null and render "N/A".
  const roomTodaySummary = useMemo(() => {
    const latestEgg = eggs[0] ?? null;
    const prod = latestEgg ? productionByDate.get(latestEgg.date) : undefined;
    const sameDay = (raw: string) => (toDateKey(raw) ?? raw) === todayKeyLocal;
    return rooms.map((r) => {
      const rp = prod?.rooms.find((x) => x.roomId === r.id) ?? null;
      const roomFeed = feed.filter((f) => f.room === r.name);
      const roomMort = mortality.filter((m) => m.room === r.name);
      const roomHealth = healthByDate.filter((h) => h.scope === r.name);
      return {
        room: r,
        eggs: rp?.eggs ?? 0,
        pct: rp?.pct ?? null,
        deaths: roomMort.filter((m) => sameDay(m.date)).reduce((s, m) => s + Math.abs(Number(m.loss) || 0), 0),
        bags: roomFeed.filter((f) => sameDay(f.date)).reduce((s, f) => s + (Number(f.bags) || 0), 0),
        lastHealth: roomHealth[0] ?? null,
        recentFeed: roomFeed.slice(0, 5),
        recentMortality: roomMort.slice(0, 5),
        recentHealth: roomHealth.slice(0, 5),
      };
    });
  }, [rooms, eggs, productionByDate, feed, mortality, healthByDate, todayKeyLocal]);

  // Farm context must resolve (or fail loudly) before any farm-scoped UI.
  // A loading state must always terminate: success, or a clear message.
  const farmLoading = farmIdQ.isPending || (!!farmIdQ.data && farmQ.isPending);
  const farmError =
    (farmIdQ.isError && "Unable to load your farm. Please check your connection and try again.") ||
    (farmQ.isError && "Unable to load dashboard. Please contact your farm owner.") ||
    (!farmIdQ.isPending && !farmIdQ.data && "This account is not linked to a farm. Please contact your farm owner.") ||
    (!!farmIdQ.data && !farmQ.isPending && !farmQ.data && "Farm not found, or you do not have permission to access this farm.") ||
    null;

  if (farmLoading || farmError) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          {farmError ? (
            <>
              <p className="text-sm font-medium text-foreground mb-2">Dashboard unavailable</p>
              <p className="text-sm text-muted-foreground mb-4">{farmError}</p>
              <button
                onClick={() => { farmIdQ.refetch(); farmQ.refetch(); }}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                Try again
              </button>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 h-8 w-8 rounded-full border-2 border-[color:var(--forest)]/30 border-t-[color:var(--forest)] animate-spin" />
              <p className="text-sm text-muted-foreground">Loading your farm…</p>
            </>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background text-foreground pb-14 overflow-x-hidden">
      {/* Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[color:var(--forest)] via-[color:var(--forest)] to-[color:var(--ink)] text-primary-foreground">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(circle_at_80%_60%,rgba(212,175,55,0.12),transparent_60%)]" />
        <div className="relative container-x hidden md:flex items-center justify-between py-4">
          <Link to="/" className="hidden md:inline-flex items-center gap-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>

          <div className="hidden md:flex items-center gap-3">
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
        </div>
        <div className="relative container-x flex flex-col justify-center py-12 md:py-20 min-h-[320px] md:min-h-[420px]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] md:text-[11px] uppercase tracking-[0.18em] md:tracking-[0.22em] text-[color:var(--gold)]">
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3 w-3 md:h-3.5 md:w-3.5" /> Capture</span>
            <ArrowRight className="h-3 w-3 opacity-60" />
            <span>Understand</span>
            <ArrowRight className="h-3 w-3 opacity-60" />
            <span>Predict</span>
          </div>
          <div className="mt-3 text-[11px] md:text-xs text-primary-foreground/70 max-w-2xl leading-snug">
            Farm Records &amp; Analytics active · AI Intelligence rolling out on Premium
          </div>
          <h1 className="mt-5 md:mt-6 farm-name">{farm?.name ?? "Your Farm"}</h1>
          {(farm?.state || farm?.country || farm?.location) && (
            <div className="mt-4 flex items-center gap-1.5 text-[12px] md:text-sm text-primary-foreground/85">
              <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
              <span className="truncate">{[farm?.location, farm?.state, farm?.country].filter(Boolean).join(", ")}</span>
            </div>
          )}
          <div className="mt-2 text-[12px] md:text-sm text-primary-foreground/70">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="mt-6 md:mt-7 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-1.5 md:px-5 md:py-2 text-[12px] md:text-sm max-w-full self-start">
            <Bird className="h-3.5 w-3.5 md:h-4 md:w-4 text-[color:var(--gold)] shrink-0" />
            <span className="font-semibold whitespace-nowrap">{totalBirds.toLocaleString()} birds</span>
            <span className="text-primary-foreground/50">·</span>
            <span className="text-primary-foreground/85 whitespace-nowrap">{rooms.length} rooms</span>
          </div>
        </div>
      </header>

      <main className="container-x mt-8 space-y-6 md:space-y-8">
        <AlertsBanner />
        <TrialBanner />

        {/* Product-area navigation: Capture → Understand → Predict.
            Analytics and AI are owner-grade surfaces; operational roles only
            ever see Capture. */}
        {(canAnalyticsArea || canAIArea) && (() => {
          const plan = subscription?.effectivePlan ?? "basic";
          const canAnalytics = plan === "standard" || plan === "premium";
          const canAI = plan === "premium";
          const stateFor = (stage: "records" | "analytics" | "ai"): AreaState => {
            if (stage === "records") return plan === "basic" ? "current" : "included";
            if (stage === "analytics") {
              if (plan === "basic") return "upgrade-standard";
              if (plan === "standard") return "current";
              return "included";
            }
            // ai
            if (plan === "premium") return "current";
            return "upgrade-premium";
          };
          const handleClick = (stage: "records" | "analytics" | "ai") => {
            if (stage === "analytics" && !canAnalytics) { setUpgradeTier("standard"); return; }
            if (stage === "ai" && !canAI) { setUpgradeTier("premium"); return; }
            setArea(stage);
          };
          return (
            <>
              <nav aria-label="Dashboard areas" className="rounded-2xl md:rounded-3xl bg-card border border-border p-1.5 md:p-2 shadow-[var(--shadow-soft)]">
                <div className="grid grid-cols-3 gap-1.5 md:gap-2 items-stretch">
                  <AreaTab
                    active={area === "records"} onClick={() => handleClick("records")}
                    num="01" stage="CAPTURE" title="Farm Records" shortLabel="Capture"
                    state={stateFor("records")} icon={LayoutDashboard}
                  />
                  <AreaTab
                    active={area === "analytics"} onClick={() => handleClick("analytics")}
                    num="02" stage="UNDERSTAND" title="Farm Analytics" shortLabel="Analytics"
                    state={stateFor("analytics")} icon={LineChartIcon}
                  />
                  <AreaTab
                    active={area === "ai"} onClick={() => handleClick("ai")}
                    num="03" stage="PREDICT" title="AI Intelligence" shortLabel="AI"
                    state={stateFor("ai")} icon={Brain} premium
                  />
                </div>
              </nav>
              <p className="mt-2 px-1 text-[11px] md:text-xs text-muted-foreground">
                Start with your records. Understand your performance. Predict what comes next.
              </p>
            </>
          );
        })()}

        {/* Direct-URL protection: a restricted area never renders its content. */}
        {((area === "analytics" && !canAnalyticsArea) || (area === "ai" && !canAIArea)) && (
          <PermissionDenied hint="Analytics, financials and AI insights are available to the Farm Owner only." />
        )}



        {area === "analytics" && canAnalyticsArea && (

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
                  value={productionRatePct !== null ? `${productionRatePct.toFixed(1)}%` : "—"}
                  detail={productionRatePct === null
                    ? "Add today's production to compute"
                    : productionRatePct >= 80
                      ? `${(productionRatePct - 80).toFixed(1)} pts above target`
                      : `${(80 - productionRatePct).toFixed(1)} pts below target`}
                  positive={productionRatePct !== null && productionRatePct >= 80}
                />
                <InsightRow
                  label="Latest vs previous recorded day"
                  value={hasComparison ? `${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%` : "—"}
                  detail={hasComparison
                    ? `${metrics.comparison.latestEggs.toLocaleString()} eggs latest · ${yesterdayEggs.toLocaleString()} prior`
                    : (metrics.comparison.message ?? "Not enough data")}
                  positive={hasComparison ? diffPct >= 0 : true}
                />
                <InsightRow
                  label="Highest producing room (latest)"
                  value={metrics.highestRoom.hasData
                    ? `${metrics.highestRoom.roomName} · ${metrics.highestRoom.crates} crates`
                    : "—"}
                  detail={metrics.highestRoom.hasData
                    ? `${metrics.highestRoom.eggs.toLocaleString()} eggs · ${(metrics.highestRoom.sharePct ?? 0).toFixed(1)}% of day's output`
                    : "No production records yet"}
                  positive
                />
                <InsightRow
                  label="Monthly mortality (this month)"
                  value={String(monthlyMortality)}
                  detail={`Today: ${todayMortality} · All-time: ${allTimeMortality} · ${feedFmt(feedToday)} fed today`}
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
          <KpiCard tone="plain" icon={Wheat} label="Feed Today" value={`${round1(feedToday * bagKg)} kg`} hint={`${round1(feedToday)} bags · all rooms`} />
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
                {roomSeries.map((s, i) => (
                  <Bar
                    key={s.name}
                    dataKey={s.name}
                    fill={["oklch(0.32 0.06 155)", "oklch(0.78 0.15 78)", "oklch(0.55 0.15 240)"][i]}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
                <Bar dataKey="Extra Eggs" fill="oklch(0.55 0.22 15)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div id="finance" className="scroll-mt-24" />
        {/* Monthly Profit */}
        <Card>
          {(() => {
            const totalRevenue = profitData.reduce((s, d) => s + d.Revenue, 0);
            const totalCost = profitData.reduce((s, d) => s + d.Cost, 0);
            const totalProfit = profitData.reduce((s, d) => s + d.Profit, 0);
            return (
              <CardHeader
                title="Monthly Profit Overview"
                subtitle="Revenue, feed cost and profit (this month)"
                right={
                  <div className="text-right">
                    <div className="font-display text-2xl font-semibold text-[color:var(--forest)]">{naira(totalProfit)}<span className="ml-1 text-xs font-sans font-medium text-muted-foreground">Profit</span></div>
                    <div className="text-xs text-muted-foreground">Revenue: {naira(totalRevenue)}</div>
                    <div className="text-xs text-muted-foreground">Feed Cost: {naira(totalCost)}</div>
                  </div>
                }
              />
            );
          })()}
          <div className="h-72 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitData} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 85)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => "₦" + (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: number) => naira(v)} contentStyle={{ borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Revenue" name="Revenue" stroke="oklch(0.32 0.06 155)" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Cost" name="Feed Cost" stroke="oklch(0.78 0.15 78)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Profit" name="Profit" stroke="oklch(0.55 0.18 240)" strokeWidth={2.25} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div id="all-time-profit" className="scroll-mt-24" />
        {/* All-Time Profit Overview — cumulative view from farm inception */}
        <Card>
          <CardHeader
            title="All-Time Profit Overview"
            subtitle={
              allTimeStats.startDate
                ? `Revenue, feed cost and profit since farm inception · ${formatDayLabel(allTimeStats.startDate)} → Today`
                : "Revenue, feed cost and profit since farm inception."
            }
            right={
              <div className="text-right">
                <div className="font-display text-2xl font-semibold text-[color:var(--forest)]">
                  {naira(allTimeStats.totalProfit)}
                  <span className="ml-1 text-xs font-sans font-medium text-muted-foreground">Lifetime Profit</span>
                </div>
                <div className="text-xs text-muted-foreground">Revenue: {naira(allTimeStats.totalRevenue)}</div>
                <div className="text-xs text-muted-foreground">Feed Cost: {naira(allTimeStats.totalFeedCost)}</div>
              </div>
            }
          />

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Total Revenue" value={naira(allTimeStats.totalRevenue)} tone="mint" />
            <MiniStat label="Total Feed Cost" value={naira(allTimeStats.totalFeedCost)} tone="peach" />
            <MiniStat label="Total Profit" value={naira(allTimeStats.totalProfit)} tone="sky" />
            <MiniStat label="ROI" value={allTimeStats.roi === null ? "—" : `${allTimeStats.roi.toFixed(1)}%`} tone="plain" />
            <MiniStat label="Avg Daily Profit" value={naira(Math.round(allTimeStats.avgDaily))} tone="mint" />
            <MiniStat label="Production Days" value={allTimeStats.days.toLocaleString()} tone="plain" />
            <MiniStat label="Lifetime Eggs" value={allTimeStats.lifetimeEggs.toLocaleString()} tone="sky" />
            <MiniStat label="Lifetime Crates" value={allTimeStats.lifetimeCrates.toLocaleString()} tone="peach" />
          </div>

          <div className="h-72 mt-4">
            {allTimeSeries.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                No production records yet. Start recording to see lifetime analytics.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={allTimeSeries} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 85)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    interval={Math.max(0, Math.floor(allTimeSeries.length / 8))}
                  />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => "₦" + (v / 1000).toFixed(0) + "k"} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const row = payload[0].payload as (typeof allTimeSeries)[number];
                      return (
                        <div className="rounded-xl border border-border bg-background/95 backdrop-blur px-3 py-2 text-xs shadow-lg space-y-1">
                          <div className="font-semibold text-sm">{formatDayLabel(row.date)}</div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                            <span className="text-muted-foreground">Revenue</span><span className="tabular-nums text-right">{naira(row.dailyRevenue)}</span>
                            <span className="text-muted-foreground">Feed Cost</span><span className="tabular-nums text-right">{naira(row.dailyFeedCost)}</span>
                            <span className="text-muted-foreground">Profit</span><span className="tabular-nums text-right">{naira(row.dailyProfit)}</span>
                          </div>
                          <div className="mt-1 pt-1 border-t border-border/60 grid grid-cols-2 gap-x-4 gap-y-0.5">
                            <span className="text-muted-foreground">Running Profit</span><span className="tabular-nums text-right font-medium">{naira(row.Profit)}</span>
                            <span className="text-muted-foreground">Lifetime Revenue</span><span className="tabular-nums text-right">{naira(row.Revenue)}</span>
                            <span className="text-muted-foreground">Lifetime Feed Cost</span><span className="tabular-nums text-right">{naira(row["Feed Cost"])}</span>
                            <span className="text-muted-foreground">Lifetime Eggs</span><span className="tabular-nums text-right">{row.lifetimeEggs.toLocaleString()}</span>
                            <span className="text-muted-foreground">Lifetime Crates</span><span className="tabular-nums text-right">{row.lifetimeCrates.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Revenue" name="Revenue" stroke="oklch(0.32 0.06 155)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Feed Cost" name="Feed Cost" stroke="oklch(0.78 0.15 78)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  <Line type="monotone" dataKey="Profit" name="Profit" stroke="oklch(0.55 0.18 240)" strokeWidth={2.25} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
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

        {/* 1 — Recent Activities */}
        <RecentActivitiesCard eggs={eggs} feed={feed} mortality={mortality} health={health} prices={canPrices ? prices : []} bagWeightKg={bagKg} canViewAll={canAudit} />

        {canAudit && <RecentStaffActivity />}

        {/* 2 — Daily Production */}
        <div id="production" className="scroll-mt-24" />
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
                  {eggRoomSlots.map(s => (
                    <th key={s.room.id} className="py-2 pr-4 font-medium whitespace-nowrap">{s.room.name.replace(/^ROOM\s*/i, "R")}</th>
                  ))}
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Extra</th>
                  <th className="py-2 pr-2 font-medium w-6"></th>
                </tr>
              </thead>
              <tbody>
                {(eggShowAll ? eggs : eggs.slice(0, 7)).map(e => {
                  const norm = normaliseEggRow(e);
                  const prod = productionByDate.get(e.date);
                  const isOpen = expandedEggDate === e.date;
                  return (
                    <Fragment key={e.id ?? e.date + e.label}>
                      <tr className="border-b border-border/50 cursor-pointer hover:bg-secondary/40" onClick={() => setExpandedEggDate(isOpen ? null : e.date)}>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <ChevronDown className={"h-3.5 w-3.5 text-muted-foreground transition-transform " + (isOpen ? "rotate-180" : "")} />
                            {e.label}
                          </span>
                        </td>
                        {eggRoomSlots.map(s => (
                          <td key={s.room.id} className="py-2.5 pr-4 tabular-nums">{e[s.key]}</td>
                        ))}
                        <td className="py-2.5 pr-4">
                          <span className="inline-flex items-center rounded-full bg-[color:var(--forest)] text-primary-foreground px-2.5 py-0.5 text-xs font-medium">
                            {norm.crates}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{norm.extra ? `+${norm.extra}` : "—"}</td>
                        <td className="py-2.5 pr-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                          <RowActions onEdit={() => editEgg(e)} onDelete={() => delEgg(e)} />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border/50 bg-secondary/30">
                          <td colSpan={eggRoomSlots.length + 4} className="px-2 py-3 sm:px-3">
                            <div className="rounded-xl border border-border bg-card p-3 sm:max-w-md">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Daily Production Breakdown
                              </div>
                              <div className="mt-2 divide-y divide-border/60">
                                {(prod?.rooms ?? []).map(r => (
                                  <div key={r.roomId} className="grid grid-cols-[minmax(0,1fr)_auto_4.25rem] items-center gap-2 py-1.5 text-[13px]">
                                    <span className="truncate">{r.roomName.replace(/^ROOM\s*/i, "R")}</span>
                                    <span className="tabular-nums text-muted-foreground text-right">{r.eggs.toLocaleString()} eggs</span>
                                    <span className={`text-right tabular-nums font-semibold ${r.pct == null ? "text-muted-foreground font-normal" : "text-[color:var(--forest)]"}`}>
                                      {r.pct == null ? "N/A" : `${r.pct.toFixed(1)}%`}
                                    </span>
                                  </div>
                                ))}
                                <div className="grid grid-cols-[minmax(0,1fr)_auto_4.25rem] items-center gap-2 pt-2 text-[13px] font-semibold">
                                  <span>Overall</span>
                                  <span className="tabular-nums text-right">{(prod?.totalEggs ?? norm.totalEggs).toLocaleString()} eggs</span>
                                  <span className={`text-right tabular-nums ${prod?.overallPct == null ? "text-muted-foreground font-normal" : "text-[color:var(--forest)]"}`}>
                                    {prod?.overallPct == null ? "N/A" : `${prod.overallPct.toFixed(1)}%`}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                                {prod?.totalBirds != null && <div>Based on {prod.totalBirds.toLocaleString()} active birds on this date.</div>}
                                <div>Extra (loose) eggs: {norm.extra}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                    </Fragment>
                  );
                })}

                {eggs.length === 0 && (
                  <tr><td colSpan={eggRoomSlots.length + 4} className="py-4 text-center text-muted-foreground text-xs">
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

        {/* 3 — Room Management */}
        <div id="rooms" className="scroll-mt-24" />
        <Card>
          <CardHeader
            title={<span className="inline-flex items-center gap-2"><Bird className="h-5 w-5 text-[color:var(--forest)]" /> Room Management</span>}
            subtitle="Add, edit or remove poultry rooms — scalable for unlimited rooms"
            right={<ActionBtn onClick={addRoom} icon={Plus}>Add Room</ActionBtn>}
          />
          {missingAgeRooms.length > 0 && (
            <div className="mt-4 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-4">
              <p className="text-sm font-semibold">🐔 Complete Flock Profile</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Bird age has not been recorded for {missingAgeRooms.length === 1 ? `${missingAgeRooms[0].name}` : `${missingAgeRooms.length} flocks`}. Add the current age so PoultryPro can provide accurate feeding, water, vaccination, growth and management reminders.
              </p>
              {canManageAge && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {missingAgeRooms.map((r) => (
                    <button key={r.id} onClick={() => setAgeRoom(r)} className="rounded-full bg-[color:var(--forest)] px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                      Add Bird Age · {r.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <MiniStat label="Total Birds" value={totalBirds.toLocaleString()} tone="sky" />
            <MiniStat label="Active Rooms" value={`${productionRooms(rooms).length} of ${rooms.length}`} tone="mint" />
            <MiniStat label="Total Loss" value={String(totalLoss)} tone="peach" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roomTodaySummary.filter(s => roomStatus(s.room) !== "inactive").map(s => {
              const open = openRoomId === s.room.id;
              return (
                <div key={s.room.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <span className="truncate font-semibold text-sm">{s.room.name}</span>
                    <span className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${ROOM_STATUS_TONES[roomStatus(s.room)]}`}>
                      {ROOM_STATUS_LABELS[roomStatus(s.room)]}
                    </span>
                  </div>
                  <div className="mt-1 font-display text-xl font-semibold text-[color:var(--forest)]">
                    {s.room.current.toLocaleString()} <span className="text-xs font-sans font-normal text-muted-foreground">birds</span>
                  </div>
                  <div className="mt-2 space-y-0.5 text-[12px] text-muted-foreground">
                    <div>Production: <span className="tabular-nums text-foreground">{s.eggs.toLocaleString()} eggs</span></div>
                    <div>Mortality: <span className="tabular-nums text-foreground">{s.deaths}</span></div>
                    <div>Feed: <span className="tabular-nums text-foreground">{s.bags > 0 ? `${round1(s.bags * bagKg)} kg` : "N/A"}</span></div>
                  </div>
                  <button
                    onClick={() => setOpenRoomId(open ? null : s.room.id)}
                    className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--forest)] hover:underline"
                  >
                    {open ? "Hide room records" : "Open room records"}
                    <ChevronDown className={"h-3 w-3 transition-transform " + (open ? "rotate-180" : "")} />
                  </button>
                  {open && (
                    <div className="mt-3 space-y-3 border-t border-border pt-3 text-[11px]">
                      <div className="grid grid-cols-2 gap-y-0.5">
                        <span className="text-muted-foreground">Bird type</span><span className="text-right">{s.room.bird_type || "N/A"}</span>
                        <span className="text-muted-foreground">Bird age</span><span className="text-right">{hasAge(s.room) ? `${flockAge(s.room, ageToday).weeks} wks` : "N/A"}</span>
                        <span className="text-muted-foreground">Initial birds</span><span className="text-right tabular-nums">{s.room.initial.toLocaleString()}</span>
                        <span className="text-muted-foreground">Total loss</span><span className="text-right tabular-nums">{Math.max(0, s.room.initial - s.room.current)}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">Recent feed</div>
                        {s.recentFeed.length === 0 ? <div className="text-muted-foreground">No records</div> : s.recentFeed.map(f => (
                          <div key={f.id} className="flex justify-between"><span className="text-muted-foreground">{f.date}</span><span className="tabular-nums">{round1(f.bags * bagKg)} kg</span></div>
                        ))}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">Recent mortality</div>
                        {s.recentMortality.length === 0 ? <div className="text-muted-foreground">No records</div> : s.recentMortality.map(m => (
                          <div key={m.id} className="flex justify-between gap-2"><span className="truncate text-muted-foreground">{m.date} · {m.cause}</span><span className="tabular-nums">{Math.abs(m.loss)}</span></div>
                        ))}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">Recent health</div>
                        {s.recentHealth.length === 0 ? <div className="text-muted-foreground">No records</div> : s.recentHealth.map(h => (
                          <div key={h.id} className="flex justify-between gap-2"><span className="truncate text-muted-foreground">{h.date} · {h.name}</span><span>{h.type}</span></div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {rooms.length === 0 && (
              <div className="text-xs text-muted-foreground">No rooms yet — add your first room to start recording.</div>
            )}
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Room</th>
                  <th className="py-2 pr-4 font-medium">Bird Age</th>
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
                  const st = roomStatus(r);
                  return (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-3 pr-4">
                        <span className="flex items-center gap-2"><Bird className="h-4 w-4 text-[color:var(--forest)]" />{r.name}</span>
                        {st === "culled" && r.culled_on && (
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">Culled {r.culled_on}{r.culled_birds_sold ? ` · ${r.culled_birds_sold} birds sold` : ""}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {hasAge(r) ? (
                          <span className="block">
                            <span className="font-medium">{flockAge(r, ageToday).weeks} {flockAge(r, ageToday).weeks === 1 ? "Week" : "Weeks"}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {flockAge(r, ageToday).days} Days{flockStage(r, ageToday) ? ` · ${flockStage(r, ageToday)}` : ""}
                              {flockAge(r, ageToday).status === "estimated" ? " · estimated start" : ""}
                            </span>
                            {canManageAge && (
                              <button onClick={() => setAgeRoom(r)} className="mt-1 text-[11px] font-medium text-[color:var(--forest)] underline underline-offset-2">Edit age</button>
                            )}
                          </span>
                        ) : canManageAge ? (
                          <button onClick={() => setAgeRoom(r)} className="rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-2.5 py-1 text-xs font-semibold text-[color:var(--forest)]">Add Bird Age</button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not recorded</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">{r.current.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{r.initial.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-destructive">-{loss} <span className="text-xs">({pct}%)</span></td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${ROOM_STATUS_TONES[st]}`}>{ROOM_STATUS_LABELS[st]}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          <button onClick={() => editRoom(r)} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary">Edit</button>
                          {st !== "culled" && (
                            <button onClick={() => cullRoom(r)} className="rounded-full border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">Mark as Culled</button>
                          )}
                          <button onClick={() => archiveRoom(r)} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary">
                            {st === "inactive" ? "Restore" : "Archive"}
                          </button>
                          <button onClick={() => delRoom(r.id)} aria-label={`Delete ${r.name}`} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4 inline" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 4 — Room Comparison */}
        <RoomComparisonCard rooms={rooms} eggs={eggs} mortality={mortality} feed={feed} bagWeightKg={bagKg} />

        {/* 5 — Broken Eggs */}
        <BrokenEggsCard eggs={eggs} rooms={rooms} />

        {/* 6 — Room Overview */}
        <Card>
          <CardHeader title="Room Overview" subtitle="Current status, flock age and today's figures per room" />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {roomTodaySummary.map((s) => {
              const r = s.room;
              const st = roomStatus(r);
              return (
                <div key={r.id} className="rounded-2xl bg-secondary/40 p-4">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--forest)]/10 text-[color:var(--forest)]"><Bird className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-sm">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.current.toLocaleString()} birds · {r.bird_type || "N/A"} · {hasAge(r) ? `${flockAge(r, ageToday).weeks} weeks` : "Age N/A"}
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${ROOM_STATUS_TONES[st]}`}>{ROOM_STATUS_LABELS[st]}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-3">
                    <span className="text-muted-foreground">Production <span className="block tabular-nums text-foreground">{s.eggs.toLocaleString()} eggs</span></span>
                    <span className="text-muted-foreground">Production rate <span className="block tabular-nums text-foreground">{fmtPct(s.pct)}</span></span>
                    <span className="text-muted-foreground">Mortality <span className="block tabular-nums text-foreground">{s.deaths}</span></span>
                    <span className="text-muted-foreground">Feed issued <span className="block tabular-nums text-foreground">{s.bags > 0 ? `${round1(s.bags * bagKg)} kg` : "N/A"}</span></span>
                    <span className="text-muted-foreground">Health <span className="block text-foreground">{s.lastHealth ? s.lastHealth.type : "No records"}</span></span>
                    <span className="text-muted-foreground">Total loss <span className="block tabular-nums text-foreground">{Math.max(0, r.initial - r.current)}</span></span>
                  </div>
                </div>
              );
            })}
            {rooms.length === 0 && <div className="text-xs text-muted-foreground">No rooms yet.</div>}
          </div>
        </Card>

        {/* 7 — Feed Management */}
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
                <MiniStat label="Today's Feed" value={`${round1(feedToday * bagKg)} kg`} tone="sky" hint={`${round1(feedToday)} bags`} />
                <MiniStat label="7-Day Avg" value={`${round1(feed7Avg * bagKg)} kg/day`} tone="mint" hint={`${round1(feed7Avg)} bags/day`} />
                <MiniStat label="Feed / Bird" value={`${feedPerBirdG.toFixed(0)} g`} tone="plain" />
                <MiniStat label="30-Day Avg" value={`${round1(feed30Avg * bagKg)} kg/day`} tone="peach" hint={`${round1(w30.totalBags * bagKg)} kg total · ${round1(w30.totalBags)} bags`} />
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
                            {feedRoomNames.map(rn => {
                              const bagsVal = g.byRoom[rn];
                              return (
                                <td key={rn} className="py-2 px-3 text-right tabular-nums">
                                  {bagsVal
                                    ? <span>{round1(bagsVal * bagKg)}<span className="text-[10px] text-muted-foreground ml-0.5">kg</span></span>
                                    : <span className="text-muted-foreground/50">—</span>}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 text-right font-semibold tabular-nums whitespace-nowrap">
                              {round1(g.total * bagKg)} kg
                              <span className="ml-1 text-[10px] font-normal text-muted-foreground">({round1(g.total)} bags)</span>
                            </td>
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
                                        <span className="tabular-nums">{round1(f.bags * bagKg)} kg <span className="text-muted-foreground">({round1(f.bags)} bags)</span></span>
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

        {/* 8 — Mortality Log */}
          {/* Mortality */}
          <Card>
            <CardHeader
              title={<span className="inline-flex items-center gap-2"><Skull className="h-5 w-5 text-destructive" /> Mortality Log</span>}
              subtitle="One row per date — tap a row for the full analysis"
              right={<ActionBtn onClick={addMortality} icon={Plus}>Add</ActionBtn>}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <MiniStat label="Total Mortality" value={birdsLabel(totalMortality)} tone="peach" />
              <MiniStat label="7-Day Mortality" value={birdsLabel(sevenDayMortality)} tone="sky" />
              <MiniStat label="Current Flock" value={currentFlock.toLocaleString()} tone="mint" />
              <MiniStat label="Mortality Rate" value={mortalityRatePct.toFixed(2) + "%"} tone="plain" />
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 font-medium">Date</th>
                    {mortRoomCols.map(r => (
                      <th key={r.id} className="py-2 pr-4 font-medium whitespace-nowrap">
                        {r.name.replace(/^ROOM\s*/i, "R")}
                      </th>
                    ))}
                    <th className="py-2 pr-4 font-medium">Total</th>
                    <th className="py-2 pr-2 font-medium w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {(mortShowAll ? mortalityByDate : mortalityByDate.slice(0, 7)).map(g => {
                    const isOpen = expandedMortDate === g.date;
                    const single = g.items.length === 1 ? g.items[0] : null;
                    return (
                      <Fragment key={g.date}>
                        <tr
                          className="border-b border-border/50 cursor-pointer hover:bg-secondary/40"
                          onClick={() => setExpandedMortDate(isOpen ? null : g.date)}
                        >
                          <td className="py-2.5 pr-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <ChevronDown className={"h-3.5 w-3.5 text-muted-foreground transition-transform " + (isOpen ? "rotate-180" : "")} />
                              {formatDayLabel(g.date)}
                            </span>
                          </td>
                          {g.rooms.map(r => (
                            <td key={r.roomId} className="py-2.5 pr-4 tabular-nums">{r.deaths}</td>
                          ))}
                          <td className="py-2.5 pr-4">
                            <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2.5 py-0.5 text-xs font-medium tabular-nums">
                              {g.total}
                            </span>
                          </td>
                          <td className="py-2.5 pr-2 text-right" onClick={(e) => e.stopPropagation()}>
                            {single && <RowActions onEdit={() => editMortality(single)} onDelete={() => delMortalityRow(single)} />}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-border/50 bg-secondary/30">
                            <td colSpan={mortRoomCols.length + 3} className="px-3 py-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Mortality Analysis</div>
                              <div className="mt-2 space-y-1.5 max-w-md">
                                {g.rooms.map(r => (
                                  <div key={r.roomId} className="flex items-center justify-between gap-3 text-sm">
                                    <span className="truncate">{r.roomName}</span>
                                    <span className="tabular-nums">{birdsLabel(r.deaths)}</span>
                                  </div>
                                ))}
                                <div className="pt-2 mt-2 border-t border-border flex items-center justify-between gap-3 text-sm font-semibold">
                                  <span>Total</span>
                                  <span className="tabular-nums">{birdsLabel(g.total)}</span>
                                </div>
                              </div>

                              <div className="mt-3 max-w-md">
                                <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                                  <span>Overall Mortality Rate</span>
                                  <span className={`tabular-nums ${g.overallPct == null ? "text-muted-foreground font-normal" : ""}`}>{fmtPct(g.overallPct)}</span>
                                </div>
                                <div className="mt-1.5 space-y-1">
                                  {g.rooms.map(r => (
                                    <div key={r.roomId} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                      <span className="truncate">{r.roomName} Mortality Rate</span>
                                      <span className="tabular-nums">{fmtPct(r.pct)}</span>
                                    </div>
                                  ))}
                                </div>
                                {g.totalBirds !== null && (
                                  <div className="mt-2 text-[11px] text-muted-foreground">
                                    Based on {g.totalBirds.toLocaleString()} active birds on this date.
                                  </div>
                                )}
                              </div>

                              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                                {g.items.map(m => (
                                  <div key={m.id} className="flex items-center justify-between gap-2 text-xs">
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
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {mortalityByDate.length === 0 && (
                    <tr><td colSpan={mortRoomCols.length + 3} className="py-4 text-center text-muted-foreground text-xs">
                      No mortality records yet.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {mortalityByDate.length > 7 && (
              <div className="mt-3 text-center">
                <button onClick={() => setMortShowAll(v => !v)} className="text-xs font-medium text-[color:var(--forest)] hover:underline">
                  {mortShowAll ? "Show latest 7 only" : `View all mortality records (${mortalityByDate.length})`}
                </button>
              </div>
            )}
          </Card>

        {/* 9 — Health Records */}
        <div id="health" className="scroll-mt-24" />
        <Card>
          <CardHeader title="Health Records" subtitle="Vaccinations, vitamins, treatments & observations" right={<ActionBtn onClick={addHealth} icon={Plus}>Add</ActionBtn>} />
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 font-medium">Room</th>
                  <th className="py-2 px-3 font-medium">Health Record</th>
                  <th className="py-2 px-3 font-medium">Action</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-2 w-6"></th>
                </tr>
              </thead>
              <tbody>
                {(healthShowAll ? healthByDate : healthByDate.slice(0, 5)).map(h => {
                  const isOpen = expandedHealthId === h.id;
                  const status = h.type === "Observation" ? "Normal" : (h.type === "Treatment" || h.type === "Medication") ? "Monitoring" : "Completed";
                  return (
                    <Fragment key={h.id}>
                      <tr className="cursor-pointer border-t border-border/60 hover:bg-secondary/40" onClick={() => setExpandedHealthId(isOpen ? null : h.id)}>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <ChevronDown className={"h-3.5 w-3.5 text-muted-foreground transition-transform " + (isOpen ? "rotate-180" : "")} />
                            {h.date}
                          </span>
                        </td>
                        <td className="py-2 px-3">{h.scope || "—"}</td>
                        <td className="py-2 px-3">{h.name}</td>
                        <td className="py-2 px-3">
                          <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + healthTypeStyle(h.type).badge}>{h.type}</span>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{status}</td>
                        <td className="py-2 px-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                          <RowActions onEdit={() => editHealth(h)} onDelete={() => delHealthRow(h)} />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-secondary/30">
                          <td colSpan={6} className="px-3 py-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Full record</div>
                            <div className="mt-2 grid max-w-xl grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
                              <span className="text-muted-foreground">Date</span><span>{h.date}</span>
                              <span className="text-muted-foreground">Room / scope</span><span>{h.scope || "N/A"}</span>
                              <span className="text-muted-foreground">Record</span><span>{h.name}</span>
                              <span className="text-muted-foreground">Type</span><span>{h.type}</span>
                              <span className="text-muted-foreground">Status</span><span>{status}</span>
                              <span className="text-muted-foreground">Symptoms</span><span className="text-muted-foreground">Not recorded</span>
                              <span className="text-muted-foreground">Diagnosis</span><span className="text-muted-foreground">Not recorded</span>
                              <span className="text-muted-foreground">Medication / dosage</span><span className="text-muted-foreground">Not recorded</span>
                              <span className="text-muted-foreground">Duration</span><span className="text-muted-foreground">Not recorded</span>
                              <span className="text-muted-foreground">Veterinary notes</span><span className="text-muted-foreground">Not recorded</span>
                              <span className="text-muted-foreground">Follow-up date</span><span className="text-muted-foreground">Not recorded</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {healthByDate.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-xs text-muted-foreground">No health records yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {healthByDate.length > 5 && (
            <div className="mt-3 text-center">
              <button onClick={() => setHealthShowAll(v => !v)} className="text-xs font-medium text-[color:var(--forest)] hover:underline">
                {healthShowAll ? "Show recent records" : `View all health records (${healthByDate.length})`}
              </button>
            </div>
          )}
        </Card>

        {/* 10 — Current Prices */}
        {/* Prices — owner-only. Managers never see or change pricing. */}
        {canPrices && (<>
        <div id="prices" className="scroll-mt-24" />

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
                {prices.map(p => {
                  const unitLabel = priceUnitLabel(p.item, p.unit, bagWeightKg ?? 25);
                  const feedMatch = /feed/i.test(p.item) ? /(\d+(?:\.\d+)?)\s*kg/i.exec(unitLabel) : null;
                  const bagKg = feedMatch ? Number(feedMatch[1]) : null;
                  const perKg = bagKg && bagKg > 0 && p.price > 0 ? p.price / bagKg : null;
                  return (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-3 pr-4">{p.item}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{unitLabel}</td>
                      <td className="py-3 pr-4 font-semibold">
                        {naira(p.price)}
                        {perKg !== null && (
                          <div className="text-[11px] font-normal text-muted-foreground mt-0.5">
                            ≈ ₦{perKg.toLocaleString(undefined, { maximumFractionDigits: 2 })}/kg
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{p.updated}</td>
                      <td className="py-3 pr-4 text-right space-x-3">
                        <button onClick={() => openDialog({ kind: "price-edit", item: p })} className="text-muted-foreground hover:text-foreground" aria-label={`Edit ${p.item}`}><Pencil className="h-4 w-4 inline" /></button>
                        <button onClick={() => delPrice(p.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4 inline" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        </>)}

          </div>
        )}

        {area === "ai" && canAIArea && (
          <div className="space-y-6">
            <SectionIntro
              stage="PREDICT" plan="Premium" title="PoultryPro AI Intelligence" premium
              body="Progressively applying artificial intelligence to detect abnormal farm patterns, forecast production and support earlier evidence-based decisions."
            />
            <div id="ai-insights" className="scroll-mt-24" />
            {/* AI-Supported Farm Insights — final summary layer combining PoultryPro modules */}
            <FarmInsightsIntelligence
              eggs={eggs} rooms={rooms} mortality={mortality} feed={feed} health={health} prices={prices}
              bagWeightKg={bagWeightKg}
              loading={eggsQ.isLoading || roomsQ.isLoading || mortalityQ.isLoading || feedQ.isLoading || healthQ.isLoading || pricesQ.isLoading}
            />

            <div id="ai-production" className="scroll-mt-24" />
            {/* Production Decline Detection — real-time from farm records */}
            <ProductionDeclineIntelligence eggs={eggs} rooms={rooms} mortality={mortality} feed={feed} health={health} />

            <div id="ai-mortality" className="scroll-mt-24" />
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
                  metric={`${round1(feedToday * bagKg)} kg`}
                  metricLabel={`(${round1(feedToday)} bags) for ${todayEggs.toLocaleString()} eggs today`}
                  observation={`Today's feed usage is ${round1(feedToday * bagKg)} kg (${round1(feedToday)} bags) against ${todayEggs.toLocaleString()} eggs produced across ${rooms.length} rooms.`}
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
      {ageRoom && <FlockAgeDialog room={ageRoom} onClose={() => setAgeRoom(null)} />}
      <RecordConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <UpgradeDialog tier={upgradeTier} open={upgradeTier !== null} onOpenChange={(v) => { if (!v) setUpgradeTier(null); }} />

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

function MiniStat({ label, value, tone, hint }: { label: string; value: string; tone: keyof typeof toneMap; hint?: string }) {
  return (
    <div className={"rounded-xl border p-3 " + toneMap[tone]}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Egg className="h-3.5 w-3.5" /> {label}</div>
      <div className="font-display text-xl font-semibold mt-1">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{hint}</div>}
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  const place = React.useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 180;
    const height = extra ? 132 : 92;
    let left = r.right - width;
    left = Math.min(Math.max(12, left), window.innerWidth - width - 12);
    let top = r.bottom + 6;
    if (top + height > window.innerHeight - 12) top = Math.max(12, r.top - height - 6);
    setPos({ top, left });
  }, [extra]);

  React.useEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place]);

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        aria-label="Row actions"
        onClick={() => setOpen(v => !v)}
        className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && pos && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[100] w-[180px] rounded-xl border border-border bg-background shadow-xl overflow-hidden"
            style={{ top: pos.top, left: pos.left }}
          >
            {extra && (
              <button onClick={() => { setOpen(false); extra.onClick(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-left hover:bg-secondary">
                <Pencil className="h-3.5 w-3.5" /> {extra.label}
              </button>
            )}
            <button onClick={() => { setOpen(false); onEdit(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-left hover:bg-secondary">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-left text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}




type AreaState = "current" | "included" | "upgrade-standard" | "upgrade-premium";

const AREA_STATE_LABEL: Record<AreaState, string> = {
  "current": "Your current plan",
  "included": "Included",
  "upgrade-standard": "Upgrade to Standard",
  "upgrade-premium": "Unlock with Premium",
};

function AreaTab({ active, onClick, num, stage, title, shortLabel, state, icon: Icon, premium }: {
  active: boolean; onClick: () => void; num: string; stage: string; title: string; shortLabel?: string;
  state: AreaState;
  icon: React.ComponentType<{ className?: string }>; premium?: boolean;
}) {
  const label = shortLabel ?? title;
  const locked = state === "upgrade-standard" || state === "upgrade-premium";
  const isCurrent = state === "current";
  return (
    <button
      onClick={onClick}
      aria-label={`${title} — ${AREA_STATE_LABEL[state]}`}
      className={
        "group relative text-left rounded-xl md:rounded-2xl border px-2 py-2.5 md:p-4 transition-all duration-200 min-w-0 h-full flex flex-col justify-between hover:-translate-y-0.5 " +
        (active
          ? (premium
              ? "bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--ink)] text-primary-foreground border-[color:var(--gold)]/50 shadow-[var(--shadow-lift)]"
              : "bg-[color:var(--forest)] text-primary-foreground border-[color:var(--forest)] shadow-[var(--shadow-lift)]")
          : isCurrent
            ? "bg-[color:var(--forest)]/5 text-[color:var(--forest)] border-[color:var(--forest)]/40 hover:border-[color:var(--forest)]/60 hover:shadow-[var(--shadow-soft)]"
            : locked
              ? "bg-card text-[color:var(--forest)] border-dashed border-[color:var(--gold)]/50 hover:border-[color:var(--gold)] hover:shadow-[var(--shadow-soft)]"
              : "bg-card text-[color:var(--forest)] border-border hover:border-[color:var(--forest)]/40 hover:shadow-[var(--shadow-soft)]")
      }
    >
      <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
        <span className={"grid h-7 w-7 md:h-8 md:w-8 shrink-0 place-items-center rounded-lg " + (active ? "bg-white/10 text-[color:var(--gold)]" : locked ? "bg-[color:var(--gold)]/15 text-[color:var(--gold)]" : "bg-[color:var(--forest)]/8 text-[color:var(--forest)]")}>
          <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className={"hidden md:block text-[10px] uppercase tracking-[0.18em] " + (active ? "text-[color:var(--gold)]" : "text-muted-foreground")}>
            {num} · {stage}
          </div>
          <div className="text-[13px] md:text-base font-semibold leading-tight">
            <span className="md:hidden">{label}</span>
            <span className="hidden md:inline">{title}</span>
          </div>
        </div>
        {locked && (
          <span className="md:hidden shrink-0 text-[color:var(--gold)]">
            <Lock className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className={
        "mt-2 hidden md:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium " +
        (active
          ? "bg-white/10 text-primary-foreground"
          : isCurrent
            ? "bg-[color:var(--forest)] text-primary-foreground"
            : locked
              ? "bg-[color:var(--gold)]/15 text-[color:var(--ink)]"
              : "bg-secondary text-secondary-foreground")
      }>
        {locked && <Lock className="h-2.5 w-2.5" />}
        {AREA_STATE_LABEL[state]}
      </div>
    </button>
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
              value={hasWeight ? `${fmtNum(analysis.latest.bags * (bagWeightKg as number))} kg` : `${fmtNum(analysis.latest.bags)} bags`}
              hint={hasWeight ? `${fmtNum(analysis.latest.bags)} bags (1 bag = ${bagWeightKg} kg)` : "Configure bag weight for kg"}
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

