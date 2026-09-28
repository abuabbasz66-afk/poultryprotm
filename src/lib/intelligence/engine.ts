/**
 * Farm Intelligence engine — pure, React-free.
 *
 * Turns the farm's own cached records into alerts, priorities, headline metrics,
 * room status and a plain-language summary. Every comparison is against the
 * farm's OWN recent baseline; when there is not enough history, no alert is
 * raised and a data gap is reported instead. Nothing here diagnoses disease or
 * prescribes medication.
 *
 * Alert keys are stable per condition (e.g. "production:room:Room 3") so a
 * condition that persists updates one alert instead of creating duplicates.
 */
import type { EggRow, Feed, Health, Mortality, Room } from "@/lib/farm-data";
import type { ExpenseRow, RevenueRow } from "@/lib/finance-data";
import { computeDailyProduction } from "@/lib/production-percent";
import { totalEggsFromRow } from "@/lib/egg-normalize";
import { toDateKey } from "@/lib/date-key";

export type IntelSeverity = "normal" | "watch" | "warning" | "critical";
export type IntelCategory =
  | "production"
  | "mortality"
  | "feed"
  | "health"
  | "weather"
  | "finance"
  | "inventory"
  | "operations";

export const INTEL_SEVERITY_ORDER: IntelSeverity[] = ["normal", "watch", "warning", "critical"];
export const intelRank = (s: IntelSeverity) => INTEL_SEVERITY_ORDER.indexOf(s);

export type IntelFigure = { label: string; value: string };

export type IntelAlert = {
  /** Stable per condition; used for persistence and de-duplication. */
  key: string;
  category: IntelCategory;
  severity: IntelSeverity;
  title: string;
  /** WHAT HAPPENED */
  happened: string;
  /** WHY DOES IT MATTER */
  why: string;
  /** WHAT SHOULD I CHECK */
  checks: string[];
  figures: IntelFigure[];
  room?: string;
  /** Date the condition was observed (YYYY-MM-DD). */
  refDate: string;
  /** Transparent ordering inputs (never a hidden score). */
  deviationPct: number;
  durationDays: number;
  birdsAffected: number;
  action: { label: string; to: string; search?: Record<string, string>; hash?: string };
};

export type IntelMetricStatus = "normal" | "watch" | "warning" | "critical" | "unknown";
export type IntelMetric = {
  key: "birds" | "production" | "feed" | "mortality" | "weather";
  label: string;
  value: string;
  detail: string;
  status: IntelMetricStatus;
};

export type RoomStatus = {
  room: string;
  birds: number;
  status: "stable" | "monitor" | "attention";
  reason: string | null;
};

export type WeatherInput = {
  tempC: number;
  humidity: number | null;
  severity: IntelSeverity;
  label: string;
  message: string;
  actions: string[];
  heat: boolean;
};

export type IntelPermissions = {
  production: boolean;
  mortality: boolean;
  feed: boolean;
  health: boolean;
  inventory: boolean;
  finance: boolean;
  weather: boolean;
};

export type IntelInput = {
  todayKey: string;
  hour: number;
  rooms: Room[];
  eggs: EggRow[];
  mortality: Mortality[];
  feed: Feed[];
  health: Health[];
  expenses: ExpenseRow[];
  revenue: RevenueRow[];
  /** Feed stock from existing inventory analytics; null when not loaded. */
  stock: { hasLots: boolean; stockKg: number; avgDailyKg: number } | null;
  weather: WeatherInput | null;
  permissions: IntelPermissions;
  sync: { offline: boolean; pending: number };
};

