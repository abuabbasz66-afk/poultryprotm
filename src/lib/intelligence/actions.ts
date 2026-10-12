/**
 * Action Centre helpers — pure, React-free.
 *
 * Adds priority, evidence quality and comparison period to engine alerts,
 * documents every rule, applies dismissal cooldowns and builds the
 * before/after follow-up comparison. Nothing here claims an action caused
 * a change; follow-up only reports what the records show afterwards.
 */
import type { IntelAlert, IntelCategory, IntelInput, IntelSeverity } from "./engine";
import { toDateKey } from "@/lib/date-key";

export type ActionPriority = "high" | "medium" | "low";
export type EvidenceQuality = "strong" | "limited" | "insufficient";
export type ActionStatus =
  "active" | "acknowledged" | "assigned" | "in_progress" | "resolved" | "dismissed";
export type ActionVerb =
  "acknowledge" | "assign" | "start" | "resolve" | "dismiss" | "reopen" | "note";

export const OPEN_STATUSES: ActionStatus[] = ["active", "acknowledged", "assigned", "in_progress"];
export const isOpen = (s: ActionStatus) => OPEN_STATUSES.includes(s);

export function priorityFor(severity: IntelSeverity): ActionPriority {
  return severity === "critical" || severity === "warning"
    ? "high"
    : severity === "watch"
      ? "medium"
      : "low";
}

/** Plain-language documentation for every rule (shown under "How this was worked out"). */
export type RuleDoc = {
  requires: string;
  condition: string;
  baseline: string;
  silentWhen: string;
  lowData: string;
};

export const RULES: Record<IntelCategory, RuleDoc> = {
  production: {
    requires: "Daily egg records and live bird counts per room.",
    condition:
      "Lay % is clearly below the farm's (or room's) own recent average, not a small daily swing.",
    baseline: "Average of up to 7 recorded days before the day checked (at least 3).",
    silentWhen:
      "Fewer than 3 earlier recorded days, or the drop is within normal day-to-day variation.",
    lowData: "No alert is raised; a 'not enough history yet' note is shown instead.",
  },
  mortality: {
    requires: "Mortality entries and the birds present in each room.",
    condition: "Deaths are well above the recent daily average for the farm or room.",
    baseline: "Recent recorded days before today, relative to birds at risk.",
    silentWhen: "Losses are within the usual range, or there is too little history.",
    lowData:
      "Shown only as a data note; days without an entry are never counted as zero deaths unless recorded.",
  },
  feed: {
    requires: "Daily feed usage records.",
    condition: "Today's feed use is well above or below the recent daily average.",
    baseline: "Average of up to 7 recorded feed days before today.",
    silentWhen: "Fewer than 3 earlier feed days, or usage within the normal range.",
    lowData: "No alert; a data note is shown.",
  },
  inventory: {
    requires: "Feed stock lots (purchases, adjustments) and recent feed usage.",
    condition: "Recorded stock is empty, or covers fewer than 10 days at recent usage.",
    baseline: "Average daily feed used recently (feed issued from stock, not purchases).",
    silentWhen: "No stock lots recorded, or no recent usage to estimate from.",
    lowData:
      "When fewer than 4 recent usage days exist, the days-left figure is marked as unreliable.",
  },
  health: {
    requires: "Health records per room.",
    condition: "Several non-routine health records in the same room within 7 days.",
    baseline: "Count of records in the last 7 days.",
    silentWhen: "Only routine vaccination or vitamin entries.",
    lowData: "Not applicable — only recorded events are counted.",
  },
  weather: {
    requires: "The farm's location and the existing weather service.",
    condition: "Heat or cold risk for the flock's age, adjusted for humidity when available.",
    baseline: "Fixed temperature bands for poultry (reference standard, not farm history).",
    silentWhen: "Conditions are comfortable for the flock.",
    lowData: "Without humidity, the advice is based on temperature only and says so.",
  },
  finance: {
    requires: "Recorded expenses and revenue.",
    condition:
      "Feed cost or daily expenses clearly above their recent average, or revenue down week on week.",
    baseline: "The farm's own previous 7 days or recent average.",
    silentWhen: "No comparable earlier figures, or changes within the normal range.",
    lowData: "Missing prices or sales are reported as a data gap, never as zero.",
  },
  operations: {
    requires: "Daily egg records.",
    condition:
      "Today's records are missing late in the day, records stopped for several days, or a zero-egg day was entered while birds are present.",
    baseline: "Not applicable — this checks the records themselves.",
    silentWhen: "Records are up to date.",
    lowData: "Not applicable.",
  },
};

function countDays(dates: (string | null | undefined)[], from: string, to: string) {
  const s = new Set<string>();
  for (const d of dates) {
    const k = toDateKey(d ?? null);
    if (k && k >= from && k < to) s.add(k);
  }
  return s.size;
}

function minus(key: string, days: number) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() - days);
  return toDateKey(d)!;
}

