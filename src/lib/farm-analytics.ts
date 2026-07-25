// PoultryPro — Farm Analytics Engine
// Pure functions that compute every dashboard metric dynamically from raw
// database rows using calendar-date keys. No cumulative sums leak into
// daily/monthly figures. Empty inputs return safe zeros — never NaN/Infinity.

import type { EggRow, Room, Mortality, Feed, Health, Price } from "@/lib/farm-data";
import { normaliseEggRow, totalEggsFromRow } from "@/lib/egg-normalize";
import { toDateKey } from "@/lib/date-key";

// ---------------------------------------------------------------------------
// Date-range primitives
// ---------------------------------------------------------------------------

export type DateRangePreset =
  | "today" | "yesterday" | "last_7" | "this_month" | "last_month" | "custom" | "all";

export type DateRange = { start: string; end: string; label: string; preset: DateRangePreset };

function pad(n: number) { return n < 10 ? `0${n}` : String(n); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function rangeFromPreset(preset: DateRangePreset, custom?: { start: string; end: string }): DateRange {
  const now = new Date();
  const todayKey = ymd(now);
  switch (preset) {
    case "today":
      return { start: todayKey, end: todayKey, label: "Today", preset };
    case "yesterday": {
      const y = new Date(now); y.setDate(now.getDate() - 1);
      const k = ymd(y);
      return { start: k, end: k, label: "Yesterday", preset };
    }
    case "last_7": {
      const s = new Date(now); s.setDate(now.getDate() - 6);
      return { start: ymd(s), end: todayKey, label: "Last 7 days", preset };
    }
    case "this_month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: ymd(s), end: todayKey, label: "This month", preset };
    }
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: ymd(s), end: ymd(e), label: "Last month", preset };
    }
    case "custom":
      return {
        start: custom?.start ?? todayKey,
        end: custom?.end ?? todayKey,
        label: "Custom",
        preset,
      };
    case "all":
    default:
      return { start: "0000-01-01", end: "9999-12-31", label: "All time", preset: "all" };
  }
}

export function inRange(dateKey: string | null, range: DateRange): boolean {
  if (!dateKey) return false;
  return dateKey >= range.start && dateKey <= range.end;
}

// ---------------------------------------------------------------------------
// Price lookup
// ---------------------------------------------------------------------------

function findPrice(prices: Price[], match: RegExp, fallback: number): number {
  const hit = prices.find(p => match.test(p.item));
  return hit && Number.isFinite(hit.price) ? Number(hit.price) : fallback;
}

export function eggPricePerCrate(prices: Price[]): number { return findPrice(prices, /egg/i, 4900); }
export function feedPricePerBag(prices: Price[]): number { return findPrice(prices, /feed/i, 13600); }

/**
 * Cost per kilogram of feed. Feed price is captured PER BAG on a per-farm
 * configurable bag weight (default 25 kg). Every financial calculation
 * must derive per-kg cost from this helper so profit math stays consistent
 * whether the farm uses 25/40/50 kg bags. Formula: bagPrice / bagWeightKg.
 */
export function feedPricePerKg(prices: Price[], bagWeightKg: number | null | undefined): number {
  const bagPrice = feedPricePerBag(prices);
  const w = Number.isFinite(Number(bagWeightKg)) && Number(bagWeightKg) > 0 ? Number(bagWeightKg) : 25;
  return bagPrice / w;
}

/** Unit label helper for the Prices table. */
export function priceUnitLabel(item: string, unit: string | null | undefined, bagWeightKg: number): string {
  const u = (unit ?? "").trim();
  if (u && u !== "1") return u;
  if (/egg/i.test(item)) return "Crate";
  if (/feed/i.test(item)) return `${bagWeightKg} kg Bag`;
  return u || "unit";
}

// ---------------------------------------------------------------------------
// Bird population
// ---------------------------------------------------------------------------

export type BirdPopulation = {
  totalLiveBirds: number;
  initialBirds: number;
  birdsAdded: number;      // not tracked yet — always 0
  birdsSold: number;       // not tracked yet — always 0
  totalMortalityAllTime: number;
  currentFlockSize: number;
  activeRooms: number;
};

