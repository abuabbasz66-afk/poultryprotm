import { describe, expect, it } from "vitest";
import { buildDemoData, DEMO_FARM_NAME } from "./demo-farm-data";

describe("public demo data", () => {
  const d = buildDemoData();

  it("is synthetic and clearly labelled", () => {
    expect(d.farm_name).toBe(DEMO_FARM_NAME);
    expect(JSON.stringify(d)).not.toMatch(/ABZ|Greenfield|@|\+234/i);
    expect(d.location).toMatch(/sample/i);
  });

  it("is deterministic", () => {
    expect(buildDemoData()).toEqual(d);
  });

  it("is internally consistent", () => {
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(d.birds + d.total_mortality).toBe(d.initial_birds);
    expect(sum(d.rooms.map((r) => r.current))).toBe(d.birds);
    expect(sum(d.mortality_daily.map((m) => m.loss))).toBe(d.total_mortality);
    expect(sum(d.production_daily.map((p) => p.eggs))).toBe(d.total_eggs);
    expect(d.total_eggs).toBeLessThan(d.initial_birds * d.days_covered);
    expect(d.gross_profit).toBe((d.total_revenue ?? 0) - (d.total_feed_cost ?? 0) - d.other_expenses);
    expect(sum(d.expense_breakdown.map((e) => e.amount))).toBe(d.other_expenses);
    for (const p of d.production_daily) expect(p.crates).toBe(Math.floor(p.eggs / 30));
  });
});
