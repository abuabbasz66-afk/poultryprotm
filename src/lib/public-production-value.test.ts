import { describe, expect, it } from "vitest";
import { PUBLIC_PRODUCTION_VALUE } from "./public-production-value";

describe("owner-approved public production snapshot", () => {
  it("uses the owner's supplied rounded 76.6 million naira value", () => {
    expect(PUBLIC_PRODUCTION_VALUE.amount).toBe(76_600_000);
    expect(PUBLIC_PRODUCTION_VALUE.currency).toBe("NGN");
  });
  it("keeps the value scoped to ABZ and a dated snapshot rather than live sales", () => {
    expect(PUBLIC_PRODUCTION_VALUE.farm).toBe("ABZ Global Resource");
    expect(PUBLIC_PRODUCTION_VALUE.source).toBe("owner-supplied-snapshot");
    expect(PUBLIC_PRODUCTION_VALUE.asOf).toBe("2026-10-19");
  });
  it("records the owner's confirmation that production crates are sold daily", () => {
    expect(PUBLIC_PRODUCTION_VALUE.salesBasis).toBe("owner-confirmed-daily-crate-sales");
  });
});