export function computeBirdPopulation(rooms: Room[], mortality: Mortality[]): BirdPopulation {
  const totalLiveBirds = rooms.reduce((s, r) => s + Math.max(0, r.current), 0);
  const initialBirds = rooms.reduce((s, r) => s + Math.max(0, r.initial), 0);
  const totalMortalityAllTime = mortality.reduce((s, m) => s + Math.abs(m.loss || 0), 0);
  return {
    totalLiveBirds,
    initialBirds,
    birdsAdded: 0,
    birdsSold: 0,
    totalMortalityAllTime,
    currentFlockSize: totalLiveBirds,
    activeRooms: rooms.length,
  };
}

// ---------------------------------------------------------------------------
// Room-level egg breakdown for a given production record
// ---------------------------------------------------------------------------

function roomCratesFromRow(roomName: string, e: EggRow): number {
  const m = /(\d+)/.exec(roomName);
  if (!m) return 0;
  const key = ("r" + m[1]) as "r2" | "r3" | "r4";
  const rec = e as unknown as Record<string, number>;
  return Number(rec[key] ?? 0);
}

// ---------------------------------------------------------------------------
// Aggregations against a date range
// ---------------------------------------------------------------------------

export type PeriodMetrics = {
  range: DateRange;
  eggs: number;                    // total eggs
  crates: number;                  // floor(eggs/30)
  extraEggs: number;               // eggs % 30
  revenue: number;                 // NGN — (eggs/30) * eggPricePerCrate
  feedBags: number;                // total bags in range (may be fractional)
  feedKg: number;                  // total kg in range = feedBags * bagWeightKg
  feedCost: number;                // NGN — feedKg * costPerKg
  profit: number;                  // NGN — revenue - feedCost
  mortalityCount: number;
  mortalityPct: number | null;     // vs initial birds
  healthRecords: number;
  productionRecords: number;
  feedRecords: number;
};

export function computePeriodMetrics(input: {
  range: DateRange;
  eggs: EggRow[];
  feed: Feed[];
  mortality: Mortality[];
  health: Health[];
  eggPrice: number;                // NGN per crate
  costPerKg: number;               // NGN per kg of feed
  bagWeightKg: number;             // kg per bag
  initialBirds: number;
}): PeriodMetrics {
  const { range, eggs, feed, mortality, health, eggPrice, costPerKg, bagWeightKg, initialBirds } = input;

  const eggRows = eggs.filter(e => inRange(toDateKey(e.date), range));
  const feedRows = feed.filter(f => inRange(toDateKey(f.date), range));
  const mortRows = mortality.filter(m => inRange(toDateKey(m.date), range));
  const healthRows = health.filter(h => inRange(toDateKey(h.date), range));

  const eggsTotal = eggRows.reduce((s, e) => s + totalEggsFromRow(e), 0);
  const crates = Math.floor(eggsTotal / 30);
  const extraEggs = eggsTotal % 30;
  const revenue = Math.round((eggsTotal / 30) * eggPrice);

  const feedBags = feedRows.reduce((s, f) => s + Number(f.bags || 0), 0);
  const feedKg = feedBags * bagWeightKg;
  const feedCost = Math.round(feedKg * costPerKg);
  const profit = revenue - feedCost;

  const mortalityCount = mortRows.reduce((s, m) => s + Math.abs(m.loss || 0), 0);
  const mortalityPct = initialBirds > 0 ? (mortalityCount / initialBirds) * 100 : null;

  return {
    range,
    eggs: eggsTotal,
    crates,
    extraEggs,
    revenue,
    feedBags,
    feedKg,
    feedCost,
    profit,
    mortalityCount,
    mortalityPct,
    healthRecords: healthRows.length,
    productionRecords: eggRows.length,
    feedRecords: feedRows.length,
  };
}

// ---------------------------------------------------------------------------
// Daily financial series — the single source of truth for daily/monthly
// financials on charts, reports, and exports. Joins production and feed by
// calendar date so revenue, feed cost and profit line up per day.
// Monthly totals MUST be derived by summing this series so every widget
// (KPI cards, charts, reports, Super Admin) matches to the naira.
// ---------------------------------------------------------------------------

