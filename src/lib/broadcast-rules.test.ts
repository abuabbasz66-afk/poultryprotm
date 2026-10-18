import { describe, expect, it } from "vitest";
import {
  normalizeNigerianPhone,
  smsMetrics,
  validateSmsBody,
  consentEligible,
  providerDeliveryStatus,
  canRetryDelivery,
} from "./broadcast-rules";

describe("Nigerian registered phone validation", () => {
  it("normalises a Nigerian local mobile number", () =>
    expect(normalizeNigerianPhone("08012345678")).toBe("+2348012345678"));
  it("normalises international and spaced numbers", () =>
    expect(normalizeNigerianPhone("+234 801 234 5678")).toBe("+2348012345678"));
  it("rejects foreign and missing numbers", () => {
    expect(normalizeNigerianPhone("+447700900123")).toBeNull();
    expect(normalizeNigerianPhone(null)).toBeNull();
  });
  it("does not strip letters into an invented number", () =>
    expect(normalizeNigerianPhone("call08012345678")).toBeNull());
});
describe("SMS billing units", () => {
  it("uses 160 GSM units for a single SMS", () =>
    expect(smsMetrics("a".repeat(160)).segments).toBe(1));
  it("uses 153 units per multipart GSM segment", () =>
    expect(smsMetrics("a".repeat(161)).segments).toBe(2));
  it("counts GSM extension characters twice", () =>
    expect(smsMetrics("^".repeat(81))).toMatchObject({ units: 162, segments: 2 }));
  it("uses 70 then 67 UTF-16 units for Unicode", () => {
    expect(smsMetrics("漢".repeat(70)).segments).toBe(1);
    expect(smsMetrics("漢".repeat(71)).segments).toBe(2);
  });
  it("counts an emoji as two UTF-16 units", () =>
    expect(smsMetrics("😀".repeat(36))).toMatchObject({ characters: 36, units: 72, segments: 2 }));
});
describe("consent and submission safety", () => {
  it("requires SMS consent even for service broadcasts", () =>
    expect(consentEligible("service", { sms: false, marketing: true })).toBe(false));
  it("requires separate marketing consent", () =>
    expect(consentEligible("marketing", { sms: true, marketing: false })).toBe(false));
  it("permits opted-in marketing", () =>
    expect(consentEligible("marketing", { sms: true, marketing: true })).toBe(true));
  it("requires the marketing preferences link", () =>
    expect(validateSmsBody("PoultryPro update", "marketing")).not.toBeNull());
  it("permits identified service content", () =>
    expect(validateSmsBody("PoultryPro account maintenance update", "service")).toBeNull());
  it("does not count accepted as delivered", () =>
    expect(providerDeliveryStatus("accepted")).toBe("accepted"));
  it("keeps unrecognised provider states unconfirmed", () =>
    expect(providerDeliveryStatus("success")).toBeNull());
  it("never retries ambiguous submissions", () => expect(canRetryDelivery("unknown")).toBe(false));
  it("never retries delivered messages", () => expect(canRetryDelivery("delivered")).toBe(false));
  it("does not retry failures after provider acceptance", () =>
    expect(canRetryDelivery("failed", "accepted-ref")).toBe(false));
  it("caps explicitly rejected retries at three attempts", () =>
    expect(canRetryDelivery("rejected", null, 3)).toBe(false));
  it("permits an explicit rejection without a provider reference", () =>
    expect(canRetryDelivery("rejected", null, 1)).toBe(true));
});
