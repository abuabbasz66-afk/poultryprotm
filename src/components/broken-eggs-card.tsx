import { Fragment, useMemo, useState } from "react";
import { ChevronDown, EggOff, TrendingDown, TrendingUp } from "lucide-react";
import type { EggRow, Room } from "@/lib/farm-data";
import { summarise, breakageByRoom, breakageTrend, breakageInsight, brokenOf, totalBroken } from "@/lib/broken-eggs";
import { eggSlots } from "@/lib/rooms";
import { toDateKey } from "@/lib/date-key";
import { cn } from "@/lib/utils";

function dayKeyOffset(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x: number) => (x < 10 ? `0${x}` : String(x));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}


/** Breakage overview: farm-wide rate, per-room table, 30-day trend, insight. */
export function BrokenEggsCard({ eggs, rooms }: { eggs: EggRow[]; rooms: Room[] }) {
  const { overall, rows, trend, insight, last7, prev7 } = useMemo(() => {
    const t = breakageTrend(eggs, 30);
    const l7 = t.slice(-7);
    const p7 = t.slice(-14, -7);
    const avg = (xs: typeof t) =>
      xs.length ? xs.reduce((s, p) => s + p.pct, 0) / xs.length : 0;
    return {
      overall: summarise(eggs),
      rows: breakageByRoom(eggs, rooms),
      trend: t,
      insight: breakageInsight(eggs, rooms),
      last7: avg(l7),
      prev7: avg(p7),
    };
  }, [eggs, rooms]);

  const delta = last7 - prev7;
  const improving = delta < -0.1;
  const worsening = delta > 0.1;
  const tone =
    overall.breakagePct >= 5 ? "text-destructive"
      : overall.breakagePct >= 3 ? "text-amber-600"
        : "text-emerald-600";

  const max = Math.max(1, ...trend.map((p) => p.pct));

  // --- Per-date broken egg log (Date | R2 | R3 | R4 | Total) ---
  const [showAll, setShowAll] = useState(false);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const slots = useMemo(() => eggSlots(rooms), [rooms]);
  const log = useMemo(
    () => eggs.map((e) => ({
      row: e,
      dateKey: toDateKey(e.date) ?? e.date,
      perRoom: slots.map((s) => ({ key: s.key, name: s.room.name, broken: brokenOf(e, s.key) })),
      extra: Number(e.broken_extra) || 0,
      total: totalBroken(e),
    })),
    [eggs, slots],
  );
  const windowTotal = (days: number) => {
    const start = dayKeyOffset(days - 1);
    const end = dayKeyOffset(0);
    return log.reduce((s, l) => (l.dateKey >= start && l.dateKey <= end ? s + l.total : s), 0);
  };
  const brokenToday = windowTotal(1);
  const broken7 = windowTotal(7);
  const broken30 = windowTotal(30);
  const shownLog = showAll ? log : log.slice(0, 7);

  return (

    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 font-display text-base font-semibold text-foreground">
          <EggOff className="h-4 w-4 text-[color:var(--forest)]" /> Broken Eggs
        </h3>
        {(improving || worsening) && (
          <span className={cn("inline-flex items-center gap-1 text-xs", improving ? "text-emerald-600" : "text-destructive")}>
            {improving ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
            {Math.abs(delta).toFixed(1)}% vs last week
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Collected" value={overall.collected.toLocaleString()} />
        <Stat label="Broken" value={overall.broken.toLocaleString()} />
        <Stat label="Breakage rate" value={`${overall.breakagePct.toFixed(1)}%`} className={tone} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Broken today" value={brokenToday.toLocaleString()} />
        <Stat label="Broken — 7 days" value={broken7.toLocaleString()} />
        <Stat label="Broken — 30 days" value={broken30.toLocaleString()} />
      </div>

      {log.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 px-3 font-medium">Date</th>
                {slots.map((s) => (
                  <th key={s.key} className="py-2 px-3 font-medium text-right whitespace-nowrap">
                    {s.room.name.replace(/^ROOM\s*/i, "R")}
                  </th>
                ))}
                <th className="py-2 px-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {shownLog.map((l) => {
                const isOpen = openDate === l.dateKey;
                return (
                  <Fragment key={l.row.id ?? l.dateKey}>
                    <tr
                      className="cursor-pointer border-t border-border/60 hover:bg-secondary/40"
                      onClick={() => setOpenDate(isOpen ? null : l.dateKey)}
                    >
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                          {l.row.label || l.row.date}
                        </span>
                      </td>
                      {l.perRoom.map((r) => (
                        <td key={r.key} className="py-2 px-3 text-right tabular-nums">{r.broken || <span className="text-muted-foreground/50">—</span>}</td>
                      ))}
                      <td className="py-2 px-3 text-right font-semibold tabular-nums">{l.total}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-secondary/30">
                        <td colSpan={slots.length + 2} className="px-3 py-3">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Broken egg breakdown</div>
                          <div className="mt-2 max-w-md space-y-1.5">
                            {l.perRoom.map((r) => (
                              <div key={r.key} className="flex items-center justify-between gap-3 text-sm">
                                <span className="truncate">{r.name}</span>
                                <span className="tabular-nums">{r.broken} broken</span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="truncate text-muted-foreground">Loose eggs</span>
                              <span className="tabular-nums">{l.extra} broken</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-2 text-sm font-semibold">
                              <span>Total</span>
                              <span className="tabular-nums">{l.total} broken</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {log.length > 7 && (
        <div className="mt-3 text-center">
          <button onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-[color:var(--forest)] hover:underline">
            {showAll ? "Show latest 7 only" : `View all records (${log.length})`}
          </button>
        </div>
      )}



      {trend.length > 1 && (
        <div className="mt-4 flex h-16 items-end gap-1">
          {trend.map((p) => (
            <div
              key={p.dateKey}
              title={`${p.dateKey}: ${p.pct.toFixed(1)}% (${p.broken} broken)`}
              className={cn(
                "flex-1 rounded-t",
                p.pct >= 5 ? "bg-destructive/70" : p.pct >= 3 ? "bg-amber-400" : "bg-emerald-500/70",
              )}
              style={{ height: `${Math.max(4, (p.pct / max) * 100)}%` }}
            />
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground">{r.roomName}</span>
              <span className="text-muted-foreground">
                {r.broken.toLocaleString()} broken ·{" "}
                <span className={r.pct >= 5 ? "text-destructive" : r.pct >= 3 ? "text-amber-600" : "text-muted-foreground"}>
                  {r.pct.toFixed(1)}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {insight && (
        <p className={cn(
          "mt-4 rounded-xl border px-3 py-2 text-[13px]",
          insight.severity === "warning"
            ? "border-destructive/30 bg-destructive/8 text-destructive"
            : "border-amber-400/40 bg-amber-400/10 text-amber-700",
        )}>
          {insight.message}
        </p>
      )}

      {overall.collected === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Record egg production with broken-egg counts to see breakage trends here.
        </p>
      )}
    </section>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 px-3 py-2">
      <div className={cn("font-display text-lg font-semibold text-foreground", className)}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
