import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  PLAN_AMOUNT_KOBO,
  appUrl,
  jsonRes,
  paystackFetch,
  planCode,
  resolveBillingContext,
  type PaidPlan,
} from "@/lib/paystack.server";

const bodySchema = z.object({ plan: z.enum(["standard", "premium"]) });

export const Route = createFileRoute("/api/paystack/initialize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await resolveBillingContext(request);
        if ("error" in ctx) return ctx.error;

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return jsonRes({ error: "invalid_json" }, 400);
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) return jsonRes({ error: "invalid_plan" }, 400);
        const plan = parsed.data.plan as PaidPlan;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;

        // Farm + owner email resolved server-side.
        const { data: farm } = await admin
          .from("farms")
          .select("id, owner_id, paystack_customer_code")
          .eq("id", ctx.farmId)
          .maybeSingle();
        if (!farm) return jsonRes({ error: "no_farm" }, 400);

        let email = ctx.email;
        try {
          const { data: owner } = await admin.auth.admin.getUserById(farm.owner_id);
          if (owner?.user?.email) email = owner.user.email;
        } catch {
          /* fall back to caller email */
        }
        if (!email) return jsonRes({ error: "no_email" }, 400);

        const amountKobo = PLAN_AMOUNT_KOBO[plan];
        const reference = `pp_${ctx.farmId.replace(/-/g, "").slice(0, 12)}_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;

        const { error: insErr } = await admin.from("farm_payments").insert({
          farm_id: ctx.farmId,
          plan,
          amount_ngn: amountKobo / 100,
          currency: "NGN",
          reference,
          status: "pending",
          paystack_plan_code: planCode(plan) ?? null,
          metadata: { farm_id: ctx.farmId, user_id: ctx.userId, plan },
        });
        if (insErr) return jsonRes({ error: "could_not_create_payment" }, 500);

        const base = appUrl(request);
        const code = planCode(plan);

        const init = await paystackFetch<{
          status: boolean;
          message?: string;
          data?: { authorization_url: string; reference: string; access_code: string };
        }>("/transaction/initialize", {
          method: "POST",
          body: JSON.stringify({
            email,
            amount: amountKobo,
            currency: "NGN",
            reference,
            ...(code ? { plan: code } : {}),
            callback_url: `${base}/api/public/paystack/callback`,
            metadata: {
              farm_id: ctx.farmId,
              user_id: ctx.userId,
              poultrypro_plan: plan,
              reference,
            },
          }),
        });

        if (!init.ok || !init.body?.status || !init.body.data?.authorization_url) {
          await admin
            .from("farm_payments")
            .update({ status: "failed", gateway_response: init.body?.message ?? "init_failed" })
            .eq("reference", reference);
          return jsonRes({ error: "paystack_init_failed", message: init.body?.message }, 502);
        }

        return jsonRes({
          authorization_url: init.body.data.authorization_url,
          reference,
        });
      },
    },
  },
});
