// Broiler performance engine — pure functions, no hooks, no I/O.
//
// Every figure here is derived from recorded data only: there are no assumed
// prices, breed tables or standard growth curves. When a farm has not recorded
// something (e.g. a weight), the dependent metric is reported as null so the UI
// can say "not recorded" instead of inventing a number.
import type { BroilerBatch, BroilerDaily, BroilerSale } from "@/lib/broiler-data";
import { toDateKey } from "@/lib/date-key";

/** Day-old chick weight in grams — the only fixed biological constant used. */
const DOC_WEIGHT_G = 42;

export type BatchMetrics = {
  batch: BroilerBatch;
  ageDays: number;
  birdsAlive: number;
  birdsSold: number;
  deaths: number;
  mortalityPct: number;
  feedKg: number;
  feedPerBirdKg: number;
  avgWeightG: number | null;
  liveWeightKg: number | null;
  weightGainKg: number | null;
  /** Feed Conversion Ratio — kg feed per kg of live weight gained. */
  fcr: number | null;
  /** Average Daily Gain in grams. */
  adgG: number | null;
  /** Progress toward the batch target weight, 0-1. */
  targetProgress: number | null;
  chickCost: number;
  feedCost: number;
  totalCost: number;
  revenue: number;
  profit: number;
  costPerBird: number;
  costPerKg: number | null;
  soldWeightKg: number;
  avgSalePricePerKg: number | null;
};

export function computeBatchMetrics(
  batch: BroilerBatch,
  daily: BroilerDaily[],
  sales: BroilerSale[],
  feedPerKgOn: (dateKey: string | null | undefined) => number,
  today = new Date(),
): BatchMetrics {
  const rows = daily.filter((d) => d.batch_id === batch.id);
  const saleRows = sales.filter((s) => s.batch_id === batch.id);

  const placedKey = toDateKey(batch.date_placed) ?? toDateKey(today)!;
  const endKey =
    batch.status === "active"
      ? toDateKey(today)!
      : (saleRows.map((s) => toDateKey(s.entry_date) ?? "").sort().pop() || toDateKey(today)!);
  const ageDays = Math.max(0, daysBetween(placedKey, endKey));

  const deaths = rows.reduce((s, r) => s + (r.deaths || 0), 0);
  const birdsSold = saleRows.reduce((s, r) => s + (r.birds || 0), 0);
  const birdsAlive = Math.max(0, batch.birds_placed - deaths - birdsSold);
  const mortalityPct = batch.birds_placed > 0 ? (deaths / batch.birds_placed) * 100 : 0;

  const feedKg = rows.reduce((s, r) => s + (Number(r.feed_kg) || 0), 0);
  const feedCost = rows.reduce(
    (s, r) => s + (Number(r.feed_kg) || 0) * feedPerKgOn(toDateKey(r.entry_date)),
    0,
  );
  const headForFeed = birdsAlive + birdsSold || batch.birds_placed;
  const feedPerBirdKg = headForFeed > 0 ? feedKg / headForFeed : 0;

  const weighed = rows
    .filter((r) => r.avg_weight_g != null && Number(r.avg_weight_g) > 0)
    .sort((a, b) => (toDateKey(a.entry_date) ?? "").localeCompare(toDateKey(b.entry_date) ?? ""));
  const avgWeightG = weighed.length ? Number(weighed[weighed.length - 1].avg_weight_g) : null;

  const liveWeightKg = avgWeightG != null ? (avgWeightG / 1000) * birdsAlive : null;
  const soldWeightKg = saleRows.reduce((s, r) => s + (Number(r.total_weight_kg) || 0), 0);

  // Total gain = live weight still on the farm + weight already sold, minus the
  // weight the batch arrived with.
  const weightGainKg =
    avgWeightG != null
      ? Math.max(
          0,
          (liveWeightKg ?? 0) + soldWeightKg - (batch.birds_placed * DOC_WEIGHT_G) / 1000,
        )
      : soldWeightKg > 0
        ? Math.max(0, soldWeightKg - (batch.birds_placed * DOC_WEIGHT_G) / 1000)
        : null;

  const fcr = weightGainKg && weightGainKg > 0 && feedKg > 0 ? feedKg / weightGainKg : null;
  const adgG = avgWeightG != null && ageDays > 0 ? (avgWeightG - DOC_WEIGHT_G) / ageDays : null;
  const targetProgress =
    avgWeightG != null && batch.target_weight_kg > 0
      ? Math.min(1, avgWeightG / 1000 / batch.target_weight_kg)
      : null;

  const chickCost = batch.birds_placed * (Number(batch.chick_unit_cost) || 0);
  const totalCost = chickCost + feedCost;
  const revenue = saleRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const profit = revenue - totalCost;
  const costPerBird = batch.birds_placed > 0 ? totalCost / batch.birds_placed : 0;
  const producedKg = (liveWeightKg ?? 0) + soldWeightKg;
  const costPerKg = producedKg > 0 ? totalCost / producedKg : null;
  const avgSalePricePerKg = soldWeightKg > 0 ? revenue / soldWeightKg : null;

  return {
    batch, ageDays, birdsAlive, birdsSold, deaths, mortalityPct,
    feedKg, feedPerBirdKg, avgWeightG, liveWeightKg, weightGainKg,
    fcr, adgG, targetProgress, chickCost, feedCost, totalCost,
    revenue, profit, costPerBird, costPerKg, soldWeightKg, avgSalePricePerKg,
  };
}