export type DailyFinancialPoint = {
  date: string;         // YYYY-MM-DD
  label: string;        // human friendly (e.g. "12 Apr")
  eggs: number;
  crates: number;
  revenue: number;      // NGN
  feedKg: number;
  feedBags: number;
  feedCost: number;     // NGN
  profit: number;       // NGN
};

export function computeDailyFinancialSeries(input: {
  range: DateRange;
  eggs: EggRow[];
  feed: Feed[];
  eggPrice: number;
  costPerKg: number;
  bagWeightKg: number;
}): DailyFinancialPoint[] {
  const { range, eggs, feed, eggPrice, costPerKg, bagWeightKg } = input;
  const buckets = new Map<string, { eggs: number; feedBags: number }>();

  for (const e of eggs) {
    const k = toDateKey(e.date); if (!k || !inRange(k, range)) continue;
    const b = buckets.get(k) ?? { eggs: 0, feedBags: 0 };
    b.eggs += totalEggsFromRow(e);
    buckets.set(k, b);
  }
  for (const f of feed) {
    const k = toDateKey(f.date); if (!k || !inRange(k, range)) continue;
    const b = buckets.get(k) ?? { eggs: 0, feedBags: 0 };
    b.feedBags += Number(f.bags || 0);
    buckets.set(k, b);
  }

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const keys = Array.from(buckets.keys()).sort();
  return keys.map(k => {
    const b = buckets.get(k)!;
    const crates = Math.floor(b.eggs / 30);
    const revenue = Math.round((b.eggs / 30) * eggPrice);
    const feedKg = b.feedBags * bagWeightKg;
    const feedCost = Math.round(feedKg * costPerKg);
    const [, m, d] = k.split("-");
    const label = `${Number(d)} ${months[Number(m) - 1]}`;
    return {
      date: k, label,
      eggs: b.eggs, crates,
      revenue,
      feedKg, feedBags: b.feedBags, feedCost,
      profit: revenue - feedCost,
    };
  });
}

// ---------------------------------------------------------------------------
// Production rate & target gap
// ---------------------------------------------------------------------------

export type ProductionRate = {
  todayEggs: number;
  totalLiveBirds: number;
  currentPct: number | null;       // (todayEggs / totalLiveBirds) * 100
  targetPct: number;               // configurable, default 80
  gapPts: number | null;           // currentPct - targetPct (percentage points)
  status: "above_target" | "at_target" | "below_target" | "no_data";
};

export function computeProductionRate(input: {
  eggs: EggRow[];
  totalLiveBirds: number;
  targetPct?: number;
}): ProductionRate {
  const targetPct = input.targetPct ?? 80;
  const todayKey = ymd(new Date());
  const todayRow = input.eggs.find(e => toDateKey(e.date) === todayKey) ?? input.eggs[0] ?? null;
  const todayEggs = todayRow ? totalEggsFromRow(todayRow) : 0;

  if (input.totalLiveBirds <= 0 || todayEggs <= 0) {
    return {
      todayEggs,
      totalLiveBirds: input.totalLiveBirds,
      currentPct: null,
      targetPct,
      gapPts: null,
      status: "no_data",
    };
  }
  const currentPct = Math.min(100, (todayEggs / input.totalLiveBirds) * 100);
  const gapPts = currentPct - targetPct;
  const status: ProductionRate["status"] =
    Math.abs(gapPts) < 0.05 ? "at_target" : gapPts > 0 ? "above_target" : "below_target";
  return { todayEggs, totalLiveBirds: input.totalLiveBirds, currentPct, targetPct, gapPts, status };
}

// ---------------------------------------------------------------------------
// Daily comparison — latest recorded vs previous recorded production day
// ---------------------------------------------------------------------------

export type DailyComparison = {
  hasComparison: boolean;
  latestDate: string | null;
  latestEggs: number;
  previousDate: string | null;
  previousEggs: number;
  deltaEggs: number;
  deltaPct: number | null;
  message?: string;
};

