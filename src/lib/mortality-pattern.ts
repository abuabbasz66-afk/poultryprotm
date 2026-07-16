import type { EggRow, Room, Mortality, Feed, Health } from "@/lib/farm-data";

export type MortSeverity = "Monitoring" | "Watch" | "Warning" | "Critical";
export type MortConfidence = "Low" | "Moderate" | "High";

export type MortSignal = { label: string; detail?: string };

export type MortalityEvent = {
  scope: "Farm" | "Room";
  scopeLabel: string;                 // "Whole Farm" | "ROOM 3"
  severity: MortSeverity;
  recentLoss: number;                 // total losses in recent window
  recentDays: number;                 // window length in days
  baselinePerDay: number;             // avg losses/day from baseline window
  expectedLoss: number;               // baselinePerDay * recentDays
  aboveBaselinePct: number | null;    // % above expected (null if baseline is 0)
  magnitudeAbove: number;             // recentLoss - expectedLoss (birds)
  clusterDays: number;                // consecutive recorded loss days ending at latestDate
  latestDate: string;                 // most recent loss record date
  firstEventDate: string;             // first date in cluster (or recent window if no cluster)
  baselineWindowDays: number;         // baseline days used
  causes: string[];                   // distinct non-empty causes in recent window
  signals: MortSignal[];              // correlated signals
  factors: string[];                  // possible factors to investigate
  confidence: MortConfidence;
  population: number;                 // live bird population for this scope (0 if unknown)
  mortalityRatePct: number | null;    // 7-day mortality rate as % of population
};

export type MortalityReport = {
  status: "ok" | "learning";
  message?: string;
  totalRecords: number;
  events: MortalityEvent[];
};

const RECENT_DAYS = 7;
const BASELINE_DAYS = 21; // 21 days preceding the recent window

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
// Robust date parser: accepts ISO (YYYY-MM-DD), DD/MM/YYYY, DD-MM-YYYY. Returns
// a canonical ISO YYYY-MM-DD string, or null when the input cannot be parsed.
// Uses Date.UTC() to avoid timezone drift.
function parseDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    const y = +iso[1], m = +iso[2], d = +iso[3];
    const t = Date.UTC(y, m - 1, d);
    if (!Number.isFinite(t)) return null;
    const dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt.toISOString().slice(0, 10);
  }
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (dmy) {
    const d = +dmy[1], m = +dmy[2], y = +dmy[3];
    const t = Date.UTC(y, m - 1, d);
    if (!Number.isFinite(t)) return null;
    const dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt.toISOString().slice(0, 10);
  }
  return null;
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtDay(iso: string) {
  return iso;
}
function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(a + "T00:00:00Z").getTime() - new Date(b + "T00:00:00Z").getTime()) / 86400000,
  );
}


// Population-normalised severity. `ratePct` is the 7-day mortality rate as a
// percentage of the live bird population for this scope. When the population
// is unknown (0), fall back to a conservative absolute-magnitude ladder.
function severityFor(
  ratePct: number | null,
  aboveBaselinePct: number | null,
  magnitude: number,
  cluster: number,
  supportCount: number,
): MortSeverity {
  // Rate-driven ladder (preferred path)
  if (ratePct !== null) {
    // HIGH RISK / Critical: severe rate or sustained abnormal losses with signals
    if (ratePct >= 1.5) return "Critical";
    if (ratePct >= 0.75 && (cluster >= 3 || supportCount >= 2)) return "Critical";
    // NEEDS ATTENTION / Warning
    if (ratePct >= 0.75) return "Warning";
    if (ratePct >= 0.35 && cluster >= 2) return "Warning";
    if (ratePct >= 0.35 && aboveBaselinePct !== null && aboveBaselinePct >= 100) return "Warning";
    // WATCH
    if (ratePct >= 0.15) return "Watch";
    if (cluster >= 3 && supportCount >= 1) return "Watch";
    if (aboveBaselinePct !== null && aboveBaselinePct >= 100 && cluster >= 2) return "Watch";
    // Otherwise NORMAL
    return "Monitoring";
  }
  // No population known — fall back to conservative absolute counts
  if (aboveBaselinePct === null) {
    if (magnitude >= 10 || cluster >= 4) return "Critical";
    if (magnitude >= 5 || cluster >= 3) return "Warning";
    if (magnitude >= 2) return "Watch";
    return "Monitoring";
  }
  if (aboveBaselinePct >= 200 || cluster >= 4) return "Critical";
  if (aboveBaselinePct >= 100 || cluster >= 3) return "Warning";
  if (aboveBaselinePct >= 50) return "Watch";
  return "Monitoring";
}

