// Platform Monitoring & Farm Intelligence — hooks that back the Super Admin
// Monitoring Center. Every RPC re-checks is_super_admin() at the DB level.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------- Types ----------
export type FarmIntelligencePayload = {
  farm: Record<string, unknown> | null;
  owner: { email?: string; created_at?: string; last_sign_in_at?: string | null } | null;
  rooms: Array<Record<string, unknown>>;
  totals: {
    birds: number; eggs: number; crates: number;
    feed_bags: number; mortality: number; health_records: number;
  };
  production_90: Array<{ d: string; v: number }>;
  feed_90: Array<{ d: string; v: number }>;
  mortality_90: Array<{ d: string; v: number }>;
  recent_production: Array<Record<string, unknown>>;
  recent_feed: Array<Record<string, unknown>>;
  recent_mortality: Array<Record<string, unknown>>;
  recent_health: Array<Record<string, unknown>>;
  prices: Array<Record<string, unknown>>;
};

export type ActivityFilters = {
  farm_id?: string | null;
  user_id?: string | null;
  module?: string | null;
  action?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
  offset?: number;
};

export type ActivityRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  farm_id: string | null;
  farm_name: string | null;
  module: string;
  action: string;
  entity_id: string | null;
  device: string | null;
  browser: string | null;
  ip_address: string | null;
  success: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  total_count: number;
};

export type PlatformTimeseries = {
  farm_growth: Array<{ d: string; v: number }>;
  user_growth: Array<{ d: string; v: number }>;
  dau: Array<{ d: string; v: number }>;
  eggs: Array<{ d: string; v: number }>;
  feed: Array<{ d: string; v: number }>;
  mortality: Array<{ d: string; v: number }>;
  top_farms_production: Array<{ farm_name: string; eggs: number }>;
  most_active_farms: Array<{ farm_name: string; events: number }>;
};

export type SupportSession = {
  id: string;
  admin_user_id: string;
  farm_id: string;
  reason: string;
  started_at: string;
  ended_at: string | null;
};

// ---------- Hooks ----------
const KEY = (userId: string | null | undefined, ...rest: unknown[]) =>
  ["admin-monitoring", userId ?? "anon", ...rest] as const;

export function useFarmIntelligence(userId: string | null | undefined, farmId: string | null) {
  return useQuery({
    queryKey: KEY(userId, "farm-intel", farmId),
    enabled: !!farmId,
    staleTime: 30_000,
    queryFn: async (): Promise<FarmIntelligencePayload> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_farm_intelligence", { _farm_id: farmId! });
      if (error) throw error;
      return data as FarmIntelligencePayload;
    },
  });
}

export function useActivityLog(userId: string | null | undefined, filters: ActivityFilters, enabled: boolean) {
  return useQuery({
    queryKey: KEY(userId, "activity", filters),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<ActivityRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_list_activity", {
        _farm_id: filters.farm_id ?? null,
        _user_id: filters.user_id ?? null,
        _module: filters.module ?? null,
        _action: filters.action ?? null,
        _from: filters.from ?? null,
        _to: filters.to ?? null,
        _limit: filters.limit ?? 100,
        _offset: filters.offset ?? 0,
      });
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });
}

export function usePlatformTimeseries(userId: string | null | undefined, enabled: boolean, days = 90) {
  return useQuery({
    queryKey: KEY(userId, "timeseries", days),
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<PlatformTimeseries> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_platform_timeseries", { _days: days });
      if (error) throw error;
      return data as PlatformTimeseries;
    },
  });
}

export function useActiveSupportSession(userId: string | null | undefined, farmId: string | null) {
  return useQuery({
    queryKey: KEY(userId, "support-active", farmId),
    enabled: !!farmId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<SupportSession | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_active_support_session", { _farm_id: farmId! });
      if (error) throw error;
      const rows = (data ?? []) as SupportSession[];
      return rows[0] ?? null;
    },
  });
}

export function useStartSupport(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { farm_id: string; reason: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_start_support", {
        _farm_id: args.farm_id, _reason: args.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-monitoring", userId ?? "anon"] }),
  });
}

export function useEndSupport(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (session_id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_end_support", { _session_id: session_id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-monitoring", userId ?? "anon"] }),
  });
}

export function usePlatformSettings(userId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: KEY(userId, "settings"),
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, unknown>> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_get_settings");
      if (error) throw error;
      return (data ?? {}) as Record<string, unknown>;
    },
  });
}

export function useSetSetting(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { key: string; value: unknown }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_set_setting", { _key: args.key, _value: args.value });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(userId, "settings") }),
  });
}
