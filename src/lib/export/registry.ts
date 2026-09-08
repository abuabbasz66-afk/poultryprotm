/**
 * Universal export registry.
 *
 * Every exportable record type is described once here: where the rows live,
 * which business date they are filtered by, which farm/room/flock columns they
 * carry, the permission required to read them and the exact columns that go
 * into PDF / Excel / CSV. Generators are driven purely by these descriptors so
 * a new record type is a data change, not new export code.
 */

import { toDateKey } from "@/lib/date-key";
import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES } from "@/lib/finance-catalog";
import { collectedFromRow, brokenFromRow } from "@/lib/egg-normalize";

export type ColumnType = "text" | "number" | "currency" | "date";

export type ExportColumnDef = {
  header: string;
  /** Raw value — formatting is applied by each generator. */
  value: (row: Row) => string | number | null;
  type?: ColumnType;
  width?: number;
};

export type Row = Record<string, unknown>;

export type SummaryLine = { label: string; value: string };

export type ExportDescriptor = {
  key: string;
  /** Shown in the record-type checklist and as section/sheet title. */
  label: string;
  /** Database table the rows come from. */
  table: string;
  /** Business date column (the record's own date, never created_at). */
  dateField: string;
  /** `text` dates are legacy short strings and are filtered in memory. */
  dateKind: "iso" | "text";
  /** Permission needed to read this record type. */
  permission: string;
  /** Room filter support. `name` matches the room text column. */
  roomField?: { col: string; kind: "id" | "name" };
  /** Flock / batch filter support. */
  batchField?: string;
  /** Which flock families this record belongs to (drives the flock list). */
  flockKind?: "layer" | "broiler";
  columns: ExportColumnDef[];
  /** File / sheet friendly name. */
  fileName: string;
  summary?: (rows: Row[]) => SummaryLine[];
};

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};
const s = (v: unknown) => (v == null ? "" : String(v));
const sum = (rows: Row[], f: (r: Row) => number) => rows.reduce((a, r) => a + f(r), 0);
const money = (v: number) =>
  `NGN ${Math.round(v).toLocaleString("en-NG")}`;

const expenseCategory = (v: unknown) =>
  EXPENSE_CATEGORIES.find((c) => c.key === s(v))?.label ?? s(v);
const revenueCategory = (v: unknown) =>
  REVENUE_CATEGORIES.find((c) => c.key === s(v))?.label ?? s(v);
const avg = (rows: Row[], f: (r: Row) => number) => (rows.length ? sum(rows, f) / rows.length : 0);

/** Normalised business date of a row for a descriptor (YYYY-MM-DD or null). */
export function rowDateKey(desc: ExportDescriptor, row: Row): string | null {
  return toDateKey(s(row[desc.dateField]));
}