/** Evidence quality and comparison period for one alert, from the same input the engine used. */
export function assessEvidence(
  a: IntelAlert,
  i: IntelInput,
): { evidence: EvidenceQuality; comparison: string } {
  const start = minus(a.refDate, 7);
  const span = `previous 7 days (${start} to ${minus(a.refDate, 1)})`;
  const grade = (n: number, strong = 6, limited = 3): EvidenceQuality =>
    n >= strong ? "strong" : n >= limited ? "limited" : "insufficient";
  switch (a.category) {
    case "production": {
      const n = countDays(
        i.eggs.map((e) => e.date),
        start,
        a.refDate,
      );
      return {
        evidence: grade(n),
        comparison: `${a.refDate} vs ${n} recorded days in the ${span}`,
      };
    }
    case "feed": {
      const n = countDays(
        i.feed.map((f) => f.date),
        start,
        a.refDate,
      );
      return {
        evidence: grade(n),
        comparison: `${a.refDate} vs ${n} recorded feed days in the ${span}`,
      };
    }
    case "inventory": {
      const n = countDays(
        i.feed.map((f) => f.date),
        minus(i.todayKey, 7),
        i.todayKey,
      );
      return {
        evidence: n >= 4 ? "strong" : n >= 1 ? "limited" : "insufficient",
        comparison: `Current stock vs average usage over ${n} recorded days in the last 7`,
      };
    }
    case "mortality": {
      // Days with any production record show the farm was recording that day.
      const n = countDays(
        i.eggs.map((e) => e.date),
        start,
        a.refDate,
      );
      return { evidence: grade(n), comparison: `${a.refDate} vs the ${span}` };
    }
    case "finance": {
      const n = countDays(
        [...i.expenses.map((e) => e.entry_date), ...i.revenue.map((r) => r.entry_date)],
        minus(a.refDate, 14),
        a.refDate,
      );
      return {
        evidence: grade(n, 6, 2),
        comparison: `Recent figures vs the farm's previous 7–14 days`,
      };
    }
    case "weather":
      return {
        evidence: i.weather?.humidity == null ? "limited" : "strong",
        comparison: "Current forecast vs poultry temperature bands (reference standard)",
      };
    case "health":
      return { evidence: "strong", comparison: "Health records in the last 7 days" };
    case "operations":
      return { evidence: "strong", comparison: "Records entered vs expected daily records" };
  }
}

export type ActionItem = IntelAlert & {
  priority: ActionPriority;
  evidence: EvidenceQuality;
  comparison: string;
};

export function toActionItem(a: IntelAlert, i: IntelInput): ActionItem {
  return { ...a, priority: priorityFor(a.severity), ...assessEvidence(a, i) };
}

/** A dismissed alert stays quiet during its cooldown unless it became critical. */
export function suppressedByCooldown(
  a: Pick<IntelAlert, "severity">,
  state: { status: ActionStatus; cooldown_until: string | null; severity: string } | undefined,
  now = Date.now(),
): boolean {
  if (!state || state.status !== "dismissed") return false;
  if (!state.cooldown_until || new Date(state.cooldown_until).getTime() <= now) return false;
  return !(a.severity === "critical" && state.severity !== "critical");
}

/** Which actions a status allows (mirrors the database rules). */
export function allowedActions(status: ActionStatus): ActionVerb[] {
  if (status === "resolved" || status === "dismissed") return ["reopen", "note"];
  const out: ActionVerb[] = [];
  if (status === "active") out.push("acknowledge");
  out.push("assign");
  if (status !== "in_progress") out.push("start");
  out.push("resolve", "dismiss", "note");
  return out;
}

export const DISMISS_REASONS = [
  "Recorded wrongly",
  "Already handled",
  "Not relevant to this farm",
] as const;

// ---------------------------------------------------------------------------
// Follow-up: what the records show after an alert was resolved.
// ---------------------------------------------------------------------------

export type FollowUp = {
  metric: string;
  before: number | null;
  after: number | null;
  beforeDays: number;
  afterDays: number;
  /** "improved" / "worse" / "similar" / "waiting" (not enough days after). */
  outcome: "improved" | "worse" | "similar" | "waiting" | "no-data";
};

/**
 * Compares the daily average of `series` in the 7 days before `resolvedKey`
 * with the days after it (up to 7). `higherIsBetter` sets the direction.
 * Changes under 5% are "similar". Needs ≥3 recorded days on each side.
 */
export function followUp(
  series: Map<string, number>,
  resolvedKey: string,
  todayKey: string,
  metric: string,
  higherIsBetter: boolean,
): FollowUp {
  const beforeFrom = minus(resolvedKey, 7);
  const before: number[] = [];
  const after: number[] = [];
  for (const [k, v] of series) {
    if (k >= beforeFrom && k < resolvedKey) before.push(v);
    else if (k > resolvedKey && k <= todayKey && k <= plus(resolvedKey, 7)) after.push(v);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const b = avg(before);
  const a = avg(after);
  let outcome: FollowUp["outcome"];
  if (before.length < 3) outcome = "no-data";
  else if (after.length < 3) outcome = "waiting";
  else {
    const change = b ? (a! - b) / Math.abs(b) : a! > 0 ? 1 : 0;
    if (Math.abs(change) < 0.05) outcome = "similar";
    else outcome = change > 0 === higherIsBetter ? "improved" : "worse";
  }
  return {
    metric,
    before: b,
    after: a,
    beforeDays: before.length,
    afterDays: after.length,
    outcome,
  };
}

function plus(key: string, days: number) {
  return minus(key, -days);
}

/** How often each condition has come back (resolved or dismissed then seen again). */
export function recurrence(events: { alert_key: string; action: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events)
    if (e.action === "reopened") m.set(e.alert_key, (m.get(e.alert_key) ?? 0) + 1);
  return m;
}
