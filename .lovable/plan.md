# Upgrade 03 — Universal Records Export & Reporting

One export engine, used everywhere. Same dialog, same wording, same file quality, whether the user is on Production, Feed, Brooding or Finance.

## What the user gets

- An **Export Records** button on every records page: Farm Records (production, mortality, health, water), Feed, Feed Inventory, Feed Formulation, Brooding & Rearing, Broilers (health/medication/vaccination), Finance, Analytics.
- One dialog: **Export PoultryPro Records** — "Download your farm records for analysis, reporting or backup."
  - Scope: Current Section / Entire Farm / Selected Records
  - Date range: All Time, Today, Yesterday, Last 7 / 30 days, This month, Last month, This year, Custom (from/to)
  - Room and flock/batch filters where the record type supports them
  - Record-type checkboxes with Select All / Clear All — only types that exist and have data are offered
  - Format: PDF ("Professional report for sharing and printing"), Excel ("Detailed workbook for analysis"), CSV ("Raw records for data processing")
- Step-by-step progress ("Collecting farm records… Preparing report… Generating file… Ready"), then a single download of the chosen format.
- Filenames like `PoultryPro_Brooding_Report_2026-09-08.pdf`, `PoultryPro_Farm_Report_2026-01-01_to_2026-09-08.xlsx`, farm name sanitised.

## Report content

- **PDF**: PoultryPro header with the farm name and tagline, reporting period, generated date; executive summary computed only from records inside the selected period; one section per selected record type, repeated table headers, page numbers, automatic page breaks, no overflow. A selected section with nothing in range prints "No records found for the selected period."
- **Excel**: one Summary sheet plus one sheet per record type, frozen header row, auto-filter, sensible column widths, real dates and number/currency formats.
- **CSV**: single file for one section; entire-farm CSV produces a ZIP of `production.csv`, `feed.csv`, `mortality.csv`, … only for the selected types. UTF-8 with headers.
- Analytics and AI insights, when included, are labelled "Calculated metric" / "AI-Supported Farm Insight" and kept separate from raw records.

## Data and security

- Every row is read through the signed-in user's own database access, so existing farm permissions and access rules apply unchanged. No service key in the browser, no new access rules loosened, no data written or altered.
- Date filtering uses each record's own business date (production date, feed usage date, mortality date, placement date, transaction date), formatted in Nigerian local time — no day shifting.
- Exports read the full history for the chosen range in batched pages; the on-screen page size never limits an export.
- Only farms, rooms and flocks the user can already access appear in the filters.

## Technical notes

- New `src/lib/export/` module:
  - `registry.ts` — one descriptor per record type: label, source table, business-date column, room/flock support, required permission, column list (header, accessor, type: text/number/currency/date).
  - `fetch.ts` — range/room/flock-aware paged fetch (1000 rows/page) through the existing browser client.
  - `pdf.ts`, `xlsx.ts`, `csv.ts` — generators driven by the same descriptor + rows.
  - `use-export.ts` — orchestration with the 4-step progress state.
- New `src/components/export/export-dialog.tsx` and `export-button.tsx` (shadcn Dialog/Select/Checkbox/Progress, existing design tokens, mobile-safe).
- New dependencies: `jspdf` + `jspdf-autotable` (paged tables), `exceljs` (real .xlsx with freeze/filter/formats), `fflate` (ZIP). All browser-side.
- `src/lib/finance-export.ts` and the Finance page's own buttons are replaced by the shared engine so there is only one export path.
- Record types covered by descriptors: egg_production, feed_usage, feed_inventory, feed_ledger, feed_formulas (+ingredients), mortality, health_records, layer batches/daily/health/weights (brooding & rearing, kept separate), broiler batches/daily/medications/vaccinations, water (from layer daily), farm_expenses, farm_revenue, prices/inventory.
- Optional (included): an `export_audit_log` table storing user, farm, export type, format, range and timestamp — metadata only, no record contents, no stored files. Recent exports are listed in Settings.

## Out of scope

No changes to how records are captured, no new record tables, no edits to existing data.
