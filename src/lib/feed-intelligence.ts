// PoultryPro — AI Feed Intelligence
// Client-side analytics engine that turns raw feed / production / bird counts
// into ranked, human-readable operational insights. Pure derivations from
// tenant-scoped hooks — no additional network calls, no cross-farm leakage.

import { useMemo } from "react";
import { useFarm, useFeed, useEggs, useRooms, usePrices } from "@/lib/farm-data";
import { useFeedInventory, useFeedStockAnalytics } from "@/lib/feed-inventory-data";
import { useActiveFormulaCostPerKg } from "@/lib/feed-formulas-data";
import { normaliseEggRow, totalEggsFromRow } from "@/lib/egg-normalize";
import { toDateKey } from "@/lib/date-key";

export type Severity = "critical" | "warning" | "info" | "positive";

export type FeedInsight = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  action?: string;
};

export type FeedIntelligence = {
  isLoading: boolean;
  // Consumption
  todayKg: number;
  avg7Kg: number;
  prev7Kg: number;
  trendPct: number;               // % change 7d vs previous 7d
  anomalyPct: number | null;      // today vs 7d avg
  // Bird efficiency
  totalBirds: number;
  gramsPerBirdPerDay: number | null;
  benchmarkGramsPerBird: number;  // ~115g layers baseline
  efficiencyDeltaPct: number | null;
  // Conversion
  fcrKgPerEgg: number | null;     // kg feed per egg (last 30d)
  kgPerCrate: number | null;
  costPerCrate: number | null;
  // Economics
  inventoryUnitCost: number;      // weighted avg ₦/kg of remaining stock
  activeFormulaCost: number | null;
  marketBuyCost: number | null;   // derived from feed price entry (per bag)
  buyVsProduceDeltaPct: number | null;
  // Reorder planning
  leadTimeDays: number;
  reorderByDate: Date | null;
  daysUntilReorder: number | null;
  // Insights ranked by severity
  insights: FeedInsight[];
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function useFeedIntelligence(leadTimeDays = 3): FeedIntelligence {
  const farm = useFarm();
  const feedQ = useFeed();
  const eggQ = useEggs();
  const roomsQ = useRooms();
  const pricesQ = usePrices();
  const invQ = useFeedInventory();
  const stock = useFeedStockAnalytics();
  const activeFormulaCost = useActiveFormulaCostPerKg();

  const bagKg = farm.data?.bag_weight_kg && farm.data.bag_weight_kg > 0 ? farm.data.bag_weight_kg : 25;

  return useMemo<FeedIntelligence>(() => {
    const feedRows = feedQ.data ?? [];
    const eggRows = eggQ.data ?? [];
    const rooms = roomsQ.data ?? [];
    const prices = pricesQ.data ?? [];
    const lots = invQ.data ?? [];

    // ---- Daily feed usage series (kg) ----
    const dayKg = new Map<string, number>();
    for (const r of feedRows) {
      const key = toDateKey(r.date) ?? r.date;
      dayKg.set(key, (dayKg.get(key) ?? 0) + num(r.bags) * bagKg);
    }
    const today = toDateKey(new Date()) ?? new Date().toISOString().slice(0, 10);
    const sumN = (start: number, end: number) => {
      let total = 0;
      const base = new Date(today + "T00:00:00");
      for (let i = start; i < end; i++) {
        const d = new Date(base); d.setDate(base.getDate() - i);
        total += dayKg.get(toDateKey(d) ?? "") ?? 0;
      }
      return total;
    };
    const todayKg = dayKg.get(today) ?? 0;
    const last7 = sumN(0, 7);
    const prev7 = sumN(7, 14);
    const avg7 = last7 / 7;
    const trendPct = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : 0;
    const anomalyPct = avg7 > 0 && todayKg > 0 ? ((todayKg - avg7) / avg7) * 100 : null;

    // ---- Bird efficiency ----
    const totalBirds = rooms.reduce((s, r) => s + num(r.current), 0);
    const gramsPerBirdPerDay = totalBirds > 0 && avg7 > 0 ? (avg7 * 1000) / totalBirds : null;
    const benchmark = 115; // Standard layer intake baseline g/bird/day
    const efficiencyDeltaPct = gramsPerBirdPerDay !== null
      ? ((gramsPerBirdPerDay - benchmark) / benchmark) * 100
      : null;

    // ---- FCR (last 30 days) ----
    let feed30 = 0, eggs30 = 0;
    const cutoff = new Date(today + "T00:00:00"); cutoff.setDate(cutoff.getDate() - 29);
    const cutKey = toDateKey(cutoff) ?? "";
    for (const [k, v] of dayKg) if (k >= cutKey) feed30 += v;
    for (const r of eggRows) {
      const k = toDateKey(r.date) ?? r.date;
      if (k >= cutKey) eggs30 += totalEggsFromRow(r);
    }
    const fcrKgPerEgg = eggs30 > 0 ? feed30 / eggs30 : null;
    const kgPerCrate = fcrKgPerEgg !== null ? fcrKgPerEgg * 30 : null;

    // ---- Inventory-weighted unit cost ----
    const activeLots = lots.filter((l) => l.remaining_kg > 0);
    const totalRem = activeLots.reduce((s, l) => s + l.remaining_kg, 0);
    const inventoryUnitCost = totalRem > 0
      ? activeLots.reduce((s, l) => s + l.remaining_kg * l.unit_cost_per_kg, 0) / totalRem
      : 0;

    // Market buy cost — derive from feed-related price entries
    const feedPrice = prices.find((p) => /feed/i.test(p.item));
    let marketBuyCost: number | null = null;
    if (feedPrice) {
      const unit = (feedPrice.unit || "").toLowerCase();
      if (unit.includes("kg")) marketBuyCost = num(feedPrice.price);
      else marketBuyCost = num(feedPrice.price) / bagKg; // bag → kg
    }

    const effectiveCost = inventoryUnitCost > 0
      ? inventoryUnitCost
      : (activeFormulaCost ?? marketBuyCost ?? 0);
    const costPerCrate = kgPerCrate !== null && effectiveCost > 0 ? kgPerCrate * effectiveCost : null;

    const buyVsProduceDeltaPct =
      activeFormulaCost && marketBuyCost && marketBuyCost > 0
        ? ((marketBuyCost - activeFormulaCost) / marketBuyCost) * 100
        : null;

    // ---- Reorder planning ----
    const days = stock.daysRemaining;
    const daysUntilReorder = Number.isFinite(days) ? Math.max(0, Math.floor(days - leadTimeDays)) : null;
    const reorderByDate = daysUntilReorder !== null
      ? new Date(Date.now() + daysUntilReorder * 86400000)
      : null;

    // ---- Ranked insights ----
    const insights: FeedInsight[] = [];

    if (stock.stockKg <= 0) {
      insights.push({
        id: "empty", severity: "critical",
        title: "Feed inventory is empty",
        detail: "Bird intake will halt today. Log a purchase or produced batch immediately.",
        action: `Order ${stock.recommendPurchaseBags || 30} bags now`,
      });
    } else if (Number.isFinite(days) && days < 5) {
      insights.push({
        id: "critical-runway", severity: "critical",
        title: `Only ${Math.floor(days)} days of feed left`,
        detail: `At ${avg7.toFixed(0)} kg/day you will run out before ${stock.depletion?.toLocaleDateString() ?? "next week"}.`,
        action: `Purchase ${stock.recommendPurchaseBags} bags (${stock.recommendPurchaseKg.toFixed(0)} kg)`,
      });
    } else if (Number.isFinite(days) && days < 10) {
      insights.push({
        id: "low-runway", severity: "warning",
        title: "Feed running low",
        detail: `Runway is ${Math.floor(days)} days. Reorder by ${reorderByDate?.toLocaleDateString() ?? "soon"} to stay ahead of lead time.`,
        action: `Order ${stock.recommendPurchaseBags} bags`,
      });
    }

    if (anomalyPct !== null && Math.abs(anomalyPct) >= 25) {
      insights.push({
        id: "usage-anomaly",
        severity: anomalyPct > 0 ? "warning" : "info",
        title: anomalyPct > 0 ? "Feed usage spiked today" : "Feed usage dropped today",
        detail: `Today's ${todayKg.toFixed(0)} kg is ${anomalyPct > 0 ? "+" : ""}${anomalyPct.toFixed(0)}% vs the 7-day average of ${avg7.toFixed(0)} kg. Check waste, spillage or missed entries.`,
      });
    }

    if (efficiencyDeltaPct !== null && efficiencyDeltaPct > 15) {
      insights.push({
        id: "over-feeding", severity: "warning",
        title: "Birds may be over-fed",
        detail: `Intake is ${gramsPerBirdPerDay?.toFixed(0)}g/bird vs the ${benchmark}g layer benchmark (+${efficiencyDeltaPct.toFixed(0)}%). Consider tightening rations or checking for spillage.`,
      });
    } else if (efficiencyDeltaPct !== null && efficiencyDeltaPct < -15) {
      insights.push({
        id: "under-feeding", severity: "warning",
        title: "Birds may be under-fed",
        detail: `Intake is only ${gramsPerBirdPerDay?.toFixed(0)}g/bird vs the ${benchmark}g benchmark (${efficiencyDeltaPct.toFixed(0)}%). Production and shell quality can suffer.`,
      });
    } else if (gramsPerBirdPerDay !== null) {
      insights.push({
        id: "intake-ok", severity: "positive",
        title: "Intake on target",
        detail: `Flock consumes ${gramsPerBirdPerDay.toFixed(0)}g/bird/day, in line with the ${benchmark}g layer standard.`,
      });
    }

    if (buyVsProduceDeltaPct !== null) {
      const abs = Math.abs(buyVsProduceDeltaPct).toFixed(0);
      if (buyVsProduceDeltaPct > 8) {
        insights.push({
          id: "produce-cheaper", severity: "positive",
          title: "Self-producing feed saves money",
          detail: `Your active formula (₦${activeFormulaCost?.toFixed(0)}/kg) is ${abs}% cheaper than buying ready-made feed (₦${marketBuyCost?.toFixed(0)}/kg).`,
          action: "Set Feed Source to Self-Produced",
        });
      } else if (buyVsProduceDeltaPct < -8) {
        insights.push({
          id: "buy-cheaper", severity: "info",
          title: "Buying ready-made feed is currently cheaper",
          detail: `Market feed (₦${marketBuyCost?.toFixed(0)}/kg) is ${abs}% cheaper than your active formula (₦${activeFormulaCost?.toFixed(0)}/kg). Review ingredient prices.`,
        });
      }
    }

    if (trendPct >= 15 && prev7 > 0) {
      insights.push({
        id: "trend-up", severity: "info",
        title: "Consumption climbing week-over-week",
        detail: `Usage rose ${trendPct.toFixed(0)}% vs the previous 7 days (${last7.toFixed(0)} kg vs ${prev7.toFixed(0)} kg).`,
      });
    } else if (trendPct <= -15 && prev7 > 0) {
      insights.push({
        id: "trend-down", severity: "info",
        title: "Consumption falling week-over-week",
        detail: `Usage dropped ${Math.abs(trendPct).toFixed(0)}% vs the previous 7 days. Verify recordings are up to date.`,
      });
    }

    // Expiring lots
    const now = Date.now();
    const expiring = activeLots.filter((l) => {
      if (!l.expiry_date) return false;
      const t = new Date(l.expiry_date + "T00:00:00").getTime();
      const d = Math.ceil((t - now) / 86400000);
      return d >= 0 && d <= 14;
    });
    if (expiring.length > 0) {
      insights.push({
        id: "expiring", severity: "warning",
        title: `${expiring.length} lot${expiring.length > 1 ? "s" : ""} expiring within 14 days`,
        detail: `Prioritise ${expiring.reduce((s, l) => s + l.remaining_kg, 0).toFixed(0)} kg of near-expiry stock to avoid waste.`,
        action: "Use FIFO order in Warehouse",
      });
    }

    if (avg7 === 0) {
      insights.push({
        id: "no-usage", severity: "info",
        title: "No feed usage logged this week",
        detail: "Record daily feed to unlock forecasting, FCR and cost-per-crate insights.",
      });
    }

    const order: Record<Severity, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
    insights.sort((a, b) => order[a.severity] - order[b.severity]);

    return {
      isLoading: feedQ.isLoading || eggQ.isLoading || roomsQ.isLoading || invQ.isLoading || stock.isLoading,
      todayKg, avg7Kg: avg7, prev7Kg: prev7, trendPct, anomalyPct,
      totalBirds, gramsPerBirdPerDay, benchmarkGramsPerBird: benchmark, efficiencyDeltaPct,
      fcrKgPerEgg, kgPerCrate, costPerCrate,
      inventoryUnitCost, activeFormulaCost, marketBuyCost, buyVsProduceDeltaPct,
      leadTimeDays, reorderByDate, daysUntilReorder,
      insights,
    };
  }, [
    feedQ.data, feedQ.isLoading, eggQ.data, eggQ.isLoading, roomsQ.data, roomsQ.isLoading,
    pricesQ.data, invQ.data, invQ.isLoading, stock.stockKg, stock.daysRemaining, stock.depletion,
    stock.recommendPurchaseBags, stock.recommendPurchaseKg, stock.isLoading,
    activeFormulaCost, bagKg, leadTimeDays,
  ]);
}
