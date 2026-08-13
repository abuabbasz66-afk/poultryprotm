import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, Egg, Wheat, Skull, Stethoscope, DollarSign } from "lucide-react";
import type { EggRow, Feed, Health, Mortality, Price } from "@/lib/farm-data";
import { buildFarmActivities, type ActivityKind } from "@/lib/farm-activity";

const STYLE: Record<ActivityKind, { icon: typeof Egg; wrap: string }> = {
  production: { icon: Egg, wrap: "bg-[color:var(--forest)]/10 text-[color:var(--forest)]" },
  feed: { icon: Wheat, wrap: "bg-amber-500/10 text-amber-600" },
  mortality: { icon: Skull, wrap: "bg-destructive/10 text-destructive" },
  health: { icon: Stethoscope, wrap: "bg-blue-500/10 text-blue-600" },
  price: { icon: DollarSign, wrap: "bg-purple-500/10 text-purple-600" },
};

/** Section 1 — unified feed of the farm's most recent recorded activities. */
export function RecentActivitiesCard(props: {
  eggs: EggRow[];
  feed: Feed[];
  mortality: Mortality[];
  health: Health[];
  prices: Price[];
  bagWeightKg: number;
  canViewAll?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const activities = useMemo(
    () => buildFarmActivities({
      eggs: props.eggs, feed: props.feed, mortality: props.mortality,
      health: props.health, prices: props.prices, bagWeightKg: props.bagWeightKg,
    }),
    [props.eggs, props.feed, props.mortality, props.health, props.prices, props.bagWeightKg],
  );
  const shown = showAll ? activities.slice(0, 40) : activities.slice(0, 7);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 shadow-[var(--shadow-soft)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h3 className="inline-flex items-center gap-2 font-display text-base font-semibold">
            <Activity className="h-4 w-4 shrink-0 text-[color:var(--forest)]" /> Recent Activities
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Latest recorded farm activity across every module</p>
        </div>
        {props.canViewAll && (
          <Link to="/activity" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary">
            View all activities <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {shown.map((a) => {
          const s = STYLE[a.kind];
          const Icon = s.icon;
          return (
            <div key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-secondary/40 px-3 py-2.5">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${s.wrap}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{a.title}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {[a.room, a.detail].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div className="shrink-0 text-right text-[11px] text-muted-foreground">{a.dateLabel}</div>
            </div>
          );
        })}
        {activities.length === 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground">No farm activity recorded yet.</div>
        )}
      </div>

      {activities.length > 7 && (
        <div className="mt-3 text-center">
          <button onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-[color:var(--forest)] hover:underline">
            {showAll ? "Show latest 7 only" : "View all activities"}
          </button>
        </div>
      )}
    </section>
  );
}
