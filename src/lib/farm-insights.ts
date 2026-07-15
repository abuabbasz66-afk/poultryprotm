import type { EggRow, Room, Mortality, Feed, Health, Price } from "@/lib/farm-data";
import { detectProductionDecline, type DeclineEvent } from "@/lib/production-decline";
import { detectMortalityPatterns, type MortalityEvent } from "@/lib/mortality-pattern";
import { normaliseEggRow, totalEggsFromRow } from "@/lib/egg-normalize";
import {
  computeForecast, computeMortalityRisk, computeFeedEfficiency, computeAbnormalActivity,
  type ForecastResult, type MortalityAnalysis, type FeedEffAnalysis, type AbnormalAnalysis,
} from "@/lib/intelligence-modules";

// -----------------------------------------------------------------------------
// AI-Supported Farm Insights — cross-module farm intelligence & decision support
//
// Architecture (kept deterministic — no LLM required):
//
//   buildFarmIntelligenceContext(input)  → FarmIntelligenceContext
//   detectFarmPatterns(context)          → DetectedFarmPattern[]
//   rankFarmInsights(patterns)           → FarmInsight[] (deduped, capped)
//   buildFarmInsights(input)             → FarmInsightsReport
//
// The context + patterns layers are structured, privacy-conscious summaries
// of what the farm's own records actually say. A future LLM/AI explanation
// layer can consume `context` + `patterns` without needing raw DB access.
// -----------------------------------------------------------------------------

const CRATE = 30;

// ---------- types ----------

export type InsightPriority = "Looking good" | "Watch" | "Attention" | "High priority";
export type InsightCategory =
  | "Whole Farm"
  | "Production"
  | "Feed"
  | "Mortality"
  | "Health"
  | "Room Performance"
  | "Financial Performance";

/** Kept for backwards-compatibility with the existing card. */
export type InsightStatus = InsightPriority;

export type FarmInsight = {
  id: string;
  status: InsightPriority;          // priority badge (renamed but same field)
  category: InsightCategory;
  priority: number;                 // internal ranking weight
  title: string;
  whatWeFound: string;
  whyItMatters: string;
  whatToCheck: string[];
  evidence: string[];               // shown in "Why am I seeing this?"
  scopeLabel?: string;              // e.g. "Room 3", "Whole farm"
};

export type FarmInsightsReport = {
  ready: boolean;
  briefing: string;
  insights: FarmInsight[];
  message?: string;
  totalEggRecords: number;
  context: FarmIntelligenceContext;
  patterns: DetectedFarmPattern[];
};

// ---------- helpers ----------

function sortNewestFirst<T extends { date: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
}
function round1(n: number): number { return Math.round(n * 10) / 10; }
function daysBetweenIso(a: string, b: string): number {
  const t1 = new Date(a + "T00:00:00Z").getTime();
  const t2 = new Date(b + "T00:00:00Z").getTime();
  return Math.round((t1 - t2) / 86_400_000);
}
function lower(s: string): string { return s.charAt(0).toLowerCase() + s.slice(1); }
function roomKeyOf(name: string): "r2" | "r3" | "r4" | null {
  const m = /(\d+)/.exec(name);
  if (!m) return null;
  return m[1] === "2" ? "r2" : m[1] === "3" ? "r3" : m[1] === "4" ? "r4" : null;
}
function roomCratesForRow(name: string, e: EggRow): number | null {
  const k = roomKeyOf(name);
  if (!k) return null;
  return (e as unknown as Record<string, number>)[k] ?? 0;
}
function friendlyRoom(name: string): string {
  return name.replace(/\s+/g, " ").trim().replace(/^ROOM\s*/i, "Room ");
}

// ---------------------------------------------------------------------------
// 1) Farm intelligence context
// ---------------------------------------------------------------------------

