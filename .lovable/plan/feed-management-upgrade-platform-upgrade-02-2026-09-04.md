# Feed Management Upgrade (Platform Upgrade 02)

Your Feed area already has a lot of this: stock lots with batches, a running feed ledger, first-in-first-out deduction, feed usage per room, formulations with nutrition and cost, and feed insights. So this upgrade **extends** what's there rather than rebuilding it — no existing feed record, stock lot or formulation is touched.

## What already works (kept as-is)
- Feed stock lots (quantity, cost per kg, supplier, batch, purchase and expiry dates)
- Ledger of every movement, with automatic first-in-first-out deduction when usage is recorded
- Daily feed recording per room in kilograms, with bag equivalents from your bag size setting
- Formulations with ingredients, nutrition totals, cost per kg/bag, active formula feeding the price engine
- Feed insights, feed per bird, days-of-stock forecast

## What gets added

### 1. Feed purchase workflow
A dedicated "Add Purchase" form that thinks in bags: number of bags x bag size = total kg, bags x cost per bag = total cost, and cost per kg shown live before saving. Blocks zero/negative quantities and prices. Feed name, supplier, reference, expiry and notes captured.

### 2. Linked feed expense
Saving a purchase can also post the matching expense into Finance (one tick, on by default), linked to the stock lot so it isn't double-counted, and removed with the lot.

### 3. Feed types and low-stock thresholds
Per-farm feed type list (name, classification: raw ingredient / finished feed / concentrate-premix) with its own minimum stock level. "Low stock" then reflects each farm's own threshold instead of one universal rule. Owners and managers can edit thresholds; staff cannot.

### 4. Stock adjustments, transfers and returns
An adjustment form (add or remove with a reason) that writes a new ledger entry instead of editing history. Ledger gains transaction filters, a date range, and paging so long histories stay fast.

### 5. Farm ingredient profiles (lab values)
A farm-owned ingredient library: name, category, cost per kg, crude protein, energy, fat, fibre, ash, moisture, methionine, lysine, calcium, phosphorus, plus source (Laboratory / Supplier / User entered / PoultryPro default) and test date. Formulations prefer your farm's tested values, then reference values, and always label which one is used. Values outside the reference range show a warning and are never overwritten.

### 6. Formulation upgrades
Target batch size, inclusion percentage entry with a "must total 100%" warning, saved version history (each save keeps the previous version), and a side-by-side cost comparison of two formulations showing the difference per kg and for a chosen batch size.

### 7. Feed cost and efficiency panel
Daily / weekly / monthly feed cost, average cost per kg, feed per bird, feed per egg, feed cost per egg and per crate — each shown only when the underlying records exist, labelled as your farm's own performance, never as a standard.

### 8. Charts and attention list
Feed usage trend and feed spend over time for a selected range (querying only that range), plus a "Needs attention" list covering low stock, unusual usage versus your recent pattern, missing records and stock discrepancies. Wording stays as signals, not diagnoses.

### 9. Quick actions and mobile
A quick-action row at the top of Feed: Add Purchase, Record Usage, Add Ingredient, Create Formulation, Stock Adjustment. Forms use large targets, numeric keypads and dropdowns; no sideways scrolling on a phone.

## Technical notes
- New tables: `feed_types` (per-farm, with `low_stock_kg` and material class), `farm_ingredients` (lab profiles with source + test date), `feed_formula_versions` (snapshot JSON per save). `feed_inventory` gains `feed_type_id`, `bags`, `bag_size_kg`, `total_cost`, `expense_id`; `feed_ledger` gains `transaction_type` values for adjustment/transfer/return/opening. All additive and nullable — existing rows keep working.
- Every new table: grants for `authenticated` + `service_role`, RLS scoped through the existing `can(farm, permission)` / `my_farm_ids()` helpers, matching current feed permissions.
- Deduction and balance stay server-side in the existing `consume_feed_fifo` function, extended to respect feed type and refuse to go negative with an "Insufficient feed stock" error carrying available vs requested.
- Ledger reads become paged; new indexes on `(farm_id, entry_date)` where missing.
- Existing files extended: `src/lib/feed-inventory-data.ts`, `feed-formulas-data.ts`, `feed-nutrition.ts`, `feed-intelligence.ts`, `src/routes/_authenticated/feed.tsx`; new `src/lib/feed-types-data.ts`, `src/lib/farm-ingredients-data.ts`, and feed components under `src/components/feed/`.

## Order of work
1. Database migration (tables, columns, grants, policies, first-in-first-out update)
2. Purchase + finance link + adjustments + thresholds
3. Ingredient library and formulation versions/comparison
4. Cost, efficiency, charts, attention list, quick actions, mobile polish
