## Goal

Every daily recording screen in PoultryPro looks and behaves like the Production modal: date at the top, one card per room pulled live from the database, a live summary panel, and a single Save that writes one row per room. History tables switch to one-row-per-day pivoted by room.

## Phased delivery

This is multi-turn work. I'll ship it in three phases so you can review after each.

### Phase 1 — Shared framework + refactor the 4 existing modules
- Build a reusable `DailyRecordingModal` component that takes a schema (fields per room) and renders the standard layout, summary panel, save/edit logic, copy-yesterday, draft auto-save, and keyboard nav (Tab + Arrow keys between room inputs).
- Refactor Production, Feed, Mortality, Health to use it.
- Pivot the four history tables to Date | Room 1 | … | Total, with expandable rows for per-room detail.
- Wire dashboard/AI/analytics invalidation on save (already keyed under `farmScope`).

### Phase 2 — Sales, Expenses, Medication, Vaccination
- One migration adds four tables (`sales`, `expenses`, `medication_records`, `vaccination_records`) with GRANTs, RLS scoped to `auth.uid()` via `farm_id → farms.owner_id`, and `updated_at` triggers.
- Add matching hooks in `farm-data.ts` and mount each module using the shared framework.
- Add nav entries + history pages.
- Update financial summaries to consume Sales + Expenses.

### Phase 3 — Feed Stock Issuance, Water, Environmental
- Migration adds `feed_stock`, `water_consumption`, `environmental_readings`.
- Environmental uses non-room-scoped fields (temp/humidity per room) but same layout.
- Extend AI insights to surface anomalies (feed stock depletion, water drop, temp spikes).

## Standard modal contract

```text
┌────────────────────────────────────────────┐
│  Record {Module}         [Date picker]     │
│  ─────────────────────────────────────     │
│  [Copy Yesterday ▾]  [Clear All]           │
│                                            │
│  ROOM 1  ┌─────────────────────────────┐   │
│          │ field  field  field         │   │
│          └─────────────────────────────┘   │
│  ROOM 2  ┌─────────────────────────────┐   │
│  ...     (one card per room from DB)       │
│                                            │
│  ─────── Live Summary ───────              │
│  Rooms recorded · Totals · Per-bird KPIs   │
│                                            │
│                    [Cancel]  [Save/Update] │
└────────────────────────────────────────────┘
```

Behaviour rules (shared across every module):
- Room list from `useRooms()` — never hardcoded.
- If records exist for the chosen date, preload and switch button to **Update Record**; prevents duplicate day entries.
- **Copy Yesterday** (selective per your note): dropdown lets user pick which fields to copy (e.g. bird count, feed bags, environmental readings), leaves production/mortality/health blank by default, shows confirmation before applying, supports undo via a toast action.
- Draft auto-save to `localStorage` keyed by `farmId:module:date`, cleared on successful save.
- Keyboard: Tab moves to next input; ArrowUp/Down moves between the same field across rooms; ArrowLeft/Right across fields in a row.
- Live summary recomputes on every keystroke.
- Save writes one row per non-empty room in a single batch; success toast + cache invalidation, no page refresh.
- Client-side Zod validation + RLS on the server.

## History table contract

Pivoted: `Date | Room 1 | Room 2 | … | Total | Actions`. Click a row to expand and see per-room detail cards. Edit/delete from the expanded panel.

## Technical details

- New file: `src/components/daily-recording/DailyRecordingModal.tsx` (schema-driven).
- New file: `src/components/daily-recording/module-schemas.ts` — one schema per module (fields, units, summary calculators, Zod schema).
- New file: `src/components/daily-recording/PivotedHistoryTable.tsx`.
- New hook: `useCopyYesterday(module, date)` — returns previous-day snapshot per room.
- New hook: `useDraftAutosave(key, value)` — debounced localStorage persist.
- Phase 2 migration (single file): `sales`, `expenses`, `medication_records`, `vaccination_records` — each with `id, farm_id, date, room, …fields, created_at, updated_at`; `GRANT SELECT/INSERT/UPDATE/DELETE ... TO authenticated`; `GRANT ALL ... TO service_role`; RLS `USING (EXISTS (SELECT 1 FROM farms WHERE id = farm_id AND owner_id = auth.uid()))`.
- Phase 3 migration: `feed_stock`, `water_consumption`, `environmental_readings` (same pattern).
- Extend `farm-data.ts` with `useSales`, `useExpenses`, `useMedications`, `useVaccinations`, `useFeedStock`, `useWater`, `useEnvironmental` + mutations, all under `farmScope(farmId)`.
- Nav: add entries under a new "Daily Records" group in the dashboard sidebar.

## What ships in Phase 1 (this turn)

1. `DailyRecordingModal` framework + schemas for Production/Feed/Mortality/Health.
2. Refactored Production/Feed/Mortality/Health modals inside `record-dialogs.tsx`.
3. Pivoted history tables for those four.
4. Copy-yesterday (selective), draft auto-save, edit-mode, keyboard nav — all shared.

Reply **go** to start Phase 1, or tell me to reorder / cut / split further.