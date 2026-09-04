// Feed cost & efficiency — every figure comes from this farm's own records.
// Where data is missing we say so rather than showing a zero.
import { useFeedCostAnalytics } from "@/lib/feed-purchases-data";
import { useFarm } from "@/lib/farm-data";

const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const kg = (n: number) => `${Math.round(n * 10) / 10} kg`;

export function CostEfficiencyPanel() {
  const a = useFeedCostAnalytics(30);
  const farm = useFarm();
  const bagKg = farm.data?.bag_weight_kg ?? 25;

  const cards: { label: string; value: string; sub: string }[] = [
    {
      label: "Average cost per kg",
      value: a.avgCostPerKg != null ? naira(a.avgCostPerKg) : "Not enough data yet",
      sub: a.avgCostPerKg != null ? `${naira(a.avgCostPerKg * bagKg)} per ${bagKg} kg bag` : "Add cost to a feed purchase",
    },
    {
      label: "Feed used today",
      value: kg(a.kgToday),
      sub: a.costToday != null ? `${naira(a.costToday)} at your average cost` : "Cost unavailable",
    },
    {
      label: "Last 7 days",
      value: kg(a.kgWeek),
      sub: a.costWeek != null ? naira(a.costWeek) : "Cost unavailable",
    },
    {
      label: "Last 30 days",
      value: kg(a.kgMonth),
      sub: a.costMonth != null ? naira(a.costMonth) : "Cost unavailable",
    },
  ];

  const efficiency: { label: string; value: string; sub: string }[] = [
    {
      label: "Feed per bird per day",
      value: a.feedPerBirdG != null ? `${Math.round(a.feedPerBirdG)} g` : "Not enough data yet",
      sub: "Your farm's current performance",
    },
    {
      label: "Feed per egg",
      value: a.feedPerEggG != null ? `${Math.round(a.feedPerEggG)} g` : "Not enough data yet",
      sub: "Days where both feed and eggs were recorded",
    },
    {
      label: "Feed cost per egg",
      value: a.costPerEgg != null ? naira(a.costPerEgg) : "Not enough data yet",
      sub: "Feed only — other costs not included",
    },
    {
      label: "Feed cost per crate",
      value: a.costPerCrate != null ? naira(a.costPerCrate) : "Not enough data yet",
      sub: "30 eggs per crate",
    },
  ];

  return (
    <div className="space-y-4">
      <Section title="Feed cost" subtitle="Based on the purchases you have recorded.">
        {cards}
      </Section>
      <Section
        title="Feed efficiency"
        subtitle="Your farm's current performance, calculated from your own records — not a target or a diagnosis."
      >
        {efficiency}
      </Section>

      <div className="rounded-3xl border border-border bg-card p-4 md:p-5">
        <h3 className="font-display text-base font-semibold">Daily feed use — last 30 days</h3>
        {a.spendSeries.every((p) => p.kg === 0) ? (
          <p className="mt-2 text-sm text-muted-foreground">No feed usage recorded in the last 30 days.</p>
        ) : (
          <MiniBars series={a.spendSeries} />
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: { label: string; value: string; sub: string }[];
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 md:p-5">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {children.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-base font-semibold leading-tight">{c.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniBars({ series }: { series: { date: string; kg: number }[] }) {
  const max = Math.max(...series.map((p) => p.kg), 1);
  return (
    <div className="mt-4 flex h-28 items-end gap-[3px]">
      {series.map((p) => (
        <div
          key={p.date}
          title={`${p.date}: ${Math.round(p.kg * 10) / 10} kg`}
          className="flex-1 rounded-t bg-[color:var(--forest)]/70"
          style={{ height: `${Math.max(2, (p.kg / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
