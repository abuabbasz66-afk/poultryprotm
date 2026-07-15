import { useMemo, useState } from "react";
import { Sparkles, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import type { EggRow, Room, Mortality, Feed, Health, Price } from "@/lib/farm-data";
import { buildFarmInsights, insightStatusStyle, type FarmInsight } from "@/lib/farm-insights";

type Props = {
  eggs: EggRow[];
  rooms: Room[];
  mortality: Mortality[];
  feed: Feed[];
  health: Health[];
  prices: Price[];
  loading?: boolean;
};

export function FarmInsightsIntelligence(props: Props) {
  const { eggs, rooms, mortality, feed, health, prices, loading } = props;

  const report = useMemo(
    () => buildFarmInsights({ eggs, rooms, mortality, feed, health, prices }),
    [eggs, rooms, mortality, feed, health, prices],
  );

  return (
    <section className="rounded-3xl border border-[color:var(--gold)]/30 bg-[color:var(--cream,#fdf8ee)]/70 p-5 md:p-7 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)]">
        <Sparkles className="h-3.5 w-3.5" /> AI-Supported Farm Insights
      </div>
      <h2 className="mt-1 font-display text-2xl md:text-3xl font-semibold text-foreground">Your Farm Today</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
        A simple summary of what PoultryPro sees in your farm records.
      </p>

      {/* Daily briefing */}
      <div className="mt-5 rounded-2xl border border-[color:var(--forest)]/15 bg-white/70 p-4 md:p-5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--forest)]">
          <Lightbulb className="h-3.5 w-3.5" /> Daily briefing
        </div>
        {loading ? (
          <p className="mt-2 text-sm text-muted-foreground">Checking your farm records...</p>
        ) : report.ready ? (
          <p className="mt-2 text-[15px] leading-relaxed text-foreground">{report.briefing}</p>
        ) : (
          <p className="mt-2 text-sm text-foreground">{report.message}</p>
        )}
      </div>

      {/* Insight cards */}
      {report.ready && report.insights.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3">
          {report.insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} />
          ))}
        </div>
      )}

      <div className="mt-5 text-[11px] text-muted-foreground border-t border-[color:var(--forest)]/10 pt-3">
        PoultryPro provides operational decision support and does not replace veterinary diagnosis or professional farm management judgement.
      </div>

    </section>
  );
}

function InsightCard({ insight }: { insight: FarmInsight }) {
  const [open, setOpen] = useState(false);
  const style = insightStatusStyle(insight.status);

  return (
    <article className={`rounded-2xl border ${style.ring} bg-white p-4 md:p-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${style.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full bg-white/90`} /> {insight.status}
        </span>
        <span className="inline-flex items-center rounded-full border border-[color:var(--forest)]/20 bg-[color:var(--forest)]/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--forest)]">
          {insight.category}
        </span>
        {insight.scopeLabel && insight.scopeLabel !== insight.category && (
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {insight.scopeLabel}
          </span>
        )}
      </div>

      <h3 className="mt-2 font-display text-lg md:text-xl font-semibold text-foreground">{insight.title}</h3>

      <div className="mt-2 space-y-2 text-[14px] leading-relaxed text-foreground">
        <p><span className="font-semibold text-muted-foreground">What we found. </span>{insight.whatWeFound}</p>
        <p><span className="font-semibold text-muted-foreground">Why it matters. </span>{insight.whyItMatters}</p>
      </div>

      {insight.whatToCheck.length > 0 && (
        <div className="mt-3 rounded-xl bg-[color:var(--forest)]/5 border border-[color:var(--forest)]/10 p-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--forest)] font-semibold">What to check</div>
          <ul className="mt-1.5 space-y-1 text-[14px] text-foreground">
            {insight.whatToCheck.slice(0, 4).map((c, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden>•</span><span>{c}</span></li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--forest)] hover:underline"
        aria-expanded={open}
      >
        Why am I seeing this?
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <ul className="mt-2 rounded-lg bg-muted/40 p-3 text-[13px] text-foreground space-y-1">
          {insight.evidence.map((e, i) => (
            <li key={i} className="flex gap-2"><span aria-hidden>•</span><span>{e}</span></li>
          ))}
        </ul>
      )}
    </article>
  );
}