function computeConfidence(baselineDays: number, cluster: number, supportCount: number, recentLoss: number): MortConfidence {
  if (baselineDays < 7 || recentLoss < 2) return "Low";
  if (cluster >= 3 && supportCount >= 1) return "High";
  if (cluster >= 2 || supportCount >= 1) return "Moderate";
  return "Low";
}

function analyseForRoom(args: {
  mortality: Mortality[];
  rooms: Room[];
  roomName: string | null;              // null = whole farm
  anchorDate: string;                    // latest overall data date (defines "now")
  eggs: EggRow[];
  feed: Feed[];
  health: Health[];
}): MortalityEvent | null {
  const { mortality, rooms, roomName, anchorDate, eggs, feed, health } = args;

  const inScope = (r: string) => (roomName ? r.trim().toUpperCase() === roomName.trim().toUpperCase() : true);
  const rows = mortality.filter((m) => inScope(m.room));
  if (rows.length === 0) return null;

  // Live bird population for this scope
  const population = roomName
    ? (rooms.find((r) => r.name.trim().toUpperCase() === roomName.trim().toUpperCase())?.current ?? 0)
    : rooms.reduce((s, r) => s + (r.current || 0), 0);

  const recentEndISO = anchorDate;
  const recentStartISO = addDays(recentEndISO, -(RECENT_DAYS - 1));
  const baselineEndISO = addDays(recentStartISO, -1);
  const baselineStartISO = addDays(baselineEndISO, -(BASELINE_DAYS - 1));

  const isInRange = (d: string, a: string, b: string) => d >= a && d <= b;

  const recentRows = rows.filter((r) => isInRange(r.date, recentStartISO, recentEndISO));
  const baselineRows = rows.filter((r) => isInRange(r.date, baselineStartISO, baselineEndISO));

  const recentLoss = recentRows.reduce((s, r) => s + r.loss, 0);
  const baselineLoss = baselineRows.reduce((s, r) => s + r.loss, 0);
  const baselinePerDay = baselineLoss / BASELINE_DAYS;
  const expectedLoss = baselinePerDay * RECENT_DAYS;

  // Only alert when recent losses exist
  if (recentLoss <= 0) return null;

  const recentPerDay = recentLoss / RECENT_DAYS;
  let aboveBaselinePct: number | null = null;
  if (baselinePerDay > 0) {
    aboveBaselinePct = ((recentPerDay - baselinePerDay) / baselinePerDay) * 100;
  }
  const magnitudeAbove = recentLoss - expectedLoss;

  // Cluster: consecutive recorded days with a loss ending at latest recent date
  const lossByDay = new Map<string, number>();
  for (const r of recentRows) lossByDay.set(r.date, (lossByDay.get(r.date) ?? 0) + r.loss);
  const daysDesc = [...lossByDay.keys()].sort().reverse();
  const latestDate = daysDesc[0];
  let cluster = 0;
  let cursor = latestDate;
  while (lossByDay.has(cursor) && (lossByDay.get(cursor) ?? 0) > 0) {
    cluster += 1;
    cursor = addDays(cursor, -1);
  }
  const firstEventDate = addDays(latestDate, -(cluster - 1));

  // Population-normalised 7-day mortality rate (percentage of flock)
  const mortalityRatePct = population > 0 ? (recentLoss / population) * 100 : null;

  // Causes
  const causes = [...new Set(recentRows.map((r) => (r.cause || "").trim()).filter(Boolean))];

  // Correlated signals in the recent window
  const signals: MortSignal[] = [];
  const factors = new Set<string>();
  const inRecent = (d: string) => isInRange(d, recentStartISO, recentEndISO);
  const inBase = (d: string) => isInRange(d, baselineStartISO, baselineEndISO);

  // Production decline in scope
  const roomKey = roomName?.match(/(\d+)/)?.[1] ?? null;
  const eggRecent = eggs.filter((e) => inRecent(e.date));
  const eggBase = eggs.filter((e) => inBase(e.date));
  const eggVal = (e: EggRow) =>
    roomKey === "2" ? e.r2 : roomKey === "3" ? e.r3 : roomKey === "4" ? e.r4 : e.r2 + e.r3 + e.r4 + e.extra / 30;
  if (eggRecent.length > 0 && eggBase.length > 0) {
    const r = eggRecent.reduce((s, e) => s + eggVal(e), 0) / eggRecent.length;
    const b = eggBase.reduce((s, e) => s + eggVal(e), 0) / eggBase.length;
    if (b > 0) {
      const diffPct = ((b - r) / b) * 100;
      if (diffPct >= 5) {
        signals.push({ label: `Production ↓ ${diffPct.toFixed(0)}%`, detail: "vs baseline period" });
        factors.add("Production decline correlation");
      }
    }
  }

  // Feed usage change
  const feedRecent = feed.filter((f) => inRecent(f.date) && inScope(f.room));
  const feedBase = feed.filter((f) => inBase(f.date) && inScope(f.room));
  if (feedRecent.length > 0 && feedBase.length > 0) {
    const rDays = new Set(feedRecent.map((f) => f.date)).size || 1;
    const bDays = new Set(feedBase.map((f) => f.date)).size || 1;
    const r = feedRecent.reduce((s, f) => s + f.bags, 0) / rDays;
    const b = feedBase.reduce((s, f) => s + f.bags, 0) / bDays;
    if (b > 0) {
      const diffPct = ((b - r) / b) * 100;
      if (diffPct >= 5) {
        signals.push({ label: `Feed usage ↓ ${diffPct.toFixed(0)}%`, detail: "vs baseline period" });
        factors.add("Feed intake");
      } else if (diffPct <= -10) {
        signals.push({ label: `Feed usage ↑ ${Math.abs(diffPct).toFixed(0)}%`, detail: "vs baseline period" });
        factors.add("Feed conversion efficiency");
      }
    }
  }

  // Health records
  const healthRecent = health.filter((h) => inRecent(h.date) && (h.scope === "Whole Farm" || inScope(h.scope)));
  if (healthRecent.length > 0) {
    const types = new Set(healthRecent.map((h) => h.type));
    for (const t of types) signals.push({ label: `Recent ${t.toLowerCase()} record` });
    if (types.has("Vaccination")) factors.add("Post-vaccination monitoring");
    if (types.has("Medication") || types.has("Treatment")) factors.add("Ongoing treatment response");
    if (types.has("Observation")) factors.add("Reported observations");
  }

  // Cause-driven factors
  const causesLc = causes.map((c) => c.toLowerCase());
  if (causesLc.some((c) => c.includes("heat"))) factors.add("Heat stress / ventilation");
  if (causesLc.some((c) => c.includes("disease") || c.includes("infect") || c.includes("newcastle") || c.includes("flu"))) factors.add("Disease investigation");
  if (causesLc.some((c) => c.includes("predator"))) factors.add("Predator / biosecurity");
  factors.add("Flock health");

  const severity = severityFor(mortalityRatePct, aboveBaselinePct, magnitudeAbove, cluster, signals.length);

  // Alert gating (population-aware). An isolated small loss in a large flock
  // must NOT surface as an alert — the card falls back to "looks normal".
  const hasCluster = cluster >= 2;
  const hasSignals = signals.length >= 1;
  const strongBaselineJump =
    aboveBaselinePct !== null && aboveBaselinePct >= 100 && recentLoss >= 3;
  const shouldEmit =
    severity !== "Monitoring" || hasCluster || hasSignals || strongBaselineJump;
  if (!shouldEmit) return null;

  const confidence = computeConfidence(BASELINE_DAYS, cluster, signals.length, recentLoss);

  return {
    scope: roomName ? "Room" : "Farm",
    scopeLabel: roomName ?? "Whole Farm",
    severity,
    recentLoss,
    recentDays: RECENT_DAYS,
    baselinePerDay,
    expectedLoss,
    aboveBaselinePct,
    magnitudeAbove,
    clusterDays: cluster,
    latestDate,
    firstEventDate,
    baselineWindowDays: BASELINE_DAYS,
    causes,
    signals,
    factors: [...factors],
    confidence,
    population,
    mortalityRatePct,
  };
}


