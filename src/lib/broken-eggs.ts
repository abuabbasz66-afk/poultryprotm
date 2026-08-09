import type { EggRow, Room } from "@/lib/farm-data";
import { eggSlots, type EggColumn } from "@/lib/rooms";
import { toDateKey } from "@/lib/date-key";

/**
 * Broken egg tracking.
 *
 * Every production record stores collected crates per room plus the number of
 * BROKEN eggs per room. Good (usable) eggs are always derived, never stored:
 *
 *   Good eggs = Total eggs collected - Broken eggs
 *   Crates    = Good eggs / 30 (whole crates)
 *   Extra     = remainder
 *
 * Sales, revenue and analytics must always use the good-egg figure.
 */

export const CRATE = 30;

const BROKEN_KEY: Record<EggColumn, "broken_r2" | "broken_r3" | "broken_r4"> = {
  r2: "broken_r2", r3: "broken_r3", r4: "broken_r4",
};

export function brokenOf(row: EggRow, key: EggColumn): number {
  return Number(row[BROKEN_KEY[key]] ?? 0) || 0;
}

/** Total broken eggs on a record (all rooms + loose eggs). */
export function totalBroken(row: EggRow): number {
  return (
    (Number(row.broken_r2) || 0) +
    (Number(row.broken_r3) || 0) +
    (Number(row.broken_r4) || 0) +
    (Number(row.broken_extra) || 0)
  );
}

/** Total eggs collected on a record, before breakage. */
export function totalCollected(row: EggRow): number {
  return (row.r2 + row.r3 + row.r4) * CRATE + row.extra;
}

export type EggBreakdown = {
  collected: number;
  broken: number;
  good: number;
  crates: number;
  extra: number;
  breakagePct: number;
};

export function breakdownOf(row: EggRow): EggBreakdown {
  const collected = totalCollected(row);
  const broken = Math.min(totalBroken(row), collected);
  const good = Math.max(0, collected - broken);
  return {
    collected,
    broken,
    good,
    crates: Math.floor(good / CRATE),
    extra: good % CRATE,
    breakagePct: collected > 0 ? (broken / collected) * 100 : 0,
  };
}

export function summarise(rows: EggRow[]): EggBreakdown {
  const collected = rows.reduce((s, r) => s + totalCollected(r), 0);
  const broken = rows.reduce((s, r) => s + Math.min(totalBroken(r), totalCollected(r)), 0);
  const good = Math.max(0, collected - broken);
  return {
    collected,
    broken,
    good,
    crates: Math.floor(good / CRATE),
    extra: good % CRATE,
    breakagePct: collected > 0 ? (broken / collected) * 100 : 0,
  };
}

/** Rows for a specific local calendar day. */
export function rowsOnDay(rows: EggRow[], dayKey: string): EggRow[] {
  return rows.filter((r) => toDateKey(r.date) === dayKey);
}

export type BreakageTrendPoint = { dateKey: string; collected: number; broken: number; pct: number };

/** Daily breakage trend, oldest first, limited to the last `days` records. */
export function breakageTrend(rows: EggRow[], days = 30): BreakageTrendPoint[] {
  const byDay = new Map<string, { collected: number; broken: number }>();
  for (const r of rows) {
    const key = toDateKey(r.date);
    if (!key) continue;
    const cur = byDay.get(key) ?? { collected: 0, broken: 0 };
    cur.collected += totalCollected(r);
    cur.broken += Math.min(totalBroken(r), totalCollected(r));
    byDay.set(key, cur);
  }
  return Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-days)
    .map(([dateKey, v]) => ({
      dateKey,
      collected: v.collected,
      broken: v.broken,
      pct: v.collected > 0 ? (v.broken / v.collected) * 100 : 0,
    }));
}

export type RoomBreakage = {
  roomName: string;
  key: EggColumn;
  collected: number;
  broken: number;
  pct: number;
};

/** Breakage per production room over the supplied records. */
export function breakageByRoom(rows: EggRow[], rooms: Room[]): RoomBreakage[] {
  const slots = eggSlots(rooms);
  return slots
    .map(({ room, key }) => {
      const collected = rows.reduce((s, r) => s + r[key] * CRATE, 0);
      const broken = rows.reduce((s, r) => s + brokenOf(r, key), 0);
      return {
        roomName: room.name,
        key,
        collected,
        broken,
        pct: collected > 0 ? (broken / collected) * 100 : 0,
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

/**
 * Plain-English breakage insight for the farmer. Returns null when there is
 * not enough data or breakage is healthy (industry-normal is under ~2%).
 */
export function breakageInsight(rows: EggRow[], rooms: Room[]): { severity: "warning" | "info"; message: string } | null {
  const overall = summarise(rows);
  if (overall.collected < 300) return null;

  const worst = breakageByRoom(rows, rooms).find((r) => r.collected >= 150 && r.pct >= 3);
  if (worst) {
    return {
      severity: worst.pct >= 5 ? "warning" : "info",
      message: `High egg breakage detected in ${worst.roomName} (${worst.pct.toFixed(1)}%) — check handling, crate stacking or calcium levels in the feed.`,
    };
  }
  if (overall.breakagePct >= 3) {
    return {
      severity: overall.breakagePct >= 5 ? "warning" : "info",
      message: `Farm-wide breakage is ${overall.breakagePct.toFixed(1)}% — above the 2% healthy range. Review egg handling, collection frequency and shell quality.`,
    };
  }
  return null;
}
