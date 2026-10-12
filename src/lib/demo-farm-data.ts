// Synthetic, clearly-labelled sample data for the public /presentation demo.
// Generated in the browser from a fixed seed: it never touches the database,
// never contains customer records, and cannot be saved into any farm account.

export type Dated = { d: string };
export type RoomRow = { name: string; current: number; initial: number; mortality_pct: number | null };
export type ProductionPoint = Dated & { eggs: number; crates: number };
export type RoomProductionPoint = Dated & { room: string; crates: number };
export type FeedPoint = Dated & { bags: number; kg: number };
export type MortalityPoint = Dated & { loss: number };
export type FinancePoint = Dated & { revenue: number | null; feed_cost: number | null; other_expenses: number };
export type HealthRow = { date: string; name: string; scope: string; type: string };
export type ExpenseRow = { label: string; amount: number };

export type DemoData = {
  farm_name: string; farm_type: string; location: string;
  period_start: string | null; period_end: string | null; days_covered: number;
  egg_price: number | null; feed_price: number | null; bag_weight_kg: number;
  birds: number; initial_birds: number; houses: number;
  total_eggs: number; total_crates: number; total_feed_bags: number; total_feed_kg: number;
  total_mortality: number; health_records_count: number; vaccination_records_count: number;
  production_records_count: number; feed_records_count: number; mortality_records_count: number;
  total_revenue: number | null; total_feed_cost: number | null; other_expenses: number;
  gross_profit: number | null; avg_daily_feed_bags: number | null; mortality_pct: number | null;
  stock_kg: number; stock_days_remaining: number | null;
  rooms: RoomRow[]; production_daily: ProductionPoint[]; room_production: RoomProductionPoint[];
  feed_daily: FeedPoint[]; mortality_daily: MortalityPoint[]; recent_health: HealthRow[];
  expense_breakdown: ExpenseRow[]; finance_daily: FinancePoint[];
};

export const DEMO_FARM_NAME = "Sunrise Demo Layers (sample)";

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const DAYS = 120;
const END = Date.UTC(2026, 5, 30); // fixed so the demo is identical for every visitor
const EGG_PRICE_PER_CRATE = 4800;
const FEED_PRICE_PER_BAG = 13500;
const BAG_KG = 25;
const FEED_KG_PER_BIRD = 0.115;
const HOUSES = [
  { name: "House A", initial: 1800, lay: 0.84 },
  { name: "House B", initial: 1600, lay: 0.8 },
  { name: "House C", initial: 1400, lay: 0.76 },
];
const EXPENSES: ExpenseRow[] = [
  { label: "Labour", amount: 0 }, { label: "Utilities", amount: 0 },
  { label: "Packaging", amount: 0 }, { label: "Transport", amount: 0 },
];

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function buildDemoData(): DemoData {
  const rand = seeded(20260630);
  const live = HOUSES.map((h) => h.initial);
  const deaths = HOUSES.map(() => 0);
  const production: ProductionPoint[] = [];
  const roomProd: RoomProductionPoint[] = [];
  const feed: FeedPoint[] = [];
  const mortality: MortalityPoint[] = [];
  const finance: FinancePoint[] = [];
  const expenses = EXPENSES.map((e) => ({ ...e }));

  for (let i = DAYS - 1; i >= 0; i--) {
    const d = iso(END - i * 86_400_000);
    let eggs = 0, loss = 0, birds = 0;
    HOUSES.forEach((h, idx) => {
      const dead = rand() < 0.35 ? 1 + Math.floor(rand() * 2) : 0;
      live[idx] -= dead; deaths[idx] += dead; loss += dead;
      const houseEggs = Math.round(live[idx] * (h.lay + (rand() - 0.5) * 0.06));
      eggs += houseEggs; birds += live[idx];
      roomProd.push({ d, room: h.name, crates: Math.floor(houseEggs / 30) });
    });
    const crates = Math.floor(eggs / 30);
    const kg = Math.round(birds * FEED_KG_PER_BIRD);
    const bags = Math.round((kg / BAG_KG) * 10) / 10;
    let other = 0;
    if (i % 7 === 0) { other += 45000; expenses[0].amount += 45000; }
    if (i % 30 === 0) { other += 38000; expenses[1].amount += 38000; }
    if (i % 5 === 0) { other += 12000; expenses[2].amount += 12000; }
    if (i % 10 === 0) { other += 15000; expenses[3].amount += 15000; }
    production.push({ d, eggs, crates });
    feed.push({ d, bags, kg });
    mortality.push({ d, loss });
    finance.push({ d, revenue: crates * EGG_PRICE_PER_CRATE, feed_cost: Math.round(bags * FEED_PRICE_PER_BAG), other_expenses: other });
  }

  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
  const initial = sum(HOUSES, (h) => h.initial);
  const birds = sum(live, (n) => n);
  const totalMortality = initial - birds;
  const revenue = sum(finance, (r) => r.revenue ?? 0);
  const feedCost = sum(finance, (r) => r.feed_cost ?? 0);
  const other = sum(finance, (r) => r.other_expenses);
  const totalBags = Math.round(sum(feed, (r) => r.bags) * 10) / 10;
  const avgBags = Math.round((totalBags / DAYS) * 10) / 10;
  const stockKg = 2250;
  const dateAt = (back: number) => iso(END - back * 86_400_000);

  return {
    farm_name: DEMO_FARM_NAME, farm_type: "Layer Farm", location: "Sample data — not a real farm",
    period_start: production[0].d, period_end: production[production.length - 1].d, days_covered: DAYS,
    egg_price: EGG_PRICE_PER_CRATE, feed_price: FEED_PRICE_PER_BAG, bag_weight_kg: BAG_KG,
    birds, initial_birds: initial, houses: HOUSES.length,
    total_eggs: sum(production, (r) => r.eggs), total_crates: sum(production, (r) => r.crates),
    total_feed_bags: totalBags, total_feed_kg: sum(feed, (r) => r.kg), total_mortality: totalMortality,
    health_records_count: 4, vaccination_records_count: 3,
    production_records_count: DAYS, feed_records_count: DAYS, mortality_records_count: mortality.filter((m) => m.loss > 0).length,
    total_revenue: revenue, total_feed_cost: feedCost, other_expenses: other,
    gross_profit: revenue - feedCost - other, avg_daily_feed_bags: avgBags,
    mortality_pct: Math.round((totalMortality / initial) * 10000) / 100,
    stock_kg: stockKg, stock_days_remaining: Math.floor(stockKg / (avgBags * BAG_KG)),
    rooms: HOUSES.map((h, idx) => ({ name: h.name, current: live[idx], initial: h.initial, mortality_pct: Math.round((deaths[idx] / h.initial) * 10000) / 100 })),
    production_daily: production, room_production: roomProd, feed_daily: feed, mortality_daily: mortality,
    recent_health: [
      { date: dateAt(3), name: "Sample routine flock check", scope: "All houses", type: "Inspection" },
      { date: dateAt(18), name: "Sample vaccination entry", scope: "House B", type: "Vaccination" },
      { date: dateAt(41), name: "Sample vaccination entry", scope: "House A", type: "Vaccination" },
      { date: dateAt(66), name: "Sample vaccination entry", scope: "House C", type: "Vaccination" },
    ],
    expense_breakdown: expenses,
    finance_daily: finance,
  };
}
