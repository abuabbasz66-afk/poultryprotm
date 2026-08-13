// Daily egg production percentages, per room and for the whole flock.
//
// Percentage = (eggs laid ÷ active birds in that room on that date) × 100.
// Eggs are ALWAYS real eggs, never crates: a room column stores crates, so
// eggs = crates × 30, minus any broken eggs recorded for that room.
//
// The denominator is the room's population ON THE PRODUCTION DATE, not today's
// count. It is reconstructed by adding back every mortality recorded AFTER that
// date to the room's current head count. When a room has no usable population
// figure the percentage is reported as null and the UI shows "N/A" — we never
// invent a denominator.
import type { EggRow, Room, Mortality } from "@/lib/farm-data";
import { eggSlots, type EggColumn } from "@/lib/rooms";
import { totalEggsFromRow } from "@/lib/egg-normalize";

const CRATE = 30;

export type RoomProduction = {
  roomId: string;
  roomName: string;
  key: EggColumn;
  /** Real eggs produced by this room on the date (crates × 30 − broken). */
  eggs: number;
  /** Active birds in the room on that date, or null when unknown. */
  birds: number | null;
  /** Lay percentage, or null when the population is unknown. */
  pct: number | null;
};

export type DailyProduction = {
  date: string;
  label: string;
  rooms: RoomProduction[];
  /** Total real eggs on the date, including loose extras, minus broken. */
  totalEggs: number;
  totalBirds: number | null;
  overallPct: number | null;
  best: RoomProduction | null;
  worst: RoomProduction | null;
  /** Rooms ranked best → lowest (only those with a known percentage). */
  ranked: RoomProduction[];
};

const brokenFor = (e: EggRow, key: EggColumn): number => {
  const v = (e as unknown as Record<string, number | undefined>)[`broken_${key}`];
  return Math.max(0, Number(v) || 0);
};

/** Population of a room on `date` = current birds + losses recorded after that date. */
export function roomBirdsOn(room: Room, date: string, mortality: Mortality[]): number | null {
  const current = Number(room.current);
  if (!Number.isFinite(current) || current <= 0) return null;
  const later = mortality
    .filter((m) => m.room === room.name && m.date > date)
    .reduce((s, m) => s + (Number(m.loss) || 0), 0);
  const birds = current + later;
  return birds > 0 ? birds : null;
}

export function fmtPct(pct: number | null): string {
  return pct === null || !Number.isFinite(pct) ? "N/A" : `${pct.toFixed(2)}%`;
}

export function computeDailyProduction(
  row: EggRow,
  rooms: Room[],
  mortality: Mortality[],
): DailyProduction {
  const slots = eggSlots(rooms);
  const roomRows: RoomProduction[] = slots.map(({ room, key }) => {
    const eggs = Math.max(0, (Number(row[key]) || 0) * CRATE - brokenFor(row, key));
    const birds = roomBirdsOn(room, row.date, mortality);
    return {
      roomId: room.id,
      roomName: room.name,
      key,
      eggs,
      birds,
      pct: birds ? (eggs / birds) * 100 : null,
    };
  });

  const totalEggs = totalEggsFromRow(row);
  const known = roomRows.filter((r) => r.birds !== null);
  const totalBirds = known.length ? known.reduce((s, r) => s + (r.birds ?? 0), 0) : null;
  const overallPct = totalBirds ? (totalEggs / totalBirds) * 100 : null;

  const ranked = roomRows
    .filter((r) => r.pct !== null)
    .sort((a, b) => (b.pct as number) - (a.pct as number));

  return {
    date: row.date,
    label: row.label,
    rooms: roomRows,
    totalEggs,
    totalBirds,
    overallPct,
    best: ranked[0] ?? null,
    worst: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    ranked,
  };
}

/** Percentages for every production record, newest first (input order preserved). */
export function computeProductionSeries(
  eggs: EggRow[],
  rooms: Room[],
  mortality: Mortality[],
): DailyProduction[] {
  return eggs.map((e) => computeDailyProduction(e, rooms, mortality));
}
