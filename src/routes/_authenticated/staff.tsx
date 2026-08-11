import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, UserPlus, ShieldCheck, KeyRound, Ban, CheckCircle2, Trash2, Mail,
  Phone, Clock, X, History, Loader2, Copy, SlidersHorizontal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions, roleStyle } from "@/lib/rbac";
import { PermissionDenied } from "@/components/permission-denied";
import { createStaffMember, resetStaffPassword, deleteStaffMember } from "@/lib/staff.functions";
import { cn } from "@/lib/utils";
import { ManageAccessDialog } from "@/components/manage-access-dialog";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff & Users — PoultryPro" },
      { name: "description", content: "Invite farm managers and sales officers, set their roles and review every action taken on your farm account." },
      { property: "og:title", content: "Staff & Users — PoultryPro" },
      { property: "og:description", content: "Multi-role staff management for your poultry farm: roles, permissions, access control and a full audit trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StaffPage,
});

type StaffRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  role_key: string;
  role_label: string;
  status: string;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
};

type RoleRow = { key: string; label: string; description: string | null; sort_order: number };

type ActivityRow = {
  id: string;
  created_at: string;
  module: string;
  action: string;
  device: string | null;
  browser: string | null;
  ip_address: string | null;
  success: boolean;
  actor_name: string;
  actor_email: string | null;
  actor_role: string;
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const MODULE_LABEL: Record<string, string> = {
  egg_production: "Production",
  feed_usage: "Feed",
  feed_inventory: "Inventory",
  mortality: "Mortality",
  health_records: "Health",
  rooms: "Bird Management",
  prices: "Price Management",
  farms: "Farm Settings",
};

const ACTION_LABEL: Record<string, string> = {
  insert: "recorded a new entry in",
  update: "updated",
  delete: "deleted a record from",
};

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += chars[b % chars.length];
  return `${out}!7`;
}

