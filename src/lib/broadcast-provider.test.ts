import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readSmsBalance,
  sendProviderSms,
  verifyTermiiSignature,
  verifySmsProvider,
  smsSetup,
} from "./broadcast-provider.server";
beforeEach(() => {
  vi.stubEnv("TERMII_BASE_URL", "https://api.ng.termii.com");
  vi.stubEnv("TERMII_API_KEY", "unit-test-placeholder");
  vi.stubEnv("TERMII_SENDER_ID", "PoultryPro");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("SMS provider boundary with mocked requests only", () => {
  it("does not enable bulk SMS from the legacy environment switch", () => {
    vi.stubEnv("SMS_LIVE_ENABLED", "true");
    expect(smsSetup().liveEnabled).toBe(false);
  });
  it("verifies a funded wallet and active Nigeria sender without sending SMS", async () => {
    vi.stubEnv("TERMII_WEBHOOK_SECRET", "test-signing-secret");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ balance: 100, currency: "NGN" }))
      .mockResolvedValueOnce(
        Response.json({
          content: [{ sender_id: "PoultryPro", status: "active", country: "Nigeria" }],
        }),
      );
    vi.stubGlobal("fetch", fetch);
    expect((await verifySmsProvider()).accountVerified).toBe(true);
    expect(fetch.mock.calls.every((call) => call[1]?.method === "GET")).toBe(true);
  });
  it("does not accept a pending sender as approved", async () => {
    vi.stubEnv("TERMII_WEBHOOK_SECRET", "test-signing-secret");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ balance: 100 }))
        .mockResolvedValueOnce(
          Response.json({
            content: [{ sender_id: "PoultryPro", status: "pending", country: "Nigeria" }],
          }),
        ),
    );
    expect((await verifySmsProvider()).accountVerified).toBe(false);
  });
  it("does not treat an empty wallet as funded", async () => {
    vi.stubEnv("TERMII_WEBHOOK_SECRET", "test-signing-secret");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ balance: 0 }))
        .mockResolvedValueOnce(
          Response.json({
            content: [{ sender_id: "PoultryPro", status: "active", country: "Nigeria" }],
          }),
        ),
    );
    expect((await verifySmsProvider()).accountVerified).toBe(false);
  });
  it("records acceptance, not delivery, when provider returns an ID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message_id: "test-ref" })));
    expect(await sendProviderSms("+2348012345678", "PoultryPro test", "service")).toMatchObject({
      status: "accepted",
      reference: "test-ref",
    });
  });
  it("holds timeout outcomes for reconciliation without retry", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("timeout"));
    vi.stubGlobal("fetch", fetch);
    expect((await sendProviderSms("+2348012345678", "PoultryPro test", "service")).status).toBe(
      "unknown",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not turn a server failure into a retryable rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({}, { status: 503 })));
    expect((await sendProviderSms("+2348012345678", "PoultryPro test", "service")).status).toBe(
      "unknown",
    );
  });
  it("reports explicit HTTP rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({}, { status: 422 })));
    expect((await sendProviderSms("+2348012345678", "PoultryPro test", "service")).status).toBe(
      "rejected",
    );
  });
  it("uses generic route for marketing, never DND bypass", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ message_id: "test-ref" }));
    vi.stubGlobal("fetch", fetch);
    await sendProviderSms("+2348012345678", "PoultryPro test", "marketing");
    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body).channel).toBe("generic");
  });
  it("does not invent an unavailable balance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unavailable")));
    expect((await readSmsBalance()).balance).toBeNull();
  });
  it("verifies HMAC and rejects altered payload", async () => {
    const secret = "test-webhook-secret",
      raw = '{"message_id":"test-ref","status":"delivered"}';
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"],
    );
    const signature = [
      ...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw))),
    ]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    expect(await verifyTermiiSignature(raw, signature, secret)).toBe(true);
    expect(await verifyTermiiSignature(raw + " ", signature, secret)).toBe(false);
  });
  it("rejects unsigned callbacks", async () =>
    expect(await verifyTermiiSignature("{}", null, "secret")).toBe(false));
});
