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
            <Brain className="h-3.5 w-3.5" /> Bird Losses Watch
          </div>
          <h3 className="mt-1 font-display text-2xl md:text-3xl font-semibold">AI Intelligence · Bird losses</h3>
          <p className="mt-1 text-sm text-primary-foreground/70 max-w-2xl">
            Compares your recent bird losses with what your farm normally records, so you know if things are getting worse.
          </p>
        </div>
        <span className="hidden md:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/80">
          <Sparkles className="h-3 w-3" /> Live
        </span>
      </div>

      <div className="mt-5">
        {report.status === "learning" && (
          <LearningNotice message={report.message ?? "Still learning your farm's bird-loss pattern."} total={report.totalRecords} />
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
        PoultryPro helps you spot changes in bird losses. It does not diagnose a disease or replace a vet's assessment.
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
            {total} mortality record{total === 1 ? "" : "s"} saved
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
          <div className="font-display text-lg font-semibold">Bird losses look normal</div>
          <div className="mt-1 text-sm text-primary-foreground/80">
            Your recent losses are within what your farm usually records. Keep logging daily.
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">
            Learned from {total} mortality records
          </div>
        </div>
      </div>
    </div>
  );
}

function MortalityEventCard({ event }: { event: MortalityEvent }) {
  const [open, setOpen] = useState(false);
  const [tech, setTech] = useState(false);

  const pct = event.aboveBaselinePct;
  const isBelow = pct !== null && pct < 0;
  const isAbove = pct !== null && pct > 0;

  const recent = Math.round(event.recentLoss);
  const expected = Math.round(event.expectedLoss);
  const diffBirds = Math.abs(recent - expected);

  let headline: string;
  let explanation: string;
  let situation: string;
  let toneIsGood = false;

  if (isBelow) {
    headline = "Bird losses are lower than usual";
    explanation = `You recorded ${fmtInt(recent)} bird loss${recent === 1 ? "" : "es"} in the last ${event.recentDays} days. Based on your previous farm records, about ${fmtInt(expected)} were expected.`;
    situation = "Current situation: Better than usual";
    toneIsGood = true;
  } else if (isAbove) {
    headline = "Bird losses are increasing";
    explanation = `You lost ${fmtInt(recent)} bird${recent === 1 ? "" : "s"} in the last ${event.recentDays} days. This is ${fmtInt(diffBirds)} more bird${diffBirds === 1 ? "" : "s"} than your farm usually records.`;
    situation = "Current situation: Needs attention";
  } else {
    headline = "New bird losses recorded";
    explanation = `You recorded ${fmtInt(recent)} bird loss${recent === 1 ? "" : "es"} in the last ${event.recentDays} days.`;
    situation = "Current situation: Keep watching";
  }

  const style = mortSeverityStyle(event.severity);
  const ringClass = toneIsGood ? "border-emerald-500/30" : style.ring;
  const bgClass = toneIsGood ? "bg-emerald-500/5" : "bg-white/5";

  return (
    <div className={`rounded-2xl border ${ringClass} ${bgClass} p-3 md:p-4 backdrop-blur`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
            toneIsGood ? "bg-emerald-500/20 text-emerald-200" : style.badge
          }`}>
            {toneIsGood ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {toneIsGood ? "Good news" : "Needs attention"}
          </span>
        </div>
        <div className="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">
          {event.scopeLabel}
        </div>
        <div className="mt-0.5 font-display text-lg md:text-2xl font-semibold leading-tight flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-[color:var(--gold)]" /> {headline}
        </div>
        <p className="mt-1 text-sm text-primary-foreground/85">{explanation}</p>
        <p className="mt-1 text-[13px] text-primary-foreground/70">{situation}</p>
      </div>

      {!toneIsGood && event.causes.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">
            Recorded causes
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {event.causes.slice(0, 4).map((c, i) => (
              <span key={i} className="inline-flex items-center rounded-full bg-[color:var(--gold)]/20 text-[color:var(--gold)] px-2 py-0.5 text-[11px]">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-primary-foreground/90"
      >
        {open ? <>Hide details <ChevronUp className="h-3 w-3" /></> : <>See why <ChevronDown className="h-3 w-3" /></>}
      </button>

      {open && (
        <div className="mt-2 rounded-xl bg-black/25 border border-white/10 p-3 text-xs text-primary-foreground/85 space-y-3">
          <div>
            <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">What is happening</div>
            <div>{explanation}</div>
          </div>
          <div>
            <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">Where</div>
            <div>{event.scopeLabel}</div>
          </div>
          {!toneIsGood && (
            <>
              <div>
                <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">What may be causing this</div>
                <div>
                  {event.causes.length > 0
                    ? event.causes.join(" · ")
                    : "No specific causes were logged with these records. Try adding a cause when recording losses."}
                </div>
              </div>
              <div>
                <div className="text-primary-foreground/60 uppercase tracking-[0.14em] text-[10px]">What to check</div>
                <div>
                  {event.factors.length > 0
                    ? event.factors.join(" · ")
                    : "Check feed intake, water supply, heat, ventilation and flock health."}
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => setTech((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-primary-foreground/60 hover:text-primary-foreground/90"
          >
            {tech ? "Hide technical details" : "Technical details"} <ChevronDown className={`h-3 w-3 transition-transform ${tech ? "rotate-180" : ""}`} />
          </button>

          {tech && (
            <div className="rounded-lg bg-black/30 border border-white/10 p-2 space-y-1 text-[11px] text-primary-foreground/75">
              <div>Recent: {fmtInt(event.recentLoss)} bird{event.recentLoss === 1 ? "" : "s"} in last {event.recentDays} day{event.recentDays === 1 ? "" : "s"} ({fmtDate(event.firstEventDate)} → {fmtDate(event.latestDate)}).</div>
              <div>Expected (from prior {event.baselineWindowDays}-day pattern): {fmt(event.expectedLoss)} bird{event.expectedLoss === 1 ? "" : "s"}, or {fmt(event.baselinePerDay)}/day.</div>
              {pct !== null && (
                <div>
                  Change: {fmt(Math.abs(pct))}% {pct >= 0 ? "above" : "below"} normal ({fmt(Math.abs(event.magnitudeAbove))} {pct >= 0 ? "more" : "fewer"} bird{Math.round(Math.abs(event.magnitudeAbove)) === 1 ? "" : "s"} than expected).
                </div>
              )}
              {pct === null && <div>No prior losses recorded, so no percentage comparison is available.</div>}
              <div>Confidence: {event.confidence}.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
