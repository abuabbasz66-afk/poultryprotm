// Regression tests for money and production figures. Every expected value is
// worked out by hand in the comment beside it, not copied from the code.
import { describe, expect, it } from "vitest";
import type { EggRow, Mortality, Room } from "@/lib/farm-data";
import { computeDailyProduction, roomBirdsOn, fmtPct } from "@/lib/production-percent";
import { computeDailyMortality } from "@/lib/mortality-percent";
import { computePeriodMetrics, computeBirdPopulation, feedPricePerKg } from "@/lib/farm-analytics";
import { totalsFor, unitEconomics } from "@/lib/finance-analytics";
import { normaliseEggs, totalEggsFromRow } from "@/lib/egg-normalize";
import {
  feedCostPerCrate,
  checkEggRecord,
  checkMortalityRecord,
  birdBalance,
} from "@/lib/record-validation";
import type { ExpenseRow, RevenueRow } from "@/lib/finance-data";

const room = (name: string, current: number, initial = current): Room => ({
  id: name,
  name,
  current,
  initial,
});
const egg = (date: string, p: Partial<EggRow>): EggRow => ({
  id: date,
  date,
  label: date,
  r2: 0,
  r3: 0,
  r4: 0,
  extra: 0,
  ...p,
});
const mort = (date: string, room: string, loss: number): Mortality => ({
  id: `${date}${room}${loss}`,
  date,
  room,
  loss,
  cause: "",
});
const exp = (entry_date: string, amount: number, category = "operating") =>
  ({ entry_date, amount, category, subcategory: "x" }) as unknown as ExpenseRow;
const rev = (entry_date: string, amount: number) =>
  ({ entry_date, amount, category: "eggs", item: "eggs" }) as unknown as RevenueRow;

describe("egg totals", () => {
  it("counts crates × 30 + loose − broken", () => {
    // (10+5+0)×30 = 450, +7 loose = 457, −12 broken = 445
    expect(totalEggsFromRow(egg("2026-01-01", { r2: 10, r3: 5, extra: 7, broken_r2: 12 }))).toBe(
      445,
    );
  });
  it("never goes negative when broken exceeds collected", () => {
    expect(totalEggsFromRow(egg("2026-01-01", { extra: 3, broken_extra: 10 }))).toBe(0);
  });
  it("rolls 65 loose eggs into 2 crates + 5", () => {
    expect(normaliseEggs(1, 65)).toEqual({ crates: 3, extra: 5, totalEggs: 95 });
  });
  it("treats invalid input as zero", () => {
    expect(normaliseEggs(Number.NaN, -4)).toEqual({ crates: 0, extra: 0, totalEggs: 0 });
  });
});

describe("egg-laying percentage", () => {
  const rooms = [room("ROOM 2", 1000), room("ROOM 3", 500)];
  it("uses birds present on the production date", () => {
    // Room 2 now 1000, 20 died after 1 Mar → 1020 birds on 1 Mar
    expect(roomBirdsOn(rooms[0], "2026-03-01", [mort("2026-03-05", "ROOM 2", 20)])).toBe(1020);
    // a death on the same day is already reflected in today's count → not added back
    expect(roomBirdsOn(rooms[0], "2026-03-05", [mort("2026-03-05", "ROOM 2", 20)])).toBe(1000);
  });
  it("calculates room and farm lay %", () => {
    // Room 2: 25 crates = 750 eggs, +6 loose for the room, −6 broken = 750 / 1000 = 75%
    // Room 3: 12 crates = 360 eggs / 500 = 72%
    // Farm: 1110 eggs / 1500 birds = 74%
    const d = computeDailyProduction(
      egg("2026-03-01", { r2: 25, r3: 12, extra: 6, extra_r2: 6, broken_r2: 6 }),
      rooms,
      [],
    );
    expect(d.rooms[0].eggs).toBe(750);
    expect(d.rooms[0].pct).toBeCloseTo(75, 6);
    expect(d.rooms[1].pct).toBeCloseTo(72, 6);
    expect(d.totalEggs).toBe(1110);
    expect(d.overallPct).toBeCloseTo(74, 6);
    // room eggs must add up to the farm total
    expect(d.rooms.reduce((s, r) => s + r.eggs, 0)).toBe(d.totalEggs);
  });
  it("reports N/A instead of dividing by zero birds", () => {
    const d = computeDailyProduction(egg("2026-03-01", { r2: 5 }), [room("ROOM 2", 0)], []);
    expect(d.rooms[0].pct).toBeNull();
    expect(d.overallPct).toBeNull();
    expect(fmtPct(null)).toBe("N/A");
  });
  it("gives 0% for zero eggs", () => {
    expect(computeDailyProduction(egg("2026-03-01", {}), rooms, []).overallPct).toBe(0);
  });
});

