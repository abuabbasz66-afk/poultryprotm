import type { EggRow, Room, Mortality, Feed, Health } from "@/lib/farm-data";

export type Severity = "Monitoring" | "Watch" | "Moderate" | "High" | "Critical";
export type Confidence = "Low" | "Moderate" | "High";
export type Status = "Active" | "Recovered";

export type DeclineSignal = { label: string; detail?: string };

export type DeclineEvent = {
  scope: "Farm" | "Room";
  scopeLabel: string;             // "Whole Farm" | "ROOM 3"
  severity: Severity;
  status: Status;
  declinePct: number;             // positive number = % below baseline
  baseline: number;               // crates/day baseline average
  current: number;                // crates/day of most recent decline record (or recovery record)
  unit: "crates/day";
  durationDays: number;           // consecutive recorded decline days
  baselineWindow: number;         // number of records used for baseline (up to 7)
  latestDate: string;             // ISO date of latest decline record
  firstDeclineDate: string;       // ISO date of first day in streak
  signals: DeclineSignal[];
  factors: string[];              // suggested factors to investigate
  confidence: Confidence;
};

export type DeclineReport = {
  status: "ok" | "learning";
  message?: string;
  totalRecords: number;
  events: DeclineEvent[];
};

// ---------- helpers ----------

const CRATE_SIZE = 30;

function eggTotalCrates(e: EggRow): number {
  return e.r2 + e.r3 + e.r4 + e.extra / CRATE_SIZE;
}

/** Map a room name like "ROOM 2" / "Room 3" to the matching EggRow field. */
function roomEggAccessor(name: string): ((e: EggRow) => number) | null {
  const m = name.match(/(\d+)/);
  if (!m) return null;
  const n = m[1];
  if (n === "2") return (e) => e.r2;
  if (n === "3") return (e) => e.r3;
  if (n === "4") return (e) => e.r4;
  return null;
}

function severityFor(pct: number): Severity {
  if (pct >= 20) return "Critical";
  if (pct >= 15) return "High";
  if (pct >= 10) return "Moderate";
  if (pct >= 5) return "Watch";
  return "Monitoring";
}

function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  return Math.round(Math.abs(a - b) / 86400000);
}

