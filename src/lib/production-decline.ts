import type { EggRow, Room, Mortality, Feed, Health } from "@/lib/farm-data";

// ---------------------------------------------------------------------------
// Production Decline Detection
// Analyses the farm's own daily egg records and flags unusual drops in
// egg-production percentage (eggs per bird). It does NOT diagnose disease —
// it points the farmer to what to check.
// ---------------------------------------------------------------------------

export type RiskLevel = "Low" | "Medium" | "High";
export type Status = "Active";

export type DeclineEvent = {
  scope: "Farm" | "Room";
  scopeLabel: string;              // "Whole Farm" | "ROOM 3"
  risk: RiskLevel;
  riskLabel: string;               // "Low attention" | "Needs attention" | "Urgent attention"
  status: Status;
  title: string;                   // farmer-friendly headline
  whatWeNoticed: string;           // one plain-English sentence
  farmData: string[];              // simple bullet points with numbers
  whatToCheck: string[];           // actionable next steps
  reasons: string[];               // internal patterns triggered
  currentPct: number;              // today's production %
  baselinePct: number;             // usual production %
  changePct: number;               // % below baseline (positive = drop)
  latestDate: string;
  firstDeclineDate: string;
};

export type DeclineReport = {
  status: "ok" | "learning";
  message?: string;
  totalRecords: number;
  events: DeclineEvent[];
};

// ---------- helpers ----------

const CRATE = 30;

function sortNewestFirst<T extends { date: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
}
function round1(n: number): number { return Math.round(n * 10) / 10; }

function farmEggs(e: EggRow): number {
  const broken =
    (e.broken_r2 ?? 0) + (e.broken_r3 ?? 0) + (e.broken_r4 ?? 0) + (e.broken_extra ?? 0);
  return Math.max(0, (e.r2 + e.r3 + e.r4) * CRATE + e.extra - broken);
}
/** Usable eggs recorded for a specific room name like "ROOM 2". Returns null if room name has no matching field. */
function roomEggs(name: string, e: EggRow): number | null {
  const m = name.match(/(\d+)/);
  if (!m) return null;
  const n = m[1];
  if (n === "2") return Math.max(0, e.r2 * CRATE - (e.broken_r2 ?? 0));
  if (n === "3") return Math.max(0, e.r3 * CRATE - (e.broken_r3 ?? 0));
  if (n === "4") return Math.max(0, e.r4 * CRATE - (e.broken_r4 ?? 0));
  return null;
}


type Point = { date: string; eggs: number; pct: number };

function buildSeries(eggs: EggRow[], birds: number, eggsOf: (e: EggRow) => number): Point[] {
  if (birds <= 0) return [];
  return eggs.map((e) => {
    const es = eggsOf(e);
    return { date: e.date, eggs: es, pct: (es / birds) * 100 };
  });
}

// ---------- rule engine ----------

type TriggerFlag = "single" | "three" | "seven" | "sharp" | "room";
type Trigger = { flag: TriggerFlag; risk: RiskLevel; reason: string; data: string };

function analyse(series: Point[]): {
  triggers: Trigger[];
  current: number;
  baseline: number;
  changePct: number;
  firstDate: string;
} | null {
  if (series.length < 2) return null;

  const triggers: Trigger[] = [];
  const today = series[0];
  const yest = series[1];
  let firstDate = today.date;

  // A. Single-day drop (≥ 5% lower than yesterday)
  if (yest.pct > 0) {
    const drop = ((yest.pct - today.pct) / yest.pct) * 100;
    if (drop >= 5) {
      triggers.push({
        flag: "single",
        risk: "Low",
        reason: "Production dropped today",
        data: `Yesterday was ${round1(yest.pct)}%, today is ${round1(today.pct)}%.`,
      });
    }
  }

  // B. Three-day continuous decline
  if (series.length >= 3) {
    const [d0, d1, d2] = series;
    if (d0.pct < d1.pct && d1.pct < d2.pct) {
      const drop = d2.pct > 0 ? ((d2.pct - d0.pct) / d2.pct) * 100 : 0;
      if (drop >= 5) {
        triggers.push({
          flag: "three",
          risk: "Medium",
          reason: "Production has been falling for 3 days",
          data: `Fell from ${round1(d2.pct)}% → ${round1(d1.pct)}% → ${round1(d0.pct)}%.`,
        });
        firstDate = d2.date;
      }
    }
  }

  // C. Seven-day performance drop vs previous 7 days
  if (series.length >= 14) {
    const cur7 = mean(series.slice(0, 7).map((p) => p.pct));
    const prev7 = mean(series.slice(7, 14).map((p) => p.pct));
    if (prev7 > 0) {
      const drop = ((prev7 - cur7) / prev7) * 100;
      if (drop >= 5) {
        triggers.push({
          flag: "seven",
          risk: "Medium",
          reason: "Production is lower than last week",
          data: `This week average ${round1(cur7)}%, last week ${round1(prev7)}%.`,
        });
      }
    }
  }

  // D. Sharp drop vs recent 7-day average
  if (series.length >= 8) {
    const recent7 = mean(series.slice(1, 8).map((p) => p.pct));
    if (recent7 > 0) {
      const drop = ((recent7 - today.pct) / recent7) * 100;
      if (drop >= 10) {
        triggers.push({
          flag: "sharp",
          risk: "High",
          reason: "Sharp production drop detected",
          data: `Today ${round1(today.pct)}% vs 7-day average ${round1(recent7)}%.`,
        });
      }
    }
  }

  if (triggers.length === 0) return null;

  const baseline =
    series.length >= 8
      ? mean(series.slice(1, 8).map((p) => p.pct))
      : yest.pct;
  const current = today.pct;
  const changePct = baseline > 0 ? ((baseline - current) / baseline) * 100 : 0;

  return { triggers, current, baseline, changePct, firstDate };
}