export type FarmIntelligenceContext = {
  activeBirds: number;
  activeRooms: { name: string; current: number }[];

  latestProduction: null | {
    date: string;
    totalEggs: number;
    crates: number;
    extra: number;
    layRatePct: number | null;
  };
  productionSevenDayAvgEggs: number | null;
  productionPrevSevenDayAvgEggs: number | null;
  productionTrendPct: number | null;         // positive = producing more
  productionRecords: number;

  latestFeedDate: string | null;
  feedSevenDayAvgBags: number | null;
  feedPrevSevenDayAvgBags: number | null;
  feedChangePct: number | null;
  feedPerBirdPerDay: number | null;

  recentMortality14dTotal: number;
  recentMortality14dTrendPct: number | null; // vs previous 14d
  leadingMortalityCause: string | null;
  mortalityByRoom14d: Record<string, number>;

  recentHealth14d: Array<{ type: string; name: string; date: string; scope: string }>;

  currentEggPricePerCrate: number | null;
  currentFeedPricePerBag: number | null;
  weeklyRevenueNaira: number | null;
  weeklyFeedCostNaira: number | null;
  weeklyProfitNaira: number | null;

  // Existing intelligence module outputs (structured)
  declineEvents: DeclineEvent[];
  mortalityEvents: MortalityEvent[];

  // Unified outputs from every PoultryPro intelligence module.
  // Farm Insights consumes these directly and does not recompute them.
  productionForecast: null | {
    currentProduction: number;      // latest total eggs
    forecastAverage: number;        // avg forecast eggs/day (7d)
    expectedLow: number;
    expectedHigh: number;
    forecastDirection: ForecastResult["direction"];
    productionRate: number;         // % lay rate
  };
  productionDecline: null | {
    status: "Detected" | "None";
    declinePercentage: number | null;
    affectedRoom: string | null;
    comparisonPeriod: string | null;
    recordCount: number;
  };
  mortalityRisk: null | {
    riskLevel: MortalityAnalysis["levelLabel"];
    riskScore: number;
    mortalityThisMonth: number;
    mostAffectedRoom: string | null;
    recentPattern: MortalityAnalysis["patternLabel"];
  };
  feedEfficiency: null | {
    efficiencyStatus: FeedEffAnalysis["status"];
    movementScore: number;
    feedPerEgg: number | null;      // grams per egg, if bag weight configured
    feedPerBird: number | null;     // grams per bird (latest), if bag weight configured
    feedMovement: number;           // % change in feed usage
    productionMovement: number;     // % change in production
    roomVariation: number;          // % variation across rooms
    latestMatchedDate: string | null;
  };
  abnormalActivity: null | {
    activityStatus: AbnormalAnalysis["level"];
    activityScore: number;
    signalsAnalysed: string[];
    mostAffectedRoom: string | null;
    strongestSignal: string | null;
    roomLevelSignals: Array<{ room: string; level: AbnormalAnalysis["level"]; score: number; triggered: string[] }>;
  };
};

