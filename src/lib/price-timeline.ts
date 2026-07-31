// PoultryPro — Effective-dated price engine.
//
// Every price change is captured in `price_history` with an exact effective
// date & time. Financial maths must therefore never use "the current price"
// blindly: a production or feed record dated 28 Jul must be valued with the
// price that was active on 28 Jul, even if the price changed on 30 Jul.
//
// This module turns the audit trail into a sorted timeline and exposes a
// pure resolver `priceOn(timeline, "YYYY-MM-DD")`.

import type { Price, PriceHistoryRow } from "@/lib/farm-data";

export type PricePoint = { fromKey: string; price: number; at: string };
export type PriceTimeline = { points: PricePoint[]; fallback: number };

function dayKey(iso: string): string {
  // Local calendar day of the effective timestamp.
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "0000-01-01";
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const PRICE_CATEGORY_MATCH: Record<string, RegExp> = {
  eggs: /egg/i,
  feed: /feed/i,
};

export function categoryOf(item: string, category?: string | null): string {
  const c = (category ?? "").trim().toLowerCase();
  if (c && c !== "other") return c;
  if (/egg/i.test(item)) return "eggs";
  if (/feed/i.test(item)) return "feed";
  if (/vaccin/i.test(item)) return "vaccines";
  if (/medic|drug|antibio/i.test(item)) return "medicine";
  return c || "other";
}

/**
 * Build a timeline for one logical item from the audit trail.
 * `match` selects the relevant history rows (by item name).
 * `current` (the live price row) guarantees the timeline is never empty.
 */
export function buildTimeline(
  history: PriceHistoryRow[],
  match: RegExp,
  fallback: number,
  current?: number | null,
  currentFrom?: string | null,
): PriceTimeline {
  const points: PricePoint[] = history
    .filter(h => match.test(h.item))
    .map(h => ({ fromKey: dayKey(h.effective_from), price: Number(h.new_price), at: h.effective_from }))
    .filter(p => Number.isFinite(p.price) && p.price > 0)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  if (Number.isFinite(Number(current)) && Number(current) > 0) {
    const last = points[points.length - 1];
    if (!last || last.price !== Number(current)) {
      points.push({
        fromKey: currentFrom ? dayKey(currentFrom) : (last?.fromKey ?? "0000-01-01"),
        price: Number(current),
        at: currentFrom ?? new Date().toISOString(),
      });
    }
  }

  return { points, fallback };
}

/** Price that was active on a given calendar day (YYYY-MM-DD). */
export function priceOn(timeline: PriceTimeline, dateKey: string | null | undefined): number {
  const pts = timeline.points;
  if (!pts.length) return timeline.fallback;
  if (!dateKey) return pts[pts.length - 1].price;
  let value = pts[0].price; // records older than the first known price use it
  for (const p of pts) {
    if (p.fromKey <= dateKey) value = p.price;
    else break;
  }
  return value;
}

/** Latest price on the timeline. */
export function latestPrice(timeline: PriceTimeline): number {
  const pts = timeline.points;
  return pts.length ? pts[pts.length - 1].price : timeline.fallback;
}

export type FarmPriceTimelines = {
  eggPerCrate: PriceTimeline;
  feedPerBag: PriceTimeline;
  /** Feed cost per kg, resolved for a day, honouring the farm bag weight. */
  feedPerKgOn: (dateKey: string | null | undefined) => number;
  eggPriceOn: (dateKey: string | null | undefined) => number;
};

export function buildFarmTimelines(input: {
  prices: Price[];
  history: PriceHistoryRow[];
  bagWeightKg: number;
  /** Active self-produced formula cost per kg — overrides purchased feed. */
  costPerKgOverride?: number | null;
}): FarmPriceTimelines {
  const { prices, history, bagWeightKg } = input;
  const eggRow = prices.find(p => /egg/i.test(p.item));
  const feedRow = prices.find(p => /feed/i.test(p.item));

  // No hard-coded prices anywhere: when a farm has never set a price the
  // fallback is 0 so the UI shows "not set" instead of inventing revenue.
  const eggPerCrate = buildTimeline(history, /egg/i, 0, eggRow?.price, eggRow?.effective_from);
  const feedPerBag = buildTimeline(history, /feed/i, 0, feedRow?.price, feedRow?.effective_from);

  const override = Number(input.costPerKgOverride);
  const hasOverride = Number.isFinite(override) && override > 0;
  const w = bagWeightKg > 0 ? bagWeightKg : 25;

  return {
    eggPerCrate,
    feedPerBag,
    eggPriceOn: (k) => priceOn(eggPerCrate, k),
    feedPerKgOn: (k) => (hasOverride ? override : priceOn(feedPerBag, k) / w),
  };
}

/** Latest known price for an arbitrary ingredient name (case-insensitive). */
export function latestIngredientPrice(history: PriceHistoryRow[], name: string): number | null {
  const target = name.trim().toLowerCase();
  const rows = history
    .filter(h => h.item.trim().toLowerCase() === target)
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
  const hit = rows[0];
  return hit && Number.isFinite(hit.new_price) ? Number(hit.new_price) : null;
}

/** Previous price for an item (the value before the latest change). */
export function previousPriceFor(history: PriceHistoryRow[], item: string): { price: number; at: string } | null {
  const rows = history
    .filter(h => h.item.trim().toLowerCase() === item.trim().toLowerCase())
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
  const latest = rows[0];
  if (!latest || latest.old_price == null) return null;
  return { price: Number(latest.old_price), at: latest.effective_from };
}

export function formatEffective(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  const kind = /Mobi|Android|iPhone/i.test(ua) ? "Mobile" : /iPad|Tablet/i.test(ua) ? "Tablet" : "Desktop";
  const browser = /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox"
    : "Browser";
  return `${kind} · ${browser}`;
}
