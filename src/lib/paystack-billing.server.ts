// Server-only: trusted billing mutations (service role, bypasses RLS).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLAN_AMOUNT_KOBO, planFromCode, type PaidPlan } from "./paystack.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

export type PaymentRow = {
  id: string;
  farm_id: string;
  plan: string;
  reference: string;
  status: string;
  amount_ngn: number;
  currency: string;
};

export async function findPaymentByReference(reference: string): Promise<PaymentRow | null> {
  const { data } = await admin
    .from("farm_payments")
    .select("id, farm_id, plan, reference, status, amount_ngn, currency")
    .eq("reference", reference)
    .maybeSingle();
  return (data as PaymentRow) ?? null;
}

export function amountMatches(plan: PaidPlan, amountKobo: unknown): boolean {
  return Number(amountKobo) === PLAN_AMOUNT_KOBO[plan];
}

/**
 * Idempotently mark a payment successful and activate the farm's paid plan.
 * Farm identity always comes from the stored pending payment (or explicit farm id),
 * never from the payer's email.
 */
export async function activatePaidPlan(opts: {
  farmId: string;
  plan: PaidPlan;
  reference: string;
  amountKobo: number;
  customerCode?: string | null;
  subscriptionCode?: string | null;
  planCode?: string | null;
  gatewayResponse?: string | null;
  paidAt?: string | null;
  nextPaymentAt?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
}) {
  const existing = await findPaymentByReference(opts.reference);
  const alreadySuccess = existing?.status === "success";

  await admin.from("farm_payments").upsert(
    {
      farm_id: opts.farmId,
      plan: opts.plan,
      amount_ngn: opts.amountKobo / 100,
      currency: "NGN",
      reference: opts.reference,
      status: "success",
      paystack_customer_code: opts.customerCode ?? null,
      paystack_subscription_code: opts.subscriptionCode ?? null,
      paystack_plan_code: opts.planCode ?? null,
      gateway_response: opts.gatewayResponse ?? null,
      paid_at: opts.paidAt ?? new Date().toISOString(),
      metadata: opts.metadata ?? {},
    },
    { onConflict: "reference" },
  );

  if (alreadySuccess) return { idempotent: true };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {
    subscription_plan: opts.plan,
    plan_updated_at: new Date().toISOString(),
    subscription_started_at: opts.paidAt ?? new Date().toISOString(),
    paystack_subscription_status: "active",
    auto_renew: true,
  };
  if (opts.customerCode) patch.paystack_customer_code = opts.customerCode;
  if (opts.subscriptionCode) patch.paystack_subscription_code = opts.subscriptionCode;
  if (opts.planCode) patch.paystack_plan_code = opts.planCode;
  if (opts.nextPaymentAt) patch.subscription_next_payment_at = opts.nextPaymentAt;

  await admin.from("farms").update(patch).eq("id", opts.farmId);
  return { idempotent: false };
}

export async function markPaymentStatus(
  reference: string,
  status: string,
  gatewayResponse?: string | null,
) {
  await admin
    .from("farm_payments")
    .update({ status, gateway_response: gatewayResponse ?? null })
    .eq("reference", reference);
}

/** Locate a farm by Paystack subscription or customer code (never by email). */
export async function findFarmByPaystack(opts: {
  subscriptionCode?: string | null;
  customerCode?: string | null;
}): Promise<{ id: string; subscription_next_payment_at: string | null } | null> {
  if (opts.subscriptionCode) {
    const { data } = await admin
      .from("farms")
      .select("id, subscription_next_payment_at")
      .eq("paystack_subscription_code", opts.subscriptionCode)
      .maybeSingle();
    if (data) return data;
  }
  if (opts.customerCode) {
    const { data } = await admin
      .from("farms")
      .select("id, subscription_next_payment_at")
      .eq("paystack_customer_code", opts.customerCode)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateFarm(farmId: string, patch: Record<string, any>) {
  await admin.from("farms").update(patch).eq("id", farmId);
}

export { planFromCode };
