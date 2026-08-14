// Recommendation approval + feedback + learning loop UI.
//
// The farmer is always the decision maker: PoultryPro AI recommends, the farmer
// approves, rejects or dismisses, and later records what actually happened.
// Nothing here executes a farm action.
import { useMemo, useState } from "react";
import {
  CheckCircle2, XCircle, MinusCircle, Sparkles, BarChart3, Users, TrendingUp,
  Loader2, ClipboardCheck,
} from "lucide-react";
import {
  useAiRecommendations, useDecideRecommendation, useFarmBenchmarks,
  useRecommendationPerformance, useRecordOutcome, type StoredRecommendation,
} from "@/lib/ai/store";
import {
  OPEN_STATUSES, OUTCOME_OPTIONS, OUTCOME_LABEL, REJECT_REASONS, STATUS_LABEL, STATUS_TONE,
  acceptanceRate, successRate, type Decision, type Outcome,
} from "@/lib/ai/learning";
import { cn } from "@/lib/utils";

const reasonLabel = (key: string | null) =>
  REJECT_REASONS.find((r) => r.key === key)?.label ?? key ?? "";

/** Inline decision controls shown on an insight card. */
export function RecommendationActions({ insightKey }: { insightKey: string }) {
  const stored = useAiRecommendations().data ?? [];
  const rec = stored.find((r) => r.insight_key === insightKey);
  if (!rec) return null;
  return <DecisionControls rec={rec} compact />;
}

