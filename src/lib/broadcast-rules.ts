/** Browser-safe SMS calculations; delivery and recipient authority stay server-side. */
export type BroadcastCategory = "service" | "marketing";
export function normalizeNigerianPhone(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw || !/^[+\d\s().-]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("009")) digits = digits.slice(2);
  if (/^0[789][01]\d{8}$/.test(digits)) digits = `234${digits.slice(1)}`;
  if (/^[789][01]\d{8}$/.test(digits)) digits = `234${digits}`;
  return /^234[789][01]\d{8}$/.test(digits) ? `+${digits}` : null;
}

const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "\f^{}\\[~]|€";
export function smsMetrics(body: string) {
  let units = 0;
  let unicode = false;
  for (const character of body) {
    if (GSM_BASIC.includes(character)) units += 1;
    else if (GSM_EXTENDED.includes(character)) units += 2;
    else unicode = true;
  }
  if (unicode) units = body.length; // SMS UCS-2 uses UTF-16 code units, including emoji surrogates.
  const single = unicode ? 70 : 160;
  const multipart = unicode ? 67 : 153;
  return {
    characters: [...body].length,
    units,
    encoding: unicode ? "Unicode" : "GSM-7",
    segments: units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / multipart),
  };
}

export function validateSmsBody(body: string, category: BroadcastCategory): string | null {
  if (!body.trim()) return "Enter a message.";
  if (body.length > 1200 || smsMetrics(body).segments > 8)
    return "Keep the message within 8 SMS segments and 1,200 characters.";
  if (!/poultrypro/i.test(body)) return "Identify PoultryPro in the message.";
  if (
    category === "marketing" &&
    !/https:\/\/(?:www\.)?poultrypro\.life\/settings(?:\b|\/|\?)/i.test(body)
  )
    return "Promotional messages must include https://poultrypro.life/settings for communication preferences.";
  return null;
}

export function consentEligible(
  category: BroadcastCategory,
  prefs: { sms: boolean; marketing: boolean },
): boolean {
  return prefs.sms && (category === "service" || prefs.marketing);
}

export type DeliveryStatus =
  | "pending"
  | "sending"
  | "accepted"
  | "sent"
  | "delivered"
  | "failed"
  | "rejected"
  | "unknown"
  | "excluded";
export function providerDeliveryStatus(value: unknown): DeliveryStatus | null {
  const status = String(value ?? "").toLowerCase();
  if (["delivered", "delivrd"].includes(status)) return "delivered";
  if (["sent", "submitted"].includes(status)) return "sent";
  if (["pending", "queued", "accepted"].includes(status)) return "accepted";
  if (["failed", "undelivered", "expired", "deleted"].includes(status)) return "failed";
  if (["rejected", "rejectd"].includes(status)) return "rejected";
  return null;
}
export function canRetryDelivery(
  status: DeliveryStatus,
  reference: string | null = null,
  attempts = 0,
): boolean {
  // An ambiguous timeout may already have charged/sent: never retry it blindly.
  return status === "rejected" && !reference && attempts < 3;
}
