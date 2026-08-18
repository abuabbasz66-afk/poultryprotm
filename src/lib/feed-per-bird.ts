// PoultryPro — Room-level feed consumption & feed-per-bird intelligence.
//
// Built entirely on the EXISTING feed_usage records (farm_id, room, bags, date),
// the rooms table and the mortality log. No new tables, no duplicated feed
// system: every figure here is derived from what the farmer already records.
//
// Feed is stored in bags; kilograms = bags × the farm's bag weight setting.
// Feed per bird (g/day) = room feed in grams ÷ the room's population ON THAT
// DATE (reconstructed from mortality, same engine used by production %).
//
// Rows whose room name does not match any room on the farm are kept apart as
// "unallocated" historical feed — we never invent a room allocation.

import { useMemo } from "react";
import { useFarm, useFeed, useMortality, useRooms, type Feed, type Mortality, type Room } from "@/lib/farm-data";
import { roomBirdsOn } from "@/lib/production-percent";
import { toDateKey, toLocalDate } from "@/lib/date-key";
import { flockAge } from "@/lib/flock-age";

export type FeedStatus = "underfed" | "normal" | "overfed" | "unknown";

/** Default (mature layer) thresholds (g/bird/day). */
export const FEED_THRESHOLDS = { underBelow: 100, overAbove: 125 } as const;

export type FeedTarget = { underBelow: number; overAbove: number; label: string };

export const DEFAULT_FEED_TARGET: FeedTarget = {
  underBelow: FEED_THRESHOLDS.underBelow,
  overAbove: FEED_THRESHOLDS.overAbove,
  label: "Layer",
};

/**
 * Expected daily intake band for a room, based on the bird type and the flock's
 * age on that date. A fixed 100–125 g band only fits mature layers: broilers at
 * market age eat ~150–200 g and brooding chicks eat ~10–40 g, so judging them
 * against the layer band produces permanent false Underfed/Overfed warnings.
 *
 * When the age is not recorded we widen the band for that bird type instead of
 * guessing an age, so a room is only flagged when it is clearly out of range.
 */
export function feedTargetFor(
  room: Pick<Room, "bird_type" | "age_status" | "age_anchor_date"> | null,
  dateKey?: string,
): FeedTarget {
  if (!room) return DEFAULT_FEED_TARGET;
  const type = (room.bird_type ?? "").toLowerCase();
  const on = dateKey ? toLocalDate(dateKey) ?? new Date() : new Date();
  const age = flockAge(room, on);
  const known = age.status !== "missing";

  if (type.includes("broiler") || type.includes("noiler")) {
    if (!known) return { underBelow: 20, overAbove: 220, label: "Broiler (age not recorded)" };
    if (age.days <= 10) return { underBelow: 8, overAbove: 45, label: "Broiler starter" };
    if (age.days <= 24) return { underBelow: 45, overAbove: 130, label: "Broiler grower" };
    return { underBelow: 110, overAbove: 220, label: "Broiler finisher" };
  }

  // Layers / pullets / anything else on a layer programme.
  if (!known) return { underBelow: 90, overAbove: 140, label: "Layer (age not recorded)" };
  if (age.weeks < 8) return { underBelow: 8, overAbove: 55, label: "Chick / brooding" };
  if (age.weeks < 18) return { underBelow: 40, overAbove: 95, label: "Grower / pullet" };
  if (age.weeks < 22) return { underBelow: 75, overAbove: 120, label: "Point of lay" };
  return { underBelow: 100, overAbove: 135, label: "Laying" };
}

export const feedTargetLabel = (t: FeedTarget) => `${t.underBelow}\u2013${t.overAbove} g/bird (${t.label})`;

export const FEED_STATUS_LABELS: Record<FeedStatus, string> = {
  underfed: "Underfed",
  normal: "Normal",
  overfed: "Overfed",
  unknown: "No data",
};

