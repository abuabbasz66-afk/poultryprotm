import type { EggRow, Room, Mortality, Feed, Health, Price } from "@/lib/farm-data";
import { detectProductionDecline, type DeclineEvent } from "@/lib/production-decline";
import { detectMortalityPatterns, type MortalityEvent } from "@/lib/mortality-pattern";

// AI-Supported Farm Insights
// -------------------------------------------------------------
// This module does NOT run another detection engine. It reads the
// results of the existing PoultryPro intelligence modules (production
// decline + mortality pattern) together with the farm's own raw
// records and turns them into a small, farmer-friendly summary.
// -------------------------------------------------------------

export type InsightStatus = "Needs attention" | "Keep watching" | "Looking good";
export type InsightCategory =
  | "mortality"
  | "production"
  | "activity"
  | "feed"
  | "health"
  | "forecast"
  | "profit"
  | "positive";

export type FarmInsight = {
  id: string;
  status: InsightStatus;
  category: InsightCategory;
  priority: number;                 // internal only, higher = more important
  title: string;                    // simple farmer language
  whatWeFound: string;              // one plain-English sentence
  whyItMatters: string;             // one short sentence
  whatToCheck: string[];            // up to 3 practical checks
  evidence: string[];               // simple bullet lines for "Why am I seeing this?"
  scopeLabel?: string;              // "Room 3" | "Whole farm"
};

export type FarmInsightsReport = {
  ready: boolean;
  briefing: string;
  insights: FarmInsight[];          // already prioritised, max 3
  message?: string;                 // shown when ready === false
  totalEggRecords: number;
};

const CRATE = 30;

function farmEggsTotal(e: EggRow): number {
  return (e.r2 + e.r3 + e.r4) * CRATE + e.extra;
}
function sortNewestFirst<T extends { date: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
}
function round1(n: number): number { return Math.round(n * 10) / 10; }

function statusFromRisk(r: "Low" | "Medium" | "High"): InsightStatus {
  if (r === "High") return "Needs attention";
  if (r === "Medium") return "Needs attention";
  return "Keep watching";
}
function statusFromSeverity(s: "Monitoring" | "Watch" | "Warning" | "Critical"): InsightStatus {
  if (s === "Critical" || s === "Warning") return "Needs attention";
  if (s === "Watch") return "Keep watching";
  return "Keep watching";
}

function scopeLabel(scope: "Farm" | "Room", label: string): string {
  return scope === "Farm" ? "Whole farm" : label;
}

// ---------------- Mortality insight ----------------
function mortalityInsight(ev: MortalityEvent): FarmInsight {
  const isFarm = ev.scope === "Farm";
  const title = isFarm ? "Bird losses are higher" : `${ev.scopeLabel} — more bird losses`;
  const whatWeFound = `In the last ${ev.recentDays} days, ${ev.recentLoss} bird${ev.recentLoss === 1 ? "" : "s"} were recorded lost${isFarm ? "" : ` in ${ev.scopeLabel}`}. That is more than your farm usually records.`;
  const check: string[] = [
    "Check the affected room for sick or weak birds.",
    "Check water and feed supply.",
    ev.signals.some(s => /health|vaccin|medic|observation/i.test(s.label))
      ? "Review the recent health records around this period."
      : "Look for anything unusual (heat, draft, predators, stress).",
  ];
  if (ev.severity === "Critical" || ev.severity === "Warning") {
    check.push("Consider speaking with a poultry health professional.");
  }
  const evidence = [
    `Recent losses (${ev.recentDays} days): ${ev.recentLoss} bird${ev.recentLoss === 1 ? "" : "s"}.`,
    `Usual losses over ${ev.recentDays} days: about ${round1(ev.expectedLoss)}.`,
  ];
  if (ev.clusterDays >= 2) evidence.push(`Losses recorded on ${ev.clusterDays} days in a row.`);
  if (ev.causes.length) evidence.push(`Causes noted: ${ev.causes.join(", ")}.`);

  const priority = ev.severity === "Critical" ? 100 : ev.severity === "Warning" ? 90 : 70;
  return {
    id: `mort-${ev.scope}-${ev.scopeLabel}`,
    status: statusFromSeverity(ev.severity),
    category: "mortality",
    priority,
    title,
    whatWeFound,
    whyItMatters: "Higher bird losses can reduce your farm's production and profit.",
    whatToCheck: check.slice(0, 3),
    evidence,
    scopeLabel: scopeLabel(ev.scope, ev.scopeLabel),
  };
}

