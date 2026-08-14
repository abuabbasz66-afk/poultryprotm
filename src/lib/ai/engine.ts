// ---------------------------------------------------------------------------
// PoultryPro AI Farm Intelligence Engine (Phase 1 + Phase 2)
//
// Deterministic, explainable intelligence computed from ONE farm's validated
// records. Every output states what was observed, why it matters, what to
// check, and how confident the engine is. Nothing is fabricated: when the
// evidence is missing the engine says so instead of guessing.
//
// Output kinds:
//   FACT        — a recorded value, straight from the farm's records
//   INFERENCE   — a computed comparison against the farm's own baseline
//   PREDICTION  — a statistical forecast with a range and confidence
//   RECOMMENDATION — a suggested action the FARMER decides on
//
// The engine never triggers medication, vaccination, feed changes or financial
// transactions. It only recommends; execution stays with the farmer.
// ---------------------------------------------------------------------------
import type { EggRow, Feed, Health, Mortality, Price, Room } from "@/lib/farm-data";
import type { ExpenseRow, RevenueRow } from "@/lib/finance-data";
import type { LayerDaily } from "@/lib/layer-rearing";
import { productionRooms } from "@/lib/rooms";
import { computeProductionSeries, type DailyProduction } from "@/lib/production-percent";
import { totalsFor, unitEconomics, shiftDays, dayKey, naira } from "@/lib/finance-analytics";
import { validateFarmData, eligible, type QualityReport } from "@/lib/ai/quality";

export type InsightKind = "FACT" | "INFERENCE" | "PREDICTION" | "RECOMMENDATION";
export type Severity = "critical" | "warning" | "watch" | "healthy";
export type ConfidenceLabel = "HIGH" | "MEDIUM" | "LOW";

export type Confidence = {
  score: number; // 0-100
  label: ConfidenceLabel;
  basis: string;
};

export type Insight = {
  key: string;
  category: "production" | "mortality" | "feed" | "water" | "financial" | "health" | "data";
  kind: InsightKind;
  severity: Severity;
  title: string;
  observed: string;
  whyItMatters: string;
  whatToCheck: string[];
  recommendation?: string;
  confidence: Confidence;
  evidence: string[];
};

export type Forecast = {
  key: string;
  label: string;
  unit: string;
  horizon: string;
  expected: number;
  low: number;
  high: number;
  direction: "up" | "down" | "flat";
  confidence: Confidence;
  basis: string;
};

export type Baselines = {
  days: number;
  birds: number;
  layRate30: number | null;
  layRate7: number | null;
  eggsPerDay30: number | null;
  mortalityPctPerDay30: number | null;
  feedKgPerBirdDay30: number | null;
  waterLitresPerBird: number | null;
  costPerEgg: number | null;
};

export type HealthScore = {
  score: number;
  band: "Excellent" | "Good" | "Fair" | "At risk";
  components: { key: string; label: string; score: number; weight: number; note: string }[];
};

export type IntelligenceReport = {
  ready: boolean;
  message: string;
  quality: QualityReport;
  baselines: Baselines;
  insights: Insight[];
  forecasts: Forecast[];
  health: HealthScore;
  /** Compact, machine-readable snapshot handed to the AI assistant as ground truth. */
  snapshot: Record<string, unknown>;
  generatedAt: string;
};

