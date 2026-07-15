// Shared farm date normalisation utility.
// All farm records (production, feed, mortality, health) must be matched by
// local calendar date, not by timestamp equality. This module provides a
// single canonical function that maps whatever we get from the DB or from
// legacy short-date strings ("4 Apr") into a stable YYYY-MM-DD key.

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Normalise any supported farm-record date value to a local YYYY-MM-DD key.
 *
 * Accepted inputs:
 *  - ISO date string:            "2026-04-04"
 *  - ISO timestamp:              "2026-04-04T17:15:00[.000Z]"
 *  - Short farm-record date:     "4 Apr", "16 Jan" (year inferred from anchor)
 *  - "Today"                     (uses anchor)
 *
 * Returns null when the input cannot be understood.
 */
export function toDateKey(input: string | Date | null | undefined, anchor?: Date): string | null {
  if (!input) return null;

  if (input instanceof Date) {
    return Number.isFinite(input.getTime()) ? toKey(input) : null;
  }

  const raw = String(input).trim();
  if (!raw) return null;

  // ISO date or ISO timestamp — take the calendar-date prefix as authoritative
  // (the underlying record date, never a timezone-shifted rendering).
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[Tt].*)?$/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const anchorDate = anchor && Number.isFinite(anchor.getTime()) ? anchor : new Date();

  if (/^today$/i.test(raw)) return toKey(anchorDate);

  // Short form "4 Apr" — infer year from anchor, roll back if in the future.
  const short = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})/);
  if (short) {
    const day = parseInt(short[1], 10);
    const mon = MONTHS[short[2].toLowerCase()];
    if (mon === undefined) return null;
    let year = anchorDate.getFullYear();
    const candidate = new Date(year, mon, day);
    if (candidate.getTime() > anchorDate.getTime() + 24 * 60 * 60 * 1000) year -= 1;
    return toKey(new Date(year, mon, day));
  }

  // Last resort — let Date parse a longer natural form; still emit local key.
  const parsed = new Date(raw);
  if (Number.isFinite(parsed.getTime())) return toKey(parsed);

  return null;
}

/**
 * Convenience: parse to a Date pinned at local midnight of the resolved key.
 * Returns null when the input cannot be normalised.
 */
export function toLocalDate(input: string | Date | null | undefined, anchor?: Date): Date | null {
  const key = toDateKey(input, anchor);
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatKeyShort(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
