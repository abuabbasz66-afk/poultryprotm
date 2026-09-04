// Signals that deserve a look — worded as observations, never diagnoses.
import { AlertTriangle, CalendarClock, CheckCircle2, TrendingUp } from "lucide-react";
import { useFeedTypeStock, useFeedCostAnalytics } from "@/lib/feed-purchases-data";
import { useFeedInventory, useFeedStockAnalytics } from "@/lib/feed-inventory-data";
import { toDateKey } from "@/lib/date-key";

type Signal = { id: string; icon: typeof AlertTriangle; text: string };

export function FeedAttention() {
  const stock = useFeedTypeStock();
  const stats = useFeedStockAnalytics();
  const cost = useFeedCostAnalytics(30);
  const inv = useFeedInventory();

  const signals: Signal[] = [];

  for (const r of stock.rows.filter((x) => x.low)) {
    signals.push({
      id: `low-${r.key}`,
      icon: AlertTriangle,
      text: `${r.name} is below your minimum level — ${Math.round(r.stockKg)} kg left against a minimum of ${Math.round(r.thresholdKg)} kg.`,
    });
  }

  if (Number.isFinite(stats.daysRemaining) && stats.daysRemaining < 7 && stats.stockKg > 0) {
    signals.push({
      id: "runway",
      icon: CalendarClock,
      text: `At your recent usage rate, current stock covers about ${Math.floor(stats.daysRemaining)} more days.`,
    });
  }

  const today = toDateKey(new Date()) ?? "";
  for (const lot of inv.data ?? []) {
    if (lot.expiry_date && lot.remaining_kg > 0 && lot.expiry_date <= addDays(today, 30)) {
      signals.push({
        id: `exp-${lot.id}`,
        icon: CalendarClock,
        text: `${lot.feed_type} batch expires on ${new Date(lot.expiry_date).toLocaleDateString()} with ${Math.round(lot.remaining_kg)} kg still in stock.`,
      });
    }
  }

  // Unusual consumption: today's use well above the 30-day pattern.
  const recorded = cost.spendSeries.filter((p) => p.kg > 0);
  if (recorded.length >= 7 && cost.kgToday > 0) {
    const avg = recorded.reduce((s, p) => s + p.kg, 0) / recorded.length;
    if (avg > 0 && cost.kgToday > avg * 1.3) {
      signals.push({
        id: "spike",
        icon: TrendingUp,
        text: `Today's feed use (${Math.round(cost.kgToday)} kg) is higher than your 30-day average of ${Math.round(avg)} kg. Worth confirming the entry.`,
      });
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-4 md:p-5">
      <h3 className="font-display text-base font-semibold">Needs your attention</h3>
      {signals.length === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-[color:var(--forest)]" />
          Nothing needs attention in your feed records right now.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {signals.slice(0, 6).map((s) => (
            <li key={s.id} className="flex items-start gap-2 rounded-2xl border border-border p-3 text-sm">
              <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>{s.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function addDays(dateKey: string, days: number) {
  if (!dateKey) return dateKey;
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toDateKey(d) ?? dateKey;
}
