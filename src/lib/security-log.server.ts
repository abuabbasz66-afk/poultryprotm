/**
 * Server-side security event logging.
 *
 * Writes to the same `security_events` table the app uses, so payment,
 * webhook and admin events sit in one audit trail. Never records tokens,
 * card details, secrets or raw request bodies.
 */
export async function logServerSecurityEvent(
  eventType: string,
  opts: { farmId?: string | null; detail?: string | null; metadata?: Record<string, unknown> } = {},
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("security_events").insert({
      farm_id: opts.farmId ?? null,
      event_type: eventType,
      detail: opts.detail ?? null,
      device: "Server",
      metadata: (opts.metadata ?? {}) as never,
    } as never);
  } catch {
    /* auditing must never break a payment or webhook */
  }
}
