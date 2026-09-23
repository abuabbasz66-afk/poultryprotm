import { useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, X, ListChecks, PartyPopper } from "lucide-react";
import { useFarm, useRooms, useEggs, useFeed } from "@/lib/farm-data";
import { useActivation, useOnboarding, useSaveOnboarding, trackEvent } from "@/lib/growth";
import { cn } from "@/lib/utils";

type Step = {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  to: string;
  search?: Record<string, string | undefined>;
  hash?: string;
  goals?: string[];
};

/**
 * Setup checklist driven entirely by real farm state — no stored flags, so a
 * step un-ticks itself if the underlying data is removed. Dismissal and
 * completion live in `user_onboarding` so they follow the farmer across
 * devices, and the checklist can always be reopened from Help or Settings.
 */
export function FarmSetupChecklist({ forceOpen = false }: { forceOpen?: boolean }) {
  const { data: farm } = useFarm();
  const { data: rooms = [] } = useRooms();
  const { data: eggs = [] } = useEggs();
  const { data: feed = [] } = useFeed();
  const { data: activation } = useActivation();
  const { data: onboarding } = useOnboarding();
  const save = useSaveOnboarding();

  const farmId = farm?.id ?? null;
  const goal = onboarding?.primaryGoal ?? null;

  const steps: Step[] = useMemo(
    () => [
      {
        key: "farm",
        label: "Create your farm",
        hint: "Farm name, location and bird type",
        done: !!farm?.name,
        to: "/settings",
        hash: "profile",
      },
      {
        key: "flock",
        label: "Add your flock",
        hint: "A layer or broiler batch to record against",
        done: Boolean(activation?.hasFlock),
        to: "/rearing",
      },
      {
        key: "rooms",
        label: "Add your rooms",
        hint: "Each room holds its own birds and records",
        done: rooms.length > 0,
        to: "/dashboard",
        search: { area: "records" },
        hash: "rooms",
      },
      {
        key: "production",
        label: "Record your first production",
        hint: "Daily eggs per room",
        done: eggs.length > 0,
        to: "/dashboard",
        search: { area: "records" },
        hash: "production",
        goals: ["production", "profit"],
      },
      {
        key: "feed",
        label: "Record today's farm activity",
        hint: "Feed given per room, in kilograms",
        done: feed.length > 0,
        to: "/feed",
        search: { tab: "overview" },
        goals: ["feed"],
      },
      {
        key: "insight",
        label: "View your first farm insight",
        hint: "See what your records already tell you",
        done: Boolean(onboarding?.firstInsightSeenAt),
        to: "/dashboard",
        search: { area: "overview" },
      },
    ],
    [farm, rooms, eggs, feed, activation, onboarding],
  );

  // Personalised order: the step matching the farmer's stated goal comes first
  // among the outstanding steps. Nothing is hidden or skipped.
  const ordered = useMemo(() => {
    if (!goal) return steps;
    return [...steps].sort((a, b) => {
      const ag = a.goals?.includes(goal) && !a.done ? 0 : 1;
      const bg = b.goals?.includes(goal) && !b.done ? 0 : 1;
      return ag - bg;
    });
  }, [steps, goal]);

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const next = ordered.find((s) => !s.done);
  const complete = doneCount === steps.length;

  const justCompleted = complete && !!farmId && !onboarding?.completedAt;

  // Record completion once. Never during render.
  useEffect(() => {
    if (!justCompleted || !farmId) return;
    save.mutate({ completed_at: new Date().toISOString() });
    trackEvent("ONBOARDING_COMPLETED", { farmId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCompleted, farmId]);

  if (!farmId) return null;

  if (complete && !forceOpen) {
    if (!justCompleted) return null;
    return (
      <section className="rounded-3xl border border-[color:var(--gold)]/50 bg-card p-5 shadow-[var(--shadow-soft)]">
        <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold">
          <PartyPopper className="h-5 w-5 text-[color:var(--gold)]" /> Your farm is ready
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You're now ready to get the most out of PoultryPro.
        </p>
      </section>
    );
  }
  if (!forceOpen && onboarding?.checklistDismissedAt) return null;

  const dismiss = () => save.mutate({ checklist_dismissed_at: new Date().toISOString() });

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold">
            <ListChecks className="h-5 w-5 text-[color:var(--forest)]" /> Getting started
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {doneCount} of {steps.length} steps complete
            {next ? ` — next: ${next.label.toLowerCase()}` : ""}.
          </p>
        </div>
        {!forceOpen && (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss setup checklist"
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs font-medium text-muted-foreground">{pct}% complete</p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {ordered.map((s) => (
          <li key={s.key}>
            <Link
              to={s.to}
              search={s.search as never}
              hash={s.hash as never}
              className={cn(
                "flex min-h-[56px] items-center gap-3 rounded-2xl border p-3 transition",
                s.done
                  ? "border-border bg-secondary/40"
                  : "border-border bg-card hover:border-[color:var(--gold)]",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  s.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {s.done ? <Check className="h-3.5 w-3.5" /> : ""}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm font-medium",
                    s.done && "text-muted-foreground line-through",
                  )}
                >
                  {s.label}
                </span>
                {!s.done && (
                  <span className="block truncate text-xs text-muted-foreground">{s.hint}</span>
                )}
              </span>
              {!s.done && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        Complete your setup to unlock the full value of PoultryPro.
      </p>
    </section>
  );
}