function combineRisk(triggers: Trigger[]): RiskLevel {
  if (triggers.some((t) => t.risk === "High")) return "High";
  const meds = triggers.filter((t) => t.risk === "Medium").length;
  const lows = triggers.filter((t) => t.risk === "Low").length;
  if (meds >= 2 || (meds >= 1 && lows >= 1)) return "High";
  if (meds >= 1) return "Medium";
  return "Low";
}

function riskLabelFor(r: RiskLevel): string {
  return r === "High" ? "Urgent attention" : r === "Medium" ? "Needs attention" : "Low attention";
}

function whatToCheck(
  scope: "Farm" | "Room",
  scopeLabel: string,
  mortality: Mortality[],
  feed: Feed[],
  health: Health[],
  streakDates: string[],
): string[] {
  const items: string[] = [];
  const inStreak = (d: string) => streakDates.includes(d);
  const roomMatches = (r: string) =>
    scope === "Farm" || r.trim().toUpperCase() === scopeLabel.trim().toUpperCase();

  const feedIn = feed.filter((f) => inStreak(f.date) && roomMatches(f.room));
  const feedBags = feedIn.reduce((s, f) => s + f.bags, 0);
  if (feedIn.length === 0) items.push("Check if feed was given on those days.");
  else items.push(`Check feed given (${feedBags} bag${feedBags === 1 ? "" : "s"} recorded) — was it enough and the right type?`);

  const mortIn = mortality.filter((m) => inStreak(m.date) && roomMatches(m.room));
  const losses = mortIn.reduce((s, m) => s + m.loss, 0);
  if (losses > 0) items.push(`Look at the ${losses} bird loss${losses === 1 ? "" : "es"} recorded during this period.`);

  const healthIn = health.filter(
    (h) => inStreak(h.date) && (h.scope === "Whole Farm" || roomMatches(h.scope)),
  );
  if (healthIn.length > 0) items.push("Review recent health records (vaccines, medicine or observations).");

  items.push("Check water — is it clean and enough for all the birds?");
  items.push("Check the pen for heat, stress, or unusual bird behaviour.");
  if (scope === "Room") items.push(`Compare ${scopeLabel} with the other rooms.`);
  return items;
}

// ---------- main ----------

