// Super Admin API — thin wrappers around SECURITY DEFINER RPCs.
// Every RPC internally re-checks is_super_admin() so non-admins are rejected
// at the database, not just here.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PlatformStats = {
  total_accounts: number;
  total_farms: number;
  active_farms: number;
  suspended_accounts: number;
  new_users_today: number;
  new_users_this_month: number;
  new_farms_this_month: number;
  basic_plan_farms: number;
  standard_plan_farms: number;
  premium_plan_farms: number;
  total_production_records: number;
  total_feed_records: number;
  total_mortality_records: number;
  total_health_records: number;
  recent_signups_7d: number;
  recent_farms_7d: number;
};

export type AdminAccount = {
  user_id: string;
  email: string | null;
  account_created: string;
  last_sign_in: string | null;
  farm_id: string | null;
  farm_name: string | null;
  owner_name: string | null;
  subscription_plan: string | null;
  status: string | null;
};

export type AdminFarm = {
  farm_id: string;
  farm_name: string;
  owner_name: string | null;
  owner_email: string | null;
  location: string | null;
  state: string | null;
  country: string | null;
  bird_count: number | null;
  rooms_count: number;
  subscription_plan: string;
  status: string;
  created_at: string;
};

export type AuditEntry = {
  id: string;
  admin_user_id: string;
  admin_email: string | null;
  action_type: string;
  affected_user_id: string | null;
  affected_farm_id: string | null;
  affected_farm_name: string | null;
  previous_value: any;
  new_value: any;
  reason: string | null;
  created_at: string;
};

const ADMIN_KEY = (userId: string | null | undefined, ...rest: unknown[]) =>
  ["admin", userId ?? "anon", ...rest] as const;

export function useIsSuperAdmin() {
  return useQuery({
    queryKey: ["admin", "is-super-admin"],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("is_super_admin");
      if (error) return false;
      return !!data;
    },
    staleTime: 60_000,
  });
}

export function usePlatformStats(userId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_KEY(userId, "stats"),
    enabled,
    queryFn: async (): Promise<PlatformStats> => {
      const { data, error } = await supabase.rpc("admin_platform_stats");
      if (error) throw error;
      return data as PlatformStats;
    },
  });
}

export function useAdminAccounts(userId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_KEY(userId, "accounts"),
    enabled,
    queryFn: async (): Promise<AdminAccount[]> => {
      const { data, error } = await supabase.rpc("admin_list_accounts");
      if (error) throw error;
      return (data ?? []) as AdminAccount[];
    },
  });
}

export function useAdminFarms(userId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_KEY(userId, "farms"),
    enabled,
    queryFn: async (): Promise<AdminFarm[]> => {
      const { data, error } = await supabase.rpc("admin_list_farms");
      if (error) throw error;
      return (data ?? []) as AdminFarm[];
    },
  });
}

export function useAdminFarmSummary(userId: string | null | undefined, farmId: string | null) {
  return useQuery({
    queryKey: ADMIN_KEY(userId, "farm-summary", farmId),
    enabled: !!farmId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_farm_summary", { _farm_id: farmId! });
      if (error) throw error;
      return data as any;
    },
  });
}

export function useAdminIntelligence(userId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_KEY(userId, "intelligence"),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_intelligence_summary");
      if (error) throw error;
      return data as any;
    },
  });
}

export function useAdminAuditLog(userId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_KEY(userId, "audit"),
    enabled,
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await supabase.rpc("admin_list_audit_log", { _limit: 200 });
      if (error) throw error;
      return (data ?? []) as AuditEntry[];
    },
  });
}

export function useChangeSubscription(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { farm_id: string; new_plan: string; reason?: string }) => {
      const { data, error } = await supabase.rpc("admin_change_subscription", {
        _farm_id: args.farm_id,
        _new_plan: args.new_plan,
        _reason: args.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", userId ?? "anon"] });
    },
  });
}

export function useSetAccountStatus(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { farm_id: string; new_status: "active" | "suspended"; reason?: string }) => {
      const { data, error } = await supabase.rpc("admin_set_account_status", {
        _farm_id: args.farm_id,
        _new_status: args.new_status,
        _reason: args.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", userId ?? "anon"] });
    },
  });
}

export function useDeleteAccount(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { user_id: string; reason?: string }) => {
      const { data, error } = await supabase.rpc("admin_delete_account", {
        _user_id: args.user_id,
        _reason: args.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", userId ?? "anon"] });
    },
  });
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

// ---------- Admin notifications ----------
export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, any> | null;
  related_user_id: string | null;
  related_farm_id: string | null;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
  read_at: string | null;
  archived_at: string | null;
};

export function useAdminNotifications(userId: string | null | undefined, enabled: boolean, includeArchived = false) {
  return useQuery({
    queryKey: ADMIN_KEY(userId, "notifications", includeArchived),
    enabled,
    queryFn: async (): Promise<AdminNotification[]> => {
      const { data, error } = await supabase.rpc("admin_list_notifications", {
        _include_archived: includeArchived,
        _limit: 200,
      });
      if (error) throw error;
      return (data ?? []) as AdminNotification[];
    },
  });
}

export function useMarkNotificationRead(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_mark_notification_read", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", userId ?? "anon", "notifications"] }),
  });
}

export function useMarkAllNotificationsRead(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_mark_all_notifications_read");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", userId ?? "anon", "notifications"] }),
  });
}

export function useArchiveNotification(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_archive_notification", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", userId ?? "anon", "notifications"] }),
  });
}

