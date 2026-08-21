import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId } from "@/lib/farm-data";

export type PlanTier = "basic" | "standard" | "premium";

export type SubscriptionStatus = {
  hasFarm: boolean;
  farmId: string | null;
  plan: PlanTier;              // paid plan the user is subscribed to
  effectivePlan: PlanTier;     // effective plan right now (premium during trial)
  isTrial: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  daysRemaining: number;
  autoRenew: boolean;
  status: string | null;       // farm account status (active/suspended)
  paystackSubscriptionCode: string | null;
  paystackSubscriptionStatus: string | null;
  subscriptionStartedAt: string | null;
  nextPaymentAt: string | null;
};


function normalizePlan(p: unknown): PlanTier {
  const v = String(p ?? "basic").toLowerCase();
  if (v === "premium") return "premium";
  if (v === "standard") return "standard";
  return "basic";
}

export function useSubscription() {
  const { data: userId } = useAuthUserId();
  return useQuery({
    queryKey: ["subscription", userId ?? "anon"],
    enabled: !!userId,
    queryFn: async (): Promise<SubscriptionStatus> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("farm_subscription_status");
      if (error) throw error;
      const j = (data ?? {}) as Record<string, unknown>;
      return {
        hasFarm: Boolean(j.has_farm),
        farmId: (j.farm_id as string) ?? null,
        plan: normalizePlan(j.plan),
        effectivePlan: normalizePlan(j.effective_plan),
        isTrial: Boolean(j.is_trial),
        trialStartedAt: (j.trial_started_at as string) ?? null,
        trialEndsAt: (j.trial_ends_at as string) ?? null,
        daysRemaining: Number(j.days_remaining ?? 0),
        autoRenew: Boolean(j.auto_renew),
        status: (j.status as string) ?? null,
        paystackSubscriptionCode: (j.paystack_subscription_code as string) ?? null,
        paystackSubscriptionStatus: (j.paystack_subscription_status as string) ?? null,
        subscriptionStartedAt: (j.subscription_started_at as string) ?? null,
        nextPaymentAt: (j.subscription_next_payment_at as string) ?? null,
      };

    },
    staleTime: 60_000,
  });
}

/** Convenience: returns the effective plan (defaults to "basic" until data loads). */
export function useEffectivePlan(): PlanTier {
  const { data } = useSubscription();
  return data?.effectivePlan ?? "basic";
}

/** Capability matrix — anything gated in the UI should read from here. */
export const PLAN_CAPS: Record<PlanTier, {
  advancedAnalytics: boolean;
  revenueTracking: boolean;
  financialDashboard: boolean;
  csvExport: boolean;
  pdfReports: boolean;
  multiUser: boolean;
  aiIntelligence: boolean;
  maxFarms: number;
  maxBirds: number;
}> = {
  basic: {
    advancedAnalytics: false, revenueTracking: false, financialDashboard: false,
    csvExport: false, pdfReports: false, multiUser: false, aiIntelligence: false,
    maxFarms: 1, maxBirds: 500,
  },
  standard: {
    advancedAnalytics: true, revenueTracking: true, financialDashboard: true,
    csvExport: true, pdfReports: true, multiUser: false, aiIntelligence: false,
    maxFarms: 5, maxBirds: 5000,
  },
  premium: {
    advancedAnalytics: true, revenueTracking: true, financialDashboard: true,
    csvExport: true, pdfReports: true, multiUser: true, aiIntelligence: true,
    maxFarms: Infinity, maxBirds: Infinity,
  },
};

export const PLAN_PRICE_NGN: Record<PlanTier, number> = {
  basic: 0,
  standard: 950,
  premium: 1950,
};

export function formatNaira(n: number): string {
  if (n === 0) return "Free";
  return `₦${n.toLocaleString("en-NG")}`;
}