export function compareLatestTwoDays(eggs: EggRow[]): DailyComparison {
  const sorted = [...eggs].sort((a, b) => {
    const ka = toDateKey(a.date) ?? "";
    const kb = toDateKey(b.date) ?? "";
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  });
  const latest = sorted[0];
  const previous = sorted[1];
  if (!latest) {
    return { hasComparison: false, latestDate: null, latestEggs: 0, previousDate: null, previousEggs: 0, deltaEggs: 0, deltaPct: null, message: "No production records yet." };
  }
  if (!previous) {
    return {
      hasComparison: false,
      latestDate: toDateKey(latest.date),
      latestEggs: totalEggsFromRow(latest),
      previousDate: null,
      previousEggs: 0,
      deltaEggs: 0,
      deltaPct: null,
      message: "No previous record available.",
    };
  }
  const latestEggs = totalEggsFromRow(latest);
  const previousEggs = totalEggsFromRow(previous);
  const deltaEggs = latestEggs - previousEggs;
  const deltaPct = previousEggs > 0 ? (deltaEggs / previousEggs) * 100 : null;
  return {
    hasComparison: true,
    latestDate: toDateKey(latest.date),
    latestEggs,
    previousDate: toDateKey(previous.date),
    previousEggs,
    deltaEggs,
    deltaPct,
  };
}

// ---------------------------------------------------------------------------
// Highest producing room today
// ---------------------------------------------------------------------------

export type HighestRoom = {
  hasData: boolean;
  roomName: string | null;
  crates: number;
  eggs: number;
  sharePct: number | null;   // % of today's total production
  totalCratesToday: number;
};

export function computeHighestRoom(eggs: EggRow[], rooms: Room[]): HighestRoom {
  const sorted = [...eggs].sort((a, b) => {
    const ka = toDateKey(a.date) ?? "";
    const kb = toDateKey(b.date) ?? "";
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  });
  const latest = sorted[0];
  if (!latest || rooms.length === 0) {
    return { hasData: false, roomName: null, crates: 0, eggs: 0, sharePct: null, totalCratesToday: 0 };
  }
  const perRoom = rooms.map(r => ({
    name: r.name,
    crates: roomCratesFromRow(r.name, latest),
  })).sort((a, b) => b.crates - a.crates);

  const totalCratesToday = perRoom.reduce((s, r) => s + r.crates, 0);
  const winner = perRoom[0];
  if (!winner || winner.crates === 0) {
    return { hasData: false, roomName: null, crates: 0, eggs: 0, sharePct: null, totalCratesToday };
  }
  return {
    hasData: true,
    roomName: winner.name,
    crates: winner.crates,
    eggs: winner.crates * 30,
    sharePct: totalCratesToday > 0 ? (winner.crates / totalCratesToday) * 100 : null,
    totalCratesToday,
  };
}

// ---------------------------------------------------------------------------
// Feed analytics
// ---------------------------------------------------------------------------

export type FeedAnalytics = {
  todayBags: number;
  monthlyBags: number;
  allTimeBags: number;
  feedPerBirdG: number | null;         // grams per bird per day (today)
  fcr: number | null;                  // kg feed per dozen eggs (all-time)
};

export function computeFeedAnalytics(input: {
  feed: Feed[];
  eggs: EggRow[];
  totalLiveBirds: number;
  bagWeightKg?: number | null;
}): FeedAnalytics {
  const bagKg = input.bagWeightKg ?? 25;
  const todayKey = ymd(new Date());
  const monthStart = ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const todayBags = input.feed
    .filter(f => toDateKey(f.date) === todayKey)
    .reduce((s, f) => s + Number(f.bags || 0), 0);
  const monthlyBags = input.feed
    .filter(f => {
      const k = toDateKey(f.date); return !!k && k >= monthStart && k <= todayKey;
    })
    .reduce((s, f) => s + Number(f.bags || 0), 0);
  const allTimeBags = input.feed.reduce((s, f) => s + Number(f.bags || 0), 0);

  const feedPerBirdG = input.totalLiveBirds > 0
    ? (todayBags * bagKg * 1000) / input.totalLiveBirds
    : null;

  const totalEggs = input.eggs.reduce((s, e) => s + totalEggsFromRow(e), 0);
  const totalDozens = totalEggs / 12;
  const fcr = totalDozens > 0 ? (allTimeBags * bagKg) / totalDozens : null;

  return { todayBags, monthlyBags, allTimeBags, feedPerBirdG, fcr };
}