function DecisionControls({ rec, compact }: { rec: StoredRecommendation; compact?: boolean }) {
  const decide = useDecideRecommendation();
  const record = useRecordOutcome();
  const [mode, setMode] = useState<"idle" | "reject" | "outcome">("idle");
  const [reason, setReason] = useState(REJECT_REASONS[0]!.key);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("improved");

  const open = OPEN_STATUSES.has(rec.status);
  const busy = decide.isPending || record.isPending;

  const act = (decision: Decision) => {
    if (decision === "rejected") {
      setMode("reject");
      return;
    }
    decide.mutate({ rec, decision });
  };

  return (
    <div className={cn("w-full", compact ? "mt-1" : "")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]", STATUS_TONE[rec.status] ?? STATUS_TONE["viewed"])}>
          {STATUS_LABEL[rec.status] ?? rec.status}
        </span>

        {open && mode === "idle" && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ActionButton icon={CheckCircle2} label="Approve" tone="emerald" disabled={busy} onClick={() => act("approved")} />
            <ActionButton icon={XCircle} label="Reject" tone="rose" disabled={busy} onClick={() => act("rejected")} />
            <ActionButton icon={MinusCircle} label="Dismiss" tone="muted" disabled={busy} onClick={() => act("dismissed")} />
          </div>
        )}

        {rec.status === "approved" && mode === "idle" && (
          <div className="ml-auto flex items-center gap-2">
            <ActionButton icon={ClipboardCheck} label="Record what happened" tone="forest" disabled={busy} onClick={() => setMode("outcome")} />
          </div>
        )}

        {rec.status === "completed" && rec.outcome && (
          <span className="ml-auto text-[11px] font-semibold text-muted-foreground">
            Outcome: {OUTCOME_LABEL[rec.outcome] ?? rec.outcome}
          </span>
        )}

        {rec.status === "rejected" && rec.decision_reason && (
          <span className="ml-auto text-[11px] text-muted-foreground">Reason: {reasonLabel(rec.decision_reason)}</span>
        )}
      </div>

      {mode === "reject" && (
        <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">Why is this not right?</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Your reason is the strongest learning signal we have. It stays on your farm and is never shared.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {REJECT_REASONS.map((r) => (
              <label key={r.key} className="flex items-center gap-2 text-[13px] text-foreground">
                <input type="radio" name={`reason-${rec.id}`} value={r.key} checked={reason === r.key} onChange={() => setReason(r.key)} />
                {r.label}
              </label>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything else we should know (optional)"
            className="mt-2 w-full rounded-lg border border-border bg-background p-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <ActionButton
              icon={XCircle}
              label={busy ? "Saving…" : "Submit rejection"}
              tone="rose"
              disabled={busy}
              onClick={() =>
                decide.mutate(
                  { rec, decision: "rejected", reason, note: note.trim() || null },
                  { onSuccess: () => { setMode("idle"); setNote(""); } },
                )
              }
            />
            <ActionButton icon={MinusCircle} label="Cancel" tone="muted" onClick={() => setMode("idle")} />
          </div>
        </div>
      )}

      {mode === "outcome" && (
        <div className="mt-3 rounded-xl border border-[color:var(--forest)]/20 bg-[color:var(--forest)]/5 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--forest)]">What happened after you acted?</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {OUTCOME_OPTIONS.map((o) => (
              <label key={o.key} className="flex items-center gap-2 text-[13px] text-foreground">
                <input type="radio" name={`outcome-${rec.id}`} checked={outcome === o.key} onChange={() => setOutcome(o.key)} />
                <span className={o.tone}>{o.label}</span>
              </label>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="What did you do, and what did you observe? (optional)"
            className="mt-2 w-full rounded-lg border border-border bg-background p-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <ActionButton
              icon={CheckCircle2}
              label={busy ? "Saving…" : "Save outcome"}
              tone="forest"
              disabled={busy}
              onClick={() =>
                record.mutate(
                  { rec, outcome, note: note.trim() || null },
                  { onSuccess: () => { setMode("idle"); setNote(""); } },
                )
              }
            />
            <ActionButton icon={MinusCircle} label="Cancel" tone="muted" onClick={() => setMode("idle")} />
          </div>
        </div>
      )}
    </div>
  );
}

const TONES: Record<string, string> = {
  emerald: "border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10",
  rose: "border-rose-500/30 text-rose-700 hover:bg-rose-500/10",
  forest: "border-[color:var(--forest)]/30 text-[color:var(--forest)] hover:bg-[color:var(--forest)]/10",
  muted: "border-border text-muted-foreground hover:text-foreground",
};

function ActionButton({
  icon: Icon, label, tone = "muted", onClick, disabled,
}: { icon: typeof CheckCircle2; label: string; tone?: keyof typeof TONES | string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition disabled:opacity-50",
        TONES[tone] ?? TONES["muted"],
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

/** Full recommendation queue: pending decisions, approved work in progress and history. */
export function RecommendationQueue() {
  const { data: recs, isPending } = useAiRecommendations();
  const [view, setView] = useState<"pending" | "approved" | "history">("pending");

  const groups = useMemo(() => {
    const all = recs ?? [];
    return {
      pending: all.filter((r) => OPEN_STATUSES.has(r.status)),
      approved: all.filter((r) => r.status === "approved"),
      history: all.filter((r) => ["completed", "rejected", "dismissed", "expired", "reviewed", "acted_on"].includes(r.status)),
    };
  }, [recs]);

  const list = groups[view];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([
          ["pending", `Awaiting your decision (${groups.pending.length})`],
          ["approved", `Approved — in progress (${groups.approved.length})`],
          ["history", `History (${groups.history.length})`],
        ] as [typeof view, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              view === key ? "border-[color:var(--forest)] bg-[color:var(--forest)] text-white" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading recommendations…</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          {view === "pending"
            ? "No recommendations are waiting on you. New ones appear here as soon as your records show something worth acting on."
            : view === "approved"
              ? "Nothing approved and in progress. Approve a recommendation to track what happens next."
              : "No decisions recorded yet."}
        </div>
      ) : (
        list.map((rec) => (
          <article key={rec.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>{rec.category}</span>
              <span>·</span>
              <span>{rec.severity}</span>
              <span>·</span>
              <span>{rec.confidence}% confidence</span>
              <span className="ml-auto normal-case tracking-normal">{new Date(rec.created_at).toLocaleDateString()}</span>
            </div>
            <h3 className="mt-1 font-display text-base md:text-lg font-semibold text-foreground">{rec.title}</h3>
            <p className="mt-1 text-sm text-foreground">{rec.summary}</p>
            {rec.outcome_note && <p className="mt-1 text-xs text-muted-foreground">Your note: {rec.outcome_note}</p>}
            {rec.feedback_note && !rec.outcome_note && <p className="mt-1 text-xs text-muted-foreground">Your note: {rec.feedback_note}</p>}
            <div className="mt-3 border-t border-border pt-3">
              <DecisionControls rec={rec} />
            </div>
          </article>
        ))
      )}
    </section>
  );
}

/** How well the engine is serving this farm, plus the learning ledger size. */
export function PerformancePanel() {
  const { data } = useRecommendationPerformance();
  if (!data) return null;
  const accept = acceptanceRate(data);
  const success = successRate(data);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <BarChart3 className="h-4 w-4 text-[color:var(--forest)]" /> How PoultryPro AI is performing on your farm
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Measured only from your own decisions and recorded outcomes. Rejections count as much as approvals — they tell the engine what is not useful here.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Recommendations made" value={String(data.total)} />
        <Stat label="Approved" value={String(data.approved + data.completed)} />
        <Stat label="Rejected / dismissed" value={String(data.rejected + data.dismissed)} />
        <Stat label="Awaiting decision" value={String(data.open)} />
        <Stat label="Acceptance rate" value={accept == null ? "—" : `${accept}%`} hint="Approved out of everything decided" />
        <Stat label="Improved after acting" value={success == null ? "—" : `${success}%`} hint="Of outcomes you recorded" />
        <Stat label="Average confidence" value={`${data.avg_confidence}%`} />
        <Stat label="Learning signals" value={String(data.signals)} hint="Traceable decisions on record" />
      </div>
      {data.outcome_worse > 0 && (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800">
          {data.outcome_worse} recommendation{data.outcome_worse === 1 ? "" : "s"} were followed by a worse result. Those cases are kept and weighted so similar advice is raised more cautiously.
        </p>
      )}
    </section>
  );
}

/** Anonymous peer comparison — no other farm is ever named or identifiable. */
export function BenchmarksPanel() {
  const { data, isPending } = useFarmBenchmarks();

  if (isPending) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Comparing with similar farms…</div>;
  }
  if (!data?.available) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-semibold text-foreground"><Users className="h-4 w-4" /> Peer comparison not available yet</div>
        <p className="mt-1">
          {data?.reason === "no_flock"
            ? "Record your rooms and bird numbers to unlock peer comparison."
            : `Comparison only appears once at least ${data?.min_sample ?? 5} farms of a similar size are recording. Currently ${data?.peer_count ?? 0}.`}
        </p>
      </section>
    );
  }

  const mine = data.mine ?? null;
  const peer = data.peer_avg ?? null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4 text-[color:var(--forest)]" /> How you compare with similar farms
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Anonymous averages from {data.peer_count} farms with roughly {Math.round(Number(data.band?.low ?? 0)).toLocaleString()}–{Math.round(Number(data.band?.high ?? 0)).toLocaleString()} birds.
        No farm name, location or individual record is shown, and your own data is never shown to anyone else.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Compare label="Lay rate (30 days)" mine={mine?.lay_pct30} peer={peer?.lay_pct30} unit="%" higherIsBetter />
        <Compare label="Losses (30 days)" mine={mine?.mortality_pct30} peer={peer?.mortality_pct30} unit="%" />
        <Compare label="Feed per bird / day" mine={mine?.feed_kg_bird_day} peer={peer?.feed_kg_bird_day} unit=" kg" />
      </div>
      {data.percentile_lay != null && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" /> Your lay rate sits in the {data.percentile_lay}th percentile of comparable farms — AI analysis, medium confidence.
        </p>
      )}
    </section>
  );
}

