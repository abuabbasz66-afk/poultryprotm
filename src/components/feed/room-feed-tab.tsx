// Room-level feed consumption view — daily table (desktop), expandable cards
// (mobile), farm summary, room comparison, trends and data-quality flags.
// Purely presentational: every figure comes from useRoomFeedAnalytics().
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Info, TrendingDown, TrendingUp } from "lucide-react";
import {
  useRoomFeedAnalytics, FEED_STATUS_LABELS, feedStatusMessage, FEED_STATUS_TONES,
  DEFAULT_FEED_TARGET, fmtGrams, fmtKgValue,
  type FeedDay, type FeedStatus, type FeedTarget, type RoomFeedSummary,
} from "@/lib/feed-per-bird";
import { formatKeyShort } from "@/lib/date-key";

function StatusPill({ status, target, className = "" }: { status: FeedStatus; target?: FeedTarget; className?: string }) {
  return (
    <span
      title={feedStatusMessage(status, target ?? DEFAULT_FEED_TARGET)}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${FEED_STATUS_TONES[status]} ${className}`}
    >
      {FEED_STATUS_LABELS[status]}
    </span>
  );
}

export function RoomFeedTab() {
  const a = useRoomFeedAnalytics();
  const [range, setRange] = useState<7 | 30>(7);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const visibleDays = useMemo(() => a.days.slice(0, range === 7 ? 7 : 30), [a.days, range]);
  const latest = a.latest;

  if (a.isLoading) {
    return <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading room feed records…</div>;
  }

  if (a.days.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-semibold">No room feed records yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Record daily feed per room from the dashboard to unlock feed-per-bird analysis, room comparison and feed status alerts.
        </p>
      </div>
    );
  }

  const totalKgRange = range === 7 ? a.farm.kg7 : a.farm.kg30;
  const avgRange = range === 7 ? a.farm.avg7GramsPerBird : a.farm.avg30GramsPerBird;

  return (
    <div className="space-y-6">
      {/* ------------------------------ Latest day ------------------------------ */}
      {latest && (
        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold">Total Farm Feed</h2>
              <p className="text-xs text-muted-foreground">Latest recorded day · {formatKeyShort(latest.date)}</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              Targets adapt to bird type &amp; age
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <Kpi label="Total Birds" value={latest.totalBirds !== null ? latest.totalBirds.toLocaleString() : "N/A"} />
            <Kpi label="Total Feed Consumed" value={fmtKgValue(latest.totalKg)} sub={`${(latest.totalKg / a.bagWeightKg).toFixed(1)} bags`} />
            <Kpi label="Average Feed / Bird" value={fmtGrams(latest.avgGramsPerBird)} sub="Total feed ÷ total birds" />
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Count label="Normal" n={latest.counts.normal} tone="normal" />
            <Count label="Underfed" n={latest.counts.underfed} tone="underfed" />
            <Count label="Overfed" n={latest.counts.overfed} tone="overfed" />
            {latest.counts.unknown > 0 && <Count label="No bird count" n={latest.counts.unknown} tone="unknown" />}
          </div>

          {latest.unallocatedKg > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              {fmtKgValue(latest.unallocatedKg)} of feed on this day is not linked to a current room. Historical records without a room allocation are shown separately and excluded from the farm average.
            </p>
          )}
        </section>
      )}

      {/* --------------------------- Room comparison --------------------------- */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Room Feed Comparison</h2>
        <p className="text-xs text-muted-foreground">Latest recorded feed intake per bird, room by room.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {a.rooms.map((r) => <RoomCompareCard key={r.roomName} room={r} />)}
        </div>
      </section>

      {/* ------------------------------- Trend --------------------------------- */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Feed Trend</h2>
            <p className="text-xs text-muted-foreground">Daily consumption and feed per bird across the farm.</p>
          </div>
          <div className="inline-flex rounded-full border border-border p-0.5 text-xs">
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={"rounded-full px-3 py-1 " + (range === r ? "bg-[color:var(--forest)] text-primary-foreground" : "text-muted-foreground")}
              >
                {r}-day
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label={`Feed (${range}d)`} value={fmtKgValue(totalKgRange)} />
          <Kpi label={`Avg / bird (${range}d)`} value={fmtGrams(avgRange)} />
          <Kpi
            label="Week-over-week"
            value={a.farm.trend7Pct === null ? "—" : `${a.farm.trend7Pct > 0 ? "+" : ""}${a.farm.trend7Pct.toFixed(0)}%`}
            sub={a.farm.trend7Pct === null ? "Not enough history" : a.farm.trend7Pct > 0 ? "More feed used" : "Less feed used"}
          />
          <Kpi label="Days recorded" value={String(a.days.length)} />
        </div>

        <TrendBars days={visibleDays} />
      </section>

      {/* --------------------------- Daily room table -------------------------- */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Daily Room Feed</h2>
        <p className="text-xs text-muted-foreground">Each room is calculated independently — never combined into one figure.</p>

        {/* Desktop table */}
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Room</th>
                <th className="py-2 pr-3 text-right">Birds</th>
                <th className="py-2 pr-3 text-right">Feed Consumed</th>
                <th className="py-2 pr-3 text-right">Feed/Bird</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleDays.flatMap((d) =>
                d.rooms.map((r, i) => (
                  <tr key={`${d.date}-${r.roomName}`} className="border-b border-border/60">
                    <td className="py-2 pr-3 text-muted-foreground">{i === 0 ? formatKeyShort(d.date) : ""}</td>
                    <td className="py-2 pr-3 font-medium">
                      {r.roomName}
                      {r.unallocated && <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">Unallocated</span>}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.birds !== null ? r.birds.toLocaleString() : "N/A"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtKgValue(r.kg)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtGrams(r.gramsPerBird)}</td>
                    <td className="py-2"><StatusPill status={r.status} target={r.target} /></td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile expandable day cards */}
        <div className="mt-4 space-y-2 md:hidden">
          {visibleDays.map((d) => (
            <DayCard key={d.date} day={d} open={openDay === d.date} onToggle={() => setOpenDay(openDay === d.date ? null : d.date)} bagKg={a.bagWeightKg} />
          ))}
        </div>
      </section>

      {/* ---------------------------- Data quality ----------------------------- */}
      {a.flags.length > 0 && (
        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="font-display text-lg font-semibold">Feed Data Quality</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {a.flags.length} entr{a.flags.length === 1 ? "y" : "ies"} need a look. Records are never changed automatically.
          </p>
          <ul className="mt-3 space-y-2">
            {a.flags.slice(0, 12).map((f, i) => (
              <li key={`${f.id}-${i}`} className="flex items-start gap-2 rounded-2xl border border-border bg-secondary/40 p-3 text-xs">
                <span className={"rounded-full border px-2 py-0.5 text-[9px] uppercase " + (f.quality === "invalid" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-amber-500/30 bg-amber-500/10 text-amber-700")}>
                  {f.quality === "invalid" ? "Invalid" : "Review"}
                </span>
                <span>
                  <span className="font-medium text-foreground">{f.room} · {f.date}</span> — {f.reason}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DayCard({ day, open, onToggle, bagKg }: { day: FeedDay; open: boolean; onToggle: () => void; bagKg: number }) {
  return (
    <div className="rounded-2xl border border-border">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-2 p-3 text-left">
        <div>
          <p className="text-sm font-medium">{formatKeyShort(day.date)}</p>
          <p className="text-[11px] text-muted-foreground">
            {fmtKgValue(day.totalKg)} · {fmtGrams(day.avgGramsPerBird)}/bird avg · {day.rooms.length} room{day.rooms.length === 1 ? "" : "s"}
          </p>
        </div>
        <ChevronDown className={"h-4 w-4 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border p-3">
          {day.rooms.map((r) => (
            <div key={r.roomName} className="rounded-xl border border-border bg-secondary/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold uppercase">{r.roomName}</p>
                <StatusPill status={r.status} target={r.target} />
              </div>
              <p className="text-[11px] text-muted-foreground">{r.birds !== null ? `${r.birds.toLocaleString()} birds` : "Bird count unavailable"}</p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-display text-lg font-semibold">{fmtKgValue(r.kg)}</span>
                <span className="text-xs text-muted-foreground">{(r.kg / bagKg).toFixed(1)} bags</span>
              </div>
              <p className="text-sm font-medium">{fmtGrams(r.gramsPerBird)}/bird</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoomCompareCard({ room }: { room: RoomFeedSummary }) {
  const current = room.latest?.gramsPerBird ?? null;
  const up = (room.changePct ?? 0) > 0;
  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold uppercase">{room.roomName}</p>
        <StatusPill status={room.status} target={room.target} />
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{fmtGrams(current)}</p>
      <p className="text-[11px] text-muted-foreground">
        {room.latest?.birds ? `${room.latest.birds.toLocaleString()} birds · ${fmtKgValue(room.latest.kg)}` : "Bird count unavailable"}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>7d avg {fmtGrams(room.avg7)}</span>
        <span>·</span>
        <span>30d avg {fmtGrams(room.avg30)}</span>
        {room.changePct !== null && Math.abs(room.changePct) >= 5 && (
          <span className={"inline-flex items-center gap-0.5 " + (up ? "text-amber-700" : "text-sky-700")}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(room.changePct).toFixed(0)}% vs 7d
          </span>
        )}
      </div>
    </div>
  );
}

function TrendBars({ days }: { days: FeedDay[] }) {
  const ordered = [...days].reverse();
  const max = Math.max(1, ...ordered.map((d) => d.totalKg));
  return (
    <div className="mt-4">
      <div className="flex h-28 items-end gap-1">
        {ordered.map((d) => (
          <div key={d.date} className="group flex flex-1 flex-col items-center justify-end" title={`${formatKeyShort(d.date)} · ${fmtKgValue(d.totalKg)} · ${fmtGrams(d.avgGramsPerBird)}/bird`}>
            <div
              className="w-full rounded-t bg-[color:var(--forest)]/80"
              style={{ height: `${Math.max(4, (d.totalKg / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{ordered.length ? formatKeyShort(ordered[0].date) : ""}</span>
        <span>{ordered.length ? formatKeyShort(ordered[ordered.length - 1].date) : ""}</span>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Count({ label, n, tone }: { label: string; n: number; tone: FeedStatus }) {
  return (
    <span className={"inline-flex items-center gap-1 rounded-full border px-2.5 py-1 " + FEED_STATUS_TONES[tone]}>
      <span className="font-semibold">{n}</span> {label}
    </span>
  );
}
