import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES } from "@/lib/finance-catalog";
import type { ExpenseRow, RevenueRow } from "@/lib/finance-data";

export type Money = number;

export type Breakdown = { key: string; label: string; value: Money; share: number };

export type FinanceTotals = {
  revenue: Money;
  expenses: Money;
  profit: Money;
  margin: number;
  productionCost: Money;
  operatingCost: Money;
  administrativeCost: Money;
};

export type FinanceSeriesPoint = { date: string; revenue: Money; expenses: Money; profit: Money };

const DAY = 86_400_000;

export function dayKey(d: Date | string) {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00`) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftDays(days: number) {
  return dayKey(new Date(Date.now() + days * DAY));
}

export function inRange(date: string, from?: string, to?: string) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function sum(rows: { amount: number }[]) {
  return rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

export function totalsFor(
  expenses: ExpenseRow[],
  revenue: RevenueRow[],
  from?: string,
  to?: string,
): FinanceTotals {
  const e = expenses.filter((r) => inRange(r.entry_date, from, to));
  const r = revenue.filter((x) => inRange(x.entry_date, from, to));
  const byCat = (key: string) => sum(e.filter((x) => x.category === key));
  const totalRevenue = sum(r);
  const totalExpenses = sum(e);
  return {
    revenue: totalRevenue,
    expenses: totalExpenses,
    profit: totalRevenue - totalExpenses,
    margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
    productionCost: byCat("production"),
    operatingCost: byCat("operating"),
    administrativeCost: byCat("administrative"),
  };
}

function toBreakdown(map: Map<string, number>, labeller: (k: string) => string): Breakdown[] {
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return [...map.entries()]
    .map(([key, value]) => ({ key, label: labeller(key), value, share: total > 0 ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}

export function expenseBreakdown(expenses: ExpenseRow[], from?: string, to?: string) {
  const map = new Map<string, number>();
  for (const row of expenses) {
    if (!inRange(row.entry_date, from, to)) continue;
    map.set(row.category, (map.get(row.category) ?? 0) + row.amount);
  }
  return toBreakdown(map, (k) => EXPENSE_CATEGORIES.find((c) => c.key === k)?.label ?? k);
}

export function expenseSubcategoryBreakdown(expenses: ExpenseRow[], from?: string, to?: string) {
  const map = new Map<string, number>();
  for (const row of expenses) {
    if (!inRange(row.entry_date, from, to)) continue;
    map.set(row.subcategory, (map.get(row.subcategory) ?? 0) + row.amount);
  }
  return toBreakdown(map, (k) => k);
}

export function revenueBreakdown(revenue: RevenueRow[], from?: string, to?: string) {
  const map = new Map<string, number>();
  for (const row of revenue) {
    if (!inRange(row.entry_date, from, to)) continue;
    map.set(row.category, (map.get(row.category) ?? 0) + row.amount);
  }
  return toBreakdown(map, (k) => REVENUE_CATEGORIES.find((c) => c.key === k)?.label ?? k);
}

export function revenueItemBreakdown(revenue: RevenueRow[], from?: string, to?: string) {
  const map = new Map<string, number>();
  for (const row of revenue) {
    if (!inRange(row.entry_date, from, to)) continue;
    map.set(row.item, (map.get(row.item) ?? 0) + row.amount);
  }
  return toBreakdown(map, (k) => k);
}

/** Daily cash-flow series covering the last `days` days (inclusive of today). */
export function cashFlowSeries(
  expenses: ExpenseRow[],
  revenue: RevenueRow[],
  days = 30,
): FinanceSeriesPoint[] {
  const out: FinanceSeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = shiftDays(-i);
    const rev = sum(revenue.filter((r) => r.entry_date === key));
    const exp = sum(expenses.filter((r) => r.entry_date === key));
    out.push({ date: key, revenue: rev, expenses: exp, profit: rev - exp });
  }
  return out;
}

export type PeriodSummary = {
  today: FinanceTotals;
  week: FinanceTotals;
  month: FinanceTotals;
  year: FinanceTotals;
  lifetime: FinanceTotals;
};

export function periodSummary(expenses: ExpenseRow[], revenue: RevenueRow[]): PeriodSummary {
  const today = dayKey(new Date());
  return {
    today: totalsFor(expenses, revenue, today, today),
    week: totalsFor(expenses, revenue, shiftDays(-6), today),
    month: totalsFor(expenses, revenue, `${today.slice(0, 7)}-01`, today),
    year: totalsFor(expenses, revenue, `${today.slice(0, 4)}-01-01`, today),
    lifetime: totalsFor(expenses, revenue),
  };
}

export type UnitEconomics = {
  costPerEgg: number;
  costPerBird: number;
  avgDailyProfit: number;
};

export function unitEconomics(
  totals: FinanceTotals,
  opts: { eggsProduced: number; birds: number; days: number },
): UnitEconomics {
  return {
    costPerEgg: opts.eggsProduced > 0 ? totals.expenses / opts.eggsProduced : 0,
    costPerBird: opts.birds > 0 ? totals.expenses / opts.birds : 0,
    avgDailyProfit: opts.days > 0 ? totals.profit / opts.days : 0,
  };
}

export function naira(n: number) {
  const value = Number.isFinite(n) ? n : 0;
  const sign = value < 0 ? "-" : "";
  return `${sign}₦${Math.round(Math.abs(value)).toLocaleString("en-NG")}`;
}
