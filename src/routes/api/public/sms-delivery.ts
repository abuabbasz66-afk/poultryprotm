import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { providerDeliveryStatus } from "@/lib/broadcast-rules";

export const Route = createFileRoute("/api/public/sms-delivery")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 32768) return new Response("Payload too large", { status: 413 });
        const { verifyTermiiSignature } = await import("@/lib/broadcast-provider.server");
        if (
          !(await verifyTermiiSignature(
            raw,
            request.headers.get("x-termii-signature"),
            process.env["TERMII_WEBHOOK_SECRET"],
          ))
        )
          return new Response("Unauthorized", { status: 401 });
        let event;
        try {
          event = z
            .object({
              message_id: z.string().min(1).max(200),
              status: z.string().max(80),
              id: z.union([z.string(), z.number()]).optional(),
            })
            .parse(JSON.parse(raw));
        } catch {
          return new Response("Invalid event", { status: 400 });
        }
        const status = providerDeliveryStatus(event.status);
        if (!status) return Response.json({ received: true });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: recipient, error } = await supabaseAdmin
          .from("sms_recipients")
          .select("id,campaign_id")
          .eq("provider_message_id", event.message_id)
          .maybeSingle();
        if (error) return new Response("Retry later", { status: 503 });
        // Unknown IDs may belong to unrelated provider traffic; disclose nothing.
        if (!recipient) return Response.json({ received: true });
        const { error: saveError } = await supabaseAdmin.rpc("sms_record_result", {
          p_recipient: recipient.id,
          p_status: status,
          p_reference: event.message_id,
          p_reason: ["failed", "rejected"].includes(status)
            ? "Provider reported delivery failure; check Termii delivery report for route/DND restrictions"
            : undefined,
          p_actor: undefined,
          p_event_key: `termii:${event.message_id}:${status}`,
        });
        if (saveError) return new Response("Retry later", { status: 503 });
        const { error: finishError } = await supabaseAdmin.rpc("sms_finish_campaign", {
          p_campaign: recipient.campaign_id,
        });
        if (finishError) return new Response("Retry later", { status: 503 });
        return Response.json({ received: true });
      },
    },
  },
});
