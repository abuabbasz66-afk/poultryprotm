import { createFileRoute } from "@tanstack/react-router";
import { appUrl, paystackFetch, planFromCode, type PaidPlan } from "@/lib/paystack.server";
import {
  activatePaidPlan,
  amountMatches,
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

        const verify = await paystackFetch<{
          status: boolean;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data?: any;
        }>(`/transaction/verify/${encodeURIComponent(reference)}`);

        const tx = verify.body?.data;
        const plan = (pending.plan as PaidPlan) ?? null;
        const valid =
          verify.ok &&
          verify.body?.status === true &&
          tx?.status === "success" &&
          tx?.reference === reference &&
          tx?.currency === "NGN" &&
          (plan === "standard" || plan === "premium") &&
          amountMatches(plan, tx?.amount) &&
          (!tx?.metadata?.farm_id || tx.metadata.farm_id === pending.farm_id);

        if (!valid) {
          await markPaymentStatus(
            reference,
            "failed",
            tx?.gateway_response ?? "verification_failed",
          );
          return fail();
        }

        await activatePaidPlan({
          farmId: pending.farm_id,
          plan,
          reference,
          amountKobo: Number(tx.amount),
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
