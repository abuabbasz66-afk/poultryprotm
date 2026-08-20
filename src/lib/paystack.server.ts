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
