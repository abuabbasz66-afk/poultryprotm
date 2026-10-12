import { describe, expect, it } from "vitest";
import {
  allowedActions,
  assessEvidence,
  followUp,
  priorityFor,
  recurrence,
  suppressedByCooldown,
} from "./actions";
import { generateFarmIntelligence, shiftKey, type IntelAlert, type IntelInput } from "./engine";
import type { EggRow, Room } from "@/lib/farm-data";

const TODAY = "2026-10-12";
const room = (n: number, current = 1000): Room =>
  ({
    id: `r${n}`,
    name: `Room ${n}`,
    current,
    initial: current,
    status: "active",
    bird_type: "Layer",
  }) as Room;
const egg = (date: string, c: number): EggRow => ({
  id: date,
  date,
  label: date,
  r2: c,
  r3: c,
  r4: c,
  extra: 0,
});

function input(over: Partial<IntelInput> = {}): IntelInput {
  const eggs: EggRow[] = [];
  for (let d = 10; d >= 0; d--) eggs.push(egg(shiftKey(TODAY, -d), 30));
  return {
    todayKey: TODAY,
    hour: 10,
    rooms: [room(2), room(3), room(4)],
    eggs,
    mortality: [],
    health: [],
    expenses: [],
    revenue: [],
    feed: [],
    stock: null,
    weather: null,
    permissions: {
      production: true,
      mortality: true,
      feed: true,
      health: true,
      inventory: true,
      finance: false,
      weather: false,
    },
    sync: { offline: false, pending: 0 },
    ...over,
  };
}
const alert = (over: Partial<IntelAlert> = {}): IntelAlert => ({
  key: "production:farm",
  category: "production",
  severity: "warning",
  title: "t",
  happened: "h",
  why: "w",
  checks: [],
  figures: [],
  refDate: TODAY,
  deviationPct: 10,
  durationDays: 1,
  birdsAffected: 0,
  action: { label: "x", to: "/dashboard" },
  ...over,
});

describe("priority", () => {
  it("maps severity to High/Medium/Low", () => {
    expect(priorityFor("critical")).toBe("high");
    expect(priorityFor("warning")).toBe("high");
    expect(priorityFor("watch")).toBe("medium");
    expect(priorityFor("normal")).toBe("low");
  });
});

describe("evidence quality", () => {
  it("is strong with 7 prior egg days, limited with 3, insufficient with 1", () => {
    expect(assessEvidence(alert(), input()).evidence).toBe("strong");
    const few = input({ eggs: [1, 2, 3].map((d) => egg(shiftKey(TODAY, -d), 30)) });
    expect(assessEvidence(alert(), few).evidence).toBe("limited");
    const one = input({ eggs: [egg(shiftKey(TODAY, -1), 30)] });
    expect(assessEvidence(alert(), one).evidence).toBe("insufficient");
  });
  it("marks stock estimates limited with fewer than 4 usage days", () => {
    const feed = [1, 2].map((d) => ({
      id: `f${d}`,
      room: "Room 2",
      bags: 10,
      date: shiftKey(TODAY, -d),
    }));
    const a = alert({ key: "inventory:feed-low", category: "inventory" });
    expect(assessEvidence(a, input({ feed })).evidence).toBe("limited");
    expect(assessEvidence(a, input({ feed: [] })).evidence).toBe("insufficient");
  });
  it("weather without humidity is limited", () => {
    const w = {
      tempC: 34,
      humidity: null,
      severity: "warning" as const,
      label: "",
      message: "",
      actions: [],
      heat: true,
    };
    expect(assessEvidence(alert({ category: "weather" }), input({ weather: w })).evidence).toBe(
      "limited",
    );
  });
});

describe("cooldown", () => {
  const now = Date.parse("2026-10-12T12:00:00Z");
  const row = (until: string | null, severity = "warning") => ({
    status: "dismissed" as const,
    cooldown_until: until,
    severity,
  });
  it("suppresses a dismissed alert during cooldown", () => {
    expect(suppressedByCooldown(alert(), row("2026-10-14T00:00:00Z"), now)).toBe(true);
  });
  it("lets it back after cooldown or when it becomes critical", () => {
    expect(suppressedByCooldown(alert(), row("2026-10-11T00:00:00Z"), now)).toBe(false);
    expect(
      suppressedByCooldown(alert({ severity: "critical" }), row("2026-10-14T00:00:00Z"), now),
    ).toBe(false);
  });
  it("never suppresses open alerts", () => {
    expect(
      suppressedByCooldown(
        alert(),
        { status: "active", cooldown_until: null, severity: "warning" },
        now,
      ),
    ).toBe(false);
  });
});