export function detectProductionDecline(input: {
  eggs: EggRow[];
  rooms: Room[];
  mortality: Mortality[];
  feed: Feed[];
  health: Health[];
}): DeclineReport {
  const eggs = sortNewestFirst(input.eggs);
  const { rooms, mortality, feed, health } = input;
  const total = eggs.length;

  if (total < 8) {
    const missing = Math.max(0, 8 - total);
    return {
      status: "learning",
      totalRecords: total,
      events: [],
      message: `Still learning your farm — add ${missing} more day${missing === 1 ? "" : "s"} of egg records so we can compare with a full week.`,
    };
  }

  const totalBirds = rooms.reduce((s, r) => s + r.current, 0);
  const events: DeclineEvent[] = [];

  // ---- Farm-wide ----
  const farmSeries = buildSeries(eggs, totalBirds, farmEggs);
  const farmAnalysis = farmSeries.length ? analyse(farmSeries) : null;

  if (farmAnalysis) {
    const streakDays = farmAnalysis.triggers.some((t) => t.flag === "three") ? 3 : 1;
    const streakDates = eggs.slice(0, streakDays).map((e) => e.date);
    const risk = combineRisk(farmAnalysis.triggers);
    events.push(buildEvent({
      scope: "Farm", scopeLabel: "Whole Farm",
      analysis: farmAnalysis, risk, streakDates,
      mortality, feed, health, latestDate: eggs[0].date,
    }));
  }

  // ---- Room-level ----
  // Pre-compute drop % per room to check "one room falls while others are stable"
  const roomDrops = new Map<string, number>();
  for (const r of rooms) {
    if (r.current <= 0) continue;
    if (roomEggs(r.name, eggs[0]) == null) continue;
    const s = buildSeries(eggs, r.current, (e) => roomEggs(r.name, e) ?? 0);
    if (s.every((p) => p.eggs === 0)) continue;
    const a = analyse(s);
    roomDrops.set(r.id, a?.changePct ?? 0);
  }

  for (const room of rooms) {
    if (room.current <= 0) continue;
    if (roomEggs(room.name, eggs[0]) == null) continue;
    const series = buildSeries(eggs, room.current, (e) => roomEggs(room.name, e) ?? 0);
    if (series.every((p) => p.eggs === 0)) continue;
    const roomAnalysis = analyse(series);
    if (!roomAnalysis) continue;

    // Other rooms' worst decline
    let othersMax = 0;
    for (const [id, drop] of roomDrops.entries()) {
      if (id === room.id) continue;
      if (drop > othersMax) othersMax = drop;
    }

    const roomDrop = roomAnalysis.changePct;
    const standsOut = othersMax < 5 && roomDrop >= 10;
    const isSerious = roomAnalysis.triggers.some((t) => t.risk === "High" || t.risk === "Medium");
    if (!standsOut && !isSerious) continue;

    const extraTriggers: Trigger[] = standsOut
      ? [{
          flag: "room",
          risk: "Medium",
          reason: `${room.name} needs attention`,
          data: `Egg production in ${room.name} has fallen while the other rooms remain stable.`,
        }]
      : [];
    const merged = { ...roomAnalysis, triggers: [...extraTriggers, ...roomAnalysis.triggers] };
    const risk = combineRisk(merged.triggers);
    const streakDays = merged.triggers.some((t) => t.flag === "three") ? 3 : 1;
    const streakDates = eggs.slice(0, streakDays).map((e) => e.date);

    events.push(buildEvent({
      scope: "Room", scopeLabel: room.name,
      analysis: merged, risk, streakDates,
      mortality, feed, health, latestDate: eggs[0].date,
    }));
  }

  const rank: Record<RiskLevel, number> = { High: 3, Medium: 2, Low: 1 };
  events.sort((a, b) => rank[b.risk] - rank[a.risk]);

  return { status: "ok", totalRecords: total, events };
}

type BuildArgs = {
  scope: "Farm" | "Room";
  scopeLabel: string;
  analysis: { triggers: Trigger[]; current: number; baseline: number; changePct: number; firstDate: string };
  risk: RiskLevel;
  streakDates: string[];
  mortality: Mortality[];
  feed: Feed[];
  health: Health[];
  latestDate: string;
};

function buildEvent(a: BuildArgs): DeclineEvent {
  const { scope, scopeLabel, analysis, risk } = a;
  const isRoom = scope === "Room";

  let title = "Egg production is dropping";
  if (isRoom && analysis.triggers.some((t) => t.flag === "room")) title = `${scopeLabel} needs attention`;
  else if (analysis.triggers.some((t) => t.flag === "sharp")) title = "Sharp drop in egg production";
  else if (analysis.triggers.some((t) => t.flag === "three")) title = "Egg production has been falling";
  else if (analysis.triggers.some((t) => t.flag === "seven")) title = "Egg production is lower than last week";

  const noticed = analysis.triggers.map((t) => t.reason).join(". ") + ".";
  const farmData = [
    `Production is now ${round1(analysis.current)}%.`,
    `Usual production is around ${round1(analysis.baseline)}%.`,
    `That is about ${round1(Math.max(0, analysis.changePct))}% lower than usual.`,
    ...analysis.triggers.map((t) => t.data),
  ];
  const check = whatToCheck(scope, scopeLabel, a.mortality, a.feed, a.health, a.streakDates);

  return {
    scope,
    scopeLabel,
    risk,
    riskLabel: riskLabelFor(risk),
    status: "Active",
    title,
    whatWeNoticed: noticed,
    farmData,
    whatToCheck: check,
    reasons: analysis.triggers.map((t) => t.reason),
    currentPct: analysis.current,
    baselinePct: analysis.baseline,
    changePct: analysis.changePct,
    latestDate: a.latestDate,
    firstDeclineDate: analysis.firstDate,
  };
}

export function riskStyle(r: RiskLevel): { badge: string; ring: string; dot: string } {
  switch (r) {
    case "High":   return { badge: "bg-red-600 text-white",    ring: "border-red-500/50",   dot: "bg-red-500" };
    case "Medium": return { badge: "bg-amber-500 text-white",  ring: "border-amber-400/50", dot: "bg-amber-500" };
    default:       return { badge: "bg-yellow-400 text-black", ring: "border-yellow-400/50", dot: "bg-yellow-400" };
  }
}