export function feedStatusMessage(status: FeedStatus, target: FeedTarget = DEFAULT_FEED_TARGET): string {
  switch (status) {
    case "underfed": return `Underfed — below the ${target.underBelow} g/bird expected for a ${target.label.toLowerCase()} flock.`;
    case "overfed": return `Overfed — above the ${target.overAbove} g/bird expected for a ${target.label.toLowerCase()} flock.`;
    case "normal": return `Normal — within the ${target.underBelow}–${target.overAbove} g/bird range expected for a ${target.label.toLowerCase()} flock.`;
    default: return "Bird count unavailable for this room and date, so feed per bird cannot be calculated.";
  }
}

export const FEED_STATUS_TONES: Record<FeedStatus, string> = {
  underfed: "bg-amber-500/12 text-amber-700 border-amber-500/30",
  normal: "bg-emerald-500/12 text-emerald-700 border-emerald-500/30",
  overfed: "bg-destructive/10 text-destructive border-destructive/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

export function feedStatus(gramsPerBird: number | null, target: FeedTarget = DEFAULT_FEED_TARGET): FeedStatus {
  if (gramsPerBird === null || !Number.isFinite(gramsPerBird)) return "unknown";
  if (gramsPerBird < target.underBelow) return "underfed";
  if (gramsPerBird > target.overAbove) return "overfed";
  return "normal";
}

/** Data-quality verdict for a feed entry — VALID / REVIEW / INVALID. */
export type FeedQuality = "valid" | "review" | "invalid";

export type FeedFlag = {
  id: string;
  quality: Exclude<FeedQuality, "valid">;
  date: string;
  room: string;
  reason: string;
};

export type RoomFeedDay = {
  roomId: string | null;
  roomName: string;
  /** Kilograms consumed by this room on the date. */
  kg: number;
  bags: number;
  /** Population on that date, or null when unknown. */
  birds: number | null;
  gramsPerBird: number | null;
  status: FeedStatus;
  /** Expected intake band for this room's bird type and age on that date. */
  target: FeedTarget;
  /** True when the record could not be matched to a room on this farm. */
  unallocated: boolean;
  entries: Feed[];
};

export type FeedDay = {
  date: string;
  rooms: RoomFeedDay[];
  totalKg: number;
  totalBirds: number | null;
  /** Farm average = total grams ÷ total birds (never an average of averages). */
  avgGramsPerBird: number | null;
  counts: { underfed: number; normal: number; overfed: number; unknown: number };
  unallocatedKg: number;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

export function computeFeedDays(
  feed: Feed[],
  rooms: Room[],
  mortality: Mortality[],
  bagWeightKg: number,
): FeedDay[] {
  const byRoomName = new Map(rooms.map((r) => [r.name.trim().toLowerCase(), r]));
  const grouped = new Map<string, Map<string, Feed[]>>();

  for (const f of feed) {
    const date = toDateKey(f.date) ?? f.date;
    const roomName = (f.room ?? "").trim() || "Unassigned";
    let day = grouped.get(date);
    if (!day) { day = new Map(); grouped.set(date, day); }
    const list = day.get(roomName) ?? [];
    list.push(f);
    day.set(roomName, list);
  }

  const days: FeedDay[] = [];
  for (const [date, roomMap] of grouped) {
    const roomRows: RoomFeedDay[] = [];
    for (const [roomName, entries] of roomMap) {
      const bags = entries.reduce((s, e) => s + num(e.bags), 0);
      const kg = bags * bagWeightKg;
      const room = byRoomName.get(roomName.toLowerCase()) ?? null;
      const birds = room ? roomBirdsOn(room, date, mortality) : null;
      const target = feedTargetFor(room, date);
      const gramsPerBird = birds && birds > 0 && kg > 0 ? (kg * 1000) / birds : birds && kg === 0 ? 0 : null;
      roomRows.push({
        roomId: room?.id ?? null,
        roomName: room?.name ?? roomName,
        kg,
        bags,
        birds,
        gramsPerBird,
        status: feedStatus(gramsPerBird, target),
        target,
        unallocated: !room,
        entries,
      });
    }

    roomRows.sort((a, b) => a.roomName.localeCompare(b.roomName, undefined, { numeric: true }));

    const allocated = roomRows.filter((r) => !r.unallocated && r.birds !== null);
    const totalKg = roomRows.reduce((s, r) => s + r.kg, 0);
    const totalBirds = allocated.length ? allocated.reduce((s, r) => s + (r.birds ?? 0), 0) : null;
    const allocatedKg = allocated.reduce((s, r) => s + r.kg, 0);

    const counts = { underfed: 0, normal: 0, overfed: 0, unknown: 0 };
    for (const r of roomRows) counts[r.status] += 1;

    days.push({
      date,
      rooms: roomRows,
      totalKg,
      totalBirds,
      avgGramsPerBird: totalBirds && totalBirds > 0 ? (allocatedKg * 1000) / totalBirds : null,
      counts,
      unallocatedKg: roomRows.filter((r) => r.unallocated).reduce((s, r) => s + r.kg, 0),
    });
  }

  return days.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Non-destructive validation — records are flagged, never modified. */
export function validateFeedEntries(
  feed: Feed[],
  rooms: Room[],
  bagWeightKg: number,
): FeedFlag[] {
  const flags: FeedFlag[] = [];
  const known = new Set(rooms.map((r) => r.name.trim().toLowerCase()));
  const seen = new Map<string, number>();

  for (const f of feed) {
    const date = toDateKey(f.date);
    const room = (f.room ?? "").trim();
    const kg = num(f.bags) * bagWeightKg;

    if (!date) {
      flags.push({ id: f.id, quality: "invalid", date: f.date ?? "—", room: room || "—", reason: "Missing or unreadable date." });
      continue;
    }
    if (!room) {
      flags.push({ id: f.id, quality: "invalid", date, room: "—", reason: "Missing room on the feed entry." });
    }
    if (num(f.bags) < 0) {
      flags.push({ id: f.id, quality: "invalid", date, room: room || "—", reason: "Negative feed quantity recorded." });
    }
    if (kg > 2000) {
      flags.push({ id: f.id, quality: "review", date, room: room || "—", reason: `Unusually large entry (${Math.round(kg)} kg in one room in one day).` });
    }
    if (room && !known.has(room.toLowerCase())) {
      flags.push({ id: f.id, quality: "review", date, room, reason: "Room is not on the current room list — kept as unallocated historical feed." });
    }
    const key = `${date}|${room.toLowerCase()}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count > 1) {
      flags.push({ id: f.id, quality: "review", date, room: room || "—", reason: "Duplicate entry for the same room and date — totals are combined." });
    }
  }

  return flags;
}

export type RoomTrendPoint = { date: string; kg: number; gramsPerBird: number | null };

export type RoomFeedSummary = {
  roomId: string | null;
  roomName: string;
  latest: RoomFeedDay | null;
  avg7: number | null;   // g/bird
  avg30: number | null;  // g/bird
  kg7: number;
  kg30: number;
  status: FeedStatus;
  target: FeedTarget;
  /** % change of the latest g/bird against the 7-day baseline. */
  changePct: number | null;
  trend: RoomTrendPoint[];
};

export type RoomFeedAnalytics = {
  isLoading: boolean;
  bagWeightKg: number;
  days: FeedDay[];
  latest: FeedDay | null;
  rooms: RoomFeedSummary[];
  /** Farm totals across the last 7 / 30 days. */
  farm: {
    kg7: number;
    kg30: number;
    avg7GramsPerBird: number | null;
    avg30GramsPerBird: number | null;
    trend7Pct: number | null;
  };
  flags: FeedFlag[];
  hasUnallocated: boolean;
};

function daysAgoKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateKey(d)!;
}

export function useRoomFeedAnalytics(): RoomFeedAnalytics {
  const farmQ = useFarm();
  const feedQ = useFeed();
  const roomsQ = useRooms();
  const mortQ = useMortality();

  const bagWeightKg = farmQ.data?.bag_weight_kg && farmQ.data.bag_weight_kg > 0 ? farmQ.data.bag_weight_kg : 25;

  return useMemo<RoomFeedAnalytics>(() => {
    const feed = feedQ.data ?? [];
    const rooms = roomsQ.data ?? [];
    const mortality = mortQ.data ?? [];

    const days = computeFeedDays(feed, rooms, mortality, bagWeightKg);
    const latest = days[0] ?? null;
    const flags = validateFeedEntries(feed, rooms, bagWeightKg);

    const cut7 = daysAgoKey(6);
    const cut30 = daysAgoKey(29);
    const cut14 = daysAgoKey(13);

    // Per-room roll-ups
    const roomKeys = new Map<string, { roomId: string | null; roomName: string }>();
    for (const d of days) {
      for (const r of d.rooms) roomKeys.set(r.roomName, { roomId: r.roomId, roomName: r.roomName });
    }

    const summaries: RoomFeedSummary[] = Array.from(roomKeys.values()).map(({ roomId, roomName }) => {
      const points: RoomTrendPoint[] = [];
      let kg7 = 0, kg30 = 0, grams7 = 0, birds7 = 0, grams30 = 0, birds30 = 0;
      let latestRow: RoomFeedDay | null = null;

      for (const d of days) {
        const row = d.rooms.find((r) => r.roomName === roomName);
        if (!row) continue;
        if (!latestRow) latestRow = row;
        if (d.date >= cut30) {
          points.push({ date: d.date, kg: row.kg, gramsPerBird: row.gramsPerBird });
          kg30 += row.kg;
          if (row.birds) { grams30 += row.kg * 1000; birds30 += row.birds; }
          if (d.date >= cut7) {
            kg7 += row.kg;
            if (row.birds) { grams7 += row.kg * 1000; birds7 += row.birds; }
          }
        }
      }

      points.reverse();
      const avg7 = birds7 > 0 ? grams7 / birds7 : null;
      const avg30 = birds30 > 0 ? grams30 / birds30 : null;
      const current = latestRow?.gramsPerBird ?? null;
      const changePct = current !== null && avg7 !== null && avg7 > 0 ? ((current - avg7) / avg7) * 100 : null;

      return {
        roomId,
        roomName,
        latest: latestRow,
        avg7,
        avg30,
        kg7,
        kg30,
        status: feedStatus(current ?? avg7, latestRow?.target ?? DEFAULT_FEED_TARGET),
        target: latestRow?.target ?? DEFAULT_FEED_TARGET,
        changePct,
        trend: points,
      };
    }).sort((a, b) => a.roomName.localeCompare(b.roomName, undefined, { numeric: true }));

    // Farm roll-up: totals, never averages of averages
    let kg7 = 0, kg30 = 0, grams7 = 0, birds7 = 0, grams30 = 0, birds30 = 0, kgPrev7 = 0;
    for (const d of days) {
      if (d.date >= cut30) {
        kg30 += d.totalKg;
        for (const r of d.rooms) if (r.birds) { grams30 += r.kg * 1000; birds30 += r.birds; }
      }
      if (d.date >= cut7) {
        kg7 += d.totalKg;
        for (const r of d.rooms) if (r.birds) { grams7 += r.kg * 1000; birds7 += r.birds; }
      } else if (d.date >= cut14) {
        kgPrev7 += d.totalKg;
      }
    }

    return {
      isLoading: feedQ.isLoading || roomsQ.isLoading || mortQ.isLoading || farmQ.isLoading,
      bagWeightKg,
      days,
      latest,
      rooms: summaries,
      farm: {
        kg7,
        kg30,
        avg7GramsPerBird: birds7 > 0 ? grams7 / birds7 : null,
        avg30GramsPerBird: birds30 > 0 ? grams30 / birds30 : null,
        trend7Pct: kgPrev7 > 0 ? ((kg7 - kgPrev7) / kgPrev7) * 100 : null,
      },
      flags,
      hasUnallocated: days.some((d) => d.unallocatedKg > 0),
    };
  }, [feedQ.data, feedQ.isLoading, roomsQ.data, roomsQ.isLoading, mortQ.data, mortQ.isLoading, farmQ.data, farmQ.isLoading, bagWeightKg]);
}

export const fmtGrams = (g: number | null) => (g === null || !Number.isFinite(g) ? "N/A" : `${g.toFixed(1)} g`);
export const fmtKgValue = (kg: number) => `${Math.round(kg * 10) / 10} kg`;