export type FarmIntelligence = {
  alerts: IntelAlert[];
  priorities: IntelAlert[];
  metrics: IntelMetric[];
  rooms: RoomStatus[];
  recommendations: string[];
  summary: string;
  dataGaps: string[];
  /** Categories that had enough input to be judged (used to auto-resolve). */
  evaluated: IntelCategory[];
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
const pct1 = (n: number) => `${Math.abs(n).toFixed(1)}%`;
const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const plural = (n: number, w: string) => `${n.toLocaleString()} ${w}${n === 1 ? "" : "s"}`;

export function shiftKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00`);
  d.setTime(d.getTime() + days * DAY);
  return toDateKey(d)!;
}

function sumBy<T>(
  rows: T[],
  dateOf: (r: T) => string,
  valueOf: (r: T) => number,
  match?: (r: T) => boolean,
) {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (match && !match(r)) continue;
    const k = toDateKey(dateOf(r));
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + valueOf(r));
  }
  return map;
}

/** Average of up to `window` recorded days before `ref`; null below `min` days. */
export function recordedBaseline(
  map: Map<string, number>,
  ref: string,
  window = 7,
  min = 3,
): number | null {
  const prior = [...map.entries()]
    .filter(([k]) => k < ref)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, window);
  if (prior.length < min) return null;
  return prior.reduce((s, [, v]) => s + v, 0) / prior.length;
}

/** Most recent recorded day within `maxAge` days of today. */
function latestKey(map: Map<string, number>, today: string, maxAge: number): string | null {
  const floor = shiftKey(today, -maxAge);
  const keys = [...map.keys()].filter((k) => k <= today && k >= floor).sort();
  return keys.length ? keys[keys.length - 1] : null;
}

/** Consecutive recorded days ending at `ref` that satisfy `bad`. */
function streak(map: Map<string, number>, ref: string, bad: (v: number) => boolean): number {
  const keys = [...map.keys()].filter((k) => k <= ref).sort((a, b) => (a < b ? 1 : -1));
  let n = 0;
  for (const k of keys) {
    if (!bad(map.get(k)!)) break;
    n++;
  }
  return n;
}

function severityFor(value: number, bands: [IntelSeverity, number][]): IntelSeverity | null {
  let out: IntelSeverity | null = null;
  for (const [sev, min] of bands) if (value >= min) out = sev;
  return out;
}

const dayWord = (ref: string, today: string) =>
  ref === today ? "today" : ref === shiftKey(today, -1) ? "yesterday" : `on ${ref}`;

// ---------------------------------------------------------------------------
// detectors
// ---------------------------------------------------------------------------

function productionAlerts(
  i: IntelInput,
  gaps: string[],
): {
  alerts: IntelAlert[];
  latest: { pct: number | null; base: number | null; ref: string | null };
} {
  const out: IntelAlert[] = [];
  const farmPct = new Map<string, number>();
  const roomPct = new Map<string, Map<string, number>>();
  const roomBirds = new Map<string, number>();
  for (const row of i.eggs) {
    const key = toDateKey(row.date);
    if (!key) continue;
    const d = computeDailyProduction(row, i.rooms, i.mortality);
    if (d.overallPct !== null) farmPct.set(key, d.overallPct);
    for (const r of d.rooms) {
      if (r.pct === null) continue;
      if (!roomPct.has(r.roomName)) roomPct.set(r.roomName, new Map());
      roomPct.get(r.roomName)!.set(key, r.pct);
      if (key >= (latestKey(roomPct.get(r.roomName)!, i.todayKey, 3650) ?? ""))
        roomBirds.set(r.roomName, r.birds ?? 0);
    }
  }
  const ref = latestKey(farmPct, i.todayKey, 2);
  const base = ref ? recordedBaseline(farmPct, ref) : null;
  if (!ref) {
    if (i.eggs.length)
      gaps.push(
        "No production recorded in the last 2 days, so today's production can't be compared yet.",
      );
    return { alerts: out, latest: { pct: null, base: null, ref: null } };
  }
  if (base === null)
    gaps.push("Not enough production history yet to compare with your usual pattern.");

  const judge = (scope: string, map: Map<string, number>, birds: number, room?: string) => {
    const r = latestKey(map, i.todayKey, 2);
    if (!r) return null;
    const b = recordedBaseline(map, r);
    const now = map.get(r)!;
    if (b === null || b <= 0) return null;
    const drop = ((b - now) / b) * 100;
    const sev = severityFor(drop, [
      ["watch", 5],
      ["warning", 10],
      ["critical", 25],
    ]);
    if (!sev) return null;
    const days = streak(map, r, (v) => v < b * 0.95);
    const a: IntelAlert = {
      key: room ? `production:room:${room}` : "production:farm",
      category: "production",
      severity: sev,
      title: `${scope} production is below its recent pattern`,
      happened: `${scope} laid at ${now.toFixed(1)}% ${dayWord(r, i.todayKey)}, ${pct1(drop)} below its recent average of ${b.toFixed(1)}%${days > 1 ? `. It has stayed below its pattern for ${days} days` : ""}.`,
      why: "A continued decline can reduce egg income and is often an early sign that birds need attention.",
      checks: [
        "Feed intake",
        "Water availability",
        "Heat conditions",
        "Recent mortality",
        "Health observations",
      ],
      figures: [
        { label: "Current", value: `${now.toFixed(1)}%` },
        { label: "Recent average", value: `${b.toFixed(1)}%` },
        ...(days > 1 ? [{ label: "Duration", value: `${days} days` }] : []),
      ],
      room,
      refDate: r,
      deviationPct: drop,
      durationDays: days,
      birdsAffected: birds,
      action: {
        label: "View Production",
        to: "/dashboard",
        search: { area: "records" },
        hash: "production",
      },
    };
    return a;
  };

  for (const [name, map] of roomPct) {
    const a = judge(name, map, roomBirds.get(name) ?? 0, name);
    if (a) out.push(a);
  }
  if (out.length === 0) {
    const birds = i.rooms.reduce((s, r) => s + (r.current ?? 0), 0);
    const a = judge("Farm", farmPct, birds);
    if (a) out.push(a);
  }
  return { alerts: out, latest: { pct: farmPct.get(ref) ?? null, base, ref } };
}

function mortalityAlerts(
  i: IntelInput,
  gaps: string[],
): { alerts: IntelAlert[]; today: number | null; avg: number | null; sev: IntelSeverity | null } {
  const out: IntelAlert[] = [];
  const records = [
    ...i.mortality.map((m) => toDateKey(m.date)),
    ...i.eggs.map((e) => toDateKey(e.date)),
  ].filter(Boolean) as string[];
  const earliest = records.sort()[0];
  const hasHistory = !!earliest && earliest <= shiftKey(i.todayKey, -7);
  const farmMap = sumBy(
    i.mortality,
    (m) => m.date,
    (m) => Number(m.loss) || 0,
  );
  const todayLoss = farmMap.get(i.todayKey) ?? 0;
  if (!hasHistory) {
    gaps.push("Not enough mortality history yet to know your usual pattern.");
    return { alerts: out, today: farmMap.has(i.todayKey) ? todayLoss : null, avg: null, sev: null };
  }
  // Mortality is logged when birds die, so a day without a record counts as zero.
  const avgOf = (map: Map<string, number>) => {
    let s = 0;
    for (let d = 1; d <= 14; d++) s += map.get(shiftKey(i.todayKey, -d)) ?? 0;
    return s / 14;
  };

  const judge = (scope: string, map: Map<string, number>, birds: number, room?: string) => {
    const ref = map.has(i.todayKey) ? i.todayKey : shiftKey(i.todayKey, -1);
    const now = map.get(ref) ?? 0;
    const avg = avgOf(map);
    if (now < 3) return null;
    const ratio = avg > 0 ? now / avg : Infinity;
    const share = birds > 0 ? (now / birds) * 100 : 0;
    let sev: IntelSeverity | null = null;
    if (ratio >= 2) sev = "watch";
    if (ratio >= 3 && now >= 5) sev = "warning";
    if ((ratio >= 4 && now >= 10) || share >= 1) sev = "critical";
    if (!sev) return null;
    const vet = sev === "critical";
    const a: IntelAlert = {
      key: room ? `mortality:room:${room}` : "mortality:farm",
      category: "mortality",
      severity: sev,
      title: `${scope} mortality is higher than your usual pattern`,
      happened: `${plural(now, "bird")} lost ${dayWord(ref, i.todayKey)} in ${scope.toLowerCase() === "farm" ? "the farm" : scope}, against a recent average of ${avg.toFixed(1)} birds/day.`,
      why: vet
        ? "This pattern may require a health check. Consider contacting your veterinarian."
        : "This pattern may require a health check before more birds are affected.",
      checks: ["The affected room", "Water supply", "Feed access", "Recent health observations"],
      figures: [
        { label: ref === i.todayKey ? "Today" : "Yesterday", value: plural(now, "bird") },
        { label: "Recent average", value: `${avg.toFixed(1)} birds/day` },
        ...(birds > 0 ? [{ label: "Share of flock", value: `${share.toFixed(2)}%` }] : []),
      ],
      room,
      refDate: ref,
      deviationPct: avg > 0 ? (ratio - 1) * 100 : 100,
      durationDays: 1,
      birdsAffected: now,
      action: {
        label: "View Mortality",
        to: "/dashboard",
        search: { area: "records" },
        hash: "mortality",
      },
    };
    return a;
  };

  for (const room of i.rooms) {
    const map = sumBy(
      i.mortality,
      (m) => m.date,
      (m) => Number(m.loss) || 0,
      (m) => m.room === room.name,
    );
    const a = judge(room.name, map, room.current ?? 0, room.name);
    if (a) out.push(a);
  }
  if (out.length === 0) {
    const a = judge(
      "Farm",
      farmMap,
      i.rooms.reduce((s, r) => s + (r.current ?? 0), 0),
    );
    if (a) out.push(a);
  }
  const worst = out.reduce<IntelSeverity | null>(
    (w, a) => (!w || intelRank(a.severity) > intelRank(w) ? a.severity : w),
    null,
  );
  return {
    alerts: out,
    today: farmMap.has(i.todayKey) ? todayLoss : null,
    avg: avgOf(farmMap),
    sev: worst,
  };
}

function feedAlerts(
  i: IntelInput,
  gaps: string[],
): { alerts: IntelAlert[]; today: number | null; status: IntelMetricStatus } {
  const map = sumBy(
    i.feed,
    (f) => f.date,
    (f) => Number(f.bags) || 0,
  );
  const today = map.get(i.todayKey) ?? null;
  if (today === null) return { alerts: [], today, status: "unknown" };
  const base = recordedBaseline(map, i.todayKey);
  if (base === null || base <= 0) {
    gaps.push("Not enough feed history yet to compare today's feed usage.");
    return { alerts: [], today, status: "unknown" };
  }
  const change = ((today - base) / base) * 100;
  const birds = i.rooms.reduce((s, r) => s + (r.current ?? 0), 0);
  const figures = [
    ...(birds > 0 ? [{ label: "Birds", value: birds.toLocaleString() }] : []),
    { label: "Today's feed", value: `${today} bags` },
    { label: "Recent average", value: `${base.toFixed(1)} bags` },
  ];
  const high = severityFor(change, [
    ["watch", 15],
    ["warning", 30],
  ]);
  const low = severityFor(-change, [
    ["watch", 20],
    ["warning", 40],
  ]);
  const sev = high ?? low;
  if (!sev) return { alerts: [], today, status: "normal" };
  const a: IntelAlert = {
    key: high ? "feed:usage-high" : "feed:usage-low",
    category: "feed",
    severity: sev,
    title: high
      ? "Feed usage is higher than your recent pattern"
      : "Feed usage is lower than your recent pattern",
    happened: `${today} bags were used today, ${pct1(change)} ${high ? "above" : "below"} your recent average of ${base.toFixed(1)} bags.`,
    why: high
      ? "Extra feed raises your cost per egg, and it can point to wastage or a change in the flock."
      : "Birds eating less often comes before a drop in production or a health problem.",
    checks: high
      ? [
          "Feed wastage",
          "Feeder adjustment",
          "Bird activity",
          "Feed formulation",
          "Recent changes in flock condition",
        ]
      : ["Water availability", "Heat conditions", "Bird health", "Whether all feed was recorded"],
    figures,
    refDate: i.todayKey,
    deviationPct: Math.abs(change),
    durationDays: 1,
    birdsAffected: birds,
    action: { label: "View Feed", to: "/feed", search: { tab: "overview" } },
  };
  return { alerts: [a], today, status: sev };
}

function inventoryAlerts(i: IntelInput): IntelAlert[] {
  const s = i.stock;
  if (!s || !s.hasLots) return [];
  const action = { label: "View Inventory", to: "/feed", search: { tab: "inventory" } };
  if (s.stockKg <= 0) {
    return [
      {
        key: "inventory:feed-low",
        category: "inventory",
        severity: "warning",
        title: "Feed stock is empty in your records",
        happened: "Your recorded feed stock has run out.",
        why: "Birds that miss feed can drop production quickly.",
        checks: ["Your remaining physical stock", "Whether recent purchases were recorded"],
        figures: [{ label: "Stock", value: "0 kg" }],
        refDate: i.todayKey,
        deviationPct: 100,
        durationDays: 0,
        birdsAffected: 0,
        action,
      },
    ];
  }
  if (s.avgDailyKg <= 0) return [];
  const days = s.stockKg / s.avgDailyKg;
  const sev: IntelSeverity | null =
    days < 2 ? "critical" : days < 5 ? "warning" : days < 10 ? "watch" : null;
  if (!sev) return [];
  const d = Math.max(0, Math.floor(days));
  return [
    {
      key: "inventory:feed-low",
      category: "inventory",
      severity: sev,
      title: "Your feed stock may need replenishment soon",
      happened: `Approximately ${plural(d, "day")} of feed remaining at your recent usage.`,
      why: "Running out of feed can quickly affect production and bird welfare.",
      checks: ["Plan your next feed purchase", "Confirm the stock count in the store"],
      figures: [
        { label: "Stock", value: `${Math.round(s.stockKg).toLocaleString()} kg` },
        { label: "Daily usage", value: `${Math.round(s.avgDailyKg).toLocaleString()} kg` },
        { label: "Days left", value: `about ${d}` },
      ],
      refDate: i.todayKey,
      deviationPct: 100 - Math.min(100, days * 10),
      durationDays: 0,
      birdsAffected: 0,
      action,
    },
  ];
}

const ROUTINE = new Set(["Vaccination", "Vitamin"]);

function healthAlerts(i: IntelInput): IntelAlert[] {
  const from = shiftKey(i.todayKey, -6);
  const recent = i.health.filter((h) => {
    const k = toDateKey(h.date);
    return k && k >= from && k <= i.todayKey && !ROUTINE.has(h.type);
  });
  const byScope = new Map<string, number>();
  for (const h of recent) byScope.set(h.scope || "Farm", (byScope.get(h.scope || "Farm") ?? 0) + 1);
  const out: IntelAlert[] = [];
  for (const [scope, n] of byScope) {
    const sev = severityFor(n, [
      ["watch", 3],
      ["warning", 5],
    ]);
    if (!sev) continue;
    const room = i.rooms.find((r) => r.name === scope);
    out.push({
      key: room ? `health:room:${scope}` : `health:scope:${scope}`,
      category: "health",
      severity: sev,
      title: `Several health observations recorded in ${scope}`,
      happened: `${plural(n, "health record")} (treatments, medications or observations) in ${scope} over the last 7 days.`,
      why: "Repeated records in one place can mean a problem that needs a closer look.",
      checks: [
        "Inspect the room",
        "Review recent health records",
        "Consider asking your veterinarian if it continues",
      ],
      figures: [{ label: "Last 7 days", value: `${n}` }],
      room: room?.name,
      refDate: i.todayKey,
      deviationPct: n * 10,
      durationDays: 7,
      birdsAffected: room?.current ?? 0,
      action: {
        label: "View Health",
        to: "/dashboard",
        search: { area: "records" },
        hash: "health",
      },
    });
  }
  return out;
}

function weatherAlerts(i: IntelInput): IntelAlert[] {
  const w = i.weather;
  if (!w || intelRank(w.severity) < intelRank("watch")) return [];
  return [
    {
      key: w.heat ? "weather:heat" : "weather:cold",
      category: "weather",
      severity: w.severity,
      title: w.label,
      happened: `${Math.round(w.tempC)}°C${w.humidity != null ? ` with ${Math.round(w.humidity)}% humidity` : ""}. ${w.message}`,
      why: w.heat
        ? "Heat stress reduces feed intake and egg production, and can cause losses."
        : "Cold and drafts make birds use feed to keep warm and can stress young birds.",
      checks: w.actions.slice(0, 3),
      figures: [
        { label: "Temperature", value: `${Math.round(w.tempC)}°C` },
        ...(w.humidity != null ? [{ label: "Humidity", value: `${Math.round(w.humidity)}%` }] : []),
      ],
      refDate: i.todayKey,
      deviationPct: 0,
      durationDays: 0,
      birdsAffected: i.rooms.reduce((s, r) => s + (r.current ?? 0), 0),
      action: { label: "View Weather Advisory", to: "/weather" },
    },
  ];
}

function financeAlerts(i: IntelInput): IntelAlert[] {
  const out: IntelAlert[] = [];
  const action = { label: "View Finance", to: "/finance" };
  const week = (
    rows: { entry_date: string; amount: number }[],
    w: number,
    match?: (r: never) => boolean,
  ) => {
    const to = shiftKey(i.todayKey, -7 * w);
    const from = shiftKey(to, -6);
    return rows
      .filter((r) => r.entry_date >= from && r.entry_date <= to && (!match || match(r as never)))
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  };
  const compare = (
    rows: { entry_date: string; amount: number }[],
    match: ((r: never) => boolean) | undefined,
  ) => {
    const now = week(rows, 0, match);
    const prior = [1, 2, 3, 4].map((w) => week(rows, w, match));
    const active = prior.filter((v) => v > 0);
    if (active.length < 3) return null;
    const avg = prior.reduce((s, v) => s + v, 0) / 4;
    return avg > 0 ? { now, avg, change: ((now - avg) / avg) * 100 } : null;
  };

  const isFeed = (r: ExpenseRow) => /feed/i.test(`${r.subcategory} ${r.description ?? ""}`);
  const feedCost = compare(i.expenses, isFeed as (r: never) => boolean);
  if (feedCost) {
    const sev = severityFor(feedCost.change, [
      ["watch", 20],
      ["warning", 50],
    ]);
    if (sev)
      out.push({
        key: "finance:feed-cost",
        category: "finance",
        severity: sev,
        title: "Feed costs have increased compared with your recent average",
        happened: `Feed spending in the last 7 days was ${naira(feedCost.now)}, ${pct1(feedCost.change)} above your weekly average of ${naira(feedCost.avg)}.`,
        why: "Feed is usually the largest cost on a poultry farm, so it drives your profit.",
        checks: ["Recent feed prices", "Feed usage per bird", "Wastage"],
        figures: [
          { label: "Last 7 days", value: naira(feedCost.now) },
          { label: "Weekly average", value: naira(feedCost.avg) },
        ],
        refDate: i.todayKey,
        deviationPct: feedCost.change,
        durationDays: 7,
        birdsAffected: 0,
        action,
      });
  }
  const rev = compare(i.revenue, undefined);
  if (rev) {
    const sev = severityFor(-rev.change, [
      ["watch", 25],
      ["warning", 50],
    ]);
    if (sev)
      out.push({
        key: "finance:revenue-down",
        category: "finance",
        severity: sev,
        title: "Revenue is lower than your recent weeks",
        happened: `Sales in the last 7 days were ${naira(rev.now)}, ${pct1(rev.change)} below your weekly average of ${naira(rev.avg)}.`,
        why: "Lower sales reduce cash available for feed and running costs.",
        checks: [
          "Whether all sales were recorded",
          "Egg stock waiting to be sold",
          "Selling prices",
        ],
        figures: [
          { label: "Last 7 days", value: naira(rev.now) },
          { label: "Weekly average", value: naira(rev.avg) },
        ],
        refDate: i.todayKey,
        deviationPct: Math.abs(rev.change),
        durationDays: 7,
        birdsAffected: 0,
        action: { label: "View Finance", to: "/finance" },
      });
  }
  return out;
}

function operationsAlerts(i: IntelInput): IntelAlert[] {
  if (!i.permissions.production || i.eggs.length === 0 || i.hour < 18) return [];
  if (i.eggs.some((e) => toDateKey(e.date) === i.todayKey)) return [];
  return [
    {
      key: "operations:production-missing",
      category: "operations",
      severity: "watch",
      title: "No production recorded today",
      happened: "Egg collection has not been recorded yet today.",
      why: "Missing days make your trends and alerts less accurate.",
      checks: ["Record today's collection before the day closes"],
      figures: [],
      refDate: i.todayKey,
      deviationPct: 0,
      durationDays: 0,
      birdsAffected: 0,
      action: {
        label: "Record Production",
        to: "/dashboard",
        search: { area: "records" },
        hash: "production",
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

export function compareAlerts(a: IntelAlert, b: IntelAlert) {
  return (
    intelRank(b.severity) - intelRank(a.severity) ||
    b.deviationPct - a.deviationPct ||
    b.durationDays - a.durationDays ||
    b.birdsAffected - a.birdsAffected
  );
}

export function generateFarmIntelligence(i: IntelInput): FarmIntelligence {
  const gaps: string[] = [];
  const p = i.permissions;
  const evaluated: IntelCategory[] = [];
  const alerts: IntelAlert[] = [];

  const prod = p.production ? productionAlerts(i, gaps) : null;
  if (prod) {
    alerts.push(...prod.alerts);
    evaluated.push("production");
  }
  const mort = p.mortality ? mortalityAlerts(i, gaps) : null;
  if (mort) {
    alerts.push(...mort.alerts);
    evaluated.push("mortality");
  }
  const feed = p.feed ? feedAlerts(i, gaps) : null;
  if (feed) {
    alerts.push(...feed.alerts);
    evaluated.push("feed");
  }
  if (p.inventory && i.stock) {
    alerts.push(...inventoryAlerts(i));
    evaluated.push("inventory");
  }
  if (p.health) {
    alerts.push(...healthAlerts(i));
    evaluated.push("health");
  }
  if (p.weather && i.weather) {
    alerts.push(...weatherAlerts(i));
    evaluated.push("weather");
  }
  if (p.finance) {
    alerts.push(...financeAlerts(i));
    evaluated.push("finance");
  }
  if (p.production) {
    alerts.push(...operationsAlerts(i));
    evaluated.push("operations");
  }

  alerts.sort(compareAlerts);
  const priorities = alerts.filter((a) => intelRank(a.severity) >= intelRank("watch")).slice(0, 3);

  if (i.sync.offline || i.sync.pending > 0) {
    gaps.unshift("Some insights may be delayed because the latest farm data has not synced.");
  }

  const birds = i.rooms
    .filter((r) => (r.status ?? "active") === "active")
    .reduce((s, r) => s + (r.current ?? 0), 0);
  const metrics: IntelMetric[] = [
    {
      key: "birds",
      label: "Birds",
      value: birds > 0 ? birds.toLocaleString() : "—",
      detail: birds > 0 ? `${plural(i.rooms.length, "room")}` : "Add your bird population",
      status: birds > 0 ? "normal" : "unknown",
    },
  ];
  if (prod) {
    const { pct, base, ref } = prod.latest;
    const worst = prod.alerts[0]?.severity;
    metrics.push({
      key: "production",
      label: "Production",
      value: pct !== null ? `${pct.toFixed(1)}%` : "—",
      detail:
        pct === null
          ? "Not recorded recently"
          : base === null
            ? "Not enough history yet"
            : `${pct >= base ? "↑" : "↓"} ${pct1(((pct - base) / base) * 100)} vs recent average${ref !== i.todayKey ? " (latest day)" : ""}`,
      status: pct === null || base === null ? "unknown" : (worst ?? "normal"),
    });
    const eggsToday = i.eggs
      .filter((e) => toDateKey(e.date) === i.todayKey)
      .reduce((s, e) => s + totalEggsFromRow(e), 0);
    if (eggsToday > 0)
      metrics[metrics.length - 1].detail +=
        ` · ${Math.floor(eggsToday / 30).toLocaleString()} crates today`;
  }
  if (feed)
    metrics.push({
      key: "feed",
      label: "Feed",
      value: feed.today !== null ? `${feed.today} bags` : "—",
      detail:
        feed.today === null
          ? "Not recorded yet today"
          : feed.status === "unknown"
            ? "Not enough history yet"
            : feed.status === "normal"
              ? "Within your recent range"
              : "Different from usual",
      status: feed.status,
    });
  if (mort)
    metrics.push({
      key: "mortality",
      label: "Mortality",
      value: mort.today !== null ? plural(mort.today, "bird") : "—",
      detail:
        mort.today === null
          ? "Not recorded yet today"
          : mort.avg === null
            ? "Not enough history yet"
            : `Recent average ${mort.avg.toFixed(1)}/day`,
      status: mort.avg === null ? "unknown" : (mort.sev ?? "normal"),
    });
  if (p.weather)
    metrics.push({
      key: "weather",
      label: "Weather",
      value: i.weather ? `${Math.round(i.weather.tempC)}°C` : "—",
      detail: i.weather ? i.weather.label : "Weather not available",
      status: i.weather ? i.weather.severity : "unknown",
    });

  const rooms: RoomStatus[] = i.rooms
    .filter((r) => (r.status ?? "active") === "active")
    .map((r) => {
      const worst = alerts.filter((a) => a.room === r.name).sort(compareAlerts)[0];
      const status: RoomStatus["status"] =
        !worst || worst.severity === "normal"
          ? "stable"
          : worst.severity === "watch"
            ? "monitor"
            : "attention";
      return { room: r.name, birds: r.current ?? 0, status, reason: worst ? worst.title : null };
    });

  return {
    alerts,
    priorities,
    metrics,
    rooms,
    recommendations: priorities.map((a) => a.checks[0]).filter(Boolean),
    summary: buildSummary(alerts, feed?.status ?? "unknown", prod?.latest.base != null, i.weather),
    dataGaps: [...new Set(gaps)],
    evaluated,
  };
}

function buildSummary(
  alerts: IntelAlert[],
  feedStatus: IntelMetricStatus,
  prodKnown: boolean,
  weather: WeatherInput | null,
): string {
  const has = (c: IntelCategory) => alerts.find((a) => a.category === c && a.severity !== "normal");
  const urgent = alerts.some((a) => a.severity === "critical" || a.severity === "warning");
  const parts: string[] = [];
  parts.push(
    alerts.length === 0
      ? "Your farm looks stable today based on your latest records."
      : urgent
        ? "A few things on your farm need attention today."
        : "Your farm is generally stable today, with a few things to keep an eye on.",
  );
  const prod = has("production");
  if (prod)
    parts.push(
      prod.room
        ? `${prod.room} production is below its recent average.`
        : "Production is below its recent average.",
    );
  else if (prodKnown) parts.push("Production is in line with your recent pattern.");
  const mort = has("mortality");
  if (mort)
    parts.push("Mortality is higher than your recent average, so please check the affected room.");
  if (has("feed")) parts.push("Feed usage is different from your recent pattern.");
  else if (feedStatus === "normal") parts.push("Feed usage remains normal.");
  if (has("inventory")) parts.push("Feed stock is running low.");
  const w = has("weather");
  if (w && weather?.heat)
    parts.push(
      "Heat may stress your birds, so check ventilation and water before the hottest period.",
    );
  else if (w) parts.push("Cooler weather is expected, so avoid drafts and keep litter dry.");
  return parts.join(" ");
}