// ---------------- Production decline insight ----------------
function productionInsight(ev: DeclineEvent): FarmInsight {
  const isFarm = ev.scope === "Farm";
  const title = isFarm ? "Egg production is dropping" : `${ev.scopeLabel} — egg production is dropping`;
  const whatWeFound = isFarm
    ? `Egg production has been lower than your farm's recent average.`
    : `Egg production in ${ev.scopeLabel} has been lower than its recent average.`;
  const check = ev.whatToCheck.slice(0, 3);
  const evidence = [
    `Current production: ${round1(ev.currentPct)}%.`,
    `Usual production: about ${round1(ev.baselinePct)}%.`,
    `That is about ${round1(Math.max(0, ev.changePct))}% lower than usual.`,
  ];
  const priority = ev.risk === "High" ? 85 : ev.risk === "Medium" ? 75 : 60;
  return {
    id: `prod-${ev.scope}-${ev.scopeLabel}`,
    status: statusFromRisk(ev.risk),
    category: "production",
    priority,
    title,
    whatWeFound,
    whyItMatters: "If this continues, you may produce fewer crates this week.",
    whatToCheck: check,
    evidence,
    scopeLabel: scopeLabel(ev.scope, ev.scopeLabel),
  };
}

// ---------------- Feed vs production combined insight ----------------
type FeedProdSignal = {
  recentFeed: number;
  usualFeed: number;
  feedChangePct: number;    // positive = using more feed
  recentPct: number;
  usualPct: number;
  prodChangePct: number;    // positive = producing less
};
function feedProductionSignal(eggs: EggRow[], feed: Feed[], birds: number): FeedProdSignal | null {
  if (birds <= 0) return null;
  const eSorted = sortNewestFirst(eggs);
  if (eSorted.length < 8) return null;
  const recent7 = eSorted.slice(0, 7);
  const prev7 = eSorted.slice(7, 14);
  if (prev7.length < 3) return null;

  const recentPct = mean(recent7.map(e => (farmEggsTotal(e) / birds) * 100));
  const usualPct = mean(prev7.map(e => (farmEggsTotal(e) / birds) * 100));
  const prodChangePct = usualPct > 0 ? ((usualPct - recentPct) / usualPct) * 100 : 0;

  // Feed: sum bags per day, compare recent 7 days vs previous 7 days
  const dates = eSorted.map(e => e.date);
  const recentDates = new Set(dates.slice(0, 7));
  const prevDates = new Set(dates.slice(7, 14));
  const recentFeed = feed.filter(f => recentDates.has(f.date)).reduce((s, f) => s + f.bags, 0);
  const prevFeed = feed.filter(f => prevDates.has(f.date)).reduce((s, f) => s + f.bags, 0);
  if (prevFeed <= 0) return null;
  const feedChangePct = ((recentFeed - prevFeed) / prevFeed) * 100;

  return {
    recentFeed, usualFeed: prevFeed, feedChangePct,
    recentPct, usualPct, prodChangePct,
  };
}

