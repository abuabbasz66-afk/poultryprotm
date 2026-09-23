// Customer engagement & retention layer.
//
// Messages are staff-assisted: PoultryPro decides WHO should hear from us,
// writes a personalised, consent-checked message, and the admin sends it from
// their own WhatsApp/phone. Nothing is sent automatically and every send is
// logged in the database. All segment data comes from real records.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId } from "@/lib/farm-data";

/* ------------------------------------------------------------------ */
/* Consent                                                             */
/* ------------------------------------------------------------------ */

export type CommunicationPrefs = {
  whatsappOptIn: boolean;
  smsOptIn: boolean;
  phoneContactOptIn: boolean;
  marketingOptIn: boolean;
  subscriptionNotificationsOptIn: boolean;
  phone: string | null;
  consentDate: string | null;
  consentSource: string | null;
};

export const EMPTY_PREFS: CommunicationPrefs = {
  whatsappOptIn: false,
  smsOptIn: false,
  phoneContactOptIn: false,
  marketingOptIn: false,
  subscriptionNotificationsOptIn: true,
  phone: null,
  consentDate: null,
  consentSource: null,
};

export function useCommunicationPrefs() {
  const { data: userId } = useAuthUserId();
  return useQuery({
    queryKey: ["communication-prefs", userId ?? "anon"],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<CommunicationPrefs> => {
      const { data, error } = await supabase
        .from("communication_preferences")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) return EMPTY_PREFS;
      return {
        whatsappOptIn: !!data.whatsapp_opt_in,
        smsOptIn: !!data.sms_opt_in,
        phoneContactOptIn: !!data.phone_contact_opt_in,
        marketingOptIn: !!data.marketing_opt_in,
        subscriptionNotificationsOptIn: data.subscription_notifications_opt_in !== false,
        phone: data.phone ?? null,
        consentDate: data.consent_date ?? null,
        consentSource: data.consent_source ?? null,
      };
    },
  });
}

export function useSaveCommunicationPrefs() {
  const { data: userId } = useAuthUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<CommunicationPrefs>) => {
      if (!userId) throw new Error("Not signed in");
      const row = {
        user_id: userId,
        whatsapp_opt_in: patch.whatsappOptIn,
        sms_opt_in: patch.smsOptIn,
        phone_contact_opt_in: patch.phoneContactOptIn,
        marketing_opt_in: patch.marketingOptIn,
        subscription_notifications_opt_in: patch.subscriptionNotificationsOptIn,
        phone: patch.phone ?? null,
        consent_date: new Date().toISOString(),
        consent_source: "settings",
      };
      const { error } = await supabase
        .from("communication_preferences")
        .upsert(row as never, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["communication-prefs"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Call requests                                                       */
/* ------------------------------------------------------------------ */

export function useRequestCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reason: string; phone: string }) => {
      const { data, error } = await supabase.rpc("request_support_call", {
        _reason: input.reason,
        _phone: input.phone,
      });
      if (error) throw error;
      const j = (data ?? {}) as { ok?: boolean; reason?: string };
      if (!j.ok) throw new Error(j.reason ?? "Could not send your request");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-call-requests"] }),
  });
}

export function useMyCallRequests() {
  const { data: userId } = useAuthUserId();
  return useQuery({
    queryKey: ["my-call-requests", userId ?? "anon"],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engagement_call_requests")
        .select("id, reason, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Segments                                                            */
/* ------------------------------------------------------------------ */

export type Segment =
  | "REGISTERED_NOT_SETUP"
  | "SETUP_INCOMPLETE"
  | "ACTIVATED_FREE"
  | "ACTIVE_FREE"
  | "INACTIVE_FREE"
  | "CHECKOUT_STARTED"
  | "PAYMENT_FAILED"
  | "PREMIUM_ACTIVE"
  | "PREMIUM_EXPIRING"
  | "PREMIUM_EXPIRED"
  | "CANCELLED";

export const SEGMENT_LABEL: Record<string, string> = {
  REGISTERED_NOT_SETUP: "Registered, no farm yet",
  SETUP_INCOMPLETE: "Setup unfinished",
  ACTIVATED_FREE: "Free — farm set up",
  ACTIVE_FREE: "Free — actively recording",
  INACTIVE_FREE: "Free — inactive",
  CHECKOUT_STARTED: "Checkout not completed",
  PAYMENT_FAILED: "Payment did not go through",
  PREMIUM_ACTIVE: "On a paid plan",
  PREMIUM_EXPIRING: "Paid plan ending soon",
  PREMIUM_EXPIRED: "Paid plan ended",
  CANCELLED: "Cancelled",
};

export type AudienceRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  farm_id: string | null;
  farm_name: string | null;
  plan: string;
  farm_status: string | null;
  segment: Segment;
  registered_at: string;
  last_activity: string | null;
  active_days: number;
  has_production: boolean;
  has_feed: boolean;
  has_health: boolean;
  has_finance: boolean;
  expires_at: string | null;
  whatsapp_opt_in: boolean;
  sms_opt_in: boolean;
  phone_contact_opt_in: boolean;
  marketing_opt_in: boolean;
  last_message_at: string | null;
  messages_24h: number;
  messages_7d: number;
  can_send_marketing: boolean;
  block_reason: string | null;
};

export function useEngagementAudience(segment: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["engagement-audience", segment ?? "all"],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<AudienceRow[]> => {
      const { data, error } = await supabase.rpc("admin_engagement_audience", {
        _segment: segment ?? undefined,
        _limit: 500,
      });
      if (error) throw error;
      return (data ?? []) as unknown as AudienceRow[];
    },
  });
}

export function useEngagementStats(enabled: boolean) {
  return useQuery({
    queryKey: ["engagement-stats"],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await supabase.rpc("admin_engagement_stats");
      if (error) throw error;
      return (data ?? {}) as Record<string, unknown>;
    },
  });
}

