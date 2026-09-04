import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bird, Egg, Wheat, HeartPulse, Banknote, AlertTriangle, CheckCircle2,
  ArrowUpRight, ArrowDownRight, Minus, ClipboardList,
} from "lucide-react";
import { useEggs, useFeed, useFarm, useMortality, useRooms } from "@/lib/farm-data";
import { useRevenue } from "@/lib/finance-data";
import { totalEggsFromRow } from "@/lib/egg-normalize";
import { useFarmAlerts, SEVERITY_STYLES } from "@/lib/alerts";
import { formatNaira } from "@/lib/subscription";
import { toDateKey } from "@/lib/date-key";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Sums a value per local date key. */
function byDay<T>(rows: T[], dateOf: (r: T) => string | null | undefined, valueOf: (r: T) => number) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = toDateKey(dateOf(r) ?? null);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + valueOf(r));
  }
  return map;
}

type Metric = {
  key: string;
  label: string;
  icon: typeof Egg;
  value: string;
  /** null = not enough history to compare */
  delta: number | null;
  recorded: boolean;
  emptyHint: string;
};

export function TodaysFarm() {
  const today = useToday();
  const todayKey = toDateKey(today) ?? "";
  const { data: farm } = useFarm();
  const { data: rooms = [] } = useRooms();
  const { data: eggs = [] } = useEggs();
  const { data: feed = [] } = useFeed();
  const { data: mortality = [] } = useMortality();
  const { data: revenue = [] } = useRevenue();
  const { alerts } = useFarmAlerts();

  const bagKg = farm?.bag_weight_kg ?? 25;
  const birds = rooms.reduce((s, r) => s + (r.current ?? 0), 0);

  const series = useMemo(() => {
    const eggDays = byDay(eggs, (r) => r.date, (r) => totalEggsFromRow(r));
    const feedDays = byDay(feed, (r) => r.date, (r) => r.bags * bagKg);
    const deathDays = byDay(mortality, (r) => r.date, (r) => r.loss);
    const moneyDays = byDay(revenue, (r) => r.entry_date, (r) => Number(r.amount ?? 0));
    return { eggDays, feedDays, deathDays, moneyDays };
  }, [eggs, feed, mortality, revenue, bagKg]);

  /** Average of the previous 7 recorded days; null when fewer than 3 exist. */
  const baseline = (map: Map<string, number>) => {
    const prior = [...map.entries()]
      .filter(([k]) => k < todayKey)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 7);
    if (prior.length < 3) return null;
    return prior.reduce((s, [, v]) => s + v, 0) / prior.length;
  };

  const deltaOf = (map: Map<string, number>) => {
    const base = baseline(map);
    const now = map.get(todayKey);
    if (base === null || base === 0 || now === undefined) return null;
    return ((now - base) / base) * 100;
  };

  const eggsToday = series.eggDays.get(todayKey);
  const feedToday = series.feedDays.get(todayKey);
  const deathsToday = series.deathDays.get(todayKey);
  const moneyToday = series.moneyDays.get(todayKey);

  const metrics: Metric[] = [
    {
      key: "birds",
      label: "Birds",
      icon: Bird,
      value: birds > 0 ? birds.toLocaleString() : "—",
      delta: null,
      recorded: birds > 0,
      emptyHint: "Add your bird population",
    },
    {
      key: "eggs",
      label: "Eggs today",
      icon: Egg,
      value: eggsToday !== undefined ? eggsToday.toLocaleString() : "—",
      delta: deltaOf(series.eggDays),
      recorded: eggsToday !== undefined,
      emptyHint: "Not recorded yet today",
    },
    {
      key: "feed",
      label: "Feed today",
      icon: Wheat,
      value: feedToday !== undefined ? `${round1(feedToday)} kg` : "—",
      delta: deltaOf(series.feedDays),
      recorded: feedToday !== undefined,
      emptyHint: "Not recorded yet today",
    },
    {
      key: "mortality",
      label: "Mortality today",
      icon: HeartPulse,
      value: deathsToday !== undefined ? deathsToday.toLocaleString() : "—",
      delta: deltaOf(series.deathDays),
      recorded: deathsToday !== undefined,
      emptyHint: "Not recorded yet today",
    },
    {
      key: "revenue",
      label: "Revenue today",
      icon: Banknote,
      value: moneyToday !== undefined ? formatNaira(moneyToday) : "—",
      delta: deltaOf(series.moneyDays),
      recorded: moneyToday !== undefined,
      emptyHint: "No sale recorded yet today",
    },
  ];

  const tasks = useMemo(() => {
    const list: { key: string; label: string; to: string; search?: Record<string, string>; hash?: string }[] = [];
    if (rooms.length === 0) {
      list.push({ key: "rooms", label: "Add your first room", to: "/dashboard", search: { area: "records" }, hash: "rooms" });
    } else {
      if (eggsToday === undefined) {
        list.push({ key: "eggs", label: "Record today's egg production", to: "/dashboard", search: { area: "records" }, hash: "production" });
      }
      if (feedToday === undefined) {
        list.push({ key: "feed", label: "Record today's feed usage", to: "/feed", search: { tab: "overview" } });
      }
      if (deathsToday === undefined) {
        list.push({ key: "mortality", label: "Confirm today's mortality (record 0 if none)", to: "/dashboard", search: { area: "records" }, hash: "mortality" });
      }
      if (birds === 0) {
        list.push({ key: "birds", label: "Update your bird population", to: "/dashboard", search: { area: "records" }, hash: "rooms" });
      }
    }
    return list;
  }, [rooms.length, eggsToday, feedToday, deathsToday, birds]);

  const attention = alerts.filter((a) => a.severity !== "info").slice(0, 4);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Today&apos;s Farm
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date(today).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {metrics.map((m) => {
          const Icon = m.icon;
          const up = m.delta !== null && m.delta > 1;
          const down = m.delta !== null && m.delta < -1;
          const DeltaIcon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
          return (
            <div key={m.key} className="rounded-2xl border border-border bg-card p-4">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Icon className="h-3.5 w-3.5" /> {m.label}
              </span>
              <p className={cn("mt-2 font-display text-2xl font-semibold tabular-nums", !m.recorded && "text-muted-foreground")}>
                {m.value}
              </p>
              {m.recorded ? (
                m.delta === null ? (
                  <p className="mt-1 text-xs text-muted-foreground">Not enough data yet</p>
                ) : (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <DeltaIcon className="h-3 w-3" />
                    {Math.abs(Math.round(m.delta))}% vs 7-day average
                  </p>
                )
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">{m.emptyHint}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <AlertTriangle className="h-4 w-4" /> Needs your attention
          </h3>
          {attention.length === 0 ? (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-[color:var(--forest)]" />
              Nothing needs your attention right now.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {attention.map((a) => (
                <li key={a.id}>
                  <Link
                    to={a.to ?? "/alerts"}
                    search={a.search as never}
                    hash={a.hash as never}
                    className="flex items-start gap-3 rounded-xl border border-border p-3 transition hover:bg-secondary/50"
                  >
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_STYLES[a.severity].dot)} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{a.title}</span>
                      <span className="block text-xs text-muted-foreground">{a.message}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <ClipboardList className="h-4 w-4" /> Today&apos;s tasks
          </h3>
          {tasks.length === 0 ? (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-[color:var(--forest)]" />
              Today&apos;s records are complete.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {tasks.map((t) => (
                <li key={t.key}>
                  <Link
                    to={t.to}
                    search={t.search as never}
                    hash={t.hash as never}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm transition hover:bg-secondary/50"
                  >
                    <span>{t.label}</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
