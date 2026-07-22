# Super Admin — Platform Monitoring & Farm Intelligence Center

This upgrade extends the existing `/super-admin` route in place. No new roles, no new auth, no UI rewrite — new tabs and drill-down views layered onto the current console using the same design tokens (Inter + Cormorant Garamond, existing card/table styles).

## Scope of work

The existing dashboard already has: Overview KPIs, Accounts, Farms, Subscriptions, Notifications, Audit Log, WhatsApp Enquiries. This adds seven capability areas across new/expanded tabs.

### 1. Extended Platform KPIs (Overview tab)
Extend `admin_platform_stats()` to also return: total birds managed, total eggs recorded, total feed bags, total mortality, total health records, total revenue logged, total expenses logged, active-today count, new-registrations-today, online users (proxied by sessions active in last 15 min via a lightweight `user_presence` table updated by a heartbeat), and subscription breakdown. Render as KPI cards + a small sparkline row.

### 2. Farm Activity Monitor (expanded Farms tab)
Extend `admin_list_farms()` to include: last_login, last_activity (max timestamp across production/feed/mortality/health inserts), online status (presence table), user count, room count, bird count. Each row becomes clickable → opens Farm Intelligence.

### 3. Farm Intelligence drill-down (new route `/super-admin/farms/$farmId`)
Read-only tabs: Production, Feed, Mortality, Health, Finance, Inventory. Backed by new SECURITY DEFINER RPCs (`admin_farm_production`, `admin_farm_feed`, `admin_farm_mortality`, `admin_farm_health`, `admin_farm_finance`, `admin_farm_inventory`) that each re-check `is_super_admin()`. Uses existing chart components (recharts) for trends. Finance/Inventory show empty-state cards when tables don't yet exist (documented for follow-up).

### 4. User Activity & Audit Logs (expanded Audit tab)
New `platform_activity_log` table capturing: user_id, farm_id, module, action, entity_id, device, browser, ip, success, metadata, created_at. Populated by:
- DB triggers on `egg_production`, `feed_usage`, `mortality`, `health_records` for insert/update/delete.
- A `log_activity` server fn called from client for login/logout/password reset/profile update/report export.
- Existing `admin_audit_log` continues to hold admin actions.
New RPC `admin_list_activity(filters, limit, offset)` with server-side filters (farm, user, module, action, date range) + pagination. Table view with filter chips.

### 5. Live Activity Feed (new tab)
Human-readable stream from the last 200 activity + audit entries. Uses Supabase Realtime subscription on `platform_activity_log` to append new events. Auto-scrolls, groups by minute.

### 6. Alerts (extends Notifications tab)
Add server-side generator (`generate_platform_alerts()`) triggered by pg_cron every 15 min:
- Inactive farms (>7 days no activity).
- Mortality spike (>configurable %/day per farm).
- Trial ending within 7 days.
- Multiple failed logins (from activity log with action='login', success=false).
Writes into existing `admin_notifications`. Threshold config stored in a new `platform_settings` table.

### 7. Platform Analytics (new tab)
Charts (recharts): farm growth, subscription growth, DAU/MAU, eggs over time, feed usage, mortality, revenue trend, top-10 farms by production, most-active farms. Backed by `admin_platform_timeseries(range)` RPC returning bucketed series.

### 8. Support Mode
New `support_sessions` table: admin_user_id, farm_id, reason, started_at, ended_at, actions_taken jsonb[]. New RPCs `admin_start_support(farm_id, reason)`, `admin_end_support(session_id)`. UI: "Enter Support Mode" button on Farm Intelligence header → confirmation dialog with reason field → yellow persistent banner while active → auto-ends after 60 min or on navigation away. All farm-intelligence RPCs remain read-only; support mode is a logged access marker, no write privileges granted.

### 9. Performance
- All list RPCs accept `_limit`/`_offset` and return `total_count`.
- New indexes on activity log (farm_id, user_id, created_at desc, module).
- React Query: `staleTime: 30_000`, `refetchInterval: 60_000` on KPIs, realtime for feed.
- Route-level code splitting via TanStack Router (drill-down is its own route).

## Technical layout

### New migrations
1. `platform_activity_log` table + indexes + GRANTs + RLS (admins only via `is_super_admin()`).
2. `user_presence` table (user_id PK, last_seen).
3. `support_sessions` table.
4. `platform_settings` table (kv config for thresholds).
5. All new SECURITY DEFINER RPCs.
6. Triggers on domain tables to auto-log activity.
7. pg_cron job for `generate_platform_alerts()` every 15 min.

### New/changed files
```text
src/routes/super-admin.tsx                 (add tabs: Analytics, Live Feed; expand Overview/Farms/Audit)
src/routes/_authenticated/super-admin.       (drill-down)
  farms.$farmId.tsx
src/lib/admin-api.ts                       (new hooks + types)
src/lib/admin-intelligence.ts              (farm-detail hooks)
src/lib/admin-activity.ts                  (activity log hooks + realtime subscription)
src/lib/admin-alerts.ts                    (threshold config hook)
src/lib/presence.ts                        (heartbeat + online user query)
src/components/super-admin/
  KpiGrid.tsx
  FarmActivityTable.tsx
  LiveActivityFeed.tsx
  ActivityLogTable.tsx
  PlatformAnalytics.tsx
  SupportModeBanner.tsx
  SupportModeDialog.tsx
  FarmIntelligenceTabs.tsx
```

Presence heartbeat wired in `src/routes/_authenticated/route.tsx` (30 s interval while tab visible).

## Delivery order
1. Migrations (activity log, presence, support, settings, RPCs, triggers, cron).
2. Extended KPIs + Farm Activity Monitor.
3. Farm Intelligence drill-down.
4. Activity log + Live Feed.
5. Analytics tab.
6. Alerts generator + threshold config.
7. Support Mode.
8. Performance pass (pagination, indexes, realtime tuning).

## Explicit non-goals
- No changes to `is_super_admin()`, `_authenticated` layout, or existing sign-in flow.
- No new admin write actions against farm data — support mode is audit-only.
- Finance/Inventory tabs render "no data yet" placeholders until those domain tables exist; adding them is out of scope for this pass.
- No IP geolocation service integration; IP captured from request headers only.

Approve to proceed and I'll ship migrations first (they need your review), then the UI in follow-up turns.