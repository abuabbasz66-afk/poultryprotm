import { describe, expect, it } from "vitest";
import { dueDateFor, scheduleStatus } from "@/lib/vaccination";

const sched = (status: string, date = "2026-03-10") => ({ scheduled_date: date, status });

describe("scheduleStatus", () => {
  it("marks skipped and deferred from the stored status, regardless of date", () => {
    expect(scheduleStatus(sched("skipped"), undefined, "2026-03-01")).toBe("skipped");
    expect(scheduleStatus(sched("deferred"), undefined, "2026-03-01")).toBe("deferred");
  });

  it("never marks an activity completed without a real record", () => {
    expect(scheduleStatus(sched("scheduled", "2026-01-01"), undefined, "2026-03-01")).toBe("overdue");
  });

  it("keeps scheduled (upcoming), due soon, due today and overdue windows", () => {
    expect(scheduleStatus(sched("scheduled", "2026-03-10"), undefined, "2026-03-01")).toBe("upcoming");
    expect(scheduleStatus(sched("scheduled", "2026-03-10"), undefined, "2026-03-08")).toBe("due_soon");
    expect(scheduleStatus(sched("scheduled", "2026-03-10"), undefined, "2026-03-10")).toBe("due_today");
  });
});

describe("dueDateFor", () => {
  it("counts Day 1 as the placement/hatch day itself (Day 7 = anchor + 6)", () => {
    expect(dueDateFor("2026-03-01", 1)).toBe("2026-03-01");
    expect(dueDateFor("2026-03-01", 7)).toBe("2026-03-07");
    expect(dueDateFor("2026-03-01", 140)).toBe("2026-07-19");
  });
});