// ---------------------------------------------------------------------------
// AI Farm Health Score (0–100)
// Weights: production 40%, mortality 30%, feed anomaly 20%, data freshness 10%
// ---------------------------------------------------------------------------

export type FarmHealthScore = {
  score: number;                  // 0-100
  grade: "Excellent" | "Good" | "Fair" | "At Risk" | "No Data";
  reasons: string[];
};

export function computeFarmHealthScore(input: {
  productionRate: ProductionRate;
  monthlyMortality: number;
  allTimeMortality: number;
  initialBirds: number;
  eggs: EggRow[];
  feed: Feed[];
}): FarmHealthScore {
  const reasons: string[] = [];

  // Not enough data
  if (input.eggs.length === 0 && input.feed.length === 0) {
    return { score: 0, grade: "No Data", reasons: ["No farm records yet"] };
  }

  // Production component (40)
  let prodScore = 20;
  if (input.productionRate.currentPct !== null) {
    const pct = input.productionRate.currentPct;
    prodScore = Math.max(0, Math.min(40, (pct / 80) * 40));
    if (pct < 60) reasons.push("Production below 60%");
    else if (pct >= 80) reasons.push("Production at or above target");
  } else {
    reasons.push("Not enough production data");
  }

  // Mortality component (30) — lower monthly rate = higher score
  let mortScore = 15;
  if (input.initialBirds > 0) {
    const monthlyPct = (input.monthlyMortality / input.initialBirds) * 100;
    // 0% → 30 pts, 1% → 15 pts, ≥2% → 0 pts
    mortScore = Math.max(0, Math.min(30, 30 - monthlyPct * 15));
    if (monthlyPct >= 1) reasons.push(`Monthly mortality elevated (${monthlyPct.toFixed(2)}%)`);
  }

  // Feed anomaly component (20) — check if last 7 days vs prior 7 days changed >30%
  let feedScore = 15;
  if (input.feed.length >= 14) {
    const bagsByDay = new Map<string, number>();
    for (const f of input.feed) {
      const k = toDateKey(f.date); if (!k) continue;
      bagsByDay.set(k, (bagsByDay.get(k) ?? 0) + Number(f.bags || 0));
    }
    const days = Array.from(bagsByDay.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    const last7 = days.slice(0, 7).reduce((s, d) => s + d[1], 0) / 7;
    const prev7 = days.slice(7, 14).reduce((s, d) => s + d[1], 0) / 7;
    if (prev7 > 0) {
      const change = Math.abs((last7 - prev7) / prev7) * 100;
      feedScore = change > 30 ? 5 : change > 15 ? 12 : 20;
      if (change > 30) reasons.push(`Feed usage swung ${change.toFixed(0)}% week-on-week`);
    }
  }

  // Data freshness (10) — has record in last 3 days?
  let freshScore = 5;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 3);
  const cutoffKey = ymd(cutoff);
  const hasFresh = input.eggs.some(e => (toDateKey(e.date) ?? "") >= cutoffKey);
  freshScore = hasFresh ? 10 : 3;
  if (!hasFresh) reasons.push("No production records in the last 3 days");

  const total = Math.round(prodScore + mortScore + feedScore + freshScore);
  const grade: FarmHealthScore["grade"] =
    total >= 85 ? "Excellent" :
    total >= 70 ? "Good" :
    total >= 50 ? "Fair" : "At Risk";
  if (reasons.length === 0) reasons.push("Farm operating within normal ranges");
  return { score: Math.max(0, Math.min(100, total)), grade, reasons };
}

// ---------------------------------------------------------------------------
// Convenience: compute the full dashboard bundle
// ---------------------------------------------------------------------------

export type DashboardMetrics = {
  population: BirdPopulation;
  today: PeriodMetrics;
  month: PeriodMetrics;
  allTime: PeriodMetrics;
  productionRate: ProductionRate;
  comparison: DailyComparison;
  highestRoom: HighestRoom;
  feed: FeedAnalytics;
  healthScore: FarmHealthScore;
  dailySeriesMonth: DailyFinancialPoint[];   // this-month per-day joined series
  dailySeriesAllTime: DailyFinancialPoint[]; // full history per-day joined series
  todayMortality: number;
  monthlyMortality: number;
  allTimeMortality: number;
  todayRevenue: number;
  monthlyRevenue: number;
  allTimeRevenue: number;
  todayFeedCost: number;
  monthlyFeedCost: number;
  allTimeFeedCost: number;
  todayProfit: number;
  monthlyProfit: number;
  allTimeProfit: number;
  eggPrice: number;
  feedPrice: number;     // per bag
  costPerKg: number;     // per kg of feed — the canonical cost basis
  bagWeightKg: number;
};

