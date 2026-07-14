import { useMemo, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, ChevronDown, ChevronUp, Sparkles, HeartPulse } from "lucide-react";
import type { EggRow, Room, Mortality, Feed, Health } from "@/lib/farm-data";
import { detectMortalityPatterns, mortSeverityStyle, type MortalityEvent } from "@/lib/mortality-pattern";

function fmt(n: number, digits = 1) {
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtInt(n: number) {
  return Math.round(n).toLocaleString();
}
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

export function MortalityPatternIntelligence({
  eggs, rooms, mortality, feed, health,
}: {
  eggs: EggRow[]; rooms: Room[]; mortality: Mortality[]; feed: Feed[]; health: Health[];
}) {
  const report = useMemo(
    () => detectMortalityPatterns({ eggs, rooms, mortality, feed, health }),
    [eggs, rooms, mortality, feed, health],
  );

  return (
    <div className="rounded-3xl border border-[color:var(--gold)]/40 bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--ink)] text-primary-foreground p-6 md:p-7 shadow-[var(--shadow-lift)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
            <Brain className="h-3.5 w-3.5" /> Mortality Pattern Detection
          </div>
          <h3 className="mt-1 font-display text-2xl md:text-3xl font-semibold">AI Intelligence · Mortality monitor</h3>
          <p className="mt-1 text-sm text-primary-foreground/70 max-w-2xl">
            Rolling 21-day baseline compared with the last 7 days of losses. Whole farm and per-room clusters detected from your live mortality records.
          </p>
        </div>
        <span className="hidden md:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/80">
          <Sparkles className="h-3 w-3" /> Live
        </span>
      </div>

      <div className="mt-5">
        {report.status === "learning" && (
          <LearningNotice message={report.message ?? "Learning farm mortality pattern."} total={report.totalRecords} />
        )}

        {report.status === "ok" && report.events.length === 0 && (
          <NoAlertNotice total={report.totalRecords} />
        )}

        {report.status === "ok" && report.events.length > 0 && (
          <div className="grid grid-cols-1 gap-3">
            {report.events.map((ev, i) => (
              <MortalityEventCard key={`${ev.scopeLabel}-${ev.latestDate}-${i}`} event={ev} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 text-[11px] text-primary-foreground/60 border-t border-white/10 pt-3">
        PoultryPro detects mortality patterns and provides decision-support signals. It does not confirm a specific disease or provide veterinary diagnosis.
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
          <div className="font-display text-lg font-semibold">Learning farm mortality pattern</div>
          <div className="mt-1 text-sm text-primary-foreground/80">{message}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">
            {total} mortality record{total === 1 ? "" : "s"} on file
          </div>
        </div>
      </div>
    </div>
  );
}

function NoAlertNotice({ total }: { total: number }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="font-display text-lg font-semibold">No unusual mortality pattern detected</div>
          <div className="mt-1 text-sm text-primary-foreground/80">
            Recent losses are tracking within the farm's normal 21-day baseline for the whole farm and all rooms.
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">
            Baseline built from {total} mortality records
          </div>
        </div>
      </div>
    </div>
  );
}

function MortalityEventCard({ event }: { event: MortalityEvent }) {
  const [open, setOpen] = useState(false);
  const style = mortSeverityStyle(event.severity);
  const pctLabel = event.aboveBaselinePct === null
    ? `${fmtInt(event.recentLoss)} bird ${event.recentLoss === 1 ? "loss" : "losses"} vs no prior baseline`
    : event.aboveBaselinePct >= 0
      ? `${fmt(event.aboveBaselinePct)}% above baseline`
      : `${fmt(Math.abs(event.aboveBaselinePct))}% below baseline`;

  return (
    <div className={`rounded-2xl border ${style.ring} bg-white/5 p-3 md:p-4 backdrop-blur`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${style.badge}`}>
            <AlertTriangle className="h-3 w-3" />
            {event.severity} Mortality Pattern
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
        <div className="mt-0.5 font-display text-lg md:text-2xl font-semibold leading-tight flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-[color:var(--gold)]" /> {pctLabel}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <Metric label={`Recent (${event.recentDays}d)`} value={`${fmtInt(event.recentLoss)} bird${event.recentLoss === 1 ? "" : "s"}`} />
        <Metric label="Expected" value={`${fmt(event.expectedLoss)} bird${event.expectedLoss === 1 ? "" : "s"}`} />
        <Metric label="Cluster" value={event.clusterDays > 0 ? `${event.clusterDays} rec. day${event.clusterDays === 1 ? "" : "s"}` : "—"} />
        <Metric label="Latest record" value={fmtDate(event.latestDate)} />
      </div>

      {(event.signals.length > 0 || event.causes.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-primary-foreground/60">Signals:</span>
          {event.causes.slice(0, 3).map((c, i) => (
            <span key={`c${i}`} className="inline-flex items-center rounded-full bg-[color:var(--gold)]/20 text-[color:var(--gold)] px-2 py-0.5 text-[11px]">
              {c}
            </span>
          ))}
          {event.signals.map((s, i) => (
            <span key={`s${i}`} className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-primary-foreground/90">
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
              {fmtInt(event.recentLoss)} bird{event.recentLoss === 1 ? "" : "s"} lost across the last {event.recentDays} day{event.recentDays === 1 ? "" : "s"} ({fmtDate(event.firstEventDate)} → {fmtDate(event.latestDate)}).
              {event.clusterDays >= 2 && <> Losses recorded on {event.clusterDays} consecutive day{event.clusterDays === 1 ? "" : "s"}.</>}
            </div>
          </div>
          <div>
            <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">Baseline</div>
            <div>
              {fmt(event.baselinePerDay)} bird{event.baselinePerDay === 1 ? "" : "s"}/day averaged across the prior {event.baselineWindowDays}-day window.
              Expected losses over the last {event.recentDays} day{event.recentDays === 1 ? "" : "s"}: {fmt(event.expectedLoss)}.
            </div>
          </div>
          <div>
            <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">Magnitude</div>
            <div>
              {(() => {
                if (event.aboveBaselinePct === null) {
                  return `No prior mortality was recorded in the baseline window, so a percentage comparison is not available. Absolute recent loss: ${fmtInt(event.recentLoss)} bird${event.recentLoss === 1 ? "" : "s"}.`;
                }
                const diff = event.magnitudeAbove;
                if (diff > 0) {
                  const n = Math.max(0, diff);
                  return `Recent losses are ${fmt(event.aboveBaselinePct)}% above the baseline daily rate (${fmt(n)} bird${Math.round(n) === 1 ? "" : "s"} above expected).`;
                }
                const n = Math.abs(diff);
                return `Recent losses are ${fmt(Math.abs(event.aboveBaselinePct))}% below the baseline daily rate (${fmt(n)} fewer bird loss${Math.round(n) === 1 ? "" : "es"} than expected).`;
              })()}
            </div>
          </div>
          {event.causes.length > 0 && (
            <div>
              <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">Recorded causes</div>
              <div>{event.causes.join(" · ")}</div>
            </div>
          )}
          {event.factors.length > 0 && (
            <div>
              <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">Possible factors to investigate</div>
              <div>{event.factors.join(" · ")}</div>
            </div>
          )}
          {event.signals.length === 0 && event.causes.length === 0 && (
            <div className="text-primary-foreground/70">
              No correlated production, feed or health signals recorded during the mortality window. Consider adding recent records to strengthen the analysis.
            </div>
          )}
          <div className="text-primary-foreground/60">
            PoultryPro detects mortality patterns and provides decision-support signals. It does not diagnose a specific disease or replace veterinary assessment.
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
