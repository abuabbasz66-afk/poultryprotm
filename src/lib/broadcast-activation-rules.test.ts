import { describe, expect, it } from "vitest";
import { activationPermissions } from "./broadcast-activation-rules";
const now = Date.parse("2026-10-18T14:00:00Z");
const verified = {
  ownerMatches: true,
  fingerprintMatches: true,
  providerVerified: true,
  verifiedAt: "2026-10-18T13:00:00Z",
  routeApproved: true,
  enabled: true,
  receiptConfirmed: true,
};
describe("owner SMS activation", () => {
  it("allows an owner test without bulk activation", () =>
    expect(
      activationPermissions({ ...verified, enabled: false, receiptConfirmed: false }, now),
    ).toEqual({ testEnabled: true, liveEnabled: false }));
  it("blocks bulk activation before confirmed receipt", () =>
    expect(activationPermissions({ ...verified, receiptConfirmed: false }, now).liveEnabled).toBe(
      false,
    ));
  it("blocks an unverified provider", () =>
    expect(activationPermissions({ ...verified, providerVerified: false }, now).testEnabled).toBe(
      false,
    ));
  it("blocks a different owner", () =>
    expect(activationPermissions({ ...verified, ownerMatches: false }, now).liveEnabled).toBe(
      false,
    ));
  it("invalidates approval when credentials change", () =>
    expect(activationPermissions({ ...verified, fingerprintMatches: false }, now).liveEnabled).toBe(
      false,
    ));
  it("expires verification after 24 hours", () =>
    expect(
      activationPermissions({ ...verified, verifiedAt: "2026-10-17T14:00:00Z" }, now).liveEnabled,
    ).toBe(false));
  it("requires route approval", () =>
    expect(activationPermissions({ ...verified, routeApproved: false }, now).testEnabled).toBe(
      false,
    ));
  it("allows verified activation after owner receipt confirmation", () =>
    expect(activationPermissions(verified, now).liveEnabled).toBe(true));
});