describe("mortality percentage", () => {
  it("divides deaths by birds at the start of the day", () => {
    // Room 2 now 980 after 20 deaths on 2 Mar → 980 birds counted on 2 Mar (same-day loss not added back)
    // 20 / 980 = 2.0408%
    const [d] = computeDailyMortality(
      [mort("2026-03-02", "ROOM 2", 20)],
      [room("ROOM 2", 980, 1000)],
    );
    expect(d.total).toBe(20);
    expect(d.overallPct).toBeCloseTo((20 / 980) * 100, 6);
  });
  it("period mortality % uses initial birds and treats negative entries as losses", () => {
    // 15 + 5 = 20 losses / 2000 initial = 1%
    const m = computePeriodMetrics({
      range: { start: "2026-03-01", end: "2026-03-31", label: "", preset: "custom" } as never,
      eggs: [],
      feed: [],
      health: [],
      mortality: [
        mort("2026-03-02", "ROOM 2", 15),
        mort("2026-03-03", "ROOM 2", -5),
        mort("2026-04-01", "ROOM 2", 99),
      ],
      eggPrice: 0,
      costPerKg: 0,
      bagWeightKg: 25,
      initialBirds: 2000,
    });
    expect(m.mortalityCount).toBe(20);
    expect(m.mortalityPct).toBeCloseTo(1, 6);
  });
  it("no initial birds → N/A", () => {
    const m = computePeriodMetrics({
      range: { start: "2026-03-01", end: "2026-03-31", label: "", preset: "custom" } as never,
      eggs: [],
      feed: [],
      health: [],
      mortality: [mort("2026-03-02", "R", 1)],
      eggPrice: 0,
      costPerKg: 0,
      bagWeightKg: 25,
      initialBirds: 0,
    });
    expect(m.mortalityPct).toBeNull();
  });
});

describe("revenue, feed cost and profit over a period", () => {
  it("values eggs and feed within the date range", () => {
    // Eggs: 100 crates (3000 eggs) on 1 Mar + 50 crates on 2 Mar = 4500 eggs = 150 crates
    // Revenue: 150 × ₦4,000 = ₦600,000
    // Feed: 10 + 8 bags = 18 bags × 25 kg = 450 kg × (₦12,500 / 25 = ₦500/kg) = ₦225,000
    // Feed margin: 600,000 − 225,000 = ₦375,000. Out-of-range 1 Apr row ignored.
    const m = computePeriodMetrics({
      range: { start: "2026-03-01", end: "2026-03-31", label: "", preset: "custom" } as never,
      eggs: [
        egg("2026-03-01", { r2: 100 }),
        egg("2026-03-02", { r3: 50 }),
        egg("2026-04-01", { r2: 999 }),
      ],
      feed: [
        { id: "a", date: "2026-03-01", bags: 10, room: "ROOM 2" },
        { id: "b", date: "2026-03-02", bags: 8, room: "ROOM 3" },
      ] as never,
      mortality: [],
      health: [],
      eggPrice: 4000,
      costPerKg: 500,
      bagWeightKg: 25,
      initialBirds: 0,
    });
    expect(m.eggs).toBe(4500);
    expect(m.crates).toBe(150);
    expect(m.revenue).toBe(600_000);
    expect(m.feedKg).toBe(450);
    expect(m.feedCost).toBe(225_000);
    expect(m.profit).toBe(375_000);
  });
  it("uses the price active on each record's date", () => {
    // 10 crates at ₦3,000 + 10 crates at ₦3,500 = ₦65,000
    const m = computePeriodMetrics({
      range: { start: "2026-03-01", end: "2026-03-31", label: "", preset: "custom" } as never,
      eggs: [egg("2026-03-01", { r2: 10 }), egg("2026-03-20", { r2: 10 })],
      feed: [],
      mortality: [],
      health: [],
      eggPrice: 0,
      costPerKg: 0,
      bagWeightKg: 25,
      initialBirds: 0,
      eggPriceOn: (d) => (d && d >= "2026-03-15" ? 3500 : 3000),
    });
    expect(m.revenue).toBe(65_000);
  });
  it("feed price per kg follows the farm's bag size", () => {
    const prices = [{ item: "Layer feed", price: 20_000 }] as never;
    expect(feedPricePerKg(prices, 50)).toBe(400);
    expect(feedPricePerKg(prices, 0)).toBe(800); // invalid size falls back to 25 kg
    expect(feedPricePerKg([], 25)).toBe(0); // unpriced → 0, never a guess
  });
});