export function buildFarmIntelligenceContext(input: {
  eggs: EggRow[];
  rooms: Room[];
  mortality: Mortality[];
  feed: Feed[];
  health: Health[];
  prices: Price[];
  bagWeightKg?: number | null;
}): FarmIntelligenceContext {
  const { eggs, rooms, mortality, feed, health, prices } = input;
  const activeBirds = rooms.reduce((s, r) => s + Math.max(0, r.current), 0);
  const activeRooms = rooms.map(r => ({ name: r.name, current: r.current }));

  const eggsSorted = sortNewestFirst(eggs);
  const latest = eggsSorted[0] ?? null;
  const latestNorm = latest ? normaliseEggRow(latest) : null;

  const layRatePct =
    latest && activeBirds > 0 && latestNorm
      ? (latestNorm.totalEggs / activeBirds) * 100
      : null;

  const recent7 = eggsSorted.slice(0, 7);
  const prev7 = eggsSorted.slice(7, 14);
  const avg = (rows: EggRow[]) =>
    rows.length ? rows.reduce((s, r) => s + totalEggsFromRow(r), 0) / rows.length : null;

  const prodAvg7 = avg(recent7);
  const prodAvgPrev7 = avg(prev7);
  const productionTrendPct =
    prodAvg7 !== null && prodAvgPrev7 !== null && prodAvgPrev7 > 0
      ? ((prodAvg7 - prodAvgPrev7) / prodAvgPrev7) * 100
      : null;

  const feedSorted = sortNewestFirst(feed);
  const latestFeedDate = feedSorted[0]?.date ?? null;
  const recent7Dates = new Set(recent7.map(e => e.date));
  const prev7Dates = new Set(prev7.map(e => e.date));
  const bagsIn = (dates: Set<string>) =>
    feed.filter(f => dates.has(f.date)).reduce((s, f) => s + Number(f.bags || 0), 0);
  const feedRecent = recent7Dates.size ? bagsIn(recent7Dates) : null;
  const feedPrev = prev7Dates.size ? bagsIn(prev7Dates) : null;
  const feedSevenDayAvgBags = feedRecent !== null && recent7Dates.size ? feedRecent / recent7Dates.size : null;
  const feedPrevSevenDayAvgBags = feedPrev !== null && prev7Dates.size ? feedPrev / prev7Dates.size : null;
  const feedChangePct =
    feedRecent !== null && feedPrev !== null && feedPrev > 0
      ? ((feedRecent - feedPrev) / feedPrev) * 100
      : null;
  const feedPerBirdPerDay =
    feedSevenDayAvgBags !== null && activeBirds > 0
      ? feedSevenDayAvgBags / activeBirds
      : null;

  const today = new Date();
  const cutoff14 = new Date(today.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
  const cutoff28 = new Date(today.getTime() - 28 * 86_400_000).toISOString().slice(0, 10);
  const recentMort = mortality.filter(m => m.date >= cutoff14);
  const prevMort = mortality.filter(m => m.date >= cutoff28 && m.date < cutoff14);
  const recentMortality14dTotal = recentMort.reduce((s, m) => s + Math.abs(m.loss), 0);
  const prevMortTotal = prevMort.reduce((s, m) => s + Math.abs(m.loss), 0);
  const recentMortality14dTrendPct =
    prevMortTotal > 0 ? ((recentMortality14dTotal - prevMortTotal) / prevMortTotal) * 100 : null;

  const mortalityByRoom14d: Record<string, number> = {};
  for (const m of recentMort) {
    mortalityByRoom14d[m.room] = (mortalityByRoom14d[m.room] ?? 0) + Math.abs(m.loss);
  }
  const causeMap: Record<string, number> = {};
  for (const m of recentMort) causeMap[m.cause] = (causeMap[m.cause] ?? 0) + Math.abs(m.loss);
  const leadingMortalityCause =
    Object.entries(causeMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const recentHealth14d = health
    .filter(h => h.date >= cutoff14)
    .slice(0, 20)
    .map(h => ({ type: h.type, name: h.name, date: h.date, scope: h.scope }));

  const eggPrice = prices.find(p => /egg/i.test(p.item))?.price ?? null;
  const feedPrice = prices.find(p => /feed/i.test(p.item))?.price ?? null;
  const cratesRecent = recent7.reduce((s, e) => s + totalEggsFromRow(e) / CRATE, 0);
  const weeklyRevenueNaira = eggPrice && cratesRecent > 0 ? Math.round(cratesRecent * eggPrice) : null;
  const weeklyFeedCostNaira = feedPrice && feedRecent !== null && feedRecent > 0 ? Math.round(feedRecent * feedPrice) : null;
  const weeklyProfitNaira =
    weeklyRevenueNaira !== null && weeklyFeedCostNaira !== null
      ? weeklyRevenueNaira - weeklyFeedCostNaira
      : null;

  const decline = detectProductionDecline({ eggs, rooms, mortality, feed, health });
  const mort = detectMortalityPatterns({ eggs, rooms, mortality, feed, health });

  // Consume outputs from every existing PoultryPro intelligence module.
  const bagWeightKg = input.bagWeightKg ?? null;
  const forecast = computeForecast(eggs, activeBirds);
  const mortalityRisk = computeMortalityRisk(rooms, mortality, eggs, health);
  const feedEff = computeFeedEfficiency(rooms, feed, eggs, mortality, health, bagWeightKg);
  const abnormal = computeAbnormalActivity(rooms, eggs, feed, mortality, health, bagWeightKg);

  const declineFarmEv = decline.events.find(e => e.scope === "Farm") ?? null;
  const declineRoomEv = decline.events.find(e => e.scope === "Room") ?? null;
  const declineTop = declineFarmEv ?? declineRoomEv;

  const productionForecast: FarmIntelligenceContext["productionForecast"] = forecast
    ? {
        currentProduction: forecast.latestTotal,
        forecastAverage: forecast.avgForecast,
        expectedLow: forecast.low,
        expectedHigh: forecast.high,
        forecastDirection: forecast.direction,
        productionRate: forecast.latestPct,
      }
    : null;

  const productionDecline: FarmIntelligenceContext["productionDecline"] = declineTop
    ? {
        status: "Detected",
        declinePercentage: round1(declineTop.changePct),
        affectedRoom: declineTop.scope === "Room" ? declineTop.scopeLabel : null,
        comparisonPeriod: declineTop.firstDeclineDate ?? declineTop.latestDate ?? null,
        recordCount: eggs.length,
      }
    : { status: "None", declinePercentage: null, affectedRoom: null, comparisonPeriod: null, recordCount: eggs.length };

  const mortalityRiskCtx: FarmIntelligenceContext["mortalityRisk"] = mortalityRisk
    ? {
        riskLevel: mortalityRisk.levelLabel,
        riskScore: mortalityRisk.score,
        mortalityThisMonth: mortalityRisk.monthlyMortality,
        mostAffectedRoom: mortalityRisk.mostAffectedRoom?.name ?? null,
        recentPattern: mortalityRisk.patternLabel,
      }
    : null;

  const feedEfficiency: FarmIntelligenceContext["feedEfficiency"] = feedEff
    ? {
        efficiencyStatus: feedEff.status,
        movementScore: feedEff.score,
        feedPerEgg: feedEff.latest.feedPerEggG ?? null,
        feedPerBird: null,
        feedMovement: Number.isFinite(feedEff.movements.feedPct) ? round1(feedEff.movements.feedPct) : 0,
        productionMovement: Number.isFinite(feedEff.movements.productionPct) ? round1(feedEff.movements.productionPct) : 0,
        roomVariation: round1(feedEff.movements.roomVariationPct),
        latestMatchedDate: feedEff.latestLabel,
      }
    : null;

  const abnormalActivity: FarmIntelligenceContext["abnormalActivity"] = abnormal
    ? {
        activityStatus: abnormal.level,
        activityScore: abnormal.score,
        signalsAnalysed: abnormal.signalsAnalysed,
        mostAffectedRoom: abnormal.mostAffected?.name ?? null,
        strongestSignal: abnormal.mostAffected && abnormal.mostAffected.triggered.length
          ? abnormal.mostAffected.triggered[0]
          : null,
        roomLevelSignals: abnormal.rooms.map(r => ({
          room: r.name,
          level: r.level,
          score: r.score,
          triggered: r.triggered.map(String),
        })),
      }
    : null;

  return {
    activeBirds,
    activeRooms,
    latestProduction: latest && latestNorm
      ? {
          date: latest.date,
          totalEggs: latestNorm.totalEggs,
          crates: latestNorm.crates,
          extra: latestNorm.extra,
          layRatePct,
        }
      : null,
    productionSevenDayAvgEggs: prodAvg7,
    productionPrevSevenDayAvgEggs: prodAvgPrev7,
    productionTrendPct,
    productionRecords: eggs.length,
    latestFeedDate,
    feedSevenDayAvgBags,
    feedPrevSevenDayAvgBags,
    feedChangePct,
    feedPerBirdPerDay,
    recentMortality14dTotal,
    recentMortality14dTrendPct,
    leadingMortalityCause,
    mortalityByRoom14d,
    recentHealth14d,
    currentEggPricePerCrate: eggPrice,
    currentFeedPricePerBag: feedPrice,
    weeklyRevenueNaira,
    weeklyFeedCostNaira,
    weeklyProfitNaira,
    declineEvents: decline.events,
    mortalityEvents: mort.events,
    productionForecast,
    productionDecline,
    mortalityRisk: mortalityRiskCtx,
    feedEfficiency,
    abnormalActivity,
  };
}

// ---------------------------------------------------------------------------
// 2) Pattern detection (cross-module)
// ---------------------------------------------------------------------------

export type DetectedFarmPattern =
  | {
      kind: "production-decline-farm";
      priority: InsightPriority;
      changePct: number;             // % below usual (positive)
      currentPct: number;
      baselinePct: number;
      ev: DeclineEvent;
    }
  | {
      kind: "production-decline-room";
      priority: InsightPriority;
      room: string;
      changePct: number;
      currentPct: number;
      baselinePct: number;
      ev: DeclineEvent;
    }
  | {
      kind: "prod-decline-and-mortality";
      priority: InsightPriority;
      prodChangePct: number;
      mortTrendPct: number | null;
      mortTotal: number;
    }
  | {
      kind: "prod-decline-and-feed-change";
      priority: InsightPriority;
      prodChangePct: number;
      feedChangePct: number;
      feedRecent: number;
      feedPrev: number;
    }
  | {
      kind: "prod-decline-after-health";
      priority: InsightPriority;
      prodChangePct: number;
      healthEvent: { type: string; name: string; date: string };
      daysBetween: number;
    }
  | {
      kind: "feed-rising-prod-flat";
      priority: InsightPriority;
      feedChangePct: number;
      prodChangePct: number;
      feedRecent: number;
      feedPrev: number;
    }
  | {
      kind: "mortality-concentrated-room";
      priority: InsightPriority;
      room: string;
      losses: number;
      totalLosses: number;
      sharePct: number;
    }
  | {
      kind: "financial-margin-thin";
      priority: InsightPriority;
      feedCostPerCrate: number;
      eggPrice: number;
      cratesRecent: number;
      feedRecent: number;
      feedPrice: number;
    }
  | {
      kind: "stable";
      priority: "Looking good";
      whatWasChecked: string[];
    };

export function detectFarmPatterns(ctx: FarmIntelligenceContext): DetectedFarmPattern[] {
  const patterns: DetectedFarmPattern[] = [];

  const declineFarm = ctx.declineEvents.find(e => e.scope === "Farm");
  const declineRooms = ctx.declineEvents.filter(e => e.scope === "Room");
  const prodChangePct = declineFarm ? declineFarm.changePct : 0;

  // Farm-level production decline
  if (declineFarm) {
    patterns.push({
      kind: "production-decline-farm",
      priority: declineFarm.risk === "High" ? "Attention" : "Watch",
      changePct: declineFarm.changePct,
      currentPct: declineFarm.currentPct,
      baselinePct: declineFarm.baselinePct,
      ev: declineFarm,
    });
  }

  // Room-level production decline (rule F)
  for (const ev of declineRooms) {
    patterns.push({
      kind: "production-decline-room",
      priority: ev.risk === "High" ? "Attention" : "Watch",
      room: ev.scopeLabel,
      changePct: ev.changePct,
      currentPct: ev.currentPct,
      baselinePct: ev.baselinePct,
      ev,
    });
  }

  // Rule B: production decline + mortality increase → HIGH PRIORITY
  if (
    declineFarm &&
    ctx.recentMortality14dTotal > 0 &&
    (ctx.recentMortality14dTrendPct === null || ctx.recentMortality14dTrendPct >= 25)
  ) {
    // require a real mortality signal (either up-trend OR high raw loss vs flock)
    const flockLossPct = ctx.activeBirds > 0 ? (ctx.recentMortality14dTotal / ctx.activeBirds) * 100 : 0;
    if ((ctx.recentMortality14dTrendPct ?? 0) >= 25 || flockLossPct >= 1) {
      patterns.push({
        kind: "prod-decline-and-mortality",
        priority: "High priority",
        prodChangePct,
        mortTrendPct: ctx.recentMortality14dTrendPct,
        mortTotal: ctx.recentMortality14dTotal,
      });
    }
  }

  // Rule A: production decline + feed change (either direction, ≥5%)
  if (
    declineFarm &&
    ctx.feedChangePct !== null &&
    ctx.feedSevenDayAvgBags !== null &&
    ctx.feedPrevSevenDayAvgBags !== null &&
    Math.abs(ctx.feedChangePct) >= 5
  ) {
    patterns.push({
      kind: "prod-decline-and-feed-change",
      priority: "Attention",
      prodChangePct,
      feedChangePct: ctx.feedChangePct,
      feedRecent: ctx.feedSevenDayAvgBags * 7,
      feedPrev: ctx.feedPrevSevenDayAvgBags * 7,
    });
  }

  // Rule C: production decline shortly after a recorded health event (≤10 days)
  if (declineFarm && ctx.recentHealth14d.length > 0) {
    const declineDate = declineFarm.firstDeclineDate || declineFarm.latestDate;
    const candidate = ctx.recentHealth14d
      .filter(h => h.date <= declineDate)
      .map(h => ({ h, gap: daysBetweenIso(declineDate, h.date) }))
      .filter(x => x.gap >= 0 && x.gap <= 10)
      .sort((a, b) => a.gap - b.gap)[0];
    if (candidate) {
      patterns.push({
        kind: "prod-decline-after-health",
        priority: "Attention",
        prodChangePct,
        healthEvent: { type: candidate.h.type, name: candidate.h.name, date: candidate.h.date },
        daysBetween: candidate.gap,
      });
    }
  }

  // Rule D: feed usage rising while production stays flat/declining
  if (
    ctx.feedChangePct !== null &&
    ctx.feedChangePct >= 10 &&
    ctx.productionTrendPct !== null &&
    ctx.productionTrendPct <= 3 &&
    ctx.feedSevenDayAvgBags !== null &&
    ctx.feedPrevSevenDayAvgBags !== null
  ) {
    patterns.push({
      kind: "feed-rising-prod-flat",
      priority: "Attention",
      feedChangePct: ctx.feedChangePct,
      prodChangePct: -ctx.productionTrendPct, // display as "drop"
      feedRecent: ctx.feedSevenDayAvgBags * 7,
      feedPrev: ctx.feedPrevSevenDayAvgBags * 7,
    });
  }

  // Rule E: mortality concentrated in one room (≥50% of 14-day losses, ≥3 birds)
  if (ctx.recentMortality14dTotal >= 3) {
    const entries = Object.entries(ctx.mortalityByRoom14d).sort((a, b) => b[1] - a[1]);
    const [topRoom, losses] = entries[0] ?? ["", 0];
    if (topRoom) {
      const share = (losses / ctx.recentMortality14dTotal) * 100;
      if (share >= 50 && entries.length >= 1) {
        patterns.push({
          kind: "mortality-concentrated-room",
          priority: share >= 75 ? "Attention" : "Watch",
          room: topRoom,
          losses,
          totalLosses: ctx.recentMortality14dTotal,
          sharePct: share,
        });
      }
    }
  }

  // Financial performance — surface only when margin per crate is thin.
  if (
    ctx.currentEggPricePerCrate &&
    ctx.currentFeedPricePerBag &&
    ctx.feedSevenDayAvgBags !== null &&
    ctx.feedSevenDayAvgBags > 0 &&
    ctx.productionSevenDayAvgEggs !== null &&
    ctx.productionSevenDayAvgEggs > 0
  ) {
    const cratesRecent = (ctx.productionSevenDayAvgEggs * 7) / CRATE;
    const feedRecent = ctx.feedSevenDayAvgBags * 7;
    if (cratesRecent > 0 && feedRecent > 0) {
      const feedCostPerCrate = (feedRecent * ctx.currentFeedPricePerBag) / cratesRecent;
      const margin = ctx.currentEggPricePerCrate - feedCostPerCrate;
      if (margin < ctx.currentEggPricePerCrate * 0.2) {
        patterns.push({
          kind: "financial-margin-thin",
          priority: margin <= 0 ? "Attention" : "Watch",
          feedCostPerCrate,
          eggPrice: ctx.currentEggPricePerCrate,
          cratesRecent,
          feedRecent,
          feedPrice: ctx.currentFeedPricePerBag,
        });
      }
    }
  }

  // Rule G: stable farm — only when nothing else fired.
  if (patterns.length === 0) {
    const checked: string[] = [];
    if (ctx.productionSevenDayAvgEggs !== null) checked.push("egg production");
    if (ctx.feedSevenDayAvgBags !== null) checked.push("feed usage");
    if (ctx.recentMortality14dTotal >= 0) checked.push("bird losses");
    patterns.push({
      kind: "stable",
      priority: "Looking good",
      whatWasChecked: checked,
    });
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// 3) Map patterns → farmer-friendly insights, dedupe, rank, cap
// ---------------------------------------------------------------------------

const PRIORITY_WEIGHT: Record<InsightPriority, number> = {
  "High priority": 100,
  "Attention": 80,
  "Watch": 60,
  "Looking good": 20,
};

function pctText(n: number): string {
  const abs = Math.abs(n);
  return `${round1(abs)}%`;
}
function nairaText(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function patternToInsight(p: DetectedFarmPattern, ctx: FarmIntelligenceContext): FarmInsight | null {
  switch (p.kind) {
    case "production-decline-farm": {
      const cur = round1(p.currentPct);
      const base = round1(p.baselinePct);
      return {
        id: "prod-farm",
        status: p.priority,
        category: "Production",
        priority: PRIORITY_WEIGHT[p.priority] + Math.min(15, Math.round(p.changePct)),
        title: "Egg production is falling",
        whatWeFound: `Your farm's egg production has dropped to about ${cur}%, below the recent pattern of ${base}%.`,
        whyItMatters: "If this continues, weekly crate output and revenue will drop.",
        whatToCheck: (p.ev.whatToCheck.length ? p.ev.whatToCheck : [
          "Check water supply and feed access in each room.",
          "Review yesterday's egg count for miscounts.",
          "Watch for weak or unwell birds.",
        ]).slice(0, 4),
        evidence: [
          `Today's lay rate: ${cur}%`,
          `Recent usual: ${base}%`,
          `Change: -${pctText(p.changePct)}`,
          `Based on ${ctx.productionRecords} production record${ctx.productionRecords === 1 ? "" : "s"}`,
        ],
        scopeLabel: "Whole farm",
      };
    }

    case "production-decline-room": {
      const cur = round1(p.currentPct);
      const base = round1(p.baselinePct);
      return {
        id: `prod-room-${p.room}`,
        status: p.priority,
        category: "Room Performance",
        priority: PRIORITY_WEIGHT[p.priority] + 5,
        title: `${friendlyRoom(p.room)} is producing below its recent pattern`,
        whatWeFound: `${friendlyRoom(p.room)} is declining faster than the whole-farm trend.`,
        whyItMatters: "One room dropping can be an early sign of a room-specific issue.",
        whatToCheck: [
          `Compare feed allocation for ${friendlyRoom(p.room)} against other rooms.`,
          `Review recent mortality records for ${friendlyRoom(p.room)}.`,
          `Review recent health records for ${friendlyRoom(p.room)}.`,
          `Confirm the active bird count for ${friendlyRoom(p.room)}.`,
        ],
        evidence: [
          `Current production: ${cur}%`,
          `Recent room average: ${base}%`,
          `Change: -${pctText(p.changePct)}`,
        ],
        scopeLabel: friendlyRoom(p.room),
      };
    }

    case "prod-decline-and-mortality": {
      return {
        id: "prod-mortality",
        status: p.priority,
        category: "Whole Farm",
        priority: PRIORITY_WEIGHT[p.priority] + 10,
        title: "Egg production is falling while bird losses are rising",
        whatWeFound: `Egg production has dropped by about ${pctText(p.prodChangePct)} while ${p.mortTotal} bird${p.mortTotal === 1 ? "" : "s"} were recorded lost in the last 14 days.`,
        whyItMatters: "These two changes together deserve close review.",
        whatToCheck: [
          "Review the affected rooms and compare mortality causes.",
          "Review recent health records around this period.",
          "Watch water, feed and any environmental changes.",
          "Consider a professional veterinary assessment if the pattern continues.",
        ],
        evidence: [
          `Production change: -${pctText(p.prodChangePct)}`,
          `Recent bird losses (14 days): ${p.mortTotal}`,
          p.mortTrendPct !== null ? `Mortality trend: ${p.mortTrendPct >= 0 ? "+" : ""}${pctText(p.mortTrendPct)} vs previous 14 days` : `Mortality trend: not enough previous data to compare`,
        ],
        scopeLabel: "Whole farm",
      };
    }

    case "prod-decline-and-feed-change": {
      const up = p.feedChangePct >= 0;
      return {
        id: "prod-feed",
        status: p.priority,
        category: "Feed",
        priority: PRIORITY_WEIGHT[p.priority] + 8,
        title: up
          ? "Feed use changed while production is falling"
          : "Feed use dropped while production is falling",
        whatWeFound: `Production declined by about ${pctText(p.prodChangePct)} while feed use ${up ? "rose" : "fell"} by about ${pctText(p.feedChangePct)} in the same period.`,
        whyItMatters: "Production and feed patterns changed together — worth understanding why.",
        whatToCheck: [
          "Confirm the feed quantity actually issued to each room.",
          "Check whether feed formulation or supplier changed.",
          "Confirm birds are accessing feed and water normally.",
          "Review recent health observations.",
        ],
        evidence: [
          `Feed last 7 days: ${round1(p.feedRecent)} bags`,
          `Previous 7 days: ${round1(p.feedPrev)} bags`,
          `Feed change: ${up ? "+" : "-"}${pctText(p.feedChangePct)}`,
          `Production change: -${pctText(p.prodChangePct)}`,
        ],
        scopeLabel: "Whole farm",
      };
    }

    case "prod-decline-after-health": {
      return {
        id: "prod-health",
        status: p.priority,
        category: "Health",
        priority: PRIORITY_WEIGHT[p.priority] + 6,
        title: "Production changed after a recent health record",
        whatWeFound: `Egg production dropped ${p.daysBetween === 0 ? "on the same day" : `${p.daysBetween} day${p.daysBetween === 1 ? "" : "s"} after`} a recorded ${p.healthEvent.type.toLowerCase()} (${p.healthEvent.name}). This timing may be worth reviewing.`,
        whyItMatters: "Some vaccines or treatments briefly affect lay rate. Confirm the birds recover on schedule.",
        whatToCheck: [
          `Review the ${p.healthEvent.type.toLowerCase()} record (${p.healthEvent.name}).`,
          "Watch daily production over the next 3–5 days.",
          "Note any unusual bird behaviour, appetite change or stress.",
        ],
        evidence: [
          `Health record: ${p.healthEvent.type} — ${p.healthEvent.name}`,
          `Recorded on: ${p.healthEvent.date}`,
          `Production change: -${pctText(p.prodChangePct)}`,
        ],
        scopeLabel: "Whole farm",
      };
    }

    case "feed-rising-prod-flat": {
      return {
        id: "feed-rising",
        status: p.priority,
        category: "Feed",
        priority: PRIORITY_WEIGHT[p.priority] + 4,
        title: "Feed use changed while production remained flat",
        whatWeFound: `Feed use rose by about ${pctText(p.feedChangePct)} while egg output stayed close to its recent average.`,
        whyItMatters: "Extra feed with no extra eggs raises your cost per crate.",
        whatToCheck: [
          "Check feed wastage in the pens and feeders.",
          "Confirm room-level feed allocation.",
          "Confirm current bird count matches records.",
          "Compare feed use across rooms.",
        ],
        evidence: [
          `Feed last 7 days: ${round1(p.feedRecent)} bags`,
          `Previous 7 days: ${round1(p.feedPrev)} bags`,
          `Feed change: +${pctText(p.feedChangePct)}`,
          `Production change: ${p.prodChangePct >= 0 ? "-" : "+"}${pctText(p.prodChangePct)}`,
        ],
        scopeLabel: "Whole farm",
      };
    }

    case "mortality-concentrated-room": {
      return {
        id: `mort-room-${p.room}`,
        status: p.priority,
        category: "Mortality",
        priority: PRIORITY_WEIGHT[p.priority] + 6,
        title: `Most recent bird losses are coming from ${friendlyRoom(p.room)}`,
        whatWeFound: `${p.losses} of the last ${p.totalLosses} recorded bird losses (${round1(p.sharePct)}%) were in ${friendlyRoom(p.room)}.`,
        whyItMatters: "Losses concentrated in one room usually point to something room-specific.",
        whatToCheck: [
          `Review room-specific health observations for ${friendlyRoom(p.room)}.`,
          `Check feed and water access in ${friendlyRoom(p.room)}.`,
          "Review environmental conditions (heat, draft, litter) if recorded.",
          `Compare ${friendlyRoom(p.room)}'s production trend with other rooms.`,
        ],
        evidence: [
          `Room: ${friendlyRoom(p.room)}`,
          `Losses in room: ${p.losses}`,
          `Share of recent mortality: ${round1(p.sharePct)}%`,
          `Analysis period: last 14 days`,
        ],
        scopeLabel: friendlyRoom(p.room),
      };
    }

    case "financial-margin-thin": {
      const margin = p.eggPrice - p.feedCostPerCrate;
      return {
        id: "financial-margin",
        status: p.priority,
        category: "Financial Performance",
        priority: PRIORITY_WEIGHT[p.priority],
        title: margin <= 0
          ? "Feed cost is higher than egg income"
          : "Feed cost is eating most of your egg income",
        whatWeFound: `In the last week, each crate costs about ${nairaText(p.feedCostPerCrate)} in feed while selling for about ${nairaText(p.eggPrice)}.`,
        whyItMatters: "Profit per crate is thin — small changes in price or wastage make a big difference.",
        whatToCheck: [
          "Check that the egg selling price is up to date.",
          "Check whether feed price or feed usage has increased.",
          "Look for feed wastage in the pens.",
        ],
        evidence: [
          `Crates last 7 days: ${round1(p.cratesRecent)}`,
          `Feed used: ${round1(p.feedRecent)} bag${p.feedRecent === 1 ? "" : "s"} at ${nairaText(p.feedPrice)}/bag`,
          `Egg selling price: ${nairaText(p.eggPrice)} per crate`,
          `Feed cost per crate: ${nairaText(p.feedCostPerCrate)}`,
        ],
        scopeLabel: "Whole farm",
      };
    }

    case "stable": {
      const checked = p.whatWasChecked.length ? p.whatWasChecked.join(", ") : "your recent records";
      return {
        id: "stable-farm",
        status: "Looking good",
        category: "Whole Farm",
        priority: PRIORITY_WEIGHT["Looking good"],
        title: "Your farm looks stable today",
        whatWeFound: `PoultryPro checked ${checked} and found no unusual pattern.`,
        whyItMatters: "Steady patterns usually mean the flock is comfortable and routines are working.",
        whatToCheck: [
          "Continue recording production, feed and mortality every day.",
          "Watch for any sustained change over 3–5 days.",
        ],
        evidence: buildStableEvidence(ctx),
        scopeLabel: "Whole farm",
      };
    }
  }
}

function buildStableEvidence(ctx: FarmIntelligenceContext): string[] {
  const ev: string[] = [];
  if (ctx.latestProduction?.layRatePct != null) ev.push(`Today's lay rate: ${round1(ctx.latestProduction.layRatePct)}%`);
  if (ctx.productionSevenDayAvgEggs != null) ev.push(`7-day production average: ${Math.round(ctx.productionSevenDayAvgEggs)} eggs/day`);
  if (ctx.feedSevenDayAvgBags != null) ev.push(`7-day feed average: ${round1(ctx.feedSevenDayAvgBags)} bags/day`);
  ev.push(`Bird losses (14 days): ${ctx.recentMortality14dTotal}`);
  ev.push(`Based on ${ctx.productionRecords} production record${ctx.productionRecords === 1 ? "" : "s"}`);
  return ev;
}

// De-duplicate overlapping production signals so the farmer never sees the
// same underlying story as separate cards.
function dedupeProductionInsights(list: FarmInsight[]): FarmInsight[] {
  const hasCombined = list.some(i => i.id === "prod-mortality" || i.id === "prod-feed" || i.id === "prod-health");
  if (!hasCombined) return list;
  // If a combined production insight exists, drop the standalone farm-level
  // production decline card (room-level ones stay because they add new info).
  return list.filter(i => i.id !== "prod-farm");
}

export function rankFarmInsights(
  patterns: DetectedFarmPattern[],
  ctx: FarmIntelligenceContext,
): FarmInsight[] {
  const insights: FarmInsight[] = [];
  const seen = new Set<string>();
  for (const p of patterns) {
    const ins = patternToInsight(p, ctx);
    if (!ins) continue;
    if (seen.has(ins.id)) continue;
    seen.add(ins.id);
    insights.push(ins);
  }
  const deduped = dedupeProductionInsights(insights);
  deduped.sort((a, b) => {
    const pa = PRIORITY_WEIGHT[a.status];
    const pb = PRIORITY_WEIGHT[b.status];
    if (pb !== pa) return pb - pa;
    return b.priority - a.priority;
  });
  return deduped.slice(0, 5);
}

// ---------------------------------------------------------------------------
// 4) Daily briefing (max 2 sentences), built from top insights
// ---------------------------------------------------------------------------

function briefingFromInsights(insights: FarmInsight[]): string {
  if (insights.length === 0) {
    return "Your farm is generally stable today. Keep recording production, feed and bird losses each day so PoultryPro can catch changes earlier.";
  }
  const top = insights[0];
  const second = insights[1];

  if (top.status === "Looking good") {
    return "Your farm is generally stable today. Egg production, feed and bird losses remain close to their recent pattern.";
  }

  const firstSentence = `${top.title}. ${top.whatWeFound}`;
  if (second && (second.status === "High priority" || second.status === "Attention")) {
    return `${firstSentence} ${second.title.replace(/\.$/, "")} — worth reviewing too.`;
  }
  if (second && second.status === "Watch") {
    return `${firstSentence} Also worth watching: ${lower(second.title)}.`;
  }
  return firstSentence;
}

// ---------------------------------------------------------------------------
// 5) Entry point
// ---------------------------------------------------------------------------

export function buildFarmInsights(input: {
  eggs: EggRow[];
  rooms: Room[];
  mortality: Mortality[];
  feed: Feed[];
  health: Health[];
  prices: Price[];
}): FarmInsightsReport {
  const context = buildFarmIntelligenceContext(input);

  // Data-sufficiency check: without any production or mortality records the
  // engine has nothing meaningful to summarise.
  if (input.eggs.length < 3 && input.mortality.length === 0) {
    return {
      ready: false,
      briefing: "",
      insights: [],
      totalEggRecords: input.eggs.length,
      message:
        "PoultryPro needs more daily records before it can summarise your farm. Keep recording production, feed and bird losses.",
      context,
      patterns: [],
    };
  }

  const patterns = detectFarmPatterns(context);
  const insights = rankFarmInsights(patterns, context);

  return {
    ready: true,
    briefing: briefingFromInsights(insights),
    insights,
    totalEggRecords: input.eggs.length,
    context,
    patterns,
  };
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

export function insightStatusStyle(s: InsightStatus): { badge: string; ring: string; dot: string } {
  if (s === "High priority") return { badge: "bg-red-600 text-white", ring: "border-red-500/40", dot: "bg-red-500" };
  if (s === "Attention")     return { badge: "bg-orange-500 text-white", ring: "border-orange-400/40", dot: "bg-orange-500" };
  if (s === "Watch")         return { badge: "bg-amber-500 text-white", ring: "border-amber-400/40", dot: "bg-amber-500" };
  return { badge: "bg-[color:var(--forest)] text-white", ring: "border-[color:var(--forest)]/30", dot: "bg-[color:var(--forest)]" };
}
