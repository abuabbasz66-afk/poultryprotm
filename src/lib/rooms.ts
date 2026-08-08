// Room lifecycle helpers.
//
// Two rules drive everything here:
//  1. Room identity is permanent. Rooms are never renumbered or renamed by the
//     system, and historical records stay attached to the room they were
//     recorded in — even after that room is culled.
//  2. Only rooms that still hold birds accept NEW operational records
//     (egg production, feed, medication, daily operations). Culled, inactive,
//     preparing and cleaning rooms are hidden from those pickers while their
//     history remains fully readable in analytics and reports.
import type { Room } from "@/lib/farm-data";

export const ROOM_STATUSES = ["active", "culled", "inactive", "preparing", "cleaning"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  active: "Active",
  culled: "Culled",
  inactive: "Inactive",
  preparing: "Preparing",
  cleaning: "Under Cleaning",
};

export const ROOM_STATUS_TONES: Record<RoomStatus, string> = {
  active: "bg-emerald-500/12 text-emerald-700 border-emerald-500/30",
  culled: "bg-destructive/10 text-destructive border-destructive/30",
  inactive: "bg-muted text-muted-foreground border-border",
  preparing: "bg-amber-500/12 text-amber-700 border-amber-500/30",
  cleaning: "bg-sky-500/12 text-sky-700 border-sky-500/30",
};

export function roomStatus(room: Pick<Room, "status">): RoomStatus {
  const s = (room.status ?? "active") as RoomStatus;
  return (ROOM_STATUSES as readonly string[]).includes(s) ? s : "active";
}

export function roomStatusLabel(room: Pick<Room, "status">) {
  return ROOM_STATUS_LABELS[roomStatus(room)];
}

/** Rooms that may receive NEW production / feed / medication records. */
export function productionRooms(rooms: Room[]): Room[] {
  return rooms.filter((r) => roomStatus(r) === "active");
}

export type EggColumn = "r2" | "r3" | "r4";
const EGG_COLUMNS: EggColumn[] = ["r2", "r3", "r4"];

/**
 * Egg production is stored in the fixed columns r2 / r3 / r4, which literally
 * belong to ROOM 2, ROOM 3 and ROOM 4 — the farm's production rooms.
 *
 * Name-based mapping is only safe when EVERY eligible room carries a distinct
 * number that matches one of those columns (e.g. ROOM 2/3/4). On any other
 * farm — including one with an active ROOM 1 — a partial name match would
 * shuffle historical figures under the wrong room, so we keep the original
 * positional mapping (first eligible room -> r2, and so on).
 */
export function eggSlots(rooms: Room[]): { room: Room; key: EggColumn }[] {
  const eligible = productionRooms(rooms);

  const taken = new Set<EggColumn>();
  const named: { room: Room; key: EggColumn }[] = [];
  for (const room of eligible) {
    const m = room.name.match(/(\d+)\s*$/);
    const key = m ? (`r${m[1]}` as EggColumn) : null;
    if (!key || !EGG_COLUMNS.includes(key) || taken.has(key)) break;
    taken.add(key);
    named.push({ room, key });
  }

  if (named.length === eligible.length) {
    return named.sort((a, b) => EGG_COLUMNS.indexOf(a.key) - EGG_COLUMNS.indexOf(b.key));
  }

  // Fallback: legacy positional mapping.
  return eligible
    .slice(0, EGG_COLUMNS.length)
    .map((room, i) => ({ room, key: EGG_COLUMNS[i] }));
}