function feedProductionInsight(sig: FeedProdSignal): FarmInsight | null {
  // Trigger: feed rising OR flat while production dropping meaningfully
  if (sig.prodChangePct < 5) return null;
  if (sig.feedChangePct < -3) return null; // feed also dropped significantly → not this pattern
  return {
    id: "feed-vs-prod",
    status: "Needs attention",
    category: "feed",
    priority: 80,
    title: sig.feedChangePct >= 3
      ? "Feed use is rising while egg production is falling"
      : "The farm is using more feed for the eggs being produced",
    whatWeFound: `In the last week, egg production has been about ${round1(sig.prodChangePct)}% lower than the previous week, while feed use has ${sig.feedChangePct >= 0 ? "stayed the same or increased" : "stayed similar"}.`,
    whyItMatters: "This raises your feed cost per crate and lowers farm profit.",
    whatToCheck: [
      "Check feed wastage in the pens and feeders.",
      "Check water availability and cleanliness.",
      "Check the rooms with the biggest production drop.",
    ],
    evidence: [
      `Feed last week: ${round1(sig.recentFeed)} bags.`,
      `Feed the previous week: ${round1(sig.usualFeed)} bags.`,
      `Production last week: ${round1(sig.recentPct)}% (usual ${round1(sig.usualPct)}%).`,
    ],
    scopeLabel: "Whole farm",
  };
}

// ---------------- Health + mortality cross-signal ----------------
function healthMortalityInsight(mortEvents: MortalityEvent[]): FarmInsight | null {
  const ev = mortEvents.find(e => e.signals.some(s => /health|vaccin|medic|observation/i.test(s.label)));
  if (!ev) return null;
  return {
    id: `health-mort-${ev.scopeLabel}`,
    status: "Needs attention",
    category: "health",
    priority: 82,
    title: "Bird losses and health records need attention",
    whatWeFound: `More bird losses were recorded${ev.scope === "Room" ? ` in ${ev.scopeLabel}` : ""} around the same period as recent health records.`,
    whyItMatters: "These changes together may be worth checking early.",
    whatToCheck: [
      "Review the recent health records (vaccines, medicine or observations).",
      "Check the affected rooms for weak or sick birds.",
      "Consider speaking with a poultry health professional.",
    ],
    evidence: [
      `Recent losses (${ev.recentDays} days): ${ev.recentLoss}.`,
      `Recorded around the same time: ${ev.signals.map(s => s.label).slice(0, 3).join("; ")}.`,
    ],
    scopeLabel: scopeLabel(ev.scope, ev.scopeLabel),
  };
}

// ---------------- Profit / cost insight ----------------
function profitInsight(prices: Price[], eggs: EggRow[], feed: Feed[]): FarmInsight | null {
  if (eggs.length < 3) return null;
  const eggPrice = prices.find(p => /egg/i.test(p.item))?.price ?? 0;
  const feedPrice = prices.find(p => /feed/i.test(p.item))?.price ?? 0;
  if (eggPrice <= 0 || feedPrice <= 0) return null;

  const sorted = sortNewestFirst(eggs);
  const recent = sorted.slice(0, Math.min(7, sorted.length));
  const dateSet = new Set(recent.map(e => e.date));
  const cratesRecent = recent.reduce((s, e) => s + farmEggsTotal(e) / CRATE, 0);
  const feedRecent = feed.filter(f => dateSet.has(f.date)).reduce((s, f) => s + f.bags, 0);
  if (cratesRecent <= 0 || feedRecent <= 0) return null;

  const feedCostPerCrate = (feedRecent * feedPrice) / cratesRecent;
  const marginPerCrate = eggPrice - feedCostPerCrate;
  // Only surface when margin per crate turns thin (< 20% of egg price) — else stays quiet.
  if (marginPerCrate >= eggPrice * 0.2) return null;

  const status: InsightStatus = marginPerCrate <= 0 ? "Needs attention" : "Keep watching";
  return {
    id: "profit-margin",
    status,
    category: "profit",
    priority: marginPerCrate <= 0 ? 78 : 55,
    title: marginPerCrate <= 0
      ? "Feed cost is higher than egg income"
      : "Feed cost is eating most of your egg income",
    whatWeFound: `Over the last ${recent.length} record${recent.length === 1 ? "" : "s"}, the feed cost for each crate of eggs is about ₦${Math.round(feedCostPerCrate).toLocaleString("en-NG")}, while a crate sells for about ₦${Math.round(eggPrice).toLocaleString("en-NG")}.`,
    whyItMatters: "Your profit on each crate is very small right now.",
    whatToCheck: [
      "Check if egg selling price is up to date.",
      "Check if feed price or feed usage has increased.",
      "Look for feed wastage in the pens.",
    ],
    evidence: [
      `Crates in this period: ${round1(cratesRecent)}.`,
      `Feed used: ${round1(feedRecent)} bag${feedRecent === 1 ? "" : "s"} at ₦${Math.round(feedPrice).toLocaleString("en-NG")}/bag.`,
      `Egg selling price: ₦${Math.round(eggPrice).toLocaleString("en-NG")} per crate.`,
    ],
    scopeLabel: "Whole farm",
  };
}