function Compare({
  label, mine, peer, unit, higherIsBetter,
}: { label: string; mine: number | null | undefined; peer: number | null | undefined; unit: string; higherIsBetter?: boolean }) {
  const has = mine != null && peer != null;
  const diff = has ? Number(mine) - Number(peer) : null;
  const good = diff == null ? null : higherIsBetter ? diff >= 0 : diff <= 0;
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-semibold text-foreground">{mine == null ? "—" : `${mine}${unit}`}</div>
      <div className="text-[11px] text-muted-foreground">Similar farms: {peer == null ? "—" : `${peer}${unit}`}</div>
      {diff != null && (
        <div className={cn("mt-1 text-[11px] font-semibold", good ? "text-emerald-700" : "text-amber-700")}>
          {diff >= 0 ? "+" : ""}{Math.round(diff * 1000) / 1000}{unit} vs peers
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-semibold text-foreground">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function LearningTab() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[color:var(--gold)]/30 bg-[color:var(--cream,#fdf8ee)]/70 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-[color:var(--forest)]" /> You decide, the engine learns
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          PoultryPro AI never acts on your farm. It proposes, you approve, reject or dismiss, and afterwards you record what actually happened.
          Every decision is stored against your farm only and is used to raise or lower how strongly similar advice is offered to you in future.
        </p>
      </section>
      <RecommendationQueue />
      <PerformancePanel />
      <BenchmarksPanel />
    </div>
  );
}
