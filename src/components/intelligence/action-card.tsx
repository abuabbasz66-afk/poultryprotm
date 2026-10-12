import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  allowedActions,
  DISMISS_REASONS,
  RULES,
  type ActionItem,
  type ActionPriority,
  type ActionStatus,
  type ActionVerb,
  type EvidenceQuality,
} from "@/lib/intelligence/actions";
import type { AlertEventRow, AlertStateRow } from "@/lib/intelligence/use-farm-intelligence";
import { INTEL_CATEGORY_LABELS } from "@/components/intelligence/intel-alert-card";
import { cn } from "@/lib/utils";

export const PRIORITY_META: Record<ActionPriority, { label: string; cls: string }> = {
  high: { label: "High", cls: "bg-destructive/12 text-destructive border-destructive/30" },
  medium: { label: "Medium", cls: "bg-amber-500/12 text-amber-700 border-amber-500/30" },
  low: { label: "Low", cls: "bg-emerald-500/12 text-emerald-700 border-emerald-500/30" },
};
export const EVIDENCE_META: Record<EvidenceQuality, { label: string; hint: string }> = {
  strong: { label: "Strong evidence", hint: "Enough recent records to compare reliably." },
  limited: { label: "Limited evidence", hint: "Few recent records — treat as an early signal." },
  insufficient: { label: "Not enough data", hint: "Too few records to be confident." },
};
export const STATUS_LABEL: Record<ActionStatus, string> = {
  active: "Open",
  acknowledged: "Acknowledged",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
  dismissed: "Dismissed",
};
const VERB_LABEL: Record<ActionVerb, string> = {
  acknowledge: "Acknowledge",
  assign: "Assign",
  start: "Start",
  resolve: "Resolve",
  dismiss: "Dismiss",
  reopen: "Reopen",
  note: "Add note",
};
const EVENT_LABEL: Record<string, string> = {
  detected: "Detected",
  acknowledge: "Acknowledged",
  assign: "Assigned",
  start: "Started",
  resolve: "Resolved",
  dismiss: "Dismissed",
  reopen: "Reopened",
  note: "Note",
  auto_resolved: "Cleared — no longer seen in records",
  reopened: "Seen again in records",
};

export function PriorityBadge({ priority }: { priority: ActionPriority }) {
  const m = PRIORITY_META[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-px text-[10px] font-semibold uppercase tracking-wider",
        m.cls,
      )}
    >
      {m.label} priority
    </span>
  );
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export type PersonLookup = (id: string | null) => string;