// ---------------- Positive / stable insights ----------------
// Each stable insight is only produced when the underlying real records
// exist and actually show a stable pattern. Evidence in the card matches
// exactly the claim in the title.

function diffLabel(diff: number, unit: "pp" | "bags" | "%"): string {
  const abs = Math.abs(diff);
  if (abs < 0.05) return `No change (${unit === "pp" ? "0 percentage points" : unit === "bags" ? "0 bags" : "0%"})`;
  const dir = diff < 0 ? "lower" : "higher";
  if (unit === "pp") return `${round1(abs)} percentage points ${dir}`;
  if (unit === "bags") return `${round1(abs)} bag${abs === 1 ? "" : "s"} ${dir}`;
  return `${round1(abs)}% ${dir}`;
}

function stableProductionInsight(eggs: EggRow[], birds: number, totalRecords: number): FarmInsight | null {
  if (birds <= 0) return null;
  const sorted = sortNewestFirst(eggs);
  if (sorted.length < 3) return null;
  const today = sorted[0];
  const rest = sorted.slice(1, 8);
  if (rest.length < 2) return null;
  const pctToday = (farmEggsTotal(today) / birds) * 100;
  const pctAvg = mean(rest.map(e => (farmEggsTotal(e) / birds) * 100));
  const diff = pctToday - pctAvg; // pp

  return {
    id: "stable-production",
    status: "Looking good",
    category: "positive",
    priority: 20,
    title: "Egg production is close to normal",
    whatWeFound: `Today's production is ${round1(pctToday)}%. Your recent 7-day average is ${round1(pctAvg)}%.`,
    whyItMatters: "Production is staying close to your farm's recent level.",
    whatToCheck: [
      "Keep recording egg production daily.",
      "Watch for a continuous drop over several days.",
    ],
    evidence: [
      `Today: ${round1(pctToday)}%`,
      `7-day average: ${round1(pctAvg)}%`,
      `Difference: ${diffLabel(diff, "pp")}`,
      `Based on ${totalRecords} egg record${totalRecords === 1 ? "" : "s"}`,
    ],
    scopeLabel: "Whole farm",
  };
}

function stableFeedInsight(eggs: EggRow[], feed: Feed[]): FarmInsight | null {
  const eSorted = sortNewestFirst(eggs);
  if (eSorted.length < 8) return null;
  const dates = eSorted.map(e => e.date);
  const recentDates = new Set(dates.slice(0, 7));
  const prevDates = new Set(dates.slice(7, 14));
  const recentFeed = feed.filter(f => recentDates.has(f.date)).reduce((s, f) => s + f.bags, 0);
  const prevFeed = feed.filter(f => prevDates.has(f.date)).reduce((s, f) => s + f.bags, 0);
  if (recentFeed <= 0 || prevFeed <= 0) return null;
  const changePct = ((recentFeed - prevFeed) / prevFeed) * 100;
  if (Math.abs(changePct) > 10) return null; // not stable

  return {
    id: "stable-feed",
    status: "Looking good",
    category: "feed",
    priority: 18,
    title: "Feed use looks stable",
    whatWeFound: `Feed use this week is about ${round1(recentFeed)} bags. The previous 7 days averaged ${round1(prevFeed)} bags.`,
    whyItMatters: "Steady feed use usually means normal appetite and no sudden waste.",
    whatToCheck: [
      "Keep recording feed use every day.",
      "Compare feed use with egg production weekly.",
    ],
    evidence: [
      `Feed last 7 days: ${round1(recentFeed)} bags`,
      `Previous 7 days: ${round1(prevFeed)} bags`,
      `Feed use is close to usual (${diffLabel(recentFeed - prevFeed, "bags")})`,
    ],
    scopeLabel: "Whole farm",
  };
}

