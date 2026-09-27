# Farm Alerts + Daily Farm Intelligence

PoultryPro already has a derived alerts engine (price, production decline, mortality patterns, feed-per-bird, security activity), an Alerts page, a dashboard alert banner, and a "Today's Farm" card. This plan upgrades those into one intelligence layer instead of building a second system.

## What the farmer will see

- **Farm Alerts page** (existing Alerts page, upgraded; stays in the navigation):
  - Compact tappable cards on mobile; on desktop a summary strip, priority alerts, room status and history.
  - Each alert: severity (Normal / Watch / Warning / Critical), category, title, "What happened / Why it matters / What to check", affected room, time, status and one working action button (View Production, View Feed, View Weather...).
  - Tabs: Active, Acknowledged, History (with resolution time). Filter by category.
- **Today's Farm Intelligence** on the dashboard (replaces the inside of the current "Today's Farm" card, same place):
  - Greeting and a short plain-language summary built only from real records.
  - Key figures: birds, production % vs recent average, feed bags, mortality, weather.
  - Top 3 priorities and a room status list (Stable / Monitor / Attention).
  - "Not enough history yet" shown where there is no baseline; "may be incomplete" note when records are waiting to sync.

## Alert rules (baseline = farm's own recent 7 days; no baseline, no alert)

- **Production**: farm and each room vs its recent average; duration counted ("below pattern for 3 days"). Reuses the existing production-decline detector.
- **Mortality**: today vs recent daily average, per room; reuses the existing mortality-pattern detector. Vet wording only when strongly abnormal; never names a disease.
- **Feed**: today's bags vs recent average (high or low); feed-per-bird from existing utility.
- **Inventory**: low feed stock with days remaining only when stock and usage history exist; otherwise "stock is low, please check".
- **Health**: several health records in the same room within 7 days.
- **Weather**: heat risk level from the new weather advisory, short actions and a link to the Weather page.
- **Finance**: feed cost or daily expenses above recent average, revenue down week-on-week, using existing finance utilities.
- **Operations**: today's missing records (existing).
- Critical is reserved for large deviations (e.g. mortality at least 3x normal, feed stock under 2 days, extreme heat).

Sorting: severity first, then larger % deviation, longer duration, more birds affected. No hidden scores.

## Permissions, plans, farms

- Each category shows only if the user can already view that module; premium-only analysis stays premium.
- Everything is scoped to the active farm; saved alert status is protected per farm in the database.

## Technical details

- New pure module `src/lib/intelligence/engine.ts`: `generateFarmIntelligence(input) -> { alerts, priorities, metrics, rooms, summary, dataGaps }`. No React inside; unit tested with vitest for the 16 listed scenarios (normal, decline, spike, feed high, low stock, heat, heat+humidity, multiple, none, acknowledged, resolved, offline cache, multi-room, multi-farm key isolation, no permission, insufficient history).
- `useFarmIntelligence()` hook feeds cached React Query data (works offline) into the engine with `useMemo`; existing `useFarmAlerts` becomes a thin adapter so the bell, banner, phone notifier keep working.
- Stable alert keys (`category:scope:condition`) so a persisting condition updates one alert instead of creating duplicates.
- New table `farm_alert_states` (farm_id, alert_key, category, severity, room_id, title, status active/acknowledged/resolved, first_seen_at, last_seen_at, acknowledged_by/at, resolved_at, created_at, updated_at; unique farm_id+alert_key). RLS: active farm members only. A sync step upserts currently-active alerts and marks missing ones resolved. Existing local read-state kept as fallback.
- Severity mapping kept backwards compatible (old critical/warning/info map to Critical/Warning/Normal).
- No changes to financial, production, feed or mortality formulas; no push notifications; navigation config unchanged.
- Validation: typecheck, lint, tests, production build, mobile and desktop screenshots as the signed-in owner.