export const EXPORT_DESCRIPTORS: ExportDescriptor[] = [
  {
    key: "production",
    label: "Production",
    table: "egg_production",
    dateField: "date",
    dateKind: "text",
    permission: "production.read",
    fileName: "production",
    columns: [
      { header: "Date", value: (r) => toDateKey(s(r.date)) ?? s(r.date), type: "date" },
      { header: "Label", value: (r) => s(r.label) },
      { header: "Room 2 (crates)", value: (r) => n(r.r2), type: "number" },
      { header: "Room 3 (crates)", value: (r) => n(r.r3), type: "number" },
      { header: "Room 4 (crates)", value: (r) => n(r.r4), type: "number" },
      { header: "Extra eggs", value: (r) => n(r.extra), type: "number" },
      { header: "Broken eggs", value: (r) => brokenFromRow(r as never), type: "number" },
      {
        header: "Total eggs",
        value: (r) => collectedFromRow(r as never),
        type: "number",
      },
    ],
    summary: (rows) => [
      { label: "Production days", value: String(rows.length) },
      { label: "Total eggs collected", value: sum(rows, (r) => collectedFromRow(r as never)).toLocaleString() },
      { label: "Broken eggs", value: sum(rows, (r) => brokenFromRow(r as never)).toLocaleString() },
      {
        label: "Crates (30 eggs)",
        value: Math.floor(sum(rows, (r) => collectedFromRow(r as never)) / 30).toLocaleString(),
      },
    ],
  },
  {
    key: "feed",
    label: "Feed usage",
    table: "feed_usage",
    dateField: "date",
    dateKind: "text",
    permission: "feed.read",
    roomField: { col: "room", kind: "name" },
    fileName: "feed",
    columns: [
      { header: "Date", value: (r) => toDateKey(s(r.date)) ?? s(r.date), type: "date" },
      { header: "Room", value: (r) => s(r.room) },
      { header: "Bags used", value: (r) => n(r.bags), type: "number" },
    ],
    summary: (rows) => [
      { label: "Usage entries", value: String(rows.length) },
      { label: "Total bags used", value: sum(rows, (r) => n(r.bags)).toLocaleString() },
    ],
  },
  {
    key: "feed_inventory",
    label: "Feed inventory",
    table: "feed_inventory",
    dateField: "purchase_date",
    dateKind: "iso",
    permission: "feed.read",
    fileName: "feed_inventory",
    columns: [
      { header: "Purchase date", value: (r) => s(r.purchase_date), type: "date" },
      { header: "Feed type", value: (r) => s(r.feed_type) },
      { header: "Source", value: (r) => s(r.source) },
      { header: "Supplier", value: (r) => s(r.supplier) },
      { header: "Batch number", value: (r) => s(r.batch_number) },
      { header: "Bags", value: (r) => n(r.bags), type: "number" },
      { header: "Bag size (kg)", value: (r) => n(r.bag_size_kg), type: "number" },
      { header: "Initial (kg)", value: (r) => n(r.initial_kg), type: "number" },
      { header: "Remaining (kg)", value: (r) => n(r.remaining_kg), type: "number" },
      { header: "Cost per kg", value: (r) => n(r.unit_cost_per_kg), type: "currency" },
      { header: "Total cost", value: (r) => n(r.total_cost), type: "currency" },
      { header: "Expiry", value: (r) => s(r.expiry_date), type: "date" },
      { header: "Note", value: (r) => s(r.note) },
    ],
    summary: (rows) => [
      { label: "Purchase lots", value: String(rows.length) },
      { label: "Feed purchased (kg)", value: sum(rows, (r) => n(r.initial_kg)).toLocaleString() },
      { label: "Feed remaining (kg)", value: sum(rows, (r) => n(r.remaining_kg)).toLocaleString() },
      { label: "Feed cost", value: money(sum(rows, (r) => n(r.total_cost))) },
    ],
  },
  {
    key: "feed_ledger",
    label: "Feed ledger",
    table: "feed_ledger",
    dateField: "entry_date",
    dateKind: "iso",
    permission: "feed.read",
    fileName: "feed_ledger",
    columns: [
      { header: "Date", value: (r) => s(r.entry_date), type: "date" },
      { header: "Transaction", value: (r) => s(r.action) },
      { header: "Quantity (kg)", value: (r) => n(r.quantity_kg), type: "number" },
      { header: "Balance after (kg)", value: (r) => n(r.balance_after_kg), type: "number" },
      { header: "Note", value: (r) => s(r.note) },
    ],
  },
  {
    key: "feed_formulation",
    label: "Feed formulations",
    table: "feed_formulas",
    dateField: "created_at",
    dateKind: "iso",
    permission: "formulas.read",
    fileName: "feed_formulations",
    columns: [
      { header: "Created", value: (r) => s(r.created_at), type: "date" },
      { header: "Formula", value: (r) => s(r.name) },
      { header: "Active", value: (r) => (r.is_active ? "Yes" : "No") },
      { header: "Bag weight (kg)", value: (r) => n(r.bag_weight_kg), type: "number" },
      { header: "Notes", value: (r) => s(r.notes) },
    ],
  },
  {
    key: "mortality",
    label: "Mortality",
    table: "mortality",
    dateField: "date",
    dateKind: "text",
    permission: "mortality.read",
    roomField: { col: "room", kind: "name" },
    fileName: "mortality",
    columns: [
      { header: "Date", value: (r) => toDateKey(s(r.date)) ?? s(r.date), type: "date" },
      { header: "Room", value: (r) => s(r.room) },
      { header: "Cause", value: (r) => s(r.cause) },
      { header: "Birds lost", value: (r) => n(r.loss), type: "number" },
    ],
    summary: (rows) => [
      { label: "Mortality entries", value: String(rows.length) },
      { label: "Total birds lost", value: sum(rows, (r) => n(r.loss)).toLocaleString() },
    ],
  },
  {
    key: "health",
    label: "Health",
    table: "health_records",
    dateField: "date",
    dateKind: "text",
    permission: "health.read",
    fileName: "health",
    columns: [
      { header: "Date", value: (r) => toDateKey(s(r.date)) ?? s(r.date), type: "date" },
      { header: "Item", value: (r) => s(r.name) },
      { header: "Type", value: (r) => s(r.type) },
      { header: "Applied to", value: (r) => s(r.scope) },
    ],
  },
  {
    key: "medication",
    label: "Medication",
    table: "broiler_medications",
    dateField: "start_date",
    dateKind: "iso",
    permission: "health.read",
    batchField: "batch_id",
    flockKind: "broiler",
    fileName: "medication",
    columns: [
      { header: "Start date", value: (r) => s(r.start_date), type: "date" },
      { header: "End date", value: (r) => s(r.end_date), type: "date" },
      { header: "Drug", value: (r) => s(r.drug_name) },
      { header: "Dosage", value: (r) => s(r.dosage) },
      { header: "Purpose", value: (r) => s(r.purpose) },
      { header: "Recorded by", value: (r) => s(r.recorded_by_name) },
      { header: "Notes", value: (r) => s(r.notes) },
    ],
  },
  {
    key: "vaccination",
    label: "Vaccination",
    table: "broiler_vaccinations",
    dateField: "date_given",
    dateKind: "iso",
    permission: "health.read",
    batchField: "batch_id",
    flockKind: "broiler",
    fileName: "vaccination",
    columns: [
      { header: "Date given", value: (r) => s(r.date_given), type: "date" },
      { header: "Vaccine", value: (r) => s(r.vaccine_name) },
      { header: "Age (days)", value: (r) => n(r.age_days), type: "number" },
      { header: "Administered by", value: (r) => s(r.administered_by) },
      { header: "Recorded by", value: (r) => s(r.recorded_by_name) },
      { header: "Notes", value: (r) => s(r.notes) },
    ],
  },
  {
    key: "brooding",
    label: "Brooding",
    table: "layer_batches",
    dateField: "placement_date",
    dateKind: "iso",
    permission: "rooms.read",
    roomField: { col: "room_id", kind: "id" },
    flockKind: "layer",
    fileName: "brooding",
    columns: [
      { header: "Placement date", value: (r) => s(r.placement_date), type: "date" },
      { header: "Batch", value: (r) => s(r.name) },
      { header: "Bird type", value: (r) => s(r.bird_type) },
      { header: "Breed", value: (r) => s(r.breed) },
      { header: "Room", value: (r) => s(r.room) },
      { header: "Chicks placed", value: (r) => n(r.birds_placed), type: "number" },
      { header: "Current birds", value: (r) => n(r.current_birds), type: "number" },
      { header: "Start age (days)", value: (r) => n(r.start_age_days), type: "number" },
      { header: "Source", value: (r) => s(r.source) },
      { header: "Status", value: (r) => s(r.status) },
      { header: "Notes", value: (r) => s(r.notes) },
    ],
    summary: (rows) => [
      { label: "Brooding batches", value: String(rows.length) },
      { label: "Total chicks placed", value: sum(rows, (r) => n(r.birds_placed)).toLocaleString() },
      { label: "Birds currently alive", value: sum(rows, (r) => n(r.current_birds)).toLocaleString() },
      {
        label: "Total losses",
        value: Math.max(
          0,
          sum(rows, (r) => n(r.birds_placed)) - sum(rows, (r) => n(r.current_birds)),
        ).toLocaleString(),
      },
    ],
  },
  {
    key: "rearing",
    label: "Rearing (daily records)",
    table: "layer_batch_daily",
    dateField: "entry_date",
    dateKind: "iso",
    permission: "rooms.read",
    batchField: "batch_id",
    flockKind: "layer",
    fileName: "rearing",
    columns: [
      { header: "Date", value: (r) => s(r.entry_date), type: "date" },
      { header: "Birds", value: (r) => n(r.birds_count), type: "number" },
      { header: "Deaths", value: (r) => n(r.deaths), type: "number" },
      { header: "Death reason", value: (r) => s(r.death_reason) },
      { header: "Feed (kg)", value: (r) => n(r.feed_kg), type: "number" },
      { header: "Feed type", value: (r) => s(r.feed_type) },
      { header: "Feed cost", value: (r) => n(r.feed_cost), type: "currency" },
      { header: "Water (litres)", value: (r) => n(r.water_litres), type: "number" },
      { header: "Avg weight (g)", value: (r) => n(r.avg_weight_g), type: "number" },
      { header: "Temperature (°C)", value: (r) => n(r.temperature_c), type: "number" },
      { header: "Observation", value: (r) => s(r.observation) },
      { header: "Recorded by", value: (r) => s(r.recorded_by_name) },
    ],
    summary: (rows) => [
      { label: "Daily records", value: String(rows.length) },
      { label: "Total deaths", value: sum(rows, (r) => n(r.deaths)).toLocaleString() },
      { label: "Feed used (kg)", value: sum(rows, (r) => n(r.feed_kg)).toLocaleString() },
      { label: "Average temperature (°C)", value: avg(rows, (r) => n(r.temperature_c)).toFixed(1) },
    ],
  },
  {
    key: "water",
    label: "Water",
    table: "layer_batch_daily",
    dateField: "entry_date",
    dateKind: "iso",
    permission: "rooms.read",
    batchField: "batch_id",
    flockKind: "layer",
    fileName: "water",
    columns: [
      { header: "Date", value: (r) => s(r.entry_date), type: "date" },
      { header: "Birds", value: (r) => n(r.birds_count), type: "number" },
      { header: "Water (litres)", value: (r) => n(r.water_litres), type: "number" },
      {
        header: "Litres per bird",
        value: (r) => (n(r.birds_count) ? +(n(r.water_litres) / n(r.birds_count)).toFixed(3) : 0),
        type: "number",
      },
    ],
    summary: (rows) => [
      { label: "Water records", value: String(rows.length) },
      { label: "Total water (litres)", value: sum(rows, (r) => n(r.water_litres)).toLocaleString() },
    ],
  },
  {
    key: "finance_expenses",
    label: "Finance — expenses",
    table: "farm_expenses",
    dateField: "entry_date",
    dateKind: "iso",
    permission: "financials.read",
    fileName: "finance_expenses",
    columns: [
      { header: "Date", value: (r) => s(r.entry_date), type: "date" },
      { header: "Category", value: (r) => expenseCategory(r.category) },
      { header: "Subcategory", value: (r) => s(r.subcategory) },
      { header: "Description", value: (r) => s(r.description) },
      { header: "Amount", value: (r) => n(r.amount), type: "currency" },
      { header: "Payment method", value: (r) => s(r.payment_method) },
      { header: "Supplier", value: (r) => s(r.supplier) },
      { header: "Recorded by", value: (r) => s(r.recorded_by_name) },
      { header: "Notes", value: (r) => s(r.notes) },
    ],
    summary: (rows) => [
      { label: "Expense entries", value: String(rows.length) },
      { label: "Total expenses", value: money(sum(rows, (r) => n(r.amount))) },
    ],
  },
  {
    key: "finance_revenue",
    label: "Finance — revenue",
    table: "farm_revenue",
    dateField: "entry_date",
    dateKind: "iso",
    permission: "financials.read",
    fileName: "finance_revenue",
    columns: [
      { header: "Date", value: (r) => s(r.entry_date), type: "date" },
      { header: "Category", value: (r) => revenueCategory(r.category) },
      { header: "Item", value: (r) => s(r.item) },
      { header: "Quantity", value: (r) => n(r.quantity), type: "number" },
      { header: "Unit", value: (r) => s(r.unit) },
      { header: "Unit price", value: (r) => n(r.unit_price), type: "currency" },
      { header: "Amount", value: (r) => n(r.amount), type: "currency" },
      { header: "Customer", value: (r) => s(r.customer) },
      { header: "Payment method", value: (r) => s(r.payment_method) },
      { header: "Recorded by", value: (r) => s(r.recorded_by_name) },
      { header: "Notes", value: (r) => s(r.notes) },
    ],
    summary: (rows) => [
      { label: "Revenue entries", value: String(rows.length) },
      { label: "Total revenue", value: money(sum(rows, (r) => n(r.amount))) },
    ],
  },
  {
    key: "broiler_batches",
    label: "Broiler batches",
    table: "broiler_batches",
    dateField: "date_placed",
    dateKind: "iso",
    permission: "rooms.read",
    flockKind: "broiler",
    fileName: "broiler_batches",
    columns: [
      { header: "Date placed", value: (r) => s(r.date_placed), type: "date" },
      { header: "Batch", value: (r) => s(r.name) },
      { header: "Breed", value: (r) => s(r.breed) },
      { header: "House", value: (r) => s(r.house) },
      { header: "Birds placed", value: (r) => n(r.birds_placed), type: "number" },
      { header: "Current birds", value: (r) => n(r.current_birds), type: "number" },
      { header: "Chick unit cost", value: (r) => n(r.chick_unit_cost), type: "currency" },
      { header: "Target weight (kg)", value: (r) => n(r.target_weight_kg), type: "number" },
      { header: "Status", value: (r) => s(r.status) },
      { header: "Notes", value: (r) => s(r.notes) },
    ],
  },
  {
    key: "broiler_daily",
    label: "Broiler daily records",
    table: "broiler_daily",
    dateField: "entry_date",
    dateKind: "iso",
    permission: "production.read",
    batchField: "batch_id",
    flockKind: "broiler",
    fileName: "broiler_daily",
    columns: [
      { header: "Date", value: (r) => s(r.entry_date), type: "date" },
      { header: "Deaths", value: (r) => n(r.deaths), type: "number" },
      { header: "Feed (kg)", value: (r) => n(r.feed_kg), type: "number" },
      { header: "Avg weight (g)", value: (r) => n(r.avg_weight_g), type: "number" },
      { header: "Water (litres)", value: (r) => n(r.water_litres), type: "number" },
      { header: "Recorded by", value: (r) => s(r.recorded_by_name) },
      { header: "Notes", value: (r) => s(r.notes) },
    ],
  },
  {
    key: "broiler_sales",
    label: "Broiler sales",
    table: "broiler_sales",
    dateField: "entry_date",
    dateKind: "iso",
    permission: "sales.read",
    batchField: "batch_id",
    flockKind: "broiler",
    fileName: "broiler_sales",
    columns: [
      { header: "Date", value: (r) => s(r.entry_date), type: "date" },
      { header: "Birds", value: (r) => n(r.birds), type: "number" },
      { header: "Total weight (kg)", value: (r) => n(r.total_weight_kg), type: "number" },
      { header: "Price per kg", value: (r) => n(r.price_per_kg), type: "currency" },
      { header: "Amount", value: (r) => n(r.amount), type: "currency" },
      { header: "Customer", value: (r) => s(r.customer) },
      { header: "Payment method", value: (r) => s(r.payment_method) },
    ],
    summary: (rows) => [
      { label: "Sales entries", value: String(rows.length) },
      { label: "Birds sold", value: sum(rows, (r) => n(r.birds)).toLocaleString() },
      { label: "Sales value", value: money(sum(rows, (r) => n(r.amount))) },
    ],
  },
  {
    key: "inventory",
    label: "Inventory & prices",
    table: "prices",
    dateField: "effective_from",
    dateKind: "iso",
    permission: "prices.read",
    fileName: "inventory",
    columns: [
      { header: "Effective from", value: (r) => s(r.effective_from), type: "date" },
      { header: "Item", value: (r) => s(r.item) },
      { header: "Category", value: (r) => s(r.category) },
      { header: "Unit", value: (r) => s(r.unit) },
      { header: "Price", value: (r) => n(r.price), type: "currency" },
      { header: "Note", value: (r) => s(r.note) },
    ],
  },
];

export const DESCRIPTOR_BY_KEY: Record<string, ExportDescriptor> = Object.fromEntries(
  EXPORT_DESCRIPTORS.map((d) => [d.key, d]),
);

/** Record types offered on each page's "Current section" export. */
export const SECTION_PRESETS: Record<string, { label: string; keys: string[] }> = {
  production: { label: "Production Records", keys: ["production"] },
  records: {
    label: "Farm Records",
    keys: ["production", "feed", "mortality", "health"],
  },
  feed: {
    label: "Feed Records",
    keys: ["feed", "feed_inventory", "feed_ledger", "feed_formulation"],
  },
  mortality: { label: "Mortality Records", keys: ["mortality"] },
  health: { label: "Health Records", keys: ["health"] },
  brooding: { label: "Brooding Records", keys: ["brooding"] },
  rearing: { label: "Rearing Records", keys: ["rearing", "water"] },
  broilers: {
    label: "Broiler Records",
    keys: ["broiler_batches", "broiler_daily", "medication", "vaccination", "broiler_sales"],
  },
  finance: {
    label: "Financial Records",
    keys: ["finance_expenses", "finance_revenue"],
  },
  inventory: { label: "Inventory Records", keys: ["inventory"] },
};