/** Sort a copy of the eggs list newest → oldest by date. */
function sortedNewestFirst(eggs: EggRow[]): EggRow[] {
  return [...eggs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// ---------- core detection for a single production series ----------

type SeriesPoint = { date: string; value: number };

function detectSeries(series: SeriesPoint[]): {
  streak: SeriesPoint[]; // most recent consecutive decline records (newest first)
  baseline: number;
  baselineWindow: number;
  recovered?: { streak: SeriesPoint[]; baseline: number; baselineWindow: number; recoveryPoint: SeriesPoint };
} | null {
  if (series.length < 8) return null; // need baseline (7) + at least 1 current record

  // Walk newest→oldest. Determine baseline as mean of 7 records immediately preceding
  // the first day in the current decline streak. A record is "in decline" when its
  // value is at least 5% below that baseline.
  //
  // Strategy: try to form a streak starting at index 0. Extend while the record is
  // below baseline computed from the 7 records that follow the streak.
  function tryBuildStreak(startIdx: number): {
    streak: SeriesPoint[];
    baseline: number;
    baselineWindow: number;
  } | null {
    let end = startIdx; // inclusive end of streak (newer index)
    // Extend streak: streak = series[startIdx..k]; baseline = mean of series[k+1..k+7]
    for (let k = startIdx; k < series.length; k++) {
      const baseSlice = series.slice(k + 1, k + 8);
      if (baseSlice.length < 7) break;
      const baseline = baseSlice.reduce((s, p) => s + p.value, 0) / baseSlice.length;
      if (baseline <= 0) break;
      const pct = ((baseline - series[k].value) / baseline) * 100;
      if (pct >= 5) {
        end = k;
        continue;
      }
      break;
    }
    const streak = series.slice(startIdx, end + 1);
    const baseSlice = series.slice(end + 1, end + 8);
    if (streak.length === 0 || baseSlice.length < 7) return null;
    const baseline = baseSlice.reduce((s, p) => s + p.value, 0) / baseSlice.length;
    // Confirm the newest streak point is actually in decline (guards startIdx=0 no-decline)
    const pct0 = ((baseline - streak[0].value) / baseline) * 100;
    if (pct0 < 5) return null;
    return { streak, baseline, baselineWindow: baseSlice.length };
  }

  const active = tryBuildStreak(0);
  if (active) {
    return { streak: active.streak, baseline: active.baseline, baselineWindow: active.baselineWindow };
  }

  // No active decline. Look for a recently recovered decline: the most recent record
  // is within 5% of a baseline, but the one(s) before it formed a decline streak.
  // Scan for the newest streak in the last 21 records.
  for (let start = 1; start < Math.min(series.length - 7, 21); start++) {
    const built = tryBuildStreak(start);
    if (built && built.streak.length >= 2) {
      // recovery point is the record just newer than the streak (index start-1)
      const recovery = series[start - 1];
      const pctRecovery = ((built.baseline - recovery.value) / built.baseline) * 100;
      if (pctRecovery < 5) {
        return {
          streak: [],
          baseline: 0,
          baselineWindow: 0,
          recovered: { ...built, recoveryPoint: recovery },
        };
      }
    }
  }
  return null;
}

// ---------- cross-signal analysis ----------

function analyseSignals(args: {
  streakDates: string[];
  baselineDates: string[];
  scopeRoomName: string | null;
  feed: Feed[];
  mortality: Mortality[];
  health: Health[];
}): { signals: DeclineSignal[]; factors: string[]; supportCount: number } {
  const { streakDates, baselineDates, scopeRoomName, feed, mortality, health } = args;
  const signals: DeclineSignal[] = [];
  const factors = new Set<string>();

  const inStreak = (d: string) => streakDates.includes(d);
  const inBaseline = (d: string) => baselineDates.includes(d);

  const roomMatches = (recordRoom: string) => {
    if (!scopeRoomName) return true;
    return recordRoom.trim().toUpperCase() === scopeRoomName.trim().toUpperCase();
  };

  // Feed: compare avg bags/day during streak vs baseline
  const feedStreak = feed.filter((f) => inStreak(f.date) && roomMatches(f.room));
  const feedBase = feed.filter((f) => inBaseline(f.date) && roomMatches(f.room));
  if (feedStreak.length > 0 && feedBase.length > 0) {
    const perDay = (arr: Feed[], dates: string[]) => {
      const unique = new Set(arr.map((f) => f.date));
      const denom = Math.max(1, unique.size);
      return arr.reduce((s, f) => s + f.bags, 0) / denom;
    };
    const s = perDay(feedStreak, streakDates);
    const b = perDay(feedBase, baselineDates);
    if (b > 0) {
      const diffPct = ((b - s) / b) * 100;
      if (diffPct >= 5) {
        signals.push({ label: `Feed usage ↓ ${diffPct.toFixed(0)}%`, detail: "vs baseline period" });
        factors.add("Feed intake");
      } else if (diffPct <= -10) {
        signals.push({ label: `Feed usage ↑ ${Math.abs(diffPct).toFixed(0)}%`, detail: "vs baseline period" });
        factors.add("Feed conversion efficiency");
      }
    }
  } else if (feedBase.length > 0 && feedStreak.length === 0) {
    signals.push({ label: "No feed usage recorded during decline period" });
    factors.add("Feed intake");
  }

  // Mortality within decline period
  const mortStreak = mortality.filter((m) => inStreak(m.date) && roomMatches(m.room));
  const totalLoss = mortStreak.reduce((s, m) => s + m.loss, 0);
  if (totalLoss > 0) {
    const causes = new Set(mortStreak.map((m) => (m.cause || "").toLowerCase()).filter(Boolean));
    const heat = [...causes].some((c) => c.includes("heat"));
    const disease = [...causes].some((c) => c.includes("disease") || c.includes("infect") || c.includes("newcastle") || c.includes("flu"));
    signals.push({
      label: `Mortality +${totalLoss} bird${totalLoss === 1 ? "" : "s"}`,
      detail: heat ? "including heat-stress losses" : disease ? "including disease-linked losses" : "during decline period",
    });
    factors.add("Flock health");
    if (heat) factors.add("Heat stress / ventilation");
    if (disease) factors.add("Disease investigation");
  }

  // Health records within decline period
  const healthStreak = health.filter((h) => inStreak(h.date) && (h.scope === "Whole Farm" || roomMatches(h.scope)));
  if (healthStreak.length > 0) {
    const types = new Set(healthStreak.map((h) => h.type));
    for (const t of types) {
      signals.push({ label: `Recent ${t.toLowerCase()} record`, detail: undefined });
    }
    if (types.has("Vaccination")) factors.add("Post-vaccination monitoring");
    if (types.has("Medication") || types.has("Treatment")) factors.add("Flock health");
    if (types.has("Observation")) factors.add("Reported observations");
  }

  return { signals, factors: [...factors], supportCount: signals.length };
}

// ---------- main entry ----------

export function detectProductionDecline(input: {
  eggs: EggRow[];
  rooms: Room[];
  mortality: Mortality[];
  feed: Feed[];
  health: Health[];
}): DeclineReport {
  const { eggs, rooms, mortality, feed, health } = input;
  const ordered = sortedNewestFirst(eggs);
  const total = ordered.length;

  if (total < 8) {
    return {
      status: "learning",
      totalRecords: total,
      events: [],
      message: `Learning farm production pattern — ${Math.max(0, 8 - total)} more production record${8 - total === 1 ? "" : "s"} required to establish a 7-day baseline.`,
    };
  }

  const events: DeclineEvent[] = [];

  // ---- Farm-level ----
  const farmSeries: SeriesPoint[] = ordered.map((e) => ({ date: e.date, value: eggTotalCrates(e) }));
  const farmResult = detectSeries(farmSeries);
  if (farmResult) {
    if (farmResult.streak.length > 0) {
      const streakDates = farmResult.streak.map((p) => p.date);
      const baselineDates = ordered.slice(farmResult.streak.length, farmResult.streak.length + 7).map((e) => e.date);
      const current = farmResult.streak[0].value;
      const declinePct = ((farmResult.baseline - current) / farmResult.baseline) * 100;
      const { signals, factors, supportCount } = analyseSignals({
        streakDates, baselineDates, scopeRoomName: null, feed, mortality, health,
      });
      events.push({
        scope: "Farm",
        scopeLabel: "Whole Farm",
        severity: severityFor(declinePct),
        status: "Active",
        declinePct,
        baseline: farmResult.baseline,
        current,
        unit: "crates/day",
        durationDays: farmResult.streak.length,
        baselineWindow: farmResult.baselineWindow,
        latestDate: farmResult.streak[0].date,
        firstDeclineDate: farmResult.streak[farmResult.streak.length - 1].date,
        signals,
        factors,
        confidence: computeConfidence(farmResult.streak.length, farmResult.baselineWindow, supportCount),
      });
    } else if (farmResult.recovered) {
      const rec = farmResult.recovered;
      const streakDates = rec.streak.map((p) => p.date);
      const baselineDates = ordered
        .slice(ordered.findIndex((e) => e.date === rec.streak[rec.streak.length - 1].date) + 1)
        .slice(0, 7)
        .map((e) => e.date);
      const worst = rec.streak.reduce((w, p) => (p.value < w.value ? p : w), rec.streak[0]);
      const declinePct = ((rec.baseline - worst.value) / rec.baseline) * 100;
      const { signals, factors, supportCount } = analyseSignals({
        streakDates, baselineDates, scopeRoomName: null, feed, mortality, health,
      });
      events.push({
        scope: "Farm",
        scopeLabel: "Whole Farm",
        severity: severityFor(declinePct),
        status: "Recovered",
        declinePct,
        baseline: rec.baseline,
        current: rec.recoveryPoint.value,
        unit: "crates/day",
        durationDays: rec.streak.length,
        baselineWindow: rec.baselineWindow,
        latestDate: rec.recoveryPoint.date,
        firstDeclineDate: rec.streak[rec.streak.length - 1].date,
        signals,
        factors,
        confidence: computeConfidence(rec.streak.length, rec.baselineWindow, supportCount),
      });
    }
  }

  // ---- Room-level ----
  for (const room of rooms) {
    const accessor = roomEggAccessor(room.name);
    if (!accessor) continue;
    const series: SeriesPoint[] = ordered.map((e) => ({ date: e.date, value: accessor(e) }));
    // Filter series to only records where this room actually reported (>0 in baseline avg would still be valid).
    // Skip if all zeros (room inactive).
    if (series.every((p) => p.value === 0)) continue;
    const res = detectSeries(series);
    if (!res) continue;
    if (res.streak.length > 0) {
      const streakDates = res.streak.map((p) => p.date);
      const baselineDates = ordered.slice(res.streak.length, res.streak.length + 7).map((e) => e.date);
      const current = res.streak[0].value;
      const declinePct = ((res.baseline - current) / res.baseline) * 100;
      const { signals, factors, supportCount } = analyseSignals({
        streakDates, baselineDates, scopeRoomName: room.name, feed, mortality, health,
      });
      events.push({
        scope: "Room",
        scopeLabel: room.name,
        severity: severityFor(declinePct),
        status: "Active",
        declinePct,
        baseline: res.baseline,
        current,
        unit: "crates/day",
        durationDays: res.streak.length,
        baselineWindow: res.baselineWindow,
        latestDate: res.streak[0].date,
        firstDeclineDate: res.streak[res.streak.length - 1].date,
        signals,
        factors,
        confidence: computeConfidence(res.streak.length, res.baselineWindow, supportCount),
      });
    } else if (res.recovered) {
      const rec = res.recovered;
      const streakDates = rec.streak.map((p) => p.date);
      const baselineDates = ordered.slice(ordered.findIndex((e) => e.date === rec.streak[rec.streak.length - 1].date) + 1).slice(0, 7).map((e) => e.date);
      const worst = rec.streak.reduce((w, p) => (p.value < w.value ? p : w), rec.streak[0]);
      const declinePct = ((rec.baseline - worst.value) / rec.baseline) * 100;
      const { signals, factors, supportCount } = analyseSignals({
        streakDates, baselineDates, scopeRoomName: room.name, feed, mortality, health,
      });
      events.push({
        scope: "Room",
        scopeLabel: room.name,
        severity: severityFor(declinePct),
        status: "Recovered",
        declinePct,
        baseline: rec.baseline,
        current: rec.recoveryPoint.value,
        unit: "crates/day",
        durationDays: rec.streak.length,
        baselineWindow: rec.baselineWindow,
        latestDate: rec.recoveryPoint.date,
        firstDeclineDate: rec.streak[rec.streak.length - 1].date,
        signals,
        factors,
        confidence: computeConfidence(rec.streak.length, rec.baselineWindow, supportCount),
      });
    }
  }

  // Sort: Active before Recovered; then by severity weight desc; then by declinePct desc.
  const sevWeight: Record<Severity, number> = { Monitoring: 0, Watch: 1, Moderate: 2, High: 3, Critical: 4 };
  events.sort((a, b) => {
    if (a.status !== b.status) return a.status === "Active" ? -1 : 1;
    if (sevWeight[b.severity] !== sevWeight[a.severity]) return sevWeight[b.severity] - sevWeight[a.severity];
    return b.declinePct - a.declinePct;
  });

  return { status: "ok", totalRecords: total, events };
}

function computeConfidence(duration: number, baselineWindow: number, supportCount: number): Confidence {
  if (baselineWindow < 7) return "Low";
  if (duration >= 3 && supportCount >= 1) return "High";
  if (duration >= 3) return "Moderate";
  if (duration === 2 && supportCount >= 1) return "Moderate";
  if (duration === 2) return "Moderate";
  return "Low";
}

export function severityStyle(sev: Severity): { badge: string; ring: string; dot: string } {
  switch (sev) {
    case "Critical": return { badge: "bg-red-600 text-white", ring: "border-red-500/50", dot: "bg-red-500" };
    case "High":     return { badge: "bg-orange-500 text-white", ring: "border-orange-400/50", dot: "bg-orange-500" };
    case "Moderate": return { badge: "bg-amber-500 text-white", ring: "border-amber-400/50", dot: "bg-amber-500" };
    case "Watch":    return { badge: "bg-yellow-400 text-black", ring: "border-yellow-400/50", dot: "bg-yellow-400" };
    default:         return { badge: "bg-slate-400 text-white", ring: "border-slate-300/50", dot: "bg-slate-400" };
  }
}
