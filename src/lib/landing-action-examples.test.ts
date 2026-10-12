import { describe, expect, it } from "vitest";
import { LANDING_ACTION_EXAMPLES } from "./landing-action-examples";

describe("public Action Centre illustrations", () => {
  it("contains only standalone examples with no farm or person identifiers", () => {
    expect(new Set(LANDING_ACTION_EXAMPLES.map((item) => item.id)).size).toBe(4);
    for (const item of LANDING_ACTION_EXAMPLES) {
      expect(item.issue.length).toBeGreaterThan(0);
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.next.length).toBeGreaterThan(0);
      expect(item).not.toHaveProperty("farm_id");
      expect(item).not.toHaveProperty("assigned_to");
    }
    expect(JSON.stringify(LANDING_ACTION_EXAMPLES)).not.toMatch(/ABZ|Greenfield|@|email|staff_id/i);
  });
  it("shows independently checked quantities with appropriate limitations", () => {
    expect(LANDING_ACTION_EXAMPLES[0].evidence).toContain("= 3 days");
    expect(300 / 100).toBe(3);
    expect((800 - 720) / 800 * 100).toBe(10);
    expect(LANDING_ACTION_EXAMPLES[1].evidence).toContain("10% decline");
    expect(6 / 1000 * 100).toBeCloseTo(0.6);
    expect(LANDING_ACTION_EXAMPLES[2].evidence).toContain("0.6%");
    expect(LANDING_ACTION_EXAMPLES[2].quality).toContain("not a diagnosis");
    expect(LANDING_ACTION_EXAMPLES[3].evidence).toContain("unknown, not zero");
  });
});