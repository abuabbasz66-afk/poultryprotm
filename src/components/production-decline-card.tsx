import { useMemo, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { EggRow, Room, Mortality, Feed, Health } from "@/lib/farm-data";
import { detectProductionDecline, severityStyle, type DeclineEvent } from "@/lib/production-decline";

function fmt(n: number, digits = 1) {
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

export function ProductionDeclineIntelligence({
  eggs, rooms, mortality, feed, health,
}: {
  eggs: EggRow[]; rooms: Room[]; mortality: Mortality[]; feed: Feed[]; health: Health[];
}) {
  const report = useMemo(
    () => detectProductionDecline({ eggs, rooms, mortality, feed, health }),
    [eggs, rooms, mortality, feed, health],
  );

  return (
    <div className="rounded-3xl border border-[color:var(--gold)]/40 bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--ink)] text-primary-foreground p-6 md:p-7 shadow-[var(--shadow-lift)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
            <Brain className="h-3.5 w-3.5" /> Production Decline Detection
          </div>
          <h3 className="mt-1 font-display text-2xl md:text-3xl font-semibold">AI Intelligence · Production monitor</h3>
          <p className="mt-1 text-sm text-primary-foreground/70 max-w-2xl">
            Rolling 7-recorded-day baseline analysed against your latest production. Whole farm and per-room signals detected from your live records.
          </p>
        </div>
        <span className="hidden md:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/80">
          <Sparkles className="h-3 w-3" /> Live
        </span>
      </div>

      <div className="mt-5">
        {report.status === "learning" && (
          <LearningNotice message={report.message ?? "Learning farm production pattern — more production records required."} total={report.totalRecords} />
        )}

        {report.status === "ok" && report.events.length === 0 && (
          <NoDeclineNotice total={report.totalRecords} />
        )}

        {report.status === "ok" && report.events.length > 0 && (
          <div className="grid grid-cols-1 gap-3">
            {report.events.map((ev, i) => (
              <DeclineEventCard key={`${ev.scopeLabel}-${ev.firstDeclineDate}-${i}`} event={ev} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 text-[11px] text-primary-foreground/60 border-t border-white/10 pt-3">
        Correlated signals are shown for investigation only. PoultryPro AI Intelligence supports operational decisions and does not confirm veterinary or clinical causation.
      </div>
    </div>
  );
}

function LearningNotice({ message, total }: { message: string; total: number }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--gold)]/20 text-[color:var(--gold)]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="font-display text-lg font-semibold">Learning farm production pattern</div>
          <div className="mt-1 text-sm text-primary-foreground/80">{message}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">
            {total} production record{total === 1 ? "" : "s"} on file
          </div>
        </div>
      </div>
    </div>
  );
}

function NoDeclineNotice({ total }: { total: number }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="font-display text-lg font-semibold">No production decline detected</div>
          <div className="mt-1 text-sm text-primary-foreground/80">
            Current production is tracking within 5% of the 7-recorded-day baseline for the whole farm and all analysed rooms.
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">
            Baseline built from {total} production records
          </div>
        </div>
      </div>
    </div>
  );
}

function DeclineEventCard({ event }: { event: DeclineEvent }) {
  const [open, setOpen] = useState(false);
  const style = severityStyle(event.severity);
  const isRecovered = event.status === "Recovered";

  return (
    <div className={`rounded-2xl border ${style.ring} ${isRecovered ? "bg-emerald-500/5" : "bg-white/5"} p-3 md:p-4 backdrop-blur`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${style.badge}`}>
            {isRecovered ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {isRecovered ? `${event.severity} · Recovered` : `${event.severity} Production Decline`}
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
            event.confidence === "High" ? "bg-emerald-500/20 text-emerald-200" :
            event.confidence === "Moderate" ? "bg-amber-500/20 text-amber-100" :
            "bg-slate-500/20 text-slate-100"
          }`}>
            {event.confidence} confidence
          </span>
        </div>
        <div className="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">
          {event.scopeLabel}
        </div>
        <div className="mt-0.5 font-display text-lg md:text-2xl font-semibold leading-tight">
          {fmt(event.declinePct)}% {isRecovered ? "peak dip vs" : "below"} 7-day baseline
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <Metric label="Baseline" value={`${fmt(event.baseline)} crates/day`} />
        <Metric label={isRecovered ? "Recovery" : "Current"} value={`${fmt(event.current)} crates/day`} />
        <Metric label="Duration" value={`${event.durationDays} rec. day${event.durationDays === 1 ? "" : "s"}`} />
        <Metric label={isRecovered ? "Recovered on" : "Latest record"} value={fmtDate(event.latestDate)} />
      </div>

      {event.signals.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-primary-foreground/60">Signals:</span>
          {event.signals.map((s, i) => (
            <span key={i} className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-primary-foreground/90">
              {s.label}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-primary-foreground/90"
      >
        {open ? <>Hide analysis <ChevronUp className="h-3 w-3" /></> : <>View analysis <ChevronDown className="h-3 w-3" /></>}
      </button>

      {open && (
        <div className="mt-2 rounded-xl bg-black/25 border border-white/10 p-3 text-xs text-primary-foreground/85 space-y-2">
          <div>
            <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">Detection window</div>
            <div>
              Decline observed from {fmtDate(event.firstDeclineDate)} to {fmtDate(event.latestDate)} across {event.durationDays} consecutive recorded production day{event.durationDays === 1 ? "" : "s"}.
              Baseline built from {event.baselineWindow} recorded day{event.baselineWindow === 1 ? "" : "s"} immediately preceding the decline.
            </div>
          </div>
          <div>
            <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">Calculation</div>
            <div>
              ((baseline {fmt(event.baseline)} − current {fmt(event.current)}) / baseline {fmt(event.baseline)}) × 100 ={" "}
              {fmt(event.declinePct)}%.
            </div>
          </div>
          {event.factors.length > 0 && (
            <div>
              <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">Possible factors to investigate</div>
              <div>{event.factors.join(" · ")}</div>
            </div>
          )}
          {event.signals.length === 0 && (
            <div className="text-primary-foreground/70">
              No correlated feed, mortality or health signals recorded during the decline window. Consider adding recent records to strengthen the analysis.
            </div>
          )}
          <div className="text-primary-foreground/60">
            Correlated signals are shown for investigation only and are not a confirmed cause of the decline.
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/20 border border-white/10 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-primary-foreground/60">{label}</div>
      <div className="text-sm font-semibold text-primary-foreground">{value}</div>
    </div>
  );
}