function stableMortalityInsight(mortality: Mortality[], birds: number): FarmInsight | null {
  if (mortality.length === 0 || birds <= 0) return null;
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const monthLoss = mortality.filter(m => m.date >= cutoff).reduce((s, m) => s + m.loss, 0);
  const monthPct = (monthLoss / birds) * 100;
  // Only surface as "Looking good" when losses are within a normal range.
  if (monthPct > 2) return null;

  return {
    id: "stable-mortality",
    status: monthPct >= 1 ? "Keep watching" : "Looking good",
    category: "mortality",
    priority: monthPct >= 1 ? 30 : 15,
    title: monthPct >= 1 ? "Keep watching bird losses" : "Bird losses remain low",
    whatWeFound: `Bird losses in the last 30 days: ${monthLoss}. That is about ${round1(monthPct)}% of your current flock.`,
    whyItMatters: monthPct >= 1
      ? "Losses are within normal range but worth watching."
      : "Low losses usually mean the flock is comfortable.",
    whatToCheck: [
      "Keep recording every bird loss with a reason.",
      "Watch daily counts by room for sudden changes.",
    ],
    evidence: [
      `Bird losses (last 30 days): ${monthLoss}`,
      `Current flock: ${birds} bird${birds === 1 ? "" : "s"}`,
      `Loss rate: ${round1(monthPct)}%`,
    ],
    scopeLabel: "Whole farm",
  };
}

// ---------------- Briefing ----------------
function briefingForAttention(insights: FarmInsight[]): string {
  const attention = insights.filter(i => i.status === "Needs attention");
  const watch = insights.filter(i => i.status === "Keep watching");
  const parts: string[] = [];
  if (attention.length === 1) {
    parts.push(`One thing on your farm needs attention today: ${lower(attention[0].title)}.`);
    parts.push(attention[0].whatWeFound);
  } else {
    parts.push(`${attention.length} things on your farm need attention today.`);
    parts.push(`Top concern: ${lower(attention[0].title)}. ${attention[0].whatWeFound}`);
  }
  if (watch.length) parts.push(`Also worth watching: ${lower(watch[0].title)}.`);
  return parts.slice(0, 3).join(" ");
}

function briefingForWatch(insights: FarmInsight[]): string {
  const watch = insights.filter(i => i.status === "Keep watching");
  const parts: string[] = [
    "Your farm is close to normal, but a few things are worth watching.",
    `${watch[0].title}: ${watch[0].whatWeFound}`,
  ];
  if (watch.length > 1) parts.push(`Also keep an eye on: ${lower(watch[1].title)}.`);
  return parts.slice(0, 3).join(" ");
}

function briefingForStable(insights: FarmInsight[]): string {
  const titles = insights.map(i => lower(i.title));
  const parts: string[] = ["Your farm looks stable today."];
  if (titles.length === 1) {
    parts.push(`${titles[0].charAt(0).toUpperCase() + titles[0].slice(1)}.`);
  } else if (titles.length >= 2) {
    // Combine specific stable signals into one natural sentence
    const first = insights[0];
    parts.push(`${first.whatWeFound}`);
    const others = titles.slice(1);
    if (others.length) parts.push(`${cap(others.join(" and "))}.`);
  }
  parts.push("Keep recording production, feed and mortality every day so PoultryPro can keep watching your farm.");
  return parts.slice(0, 3).join(" ");
}

