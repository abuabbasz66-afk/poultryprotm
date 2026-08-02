import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Staff account provisioning. These are the only operations that need the
 * privileged auth admin API (creating logins, resetting passwords, removing
 * accounts). Everything else — role changes, suspension, listing — runs through
 * permission-checked database functions callable by the owner directly.
 *
 * Every handler re-verifies `staff.manage` for the caller's own farm using the
 * caller's session (RLS applies) before touching the admin client.
 */

type StaffMode = "password" | "invite";

export type CreateStaffInput = {
  fullName: string;
  email?: string;
  phone?: string;
  roleKey: string;
  mode: StaffMode;
  tempPassword?: string;
  origin?: string;
};

const PHONE_DOMAIN = "phone.poultrypro.life";

function digits(value: string | undefined | null) {
  return (value ?? "").replace(/[^0-9]/g, "");
}

function loginEmailFor(input: { email?: string; phone?: string }) {
  const email = (input.email ?? "").trim().toLowerCase();
  if (email) return email;
  const phone = digits(input.phone);
  if (!phone) return null;
  return `${phone}@${PHONE_DOMAIN}`;
}

/** Resolves the caller's farm and asserts they may manage staff there. */
async function requireStaffManager(context: { supabase: any; userId: string }) {
  const { data: ctx, error } = await context.supabase.rpc("my_farm_context");
  if (error) throw error;
  const farmId = (ctx as any)?.farm_id as string | undefined;
  const permissions = ((ctx as any)?.permissions ?? []) as string[];
  if (!farmId) throw new Error("No farm found for this account.");
  if (!permissions.includes("*") && !permissions.includes("staff.manage")) {
    throw new Error("You do not have permission to manage staff.");
  }
  return farmId;
}

export const createStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateStaffInput) => data)
  .handler(async ({ data, context }) => {
    const farmId = await requireStaffManager(context as any);

    const fullName = (data.fullName ?? "").trim();
    if (!fullName) throw new Error("Please enter the staff member's name.");
    if (data.roleKey === "owner") throw new Error("The Owner role cannot be assigned.");

    const loginEmail = loginEmailFor(data);
    if (!loginEmail) throw new Error("Provide an email address or a phone number.");
    if (data.mode === "invite" && !(data.email ?? "").trim()) {
      throw new Error("An email address is required to send an invitation link.");
    }
    if (data.mode === "password" && (data.tempPassword ?? "").length < 8) {
      throw new Error("The temporary password must be at least 8 characters.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let userId: string;
    if (data.mode === "invite") {
      const redirectTo = `${(data.origin ?? "https://poultrypro.life").replace(/\/$/, "")}/reset-password`;
      const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(loginEmail, {
        redirectTo,
        data: { full_name: fullName, phone: data.phone ?? null },
      });
      if (error) throw new Error(error.message);
      userId = invited.user!.id;
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: loginEmail,
        password: data.tempPassword!,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone: data.phone ?? null },
      });
      if (error) throw new Error(error.message);
      userId = created.user!.id;
    }

    const { error: insertError } = await supabaseAdmin.from("farm_members").insert({
      farm_id: farmId,
      user_id: userId,
      full_name: fullName,
      email: (data.email ?? "").trim() || loginEmail,
      phone: data.phone ?? null,
      role_key: data.roleKey,
      status: "active",
      must_change_password: true,
      invited_by: context.userId,
    });
    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
      throw new Error(insertError.message);
    }

    return { ok: true, loginEmail };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { memberId: string; newPassword: string }) => data)
  .handler(async ({ data, context }) => {
    const farmId = await requireStaffManager(context as any);
    if ((data.newPassword ?? "").length < 8) {
      throw new Error("The new password must be at least 8 characters.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member, error } = await supabaseAdmin
      .from("farm_members")
      .select("id, farm_id, user_id, role_key")
      .eq("id", data.memberId)
      .maybeSingle();
    if (error) throw error;
    if (!member || member.farm_id !== farmId) throw new Error("Staff member not found.");
    if (!member.user_id) throw new Error("This staff member has no login yet.");

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(member.user_id, {
      password: data.newPassword,
    });
    if (updateError) throw new Error(updateError.message);

    await supabaseAdmin
      .from("farm_members")
      .update({ must_change_password: true })
      .eq("id", member.id);

    return { ok: true };
  });

export const deleteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { memberId: string }) => data)
  .handler(async ({ data, context }) => {
    const farmId = await requireStaffManager(context as any);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member, error } = await supabaseAdmin
      .from("farm_members")
      .select("id, farm_id, user_id, role_key")
      .eq("id", data.memberId)
      .maybeSingle();
    if (error) throw error;
    if (!member || member.farm_id !== farmId) throw new Error("Staff member not found.");
    if (member.role_key === "owner") throw new Error("The farm owner cannot be removed.");
    if (member.user_id === context.userId) throw new Error("You cannot remove your own access.");

    await supabaseAdmin.from("farm_members").delete().eq("id", member.id);

    // Remove the login only when it belongs to no other farm.
    if (member.user_id) {
      const { count } = await supabaseAdmin
        .from("farm_members")
        .select("id", { count: "exact", head: true })
        .eq("user_id", member.user_id);
      if (!count) {
        await supabaseAdmin.auth.admin.deleteUser(member.user_id).catch(() => undefined);
      }
    }

    return { ok: true };
  });
