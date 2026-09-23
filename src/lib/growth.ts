// Product growth / activation layer.
// Every number here comes from real database records — nothing is simulated.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId } from "@/lib/farm-data";

/* ------------------------------------------------------------------ */
/* Product events                                                      */
/* ------------------------------------------------------------------ */

export type ProductEventName =
  | "ACCOUNT_CREATED"
  | "FARM_CREATED"
  | "FLOCK_CREATED"
  | "ROOM_CREATED"
  | "FIRST_PRODUCTION"
  | "FIRST_FEED"
  | "FIRST_MORTALITY"
  | "FIRST_HEALTH"
  | "FIRST_FINANCE"
  | "FIRST_INSIGHT_VIEWED"
  | "ONBOARDING_GOAL_SET"
  | "ONBOARDING_COMPLETED"
  | "ANALYTICS_VIEWED"
  | "REPORT_CREATED"
  | "PRICING_VIEWED"
  | "UPGRADE_VIEWED"
  | "PREMIUM_FEATURE_VIEWED"
  | "UPGRADE_CLICKED"
  | "CHECKOUT_STARTED"
  | "CHECKOUT_ABANDONED"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "SUBSCRIPTION_ACTIVATED"
  | "SUBSCRIPTION_CANCELLED"
  | "FEEDBACK_SUBMITTED";

/**
 * Fire-and-forget product event. Analytics must never break a farm record:
 * failures are swallowed and only logged to the console.
 */
export function trackEvent(
  event: ProductEventName,
  opts: {
    farmId?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
  } = {},
): void {
  try {
    void supabase
      .rpc("track_product_event", {
        _event_name: event,
        _farm_id: opts.farmId ?? undefined,
        _resource_type: opts.resourceType ?? undefined,
        _resource_id: opts.resourceId ?? undefined,
        _metadata: (opts.metadata ?? {}) as never,
      })
      .then(
        () => undefined,
        (err: unknown) => console.warn("[growth] event not recorded", event, err),
      );
  } catch (err) {
    console.warn("[growth] event not recorded", event, err);
  }
}

/* ------------------------------------------------------------------ */
/* Activation                                                          */
/* ------------------------------------------------------------------ */

export type ActivationStatus = {
  hasFarm: boolean;
  hasFlock: boolean;
  hasRoom: boolean;
  hasProduction: boolean;
  hasOperational: boolean;
  activated: boolean;
  firstRecordAt: string | null;
  activeDays: number;
  activityCount: number;
  farmId: string | null;
};

export function useActivation() {
  const { data: userId } = useAuthUserId();
  return useQuery({
    queryKey: ["activation", userId ?? "anon"],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<ActivationStatus> => {
      const { data, error } = await supabase.rpc("farm_activation_status");
      if (error) throw error;
      const j = (data ?? {}) as Record<string, unknown>;
      return {
        hasFarm: Boolean(j.has_farm),
        hasFlock: Boolean(j.has_flock),
        hasRoom: Boolean(j.has_room),
        hasProduction: Boolean(j.has_production),
        hasOperational: Boolean(j.has_operational),
        activated: Boolean(j.activated),
        firstRecordAt: (j.first_record_at as string) ?? null,
        activeDays: Number(j.active_days ?? 0),
        activityCount: Number(j.activity_count ?? 0),
        farmId: (j.farm_id as string) ?? null,
      };
    },
  });
}

/* ------------------------------------------------------------------ */
/* Onboarding state                                                    */
/* ------------------------------------------------------------------ */

export const ONBOARDING_GOALS = [
  { key: "production", label: "Track egg production", hint: "Daily eggs, crates and production rate" },
  { key: "feed", label: "Control feed costs", hint: "Feed usage, stock and cost per bird" },
  { key: "health", label: "Monitor mortality and flock health", hint: "Deaths, treatments and vaccination" },
  { key: "profit", label: "Understand farm profit", hint: "Revenue, expenses and margins" },
  { key: "multi_farm", label: "Manage multiple farms", hint: "Rooms, staff and several locations" },
  { key: "explore", label: "Explore PoultryPro", hint: "Have a look around first" },
] as const;

export type OnboardingGoal = (typeof ONBOARDING_GOALS)[number]["key"];

export type OnboardingState = {
  primaryGoal: string | null;
  goalSetAt: string | null;
  checklistDismissedAt: string | null;
  completedAt: string | null;
  firstInsightSeenAt: string | null;
  upgradePromptDismissedAt: string | null;
  checkoutReminderDismissedAt: string | null;
  feedbackPromptDismissedAt: string | null;
  whatsappConsent: boolean;
  phone: string | null;
};

