import { useMemo, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, ChevronDown, ChevronUp, Sparkles, TrendingDown } from "lucide-react";
import type { EggRow, Room, Mortality, Feed, Health } from "@/lib/farm-data";
import { detectProductionDecline, riskStyle, type DeclineEvent } from "@/lib/production-decline";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}
function daysBetween(a: string, b: string) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}
function whenLabel(firstDate: string) {
  const diff = daysBetween(firstDate, new Date().toISOString());
  if (diff <= 0) return "This started today.";
  if (diff === 1) return "This started yesterday.";
  return `This started about ${diff} days ago.`;
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
            <Brain className="h-3.5 w-3.5" /> Egg Production Watch
          </div>
          <h3 className="mt-1 font-display text-2xl md:text-3xl font-semibold">Production Decline Detection</h3>
          <p className="mt-1 text-sm text-primary-foreground/70 max-w-2xl">
            We look at your farm's own egg records to spot when production is dropping and tell you what to check.
          </p>
        </div>
        <span className="hidden md:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/80">
          <Sparkles className="h-3 w-3" /> Live
        </span>
      </div>

      <div className="mt-5">
        {report.status === "learning" && (
          <LearningNotice message={report.message ?? "Still learning your farm's egg production pattern."} total={report.totalRecords} />
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
        PoultryPro helps you spot changes in egg production. It supports your decisions and does not replace a vet's advice.
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
          <div className="font-display text-lg font-semibold">Getting to know your farm</div>
          <div className="mt-1 text-sm text-primary-foreground/80">{message}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">
            {total} egg record{total === 1 ? "" : "s"} saved
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
          <div className="font-display text-lg font-semibold">Egg production looks normal</div>
          <div className="mt-1 text-sm text-primary-foreground/80">
            Your farm is producing about the same number of eggs as usual. Keep up your daily records.
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">
            Learned from {total} egg records
          </div>
        </div>
      </div>
    </div>
  );
}

function DeclineEventCard({ event }: { event: DeclineEvent }) {
  const [open, setOpen] = useState(false);
  const [tech, setTech] = useState(false);
  const style = riskStyle(event.risk);

  return (
    <div className={`rounded-2xl border ${style.ring} bg-white/5 p-3 md:p-4 backdrop-blur`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${style.badge}`}>
            <AlertTriangle className="h-3 w-3" /> {event.riskLabel}
          </span>
        </div>
        <div className="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">
          {event.scopeLabel}
        </div>
        <div className="mt-0.5 font-display text-lg md:text-2xl font-semibold leading-tight flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-[color:var(--gold)]" /> {event.title}
        </div>
        <p className="mt-1 text-sm text-primary-foreground/85">{event.whatWeNoticed}</p>
        <p className="mt-1 text-[13px] text-primary-foreground/70">{whenLabel(event.firstDeclineDate)}</p>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-primary-foreground/90"
      >
        {open ? <>Hide details <ChevronUp className="h-3 w-3" /></> : <>See details <ChevronDown className="h-3 w-3" /></>}
      </button>

      {open && (
        <div className="mt-2 rounded-xl bg-black/25 border border-white/10 p-3 text-xs text-primary-foreground/85 space-y-3">
          <div>
            <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">What we noticed</div>
            <div>{event.whatWeNoticed}</div>
          </div>
          <div>
            <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">Where</div>
            <div>{event.scopeLabel}</div>
          </div>
          <div>
            <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">Farm data</div>
            <ul className="mt-0.5 space-y-0.5 list-disc list-inside">
              {event.farmData.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
          <div>
            <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">What to check</div>
            <ul className="mt-0.5 space-y-0.5 list-disc list-inside">
              {event.whatToCheck.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => setTech((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-primary-foreground/60 hover:text-primary-foreground/90"
          >
            {tech ? "Hide technical details" : "Technical details"} <ChevronDown className={`h-3 w-3 transition-transform ${tech ? "rotate-180" : ""}`} />
          </button>

          {tech && (
            <div className="rounded-lg bg-black/30 border border-white/10 p-2 space-y-1 text-[11px] text-primary-foreground/75">
              <div>Current production: {event.currentPct.toFixed(1)}% (eggs per bird).</div>
              <div>Baseline production: {event.baselinePct.toFixed(1)}% (recent 7-day average).</div>
              <div>Change: {event.changePct.toFixed(1)}% below baseline.</div>
              <div>Patterns triggered: {event.reasons.join("; ")}.</div>
              <div>Window: {fmtDate(event.firstDeclineDate)} → {fmtDate(event.latestDate)}.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
