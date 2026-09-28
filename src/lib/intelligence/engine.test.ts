import { describe, expect, it } from "vitest";
import { generateFarmIntelligence, shiftKey, type IntelInput } from "./engine";
import type { EggRow, Room } from "@/lib/farm-data";

const TODAY = "2026-09-27";
const room = (n: number, current = 1000): Room =>
  ({
    id: `r${n}`,
    name: `Room ${n}`,
    current,
    initial: current,
    status: "active",
    bird_type: "Layer",
  }) as Room;

/** crates per room for r2/r3/r4 */
function egg(date: string, r2: number, r3: number, r4: number): EggRow {
  return { id: date, date, label: date, r2, r3, r4, extra: 0 };
}

function base(over: Partial<IntelInput> = {}): IntelInput {
  const eggs: EggRow[] = [];
  for (let d = 10; d >= 0; d--) eggs.push(egg(shiftKey(TODAY, -d), 30, 30, 30)); // 90% each room
  return {
    todayKey: TODAY,
    hour: 10,
    rooms: [room(2), room(3), room(4)],
    eggs,
    mortality: [],
    health: [],
    expenses: [],
    revenue: [],
    feed: Array.from({ length: 8 }, (_, i) => ({
      id: `f${i}`,
      room: "Room 2",
      bags: 20,
      date: shiftKey(TODAY, -i),
    })),
    stock: null,
    weather: null,
    permissions: {
      production: true,
      mortality: true,
      feed: true,
      health: true,
      inventory: true,
      finance: true,
      weather: true,
    },
    sync: { offline: false, pending: 0 },
    ...over,
  };
}

describe("generateFarmIntelligence", () => {
  it("normal farm: no alerts, stable rooms", () => {
    const r = generateFarmIntelligence(base());
    expect(r.alerts).toHaveLength(0);
    expect(r.rooms.every((x) => x.status === "stable")).toBe(true);
    expect(r.summary).toMatch(/stable/);
  });

  it("production decline is attributed to the affected room only", () => {
    const i = base();
    i.eggs[i.eggs.length - 1] = egg(TODAY, 30, 26, 30); // Room 3 78%
    const r = generateFarmIntelligence(i);
    const p = r.alerts.filter((a) => a.category === "production");
    expect(p).toHaveLength(1);
    expect(p[0].room).toBe("Room 3");
    expect(p[0].severity).toBe("warning");
    expect(r.rooms.find((x) => x.room === "Room 3")!.status).toBe("attention");
  });

  it("persistent decline updates one alert with its duration", () => {
    const i = base();
    const n = i.eggs.length;
    for (let k = 1; k <= 3; k++) i.eggs[n - k] = egg(shiftKey(TODAY, -(k - 1)), 30, 27, 30);
    const p = generateFarmIntelligence(i).alerts.filter((a) => a.key === "production:room:Room 3");
    expect(p).toHaveLength(1);
    expect(p[0].durationDays).toBeGreaterThanOrEqual(3);
  });

  it("mortality spike raises a room alert without diagnosing", () => {
    const i = base({
      mortality: [
        ...Array.from({ length: 14 }, (_, d) => ({
          id: `m${d}`,
          room: "Room 4",
          cause: "",
          loss: 1,
          date: shiftKey(TODAY, -(d + 1)),
        })),
        { id: "t", room: "Room 4", cause: "", loss: 6, date: TODAY },
      ],
    });
    const m = generateFarmIntelligence(i).alerts.filter((a) => a.category === "mortality");
    expect(m).toHaveLength(1);
    expect(m[0].room).toBe("Room 4");
    expect(m[0].severity).toBe("warning");
    expect(m[0].why).not.toMatch(/disease|newcastle|coccid/i);
  });

  it("severe mortality suggests the veterinarian", () => {
    const i = base({ mortality: [{ id: "t", room: "Room 2", cause: "", loss: 15, date: TODAY }] });
    const m = generateFarmIntelligence(i).alerts.find((a) => a.category === "mortality")!;
    expect(m.severity).toBe("critical");
    expect(m.why).toMatch(/veterinarian/);
  });

  it("high feed usage", () => {
    const i = base();
    i.feed[0] = { ...i.feed[0], bags: 27 };
    const f = generateFarmIntelligence(i).alerts.find((a) => a.category === "feed")!;
    expect(f.key).toBe("feed:usage-high");
    expect(f.severity).toBe("warning");
  });

  it("low feed stock estimates days only with usage data", () => {
    const low = generateFarmIntelligence(
      base({ stock: { hasLots: true, stockKg: 1000, avgDailyKg: 400 } }),
    );
    expect(low.alerts.find((a) => a.category === "inventory")!.severity).toBe("warning");
    expect(low.alerts.find((a) => a.category === "inventory")!.happened).toMatch(/2 days/);
    const unknown = generateFarmIntelligence(
      base({ stock: { hasLots: true, stockKg: 1000, avgDailyKg: 0 } }),
    );
    expect(unknown.alerts.find((a) => a.category === "inventory")).toBeUndefined();
  });

  it("weather heat alert, humid heat is escalated by the advisory severity", () => {
    const w = (sev: "warning" | "critical", h: number) => ({
      tempC: 33,
      humidity: h,
      severity: sev,
      label: "High heat risk",
      message: "Hot.",
      actions: ["Check water"],
      heat: true,
    });
    const r1 = generateFarmIntelligence(base({ weather: w("warning", 40) }));
    const r2 = generateFarmIntelligence(base({ weather: w("critical", 85) }));
    expect(r1.alerts[0].action.to).toBe("/weather");
    expect(r2.alerts[0].severity).toBe("critical");
    expect(r2.summary).toMatch(/ventilation/);
  });

  it("multiple alerts are sorted by severity then deviation", () => {
    const i = base({ stock: { hasLots: true, stockKg: 300, avgDailyKg: 400 } });
    i.feed[0] = { ...i.feed[0], bags: 24 };
    const r = generateFarmIntelligence(i);
    expect(r.alerts[0].severity).toBe("critical");
    expect(r.priorities.length).toBeLessThanOrEqual(3);
    const keys = r.alerts.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("insufficient history produces data gaps, not alerts", () => {
    const r = generateFarmIntelligence(
      base({
        eggs: [egg(TODAY, 10, 10, 10)],
        feed: [{ id: "f", room: "", bags: 50, date: TODAY }],
      }),
    );
    expect(r.alerts).toHaveLength(0);
    expect(r.dataGaps.join(" ")).toMatch(/Not enough/);
  });

  it("respects module permissions", () => {
    const i = base({
      weather: {
        tempC: 35,
        humidity: 50,
        severity: "warning",
        label: "Heat",
        message: "",
        actions: [],
        heat: true,
      },
    });
    i.permissions = { ...i.permissions, weather: false, feed: false };
    i.feed[0] = { ...i.feed[0], bags: 40 };
    const r = generateFarmIntelligence(i);
    expect(r.alerts.some((a) => a.category === "weather" || a.category === "feed")).toBe(false);
    expect(r.evaluated).not.toContain("weather");
  });

  it("offline or unsynced data is flagged as possibly incomplete", () => {
    const r = generateFarmIntelligence(base({ sync: { offline: true, pending: 2 } }));
    expect(r.dataGaps[0]).toMatch(/not synced/);
  });

  it("alert keys contain no farm data, so persisted rows stay per farm", () => {
    const i = base();
    i.eggs[i.eggs.length - 1] = egg(TODAY, 30, 20, 30);
    const r = generateFarmIntelligence(i);
    expect(r.alerts.every((a) => /^[a-z]+:/.test(a.key))).toBe(true);
  });
});
