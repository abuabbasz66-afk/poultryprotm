import { describe, expect, it } from "vitest";
import {
  businessKeyOf,
  classifySyncError,
  coalesce,
  detectConflict,
  differsFrom,
  type CoalesceItem,
} from "./sync-rules";
import { applyPending, type OutboxItem } from "./outbox";

const item = (p: Partial<OutboxItem>): OutboxItem => ({
  id: "o1",
  userId: "u",
  farmId: "farmA",
  table: "egg_production",
  op: "insert",
  rowId: "local1",
  status: "pending",
  attempts: 0,
  lastError: null,
  createdAt: "2026-09-27T00:00:00Z",
  createdOffline: true,
  payload: {},
  base: null,
  cloud: null,
  ...p,
});

describe("egg business key", () => {
  it("is farm_id + date", () => {
    expect(businessKeyOf("egg_production", { farm_id: "A", date: "2026-09-27" })).toBe(
      "A|2026-09-27",
    );
    expect(businessKeyOf("mortality", { farm_id: "A" })).toBeNull();
  });
});

describe("offline overlay (applyPending)", () => {
  it("offline egg replaces the cached same-day row instead of duplicating", () => {
    const rows = [{ id: "cloud1", date: "2026-09-27", r2: 10 }];
    const out = applyPending(
      rows,
      [item({ payload: { farm_id: "farmA", date: "2026-09-27", r2: 50 } })],
      "egg_production",
      "farmA",
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "cloud1", r2: 50 });
  });
  it("new offline day appears immediately", () => {
    const out = applyPending(
      [],
      [item({ payload: { farm_id: "farmA", date: "2026-09-28" } })],
      "egg_production",
      "farmA",
    );
    expect(out).toHaveLength(1);
  });
  it("never shows another farm's queued records", () => {
    const out = applyPending(
      [],
      [item({ farmId: "farmB", payload: { farm_id: "farmB", date: "2026-09-28" } })],
      "egg_production",
      "farmA",
    );
    expect(out).toHaveLength(0);
  });
  it("failed records stay visible (not silently lost)", () => {
    const out = applyPending(
      [],
      [item({ status: "error", payload: { farm_id: "farmA", date: "2026-09-28" } })],
      "egg_production",
      "farmA",
    );
    expect(out).toHaveLength(1);
  });
});

describe("outbox coalescing (idempotency)", () => {
  const q = (p: Partial<CoalesceItem>): CoalesceItem => ({
    id: "o1",
    table: "egg_production",
    op: "insert",
    rowId: "local1",
    farmId: "farmA",
    status: "pending",
    payload: { date: "2026-09-27", r2: 1 },
    ...p,
  });
  it("same farm/day submitted twice merges into one queued write", () => {
    const a = coalesce([q({})], {
      table: "egg_production",
      op: "insert",
      rowId: "local2",
      farmId: "farmA",
      payload: { date: "2026-09-27", r2: 9 },
    });
    expect(a.kind).toBe("merge-into");
  });
  it("different farm same day stays separate", () => {
    const a = coalesce([q({})], {
      table: "egg_production",
      op: "insert",
      rowId: "l3",
      farmId: "farmB",
      payload: { date: "2026-09-27" },
    });
    expect(a.kind).toBe("append");
  });
  it("editing an unsynced record folds into its insert; deleting drops it", () => {
    expect(
      coalesce([q({})], {
        table: "egg_production",
        op: "update",
        rowId: "local1",
        farmId: "farmA",
        payload: { r2: 3 },
      }).kind,
    ).toBe("merge-into");
    expect(
      coalesce([q({})], {
        table: "egg_production",
        op: "delete",
        rowId: "local1",
        farmId: "farmA",
        payload: {},
      }).kind,
    ).toBe("drop-insert");
  });
});

describe("error classification", () => {
  it("network problems are temporary", () => {
    expect(classifySyncError(new TypeError("Failed to fetch")).kind).toBe("temporary");
    expect(classifySyncError({ message: "x", status: 503 }).kind).toBe("temporary");
  });
  it("RLS / schema / constraint errors are permanent", () => {
    expect(
      classifySyncError({ code: "42501", message: "new row violates row-level security" }).kind,
    ).toBe("permanent");
    expect(classifySyncError({ code: "42703", message: "column foo does not exist" }).kind).toBe(
      "permanent",
    );
    expect(classifySyncError({ code: "23503", message: "fk" }).kind).toBe("permanent");
  });
  it("does not leak raw database text", () => {
    expect(
      classifySyncError({ code: "42703", message: "column secret_col does not exist" }).message,
    ).not.toContain("secret_col");
  });
});

describe("conflict detection", () => {
  it("flags cloud changes made after the offline snapshot", () => {
    expect(detectConflict({ r2: 1 }, { r2: 2 }, { r2: 5 })).toBe(true);
    expect(detectConflict({ r2: 1 }, { r2: 1 }, { r2: 5 })).toBe(false);
  });
  it("offline egg vs different existing cloud day differs", () => {
    expect(differsFrom({ r2: 10, date: "d" }, { r2: 50, date: "d" })).toBe(true);
    expect(differsFrom({ r2: 10, date: "d" }, { r2: 10, date: "d" })).toBe(false);
  });
});
