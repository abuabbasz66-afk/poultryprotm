import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, ArrowDownRight, ArrowUpRight, Plus, Wallet, Receipt, TrendingUp,
  PiggyBank, FileSpreadsheet, FileText, Download, Pencil, Trash2, Filter,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/permission-denied";
import { ExpenseDialog, RevenueDialog } from "@/components/finance/finance-dialogs";
import { usePermissions } from "@/lib/rbac";
import { useEggs, useRooms } from "@/lib/farm-data";
import {
  useExpenses, useRevenue, useDeleteFinanceRow,
  type ExpenseRow, type RevenueRow,
} from "@/lib/finance-data";
import {
  cashFlowSeries, dayKey, expenseBreakdown, expenseSubcategoryBreakdown, inRange,
  naira, periodSummary, revenueBreakdown, revenueItemBreakdown, shiftDays, totalsFor,
  unitEconomics,
} from "@/lib/finance-analytics";
import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES } from "@/lib/finance-catalog";
import { exportCsv, exportExcel, exportPdf, type ExportColumn } from "@/lib/finance-export";
import { cn } from "@/lib/utils";

type Tab = "overview" | "expenses" | "revenue" | "reports";

export const Route = createFileRoute("/_authenticated/finance")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const t = search.tab;
    return t === "expenses" || t === "revenue" || t === "reports" || t === "overview" ? { tab: t } : {};
  },
  head: () => ({
    meta: [
      { title: "Farm Finance — PoultryPro" },
      { name: "description", content: "Track poultry farm expenses, revenue, profit and cash flow with automatic financial reporting." },
      { property: "og:title", content: "Farm Finance — PoultryPro" },
      { property: "og:description", content: "Record every expense and sale, then see live profit, cost per egg and cash flow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinancePage,
});

const CHART_COLORS = ["#1f7a4d", "#c9a227", "#2d9c6b", "#8a6d1f", "#4fb286", "#d9534f", "#5b6b62"];

function FinancePage() {
  const navigate = useNavigate();
  const { tab: tabParam } = Route.useSearch();
  const tab: Tab = tabParam ?? "overview";
  const setTab = (next: Tab) => navigate({ to: "/finance", search: { tab: next } });

  const { can, loading } = usePermissions();
  const canReadFinance = can("financials.read");
  const canWriteExpense = can("expenses.write") || can("financials.write");
  const canWriteRevenue = can("revenue.write") || can("sales.write") || can("financials.write");

  const expensesQ = useExpenses();
  const revenueQ = useRevenue();
  const eggs = useEggs();
  const rooms = useRooms();

  const [from, setFrom] = useState(shiftDays(-29));
  const [to, setTo] = useState(dayKey(new Date()));
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [revenueOpen, setRevenueOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [editingRevenue, setEditingRevenue] = useState<RevenueRow | null>(null);

  const expenses = expensesQ.data ?? [];
  const revenue = revenueQ.data ?? [];

  const totals = useMemo(() => totalsFor(expenses, revenue, from, to), [expenses, revenue, from, to]);
  const periods = useMemo(() => periodSummary(expenses, revenue), [expenses, revenue]);
  const series = useMemo(() => cashFlowSeries(expenses, revenue, 30), [expenses, revenue]);
  const expenseSplit = useMemo(() => expenseBreakdown(expenses, from, to), [expenses, from, to]);
  const expenseDetail = useMemo(() => expenseSubcategoryBreakdown(expenses, from, to), [expenses, from, to]);
  const revenueSplit = useMemo(() => revenueBreakdown(revenue, from, to), [revenue, from, to]);
  const revenueDetail = useMemo(() => revenueItemBreakdown(revenue, from, to), [revenue, from, to]);

  const eggsInRange = useMemo(() => (eggs.data ?? [])
    .filter((r) => inRange(r.date, from, to))
    .reduce((s, r) => s + (r.r2 + r.r3 + r.r4) * 30 + r.extra, 0), [eggs.data, from, to]);
  const birds = useMemo(() => (rooms.data ?? []).reduce((s, r) => s + r.current, 0), [rooms.data]);
  const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1);
  const econ = unitEconomics(totals, { eggsProduced: eggsInRange, birds, days });

  const filteredExpenses = useMemo(() => expenses.filter((r) => inRange(r.entry_date, from, to)), [expenses, from, to]);
  const filteredRevenue = useMemo(() => revenue.filter((r) => inRange(r.entry_date, from, to)), [revenue, from, to]);

  const delExpense = useDeleteFinanceRow("farm_expenses");
  const delRevenue = useDeleteFinanceRow("farm_revenue");

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading finance…</div>;
  if (!canReadFinance && !canWriteRevenue) {
    return <PermissionDenied hint="Financial records are available to the Farm Owner." />;
  }

  const expenseColumns: ExportColumn<ExpenseRow>[] = [
    { header: "Date", value: (r) => r.entry_date },
    { header: "Category", value: (r) => EXPENSE_CATEGORIES.find((c) => c.key === r.category)?.label ?? r.category },
    { header: "Subcategory", value: (r) => r.subcategory },
    { header: "Description", value: (r) => r.description ?? "" },
    { header: "Supplier", value: (r) => r.supplier ?? "" },
    { header: "Payment", value: (r) => r.payment_method },
    { header: "Amount (NGN)", value: (r) => r.amount },
    { header: "Recorded by", value: (r) => r.recorded_by_name ?? "" },
  ];
  const revenueColumns: ExportColumn<RevenueRow>[] = [
    { header: "Date", value: (r) => r.entry_date },
    { header: "Category", value: (r) => REVENUE_CATEGORIES.find((c) => c.key === r.category)?.label ?? r.category },
    { header: "Item", value: (r) => r.item },
    { header: "Quantity", value: (r) => r.quantity },
    { header: "Unit", value: (r) => r.unit },
    { header: "Unit price (NGN)", value: (r) => r.unit_price },
    { header: "Amount (NGN)", value: (r) => r.amount },
    { header: "Customer", value: (r) => r.customer ?? "" },
    { header: "Payment", value: (r) => r.payment_method },
  ];

  const summaryCards = [
    { label: "Total revenue", value: naira(totals.revenue) },
    { label: "Total expenses", value: naira(totals.expenses) },
    { label: "Net profit", value: naira(totals.profit) },
    { label: "Profit margin", value: `${totals.margin.toFixed(1)}%` },
  ];

  const runExport = (kind: "csv" | "excel" | "pdf", which: "expenses" | "revenue") => {
    const rows = which === "expenses" ? filteredExpenses : filteredRevenue;
    if (!rows.length) { toast.error("No records in the selected period."); return; }
    const title = which === "expenses" ? "Expense Report" : "Revenue Report";
    const filename = `poultrypro-${which}-${from}_to_${to}`;
    const columns = (which === "expenses" ? expenseColumns : revenueColumns) as ExportColumn<never>[];
    if (kind === "csv") exportCsv(rows as never[], columns, filename);
    else if (kind === "excel") exportExcel(rows as never[], columns, filename, `${title} · ${from} → ${to}`);
    else exportPdf(rows as never[], columns, `PoultryPro ${title}`, `${from} → ${to}`, summaryCards.map((c) => ({ label: c.label, value: c.value })));
  };

  return (
    <div className="min-h-screen bg-[color:var(--bg)] pb-20">
      <header className="bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--ink)] text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 pt-5 pb-6">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-xs text-primary-foreground/90 hover:bg-white/10">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <h1 className="mt-4 font-display text-2xl font-semibold sm:text-3xl">Farm Finance</h1>
          <p className="mt-1 max-w-2xl text-sm text-primary-foreground/75">
            Every naira in and out of the farm — expenses, revenue, profit and cash flow, calculated automatically.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summaryCards.map((c) => (
              <div key={c.label} className="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3 backdrop-blur">
                <div className="text-[10px] uppercase tracking-[0.14em] text-primary-foreground/60">{c.label}</div>
                <div className="mt-1 font-display text-lg font-semibold sm:text-xl">{c.value}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4">
        {/* Tabs */}
        <div className="sticky top-0 z-20 -mx-4 flex gap-1 overflow-x-auto border-b border-border bg-[color:var(--bg)]/95 px-4 py-2 backdrop-blur">
          {(["overview", "expenses", "revenue", "reports"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium capitalize transition",
                tab === t ? "bg-[color:var(--forest)] text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Filters + actions */}
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Filter className="h-3.5 w-3.5" /> Period</div>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
          <div className="ml-auto flex flex-wrap gap-2">
            {canWriteExpense && (
              <Button size="sm" variant="outline" onClick={() => { setEditingExpense(null); setExpenseOpen(true); }}>
                <Plus className="mr-1 h-4 w-4" /> Expense
              </Button>
            )}
            {canWriteRevenue && (
              <Button size="sm" onClick={() => { setEditingRevenue(null); setRevenueOpen(true); }}>
                <Plus className="mr-1 h-4 w-4" /> Revenue
              </Button>
            )}
          </div>
        </div>

        {tab === "overview" && (
          <section className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard icon={Wallet} label="Cost per egg" value={naira(econ.costPerEgg)} hint={`${eggsInRange.toLocaleString()} eggs in period`} />
              <MetricCard icon={PiggyBank} label="Cost per bird" value={naira(econ.costPerBird)} hint={`${birds.toLocaleString()} birds on farm`} />
              <MetricCard icon={TrendingUp} label="Avg daily profit" value={naira(econ.avgDailyProfit)} hint={`${days} days`} />
              <MetricCard icon={Receipt} label="Production cost share" value={`${totals.expenses > 0 ? ((totals.productionCost / totals.expenses) * 100).toFixed(1) : "0.0"}%`} hint={naira(totals.productionCost)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {([["Today", periods.today], ["This week", periods.week], ["This month", periods.month], ["This year", periods.year], ["Lifetime", periods.lifetime]] as const).map(([label, t]) => (
                <div key={label} className="rounded-2xl border border-border bg-card p-3.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
                  <div className={cn("mt-1 font-display text-lg font-semibold", t.profit >= 0 ? "text-[color:var(--forest)]" : "text-destructive")}>
                    {naira(t.profit)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3 text-emerald-600" />{naira(t.revenue)}</span>
                    <span className="inline-flex items-center gap-0.5"><ArrowDownRight className="h-3 w-3 text-destructive" />{naira(t.expenses)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="font-display text-base font-semibold">Cash flow — last 30 days</h2>
              <div className="mt-3 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} fontSize={11} />
                    <YAxis tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} fontSize={11} />
                    <Tooltip formatter={(v: number) => naira(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#1f7a4d" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#d9534f" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="profit" name="Profit" stroke="#c9a227" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <DonutCard title="Expense breakdown" data={expenseSplit} />
              <DonutCard title="Revenue breakdown" data={revenueSplit} />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <ListCard title="Top expense lines" rows={expenseDetail.slice(0, 8)} />
              <ListCard title="Top revenue lines" rows={revenueDetail.slice(0, 8)} />
            </div>
          </section>
        )}

        {tab === "expenses" && (
          <section className="mt-4 rounded-2xl border border-border bg-card">
            <TableHead
              title={`Expenses (${filteredExpenses.length})`}
              total={naira(totals.expenses)}
              onExport={(k) => runExport(k, "expenses")}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Date</th><th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Item</th><th className="px-4 py-2">Supplier</th>
                    <th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-4 py-2.5">{r.entry_date}</td>
                      <td className="px-4 py-2.5">{EXPENSE_CATEGORIES.find((c) => c.key === r.category)?.label ?? r.category}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{r.subcategory}</div>
                        {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.supplier ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{naira(r.amount)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {canWriteExpense && (
                          <div className="flex justify-end gap-1">
                            <button className="rounded-lg p-1.5 hover:bg-muted" onClick={() => { setEditingExpense(r); setExpenseOpen(true); }} aria-label="Edit expense">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" aria-label="Delete expense"
                              onClick={() => delExpense.mutate(r.id, { onSuccess: () => toast.success("Expense deleted") })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filteredExpenses.length && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No expenses recorded in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "revenue" && (
          <section className="mt-4 rounded-2xl border border-border bg-card">
            <TableHead
              title={`Revenue (${filteredRevenue.length})`}
              total={naira(totals.revenue)}
              onExport={(k) => runExport(k, "revenue")}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Date</th><th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Unit price</th>
                    <th className="px-4 py-2">Customer</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRevenue.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-4 py-2.5">{r.entry_date}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{r.item}</div>
                        <div className="text-xs text-muted-foreground">{REVENUE_CATEGORIES.find((c) => c.key === r.category)?.label ?? r.category}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right">{r.quantity} {r.unit}</td>
                      <td className="px-4 py-2.5 text-right">{naira(r.unit_price)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.customer ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{naira(r.amount)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {canWriteRevenue && (
                          <div className="flex justify-end gap-1">
                            <button className="rounded-lg p-1.5 hover:bg-muted" onClick={() => { setEditingRevenue(r); setRevenueOpen(true); }} aria-label="Edit revenue">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" aria-label="Delete revenue"
                              onClick={() => delRevenue.mutate(r.id, { onSuccess: () => toast.success("Revenue deleted") })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filteredRevenue.length && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No revenue recorded in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "reports" && (
          <section className="mt-4 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="font-display text-base font-semibold">Profit &amp; loss statement</h2>
              <p className="text-xs text-muted-foreground">{from} → {to}</p>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  <Row label="Total revenue" value={naira(totals.revenue)} strong />
                  {revenueSplit.map((r) => <Row key={r.key} label={r.label} value={naira(r.value)} indent />)}
                  <Row label="Total expenses" value={naira(totals.expenses)} strong />
                  <Row label="Production costs" value={naira(totals.productionCost)} indent />
                  <Row label="Operating expenses" value={naira(totals.operatingCost)} indent />
                  <Row label="Administrative expenses" value={naira(totals.administrativeCost)} indent />
                  <Row label="Net profit" value={naira(totals.profit)} strong />
                  <Row label="Profit margin" value={`${totals.margin.toFixed(1)}%`} />
                  <Row label="Cost per egg" value={naira(econ.costPerEgg)} />
                  <Row label="Cost per bird" value={naira(econ.costPerBird)} />
                </tbody>
              </table>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => runExport("csv", "expenses")}><Download className="mr-1 h-4 w-4" /> Expenses CSV</Button>
                <Button size="sm" variant="outline" onClick={() => runExport("excel", "expenses")}><FileSpreadsheet className="mr-1 h-4 w-4" /> Expenses Excel</Button>
                <Button size="sm" variant="outline" onClick={() => runExport("csv", "revenue")}><Download className="mr-1 h-4 w-4" /> Revenue CSV</Button>
                <Button size="sm" variant="outline" onClick={() => runExport("excel", "revenue")}><FileSpreadsheet className="mr-1 h-4 w-4" /> Revenue Excel</Button>
                <Button size="sm" onClick={() => runExport("pdf", "expenses")}><FileText className="mr-1 h-4 w-4" /> Print / PDF</Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <ListCard title="Expense categories" rows={expenseSplit} />
              <ListCard title="Revenue streams" rows={revenueSplit} />
            </div>
          </section>
        )}
      </div>

      <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} editing={editingExpense} />
      <RevenueDialog open={revenueOpen} onOpenChange={setRevenueOpen} editing={editingRevenue} />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, hint }: { icon: typeof Wallet; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function DonutCard({ title, data }: { title: string; data: { key: string; label: string; value: number }[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      {data.length ? (
        <div className="mt-2 h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {data.map((d, i) => <Cell key={d.key} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => naira(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-6 pb-6 text-center text-sm text-muted-foreground">No data for this period.</p>
      )}
    </div>
  );
}

function ListCard({ title, rows }: { title: string; rows: { key: string; label: string; value: number; share: number }[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <div className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="flex items-center justify-between text-[13px]">
              <span className="truncate">{r.label}</span>
              <span className="font-medium">{naira(r.value)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted">
              <div className="h-1.5 rounded-full bg-[color:var(--forest)]" style={{ width: `${Math.min(100, r.share)}%` }} />
            </div>
          </div>
        ))}
        {!rows.length && <p className="py-6 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>}
      </div>
    </div>
  );
}

function TableHead({ title, total, onExport }: { title: string; total: string; onExport: (k: "csv" | "excel" | "pdf") => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
      <div>
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">Period total {total}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onExport("csv")}><Download className="mr-1 h-4 w-4" /> CSV</Button>
        <Button size="sm" variant="outline" onClick={() => onExport("excel")}><FileSpreadsheet className="mr-1 h-4 w-4" /> Excel</Button>
        <Button size="sm" variant="outline" onClick={() => onExport("pdf")}><FileText className="mr-1 h-4 w-4" /> PDF</Button>
      </div>
    </div>
  );
}

function Row({ label, value, strong, indent }: { label: string; value: string; strong?: boolean; indent?: boolean }) {
  return (
    <tr className="border-b border-border/60">
      <td className={cn("py-2", indent && "pl-5 text-muted-foreground", strong && "font-semibold")}>{label}</td>
      <td className={cn("py-2 text-right", strong && "font-semibold")}>{value}</td>
    </tr>
  );
}
