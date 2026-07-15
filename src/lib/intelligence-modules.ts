// Shared PoultryPro intelligence modules.
//
// These pure calculation functions were previously inlined in the dashboard
// route. Extracting them lets both the dashboard cards AND the AI-Supported
// Farm Insights ("Your Farm Today") summary layer consume the exact same
// module outputs — no independent recalculation.
//
// Modules exposed:
//   - computeForecast          → 7-Day Production Forecast
//   - computeMortalityRisk     → Mortality Risk Monitor
//   - computeFeedEfficiency    → Feed Efficiency Monitor
//   - computeAbnormalActivity  → Abnormal Farm Activity Monitor
//
// Each function returns a structured, deterministic result derived only from
// the authenticated farm's records passed in.

import type { EggRow, Feed, Health, Mortality, Room } from "@/lib/farm-data";
import { toLocalDate } from "@/lib/date-key";

// ---------- shared formatting helpers ----------

export function fmtNum(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: dp });
}

export function fmtSigned(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const s = n >= 0 ? "+" : "";
  return s + n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- date helper shared across modules ----------

export function parseShortDate(s: string, anchor: Date): Date | null {
  return toLocalDate(s, anchor);
}

// =========================================================================
// 7-Day Production Forecast
// =========================================================================

export type ForecastDirection =
  | "Increasing"
  | "Stable with upward movement"
  | "Stable"
  | "Stable with downward movement"
  | "Declining";

export type ForecastResult = {
  latestTotal: number;
  latestPct: number;
  avgForecast: number;
  low: number;
  high: number;
  direction: ForecastDirection;
  chartData: Array<{ name: string; Historical: number | null; Forecast: number | null; Upper: number | null; Lower: number | null }>;
  boundaryLabel: string;
};

export function computeForecast(eggs: EggRow[], totalBirds: number): ForecastResult | null {
  if (!eggs || eggs.length < 3) return null;
  const ordered = [...eggs].sort((a, b) => a.date.localeCompare(b.date));
  const totals = ordered.map(e => ({
    date: e.date,
    label: e.label.replace(/^[A-Za-z]{3}, /, ""),
    value: (e.r2 + e.r3 + e.r4) * 30 + e.extra,
  }));

  const recent = totals.slice(-Math.min(7, totals.length));
  const values = recent.map(r => r.value);
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;

  const xMean = (n - 1) / 2;
  let num = 0, den = 0;
  values.forEach((v, i) => { num += (i - xMean) * (v - mean); den += (i - xMean) ** 2; });
  const slope = den === 0 ? 0 : num / den;

  const residuals = values.map((v, i) => v - (mean + slope * (i - xMean)));
  const variance = residuals.reduce((s, v) => s + v * v, 0) / n;
  const std = Math.sqrt(variance);

  const lastVal = values[n - 1];
  const forecastValues: number[] = [];
  for (let k = 1; k <= 7; k++) {
    forecastValues.push(Math.max(0, Math.round(lastVal + slope * k)));
  }

  const avgForecast = Math.round(forecastValues.reduce((s, v) => s + v, 0) / forecastValues.length);
  const spread = Math.max(std, Math.max(mean, 1) * 0.02);
  const forecastMin = Math.min(...forecastValues);
  const forecastMax = Math.max(...forecastValues);
  const low = Math.max(0, Math.round(forecastMin - spread));
  const high = Math.round(forecastMax + spread);

  const slopePctPerDay = mean === 0 ? 0 : (slope / mean) * 100;
  const forecastDelta = forecastValues[forecastValues.length - 1] - forecastValues[0];
  const projectedMovePct = mean === 0 ? 0 : (forecastDelta / mean) * 100;
  const STRONG_SLOPE = 0.6, MILD_SLOPE = 0.15, STRONG_MOVE = 3, MILD_MOVE = 0.8;
  let direction: ForecastDirection = "Stable";
  if (slopePctPerDay >= STRONG_SLOPE && projectedMovePct >= STRONG_MOVE) direction = "Increasing";
  else if (slopePctPerDay <= -STRONG_SLOPE && projectedMovePct <= -STRONG_MOVE) direction = "Declining";
  else if (slopePctPerDay >= MILD_SLOPE && projectedMovePct >= MILD_MOVE) direction = "Stable with upward movement";
  else if (slopePctPerDay <= -MILD_SLOPE && projectedMovePct <= -MILD_MOVE) direction = "Stable with downward movement";

  const historical = totals.slice(-Math.min(14, totals.length));
  const boundaryLabel = historical[historical.length - 1].label;

  const chartData: ForecastResult["chartData"] = [];
  historical.forEach((h, i) => {
    chartData.push({
      name: h.label,
      Historical: h.value,
      Forecast: i === historical.length - 1 ? h.value : null,
      Upper: i === historical.length - 1 ? h.value : null,
      Lower: i === historical.length - 1 ? h.value : null,
    });
  });

  const lastDate = new Date(historical[historical.length - 1].date + "T00:00:00");
  for (let k = 1; k <= 7; k++) {
    const d = new Date(lastDate);
    d.setDate(lastDate.getDate() + k);
    const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const v = forecastValues[k - 1];
    chartData.push({
      name: label,
      Historical: null,
      Forecast: v,
      Upper: Math.round(v + spread),
      Lower: Math.max(0, Math.round(v - spread)),
    });
  }

  const latest = totals[totals.length - 1];
  const latestPct = totalBirds > 0
    ? Math.round((latest.value / totalBirds) * 1000) / 10
    : 0;

  return { latestTotal: latest.value, latestPct, avgForecast, low, high, direction, chartData, boundaryLabel };
}

// =========================================================================
// Mortality Risk Monitor
// =========================================================================

export type RiskLevel = "LOW" | "MODERATE" | "ELEVATED" | "HIGH";
export type PatternLabel = "Isolated" | "Stable" | "Increasing" | "Repeated" | "Declining";

export type RoomRisk = {
  id: string;
  name: string;
  current: number;
  lost: number;
  events: number;
  ratePct: number;
  lastEventLabel: string | null;
  lastEventTime: number | null;
  score: number;
  levelLabel: RiskLevel;
};

export type MortalityAnalysis = {
  levelLabel: RiskLevel;
  levelTone: string;
  score: number;
  monthlyMortality: number;
  mostAffectedRoom: { name: string; lost: number; events: number } | null;
  patternLabel: PatternLabel;
  rooms: RoomRisk[];
  timeline: { data: Array<Record<string, string | number>>; roomKeys: string[] };
  insight: { observation: string; interpretation: string; action: string; repeatedRoom: string | null };
  periodLabel: string;
};

export function classifyRisk(score: number): RiskLevel {
  if (score >= 75) return "HIGH";
  if (score >= 50) return "ELEVATED";
  if (score >= 25) return "MODERATE";
  return "LOW";
}

export function riskTone(level: RiskLevel): string {
  switch (level) {
    case "HIGH": return "text-destructive";
    case "ELEVATED": return "text-[color:var(--gold)]";
    case "MODERATE": return "text-[color:var(--ink)]";
    default: return "text-[color:var(--forest)]";
  }
}

export function computeMortalityRisk(
  rooms: Room[], mortality: Mortality[], eggs: EggRow[], health: Health[],
): MortalityAnalysis | null {
  if (!rooms || rooms.length === 0) return null;

  const orderedEggs = [...eggs].sort((a, b) => b.date.localeCompare(a.date));
  const anchor = orderedEggs[0]
    ? new Date(orderedEggs[0].date + "T00:00:00")
    : new Date();

  const PERIOD_DAYS = 30;
  const periodStart = new Date(anchor);
  periodStart.setDate(periodStart.getDate() - PERIOD_DAYS + 1);

  const parsed = mortality
    .map(m => {
      const d = parseShortDate(m.date, anchor);
      return d ? { ...m, when: d, ts: d.getTime() } : null;
    })
    .filter((x): x is Mortality & { when: Date; ts: number } => x !== null)
    .filter(e => e.ts >= periodStart.getTime() && e.ts <= anchor.getTime() + 24 * 60 * 60 * 1000);

  const perRoom = new Map<string, { lost: number; events: number; lastTs: number | null; lastLabel: string | null }>();
  rooms.forEach(r => perRoom.set(r.name, { lost: 0, events: 0, lastTs: null, lastLabel: null }));
  parsed.forEach(e => {
    const bucket = perRoom.get(e.room) ?? { lost: 0, events: 0, lastTs: null, lastLabel: null };
    bucket.lost += e.loss;
    bucket.events += 1;
    if (bucket.lastTs === null || e.ts > bucket.lastTs) {
      bucket.lastTs = e.ts;
      bucket.lastLabel = e.when.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    }
    perRoom.set(e.room, bucket);
  });

  const totalLostPeriod = parsed.reduce((s, e) => s + e.loss, 0);
  const totalEventsPeriod = parsed.length;
  const totalBirdsBaseline = rooms.reduce((s, r) => s + r.current, 0) + totalLostPeriod;

  const roomRows: RoomRisk[] = rooms.map(r => {
    const b = perRoom.get(r.name) ?? { lost: 0, events: 0, lastTs: null, lastLabel: null };
    const baseline = r.current + b.lost;
    const ratePct = baseline > 0 ? (b.lost / baseline) * 100 : 0;
    const shareOfFarm = totalLostPeriod > 0 ? b.lost / totalLostPeriod : 0;
    const rateScore = Math.min(100, (ratePct / 2) * 100);
    const freqScore = Math.min(100, (b.events / 5) * 100);
    const concScore = shareOfFarm * 100;
    const half = periodStart.getTime() + (PERIOD_DAYS / 2) * 24 * 60 * 60 * 1000;
    const roomEvents = parsed.filter(e => e.room === r.name);
    const prior = roomEvents.filter(e => e.ts < half).reduce((s, e) => s + e.loss, 0);
    const recent = roomEvents.filter(e => e.ts >= half).reduce((s, e) => s + e.loss, 0);
    const trendScore = recent === 0 && prior === 0 ? 0
      : recent > prior * 1.3 ? 100
      : recent < prior * 0.7 ? 0
      : 50;
    const score = Math.round(rateScore * 0.4 + freqScore * 0.3 + concScore * 0.2 + trendScore * 0.1);
    const levelLabel = classifyRisk(score);
    return {
      id: r.id, name: r.name, current: r.current,
      lost: b.lost, events: b.events, ratePct,
      lastEventLabel: b.lastLabel, lastEventTime: b.lastTs,
      score, levelLabel,
    };
  });

  const farmRatePct = totalBirdsBaseline > 0 ? (totalLostPeriod / totalBirdsBaseline) * 100 : 0;
  const farmRateScore = Math.min(100, (farmRatePct / 2) * 100);
  const farmFreqScore = Math.min(100, (totalEventsPeriod / 5) * 100);
  const maxShare = roomRows.reduce((m, r) => {
    const share = totalLostPeriod > 0 ? r.lost / totalLostPeriod : 0;
    return Math.max(m, share);
  }, 0);
  const farmConcScore = maxShare * 100;
  const halfTs = periodStart.getTime() + (PERIOD_DAYS / 2) * 24 * 60 * 60 * 1000;
  const priorTotal = parsed.filter(e => e.ts < halfTs).reduce((s, e) => s + e.loss, 0);
  const recentTotal = parsed.filter(e => e.ts >= halfTs).reduce((s, e) => s + e.loss, 0);
  const farmTrendScore = recentTotal === 0 && priorTotal === 0 ? 0
    : recentTotal > priorTotal * 1.3 ? 100
    : recentTotal < priorTotal * 0.7 ? 0
    : 50;
  const farmScore = Math.round(farmRateScore * 0.4 + farmFreqScore * 0.3 + farmConcScore * 0.2 + farmTrendScore * 0.1);
  const farmLevel = classifyRisk(farmScore);

  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1).getTime();
  const monthlyMortality = parsed
    .filter(e => e.ts >= monthStart)
    .reduce((s, e) => s + e.loss, 0);

  const mostAffected = [...roomRows]
    .filter(r => r.lost > 0 || r.events > 0)
    .sort((a, b) => b.lost - a.lost || b.events - a.events)[0] ?? null;
  const mostAffectedRoom = mostAffected
    ? { name: mostAffected.name, lost: mostAffected.lost, events: mostAffected.events }
    : null;

  let patternLabel: PatternLabel = "Stable";
  const repeatedRoomRow = roomRows.find(r => r.events >= 2 && (maxShare >= 0.6 || r.events >= 3));
  if (totalEventsPeriod === 0) patternLabel = "Stable";
  else if (totalEventsPeriod === 1) patternLabel = "Isolated";
  else if (repeatedRoomRow) patternLabel = "Repeated";
  else if (recentTotal > priorTotal * 1.3) patternLabel = "Increasing";
  else if (recentTotal < priorTotal * 0.7 && priorTotal > 0) patternLabel = "Declining";
  else patternLabel = "Stable";

  const dateMap = new Map<string, Record<string, string | number>>();
  const activeRoomKeys = rooms.filter(r => parsed.some(e => e.room === r.name)).map(r => r.name);
  parsed
    .slice()
    .sort((a, b) => a.ts - b.ts)
    .forEach(e => {
      const key = e.when.toISOString().slice(0, 10);
      const label = e.when.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const row = dateMap.get(key) ?? { name: label };
      activeRoomKeys.forEach(k => { if (row[k] === undefined) row[k] = 0; });
      row[e.room] = ((row[e.room] as number) ?? 0) + e.loss;
      dateMap.set(key, row);
    });
  const timelineData = Array.from(dateMap.values());

  const periodLabel = `${periodStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${anchor.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  const observation = totalEventsPeriod === 0
    ? "No mortality events have been recorded in the current analysis window."
    : repeatedRoomRow
      ? `Repeated mortality events have been recorded in ${repeatedRoomRow.name} within the current analysis period. The pattern is concentrated in one production room rather than evenly distributed across the farm.`
      : mostAffectedRoom
        ? `${totalEventsPeriod} mortality event${totalEventsPeriod === 1 ? "" : "s"} totalling ${totalLostPeriod} bird${totalLostPeriod === 1 ? "" : "s"} recorded across ${activeRoomKeys.length} room${activeRoomKeys.length === 1 ? "" : "s"}, with the highest concentration in ${mostAffectedRoom.name}.`
        : `${totalEventsPeriod} mortality event${totalEventsPeriod === 1 ? "" : "s"} recorded in the current period.`;

  const interpretation = `Risk score ${farmScore}/100 (${farmLevel}) — driven by a ${farmRatePct.toFixed(2)}% period mortality rate, ${totalEventsPeriod} event${totalEventsPeriod === 1 ? "" : "s"} in ${PERIOD_DAYS} days, ${Math.round(maxShare * 100)}% concentration in the most affected room, and a ${farmTrendScore >= 100 ? "rising" : farmTrendScore <= 0 ? "easing" : "steady"} recent trend.`;

  const roomHealth = repeatedRoomRow
    ? health.filter(h => h.scope === repeatedRoomRow.name || /all rooms/i.test(h.scope))
    : health;
  const recentHealthNote = roomHealth.length === 0
    ? "No recent health records are available for cross-reference."
    : `Recent health records available for cross-reference: ${roomHealth.slice(0, 3).map(h => h.name).join(", ")}.`;

  const action = repeatedRoomRow
    ? `Review recent health observations, vaccination and medication records for ${repeatedRoomRow.name}; check feed changes or feed batches, water availability, environmental observations and production movement for that room. ${recentHealthNote}`
    : totalEventsPeriod === 0
      ? "Continue capturing daily mortality checks to keep the risk model current."
      : `Cross-check mortality entries against recent health, feed and production records. ${recentHealthNote}`;

  return {
    levelLabel: farmLevel,
    levelTone: riskTone(farmLevel),
    score: farmScore,
    monthlyMortality,
    mostAffectedRoom,
    patternLabel,
    rooms: roomRows.sort((a, b) => b.score - a.score),
    timeline: { data: timelineData, roomKeys: activeRoomKeys },
    insight: {
      observation, interpretation, action,
      repeatedRoom: repeatedRoomRow ? repeatedRoomRow.name : null,
    },
    periodLabel,
  };
}

// =========================================================================
// Feed Efficiency Monitor
// =========================================================================

export type EffStatus = "EFFICIENT" | "STABLE" | "WATCH" | "DECLINING" | "INSUFFICIENT DATA";
export type MovementLabel = "IMPROVING" | "STABLE" | "WATCH" | "DECLINING" | "INSUFFICIENT DATA";

export type MatchedDay = {
  date: string; label: string; bags: number; eggs: number;
  kg?: number; feedPerEggKg?: number; feedPerEggG?: number;
};

export type RoomEffRow = {
  id: string; name: string; current: number;
  bags: number; eggs: number;
  kg: number | null; feedPerBirdG: number | null; feedPerEggG: number | null;
  movement: MovementLabel;
};

export type FeedEffAnalysis = {
  matched: MatchedDay[];
  latest: MatchedDay;
  latestLabel: string | null;
  status: EffStatus;
  score: number;
  chartData: Array<Record<string, string | number | null>>;
  roomRows: RoomEffRow[];
  insight: { observation: string; interpretation: string; action: string };
  movements: { feedPerEggPct: number; productionPct: number; feedPct: number; roomVariationPct: number };
  hasBaseline: boolean;
};

function computeRoomEggShare(rooms: Room[], eggs: EggRow[]): Map<string, number> {
  const share = new Map<string, number>();
  const totals: Record<string, number> = { r2: 0, r3: 0, r4: 0 };
  let all = 0;
  eggs.forEach(e => {
    totals.r2 += e.r2 * 30;
    totals.r3 += e.r3 * 30;
    totals.r4 += e.r4 * 30;
    all += (e.r2 + e.r3 + e.r4) * 30 + e.extra;
  });
  rooms.forEach(r => {
    const trimmed = r.name.replace(/\s+/g, "").toLowerCase();
    const rk = trimmed.endsWith("2") ? "r2" : trimmed.endsWith("3") ? "r3" : trimmed.endsWith("4") ? "r4" : null;
    const roomTotal = rk ? totals[rk] : 0;
    share.set(r.id, all > 0 ? roomTotal / all : 0);
  });
  return share;
}

function describeMove(pct: number, subject: string): string {
  if (pct > 2) return `${subject} increased by ${fmtNum(pct, 1)}%`;
  if (pct < -2) return `${subject} decreased by ${fmtNum(Math.abs(pct), 1)}%`;
  return `${subject} remained stable`;
}

function movementRank(m: MovementLabel): number {
  return m === "DECLINING" ? 3 : m === "WATCH" ? 2 : m === "STABLE" ? 1 : 0;
}

export function computeFeedEfficiency(
  rooms: Room[], feed: Feed[], eggs: EggRow[], mortality: Mortality[], health: Health[], bagWeightKg: number | null,
): FeedEffAnalysis | null {
  if (!eggs || eggs.length === 0 || !feed || feed.length === 0) return null;

  const orderedEggs = [...eggs].sort((a, b) => b.date.localeCompare(a.date));
  const anchor = new Date(orderedEggs[0].date + "T00:00:00");

  type FeedRow = { room: string; bags: number; when: Date; iso: string };
  const feedRows: FeedRow[] = feed
    .map(f => {
      const d = parseShortDate(f.date, anchor);
      return d ? { room: f.room, bags: f.bags, when: d, iso: d.toISOString().slice(0, 10) } : null;
    })
    .filter((x): x is FeedRow => x !== null);

  if (feedRows.length === 0) return null;

  const eggsByIso = new Map<string, EggRow>();
  eggs.forEach(e => eggsByIso.set(e.date, e));

  const feedByDate = new Map<string, number>();
  feedRows.forEach(r => feedByDate.set(r.iso, (feedByDate.get(r.iso) ?? 0) + r.bags));

  const matched: MatchedDay[] = [];
  Array.from(feedByDate.entries())
    .filter(([iso]) => eggsByIso.has(iso))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([iso, bags]) => {
      const e = eggsByIso.get(iso)!;
      const eggTotal = (e.r2 + e.r3 + e.r4) * 30 + e.extra;
      const day: MatchedDay = {
        date: iso,
        label: new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        bags, eggs: eggTotal,
      };
      if (typeof bagWeightKg === "number" && bagWeightKg > 0) {
        day.kg = bags * bagWeightKg;
        day.feedPerEggKg = eggTotal > 0 ? day.kg / eggTotal : 0;
        day.feedPerEggG = day.feedPerEggKg * 1000;
      }
      matched.push(day);
    });

  if (matched.length < 7) return null;

  const latest = matched[matched.length - 1];
  const preceding = matched.slice(0, -1);
  const hasBaseline = preceding.length >= 3;

  const chartData: Array<Record<string, string | number | null>> = matched.map(d => ({
    name: d.label,
    Eggs: d.eggs,
    "Feed (bags)": d.bags,
    "Feed per Egg (g)": d.feedPerEggG ?? null,
  }));

  const avg = (xs: number[]) => xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;

  const baseline = hasBaseline ? preceding.slice(-Math.min(preceding.length, 7)) : [];
  const baselineEggs = avg(baseline.map(d => d.eggs));
  const baselineBags = avg(baseline.map(d => d.bags));
  const baselineFpE = baselineEggs > 0 ? baselineBags / baselineEggs : 0;
  const latestFpE = latest.eggs > 0 ? latest.bags / latest.eggs : 0;

  const productionPct = hasBaseline && baselineEggs > 0 ? ((latest.eggs - baselineEggs) / baselineEggs) * 100 : NaN;
  const feedPct = hasBaseline && baselineBags > 0 ? ((latest.bags - baselineBags) / baselineBags) * 100 : NaN;
  const feedPerEggPct = hasBaseline && baselineFpE > 0 ? ((latestFpE - baselineFpE) / baselineFpE) * 100 : NaN;

  const roomShareEggs = computeRoomEggShare(rooms, eggs);

  const feedByRoomDate = new Map<string, Map<string, number>>();
  feedRows.forEach(r => {
    const m = feedByRoomDate.get(r.room) ?? new Map<string, number>();
    m.set(r.iso, (m.get(r.iso) ?? 0) + r.bags);
    feedByRoomDate.set(r.room, m);
  });

  const roomRows: RoomEffRow[] = rooms.map(room => {
    const roomMap = feedByRoomDate.get(room.name) ?? new Map<string, number>();
    const roomMatched = Array.from(roomMap.entries())
      .filter(([iso]) => eggsByIso.has(iso))
      .sort((a, b) => a[0].localeCompare(b[0]));
    if (roomMatched.length === 0) {
      return {
        id: room.id, name: room.name, current: room.current,
        bags: 0, eggs: 0, kg: null, feedPerBirdG: null, feedPerEggG: null,
        movement: "INSUFFICIENT DATA" as MovementLabel,
      };
    }
    const share = roomShareEggs.get(room.id) ?? 0;
    const [latestIso, latestBagsRoom] = roomMatched[roomMatched.length - 1];
    const eLatest = eggsByIso.get(latestIso)!;
    const latestEggsRoom = ((eLatest.r2 + eLatest.r3 + eLatest.r4) * 30 + eLatest.extra) * share;
    const kg = typeof bagWeightKg === "number" && bagWeightKg > 0 ? latestBagsRoom * bagWeightKg : null;
    const feedPerBirdG = kg !== null && room.current > 0 ? (kg * 1000) / room.current : null;
    const feedPerEggG = kg !== null && latestEggsRoom > 0 ? (kg * 1000) / latestEggsRoom : null;

    const roomPreceding = roomMatched.slice(0, -1);
    let movement: MovementLabel = "INSUFFICIENT DATA";
    if (roomPreceding.length >= 3) {
      const bpeOf = (iso: string, bags: number) => {
        const e = eggsByIso.get(iso);
        if (!e) return 0;
        const eg = ((e.r2 + e.r3 + e.r4) * 30 + e.extra) * share;
        return eg > 0 ? bags / eg : 0;
      };
      const latestBpE = bpeOf(latestIso, latestBagsRoom);
      const priorBpEs = roomPreceding.slice(-7).map(([iso, b]) => bpeOf(iso, b)).filter(v => v > 0);
      const priorBpE = priorBpEs.length ? priorBpEs.reduce((s, v) => s + v, 0) / priorBpEs.length : 0;
      const move = priorBpE > 0 ? ((latestBpE - priorBpE) / priorBpE) * 100 : 0;
      movement =
        move <= -5 ? "IMPROVING"
        : move >= 15 ? "DECLINING"
        : move >= 5 ? "WATCH"
        : "STABLE";
    }

    return {
      id: room.id, name: room.name, current: room.current,
      bags: latestBagsRoom, eggs: Math.round(latestEggsRoom),
      kg, feedPerBirdG, feedPerEggG, movement,
    };
  });

  const activeRoomFpE = roomRows.filter(r => r.eggs > 0 && r.bags > 0).map(r => r.bags / r.eggs);
  let roomVariationPct = 0;
  if (activeRoomFpE.length >= 2) {
    const m = activeRoomFpE.reduce((s, v) => s + v, 0) / activeRoomFpE.length;
    const v = activeRoomFpE.reduce((s, x) => s + (x - m) ** 2, 0) / activeRoomFpE.length;
    roomVariationPct = m > 0 ? (Math.sqrt(v) / m) * 100 : 0;
  }

  let status: EffStatus;
  let score = 0;
  if (!hasBaseline) {
    status = "INSUFFICIENT DATA";
  } else {
    score = Math.round(
      feedPerEggPct * 0.5 + (-productionPct) * 0.25 + feedPct * 0.15 + roomVariationPct * 0.1,
    );
    status =
      score <= -5 ? "EFFICIENT"
      : score >= 15 ? "DECLINING"
      : score >= 5 ? "WATCH"
      : "STABLE";
  }

  let observation: string;
  let interpretation: string;
  let action: string;

  if (!hasBaseline) {
    observation = `${matched.length} valid matched feed and production date${matched.length === 1 ? "" : "s"} ${matched.length === 1 ? "is" : "are"} currently available. Current feed-per-egg efficiency has been calculated, but there is not yet enough historical matched data to determine a reliable efficiency trend.`;
    interpretation = "INSUFFICIENT DATA — a minimum of three preceding matched daily records is required before PoultryPro assigns an efficiency movement classification.";
    action = "Continue recording feed usage and egg production daily for each room. PoultryPro will automatically establish an efficiency baseline as additional matched records become available.";
  } else {
    const feedDir = describeMove(feedPct, "feed usage");
    const eggDir = describeMove(productionPct, "egg output");
    const fpeDir = feedPerEggPct > 1
      ? "feed consumed per egg has increased, indicating a possible decline in production efficiency"
      : feedPerEggPct < -1
        ? "feed consumed per egg has decreased, indicating improving production efficiency"
        : "feed consumed per egg has remained largely unchanged";
    observation = `Latest matched date (${latest.label}) compared with the preceding ${baseline.length} matched record${baseline.length === 1 ? "" : "s"}: ${feedDir} while ${eggDir}. ${capitalise(fpeDir)}.`;
    interpretation = `Status ${status} — feed-per-egg movement ${fmtSigned(feedPerEggPct)}%, production movement ${fmtSigned(productionPct)}%, feed usage movement ${fmtSigned(feedPct)}%, room-level variation ${fmtNum(roomVariationPct)}%. Composite movement score ${score} (negative values indicate improving efficiency).`;
    const worstRoom = [...roomRows]
      .filter(r => r.eggs > 0 && r.movement !== "INSUFFICIENT DATA")
      .sort((a, b) => movementRank(b.movement) - movementRank(a.movement))[0];
    const recentMortalityCount = mortality.length;
    const recentHealth = health.slice(0, 2).map(h => h.name).join(", ");
    action = status === "EFFICIENT"
      ? "Continue capturing daily feed and production records to keep the efficiency baseline current."
      : `Review recent feed formulation and feed batch changes, feed distribution records${worstRoom ? `, and room-level production movement for ${worstRoom.name}` : ""}, bird population changes${recentMortalityCount > 0 ? " and recent mortality patterns" : ""}, water availability records if available${recentHealth ? `, and recent health observations (${recentHealth})` : ""}.`;
  }

  return {
    matched, latest, latestLabel: latest.label,
    status, score, chartData, roomRows,
    insight: { observation, interpretation, action },
    movements: { feedPerEggPct, productionPct, feedPct, roomVariationPct },
    hasBaseline,
  };
}

// =========================================================================
// Abnormal Farm Activity Monitor
// =========================================================================

export type ActivityLevel = "NORMAL" | "WATCH" | "ELEVATED" | "HIGH";
export type SignalKey = "production" | "mortality" | "feed" | "health";

export type RoomActivityRow = {
  id: string;
  name: string;
  score: number;
  level: ActivityLevel;
  signals: Record<SignalKey, { score: number | null; label: string; note: string }>;
  triggered: SignalKey[];
};

export type AbnormalAnalysis = {
  score: number;
  level: ActivityLevel;
  periodLabel: string;
  signalsAnalysed: string[];
  roomsMonitored: number;
  mostAffected: RoomActivityRow | null;
  rooms: RoomActivityRow[];
  insight: { observation: string; connection: string; interpretation: string; action: string };
  limited: boolean;
};

export function classifyActivity(score: number): ActivityLevel {
  if (score >= 75) return "HIGH";
  if (score >= 50) return "ELEVATED";
  if (score >= 25) return "WATCH";
  return "NORMAL";
}

export function signalPretty(k: SignalKey): string {
  return k === "production" ? "Production" : k === "mortality" ? "Mortality" : k === "feed" ? "Feed efficiency" : "Health record";
}

export function computeAbnormalActivity(
  rooms: Room[], eggs: EggRow[], feed: Feed[], mortality: Mortality[], health: Health[], bagWeightKg: number | null,
): AbnormalAnalysis | null {
  if (!rooms || rooms.length === 0) return null;
  if (!eggs || eggs.length === 0) return null;

  const orderedEggs = [...eggs].sort((a, b) => b.date.localeCompare(a.date));
  const anchor = new Date(orderedEggs[0].date + "T00:00:00");
  const PERIOD_DAYS = 30;
  const periodStart = new Date(anchor);
  periodStart.setDate(periodStart.getDate() - PERIOD_DAYS + 1);
  const periodLabel = `${periodStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${anchor.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  const mortalityAnalysis = computeMortalityRisk(rooms, mortality, eggs, health);
  const mortalityByRoom = new Map<string, RoomRisk>();
  mortalityAnalysis?.rooms.forEach(r => mortalityByRoom.set(r.name, r));

  const feedAnalysis = feed && feed.length > 0
    ? computeFeedEfficiency(rooms, feed, eggs, mortality, health, bagWeightKg)
    : null;
  const feedByRoom = new Map<string, RoomEffRow>();
  feedAnalysis?.roomRows.forEach(r => feedByRoom.set(r.name, r));

  const eggsAsc = [...eggs].sort((a, b) => a.date.localeCompare(b.date));
  const eggInPeriod = eggsAsc.filter(e => {
    const t = new Date(e.date + "T00:00:00").getTime();
    return t >= periodStart.getTime() && t <= anchor.getTime() + 24 * 60 * 60 * 1000;
  });

  const roomKeyMap: Record<string, "r2" | "r3" | "r4" | null> = {};
  rooms.forEach(r => {
    const trimmed = r.name.replace(/\s+/g, "").toLowerCase();
    roomKeyMap[r.id] = trimmed.endsWith("2") ? "r2" : trimmed.endsWith("3") ? "r3" : trimmed.endsWith("4") ? "r4" : null;
  });

  const signalKeysAnalysed = new Set<SignalKey>();

  const roomRows: RoomActivityRow[] = rooms.map(room => {
    const rk = roomKeyMap[room.id];
    const signals: RoomActivityRow["signals"] = {
      production: { score: null, label: "Insufficient data", note: "" },
      mortality:  { score: null, label: "Insufficient data", note: "" },
      feed:       { score: null, label: "Insufficient data", note: "" },
      health:     { score: null, label: "Insufficient data", note: "" },
    };

    if (rk) {
      const series = eggInPeriod.map(e => e[rk] * 30);
      if (series.length >= 8) {
        const half = Math.floor(series.length / 2);
        const prior = series.slice(0, half);
        const recent = series.slice(-half);
        const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
        const priorAvg = avg(prior);
        const recentAvg = avg(recent);
        const declinePct = priorAvg > 0 ? ((priorAvg - recentAvg) / priorAvg) * 100 : 0;
        const clamped = Math.max(0, declinePct);
        const score = Math.min(100, clamped * 10);
        const label = declinePct >= 5
          ? `Decline ${declinePct.toFixed(1)}%`
          : declinePct >= 2
            ? `Mild decline ${declinePct.toFixed(1)}%`
            : declinePct <= -2
              ? `Rising ${Math.abs(declinePct).toFixed(1)}%`
              : "Stable";
        signals.production = { score, label, note: `Recent ${recent.length}-day avg ${recentAvg.toFixed(0)} eggs/day vs prior ${prior.length}-day avg ${priorAvg.toFixed(0)}.` };
        signalKeysAnalysed.add("production");
      }
    }

    const mr = mortalityByRoom.get(room.name);
    if (mr) {
      signals.mortality = {
        score: mr.score,
        label: mr.events === 0
          ? "No events"
          : `${mr.events} event${mr.events === 1 ? "" : "s"} · ${mr.lost} lost`,
        note: `Period mortality ${mr.ratePct.toFixed(2)}%.`,
      };
      signalKeysAnalysed.add("mortality");
    }

    const fr = feedByRoom.get(room.name);
    if (fr && fr.movement !== "INSUFFICIENT DATA") {
      const map: Record<string, number> = { IMPROVING: 0, STABLE: 15, WATCH: 55, DECLINING: 90 };
      const s = map[fr.movement] ?? 0;
      signals.feed = { score: s, label: fr.movement, note: "Room-level feed-per-egg movement vs preceding matched records." };
      signalKeysAnalysed.add("feed");
    }

    if (health && health.length > 0) {
      const parsedHealth = health
        .map(h => {
          const d = parseShortDate(h.date, anchor);
          return d ? { ...h, ts: d.getTime() } : null;
        })
        .filter((x): x is Health & { ts: number } => x !== null)
        .filter(h => h.ts >= periodStart.getTime() && h.ts <= anchor.getTime() + 24 * 60 * 60 * 1000);

      const roomSpecific = parsedHealth.filter(h => h.scope === room.name);
      const farmWide = parsedHealth.filter(h => /all rooms/i.test(h.scope));

      if (roomSpecific.length > 0) {
        const s = Math.min(100, roomSpecific.length * 30);
        signals.health = {
          score: s,
          label: `Room-specific record${roomSpecific.length === 1 ? "" : "s"} (${roomSpecific.length})`,
          note: roomSpecific.slice(0, 2).map(h => `${h.name} (${h.type})`).join(", "),
        };
        signalKeysAnalysed.add("health");
      } else if (farmWide.length > 0) {
        signals.health = {
          score: null,
          label: "Farm-wide context available",
          note: farmWide.slice(0, 2).map(h => `${h.name} (${h.type}, All Rooms)`).join(", "),
        };
      } else {
        signals.health = { score: null, label: "No recent health context", note: "" };
      }
    } else {
      signals.health = { score: null, label: "No recent health context", note: "" };
    }

    const weights: Record<SignalKey, number> = { production: 0.30, mortality: 0.30, feed: 0.25, health: 0.15 };
    let total = 0;
    let weightSum = 0;
    (Object.keys(weights) as SignalKey[]).forEach(k => {
      const s = signals[k].score;
      if (s !== null) {
        total += s * weights[k];
        weightSum += weights[k];
      }
    });
    const roomScore = weightSum > 0 ? Math.round(total / weightSum) : 0;
    const level = classifyActivity(roomScore);
    const triggered = (Object.keys(signals) as SignalKey[]).filter(k => (signals[k].score ?? 0) >= 50);

    return { id: room.id, name: room.name, score: roomScore, level, signals, triggered };
  });

  const totalBirds = rooms.reduce((s, r) => s + r.current, 0);
  const farmScore = totalBirds > 0
    ? Math.round(roomRows.reduce((s, r) => {
        const room = rooms.find(rr => rr.id === r.id)!;
        return s + r.score * (room.current / totalBirds);
      }, 0))
    : 0;
  const farmLevel = classifyActivity(farmScore);

  const mostAffected = [...roomRows].sort((a, b) => b.score - a.score)[0] ?? null;

  const limited = signalKeysAnalysed.size < 3;

  const combos = roomRows.filter(r => r.triggered.length >= 2);
  const observation = combos.length > 0
    ? `Cross-signal pattern detected in ${combos.map(r => r.name).join(", ")}: ${combos.map(r => `${r.triggered.map(signalPretty).join(" + ")} in ${r.name}`).join("; ")}.`
    : mostAffected && mostAffected.triggered.length === 1
      ? `${signalPretty(mostAffected.triggered[0])} signal is elevated in ${mostAffected.name}. No other independent signal is currently elevated in the same room.`
      : "No abnormal cross-signal pattern has been detected in the current analysis window based on available farm records.";

  const connection = combos.length > 0
    ? "Two or more independent signals occurred together in the same room within the current analysis window. Combinations of signals are more indicative of an operational pattern warranting review than any single fluctuation."
    : "PoultryPro cross-references production, mortality, feed and health signals per room. A single normal fluctuation is not treated as a confirmed anomaly.";

  const strongest = mostAffected
    ? mostAffected.triggered.length > 0
      ? mostAffected.triggered.map(signalPretty).join(", ")
      : "no individually elevated signal"
    : "no active room";

  const interpretation = `Farm activity score ${farmScore}/100 (${farmLevel}) across ${roomRows.length} monitored room${roomRows.length === 1 ? "" : "s"} using ${signalKeysAnalysed.size} of 4 signal categor${signalKeysAnalysed.size === 1 ? "y" : "ies"}${limited ? " (weights re-normalised due to insufficient data on other signals)" : ""}. Strongest contributing signals: ${strongest}.`;

  const healthClarification = mostAffected
    ? mostAffected.signals.health.label === "Farm-wide context available"
      ? ` Farm-wide health records are available for contextual review; however, no room-specific health record is currently associated with ${mostAffected.name}. Farm-wide records are not treated as a room-specific health signal and do not increase ${mostAffected.name}'s activity score.`
      : mostAffected.signals.health.label.startsWith("Room-specific")
        ? ` A room-specific health record is associated with ${mostAffected.name} within the analysis window; this is presented as context and does not imply that any vaccination, vitamin or medication record caused mortality or production movement.`
        : ""
    : "";

  const targetRoom = mostAffected && mostAffected.score >= 25 ? mostAffected.name : null;
  const action = targetRoom
    ? `Review ${targetRoom} production records, recent mortality events, feed formulation and feed batches, water availability, environmental observations, vaccination and medication records, and bird population changes.${healthClarification} This may be associated with an operational pattern; the pattern warrants review before drawing further conclusions.`
    : `Continue capturing daily production, feed, mortality and health records. PoultryPro will strengthen cross-signal activity detection as additional matched records become available.${healthClarification}`;

  return {
    score: farmScore,
    level: farmLevel,
    periodLabel,
    signalsAnalysed: Array.from(signalKeysAnalysed).map(signalPretty),
    roomsMonitored: roomRows.length,
    mostAffected,
    rooms: roomRows.sort((a, b) => b.score - a.score),
    insight: { observation, connection, interpretation, action },
    limited,
  };
}
