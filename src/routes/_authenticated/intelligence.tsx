import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain, Sparkles, Send, Loader2, ShieldCheck, AlertTriangle, Activity,
  TrendingUp, Gauge, Database, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, CheckCircle2,
} from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { useEggs, useFarm, useFarmId, useFeed, useHealth, useMortality, usePrices, useRooms } from "@/lib/farm-data";
import { useExpenses, useRevenue } from "@/lib/finance-data";
import { useLayerDaily } from "@/lib/layer-rearing";
import { runIntelligence, KIND_LABEL, SEVERITY_TONE, type Insight } from "@/lib/ai/engine";
import { QUALITY_TONE } from "@/lib/ai/quality";
import { useAiRecommendations, useInsightFeedback, useSyncInsights } from "@/lib/ai/store";
import { askFarmAssistant, type AssistantTurn } from "@/lib/ai-assistant.functions";
import { naira } from "@/lib/finance-analytics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/intelligence")({
  head: () => ({
    meta: [
      { title: "AI Farm Intelligence — PoultryPro" },
      { name: "description", content: "Validated farm records turned into baselines, anomaly detection, forecasts, a farm health score and a grounded AI assistant for your poultry farm." },
      { property: "og:title", content: "AI Farm Intelligence — PoultryPro" },
      { property: "og:description", content: "Detect anomalies early, forecast production, losses, feed and profit, and ask questions grounded strictly in your own farm records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequirePermission permission="ai.view" hint="AI Farm Intelligence is not part of your access.">
      <IntelligencePage />
    </RequirePermission>
  ),
});

type Tab = "overview" | "insights" | "forecasts" | "quality" | "assistant";

function IntelligencePage() {
  const { data: farmId } = useFarmId();
  const { data: farm } = useFarm();
  const rooms = useRooms().data ?? [];
  const eggs = useEggs().data ?? [];
  const mortality = useMortality().data ?? [];
  const feed = useFeed().data ?? [];
  const health = useHealth().data ?? [];
  const prices = usePrices().data ?? [];
  const expenses = useExpenses().data ?? [];
  const revenue = useRevenue().data ?? [];
  const layerDaily = useLayerDaily().data ?? [];

  const [tab, setTab] = useState<Tab>("overview");

  const report = useMemo(
    () =>
      runIntelligence({
        eggs, rooms, mortality, feed, health, prices, expenses, revenue,
        layerDaily,
        bagWeightKg: farm?.bag_weight_kg ?? null,
      }),
    [eggs, rooms, mortality, feed, health, prices, expenses, revenue, layerDaily, farm?.bag_weight_kg],
  );

  // Record newly generated insights once per session so feedback can be tracked.
  const sync = useSyncInsights();
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!farmId || syncedRef.current || !report.ready || report.insights.length === 0) return;
    syncedRef.current = true;
    sync.mutate(report.insights);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, report.ready, report.insights.length]);

  const tone = report.health.score >= 85 ? "text-emerald-600" : report.health.score >= 70 ? "text-[color:var(--forest)]" : report.health.score >= 55 ? "text-amber-600" : "text-rose-600";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8 space-y-6">
      <header>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)]">
          <Brain className="h-3.5 w-3.5" /> PoultryPro AI Farm Intelligence
        </div>
        <h1 className="mt-1 font-display text-3xl md:text-4xl font-semibold text-foreground">
          What your records are telling you
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Baselines, anomaly detection and forecasts built only from your own validated farm records.
          Every figure is traceable, and nothing is acted on without your decision.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {([
          ["overview", "Overview", Gauge],
          ["insights", "Insights", Sparkles],
          ["forecasts", "Forecasts", TrendingUp],
          ["quality", "Data quality", Database],
          ["assistant", "AI Assistant", Brain],
        ] as [Tab, string, typeof Gauge][]).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
              tab === key
                ? "border-[color:var(--forest)] bg-[color:var(--forest)] text-white"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </nav>

      {!report.ready && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <AlertTriangle className="h-4 w-4" /> Not enough validated data yet
          </div>
          <p className="mt-1 text-sm text-foreground">{report.message}</p>
        </section>
      )}

      {tab === "overview" && (
        <div className="space-y-5">
          <section className="rounded-3xl border border-[color:var(--gold)]/30 bg-[color:var(--cream,#fdf8ee)]/70 p-5 md:p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--forest)]">Farm health score</div>
                <div className={cn("font-display text-5xl font-semibold", tone)}>{report.health.score}</div>
                <div className="text-sm text-muted-foreground">{report.health.band} — weighted from production, losses, feed stability, profitability and record quality.</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Metric label="Flock size" value={report.baselines.birds ? report.baselines.birds.toLocaleString() : "—"} />
                <Metric label="7-day lay rate" value={report.baselines.layRate7 != null ? `${report.baselines.layRate7}%` : "—"} />
                <Metric label="30-day baseline" value={report.baselines.layRate30 != null ? `${report.baselines.layRate30}%` : "—"} />
                <Metric label="Cost per egg" value={report.baselines.costPerEgg != null ? naira(report.baselines.costPerEgg) : "—"} />
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.health.components.map((c) => (
                <div key={c.key} className="rounded-2xl border border-[color:var(--forest)]/15 bg-white/70 p-4">
                  <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                    <span>{c.label}</span>
                    <span>{c.score}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={cn("h-1.5 rounded-full", c.score >= 70 ? "bg-emerald-500" : c.score >= 50 ? "bg-amber-500" : "bg-rose-500")}
                      style={{ width: `${Math.max(3, Math.min(100, c.score))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{c.note}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Weight {Math.round(c.weight * 100)}%</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric card label="Baseline days" value={`${report.baselines.days}`} hint="Validated production days used" />
            <Metric card label="Feed per bird / day" value={report.baselines.feedKgPerBirdDay30 != null ? `${Math.round(report.baselines.feedKgPerBirdDay30 * 1000)} g` : "—"} hint="30-day baseline" />
            <Metric card label="Losses per 1,000 / day" value={report.baselines.mortalityPctPerDay30 != null ? (report.baselines.mortalityPctPerDay30 * 10).toFixed(2) : "—"} hint="30-day baseline" />
            <Metric card label="Data quality" value={`${report.quality.score}%`} hint={`${report.quality.counts.review} to review, ${report.quality.counts.invalid} invalid`} />
          </section>

          {report.insights.slice(0, 3).map((i) => <InsightCard key={i.key} insight={i} />)}
        </div>
      )}

      {tab === "insights" && (
        <div className="space-y-4">
          {report.insights.length === 0 ? (
            <Empty text="No anomalies detected against your farm's own baselines. Everything recorded is running within your normal range." />
          ) : (
            report.insights.map((i) => <InsightCard key={i.key} insight={i} feedback />)
          )}
        </div>
      )}

      {tab === "forecasts" && (
        <div className="grid gap-4 md:grid-cols-2">
          {report.forecasts.length === 0 ? (
            <Empty text="Forecasts unlock once there are at least five validated days of records in the last two weeks." />
          ) : (
            report.forecasts.map((f) => (
              <article key={f.key} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold text-foreground">{f.label}</h3>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {f.confidence.label} confidence
                  </span>
                </div>
                <div className="mt-3 font-display text-3xl font-semibold text-foreground">
                  {f.unit === "₦" ? naira(f.expected) : `${f.expected.toLocaleString()} ${f.unit}`}
                </div>
                <p className="text-sm text-muted-foreground">
                  Likely range {f.unit === "₦" ? naira(f.low) : f.low.toLocaleString()} – {f.unit === "₦" ? naira(f.high) : f.high.toLocaleString()} over {f.horizon}.
                </p>
                <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2">
                  <span className="font-semibold">AI prediction · </span>{f.basis} Confidence {f.confidence.score}% ({f.confidence.basis}).
                </p>
              </article>
            ))
          )}
        </div>
      )}

      {tab === "quality" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-[color:var(--forest)]" /> Validation of your records
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {report.quality.counts.valid} of {report.quality.counts.total} records passed every rule. Flagged records are excluded from baselines, forecasts and the health score until you correct them.
          </p>
          <div className="mt-4 space-y-2">
            {report.quality.flags.length === 0 ? (
              <Empty text="Every record passed validation. Nothing needs correcting." />
            ) : (
              report.quality.flags.slice(0, 60).map((f, i) => (
                <div key={`${f.sourceId}-${f.rule}-${i}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3 text-sm">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]", QUALITY_TONE[f.status])}>
                    {f.status === "REVIEW_REQUIRED" ? "Review" : f.status}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{f.sourceTable.replace("_", " ")}</span>
                  <span className="text-foreground">{f.detail}</span>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "assistant" && <Assistant snapshot={report.snapshot} farmId={farmId ?? ""} ready={report.ready} />}

      <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
        PoultryPro AI provides operational decision support based only on this farm's records. It does not replace veterinary diagnosis, and it never administers medication, vaccination, feed changes or financial transactions on your behalf.
      </p>
    </div>
  );
}

function Metric({ label, value, hint, card }: { label: string; value: string; hint?: string; card?: boolean }) {
  return (
    <div className={card ? "rounded-2xl border border-border bg-card p-4" : ""}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-semibold text-foreground">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">{text}</div>;
}

function InsightCard({ insight, feedback }: { insight: Insight; feedback?: boolean }) {
  const [open, setOpen] = useState(false);
  const tone = SEVERITY_TONE[insight.severity];
  const stored = useAiRecommendations().data ?? [];
  const record = stored.find((r) => r.insight_key === insight.key);
  const submit = useInsightFeedback();

  return (
    <article className={cn("rounded-2xl border bg-card p-5", tone.ring)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", tone.badge)}>{tone.label}</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {KIND_LABEL[insight.kind]}
        </span>
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{insight.category}</span>
        <span className="ml-auto text-[11px] font-semibold text-muted-foreground">
          {insight.confidence.label} confidence · {insight.confidence.score}%
        </span>
      </div>

      <h3 className="mt-2 font-display text-lg md:text-xl font-semibold text-foreground">{insight.title}</h3>

      <div className="mt-2 space-y-2 text-[14px] leading-relaxed text-foreground">
        <p><span className="font-semibold text-muted-foreground">What we found. </span>{insight.observed}</p>
        <p><span className="font-semibold text-muted-foreground">Why it matters. </span>{insight.whyItMatters}</p>
        {insight.recommendation && (
          <p><span className="font-semibold text-muted-foreground">Recommendation. </span>{insight.recommendation}</p>
        )}
      </div>

      {insight.whatToCheck.length > 0 && (
        <div className="mt-3 rounded-xl border border-[color:var(--forest)]/10 bg-[color:var(--forest)]/5 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--forest)]">What to check</div>
          <ul className="mt-1.5 space-y-1 text-[14px] text-foreground">
            {insight.whatToCheck.map((c, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden>•</span><span>{c}</span></li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--forest)] hover:underline"
          aria-expanded={open}
        >
          Why am I seeing this? {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {feedback && record && (
          <div className="ml-auto flex items-center gap-2">
            {record.feedback ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Feedback saved
              </span>
            ) : (
              <>
                <FeedbackButton icon={ThumbsUp} label="Helpful" onClick={() => submit.mutate({ id: record.id, feedback: "helpful" })} />
                <FeedbackButton icon={ThumbsDown} label="Not useful" onClick={() => submit.mutate({ id: record.id, feedback: "not_helpful" })} />
                <FeedbackButton icon={Activity} label="Acted on it" onClick={() => submit.mutate({ id: record.id, feedback: "acted_on" })} />
              </>
            )}
          </div>
        )}
      </div>

      {open && (
        <ul className="mt-2 space-y-1 rounded-lg bg-muted/40 p-3 text-[13px] text-foreground">
          {insight.evidence.map((e, i) => (
            <li key={i} className="flex gap-2"><span aria-hidden>•</span><span>{e}</span></li>
          ))}
          <li className="flex gap-2"><span aria-hidden>•</span><span>Confidence basis: {insight.confidence.basis}.</span></li>
        </ul>
      )}
    </article>
  );
}

function FeedbackButton({ icon: Icon, label, onClick }: { icon: typeof ThumbsUp; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

const SUGGESTIONS = [
  "Why did my production drop this week?",
  "What is my cost per egg and am I still profitable?",
  "Which room is under-performing and what should I check?",
  "How much feed will I need over the next 7 days?",
];

function Assistant({ snapshot, farmId, ready }: { snapshot: Record<string, unknown>; farmId: string; ready: boolean }) {
  const ask = useServerFn(askFarmAssistant);
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setQuestion("");
    const history = turns.slice(-8);
    setTurns((t) => [...t, { role: "user", content: q }]);
    try {
      const result = await ask({ data: { farmId, question: q, snapshot, history } });
      if (result.ok) setTurns((t) => [...t, { role: "assistant", content: result.answer }]);
      else setError(result.error);
    } catch {
      setError("The AI assistant could not be reached. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Brain className="h-4 w-4 text-[color:var(--forest)]" /> Ask about your farm
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Answers come only from your own validated records. If a figure has not been recorded, the assistant will say so rather than estimate it.
      </p>

      {!ready && (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700">
          The assistant has very little to work with until more daily records are captured.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {turns.map((t, i) => (
          <div
            key={i}
            className={cn(
              "rounded-2xl p-3.5 text-[14px] leading-relaxed whitespace-pre-wrap",
              t.role === "user"
                ? "ml-auto max-w-[85%] bg-[color:var(--forest)] text-white"
                : "mr-auto max-w-[95%] border border-border bg-background text-foreground",
            )}
          >
            {t.content}
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading your farm records…
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-700">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}
      </div>

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(question);
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about production, losses, feed, water or profit…"
          className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-[color:var(--forest)]"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--forest)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Ask
        </button>
      </form>
    </section>
  );
}