const EMPTY_ONBOARDING: OnboardingState = {
  primaryGoal: null,
  goalSetAt: null,
  checklistDismissedAt: null,
  completedAt: null,
  firstInsightSeenAt: null,
  upgradePromptDismissedAt: null,
  checkoutReminderDismissedAt: null,
  feedbackPromptDismissedAt: null,
  whatsappConsent: false,
  phone: null,
};

export function useOnboarding() {
  const { data: userId } = useAuthUserId();
  return useQuery({
    queryKey: ["onboarding-state", userId ?? "anon"],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<OnboardingState> => {
      const { data, error } = await supabase
        .from("user_onboarding")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return EMPTY_ONBOARDING;
      return {
        primaryGoal: data.primary_goal,
        goalSetAt: data.goal_set_at,
        checklistDismissedAt: data.checklist_dismissed_at,
        completedAt: data.completed_at,
        firstInsightSeenAt: data.first_insight_seen_at,
        upgradePromptDismissedAt: data.upgrade_prompt_dismissed_at,
        checkoutReminderDismissedAt: data.checkout_reminder_dismissed_at,
        feedbackPromptDismissedAt: data.feedback_prompt_dismissed_at,
        whatsappConsent: Boolean(data.whatsapp_consent),
        phone: data.phone,
      };
    },
  });
}

type OnboardingPatch = Partial<{
  primary_goal: string | null;
  goal_set_at: string | null;
  checklist_dismissed_at: string | null;
  completed_at: string | null;
  first_insight_seen_at: string | null;
  upgrade_prompt_dismissed_at: string | null;
  checkout_reminder_dismissed_at: string | null;
  feedback_prompt_dismissed_at: string | null;
  whatsapp_consent: boolean;
  phone: string | null;
}>;

export function useSaveOnboarding() {
  const { data: userId } = useAuthUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: OnboardingPatch) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("user_onboarding")
        .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-state"] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export type FeedbackInput = {
  kind: "product" | "exit" | "interview";
  farmId?: string | null;
  sentiment?: string | null;
  reason?: string | null;
  message?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  farmSize?: string | null;
  mainChallenge?: string | null;
  preferredContact?: string | null;
};

export function useSubmitFeedback() {
  const { data: userId } = useAuthUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FeedbackInput) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("user_feedback").insert({
        user_id: userId,
        farm_id: input.farmId ?? null,
        kind: input.kind,
        sentiment: input.sentiment ?? null,
        reason: input.reason ?? null,
        message: input.message ?? null,
        contact_name: input.contactName ?? null,
        contact_email: input.contactEmail ?? null,
        contact_phone: input.contactPhone ?? null,
        farm_size: input.farmSize ?? null,
        main_challenge: input.mainChallenge ?? null,
        preferred_contact: input.preferredContact ?? null,
      });
      if (error) throw error;
      trackEvent("FEEDBACK_SUBMITTED", { farmId: input.farmId ?? null, metadata: { kind: input.kind } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-feedback"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Admin growth analytics                                              */
/* ------------------------------------------------------------------ */

export type GrowthStats = {
  total_users: number;
  new_users_30d: number;
  total_farms: number;
  activated_farms: number;
  repeat_usage_farms: number;
  free_farms: number;
  standard_farms: number;
  premium_farms: number;
  upgrade_viewed_farms: number;
  checkout_started_farms: number;
  paid_farms: number;
  cancelled_events: number;
  mrr_ngn: number;
};

export type GrowthDropoff = {
  registered_no_farm: number;
  farm_no_flock: number;
  farm_no_production: number;
  single_session_farms: number;
  active_no_upgrade_view: number;
  checkout_without_payment: number;
};

export function useGrowthStats(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-growth-stats"],
    enabled,
    queryFn: async (): Promise<GrowthStats> => {
      const { data, error } = await supabase.rpc("admin_growth_stats");
      if (error) throw error;
      return data as unknown as GrowthStats;
    },
  });
}

export function useGrowthDropoff(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-growth-dropoff"],
    enabled,
    queryFn: async (): Promise<GrowthDropoff> => {
      const { data, error } = await supabase.rpc("admin_growth_dropoff");
      if (error) throw error;
      return data as unknown as GrowthDropoff;
    },
  });
}

export type FeedbackRow = {
  id: string;
  user_id: string;
  farm_id: string | null;
  kind: string;
  sentiment: string | null;
  reason: string | null;
  message: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  farm_size: string | null;
  main_challenge: string | null;
  preferred_contact: string | null;
  status: string;
  created_at: string;
};

export function useAdminFeedback(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-feedback"],
    enabled,
    queryFn: async (): Promise<FeedbackRow[]> => {
      const { data, error } = await supabase.rpc("admin_list_feedback", { _limit: 200 });
      if (error) throw error;
      return (data ?? []) as unknown as FeedbackRow[];
    },
  });
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}
