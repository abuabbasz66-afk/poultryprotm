import { useMemo, useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, X, ListChecks } from "lucide-react";
import { useFarm, useRooms, useEggs, useFeed, usePrices } from "@/lib/farm-data";
import { useRevenue } from "@/lib/finance-data";
import { cn } from "@/lib/utils";

type Step = {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  to: string;
  search?: Record<string, string>;
  hash?: string;
};

const DISMISS_KEY = (farmId: string) => `pp.setup.dismissed.${farmId}`;

/**
 * Setup checklist driven entirely by real farm state — no stored flags, so a
 * step un-ticks itself if the underlying data is removed.
 */
export function FarmSetupChecklist() {
  const { data: farm } = useFarm();
  const { data: rooms = [] } = useRooms();
  const { data: eggs = [] } = useEggs();
  const { data: feed = [] } = useFeed();
  const { data: prices = [] } = usePrices();
  const { data: revenue = [] } = useRevenue();
  const [dismissed, setDismissed] = useState(true);

  const farmId = farm?.id ?? null;

  useEffect(() => {
    if (!farmId) return;
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY(farmId)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [farmId]);

  const steps: Step[] = useMemo(
    () => [
      {
        key: "farm",
        label: "Create your farm profile",
        hint: "Farm name, location and bird type",
        done: !!farm?.name,
        to: "/settings",
        hash: "profile",
      },
      {
        key: "rooms",
        label: "Add your rooms or pens",
        hint: "Each room holds its own birds and records",
        done: rooms.length > 0,
        to: "/dashboard",
        search: { area: "records" },
        hash: "rooms",
      },
      {
        key: "birds",
        label: "Enter your bird population",
        hint: "Current birds per room",
        done: rooms.some((r) => (r.current ?? 0) > 0),
        to: "/dashboard",
        search: { area: "records" },
        hash: "rooms",
      },
      {
        key: "production",
        label: "Record your first production entry",
        hint: "Daily eggs per room",
        done: eggs.length > 0,
        to: "/dashboard",
        search: { area: "records" },
        hash: "production",
      },
      {
        key: "feed",
        label: "Record your first feed usage",
        hint: "Feed given per room, in kilograms",
        done: feed.length > 0,
        to: "/feed",
        search: { tab: "overview" },
      },
      {
        key: "prices",
        label: "Set your selling prices",
        hint: "Crate and bird prices power profit figures",
        done: prices.length > 0,
        to: "/prices",
      },
      {
        key: "revenue",
        label: "Record your first sale",
        hint: "Sales feed revenue and profit reporting",
        done: revenue.length > 0,
        to: "/sales",
      },
    ],
    [farm, rooms, eggs, feed, prices, revenue],
  );

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const next = steps.find((s) => !s.done);

  if (dismissed || !farmId || doneCount === steps.length) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY(farmId), "1");
    } catch {
      /* storage unavailable — hide for this session only */
    }
    setDismissed(true);
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold">
            <ListChecks className="h-5 w-5 text-[color:var(--forest)]" /> Finish setting up your farm
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {doneCount} of {steps.length} steps complete
            {next ? ` — next: ${next.label.toLowerCase()}` : ""}.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss setup checklist"
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs font-medium text-muted-foreground">{pct}% complete</p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              to={s.to}
              search={s.search as never}
              hash={s.hash as never}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3 transition",
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
    </section>
  );
}
