# PoultryPro — Database Persistence & Live Sync

## Root cause (audit)

`src/routes/dashboard.tsx` holds every entity in `useState` seeded from in-file arrays:

- `rooms`, `eggs`, `mortality`, `health`, `feed`, `prices` (lines 105–110)
- All create / edit / delete handlers mutate these arrays only. Nothing is written to any database.
- The project has **no backend enabled**: no `src/integrations/supabase/`, no `supabase/` folder, no auth. `.lovable/project.json` is a bare TanStack Start template.
- Result: every record disappears on refresh because there is no persistence layer at all — not a cache bug.

So "which modules were not persisting" = **all of them**: Egg Production, Mortality, Health, Rooms, Feed Usage, Feed Formulas, Prices, Farm/Room profile.

## What I'll build

### 1. Enable Lovable Cloud + Auth
- Turn on Lovable Cloud (managed Supabase).
- Add an email/password auth screen at `/auth` and gate the dashboard under `_authenticated/`.
- On first sign-in, auto-create a `farm` row for that user and seed default rooms + current prices (one-time, DB-side, per user).

### 2. Schema (single source of truth)

```
farms(id, owner_id, name, created_at)
rooms(id, farm_id, name, initial_birds, created_at)
egg_production(id, farm_id, room_id, date, trays, loose, broken)
mortality(id, farm_id, room_id, date, count, cause, notes)
health(id, farm_id, room_id nullable = All Rooms, date, type, product, notes)
feed_usage(id, farm_id, room_id, date, bags, bag_weight_kg, notes)
feed_formulas(id, farm_id, name, ingredients_json, created_at)
prices(id, farm_id, item, unit, price, effective_date)
```

- All tables: `farm_id` FK, RLS via `farm_id IN (SELECT id FROM farms WHERE owner_id = auth.uid())`.
- Explicit `GRANT SELECT,INSERT,UPDATE,DELETE ... TO authenticated`, `GRANT ALL ... TO service_role`. No `anon` grants.
- Unique constraints where the spec requires one-per-room-per-date (egg_production, feed_usage).
- Stable UUID `id` used for edit/delete.

### 3. Data layer
- `src/lib/farm.queries.ts` — TanStack Query hooks (`useRooms`, `useEggs`, …) built on the browser Supabase client, keyed by `['rooms', farmId]` etc.
- `src/lib/farm.mutations.ts` — `useMutation` for create/update/delete each entity. On success: `queryClient.invalidateQueries` for the entity **and every dependent key** (analytics/AI derive from the same queries, so invalidating source keys is enough — no duplicate datasets).
- Every form: validate → mutate → await DB confirmation → toast success or preserve inputs on error → invalidate.

### 4. Dashboard refactor
- Replace the six `useState` seeds with the query hooks. Keep the same UI, components, and AI methodology.
- All derived values (Farm Analytics, Forecast, Mortality Risk, Feed Efficiency, Abnormal Activity) already recompute via `useMemo` on the arrays — they'll automatically recalculate as queries refresh.
- Preserve user-selected dates (no silent "today" replacement); use record `id` for edit/delete.

### 5. Verification
- Manual pass per module: add → refresh → edit → refresh → delete → refresh; confirm Analytics + AI update.

## Questions before I start

1. **Auth method** — email/password only, or also Google sign-in via the Lovable broker?
2. **Existing seed data** — the demo rows currently shown (production, mortality, etc.): drop them entirely so each user starts empty, or seed a small demo set into the new user's farm on first login so the dashboard isn't blank?
3. **Rooms** — keep the current 4 default rooms auto-created on signup (editable after), or start with zero rooms and require the user to add them?

Once you confirm these three, I'll enable Cloud, ship the schema + auth, and refactor the dashboard to read/write the database.
