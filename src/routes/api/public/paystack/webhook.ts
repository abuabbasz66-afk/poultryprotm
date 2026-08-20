import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { paystackSecret, planFromCode, type PaidPlan } from "@/lib/paystack.server";
import {
  activatePaidPlan,
  amountMatches,
  findFarmByPaystack,
  findPaymentByReference,
  markPaymentStatus,
  updateFarm,
} from "@/lib/paystack-billing.server";

function validSignature(raw: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", paystackSecret()).update(raw).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (!validSignature(raw, request.headers.get("x-paystack-signature"))) {
          return new Response("invalid signature", { status: 401 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("ok", { status: 200 });
        }

        try {
          await handleEvent(payload);
        } catch (err) {
          console.error("[paystack webhook]", err);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleEvent(payload: any) {
  const event: string = payload?.event ?? "";
  const d = payload?.data ?? {};
  const customerCode: string | null = d?.customer?.customer_code ?? null;
  const subscriptionCode: string | null =
    d?.subscription_code ?? d?.subscription?.subscription_code ?? d?.plan_object?.subscription_code ?? null;

  switch (event) {
    case "charge.success": {
      const reference: string | null = d?.reference ?? null;
      const pending = reference ? await findPaymentByReference(reference) : null;

      let farmId = pending?.farm_id ?? (d?.metadata?.farm_id as string | undefined) ?? null;
      let plan =
        (pending?.plan as PaidPlan | undefined) ??
        (d?.metadata?.poultrypro_plan as PaidPlan | undefined) ??
        planFromCode(d?.plan_object?.plan_code ?? d?.plan) ??
        null;

      if (!farmId && (subscriptionCode || customerCode)) {
        const farm = await findFarmByPaystack({ subscriptionCode, customerCode });
        farmId = farm?.id ?? null;
      }
      if (!farmId || !plan || !reference) return;
      if (!amountMatches(plan, d?.amount)) {
        await markPaymentStatus(reference, "attention", "amount_mismatch");
        return;
      }

      await activatePaidPlan({
        farmId,
        plan,
        reference,
        amountKobo: Number(d.amount),
        customerCode,
        subscriptionCode,
        planCode: d?.plan_object?.plan_code ?? d?.plan ?? null,
        gatewayResponse: d?.gateway_response ?? null,
        paidAt: d?.paid_at ?? null,
        nextPaymentAt: d?.next_payment_date ?? null,
        metadata: d?.metadata ?? {},
      });
      return;
    }

    case "subscription.create": {
      const plan = planFromCode(d?.plan?.plan_code);
      let farmId: string | null = null;
      const farm = await findFarmByPaystack({ subscriptionCode, customerCode });
      farmId = farm?.id ?? null;
      if (!farmId) {
        // Fall back to the most recent successful payment for this customer.
        const ref: string | null = d?.most_recent_invoice?.transaction?.reference ?? null;
        const p = ref ? await findPaymentByReference(ref) : null;
        farmId = p?.farm_id ?? null;
      }
      if (!farmId) return;

      await updateFarm(farmId, {
        paystack_customer_code: customerCode,
        paystack_subscription_code: subscriptionCode,
        paystack_email_token: d?.email_token ?? null,
        paystack_plan_code: d?.plan?.plan_code ?? null,
        paystack_subscription_status: "active",
        subscription_next_payment_at: d?.next_payment_date ?? null,
        ...(plan ? { subscription_plan: plan } : {}),
        auto_renew: true,
      });
      return;
    }

    case "invoice.create":
    case "invoice.update": {
      const reference: string | null = d?.transaction?.reference ?? null;
      const paid = d?.status === "success" || d?.paid === true;
      const farm = await findFarmByPaystack({ subscriptionCode, customerCode });
      const plan = planFromCode(d?.subscription?.plan?.plan_code ?? d?.plan?.plan_code);

      if (reference) {
        const existing = await findPaymentByReference(reference);
        if (existing) {
          if (paid && existing.status !== "success" && plan && amountMatches(plan, d?.amount)) {
            await activatePaidPlan({
              farmId: existing.farm_id,
              plan,
              reference,
              amountKobo: Number(d.amount),
              customerCode,
              subscriptionCode,
              planCode: d?.subscription?.plan?.plan_code ?? null,
              gatewayResponse: d?.transaction?.gateway_response ?? null,
              paidAt: d?.paid_at ?? null,
              nextPaymentAt: d?.subscription?.next_payment_date ?? null,
            });
          } else if (!paid) {
            await markPaymentStatus(reference, "pending", d?.transaction?.gateway_response ?? null);
          }
        }
      }

      if (farm?.id) {
        await updateFarm(farm.id, {
          subscription_next_payment_at:
            d?.subscription?.next_payment_date ?? d?.next_payment_date ?? undefined,
          ...(paid ? { paystack_subscription_status: "active" } : {}),
        });
      }
      return;
    }

    case "invoice.payment_failed": {
      const reference: string | null = d?.transaction?.reference ?? null;
      if (reference) await markPaymentStatus(reference, "payment_failed", "invoice payment failed");
      const farm = await findFarmByPaystack({ subscriptionCode, customerCode });
      // Never downgrade or delete data here — just flag for the owner.
      if (farm?.id) await updateFarm(farm.id, { paystack_subscription_status: "payment_failed" });
      return;
    }

    case "subscription.not_renew": {
      const farm = await findFarmByPaystack({ subscriptionCode, customerCode });
      if (!farm?.id) return;
      // Access continues until the already-paid period ends.
      await updateFarm(farm.id, {
        paystack_subscription_status: "non-renewing",
        auto_renew: false,
      });
      return;
    }

    case "subscription.disable": {
      const farm = await findFarmByPaystack({ subscriptionCode, customerCode });
      if (!farm?.id) return;
      const periodEnd = farm.subscription_next_payment_at
        ? new Date(farm.subscription_next_payment_at).getTime()
        : 0;
      const expired = !periodEnd || periodEnd <= Date.now();
      await updateFarm(farm.id, {
        paystack_subscription_status: "cancelled",
        auto_renew: false,
        ...(expired
          ? { subscription_plan: "basic", plan_updated_at: new Date().toISOString() }
          : {}),
      });
      return;
    }

    default:
      return;
  }
}
