# PoultryPro Intelligence 2.0 — Action Centre (Phase 1 plan)

## What already exists (audit)
- **Rule engine**: one pure engine already turns farm records into alerts (production drop, mortality vs recent average, feed per bird, low stock, health clusters, weather heat risk, finance changes, missing records). It uses the farm's own 7-day history and stays silent when there is no history.
- **Alert status table**: alert status is saved per farm (active / acknowledged / resolved, first/last seen, who acknowledged). Only active members of that farm can read or change it.
- **Screens**: Farm Alerts page, "Today's Farm Intelligence" on the dashboard, alert bell, banner and phone notifier — all fed by the same engine.
- **Calculations**: feed stock (purchases, usage, adjustments, first-in-first-out), lay %, mortality %, feed cost per crate, feed margin vs operating profit — covered by 53 passing tests.
- **Weather advisory**: temperature bands, humidity and bird age already handled.
- **Missing**: assigning an alert to a person, "in progress", dismiss with a reason, notes, a full action history, Low/Medium/High priority wording, an evidence-quality label, comparison period on every alert, cooldowns after dismissal, a follow-up "did it get better?" view, and stock-vs-count discrepancy checks.

## What the farmer will see
- The Farm Alerts page becomes the **Action Centre** (same place in navigation, nothing removed):
  - Tabs: **Today** (open items by priority), **In progress** (assigned / in progress), **Follow-up** (resolved items with before/after figures), **History**.
  - A "Records we need" strip listing missing or stale entries that block reliable advice.
  - Each card: title, High / Medium / Low priority, what we saw, supporting figures and comparison period, why it matters, recommended next step, evidence label (**Strong / Limited / Not enough data**), when it was generated, status and history.
  - Buttons (only for users allowed to edit that area): Acknowledge, Assign to a staff member, Start, Resolve (with optional note), Dismiss (reason required: "Recorded wrongly", "Already handled", "Not relevant", other).
- The dashboard panel keeps its place and shows the top 3 open actions linking to the Action Centre.
- Follow-up view compares the 7 days after resolution with the 7 days before, worded as "results after this action" — never "this action caused".

## First rules (deterministic, each documented in code with: required data, condition, baseline, priority, next step, when silent, low-data behaviour)
1. Egg production drop (farm and room) vs own 7-day baseline; ignores small daily swings; advises re-checking the count, then feed, water and mortality records.
2. Missing / duplicated / stale records (no entry today, no entry for 3+ days, zero-everything rows) — never treated as zero.
3. Feed stock: days remaining from recent 7-day usage; "estimate unreliable" when fewer than 4 usage days; zero stock is High.
4. Feed usage unusually high or low vs baseline.
5. Mortality vs birds at risk and baseline; vet suggestion only when strongly abnormal; no disease names.
6. Vaccination due/overdue from existing schedules; health records missing while mortality is rising.
7. Finance: feed margin and operating profit shown separately; flags rising feed cost or falling egg revenue only when prices/sales exist; missing prices reported as a gap.
8. Weather: reuses the existing advisory, shows source, time and assumptions.

Priority mapping from the current severity (critical/warning → High, watch → Medium, informational → Low). Duplicates grouped by stable keys; a dismissed alert stays quiet for a cooldown (e.g. 3 days) unless it gets clearly worse.

AI is not added in this phase. Plain-language explanations come from the rules, so nothing is invented.

## Not changed
Existing records, formulas, subscriptions, offline sync, navigation structure, public demo. Nothing is published.

## Technical details
- Extend `farm_alert_states` additively: `priority`, `evidence`, `assigned_to`, `assigned_at`, `in_progress_at`, `dismissed_at`, `dismissed_by`, `dismiss_reason`, `resolved_by`, `resolution_note`, `cooldown_until`, `baseline_snapshot jsonb`, `generated_at`. Status check extended to include assigned / in_progress / dismissed.
- New `farm_alert_events` table (farm_id, alert_key, action, from/to status, note, actor, created_at) with GRANTs and RLS: read for active farm members; insert only via a security-definer `alert_transition()` function that checks membership + module edit permission (`can`) and writes state + event atomically. No direct update from the browser.
- Engine additions in `src/lib/intelligence/engine.ts` (pure): `priority`, `evidence`, `comparisonPeriod`, rule metadata registry, cooldown filter, stock discrepancy and stale/duplicate detectors; new `follow-up.ts` for before/after comparison.
- UI: rework `src/routes/_authenticated/alerts.tsx` and `intel-alert-card.tsx`; small update to the dashboard panel; existing bell/banner adapters kept.
- Tests (vitest, hand-computed expectations): declines vs normal fluctuation, stock estimates incl. zero stock and unreliable history, mortality with changing populations, finance with missing prices, missing/duplicate/stale records, priority/dedup/cooldown, transition rules and history, permission matrix for the transition function (checked with a staff account via SQL), offline cached-data path.
- Validation: typecheck, lint, all tests, production build, mobile + desktop screenshots as the signed-in owner.