describe("workflow", () => {
  it("closed items can only be reopened or noted", () => {
    expect(allowedActions("resolved")).toEqual(["reopen", "note"]);
    expect(allowedActions("dismissed")).toEqual(["reopen", "note"]);
  });
  it("open items cannot be acknowledged twice", () => {
    expect(allowedActions("active")).toContain("acknowledge");
    expect(allowedActions("acknowledged")).not.toContain("acknowledge");
    expect(allowedActions("in_progress")).not.toContain("start");
  });
  it("counts recurrences from history", () => {
    const m = recurrence([
      { alert_key: "a", action: "reopened" },
      { alert_key: "a", action: "reopened" },
      { alert_key: "b", action: "resolve" },
    ]);
    expect(m.get("a")).toBe(2);
    expect(m.get("b")).toBeUndefined();
  });
});

describe("follow-up", () => {
  const series = (before: number[], after: number[]) => {
    const m = new Map<string, number>();
    before.forEach((v, i) => m.set(shiftKey("2026-10-01", -(i + 1)), v));
    after.forEach((v, i) => m.set(shiftKey("2026-10-01", i + 1), v));
    return m;
  };
  it("improved: eggs 2,000 → 2,200 (+10%)", () => {
    const f = followUp(
      series([2000, 2000, 2000], [2200, 2200, 2200]),
      "2026-10-01",
      TODAY,
      "Eggs",
      true,
    );
    expect(f.outcome).toBe("improved");
    expect(f.before).toBe(2000);
    expect(f.after).toBe(2200);
  });
  it("similar under 5% change; worse for rising deaths", () => {
    expect(
      followUp(series([100, 100, 100], [103, 103, 103]), "2026-10-01", TODAY, "E", true).outcome,
    ).toBe("similar");
    expect(followUp(series([2, 2, 2], [4, 4, 4]), "2026-10-01", TODAY, "D", false).outcome).toBe(
      "worse",
    );
  });
  it("waits for 3 days after, and needs 3 days before", () => {
    expect(followUp(series([1, 1, 1], [1]), "2026-10-01", TODAY, "E", true).outcome).toBe(
      "waiting",
    );
    expect(followUp(series([1], [1, 1, 1]), "2026-10-01", TODAY, "E", true).outcome).toBe(
      "no-data",
    );
  });
});

describe("record-quality rules", () => {
  it("flags stopped records without treating the gap as zero", () => {
    const eggs = [8, 7, 6, 5, 4].map((d) => egg(shiftKey(TODAY, -d), 30));
    const r = generateFarmIntelligence(input({ eggs }));
    const stale = r.alerts.find((a) => a.key === "operations:production-stale");
    expect(stale?.title).toBe("No egg records for 4 days");
    expect(stale?.severity).toBe("watch");
    expect(r.alerts.some((a) => a.category === "production" && a.title.includes("drop"))).toBe(
      false,
    );
  });
  it("7+ day gap is a warning", () => {
    const eggs = [12, 11, 10].map((d) => egg(shiftKey(TODAY, -d), 30));
    expect(
      generateFarmIntelligence(input({ eggs })).alerts.find(
        (a) => a.key === "operations:production-stale",
      )?.severity,
    ).toBe("warning");
  });
  it("flags a recent zero-egg day while birds are present", () => {
    const i = input();
    i.eggs[i.eggs.length - 2] = egg(shiftKey(TODAY, -1), 0);
    const r = generateFarmIntelligence(i);
    expect(r.alerts.some((a) => a.key === `operations:zero-eggs:${shiftKey(TODAY, -1)}`)).toBe(
      true,
    );
  });
  it("no record alerts when records are complete", () => {
    const r = generateFarmIntelligence(input());
    expect(r.alerts.filter((a) => a.category === "operations")).toEqual([]);
  });
  it("same condition keeps one stable key (deduplication)", () => {
    const eggs = [8, 7, 6, 5, 4].map((d) => egg(shiftKey(TODAY, -d), 30));
    const a = generateFarmIntelligence(input({ eggs })).alerts.map((x) => x.key);
    const b = generateFarmIntelligence(input({ eggs, hour: 20 })).alerts.map((x) => x.key);
    expect(new Set(a).size).toBe(a.length);
    expect(b.filter((k) => k.startsWith("operations:production")).length).toBe(1);
  });
});
