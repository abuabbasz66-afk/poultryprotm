// Daily mortality percentages, per room and for the whole flock.
//
// Room mortality rate = (birds that died in that room ÷ active birds in that
// room on that date) × 100. The denominator is the historical population,
// reconstructed by adding back every loss recorded AFTER that date to the
// room's current head count (same approach as production percentages).
// When the population is unknown the rate is null and the UI shows "N/A".
import type { Room, Mortality } from "@/lib/farm-data";
import { productionRooms } from "@/lib/rooms";
import { roomBirdsOn } from "@/lib/production-percent";
import { toDateKey } from "@/lib/date-key";

export type RoomMortality = {
  roomId: string;
  roomName: string;
  deaths: number;
  birds: number | null;
  pct: number | null;
};

export type DailyMortality = {
  date: string;
  rooms: RoomMortality[];
  total: number;
  totalBirds: number | null;
  overallPct: number | null;
  causes: string[];
  items: Mortality[];
};

/** Columns shown in the mortality table (active production rooms). */
export function mortalityRoomColumns(rooms: Room[], mortality: Mortality[]): Room[] {
  const active = productionRooms(rooms);
  if (active.length) return active;
  const seen = new Set(mortality.map((m) => m.room));
  return rooms.filter((r) => seen.has(r.name));
}

export function computeDailyMortality(
  mortality: Mortality[],
  rooms: Room[],
): DailyMortality[] {
  const cols = mortalityRoomColumns(rooms, mortality);
  const map = new Map<string, { date: string; byRoom: Record<string, number>; causes: string[]; items: Mortality[] }>();

  for (const m of mortality) {
    let g = map.get(m.date);
    if (!g) { g = { date: m.date, byRoom: {}, causes: [], items: [] }; map.set(m.date, g); }
    const loss = Math.abs(Number(m.loss) || 0);
    g.byRoom[m.room] = (g.byRoom[m.room] ?? 0) + loss;
    if (m.cause && !g.causes.includes(m.cause)) g.causes.push(m.cause);
    g.items.push(m);
  }

  return Array.from(map.values()).map((g) => {
    const roomRows: RoomMortality[] = cols.map((room) => {
      const deaths = g.byRoom[room.name] ?? 0;
      const birds = roomBirdsOn(room, g.date, mortality);
      return {
        roomId: room.id,
        roomName: room.name,
        deaths,
        birds,
        pct: birds ? (deaths / birds) * 100 : null,
      };
    });

    const total = Object.values(g.byRoom).reduce((s, n) => s + n, 0);
    const known = roomRows.filter((r) => r.birds !== null);
    const totalBirds = known.length ? known.reduce((s, r) => s + (r.birds ?? 0), 0) : null;

    return {
      date: g.date,
      rooms: roomRows,
      total,
      totalBirds,
      overallPct: totalBirds ? (total / totalBirds) * 100 : null,
      causes: g.causes,
      items: g.items,
    };
  });
}

/** Losses recorded in the last `days` calendar days (inclusive of today). */
export function recentMortality(mortality: Mortality[], days = 7): number {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const cutoffKey = toDateKey(cutoff);
  if (!cutoffKey) return 0;
  return mortality.reduce((s, m) => {
    const key = toDateKey(m.date, now);
    return key && key >= cutoffKey ? s + Math.abs(Number(m.loss) || 0) : s;
  }, 0);
}
