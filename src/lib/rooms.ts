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
  return rooms.filter((r) => roomStatus(r) === "active" && !r.archived);
}

/** Rooms visible in Room Management (archived ones are hidden by default). */
export function visibleRooms(rooms: Room[]): Room[] {
  return rooms.filter((r) => !r.archived);
}

export type EggColumn = "r2" | "r3" | "r4";
const EGG_COLUMNS: EggColumn[] = ["r2", "r3", "r4"];

/**
 * Egg production is stored in the fixed columns r2 / r3 / r4, which literally
 * belong to ROOM 2, ROOM 3 and ROOM 4 — the farm's production rooms. Mapping
 * them positionally (first room in the list -> r2) shifted every figure down
 * by one room once ROOM 1 existed. Map by the number in the room name instead,
 * and only fall back to positional slots for farms whose room names carry no
 * matching number.
 */
export function eggSlots(rooms: Room[]): { room: Room; key: EggColumn }[] {
  const eligible = productionRooms(rooms);
  const taken = new Set<EggColumn>();
  const byName: { room: Room; key: EggColumn | null }[] = eligible.map((room) => {
    const m = room.name.match(/(\d+)\s*$/);
    const key = m ? (`r${m[1]}` as EggColumn) : null;
    if (key && EGG_COLUMNS.includes(key) && !taken.has(key)) {
      taken.add(key);
      return { room, key };
    }
    return { room, key: null };
  });

  const free = EGG_COLUMNS.filter((k) => !taken.has(k));
  const out: { room: Room; key: EggColumn }[] = [];
  for (const entry of byName) {
    if (entry.key) out.push({ room: entry.room, key: entry.key });
    else {
      const k = free.shift();
      if (k) out.push({ room: entry.room, key: k });
    }
  }
  return out.sort((a, b) => EGG_COLUMNS.indexOf(a.key) - EGG_COLUMNS.indexOf(b.key));
}