function StaffPage() {
  const { can, loading } = usePermissions();
  const [tab, setTab] = useState<"people" | "activity">("people");

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!can("staff.manage")) return <PermissionDenied hint="Only the Farm Owner can manage staff and users." />;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Workspace
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-semibold text-foreground sm:text-3xl">Staff &amp; Users</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Give your team their own logins. Each person only sees the modules their role allows.
          </p>
        </div>
      </header>

      <div className="mt-6 inline-flex rounded-xl border border-border bg-card p-1">
        {([["people", "People", Users], ["activity", "Audit Log", History]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
              tab === key ? "bg-[color:var(--forest)] text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "people" ? <PeopleTab /> : <ActivityTab />}
    </div>
  );
}

function PeopleTab() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [resetFor, setResetFor] = useState<StaffRow | null>(null);
  const [deleteFor, setDeleteFor] = useState<StaffRow | null>(null);

  const staffQ = useQuery({
    queryKey: ["farm-staff"],
    queryFn: async (): Promise<StaffRow[]> => {
      const { data, error } = await supabase.rpc("farm_staff_list");
      if (error) throw error;
      return (data ?? []) as StaffRow[];
    },
  });

  const rolesQ = useQuery({
    queryKey: ["farm-roles"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase.from("farm_roles").select("key,label,description,sort_order").order("sort_order");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["farm-staff"] });

  const setRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const { error } = await supabase.rpc("farm_staff_set_role", { _member_id: memberId, _role: role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Role updated."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ memberId, status }: { memberId: string; status: string }) => {
      const { error } = await supabase.rpc("farm_staff_set_status", { _member_id: memberId, _status: status });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Access updated."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = staffQ.data ?? [];
  const active = rows.filter((r) => r.status === "active").length;
  const suspended = rows.filter((r) => r.status !== "active").length;

  return (
    <>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Team members" value={String(rows.length)} icon={Users} />
        <Stat label="Active" value={String(active)} icon={CheckCircle2} />
        <Stat label="Suspended" value={String(suspended)} icon={Ban} />
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Team</h2>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--forest)] px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" /> Add user
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
        {staffQ.isPending ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading team…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No staff yet. Add your first user.</div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => {
              const rs = roleStyle(r.role_key);
              const isOwner = r.role_key === "owner";
              return (
                <div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-foreground">{r.full_name || "Unnamed"}</span>
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", rs.badge)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", rs.dot)} />{r.role_label}
                      </span>
                      <span className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        r.status === "active"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                          : "border-destructive/30 bg-destructive/10 text-destructive",
                      )}>
                        {r.status}
                      </span>
                      {r.must_change_password && (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          Temp password
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
                      {r.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{r.email}</span>}
                      {r.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{r.phone}</span>}
                      <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Last login {fmtDateTime(r.last_login_at)}</span>
                      <span>Added {fmtDateTime(r.created_at)}</span>
                    </div>
                  </div>

                  {!isOwner && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={r.role_key}
                        onChange={(e) => setRole.mutate({ memberId: r.id, role: e.target.value })}
                        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground"
                        aria-label={`Role for ${r.full_name}`}
                      >
                        {(rolesQ.data ?? []).filter((role) => role.key !== "owner").map((role) => (
                          <option key={role.key} value={role.key}>{role.label}</option>
                        ))}
                      </select>
                      <IconBtn title="Manage access" onClick={() => setAccessFor(r)}><SlidersHorizontal className="h-4 w-4" /></IconBtn>
                      <IconBtn title="Reset password" onClick={() => setResetFor(r)}><KeyRound className="h-4 w-4" /></IconBtn>
                      <IconBtn
                        title={r.status === "active" ? "Suspend" : "Reactivate"}
                        onClick={() => setStatus.mutate({ memberId: r.id, status: r.status === "active" ? "suspended" : "active" })}
                      >
                        {r.status === "active" ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </IconBtn>
                      <IconBtn title="Remove" danger onClick={() => setDeleteFor(r)}><Trash2 className="h-4 w-4" /></IconBtn>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showInvite && (
        <InviteDialog
          roles={(rolesQ.data ?? []).filter((r) => r.key !== "owner")}
          onClose={() => setShowInvite(false)}
          onDone={() => { setShowInvite(false); refresh(); }}
        />
      )}
      {accessFor && (
        <ManageAccessDialog
          member={{ id: accessFor.id, full_name: accessFor.full_name, role_key: accessFor.role_key, role_label: accessFor.role_label }}
          onClose={() => setAccessFor(null)}
        />
      )}
      {resetFor && <ResetDialog member={resetFor} onClose={() => setResetFor(null)} onDone={() => { setResetFor(null); refresh(); }} />}
      {deleteFor && <DeleteDialog member={deleteFor} onClose={() => setDeleteFor(null)} onDone={() => { setDeleteFor(null); refresh(); }} />}
    </>
  );
}

function ActivityTab() {
  const q = useQuery({
    queryKey: ["farm-activity"],
    queryFn: async (): Promise<ActivityRow[]> => {
      const { data, error } = await supabase.rpc("farm_activity_log", { _limit: 200 });
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

  const rows = q.data ?? [];

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-display text-base font-semibold text-foreground">Audit log</h2>
        <p className="text-[12.5px] text-muted-foreground">Every record created, edited or deleted on this farm, with who did it and when.</p>
      </div>
      {q.isPending ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading activity…</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No activity recorded yet.</div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-3 text-[13px]">
              <span className="font-medium text-foreground">{a.actor_name || a.actor_email || "Unknown user"}</span>
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {a.actor_role}
              </span>
              <span className="text-muted-foreground">
                {ACTION_LABEL[a.action] ?? a.action} {MODULE_LABEL[a.module] ?? a.module}
              </span>
              <span className="ml-auto shrink-0 text-[12px] text-muted-foreground">
                {fmtDateTime(a.created_at)}
                {a.device ? ` · ${a.device}` : ""}
                {a.ip_address ? ` · ${a.ip_address}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InviteDialog({ roles, onClose, onDone }: { roles: RoleRow[]; onClose: () => void; onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleKey, setRoleKey] = useState(roles[0]?.key ?? "manager");
  const [mode, setMode] = useState<"password" | "invite">("password");
  const [tempPassword, setTempPassword] = useState(randomPassword());
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await createStaffMember({
        data: { fullName, email: email.trim() || undefined, phone: phone.trim() || undefined, roleKey, mode, tempPassword, origin: window.location.origin },
      });
      toast.success(
        mode === "invite"
          ? "Invitation sent."
          : `Account created. Share the login ${res.loginEmail} and the temporary password.`,
      );
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Add a user" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name">
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="e.g. Musa Ibrahim" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email address">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="optional" />
          </Field>
          <Field label="Phone number">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="e.g. 0803 000 0000" />
          </Field>
        </div>
        <Field label="Role">
          <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} className={inputCls}>
            {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {roles.find((r) => r.key === roleKey)?.description}
          </p>
        </Field>

        <div className="rounded-xl border border-border p-3">
          <div className="flex gap-2">
            {(["password", "invite"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-lg px-3 py-2 text-[13px] font-medium transition",
                  mode === m ? "bg-[color:var(--forest)] text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {m === "password" ? "Temporary password" : "Email invitation"}
              </button>
            ))}
          </div>
          {mode === "password" ? (
            <div className="mt-3">
              <label className="text-[12px] font-medium text-muted-foreground">Temporary password</label>
              <div className="mt-1 flex gap-2">
                <input value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} className={inputCls} />
                <button
                  type="button"
                  title="Copy"
                  onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success("Copied."); }}
                  className="rounded-lg border border-border px-3 text-muted-foreground transition hover:text-foreground"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                They must change this password the first time they sign in. If no email is given, they sign in with their phone number.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-muted-foreground">
              We'll email an invitation link so they can set their own password. An email address is required.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground">Cancel</button>
          <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--forest)] px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create account
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetDialog({ member, onClose, onDone }: { member: StaffRow; onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState(randomPassword());
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Reset password — ${member.full_name}`} onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        Set a new temporary password. {member.full_name.split(" ")[0]} will be asked to change it at the next sign-in.
      </p>
      <div className="mt-3 flex gap-2">
        <input value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} />
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(pw); toast.success("Copied."); }}
          className="rounded-lg border border-border px-3 text-muted-foreground transition hover:text-foreground"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground">Cancel</button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await resetStaffPassword({ data: { memberId: member.id, newPassword: pw } });
              toast.success("Password reset. Share the new password securely.");
              onDone();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not reset the password.");
            } finally { setBusy(false); }
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--forest)] px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Reset password
        </button>
      </div>
    </Modal>
  );
}

function DeleteDialog({ member, onClose, onDone }: { member: StaffRow; onClose: () => void; onDone: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Remove user" onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        This removes <span className="font-medium text-foreground">{member.full_name}</span> from your farm and deletes their login.
        Farm records they created stay intact. Type <span className="font-semibold text-foreground">DELETE</span> to confirm.
      </p>
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={cn(inputCls, "mt-3")} placeholder="DELETE" />
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground">Cancel</button>
        <button
          disabled={confirm !== "DELETE" || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await deleteStaffMember({ data: { memberId: member.id } });
              toast.success("User removed.");
              onDone();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not remove the user.");
            } finally { setBusy(false); }
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Remove user
        </button>
      </div>
    </Modal>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[color:var(--forest)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-150" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-lift)] animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-muted-foreground transition hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, children, danger }: { title: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border transition",
        danger ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

export { ShieldCheck };
