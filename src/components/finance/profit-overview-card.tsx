import * as React from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { monthRange, type DailyFinancialPoint, type DateRange } from "@/lib/farm-analytics";

const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function pad(n: number) { return n < 10 ? `0${n}` : String(n); }
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function currentYm() { return todayKey().slice(0, 7); }
function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
function prettyDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;
}

type Selection =
  | { kind: "all" }
  | { kind: "month"; ym: string }
  | { kind: "custom"; start: string; end: string };

type ChartPoint = {
  name: string;
  key: string;
  Revenue: number;
  "Feed Cost": number;
  Profit: number;
};

/** Roll daily points up to month or year buckets so long ranges stay readable. */
function bucketSeries(points: DailyFinancialPoint[], grain: "day" | "month" | "year"): ChartPoint[] {
  if (grain === "day") {
    return points.map(p => ({
      name: p.label, key: p.date,
      Revenue: p.revenue, "Feed Cost": p.feedCost, Profit: p.profit,
    }));
  }
  const size = grain === "month" ? 7 : 4;
  const out = new Map<string, ChartPoint>();
  for (const p of points) {
    const key = p.date.slice(0, size);
    const name = grain === "month"
      ? `${SHORT[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`
      : key;
    const row = out.get(key) ?? { name, key, Revenue: 0, "Feed Cost": 0, Profit: 0 };
    row.Revenue += p.revenue;
    row["Feed Cost"] += p.feedCost;
    row.Profit += p.profit;
    out.set(key, row);
  }
  return Array.from(out.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function ProfitOverviewCard({
  seriesFor, months, loading,
}: {
  seriesFor: (range: DateRange) => DailyFinancialPoint[];
  months: string[];           // YYYY-MM ascending, from real records
  loading: boolean;
}) {
  const nowYm = currentYm();
  const [selection, setSelection] = React.useState<Selection>({ kind: "month", ym: nowYm });
  const [customStart, setCustomStart] = React.useState(`${nowYm}-01`);
  const [customEnd, setCustomEnd] = React.useState(todayKey());
  const [switching, setSwitching] = React.useState(false);

  // Available months always include the current month and never the future.
  const monthOptions = React.useMemo(
    () => months.filter(m => m <= nowYm).slice().sort().reverse(),
    [months, nowYm],
  );

  // Farm switch (or a fresh record history) can drop the selected month.
  React.useEffect(() => {
    if (selection.kind === "month" && !monthOptions.includes(selection.ym)) {
      setSelection({ kind: "month", ym: nowYm });
    }
  }, [monthOptions, selection, nowYm]);

  const range: DateRange = React.useMemo(() => {
    if (selection.kind === "all") {
      return { start: "0000-01-01", end: "9999-12-31", label: "All time", preset: "all" };
    }
    if (selection.kind === "month") return monthRange(selection.ym);
    const start = selection.start <= selection.end ? selection.start : selection.end;
    const end = selection.start <= selection.end ? selection.end : selection.start;
    return { start, end, label: "Custom period", preset: "custom" };
  }, [selection]);

  const points = React.useMemo(() => (loading ? [] : seriesFor(range)), [loading, seriesFor, range]);

  const totals = React.useMemo(() => points.reduce(
    (acc, p) => ({
      revenue: acc.revenue + p.revenue,
      cost: acc.cost + p.feedCost,
      profit: acc.profit + p.profit,
    }),
    { revenue: 0, cost: 0, profit: 0 },
  ), [points]);

  const grain: "day" | "month" | "year" = React.useMemo(() => {
    if (!points.length) return "day";
    const span = daysBetween(points[0]!.date, points[points.length - 1]!.date);
    if (span <= 90) return "day";
    if (span <= 1825) return "month";
    return "year";
  }, [points]);

  const chartData = React.useMemo(() => bucketSeries(points, grain), [points, grain]);

  const periodName =
    selection.kind === "all" ? "All-Time"
      : selection.kind === "month" ? monthLabel(selection.ym)
        : "Custom Period";
  const periodSubtitle =
    selection.kind === "all"
      ? points.length
        ? `Revenue, feed cost and profit · ${prettyDate(points[0]!.date)} → ${prettyDate(points[points.length - 1]!.date)}`
        : "Revenue, feed cost and profit across every record"
      : selection.kind === "month"
        ? `Revenue, feed cost and profit · ${monthLabel(selection.ym)}`
        : `Revenue, feed cost and profit · ${prettyDate(range.start)} → ${prettyDate(range.end)}`;

  const selectValue =
    selection.kind === "all" ? "all" : selection.kind === "month" ? selection.ym : "custom";

  const change = (next: Selection) => {
    setSwitching(true);
    setSelection(next);
    window.setTimeout(() => setSwitching(false), 180);
  };

  const shiftMonth = (delta: number) => {
    if (selection.kind !== "month") return;
    const [y, m] = selection.ym.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    if (ym > nowYm) return;
    change({ kind: "month", ym });
  };

  const earliestMonth = monthOptions.length ? monthOptions[monthOptions.length - 1]! : nowYm;
  const atFirst = selection.kind === "month" && selection.ym <= earliestMonth;
  const atCurrent = selection.kind === "month" && selection.ym >= nowYm;
  const busy = loading || switching;

  return (
    <section className="rounded-3xl bg-card border border-border p-5 md:p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-xl md:text-2xl font-semibold">{periodName} Profit Overview</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{periodSubtitle}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select
              value={selectValue}
              onValueChange={(v) => {
                if (v === "all") change({ kind: "all" });
                else if (v === "custom") change({ kind: "custom", start: customStart, end: customEnd });
                else change({ kind: "month", ym: v });
              }}
            >
              <SelectTrigger className="w-full sm:w-56 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">All Time</SelectItem>
                {monthOptions.map(m => (
                  <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                ))}
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            {selection.kind === "month" && (
              <div className="flex items-center gap-1">
                <Button
                  type="button" variant="outline" size="icon" className="rounded-xl"
                  aria-label="Previous month" disabled={atFirst} onClick={() => shiftMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button" variant="outline" size="icon" className="rounded-xl"
                  aria-label="Next month" disabled={atCurrent} onClick={() => shiftMonth(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          {selection.kind === "custom" && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-xs text-muted-foreground">
                Start date
                <input
                  type="date" value={customStart} max={todayKey()}
                  onChange={(e) => { setCustomStart(e.target.value); change({ kind: "custom", start: e.target.value, end: customEnd }); }}
                  className="mt-1 block rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                End date
                <input
                  type="date" value={customEnd} max={todayKey()}
                  onChange={(e) => { setCustomEnd(e.target.value); change({ kind: "custom", start: customStart, end: e.target.value }); }}
                  className="mt-1 block rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
            </div>
          )}
        </div>

        <div className="md:text-right">
          <div className="text-xs text-muted-foreground">{periodName === "All-Time" ? "All-Time" : periodName} Profit</div>
          {busy ? (
            <div className="space-y-2 mt-1 md:flex md:flex-col md:items-end">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-28" />
            </div>
          ) : (
            <>
              <div className="font-display text-2xl font-semibold text-[color:var(--forest)]">
                {naira(totals.profit)}
              </div>
              <div className="text-xs text-muted-foreground">Revenue: {naira(totals.revenue)}</div>
              <div className="text-xs text-muted-foreground">Feed Cost: {naira(totals.cost)}</div>
            </>
          )}
        </div>
      </div>

      <div className="h-72 mt-4">
        {busy ? (
          <div className="h-full rounded-2xl border border-dashed border-border flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <Skeleton className="h-40 w-[90%]" />
            <span>Loading {periodName === "All-Time" ? "all-time" : periodName} financial data…</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full rounded-2xl border border-dashed border-border flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium">No financial records for this period.</p>
            <p className="text-xs text-muted-foreground">Select another month, or choose All Time to see the full history.</p>
            {selection.kind !== "all" && (
              <Button type="button" variant="outline" size="sm" className="rounded-xl mt-1" onClick={() => change({ kind: "all" })}>
                View All Time
              </Button>
            )}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 85)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={18} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => "₦" + (v / 1000).toFixed(0) + "k"} />
              <Tooltip
                contentStyle={{ borderRadius: 12 }}
                formatter={(v: number) => naira(v)}
                labelFormatter={(_l, payload) => {
                  const key = (payload?.[0]?.payload as ChartPoint | undefined)?.key;
                  if (!key) return String(_l);
                  if (grain === "day") return prettyDate(key);
                  if (grain === "month") return monthLabel(key);
                  return key;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Revenue" stroke="oklch(0.32 0.06 155)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Feed Cost" stroke="oklch(0.78 0.15 78)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Profit" stroke="oklch(0.55 0.15 240)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
