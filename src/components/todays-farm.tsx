import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CheckCircle2, ClipboardList } from "lucide-react";
import { useEggs, useFeed, useFarm, useMortality, useRooms } from "@/lib/farm-data";
import { totalEggsFromRow } from "@/lib/egg-normalize";
import { toDateKey } from "@/lib/date-key";
import { useToday } from "@/lib/use-today";
import { FarmIntelligencePanel } from "@/components/intelligence/farm-intelligence-panel";

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

export function TodaysFarm() {
  const today = useToday();
  const todayKey = toDateKey(today) ?? "";
  const { data: farm } = useFarm();
  const { data: rooms = [] } = useRooms();
  const { data: eggs = [] } = useEggs();
  const { data: feed = [] } = useFeed();
  const { data: mortality = [] } = useMortality();

  const bagKg = farm?.bag_weight_kg ?? 25;
  const birds = rooms.reduce((s, r) => s + (r.current ?? 0), 0);

  const series = useMemo(() => ({
    eggDays: byDay(eggs, (r) => r.date, (r) => totalEggsFromRow(r)),
    feedDays: byDay(feed, (r) => r.date, (r) => r.bags * bagKg),
    deathDays: byDay(mortality, (r) => r.date, (r) => r.loss),
  }), [eggs, feed, mortality, bagKg]);

  const eggsToday = series.eggDays.get(todayKey);
  const feedToday = series.feedDays.get(todayKey);
  const deathsToday = series.deathDays.get(todayKey);

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

  return (
    <section className="space-y-5">
      <FarmIntelligencePanel />
      <div>
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