export function computeDashboardMetrics(input: {
  rooms: Room[];
  eggs: EggRow[];
  feed: Feed[];
  mortality: Mortality[];
  health: Health[];
  prices: Price[];
  bagWeightKg?: number | null;
  targetProductionPct?: number;
  /** Optional override for the cost per kg of feed (e.g. from an active
   *  self-produced feed formula). When provided and > 0, this is used
   *  instead of the purchased-feed price derived from `prices`. */
  costPerKgOverride?: number | null;
}): DashboardMetrics {
  const eggPrice = eggPricePerCrate(input.prices);
  const feedPrice = feedPricePerBag(input.prices);
  const bagWeightKg =
    Number.isFinite(Number(input.bagWeightKg)) && Number(input.bagWeightKg) > 0
      ? Number(input.bagWeightKg)
      : 25;
  const override = Number(input.costPerKgOverride);
  const costPerKg = Number.isFinite(override) && override > 0
    ? override
    : feedPricePerKg(input.prices, bagWeightKg);

  const population = computeBirdPopulation(input.rooms, input.mortality);

  const periodInput = {
    eggs: input.eggs, feed: input.feed, mortality: input.mortality, health: input.health,
    eggPrice, costPerKg, bagWeightKg, initialBirds: population.initialBirds,
  };
  const today = computePeriodMetrics({ range: rangeFromPreset("today"), ...periodInput });
  const month = computePeriodMetrics({ range: rangeFromPreset("this_month"), ...periodInput });
  const allTime = computePeriodMetrics({ range: rangeFromPreset("all"), ...periodInput });

  const dailySeriesMonth = computeDailyFinancialSeries({
    range: rangeFromPreset("this_month"),
    eggs: input.eggs, feed: input.feed, eggPrice, costPerKg, bagWeightKg,
  });
  const dailySeriesAllTime = computeDailyFinancialSeries({
    range: rangeFromPreset("all"),
    eggs: input.eggs, feed: input.feed, eggPrice, costPerKg, bagWeightKg,
  });

  const productionRate = computeProductionRate({
    eggs: input.eggs,
    totalLiveBirds: population.totalLiveBirds,
    targetPct: input.targetProductionPct ?? 80,
  });
  const comparison = compareLatestTwoDays(input.eggs);
  const highestRoom = computeHighestRoom(input.eggs, input.rooms);
  const feed = computeFeedAnalytics({
    feed: input.feed, eggs: input.eggs,
    totalLiveBirds: population.totalLiveBirds, bagWeightKg,
  });
  const healthScore = computeFarmHealthScore({
    productionRate,
    monthlyMortality: month.mortalityCount,
    allTimeMortality: allTime.mortalityCount,
    initialBirds: population.initialBirds,
    eggs: input.eggs,
    feed: input.feed,
  });

  return {
    population,
    today, month, allTime,
    productionRate, comparison, highestRoom, feed, healthScore,
    dailySeriesMonth, dailySeriesAllTime,
    todayMortality: today.mortalityCount,
    monthlyMortality: month.mortalityCount,
    allTimeMortality: allTime.mortalityCount,
    todayRevenue: today.revenue,
    monthlyRevenue: month.revenue,
    allTimeRevenue: allTime.revenue,
    todayFeedCost: today.feedCost,
    monthlyFeedCost: month.feedCost,
    allTimeFeedCost: allTime.feedCost,
    todayProfit: today.profit,
    monthlyProfit: month.profit,
    allTimeProfit: allTime.profit,
    eggPrice, feedPrice, costPerKg, bagWeightKg,
  };
}

// Convenience formatter
export function formatNairaShort(n: number): string {
  if (!Number.isFinite(n)) return "₦0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `₦${(n / 1_000).toFixed(1)}k`;
  return "₦" + Math.round(n).toLocaleString("en-NG");
}
