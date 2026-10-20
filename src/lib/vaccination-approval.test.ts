import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ single: vi.fn(), update: vi.fn(), select: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: (values: unknown) => {
        db.update(values);
        return { eq: () => ({ select: (columns: string) => {
          db.select(columns);
          return { single: db.single };
        } }) };
      },
    }),
  },
}));

import { canApproveProgramme, saveProgrammeApproval } from "@/lib/vaccination";

beforeEach(() => vi.clearAllMocks());

describe("programme approval permissions", () => {
  it("requires super admin for a shared template, not farm health.write", () => {
    expect(canApproveProgramme(null, "farm-a", true, false)).toBe(false);
    expect(canApproveProgramme(null, "farm-a", false, true)).toBe(true);
  });
  it("requires health.write on the matching farm for farm-specific templates", () => {
    expect(canApproveProgramme("farm-a", "farm-a", true, false)).toBe(true);
    expect(canApproveProgramme("farm-a", "farm-a", false, true)).toBe(false);
    expect(canApproveProgramme("farm-b", "farm-a", true, true)).toBe(false);
  });
});

describe("saved programme approval", () => {
  it("rejects a zero-row update even when no error is returned", async () => {
    db.single.mockResolvedValue({ data: null, error: null });
    await expect(saveProgrammeApproval("programme", "actor")).rejects.toThrow("Approval was not saved");
  });
  it("rejects a permission or missing-row error", async () => {
    db.single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    await expect(saveProgrammeApproval("programme", "actor")).rejects.toThrow("Approval was not saved");
  });
  it("returns only a saved approval with the approving account and date", async () => {
    const row = { id: "programme", approval_status: "approved", approved_by: "actor", approved_at: "2026-10-20T12:55:00Z" };
    db.single.mockResolvedValue({ data: row, error: null });
    await expect(saveProgrammeApproval("programme", "actor")).resolves.toEqual(row);
    expect(db.update).toHaveBeenCalledWith({ approval_status: "approved", approved_by: "actor", approved_at: expect.any(String) });
    expect(db.select).toHaveBeenCalledWith("id, approval_status, approved_by, approved_at");
  });
  it("rejects a returned row that remains pending review", async () => {
    db.single.mockResolvedValue({ data: { id: "programme", approval_status: "reference" }, error: null });
    await expect(saveProgrammeApproval("programme", "actor")).rejects.toThrow("Approval was not saved");
  });
  it("does not submit an approval without a signed-in account", async () => {
    await expect(saveProgrammeApproval("programme", null)).rejects.toThrow("Sign in");
    expect(db.update).not.toHaveBeenCalled();
  });
});