import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Egg, Wheat, HeartPulse, Coins, Sparkles, ArrowRight } from "lucide-react";
import { useRooms, useEggs, useFeed, useMortality } from "@/lib/farm-data";
import { useActivation, useOnboarding, useSaveOnboarding, trackEvent } from "@/lib/growth";

const ACTIONS = [
  {
    key: "production",
    icon: Egg,
    title: "Record Production",
    why: "Daily eggs build your production rate and trends.",
    to: "/dashboard",
    search: { area: "records" } as Record<string, string>,
    hash: "production",
  },
  {
    key: "feed",
    icon: Wheat,
    title: "Record Feed",
    why: "Feed is your biggest cost — tracking it shows cost per bird.",
    to: "/feed",
    search: { tab: "overview" } as Record<string, string>,
  },
  {
    key: "mortality",
    icon: HeartPulse,
    title: "Record Mortality",
    why: "Early loss patterns warn you before a problem spreads.",
    to: "/dashboard",
    search: { area: "records" } as Record<string, string>,
    hash: "mortality",
  },
  {
    key: "finance",
    icon: Coins,
    title: "Add Income or Expense",
    why: "Money in and out turns your records into profit figures.",
    to: "/finance",
    search: undefined,
  },
];

/**
 * Shown to farms with no operational records yet: a purposeful first-run
 * screen instead of a dashboard of empty cards. Once the farm has real
 * records it becomes the farmer's first insight — built only from their
 * own saved data.
 */
export function FirstRunPanel() {
  const { data: activation } = useActivation();
  const { data: onboarding } = useOnboarding();
  const save = useSaveOnboarding();
  const { data: rooms = [] } = useRooms();
  const { data: eggs = [] } = useEggs();
  const { data: feed = [] } = useFeed();
  const { data: mortality = [] } = useMortality();

  const birds = useMemo(
    () => rooms.reduce((sum, r) => sum + (r.current ?? 0), 0),
    [rooms],
  );

  const hasAnyRecord = eggs.length > 0 || feed.length > 0 || mortality.length > 0;

  if (!activation?.hasFarm) return null;

  // ---------- Empty farm: guide the first action ----------
  if (!hasAnyRecord) {
    return (
      <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
        <h2 className="font-display text-lg font-semibold">Your farm is ready</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start by recording your first farm activity. Each record makes your dashboard,
          charts and profit figures more useful.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.key}
                to={a.to}
                search={a.search as never}
                hash={a.hash as never}
                className="flex min-h-[64px] items-start gap-3 rounded-2xl border border-border bg-background p-4 transition hover:border-[color:var(--gold)]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-[color:var(--forest)]">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{a.title}</span>
                  <span className="block text-xs text-muted-foreground">{a.why}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

  // ---------- First insight, from real records only ----------
  if (onboarding?.firstInsightSeenAt) return null;

  const lines: string[] = [];
  if (birds > 0) lines.push(`Your farm has ${birds.toLocaleString()} birds across ${rooms.length} room${rooms.length === 1 ? "" : "s"}.`);
  if (eggs.length > 0) lines.push(`You have recorded ${eggs.length.toLocaleString()} production ${eggs.length === 1 ? "entry" : "entries"}.`);
  if (feed.length > 0) lines.push(`You have recorded ${feed.length.toLocaleString()} feed ${feed.length === 1 ? "entry" : "entries"}.`);
  if (mortality.length > 0) lines.push(`You have recorded ${mortality.length.toLocaleString()} mortality ${mortality.length === 1 ? "entry" : "entries"}.`);
  if (lines.length === 0) return null;

  const acknowledge = () => {
    trackEvent("FIRST_INSIGHT_VIEWED", { farmId: activation.farmId });
    save.mutate({ first_insight_seen_at: new Date().toISOString() });
  };

  return (
    <section className="rounded-3xl border border-[color:var(--gold)]/50 bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
      <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold">
        <Sparkles className="h-5 w-5 text-[color:var(--gold)]" /> Your first PoultryPro insight
      </h2>
      <ul className="mt-3 space-y-1.5 text-sm text-foreground">
        {lines.map((l) => (
          <li key={l} className="flex gap-2">
            <span className="text-[color:var(--gold)]">•</span>
            <span>{l}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Keep recording daily activity — PoultryPro becomes more useful as your farm history grows.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={acknowledge}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Got it <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
