import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId } from "@/lib/farm-data";

/**
 * Role-Based Access Control.
 *
 * Permissions are DATA, never hard-coded branches. The database owns the
 * catalogue (`farm_roles` + `role_permissions`) and returns the signed-in
 * user's effective permission list through `my_farm_context()`. Adding a new
 * role (Veterinarian, Accountant, Store Keeper, Inspector…) is a data change:
 * insert the role and its permission rows — no application code changes.
 *
 * Every permission is `<module>.<action>`. The wildcard `*` grants everything
 * and is reserved for the Farm Owner.
 */

export type PermissionKey =
  | "*"
  | "dashboard.view"
  | "production.read" | "production.write" | "production.delete"
  | "feed.read" | "feed.write" | "feed.delete"
  | "inventory.read" | "inventory.write" | "inventory.delete"
  | "formulas.read" | "formulas.write"
  | "health.read" | "health.write" | "health.delete"
  | "mortality.read" | "mortality.write" | "mortality.delete"
  | "rooms.read" | "rooms.write" | "rooms.delete"
  | "prices.read" | "prices.write" | "prices.delete"
  | "sales.read" | "sales.write"
  | "customers.read" | "customers.write"
  | "payments.read" | "payments.write"
  | "financials.read"
  | "reports.read"
  | "ai.view"
  | "settings.write"
  | "staff.manage"
  | "subscription.manage"
  | "audit.read"
  | "export.run";

export type FarmContext = {
  hasMembership: boolean;
  memberId: string | null;
  farmId: string | null;
  role: string;
  roleLabel: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  mustChangePassword: boolean;
  permissions: string[];
};

const EMPTY: FarmContext = {
  hasMembership: false,
  memberId: null,
  farmId: null,
  role: "owner",
  roleLabel: "Farm Owner",
  fullName: "",
  email: null,
  phone: null,
  status: "active",
  mustChangePassword: false,
  permissions: ["*"],
};

type RawContext = {
  has_membership?: boolean;
  member_id?: string;
  farm_id?: string;
  role?: string;
  role_label?: string;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  must_change_password?: boolean;
  permissions?: string[];
};

export function useFarmContext() {
  const { data: userId } = useAuthUserId();
  return useQuery({
    queryKey: ["farm-context", userId ?? "anon"],
    enabled: !!userId,
    networkMode: "always",
    staleTime: 60_000,
    queryFn: async (): Promise<FarmContext> => {
      const { data, error } = await supabase.rpc("my_farm_context");
      if (error) throw error;
      const raw = (data ?? {}) as RawContext;
      if (!raw.has_membership) return EMPTY;
      return {
        hasMembership: true,
        memberId: raw.member_id ?? null,
        farmId: raw.farm_id ?? null,
        role: raw.role ?? "owner",
        roleLabel: raw.role_label ?? "Farm Owner",
        fullName: raw.full_name ?? "",
        email: raw.email ?? null,
        phone: raw.phone ?? null,
        status: raw.status ?? "active",
        mustChangePassword: !!raw.must_change_password,
        permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
      };
    },
  });
}

export function grants(permissions: string[] | undefined, permission: PermissionKey | string) {
  if (!permissions) return false;
  return permissions.includes("*") || permissions.includes(permission);
}

/** `can("prices.write")` — resolves while the context is still loading as `false`. */
export function usePermissions() {
  const { data, isPending } = useFarmContext();
  const permissions = data?.permissions ?? [];
  return {
    ctx: data ?? EMPTY,
    loading: isPending,
    permissions,
    can: (permission: PermissionKey | string) => grants(permissions, permission),
    canAny: (list: (PermissionKey | string)[]) => list.some((p) => grants(permissions, p)),
    isOwner: (data?.role ?? "owner") === "owner",
    role: data?.role ?? "owner",
    roleLabel: data?.roleLabel ?? "Farm Owner",
  };
}

/** Visual identity per role. New roles fall back to the neutral style. */
export const ROLE_STYLES: Record<string, { badge: string; dot: string }> = {
  owner: {
    badge: "bg-[color:var(--gold)]/15 text-[color:var(--gold)] border-[color:var(--gold)]/30",
    dot: "bg-[color:var(--gold)]",
  },
  manager: {
    badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  sales: {
    badge: "bg-sky-500/15 text-sky-700 border-sky-500/30",
    dot: "bg-sky-500",
  },
};

export function roleStyle(role: string) {
  return ROLE_STYLES[role] ?? { badge: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" };
}

/** Landing route for each role right after sign-in. */
export function homeRouteForRole(role: string): string {
  if (role === "sales") return "/sales";
  return "/dashboard";
}
