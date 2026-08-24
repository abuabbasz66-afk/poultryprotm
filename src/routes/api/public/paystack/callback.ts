import { createFileRoute } from "@tanstack/react-router";
import {
  appUrl,
  logVerificationFailure,
  paystackFetch,
  planFromCode,
  verifyPaidAmount,
  type PaidPlan,
} from "@/lib/paystack.server";
import {
  activatePaidPlan,
  findPaymentByReference,
  markPaymentStatus,
} from "@/lib/paystack-billing.server";

export const Route = createFileRoute("/api/public/paystack/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const base = appUrl(request);
        const url = new URL(request.url);
        const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
        const fail = () => Response.redirect(`${base}/subscriptions?payment=failed`, 302);
        if (!reference) return fail();

        // The pending record is the only trusted source of farm identity.
        const pending = await findPaymentByReference(reference);
        if (!pending) return fail();

        // Already processed (e.g. the webhook won the race) — idempotent success.
        if (pending.status === "success") {
          return Response.redirect(`${base}/subscriptions?payment=success`, 302);
        }

        const verify = await paystackFetch<{
          status: boolean;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data?: any;
        }>(`/transaction/verify/${encodeURIComponent(reference)}`);

        const tx = verify.body?.data;
        const plan = (pending.plan as PaidPlan) ?? null;
        const planOk = plan === "standard" || plan === "premium";
        const check = planOk ? verifyPaidAmount(plan, tx) : null;

        let reason: string | null = null;
        if (!verify.ok || verify.body?.status !== true) reason = "paystack_verify_failed";
        else if (tx?.status !== "success") reason = "transaction_not_successful";
        else if (tx?.reference !== reference) reason = "reference_mismatch";
        else if (tx?.currency !== "NGN") reason = "currency_mismatch";
        else if (!planOk) reason = "invalid_plan";
        else if (!check?.ok) reason = check?.reason ?? "amount_mismatch";
        else if (tx?.metadata?.farm_id && tx.metadata.farm_id !== pending.farm_id)
          reason = "farm_mismatch";

        if (reason) {
          logVerificationFailure({
            source: "callback",
            reference,
            farmId: pending.farm_id,
            plan,
            reason,
            check,
            txStatus: tx?.status ?? null,
            gatewayResponse: tx?.gateway_response ?? null,
          });
          await markPaymentStatus(reference, "failed", tx?.gateway_response ?? reason);
          return fail();
        }

        await activatePaidPlan({
          farmId: pending.farm_id,
          plan: plan as PaidPlan,
          reference,
          amountKobo: Number(tx.amount),
          requestedAmountKobo: check?.requestedKobo ?? null,
          customerCode: tx?.customer?.customer_code ?? null,
          subscriptionCode: tx?.plan_object?.subscription_code ?? null,
          planCode: tx?.plan ?? tx?.plan_object?.plan_code ?? null,
          gatewayResponse: tx?.gateway_response ?? null,
          paidAt: tx?.paid_at ?? null,
          metadata: tx?.metadata ?? {},
        });


        // Cross-check the plan code, if Paystack returned one.
        const codePlan = planFromCode(tx?.plan_object?.plan_code ?? tx?.plan);
        if (codePlan && codePlan !== plan) {
          await markPaymentStatus(reference, "attention", "plan_code_mismatch");
        }

        return Response.redirect(`${base}/subscriptions?payment=success`, 302);
      },
    },
  },
});
