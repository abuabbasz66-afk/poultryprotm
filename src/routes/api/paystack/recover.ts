import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  jsonRes,
  logVerificationFailure,
  paystackFetch,
  resolveBillingContext,
  verifyPaidAmount,
  type PaidPlan,
} from "@/lib/paystack.server";
import {
  activatePaidPlan,
  findPaymentByReference,
  markPaymentStatus,
} from "@/lib/paystack-billing.server";

const bodySchema = z.object({ reference: z.string().min(6).max(200) });

/**
 * Support/recovery: re-verify an existing Paystack reference server-side and
 * activate the plan if the payment really succeeded. Never creates a charge.
 * Idempotent — re-running on an already-successful payment is a no-op.
 */
export const Route = createFileRoute("/api/paystack/recover")({
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
        if (!parsed.success) return jsonRes({ error: "invalid_reference" }, 400);
        const reference = parsed.data.reference.trim();

        const payment = await findPaymentByReference(reference);
        if (!payment) return jsonRes({ error: "unknown_reference" }, 404);
        // A caller may only recover payments belonging to their own farm.
        if (payment.farm_id !== ctx.farmId) return jsonRes({ error: "forbidden" }, 403);
        if (payment.status === "success") {
          return jsonRes({ status: "already_active", reference, plan: payment.plan });
        }

        const plan = payment.plan as PaidPlan;
        if (plan !== "standard" && plan !== "premium") {
          return jsonRes({ error: "invalid_plan" }, 400);
        }

        const verify = await paystackFetch<{
          status: boolean;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data?: any;
        }>(`/transaction/verify/${encodeURIComponent(reference)}`);
        const tx = verify.body?.data;
        const check = verifyPaidAmount(plan, tx);

        let reason: string | null = null;
        if (!verify.ok || verify.body?.status !== true) reason = "paystack_verify_failed";
        else if (tx?.status !== "success") reason = "transaction_not_successful";
        else if (tx?.reference !== reference) reason = "reference_mismatch";
        else if (tx?.currency !== "NGN") reason = "currency_mismatch";
        else if (!check.ok) reason = check.reason ?? "amount_mismatch";
        else if (tx?.metadata?.farm_id && tx.metadata.farm_id !== payment.farm_id)
          reason = "farm_mismatch";

        if (reason) {
          logVerificationFailure({
            source: "recover",
            reference,
            farmId: payment.farm_id,
            plan,
            reason,
            check,
            txStatus: tx?.status ?? null,
            gatewayResponse: tx?.gateway_response ?? null,
          });
          await markPaymentStatus(reference, "failed", tx?.gateway_response ?? reason);
          return jsonRes({ status: "not_recoverable", reason }, 409);
        }

        await activatePaidPlan({
          farmId: payment.farm_id,
          plan,
          reference,
          amountKobo: Number(tx.amount),
          requestedAmountKobo: check.requestedKobo,
          customerCode: tx?.customer?.customer_code ?? null,
          subscriptionCode: tx?.plan_object?.subscription_code ?? null,
          planCode: tx?.plan ?? tx?.plan_object?.plan_code ?? null,
          gatewayResponse: tx?.gateway_response ?? null,
          paidAt: tx?.paid_at ?? null,
          metadata: tx?.metadata ?? {},
        });

        console.log(
          "[paystack:recovered]",
          JSON.stringify({ reference, farm_id: payment.farm_id, plan }),
        );
        return jsonRes({ status: "activated", reference, plan });
      },
    },
  },
});