export function ActionCard({
  item,
  row,
  events,
  people,
  personName,
  onAction,
}: {
  item: ActionItem;
  row: AlertStateRow | undefined;
  events: AlertEventRow[];
  people: { id: string; name: string; active: boolean }[];
  personName: PersonLookup;
  onAction: (verb: ActionVerb, opts: { note?: string; assignee?: string }) => Promise<void>;
}) {
  const status: ActionStatus = row?.status ?? "active";
  const [mode, setMode] = useState<ActionVerb | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<string>(DISMISS_REASONS[0]);
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const rule = RULES[item.category];

  const run = async (verb: ActionVerb, opts: { note?: string; assignee?: string } = {}) => {
    setBusy(true);
    try {
      await onAction(verb, opts);
      toast.success(`${VERB_LABEL[verb]} saved`);
      setMode(null);
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!mode) return;
    if (mode === "dismiss") {
      const r =
        reason === "Other" ? note.trim() : `${reason}${note.trim() ? ` — ${note.trim()}` : ""}`;
      if (!r) return toast.error("Please give a reason");
      return run("dismiss", { note: r });
    }
    if (mode === "assign") {
      if (!assignee) return toast.error("Choose who will handle it");
      return run("assign", { assignee, note: note.trim() || undefined });
    }
    if (mode === "note" && !note.trim()) return toast.error("Write a note first");
    return run(mode, { note: note.trim() || undefined });
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={item.priority} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {INTEL_CATEGORY_LABELS[item.category]}
          {item.room ? ` · ${item.room}` : ""}
        </span>
        <span className="ml-auto rounded-full bg-secondary px-2 py-px text-[11px] font-medium">
          {STATUS_LABEL[status]}
        </span>
      </div>
      <h3 className="mt-2 text-[15px] font-semibold text-foreground">{item.title}</h3>

      <dl className="mt-2 space-y-2 text-[13px]">
        <Field label="What we saw">{item.happened}</Field>
        {item.figures.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.figures.map((f) => (
              <span key={f.label} className="rounded-lg bg-secondary/60 px-2 py-0.5 text-[11.5px]">
                <span className="text-muted-foreground">{f.label}: </span>
                <span className="font-semibold tabular-nums">{f.value}</span>
              </span>
            ))}
          </div>
        )}
        <Field label="Compared with" muted>
          {item.comparison}
        </Field>
        <Field label="Why it matters" muted>
          {item.why}
        </Field>
        {item.checks.length > 0 && (
          <Field label="Recommended next step">
            <ul className="list-disc space-y-0.5 pl-5">
              {item.checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Field>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        <span title={EVIDENCE_META[item.evidence].hint}>
          <span
            className={cn(
              "mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle",
              item.evidence === "strong"
                ? "bg-emerald-500"
                : item.evidence === "limited"
                  ? "bg-amber-500"
                  : "bg-border",
            )}
          />
          {EVIDENCE_META[item.evidence].label}
        </span>
        <span>
          Generated {fmt(row?.generated_at ?? row?.first_seen_at ?? new Date().toISOString())}
        </span>
        {row?.assigned_to && isOpenStatus(status) && (
          <span>Assigned to {personName(row.assigned_to)}</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          to={item.action.to}
          search={item.action.search as never}
          hash={item.action.hash as never}
          className="inline-flex items-center gap-1 rounded-full bg-[color:var(--forest)] px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          {item.action.label} <ArrowRight className="h-3 w-3" />
        </Link>
        {allowedActions(status).map((v) =>
          v === "acknowledge" || v === "start" || v === "reopen" ? (
            <button
              key={v}
              disabled={busy}
              onClick={() => void run(v)}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              {VERB_LABEL[v]}
            </button>
          ) : (
            <button
              key={v}
              disabled={busy}
              onClick={() => setMode(mode === v ? null : v)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50",
                mode === v ? "border-[color:var(--forest)]" : "border-border",
              )}
            >
              {VERB_LABEL[v]}
            </button>
          ),
        )}
      </div>

      {mode && (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
          {mode === "assign" && (
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
            >
              <option value="">Choose a team member…</option>
              {people
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          )}
          {mode === "dismiss" && (
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
            >
              {[...DISMISS_REASONS, "Other"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder={
              mode === "resolve"
                ? "What was done? (optional)"
                : mode === "dismiss"
                  ? reason === "Other"
                    ? "Reason (required)"
                    : "Extra detail (optional)"
                  : "Note (optional)"
            }
            className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
          />
          {mode === "dismiss" && (
            <p className="text-[11.5px] text-muted-foreground">
              It stays quiet for 3 days unless it becomes critical.
            </p>
          )}
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={submit}
              className="inline-flex items-center gap-1 rounded-full bg-[color:var(--forest)] px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" />} Save
            </button>
            <button onClick={() => setMode(null)} className="text-xs text-muted-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-4 text-[11.5px]">
        <button
          onClick={() => setShowHow((v) => !v)}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn("h-3 w-3 transition", showHow && "rotate-180")} /> How this was
          worked out
        </button>
        {events.length > 0 && (
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <History className="h-3 w-3" /> History ({events.length})
          </button>
        )}
      </div>
      {showHow && (
        <dl className="mt-2 space-y-1 rounded-xl bg-secondary/40 p-3 text-[12px] text-muted-foreground">
          <p>
            <b>Needs:</b> {rule.requires}
          </p>
          <p>
            <b>Raised when:</b> {rule.condition}
          </p>
          <p>
            <b>Baseline:</b> {rule.baseline}
          </p>
          <p>
            <b>Stays quiet when:</b> {rule.silentWhen}
          </p>
          <p>
            <b>With little data:</b> {rule.lowData}
          </p>
        </dl>
      )}
      {showHistory && <EventList events={events} personName={personName} />}
    </article>
  );
}

const isOpenStatus = (s: ActionStatus) => s !== "resolved" && s !== "dismissed";

export function EventList({
  events,
  personName,
}: {
  events: AlertEventRow[];
  personName: PersonLookup;
}) {
  return (
    <ol className="mt-2 space-y-1.5 border-l border-border pl-3 text-[12px]">
      {events.map((e) => (
        <li key={e.id}>
          <span className="font-medium">{EVENT_LABEL[e.action] ?? e.action}</span>
          {e.assigned_to ? ` → ${personName(e.assigned_to)}` : ""}
          <span className="text-muted-foreground">
            {" · "}
            {e.actor ? personName(e.actor) : "PoultryPro"} · {fmt(e.created_at)}
          </span>
          {e.note && <p className="text-muted-foreground">“{e.note}”</p>}
        </li>
      ))}
    </ol>
  );
}

function Field({
  label,
  children,
  muted,
}: {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={muted ? "text-muted-foreground" : "text-foreground"}>{children}</dd>
    </div>
  );
}
