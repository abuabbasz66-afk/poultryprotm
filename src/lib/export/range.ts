/** Date-range presets for the export dialog. All dates are farm-local. */

export type RangeKey =
  | "all"
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_year", label: "This year" },
  { key: "custom", label: "Custom date range" },
];

function pad(v: number) {
  return v < 10 ? `0${v}` : String(v);
}

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shift(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export type ResolvedRange = { from: string | null; to: string | null; label: string };

/** Resolves a preset (or custom pair) into inclusive YYYY-MM-DD bounds. */
export function resolveRange(key: RangeKey, custom?: { from?: string; to?: string }): ResolvedRange {
  const now = new Date();
  const today = dayKey(now);
  switch (key) {
    case "today":
      return { from: today, to: today, label: "Today" };
    case "yesterday": {
      const y = dayKey(shift(now, -1));
      return { from: y, to: y, label: "Yesterday" };
    }
    case "last7":
      return { from: dayKey(shift(now, -6)), to: today, label: "Last 7 days" };
    case "last30":
      return { from: dayKey(shift(now, -29)), to: today, label: "Last 30 days" };
    case "this_month":
      return {
        from: dayKey(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: today,
        label: "This month",
      };
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: dayKey(start), to: dayKey(end), label: "Last month" };
    }
    case "this_year":
      return { from: `${now.getFullYear()}-01-01`, to: today, label: "This year" };
    case "custom":
      return {
        from: custom?.from || null,
        to: custom?.to || null,
        label: "Custom range",
      };
    default:
      return { from: null, to: null, label: "All time" };
  }
}

/** "01 Jan 2026 – 08 Sep 2026" or "All available records". */
export function rangeText(range: ResolvedRange) {
  const fmt = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  if (!range.from && !range.to) return "All available records";
  if (range.from && range.to) return `${fmt(range.from)} – ${fmt(range.to)}`;
  if (range.from) return `From ${fmt(range.from)}`;
  return `Up to ${fmt(range.to as string)}`;
}

/** File-name friendly range suffix. */
export function rangeSuffix(range: ResolvedRange) {
  if (range.from && range.to) return `${range.from}_to_${range.to}`;
  if (range.from) return `from_${range.from}`;
  if (range.to) return `to_${range.to}`;
  return dayKey(new Date());
}