export function detectMortalityPatterns(input: {
  eggs: EggRow[];
  rooms: Room[];
  mortality: Mortality[];
  feed: Feed[];
  health: Health[];
}): MortalityReport {
  const { rooms } = input;

  // Normalize inputs — drop rows with unparseable dates so one bad CSV cell
  // (e.g. "6 aPR") cannot poison sort/anchor/day-math downstream.
  const mortality = input.mortality
    .map((m) => ({ ...m, date: parseDate(m.date) as string }))
    .filter((m) => !!m.date);
  const eggs = input.eggs
    .map((e) => ({ ...e, date: parseDate(e.date) as string }))
    .filter((e) => !!e.date);
  const feed = input.feed
    .map((f) => ({ ...f, date: parseDate(f.date) as string }))
    .filter((f) => !!f.date);
  const health = input.health
    .map((h) => ({ ...h, date: parseDate(h.date) as string }))
    .filter((h) => !!h.date);

  const total = mortality.length;

  if (total === 0) {
    return {
      status: "learning",
      totalRecords: 0,
      events: [],
      message: "Learning farm mortality pattern — no mortality records on file yet.",
    };
  }

  // Anchor "now" to latest valid mortality date (ISO sorts lexicographically).
  const anchorDate = [...mortality].map((m) => m.date).sort().reverse()[0];

  // Distinct-calendar-day history: count unique dates within the 21-day baseline
  // window that either have a mortality record OR evidence of farm activity
  // (egg production / feed usage). Days with no evidence are treated as
  // "missing" — mortality data is sparse event data, not a daily log.
  const recentEndISO = anchorDate;
  const recentStartISO = addDays(recentEndISO, -(RECENT_DAYS - 1));
  const baselineEndISO = addDays(recentStartISO, -1);
  const baselineStartISO = addDays(baselineEndISO, -(BASELINE_DAYS - 1));

  const inBaseline = (d: string) => d >= baselineStartISO && d <= baselineEndISO;
  const knownDays = new Set<string>();
  for (const m of mortality) if (inBaseline(m.date)) knownDays.add(m.date);
  for (const e of eggs) if (inBaseline(e.date)) knownDays.add(e.date);
  for (const f of feed) if (inBaseline(f.date)) knownDays.add(f.date);
  const historyDays = knownDays.size;

  if (historyDays < BASELINE_DAYS) {
    const remaining = Math.max(0, BASELINE_DAYS - historyDays);
    return {
      status: "learning",
      totalRecords: total,
      events: [],
      message: `${remaining} more recorded day${remaining === 1 ? "" : "s"} of mortality history required to establish a ${BASELINE_DAYS}-day baseline.`,
    };
  }


  const events: MortalityEvent[] = [];

  const farmEvent = analyseForRoom({ mortality, rooms, roomName: null, anchorDate, eggs, feed, health });
  if (farmEvent) events.push(farmEvent);

  for (const room of rooms) {
    const ev = analyseForRoom({ mortality, rooms, roomName: room.name, anchorDate, eggs, feed, health });
    if (ev) events.push(ev);
  }

  const sevWeight: Record<MortSeverity, number> = { Monitoring: 0, Watch: 1, Warning: 2, Critical: 3 };
  events.sort((a, b) => {
    if (sevWeight[b.severity] !== sevWeight[a.severity]) return sevWeight[b.severity] - sevWeight[a.severity];
    return b.recentLoss - a.recentLoss;
  });

  return { status: "ok", totalRecords: total, events };
}

export function mortSeverityStyle(sev: MortSeverity): { badge: string; ring: string } {
  switch (sev) {
    case "Critical": return { badge: "bg-red-600 text-white", ring: "border-red-500/50" };
    case "Warning":  return { badge: "bg-orange-500 text-white", ring: "border-orange-400/50" };
    case "Watch":    return { badge: "bg-amber-500 text-white", ring: "border-amber-400/50" };
    default:         return { badge: "bg-slate-400 text-white", ring: "border-slate-300/50" };
  }
}

export { fmtDay };
