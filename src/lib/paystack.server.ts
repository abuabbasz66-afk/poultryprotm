// Server-only Paystack helpers. Never import from client components.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PaidPlan = "standard" | "premium";

/** Server-side source of truth for plan pricing (kobo). */
export const PLAN_AMOUNT_KOBO: Record<PaidPlan, number> = {
  standard: 95000,
  premium: 195000,
};

export function planAmountNgn(plan: PaidPlan): number {
  return PLAN_AMOUNT_KOBO[plan] / 100;
}

export function paystackSecret(): string {
  const key = process.env["PAYSTACK_SECRET_KEY"];
  if (!key) throw new Error("Missing PAYSTACK_SECRET_KEY");
  return key;
}

export function planCode(plan: PaidPlan): string | undefined {
  const v =
    plan === "standard"
      ? process.env["PAYSTACK_STANDARD_PLAN_CODE"]
      : process.env["PAYSTACK_PREMIUM_PLAN_CODE"];
  return v && v.trim() ? v.trim() : undefined;
}

const resolvedPlanCodes: Partial<Record<PaidPlan, string>> = {};

/**
 * Return a plan code that actually exists on the connected Paystack account.
 * Validates the configured code; if it is missing or belongs to another
 * account/mode, the monthly plan is created on the fly and reused.
 * Returns undefined if the plan cannot be resolved (checkout then falls back
 * to a one-off charge for the correct amount).
 */
export async function resolvePlanCode(plan: PaidPlan): Promise<string | undefined> {
  const cached = resolvedPlanCodes[plan];
  if (cached) return cached;

  const configured = planCode(plan);
  if (configured) {
    const check = await paystackFetch<{ status: boolean }>(`/plan/${configured}`);
    if (check.ok && check.body?.status) {
      resolvedPlanCodes[plan] = configured;
      return configured;
    }
    console.warn(`[paystack] configured ${plan} plan code not found on this account; creating one`);
  }

  const created = await paystackFetch<{ status: boolean; data?: { plan_code: string } }>("/plan", {
    method: "POST",
    body: JSON.stringify({
      name: plan === "standard" ? "PoultryPro Standard" : "PoultryPro Premium",
      amount: PLAN_AMOUNT_KOBO[plan],
      interval: "monthly",
      currency: "NGN",
    }),
  });
  const code = created.body?.data?.plan_code;
  if (created.ok && created.body?.status && code) {
    resolvedPlanCodes[plan] = code;
    console.log(`[paystack] created ${plan} plan ${code} — save it as PAYSTACK_${plan.toUpperCase()}_PLAN_CODE`);
    return code;
  }
  console.error(`[paystack] could not resolve ${plan} plan code; falling back to one-off charge`);
  return undefined;
}

export function planFromCode(code: string | null | undefined): PaidPlan | null {
  if (!code) return null;
  if (code === process.env["PAYSTACK_STANDARD_PLAN_CODE"]) return "standard";
  if (code === process.env["PAYSTACK_PREMIUM_PLAN_CODE"]) return "premium";
  return null;
}

export function appUrl(request: Request): string {
  const configured = process.env["APP_URL"];
  if (configured && configured.trim()) return configured.trim().replace(/\/$/, "");
  return new URL(request.url).origin;
}

export async function paystackFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: T }> {
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${paystackSecret()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, body };
}

/** Supabase client acting as the signed-in user (RLS applies). */
export function userClient(accessToken: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${accessToken}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization") ?? "";
  if (!h.startsWith("Bearer ")) return null;
  const t = h.slice(7).trim();
  return t.split(".").length === 3 ? t : null;
}

export function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Resolve the caller's farm and verify the `subscription.manage` permission.
 * Farm id is always derived server-side, never from the client.
 */
export async function resolveBillingContext(request: Request) {
  const token = bearerToken(request);
  if (!token) return { error: jsonRes({ error: "unauthorized" }, 401) } as const;

  const supabase = userClient(token);
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { error: jsonRes({ error: "unauthorized" }, 401) } as const;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ctx } = await (supabase as any).rpc("my_farm_context");
  const farmId: string | null = (ctx?.farm_id as string) ?? null;
  if (!farmId) return { error: jsonRes({ error: "no_farm" }, 400) } as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allowed } = await (supabase as any).rpc("can", {
    _farm: farmId,
    _perm: "subscription.manage",
  });
  if (!allowed) return { error: jsonRes({ error: "forbidden" }, 403) } as const;

  return {
    supabase,
    farmId,
    userId: userData.user.id,
    email: userData.user.email ?? null,
  } as const;
}

/** Result of validating a Paystack transaction amount against a plan price. */
export type AmountCheck = {
  ok: boolean;
  reason?: string;
  expectedKobo: number;
  requestedKobo: number | null;
  chargedKobo: number;
};

/**
 * Paystack may pass its transaction fee on to the customer, so `amount`
 * (what the card was charged) can exceed `requested_amount` (what PoultryPro
 * asked for). Security therefore validates the REQUESTED amount against the
 * plan price and only requires the charged amount to be >= requested.
 * When `requested_amount` is missing (older API responses), fall back to an
 * exact match on `amount`.
 */
export function verifyPaidAmount(
  plan: PaidPlan,
  tx: { amount?: unknown; requested_amount?: unknown } | null | undefined,
): AmountCheck {
  const expectedKobo = PLAN_AMOUNT_KOBO[plan];
  const chargedKobo = Number(tx?.amount);
  const rawRequested = tx?.requested_amount;
  const requestedKobo =
    rawRequested === null || rawRequested === undefined || Number.isNaN(Number(rawRequested))
      ? null
      : Number(rawRequested);

  const base = { expectedKobo, requestedKobo, chargedKobo };
  if (!Number.isFinite(chargedKobo) || chargedKobo <= 0) {
    return { ...base, ok: false, reason: "invalid_amount" };
  }
  if (requestedKobo === null) {
    return chargedKobo === expectedKobo
      ? { ...base, ok: true }
      : { ...base, ok: false, reason: "amount_mismatch" };
  }
  if (requestedKobo !== expectedKobo) {
    return { ...base, ok: false, reason: "requested_amount_mismatch" };
  }
  if (chargedKobo < requestedKobo) {
    return { ...base, ok: false, reason: "underpaid" };
  }
  return { ...base, ok: true };
}

/** Structured, secret-free log for a rejected payment verification. */
export function logVerificationFailure(ctx: {
  source: string;
  reference: string | null;
  farmId?: string | null;
  plan?: string | null;
  reason: string;
  check?: AmountCheck | null;
  txStatus?: string | null;
  gatewayResponse?: string | null;
}) {
  console.error(
    "[paystack:verify-failed]",
    JSON.stringify({
      source: ctx.source,
      reference: ctx.reference,
      farm_id: ctx.farmId ?? null,
      plan: ctx.plan ?? null,
      reason: ctx.reason,
      expected_kobo: ctx.check?.expectedKobo ?? null,
      requested_kobo: ctx.check?.requestedKobo ?? null,
      charged_kobo: ctx.check?.chargedKobo ?? null,
      tx_status: ctx.txStatus ?? null,
      gateway_response: ctx.gatewayResponse ?? null,
    }),
  );
}