export type EngagementMessage = {
  id: string;
  user_id: string;
  farm_id: string | null;
  campaign_key: string;
  category: string;
  channel: string;
  segment: string | null;
  body: string;
  phone: string | null;
  status: string;
  outcome: string | null;
  sent_at: string;
  responded_at: string | null;
};

export function useEngagementHistory(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["engagement-history", userId ?? "all"],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<EngagementMessage[]> => {
      const { data, error } = await supabase.rpc("admin_engagement_history", {
        _user_id: userId ?? undefined,
        _limit: 200,
      });
      if (error) throw error;
      return (data ?? []) as unknown as EngagementMessage[];
    },
  });
}

export function useLogEngagementMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      farmId: string | null;
      campaignKey: string;
      category: "service" | "marketing";
      channel: "whatsapp" | "sms" | "phone";
      segment: string | null;
      body: string;
      phone: string | null;
    }) => {
      const { data, error } = await supabase.rpc("admin_log_engagement_message", {
        _user_id: input.userId,
        _campaign_key: input.campaignKey,
        _category: input.category,
        _channel: input.channel,
        _body: input.body,
        _farm_id: input.farmId ?? undefined,
        _segment: input.segment ?? undefined,
        _phone: input.phone ?? undefined,
      });
      if (error) throw error;
      const j = (data ?? {}) as { ok?: boolean; reason?: string };
      if (!j.ok) throw new Error(j.reason ?? "Message not recorded");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engagement-audience"] });
      qc.invalidateQueries({ queryKey: ["engagement-history"] });
      qc.invalidateQueries({ queryKey: ["engagement-stats"] });
    },
  });
}

export function useSetMessageStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: string }) => {
      const { error } = await supabase.rpc("admin_set_engagement_status", {
        _id: input.id,
        _status: input.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engagement-history"] });
      qc.invalidateQueries({ queryKey: ["engagement-stats"] });
    },
  });
}

export type CallRequestRow = {
  id: string;
  user_id: string;
  email: string | null;
  farm_id: string | null;
  farm_name: string | null;
  phone: string | null;
  reason: string | null;
  status: string;
  notes: string | null;
  plan: string;
  created_at: string;
};

export function useCallRequests(enabled: boolean) {
  return useQuery({
    queryKey: ["engagement-call-requests"],
    enabled,
    staleTime: 20_000,
    queryFn: async (): Promise<CallRequestRow[]> => {
      const { data, error } = await supabase.rpc("admin_list_call_requests", { _limit: 200 });
      if (error) throw error;
      return (data ?? []) as unknown as CallRequestRow[];
    },
  });
}

export function useSetCallRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase.rpc("admin_set_call_request", {
        _id: input.id,
        _status: input.status,
        _notes: input.notes ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engagement-call-requests"] });
      qc.invalidateQueries({ queryKey: ["engagement-stats"] });
    },
  });
}

export function useSaveFrequencyLimits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (limits: { per_day: number; per_week: number }) => {
      const { error } = await supabase.rpc("admin_set_setting", {
        _key: "engagement_frequency",
        _value: limits as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engagement-stats"] });
      qc.invalidateQueries({ queryKey: ["engagement-audience"] });
    },
  });
}
