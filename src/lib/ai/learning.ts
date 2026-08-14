// ---------------------------------------------------------------------------
// PoultryPro AI — Recommendation lifecycle + learning loop vocabulary.
//
// The learning loop is deliberately explicit and traceable:
//   generated → viewed → approved / rejected / dismissed → completed (outcome)
//
// Every farmer decision becomes a *learning signal* with a weight. Signals are
// farm-scoped, never mixed between farms, and only trusted signals (a decision
// made against validated records) are counted towards learning.
// ---------------------------------------------------------------------------

export type RecommendationStatus =
  | "open"
  | "new"
  | "viewed"
  | "approved"
  | "rejected"
  | "dismissed"
  | "completed"
  | "expired"
  // legacy values written before the approval loop existed
  | "reviewed"
  | "acted_on";

export type Decision = "approved" | "rejected" | "dismissed";

export type Outcome = "improved" | "no_change" | "worse" | "too_early";

export const STATUS_LABEL: Record<string, string> = {
  open: "New",
  new: "New",
  viewed: "Seen",
  approved: "Approved",
  rejected: "Rejected",
  dismissed: "Dismissed",
  completed: "Completed",
  expired: "Expired",
  reviewed: "Reviewed",
  acted_on: "Acted on",
};

export const STATUS_TONE: Record<string, string> = {
  open: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  new: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  viewed: "border-border bg-muted text-muted-foreground",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  rejected: "border-rose-500/30 bg-rose-500/10 text-rose-700",
  dismissed: "border-border bg-muted text-muted-foreground",
  completed: "border-[color:var(--forest)]/30 bg-[color:var(--forest)]/10 text-[color:var(--forest)]",
  expired: "border-border bg-muted text-muted-foreground",
  reviewed: "border-border bg-muted text-muted-foreground",
  acted_on: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
};

/** A rejection is the most valuable signal — we always ask why. */
export const REJECT_REASONS: { key: string; label: string }[] = [
  { key: "already_handled", label: "I already handled this" },
  { key: "not_accurate", label: "The reading is not accurate" },
  { key: "not_practical", label: "Not practical on my farm" },
  { key: "wrong_room", label: "Wrong room or batch" },
  { key: "cost", label: "Too costly right now" },
  { key: "vet_advice", label: "My vet advised otherwise" },
  { key: "other", label: "Other reason" },
];

export const OUTCOME_OPTIONS: { key: Outcome; label: string; tone: string }[] = [
  { key: "improved", label: "It improved", tone: "text-emerald-700" },
  { key: "no_change", label: "No change", tone: "text-muted-foreground" },
  { key: "worse", label: "It got worse", tone: "text-rose-700" },
  { key: "too_early", label: "Too early to tell", tone: "text-amber-700" },
];

export const OUTCOME_LABEL: Record<string, string> =
  Object.fromEntries(OUTCOME_OPTIONS.map((o) => [o.key, o.label]));

/** Weight a decision contributes to the learning signal ledger. */
export function signalWeight(type: string, outcome?: string | null): number {
  if (type === "outcome") {
    if (outcome === "improved") return 3;
    if (outcome === "worse") return 2;
    if (outcome === "no_change") return 1.5;
    return 0.5;
  }
  if (type === "rejected") return 2;
  if (type === "approved") return 1.5;
  if (type === "dismissed") return 0.5;
  return 1;
}

export const OPEN_STATUSES = new Set(["open", "new", "viewed"]);
export const CLOSED_STATUSES = new Set(["rejected", "dismissed", "completed", "expired"]);

export type Performance = {
  total: number;
  approved: number;
  rejected: number;
  completed: number;
  dismissed: number;
  open: number;
  outcome_improved: number;
  outcome_no_change: number;
  outcome_worse: number;
  outcome_too_early: number;
  avg_confidence: number;
  signals: number;
};

export const EMPTY_PERFORMANCE: Performance = {
  total: 0, approved: 0, rejected: 0, completed: 0, dismissed: 0, open: 0,
  outcome_improved: 0, outcome_no_change: 0, outcome_worse: 0, outcome_too_early: 0,
  avg_confidence: 0, signals: 0,
};

export type Benchmarks = {
  available: boolean;
  reason?: string;
  peer_count?: number;
  min_sample?: number;
  band?: { low: number; high: number };
  mine?: { lay_pct30: number | null; mortality_pct30: number | null; feed_kg_bird_day: number | null } | null;
  peer_avg?: { lay_pct30: number | null; mortality_pct30: number | null; feed_kg_bird_day: number | null } | null;
  percentile_lay?: number | null;
};

/** Share of acted-on recommendations that improved things — the headline learning metric. */
export function successRate(p: Performance): number | null {
  const measured = p.outcome_improved + p.outcome_no_change + p.outcome_worse;
  if (measured === 0) return null;
  return Math.round((p.outcome_improved / measured) * 100);
}

/** Acceptance rate tells us how relevant the engine's output is to this farm. */
export function acceptanceRate(p: Performance): number | null {
  const decided = p.approved + p.rejected + p.dismissed + p.completed;
  if (decided === 0) return null;
  return Math.round(((p.approved + p.completed) / decided) * 100);
}
