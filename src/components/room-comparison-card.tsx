import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import type { EggRow, Feed, Mortality, Room } from "@/lib/farm-data";
import { computeProductionSeries, fmtPct } from "@/lib/production-percent";
import { toDateKey } from "@/lib/date-key";

type RangeKey = "today" | "7d" | "30d" | "custom";

function dayKeyOffset(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x: number) => (x < 10 ? `0${x}` : String(x));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type RoomStat = {
  roomId: string;
  roomName: string;
  eggs: number;
  birdDays: number;
  pct: number | null;
  deaths: number;
  bags: number;
};

/** Section 4 — visual room-vs-room performance comparison over a period. */
export function RoomComparisonCard({
  rooms, eggs, mortality, feed, bagWeightKg,
}: {
  rooms: Room[];
  eggs: EggRow[];
  mortality: Mortality[];
  feed: Feed[];
  bagWeightKg: number;
}) {
  const [range, setRange] = useState<RangeKey>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const series = useMemo(() => computeProductionSeries(eggs, rooms, mortality), [eggs, rooms, mortality]);

  const bounds = useMemo(() => {
    const today = dayKeyOffset(0);
    if (range === "7d") return { start: dayKeyOffset(6), end: today };
    if (range === "30d") return { start: dayKeyOffset(29), end: today };
    if (range === "custom") return { start: from || "0000-01-01", end: to || today };
    // "Today" falls back to the most recent recorded production day so the
    // comparison is never empty when the farm records in the evening.
    const latest = series[0]?.date ? (toDateKey(series[0].date) ?? today) : today;
    const key = series.some((s) => (toDateKey(s.date) ?? s.date) === today) ? today : latest;
    return { start: key, end: key };
  }, [range, from, to, series]);

  const inRange = (raw: string) => {
    const k = toDateKey(raw) ?? raw;
    return k >= bounds.start && k <= bounds.end;
  };

  const stats = useMemo<RoomStat[]>(() => {
    const map = new Map<string, RoomStat>();
    for (const d of series) {
      if (!inRange(d.date)) continue;
      for (const r of d.rooms) {
        const cur = map.get(r.roomId) ?? { roomId: r.roomId, roomName: r.roomName, eggs: 0, birdDays: 0, pct: null, deaths: 0, bags: 0 };
        cur.eggs += r.eggs;
        if (r.birds !== null) cur.birdDays += r.birds;
        map.set(r.roomId, cur);
      }
    }
    for (const s of map.values()) s.pct = s.birdDays > 0 ? (s.eggs / s.birdDays) * 100 : null;
    for (const m of mortality) {
      if (!inRange(m.date)) continue;
      const room = rooms.find((r) => r.name === m.room);
      const cur = room ? map.get(room.id) : undefined;
      if (cur) cur.deaths += Math.abs(Number(m.loss) || 0);
    }
    for (const f of feed) {
      if (!inRange(f.date)) continue;
      const room = rooms.find((r) => r.name === f.room);
      const cur = room ? map.get(room.id) : undefined;
      if (cur) cur.bags += Number(f.bags) || 0;
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.pct === null && b.pct === null) return b.eggs - a.eggs;
      if (a.pct === null) return 1;
      if (b.pct === null) return -1;
      return b.pct - a.pct;
    });
  }, [series, mortality, feed, rooms, bounds.start, bounds.end]);

  const max = stats.reduce((m, s) => Math.max(m, s.pct ?? 0), 0);
  const round1 = (n: number) => Math.round(n * 10) / 10;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 shadow-[var(--shadow-soft)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 className="inline-flex items-center gap-2 font-display text-base font-semibold">
            <BarChart3 className="h-4 w-4 shrink-0 text-[color:var(--forest)]" /> Room Comparison
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Production, mortality and feed performance per room</p>
        </div>
      </div>

      <div className="mt-3 inline-flex flex-wrap gap-1 rounded-full bg-secondary p-1 text-[11px] font-medium">
        {([["today", "Today"], ["7d", "7 Days"], ["30d", "30 Days"], ["custom", "Custom"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setRange(k)}
            className={"rounded-full px-3 py-1 transition " + (range === k ? "bg-[color:var(--forest)] text-primary-foreground" : "text-muted-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1" />
          <span className="text-muted-foreground">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1" />
        </div>
      )}

      <div className="mt-4 space-y-3">
        {stats.map((s, i) => {
          const top = i === 0;
          const width = max > 0 ? Math.max(4, ((s.pct ?? 0) / max) * 100) : 0;
          const kgPer100 = s.eggs > 0 && s.bags > 0 ? (s.bags * bagWeightKg * 100) / s.eggs : null;
          return (
            <div key={s.roomId} className="rounded-2xl border border-border bg-secondary/30 p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <span className="flex min-w-0 items-center gap-1.5 text-sm">
                  {top && <span aria-hidden>🥇</span>}
                  <span className={"truncate " + (top ? "font-semibold" : "")}>{s.roomName}</span>
                </span>
                <span className="shrink-0 tabular-nums text-sm font-semibold">{fmtPct(s.pct)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className={"h-full rounded-full " + (top ? "bg-[color:var(--forest)]" : "bg-[color:var(--forest)]/50")} style={{ width: `${width}%` }} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-4">
                <span>Eggs: <span className="tabular-nums text-foreground">{s.eggs.toLocaleString()}</span></span>
                <span>Mortality: <span className="tabular-nums text-foreground">{s.deaths}</span></span>
                <span>Feed: <span className="tabular-nums text-foreground">{s.bags > 0 ? `${round1(s.bags * bagWeightKg)} kg` : "N/A"}</span></span>
                <span>Feed/100 eggs: <span className="tabular-nums text-foreground">{kgPer100 === null ? "N/A" : `${round1(kgPer100)} kg`}</span></span>
              </div>
            </div>
          );
        })}
        {stats.length === 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground">No production records in this period.</div>
        )}
      </div>
    </section>
  );
}