export type EngineInput = {
  eggs: EggRow[];
  rooms: Room[];
  mortality: Mortality[];
  feed: Feed[];
  health: Health[];
  prices: Price[];
  expenses: ExpenseRow[];
  revenue: RevenueRow[];
  layerDaily?: LayerDaily[];
  bagWeightKg: number | null;
  weather?: { tempMaxC: number | null; humidity: number | null; thi: number | null; summary?: string } | null;
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const stdev = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

function confidence(samples: number, variability: number, extra?: string): Confidence {
  // Sample depth drives most of it; noisy data pulls it back down.
  let score = samples >= 21 ? 88 : samples >= 14 ? 78 : samples >= 7 ? 62 : samples >= 3 ? 45 : 25;
  const penalty = Math.min(30, Math.round(variability * 100));
  score = Math.max(15, score - penalty);
  const label: ConfidenceLabel = score >= 75 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW";
  const basis = `${samples} validated day${samples === 1 ? "" : "s"} of records${extra ? `, ${extra}` : ""}`;
  return { score, label, basis };
}

/** Least-squares slope + residual spread over an ordered numeric series. */
function trend(values: number[]) {
  const n = values.length;
  if (n < 3) return { slope: 0, intercept: mean(values), residual: 0 };
  const xs = values.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(values);
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * ((values[i] ?? 0) - my);
    den += (x - mx) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  const residual = stdev(values.map((v, i) => v - (intercept + slope * i)));
  return { slope, intercept, residual };
}

const lastDays = (n: number) => shiftDays(-(n - 1));

// ---------------------------------------------------------------------------
// engine
// ---------------------------------------------------------------------------
export function runIntelligence(input: EngineInput): IntelligenceReport {
  const generatedAt = new Date().toISOString();
  const bagKg = input.bagWeightKg && input.bagWeightKg > 0 ? input.bagWeightKg : 25;

  const quality = validateFarmData({
    eggs: input.eggs,
    rooms: input.rooms,
    mortality: input.mortality,
    feed: input.feed,
    health: input.health,
    bagWeightKg: bagKg,
  });

  const eggs = eligible(input.eggs, quality).slice().sort((a, b) => a.date.localeCompare(b.date));
  const mortality = eligible(input.mortality, quality);
  const feed = eligible(input.feed, quality);
  const rooms = input.rooms;
  const active = productionRooms(rooms);
  const birds = active.reduce((s, r) => s + (Number(r.current) || 0), 0);

  const series: DailyProduction[] = computeProductionSeries(eggs, rooms, mortality);
  const window30 = series.filter((d) => d.date >= lastDays(30));
  const window7 = series.filter((d) => d.date >= lastDays(7));
  const window14 = series.filter((d) => d.date >= lastDays(14));

  const pct30 = window30.map((d) => d.overallPct).filter((v): v is number => v != null);
  const pct7 = window7.map((d) => d.overallPct).filter((v): v is number => v != null);
  const eggs30 = window30.map((d) => d.totalEggs);

  // mortality per day
  const mortByDay = new Map<string, number>();
  for (const m of mortality) mortByDay.set(m.date, (mortByDay.get(m.date) ?? 0) + (Number(m.loss) || 0));
  const deaths30 = [...mortByDay.entries()].filter(([d]) => d >= lastDays(30));
  const deaths7 = [...mortByDay.entries()].filter(([d]) => d >= lastDays(7));
  const deaths3 = [...mortByDay.entries()].filter(([d]) => d >= lastDays(3));
  const sumDeaths = (rows: [string, number][]) => rows.reduce((s, [, v]) => s + v, 0);
  const mortalityPctPerDay30 = birds > 0 && deaths30.length ? (sumDeaths(deaths30) / birds / 30) * 100 : null;
  const mortalityPctPerDay3 = birds > 0 && deaths3.length ? (sumDeaths(deaths3) / birds / 3) * 100 : null;

  // feed per day
  const feedByDay = new Map<string, number>();
  for (const f of feed) feedByDay.set(f.date, (feedByDay.get(f.date) ?? 0) + (Number(f.bags) || 0) * bagKg);
  const feed30 = [...feedByDay.entries()].filter(([d]) => d >= lastDays(30));
  const feed7 = [...feedByDay.entries()].filter(([d]) => d >= lastDays(7));
  const feedKgPerBirdDay30 = birds > 0 && feed30.length ? mean(feed30.map(([, v]) => v)) / birds : null;
  const feedKgPerBirdDay7 = birds > 0 && feed7.length ? mean(feed7.map(([, v]) => v)) / birds : null;

  // water (rearing daily records carry litres + birds)
  const water = (input.layerDaily ?? []).filter((d) => d.entry_date >= lastDays(14) && (d.water_litres ?? 0) > 0);
  const waterPerBird =
    water.length && water.some((d) => (d.birds_count ?? 0) > 0)
      ? mean(water.filter((d) => (d.birds_count ?? 0) > 0).map((d) => (d.water_litres ?? 0) / (d.birds_count || 1)))
      : null;

  const today = dayKey(new Date());
  const monthTotals = totalsFor(input.expenses, input.revenue, lastDays(30), today);
  const eggsProduced30 = eggs30.reduce((s, v) => s + v, 0);
  const econ = unitEconomics(monthTotals, { eggsProduced: eggsProduced30, birds, days: 30 });

  const baselines: Baselines = {
    days: window30.length,
    birds,
    layRate30: pct30.length ? round(mean(pct30), 2) : null,
    layRate7: pct7.length ? round(mean(pct7), 2) : null,
    eggsPerDay30: eggs30.length ? Math.round(mean(eggs30)) : null,
    mortalityPctPerDay30: mortalityPctPerDay30 == null ? null : round(mortalityPctPerDay30, 3),
    feedKgPerBirdDay30: feedKgPerBirdDay30 == null ? null : round(feedKgPerBirdDay30, 3),
    waterLitresPerBird: waterPerBird == null ? null : round(waterPerBird, 3),
    costPerEgg: econ.costPerEgg > 0 ? round(econ.costPerEgg, 2) : null,
  };

  const insights: Insight[] = [];
  const forecasts: Forecast[] = [];

  // ---- data quality insight ---------------------------------------------
  if (quality.counts.invalid > 0 || quality.counts.review > 0) {
    insights.push({
      key: "data-quality",
      category: "data",
      kind: "FACT",
      severity: quality.counts.invalid > 0 ? "warning" : "watch",
      title: "Some records need your attention before they can be trusted",
      observed: `${quality.counts.invalid} record${quality.counts.invalid === 1 ? "" : "s"} failed validation and ${quality.counts.review} need review. Data quality score is ${quality.score}%.`,
      whyItMatters:
        "Flagged records are excluded from every baseline, forecast and score, so unresolved issues make the intelligence less complete than it could be.",
      whatToCheck: quality.flags.slice(0, 4).map((f) => f.detail),
      confidence: { score: 95, label: "HIGH", basis: "Deterministic validation rules on your own records" },
      evidence: [`${quality.counts.valid} of ${quality.counts.total} records passed every rule.`],
    });
  }

  if (window30.length < 3) {
    return {
      ready: false,
      message:
        "PoultryPro needs at least three days of validated production records before it can build your farm baselines. Keep recording daily — intelligence unlocks automatically.",
      quality,
      baselines,
      insights,
      forecasts,
      health: { score: 0, band: "Fair", components: [] },
      snapshot: { birds, records: window30.length },
      generatedAt,
    };
  }

  // ---- production --------------------------------------------------------
  if (baselines.layRate7 != null && baselines.layRate30 != null) {
    const delta = baselines.layRate7 - baselines.layRate30;
    const variability = pct30.length ? stdev(pct30) / Math.max(1, mean(pct30)) : 0.3;
    const conf = confidence(pct30.length, variability);
    if (delta <= -5) {
      insights.push({
        key: "production-drop",
        category: "production",
        kind: "INFERENCE",
        severity: delta <= -10 ? "critical" : "warning",
        title: "Lay rate is below your farm's own baseline",
        observed: `Last 7 days average ${baselines.layRate7}% lay versus a 30-day baseline of ${baselines.layRate30}% (${round(delta, 1)} points).`,
        whyItMatters:
          "A sustained drop of this size usually points to feed quality or quantity, water supply, heat stress, disease pressure or a lighting change before it becomes visible as sickness.",
        whatToCheck: [
          "Feed intake per bird over the last week and whether the ration or supplier changed",
          "Water flow at every drinker line and daily litres consumed",
          "House temperature and ventilation during the hottest part of the day",
          "Any new vaccination, medication or disturbance in the last 10 days",
        ],
        recommendation:
          "Review feed and water first, then house climate. Only change the ration or start any treatment after you have confirmed the cause yourself.",
        confidence: conf,
        evidence: [
          `7-day mean lay ${baselines.layRate7}% from ${pct7.length} validated days.`,
          `30-day mean lay ${baselines.layRate30}% from ${pct30.length} validated days.`,
        ],
      });
    } else if (delta >= 3) {
      insights.push({
        key: "production-up",
        category: "production",
        kind: "INFERENCE",
        severity: "healthy",
        title: "Lay rate is running above your baseline",
        observed: `Last 7 days average ${baselines.layRate7}% versus a 30-day baseline of ${baselines.layRate30}%.`,
        whyItMatters: "Whatever changed recently is working — capturing it now makes it repeatable for the next flock.",
        whatToCheck: ["Note the current ration, lighting hours and stocking density while performance is strong"],
        confidence: conf,
        evidence: [`${pct7.length} validated days in the recent window.`],
      });
    }

    // per-room dispersion
    const roomAvg = new Map<string, { name: string; vals: number[] }>();
    for (const day of window7) {
      for (const r of day.rooms) {
        if (r.pct == null) continue;
        const entry = roomAvg.get(r.roomId) ?? { name: r.roomName, vals: [] };
        entry.vals.push(r.pct);
        roomAvg.set(r.roomId, entry);
      }
    }
    const ranked = [...roomAvg.values()]
      .map((r) => ({ name: r.name, avg: mean(r.vals), n: r.vals.length }))
      .sort((a, b) => b.avg - a.avg);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (best && worst && ranked.length > 1 && best.avg - worst.avg >= 8) {
      insights.push({
        key: "room-gap",
        category: "production",
        kind: "INFERENCE",
        severity: best.avg - worst.avg >= 15 ? "warning" : "watch",
        title: `${worst.name} is under-performing your best room`,
        observed: `${best.name} averaged ${round(best.avg, 1)}% lay over the last 7 days while ${worst.name} averaged ${round(worst.avg, 1)}%.`,
        whyItMatters:
          "A gap between houses on the same farm usually means a house-level problem — feeder or drinker access, ventilation, bird age or stocking — not a flock-wide one.",
        whatToCheck: [
          `Feeder and drinker space per bird in ${worst.name}`,
          `Age and breed difference between ${worst.name} and ${best.name}`,
          `Ventilation, light intensity and litter condition in ${worst.name}`,
        ],
        confidence: confidence(Math.min(best.n, worst.n), 0.1),
        evidence: ranked.map((r) => `${r.name}: ${round(r.avg, 1)}% average over ${r.n} days.`),
      });
    }

    // forecast: next 7 days production
    const eggSeries = window14.map((d) => d.totalEggs);
    if (eggSeries.length >= 5) {
      const t = trend(eggSeries);
      const nextDay = Math.max(0, t.intercept + t.slope * eggSeries.length);
      const band = Math.max(t.residual * 1.5, nextDay * 0.05);
      const variability = nextDay > 0 ? t.residual / nextDay : 0.3;
      forecasts.push({
        key: "production-7d",
        label: "Expected eggs over the next 7 days",
        unit: "eggs",
        horizon: "7 days",
        expected: Math.round(nextDay * 7),
        low: Math.round(Math.max(0, nextDay - band) * 7),
        high: Math.round((nextDay + band) * 7),
        direction: t.slope > nextDay * 0.005 ? "up" : t.slope < -nextDay * 0.005 ? "down" : "flat",
        confidence: confidence(eggSeries.length, variability, "14-day trend model"),
        basis: "Least-squares trend on your last 14 validated production days, with the historical day-to-day spread as the range.",
      });
    }
  }

  // ---- mortality risk ----------------------------------------------------
  if (birds > 0) {
    const recentPer1000 = mortalityPctPerDay3 != null ? mortalityPctPerDay3 * 10 : null;
    const basePer1000 = mortalityPctPerDay30 != null ? mortalityPctPerDay30 * 10 : null;
    const total7 = sumDeaths(deaths7);
    if (recentPer1000 != null && basePer1000 != null && basePer1000 > 0 && recentPer1000 > basePer1000 * 2 && total7 > 0) {
      insights.push({
        key: "mortality-spike",
        category: "mortality",
        kind: "INFERENCE",
        severity: recentPer1000 > basePer1000 * 3 ? "critical" : "warning",
        title: "Bird losses are running above your normal rate",
        observed: `Last 3 days: ${round(recentPer1000, 2)} losses per 1,000 birds per day against a 30-day norm of ${round(basePer1000, 2)}. ${total7} bird${total7 === 1 ? "" : "s"} lost in 7 days.`,
        whyItMatters:
          "A rising loss rate is the earliest reliable signal of disease, heat stress, water failure or a feed problem. Acting in the first 48 hours is what limits the damage.",
        whatToCheck: [
          "Which room the losses are concentrated in and the recorded causes",
          "Water availability and drinker cleanliness in that room",
          "Signs of respiratory distress, diarrhoea or huddling",
          "Recent feed batch, medication or vaccination dates",
        ],
        recommendation:
          "Isolate the affected room and have birds examined. PoultryPro does not prescribe treatment — confirm the cause with your veterinarian before medicating.",
        confidence: confidence(deaths30.length, 0.1, "population-normalised"),
        evidence: [
          `Flock size ${birds.toLocaleString()} birds.`,
          `30-day recorded losses: ${sumDeaths(deaths30)}.`,
        ],
      });
    }

    if (basePer1000 != null) {
      const daily = (basePer1000 / 1000) * birds;
      const spread = Math.max(1, daily * 0.6);
      forecasts.push({
        key: "mortality-7d",
        label: "Expected bird losses over the next 7 days",
        unit: "birds",
        horizon: "7 days",
        expected: Math.round(daily * 7),
        low: Math.max(0, Math.round((daily - spread) * 7)),
        high: Math.round((daily + spread) * 7),
        direction: recentPer1000 != null && basePer1000 > 0 && recentPer1000 > basePer1000 * 1.2 ? "up" : "flat",
        confidence: confidence(deaths30.length, 0.15, "30-day loss rate"),
        basis: "Your own 30-day loss rate per bird, projected forward at the current flock size.",
      });
    }
  }

  // ---- feed --------------------------------------------------------------
  if (feedKgPerBirdDay30 != null && feedKgPerBirdDay7 != null && feedKgPerBirdDay30 > 0) {
    const change = (feedKgPerBirdDay7 - feedKgPerBirdDay30) / feedKgPerBirdDay30;
    if (Math.abs(change) >= 0.12) {
      const down = change < 0;
      insights.push({
        key: "feed-shift",
        category: "feed",
        kind: "INFERENCE",
        severity: down ? "warning" : "watch",
        title: down ? "Feed intake per bird has fallen" : "Feed intake per bird has risen",
        observed: `Last 7 days ${round(feedKgPerBirdDay7 * 1000, 0)} g per bird per day versus a 30-day baseline of ${round(feedKgPerBirdDay30 * 1000, 0)} g (${round(change * 100, 0)}%).`,
        whyItMatters: down
          ? "Falling intake almost always precedes a production drop and is an early sign of heat stress, water restriction or a palatability problem."
          : "Rising intake without more eggs raises your cost per egg and can point to feed wastage, spillage or a ration change.",
        whatToCheck: down
          ? ["House temperature at midday", "Water supply and drinker pressure", "Feed freshness, mould and storage conditions"]
          : ["Feeder height and spillage", "Whether the ration or supplier changed", "Whether the recorded quantities match what was actually served"],
        confidence: confidence(feed30.length, 0.12),
        evidence: [`${feed7.length} validated feed days recently, ${feed30.length} in the baseline window.`],
      });
    }

    const daily = feedKgPerBirdDay30 * birds;
    forecasts.push({
      key: "feed-7d",
      label: "Expected feed requirement over the next 7 days",
      unit: "kg",
      horizon: "7 days",
      expected: Math.round(daily * 7),
      low: Math.round(daily * 7 * 0.9),
      high: Math.round(daily * 7 * 1.1),
      direction: "flat",
      confidence: confidence(feed30.length, 0.1, "30-day intake per bird"),
      basis: `Baseline intake ${round(feedKgPerBirdDay30 * 1000, 0)} g per bird per day × ${birds.toLocaleString()} birds. Equivalent to about ${Math.round((daily * 7) / bagKg)} bags of ${bagKg} kg.`,
    });
  }

  // ---- water -------------------------------------------------------------
  if (waterPerBird != null && feedKgPerBirdDay7 != null && feedKgPerBirdDay7 > 0) {
    const ratio = waterPerBird / feedKgPerBirdDay7;
    if (ratio < 1.5 || ratio > 3.2) {
      insights.push({
        key: "water-ratio",
        category: "water",
        kind: "INFERENCE",
        severity: ratio < 1.5 ? "warning" : "watch",
        title: ratio < 1.5 ? "Water intake looks low against feed intake" : "Water intake is unusually high against feed intake",
        observed: `Recorded water to feed ratio is ${round(ratio, 2)}:1 (${round(waterPerBird * 1000, 0)} ml per bird per day).`,
        whyItMatters:
          "Healthy layers normally drink roughly two litres of water for every kilogram of feed. A ratio outside that range points to restricted water, a leak, or gut and heat stress.",
        whatToCheck: ["Drinker line pressure and blockages", "Leaks or spillage under the lines", "House temperature and any recent medication in water"],
        confidence: confidence(water.length, 0.2, "rearing water records"),
        evidence: [`${water.length} days with recorded water volume in the last 14 days.`],
      });
    }
  }

  // ---- weather link ------------------------------------------------------
  if (input.weather?.thi != null && input.weather.thi >= 27) {
    insights.push({
      key: "heat-stress",
      category: "health",
      kind: "PREDICTION",
      severity: input.weather.thi >= 30 ? "critical" : "warning",
      title: "Heat stress conditions are likely",
      observed: `Temperature-humidity index is ${round(input.weather.thi, 1)}${input.weather.tempMaxC != null ? ` with a high of ${round(input.weather.tempMaxC, 0)}°C` : ""}.`,
      whyItMatters:
        "Above a THI of 27 birds cut feed intake to lose heat, and lay rate typically follows within two to three days. Losses rise sharply above 30.",
      whatToCheck: ["Ventilation and airflow at midday", "Cool, clean water available at all points", "Shift heavy feeding to the cooler early morning and evening"],
      recommendation: "Plan cooling and feeding-time changes now rather than after production drops.",
      confidence: { score: 70, label: "MEDIUM", basis: "Forecast weather combined with your farm location" },
      evidence: [input.weather.summary ?? "Forecast supplied by the farm weather module."],
    });
  }

  // ---- financial ---------------------------------------------------------
  if (monthTotals.revenue > 0 || monthTotals.expenses > 0) {
    const prev = totalsFor(input.expenses, input.revenue, lastDays(60), lastDays(31));
    const marginNow = monthTotals.margin;
    const marginPrev = prev.revenue > 0 ? prev.margin : null;
    const drop = marginPrev != null ? marginNow - marginPrev : null;
    insights.push({
      key: "financial",
      category: "financial",
      kind: drop == null ? "FACT" : "INFERENCE",
      severity: marginNow < 0 ? "critical" : drop != null && drop <= -10 ? "warning" : "healthy",
      title: marginNow < 0 ? "The last 30 days ran at a loss" : "Profitability summary for the last 30 days",
      observed: `Revenue ${naira(monthTotals.revenue)}, expenses ${naira(monthTotals.expenses)}, profit ${naira(monthTotals.profit)} (${round(marginNow, 1)}% margin)${
        drop != null ? `, ${drop >= 0 ? "up" : "down"} ${round(Math.abs(drop), 1)} points versus the previous 30 days` : ""
      }.`,
      whyItMatters:
        econ.costPerEgg > 0
          ? `Your cost per egg is ${naira(econ.costPerEgg)}. Selling below that price loses money on every crate regardless of how many eggs you produce.`
          : "Recording both expenses and sales is what turns production data into a profit picture.",
      whatToCheck: [
        "Feed cost share of total expenses — normally the largest line",
        "Current egg selling price against your cost per egg",
        "Any large one-off expense inside the period",
      ],
      confidence: confidence(Math.min(30, input.expenses.length + input.revenue.length), 0.1, "recorded finance entries"),
      evidence: [
        `${input.expenses.length} expense and ${input.revenue.length} revenue records available.`,
        econ.costPerBird > 0 ? `Cost per bird over 30 days: ${naira(econ.costPerBird)}.` : "Cost per bird not available.",
      ],
    });

    if (monthTotals.revenue > 0) {
      const dailyProfit = econ.avgDailyProfit;
      forecasts.push({
        key: "profit-30d",
        label: "Projected profit over the next 30 days",
        unit: "₦",
        horizon: "30 days",
        expected: Math.round(dailyProfit * 30),
        low: Math.round(dailyProfit * 30 * 0.75),
        high: Math.round(dailyProfit * 30 * 1.25),
        direction: dailyProfit > 0 ? "up" : "down",
        confidence: confidence(Math.min(30, input.revenue.length), 0.2, "recorded cash flow"),
        basis: "Average daily profit over the last 30 recorded days, held flat and widened by ±25% for price movement.",
      });
    }
  }

  // ---- health programme --------------------------------------------------
  const lastHealth = input.health
    .filter((h) => h.type === "Vaccination")
    .map((h) => h.date)
    .sort()
    .pop();
  if (lastHealth) {
    const gap = Math.round((Date.parse(today) - Date.parse(lastHealth)) / 86_400_000);
    if (gap > 60) {
      insights.push({
        key: "vaccination-gap",
        category: "health",
        kind: "FACT",
        severity: gap > 120 ? "warning" : "watch",
        title: "No vaccination recorded recently",
        observed: `The last vaccination on record was ${gap} days ago (${lastHealth}).`,
        whyItMatters: "Gaps in the vaccination record make it impossible to link disease pressure to programme timing, and boosters may have been missed.",
        whatToCheck: ["Whether vaccinations were given but not recorded", "Your programme's next due dates with your veterinarian"],
        confidence: { score: 90, label: "HIGH", basis: "Direct reading of your health records" },
        evidence: [`${input.health.length} health records on file.`],
      });
    }
  }

  insights.sort((a, b) => sevRank(b.severity) - sevRank(a.severity));

  const health = buildHealthScore({
    layRate7: baselines.layRate7,
    layRate30: baselines.layRate30,
    mortalityPctPerDay30,
    mortalityPctPerDay3,
    feedChange:
      feedKgPerBirdDay30 && feedKgPerBirdDay7 ? (feedKgPerBirdDay7 - feedKgPerBirdDay30) / feedKgPerBirdDay30 : null,
    margin: monthTotals.revenue > 0 ? monthTotals.margin : null,
    qualityScore: quality.score,
  });

  const snapshot = {
    generatedAt,
    birds,
    rooms: active.map((r) => ({ name: r.name, birds: Number(r.current) || 0, status: r.status ?? "active", ageWeeks: r.age_weeks ?? null })),
    baselines,
    dataQuality: { score: quality.score, ...quality.counts },
    recentProduction: window7.map((d) => ({ date: d.date, eggs: d.totalEggs, layPct: d.overallPct == null ? null : round(d.overallPct, 2) })),
    recentLosses: deaths7.map(([date, loss]) => ({ date, loss })),
    recentFeedKg: feed7.map(([date, kg]) => ({ date, kg: round(kg, 1) })),
    finance30d: {
      revenue: Math.round(monthTotals.revenue),
      expenses: Math.round(monthTotals.expenses),
      profit: Math.round(monthTotals.profit),
      marginPct: round(monthTotals.margin, 1),
      costPerEgg: baselines.costPerEgg,
    },
    prices: input.prices.slice(0, 12).map((p) => ({ item: p.item, unit: p.unit, price: p.price })),
    weather: input.weather ?? null,
    healthScore: health.score,
    insights: insights.map((i) => ({ key: i.key, severity: i.severity, title: i.title, observed: i.observed, confidence: i.confidence.label })),
    forecasts: forecasts.map((f) => ({ key: f.key, label: f.label, expected: f.expected, low: f.low, high: f.high, confidence: f.confidence.label })),
  };

  return {
    ready: true,
    message: "",
    quality,
    baselines,
    insights,
    forecasts,
    health,
    snapshot,
    generatedAt,
  };
}

function sevRank(s: Severity) {
  return s === "critical" ? 4 : s === "warning" ? 3 : s === "watch" ? 2 : 1;
}

function buildHealthScore(x: {
  layRate7: number | null;
  layRate30: number | null;
  mortalityPctPerDay30: number | null;
  mortalityPctPerDay3: number | null;
  feedChange: number | null;
  margin: number | null;
  qualityScore: number;
}): HealthScore {
  const components: HealthScore["components"] = [];

  // Production (35%): absolute lay rate plus trend against baseline
  if (x.layRate7 != null) {
    const level = Math.max(0, Math.min(100, (x.layRate7 / 85) * 100));
    const drift = x.layRate30 != null ? x.layRate7 - x.layRate30 : 0;
    const score = Math.max(0, Math.min(100, level + Math.max(-25, Math.min(10, drift * 2))));
    components.push({
      key: "production", label: "Production", score: Math.round(score), weight: 0.35,
      note: `${x.layRate7}% lay rate over the last 7 days.`,
    });
  }

  // Mortality (30%)
  if (x.mortalityPctPerDay30 != null) {
    const daily = x.mortalityPctPerDay3 ?? x.mortalityPctPerDay30;
    const score = Math.max(0, Math.min(100, 100 - (daily / 0.05) * 50));
    components.push({
      key: "mortality", label: "Bird losses", score: Math.round(score), weight: 0.3,
      note: `${(daily * 10).toFixed(2)} losses per 1,000 birds per day.`,
    });
  }

  // Feed stability (15%)
  if (x.feedChange != null) {
    const score = Math.max(0, 100 - Math.abs(x.feedChange) * 300);
    components.push({
      key: "feed", label: "Feed stability", score: Math.round(score), weight: 0.15,
      note: `${x.feedChange >= 0 ? "+" : ""}${Math.round(x.feedChange * 100)}% intake versus baseline.`,
    });
  }

  // Profitability (10%)
  if (x.margin != null) {
    const score = Math.max(0, Math.min(100, ((x.margin + 20) / 50) * 100));
    components.push({
      key: "financial", label: "Profitability", score: Math.round(score), weight: 0.1,
      note: `${x.margin.toFixed(1)}% margin over 30 days.`,
    });
  }

  // Record completeness (10%)
  components.push({
    key: "data", label: "Record quality", score: x.qualityScore, weight: 0.1,
    note: `${x.qualityScore}% of records passed validation.`,
  });

  const totalWeight = components.reduce((s, c) => s + c.weight, 0) || 1;
  const score = Math.round(components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight);
  const band: HealthScore["band"] = score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 55 ? "Fair" : "At risk";
  return { score, band, components };
}

export const SEVERITY_TONE: Record<Severity, { badge: string; ring: string; label: string }> = {
  critical: { badge: "bg-rose-600 text-white", ring: "border-rose-500/40", label: "Critical" },
  warning: { badge: "bg-amber-500 text-white", ring: "border-amber-500/40", label: "Needs attention" },
  watch: { badge: "bg-sky-500 text-white", ring: "border-sky-500/40", label: "Monitor" },
  healthy: { badge: "bg-emerald-600 text-white", ring: "border-emerald-500/40", label: "Healthy" },
};

export const KIND_LABEL: Record<InsightKind, string> = {
  FACT: "Recorded fact",
  INFERENCE: "AI analysis",
  PREDICTION: "AI prediction",
  RECOMMENDATION: "Recommendation",
};