export type BroilerSummary = {
  activeBatches: number;
  birdsAlive: number;
  birdsPlaced: number;
  deaths: number;
  mortalityPct: number;
  feedKg: number;
  revenue: number;
  totalCost: number;
  profit: number;
  avgFcr: number | null;
};

export function summarise(metrics: BatchMetrics[]): BroilerSummary {
  const active = metrics.filter((m) => m.batch.status === "active");
  const birdsPlaced = metrics.reduce((s, m) => s + m.batch.birds_placed, 0);
  const deaths = metrics.reduce((s, m) => s + m.deaths, 0);
  const fcrs = metrics.map((m) => m.fcr).filter((v): v is number => v != null && v > 0);
  return {
    activeBatches: active.length,
    birdsAlive: metrics.reduce((s, m) => s + m.birdsAlive, 0),
    birdsPlaced,
    deaths,
    mortalityPct: birdsPlaced > 0 ? (deaths / birdsPlaced) * 100 : 0,
    feedKg: metrics.reduce((s, m) => s + m.feedKg, 0),
    revenue: metrics.reduce((s, m) => s + m.revenue, 0),
    totalCost: metrics.reduce((s, m) => s + m.totalCost, 0),
    profit: metrics.reduce((s, m) => s + m.profit, 0),
    avgFcr: fcrs.length ? fcrs.reduce((a, b) => a + b, 0) / fcrs.length : null,
  };
}

/** Growth curve points (day of age vs average weight) for one batch. */
export function growthCurve(batch: BroilerBatch, daily: BroilerDaily[]) {
  const placed = toDateKey(batch.date_placed) ?? "";
  return daily
    .filter((d) => d.batch_id === batch.id && d.avg_weight_g != null && Number(d.avg_weight_g) > 0)
    .map((d) => ({
      day: daysBetween(placed, toDateKey(d.entry_date) ?? placed),
      weightG: Number(d.avg_weight_g),
    }))
    .sort((a, b) => a.day - b.day);
}

/** Plain-language observations, derived only from what the farm recorded. */
export function batchInsights(m: BatchMetrics): { tone: "good" | "warn" | "bad"; text: string }[] {
  const out: { tone: "good" | "warn" | "bad"; text: string }[] = [];

  if (m.mortalityPct >= 8) {
    out.push({ tone: "bad", text: `Mortality is ${m.mortalityPct.toFixed(1)}% — above the 5% level most broiler cycles stay under. Review brooding temperature, ventilation and water access.` });
  } else if (m.mortalityPct >= 5) {
    out.push({ tone: "warn", text: `Mortality at ${m.mortalityPct.toFixed(1)}% is creeping up. Watch the next few days closely.` });
  } else if (m.deaths > 0 || m.ageDays > 7) {
    out.push({ tone: "good", text: `Mortality is ${m.mortalityPct.toFixed(1)}% — within a healthy range for this age.` });
  }

  if (m.fcr != null) {
    if (m.fcr > 2.2) out.push({ tone: "warn", text: `FCR of ${m.fcr.toFixed(2)} means ${m.fcr.toFixed(2)} kg of feed per kg of gain. Check for feed spillage and confirm weights are recorded accurately.` });
    else out.push({ tone: "good", text: `FCR of ${m.fcr.toFixed(2)} is efficient — feed is converting well into weight.` });
  } else {
    out.push({ tone: "warn", text: "Record an average bird weight to unlock FCR, daily gain and cost per kg." });
  }

  if (m.adgG != null && m.adgG > 0) {
    out.push({ tone: m.adgG >= 45 ? "good" : "warn", text: `Birds are gaining about ${Math.round(m.adgG)} g per day since placement.` });
  }

  if (m.targetProgress != null && m.targetProgress >= 1) {
    out.push({ tone: "good", text: `Target weight of ${m.batch.target_weight_kg} kg reached — this batch is ready for market.` });
  }

  if (m.revenue > 0) {
    out.push({
      tone: m.profit >= 0 ? "good" : "bad",
      text: `Recorded sales of ₦${Math.round(m.revenue).toLocaleString("en-NG")} against ₦${Math.round(m.totalCost).toLocaleString("en-NG")} in chick and feed cost — ${m.profit >= 0 ? "a profit" : "a loss"} of ₦${Math.round(Math.abs(m.profit)).toLocaleString("en-NG")}.`,
    });
  }

  return out;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  if (!ay || !by) return 0;
  const start = new Date(ay, am - 1, ad).getTime();
  const end = new Date(by, bm - 1, bd).getTime();
  return Math.round((end - start) / 86_400_000);
}
