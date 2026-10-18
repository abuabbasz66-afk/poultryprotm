import { providerDeliveryStatus, type DeliveryStatus } from "./broadcast-rules";

export function smsSetup() {
  const base = process.env["TERMII_BASE_URL"] ?? "";
  let validBase = false;
  try {
    const url = new URL(base);
    validBase =
      url.protocol === "https:" &&
      (url.hostname === "termii.com" || url.hostname.endsWith(".termii.com")) &&
      !url.username &&
      !url.password &&
      !url.search;
  } catch {
    /* Setup incomplete. */
  }
  const sender = process.env["TERMII_SENDER_ID"] ?? "";
  const ready = Boolean(
    process.env["TERMII_API_KEY"] && validBase && /^[A-Za-z0-9 ]{3,11}$/.test(sender),
  );
  return {
    ready,
    sender: ready ? sender : null,
    webhookReady: Boolean(process.env["TERMII_WEBHOOK_SECRET"]),
    liveEnabled: process.env["SMS_LIVE_ENABLED"] === "true",
    balance: null as number | null,
    currency: null as string | null,
    unitPrice: null as number | null,
  };
}

async function termiiRequest(path: string, body?: Record<string, unknown>) {
  if (!smsSetup().ready) throw new Error("SMS provider setup required.");
  const base = (process.env["TERMII_BASE_URL"] ?? "").replace(/\/$/, "");
  const key = process.env["TERMII_API_KEY"];
  const url = new URL(`${base}${path}`);
  if (!body && key) url.searchParams.set("api_key", key);
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify({ ...body, api_key: key }) : undefined,
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  // Never log URL/body: Termii carries its API key in those fields.
  const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: response.ok, httpStatus: response.status, result };
}

export async function readSmsBalance() {
  const setup = smsSetup();
  if (!setup.ready) return setup;
  try {
    const { ok, result } = await termiiRequest("/api/get-balance");
    if (ok && result && Number.isFinite(Number(result.balance)))
      return {
        ...setup,
        balance: Number(result.balance),
        currency: typeof result.currency === "string" ? result.currency : null,
      };
  } catch {
    /* Balance is optional; do not pretend it is zero. */
  }
  return setup;
}

export async function sendProviderSms(
  phone: string,
  body: string,
  category: string,
): Promise<{ status: DeliveryStatus; reference: string | null; reason: string | null }> {
  try {
    const { ok, httpStatus, result } = await termiiRequest("/api/sms/send", {
      to: phone.replace(/^\+/, ""),
      from: process.env["TERMII_SENDER_ID"],
      sms: body,
      type: "plain",
      channel: category === "service" ? "dnd" : "generic",
    });
    const reference = typeof result?.message_id === "string" ? result.message_id : null;
    if (ok && reference) return { status: "accepted", reference, reason: null };
    // 5xx, unexpected success and connection failures may already have submitted.
    const ambiguous = httpStatus >= 500 || ok;
    return {
      status: ambiguous ? "unknown" : "rejected",
      reference,
      reason: ambiguous
        ? "Provider response did not confirm submission; reconcile before resending"
        : `Provider rejected request (HTTP ${httpStatus}); check sender approval, balance and route restrictions`,
    };
  } catch {
    return {
      status: "unknown",
      reference: null,
      reason: "Submission outcome unknown; do not resend until reconciled with Termii",
    };
  }
}

export async function readProviderDelivery(reference: string) {
  const { ok, result } = await termiiRequest(
    `/api/sms/inbox?message_id=${encodeURIComponent(reference)}`,
  );
  if (!ok || !result) return null;
  const data: unknown = Array.isArray(result) ? result : (result.data ?? result);
  const rows = Array.isArray(data) ? data : [data];
  const row = rows.find((value): value is Record<string, unknown> =>
    Boolean(
      value &&
      typeof value === "object" &&
      "message_id" in value &&
      (value as Record<string, unknown>).message_id === reference,
    ),
  );
  return row ? providerDeliveryStatus(row.status) : null;
}

export async function verifyTermiiSignature(
  raw: string,
  signature: string | null,
  secret: string | undefined,
) {
  if (!secret || !signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["verify"],
  );
  const bytes = new Uint8Array(signature.match(/.{2}/g)?.map((value) => parseInt(value, 16)) ?? []);
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(raw));
}