function briefingForNoInsights(): string {
  return "Your farm looks stable today. Keep recording production, feed and mortality every day so PoultryPro can keep watching your farm.";
}

function lower(s: string): string { return s.charAt(0).toLowerCase() + s.slice(1); }
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

function buildBriefing(insights: FarmInsight[]): string {
  if (!insights.length) return briefingForNoInsights();
  if (insights.some(i => i.status === "Needs attention")) return briefingForAttention(insights);
  if (insights.some(i => i.status === "Keep watching") && insights.every(i => i.status !== "Looking good")) {
    return briefingForWatch(insights);
  }
  return briefingForStable(insights);
}

// ---------------- Main ----------------
export function buildFarmInsights(input: {
  eggs: EggRow[];
  rooms: Room[];
  mortality: Mortality[];
  feed: Feed[];
  health: Health[];
  prices: Price[];
}): FarmInsightsReport {
  const { eggs, rooms, mortality, feed, health, prices } = input;
  const totalBirds = rooms.reduce((s, r) => s + r.current, 0);

  // Need at least some baseline data to summarise usefully.
  if (eggs.length < 3 && mortality.length === 0) {
    return {
      ready: false,
      briefing: "",
      insights: [],
      totalEggRecords: eggs.length,
      message: "PoultryPro needs more daily records before it can give a full farm summary. Keep recording production, feed and mortality.",
    };
  }

  const insights: FarmInsight[] = [];

  // Reuse existing modules' outputs
  const decline = detectProductionDecline({ eggs, rooms, mortality, feed, health });
  const mort = detectMortalityPatterns({ eggs, rooms, mortality, feed, health });

  // Mortality first (highest priority)
  for (const ev of mort.events.slice(0, 2)) insights.push(mortalityInsight(ev));

  // Health + mortality combined
  const hm = healthMortalityInsight(mort.events);
  if (hm) insights.push(hm);

  // Production decline
  for (const ev of decline.events.slice(0, 2)) insights.push(productionInsight(ev));

  // Feed vs production combined
  const fp = feedProductionSignal(eggs, feed, totalBirds);
  if (fp) {
    const fpIns = feedProductionInsight(fp);
    if (fpIns) insights.push(fpIns);
  }

  // Profit / cost
  const profit = profitInsight(prices, eggs, feed);
  if (profit) insights.push(profit);

  // Deduplicate by id, sort by priority, cap at 3
  const seen = new Set<string>();
  const unique = insights.filter(i => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  unique.sort((a, b) => b.priority - a.priority);
  let top = unique.slice(0, 3);

  // If nothing was flagged, show up to 3 specific stable insights,
  // each backed by its own real evidence. Never show a generic
  // "Your farm looks stable" card — the briefing already says that.
  if (top.length === 0) {
    const stable: FarmInsight[] = [];
    const prodStable = stableProductionInsight(eggs, totalBirds, eggs.length);
    if (prodStable) stable.push(prodStable);
    const feedStable = stableFeedInsight(eggs, feed);
    if (feedStable) stable.push(feedStable);
    const mortStable = stableMortalityInsight(mortality, totalBirds);
    if (mortStable) stable.push(mortStable);
    top = stable.slice(0, 3);
  }

  return {
    ready: true,
    briefing: buildBriefing(top),
    insights: top,
    totalEggRecords: eggs.length,
  };
}

export function insightStatusStyle(s: InsightStatus): { badge: string; ring: string; dot: string } {
  if (s === "Needs attention") return { badge: "bg-red-600 text-white", ring: "border-red-500/40", dot: "bg-red-500" };
  if (s === "Keep watching")   return { badge: "bg-amber-500 text-white", ring: "border-amber-400/40", dot: "bg-amber-500" };
  return { badge: "bg-[color:var(--forest)] text-white", ring: "border-[color:var(--forest)]/30", dot: "bg-[color:var(--forest)]" };
}
