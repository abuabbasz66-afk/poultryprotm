## Overview

Overhaul dashboard analytics so every metric is computed dynamically from database records against a user-selected date range, with a clear split between today / month / all-time totals. Fixes the "Monthly Mortality" cumulative bug and standardises every card, chart, and insight on the same date-filtered computation layer.

## Scope

Dashboard (`src/routes/_authenticated/dashboard.tsx`) and supporting analytics utilities. No schema changes required — all data already exists in `egg_production`, `mortality`, `feed_usage`, `prices`, `rooms`, `health_records`. Bird movement (added/sold) is not tracked as a separate table today; see "Open decisions" below.

## Deliverables

### 1. New analytics engine — `src/lib/farm-analytics.ts`

Pure functions that take raw hooks output (`eggs`, `mortality`, `feed`, `rooms`, `prices`) plus a `DateRange` and return:

- `todayMetrics`, `monthMetrics`, `allTimeMetrics`, `rangeMetrics`
- Each includes: eggs, crates, revenue, feed bags, feed cost, mortality count, mortality %, production rate, active birds, highest producing room, feed per bird, FCR.
- `dailySeries(range)` → `[{ date, eggs, crates, feed, mortality, revenue, productionRate }]` for charts.
- `compareLatestTwoDays(eggs)` → `{ latest, previous, delta, deltaPct }` or `null`.

All date logic uses `toDateKey` / `toLocalDate` from `@/lib/date-key` — no cumulative sums leak into monthly/daily calculations.

### 2. Date range filter

New `DateRangeFilter` component (top of dashboard) with presets: **Today · Yesterday · Last 7 Days · This Month · Last Month · Custom**. Custom uses the shadcn calendar in a popover. Selected range is held in dashboard state and passed to the analytics engine + charts. Cards that are inherently "today" or "all-time" ignore the range and show a small label; the range drives the middle band of "range metrics" and the charts.

### 3. Executive summary cards (replaces current top KPI grid)

Exact set requested:

1. Total Live Birds — sum(rooms.current)
2. Today's Eggs
3. Today's Revenue — today's crates × latest egg price
4. Production Rate — (today's eggs ÷ live birds) × 100
5. Today's Mortality
6. Monthly Mortality — current calendar month only
7. Total Mortality (All Time)
8. Highest Producing Room — name + crates + eggs + % of today
9. Feed Used Today — bags
10. AI Farm Health Score — 0–100 composite (production vs target, mortality trend, feed anomaly, data freshness); logic in `farm-analytics.ts`.

### 4. Fixed detail sections

- **Production Performance**: shows Current Rate / Target 80% / Gap (pp) with signed value + colour.
- **Daily Comparison**: latest vs previous *recorded* production day (skips gaps). Empty state = "No previous record available."
- **Financial Analytics**: Today / This Month / All Time revenue, feed cost, medication cost (sum of health_records with `type='medication'` × price where available, else 0 with note), other expenses (0 placeholder), Profit = Revenue − Feed − Medication − Other.
- **Feed Analytics**: Today, Month, All Time, Feed/Bird, FCR (kg feed per dozen eggs using bag_weight_kg from farm settings).
- **Bird Population**: Initial (sum rooms.initial), Total Mortality, Current = Initial − Mortality (Birds Added / Sold = 0 with "Not tracked yet" tooltip until movement table exists — see Open decisions).

### 5. Charts (recharts, responsive)

Six charts driven by `dailySeries(range)`:

- Daily Egg Production (bar)
- Monthly Production Trend (line, aggregated by month)
- Feed Usage Trend (bar)
- Mortality Trend (line)
- Revenue vs Expenses (stacked line/area: revenue vs feed+med cost)
- Production Rate Trend (line, 0–100%, 80% reference line)

### 6. AI Insights

Extend `src/lib/farm-insights.ts` (already exists) with 5 new detectors: production-below-target, mortality-rising (7-day slope), feed-anomaly (z-score vs 14-day mean), revenue-trend, low-flock-performance. Each returns a suggested action string; rendered by the existing `FarmInsightsIntelligence` card unchanged.

### 7. Correctness guarantees

- All aggregations run through `toDateKey(row.date)` so edits/deletes flow through immediately (queries auto-invalidate on mutation — already wired).
- Empty period → returns `0` and cards render "No data available" instead of NaN.
- Monthly/daily metrics NEVER read from all-time sums.

## Files touched

```text
src/lib/farm-analytics.ts            NEW  ~400 LOC pure functions + types
src/lib/farm-insights.ts             EDIT append 5 detectors
src/components/date-range-filter.tsx NEW  preset + custom-range popover
src/components/executive-cards.tsx   NEW  10-card grid (extracted for clarity)
src/components/dashboard-charts.tsx  NEW  6 recharts panels
src/routes/_authenticated/dashboard.tsx  EDIT wire filter + swap KPI grid + insert charts; delete cumulative-mortality bug
```

No database migration. No changes to record dialogs, subscription gating, or routing.

## Open decisions (need your call before I build)

1. **Bird movements (added / sold)** — there is no table for this today. Options:
   - a) Add a `bird_movements` table (date, room_id, type=add|sale, count, notes, unit_price) and surface it in a new "Movements" record dialog. Enables accurate "Birds Sold" revenue too.
   - b) Show the fields as `0` with a "Not tracked yet" tooltip and skip until you're ready.
2. **Medication cost** — `health_records` doesn't store cost. Options:
   - a) Add a `cost` numeric column to `health_records` and prompt for it in the health dialog.
   - b) Approximate from `prices` where `item ILIKE 'medication%'` × record count (rough).
   - c) Show `₦0` with a note.
3. **AI Farm Health Score weights** — propose: production 40% · mortality 30% · feed anomaly 20% · data freshness 10%. OK, or tune?

Reply with a/b/c for each, or "your call" and I'll pick the safest option (b, c, proposed weights).
