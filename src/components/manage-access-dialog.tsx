import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Loader2, X, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  ACCESS_CATALOG, ALL_ACCESS_ITEMS, buildPermissions, itemState,
} from "@/lib/permission-catalog";

type Member = { id: string; full_name: string; role_key: string; role_label: string };

type PermPayload = {
  member_id: string;
  role: string;
  custom_permissions: boolean;
  permissions: string[];
};

type SwitchState = Record<string, { enabled: boolean; canWrite: boolean }>;

/**
 * Farm Owner control panel for exactly what one staff member may open.
 * "Use role defaults" hands control back to the role catalogue; custom mode
 * stores an explicit permission list that the backend enforces via RLS.
 */
export function ManageAccessDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["member-permissions", member.id],
    networkMode: "always",
    queryFn: async (): Promise<PermPayload> => {
      const { data, error } = await supabase.rpc("farm_staff_get_permissions", { _member_id: member.id });
      if (error) throw error;
      return data as unknown as PermPayload;
    },
  });

  const [custom, setCustom] = useState<boolean | null>(null);
  const [state, setState] = useState<SwitchState | null>(null);

  const initial = useMemo<SwitchState>(() => {
    const perms = q.data?.permissions ?? [];
    const s: SwitchState = {};
    for (const item of ALL_ACCESS_ITEMS) s[item.key] = itemState(perms, item);
    return s;
  }, [q.data]);

  const isCustom = custom ?? q.data?.custom_permissions ?? false;
  const current = state ?? initial;

  const setItem = (key: string, patch: Partial<{ enabled: boolean; canWrite: boolean }>) => {
    setState({ ...current, [key]: { ...current[key], ...patch } });
    if (!isCustom) setCustom(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("farm_staff_set_permissions", {
        _member_id: member.id,
        _custom: isCustom,
        _permissions: isCustom ? buildPermissions(current) : [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isCustom ? "Custom access saved." : "Role defaults restored.");
      qc.invalidateQueries({ queryKey: ["member-permissions", member.id] });
      qc.invalidateQueries({ queryKey: ["farm-context"] });
      qc.invalidateQueries({ queryKey: ["farm-staff"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message === "forbidden" ? "Only the Farm Owner can change access." : e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <ShieldCheck className="h-4.5 w-4.5 text-[color:var(--forest)]" /> Manage access
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {member.full_name || "This user"} · {member.role_label}. Blocked modules are hidden from the menu and
              refused by the server.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {q.isPending ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-5 py-3">
              <div className="text-[13px]">
                <div className="font-medium text-foreground">{isCustom ? "Custom access" : "Role defaults"}</div>
                <div className="text-muted-foreground">
                  {isCustom
                    ? "This user only sees what you switch on below."
                    : `Using the standard access list for ${member.role_label}.`}
                </div>
              </div>
              {isCustom && (
                <button
                  onClick={() => { setCustom(false); setState(null); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium hover:bg-secondary"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset to role defaults
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {ACCESS_CATALOG.map((group) => (
                <div key={group.heading} className="mb-5 last:mb-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {group.heading}
                  </div>
                  <div className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {group.items.map((item) => {
                      const s = current[item.key] ?? { enabled: false, canWrite: false };
                      return (
                        <div key={item.key} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] font-medium text-foreground">{item.label}</div>
                            <div className="text-[12px] text-muted-foreground">{item.description}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            {item.writes?.length ? (
                              <label className={cn("flex items-center gap-1.5 text-[12px]", s.enabled ? "text-muted-foreground" : "text-muted-foreground/40")}>
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 rounded border-border"
                                  disabled={!s.enabled}
                                  checked={s.enabled && s.canWrite}
                                  onChange={(e) => setItem(item.key, { canWrite: e.target.checked })}
                                />
                                Can record / edit
                              </label>
                            ) : null}
                            <Toggle
                              checked={s.enabled}
                              onChange={(v) => setItem(item.key, { enabled: v, canWrite: v ? s.canWrite : false })}
                              label={`${item.label} access`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
              <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary">
                Cancel
              </button>
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--forest)] px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save access
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition",
        checked ? "bg-[color:var(--forest)]" : "bg-muted-foreground/30",
      )}
    >
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-background transition-all", checked ? "left-[1.15rem]" : "left-0.5")} />
    </button>
  );
}