describe("recorded revenue and expenses (operating profit)", () => {
  const expenses = [
    exp("2026-03-02", 40_000, "production"),
    exp("2026-03-03", 10_000),
    exp("2026-04-01", 5_000),
  ];
  const revenue = [rev("2026-03-02", 100_000), rev("2026-02-28", 1_000)];
  it("profit = recorded revenue − recorded expenses for the period", () => {
    // March: revenue 100,000; expenses 40,000 + 10,000 = 50,000; profit 50,000; margin 50%
    const t = totalsFor(expenses, revenue, "2026-03-01", "2026-03-31");
    expect(t).toMatchObject({
      revenue: 100_000,
      expenses: 50_000,
      profit: 50_000,
      productionCost: 40_000,
      operatingCost: 10_000,
    });
    expect(t.margin).toBeCloseTo(50, 6);
  });
  it("no revenue → 0% margin, negative profit", () => {
    const t = totalsFor(expenses, [], "2026-03-01", "2026-03-31");
    expect(t.profit).toBe(-50_000);
    expect(t.margin).toBe(0);
  });
  it("unit economics avoid dividing by zero", () => {
    const t = totalsFor(expenses, revenue, "2026-03-01", "2026-03-31");
    // 50,000 / 10,000 eggs = ₦5 per egg; / 500 birds = ₦100 per bird; 50,000 profit / 31 days
    expect(unitEconomics(t, { eggsProduced: 10_000, birds: 500, days: 31 })).toEqual({
      costPerEgg: 5,
      costPerBird: 100,
      avgDailyProfit: 50_000 / 31,
    });
    expect(unitEconomics(t, { eggsProduced: 0, birds: 0, days: 0 })).toEqual({
      costPerEgg: 0,
      costPerBird: 0,
      avgDailyProfit: 0,
    });
  });
});

describe("feed cost per crate", () => {
  it("is (kg per egg × 30) × cost per kg", () => {
    // 450 kg for 4,500 eggs = 0.1 kg/egg = 3 kg per crate × ₦500 = ₦1,500
    expect(feedCostPerCrate(450, 4500, 500)).toBeCloseTo(1500, 6);
  });
  it("is unknown with zero eggs or no price", () => {
    expect(feedCostPerCrate(450, 0, 500)).toBeNull();
    expect(feedCostPerCrate(450, 4500, 0)).toBeNull();
    expect(feedCostPerCrate(-1, 4500, 500)).toBeNull();
    expect(feedCostPerCrate(Number.NaN, 4500, 500)).toBeNull();
  });
});

describe("bird balance", () => {
  it("sums live birds and losses across rooms", () => {
    const p = computeBirdPopulation(
      [room("ROOM 2", 980, 1000), room("ROOM 3", 495, 500)],
      [mort("d", "ROOM 2", 20), mort("d", "ROOM 3", -5)],
    );
    expect(p).toMatchObject({
      totalLiveBirds: 1475,
      initialBirds: 1500,
      totalMortalityAllTime: 25,
    });
    // 1500 − 25 = 1475: records agree
    expect(birdBalance(p.initialBirds, p.totalMortalityAllTime)).toBe(p.totalLiveBirds);
  });
  it("shows a negative balance instead of hiding it", () => {
    expect(birdBalance(100, 120)).toBe(-20);
    expect(birdBalance(100, 10, 50, 40)).toBe(100);
  });
});

describe("record warnings", () => {
  it("warns when eggs exceed birds but still allows saving", () => {
    const w = checkEggRecord([{ name: "ROOM 2", collectedEggs: 1200, brokenEggs: 0, birds: 1000 }]);
    expect(w).toHaveLength(1);
    expect(w[0].level).toBe("warning");
    expect(w[0].message).toMatch(/more than one day/);
  });
  it("accepts normal production quietly", () => {
    expect(
      checkEggRecord([{ name: "ROOM 2", collectedEggs: 900, brokenEggs: 3, birds: 1000 }]),
    ).toEqual([]);
    expect(
      checkEggRecord([{ name: "ROOM 2", collectedEggs: 1000, brokenEggs: 0, birds: 1000 }]),
    ).toEqual([]);
  });
  it("warns about eggs from an empty room, ignores unknown populations", () => {
    expect(
      checkEggRecord([{ name: "ROOM 4", collectedEggs: 30, brokenEggs: 0, birds: 0 }])[0].level,
    ).toBe("warning");
    expect(
      checkEggRecord([{ name: "ROOM 4", collectedEggs: 30, brokenEggs: 0, birds: null }]),
    ).toEqual([]);
  });
  it("blocks negative or fractional numbers", () => {
    expect(
      checkEggRecord([{ name: "R", collectedEggs: -1, brokenEggs: 0, birds: 10 }])[0].level,
    ).toBe("error");
    expect(
      checkEggRecord([{ name: "R", collectedEggs: 1.5, brokenEggs: 0, birds: 10 }])[0].level,
    ).toBe("error");
  });
  it("mortality above the birds present warns of a negative balance", () => {
    const w = checkMortalityRecord({ room: "ROOM 2", loss: 60, birdsAtRisk: 50 });
    expect(w[0].level).toBe("warning");
    expect(w[0].message).toMatch(/negative bird balance/);
  });
  it("large single-entry mortality asks for a double-check", () => {
    expect(
      checkMortalityRecord({ room: "ROOM 2", loss: 60, birdsAtRisk: 1000 })[0].message,
    ).toMatch(/6\.0%/);
    expect(checkMortalityRecord({ room: "ROOM 2", loss: 50, birdsAtRisk: 1000 })).toEqual([]);
    expect(checkMortalityRecord({ room: "ROOM 2", loss: 0, birdsAtRisk: 1000 })[0].level).toBe(
      "error",
    );
  });
});
