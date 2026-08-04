import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Loader2, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/lib/rbac";
import { PermissionDenied } from "@/components/permission-denied";
import { EVENT_LABELS, describeEvent, roleLabel, timeAgo } from "@/lib/security-events";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/activity")({
  component: ActivityPage,
  head: () => ({
    meta: [
      { title: "Activity & Security — PoultryPro" },
      { name: "description", content: "Owner-only security centre: staff logins, failed attempts, password changes, role changes and account actions on your poultry farm." },
      { property: "og:title", content: "Activity & Security — PoultryPro" },
      { property: "og:description", content: "Immutable audit trail of every staff login and account action on your farm." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type EventRow = {
  id: string;
  farm_id: string | null;
  user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  event_type: string;
  detail: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  location: string | null;
  created_at: string;
};

export function useSecurityEvents(enabled: boolean, limit = 200) {
  return useQuery({
    queryKey: ["security-events", limit],
    enabled,
    networkMode: "always",
    refetchInterval: 30_000,
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase.rpc("farm_security_events", { _limit: limit });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });
}

function ActivityPage() {
  const { can, loading } = usePermissions();
  const enabled = !loading && can("audit.read");
  const q = useSecurityEvents(enabled, 500);

  const [type, setType] = useState("all");
  const [role, setRole] = useState("all");
  const [person, setPerson] = useState("all");
  const [day, setDay] = useState("");

  const rows = q.data ?? [];
  const people = useMemo(
    () => Array.from(new Set(rows.map((r) => r.actor_name || r.actor_email || "").filter(Boolean))),
    [rows],
  );
  const roles = useMemo(
    () => Array.from(new Set(rows.map((r) => r.actor_role ?? "").filter(Boolean))),
    [rows],
  );

  const filtered = rows.filter((r) => {
    if (type !== "all" && r.event_type !== type) return false;
    if (role !== "all" && r.actor_role !== role) return false;
    if (person !== "all" && (r.actor_name || r.actor_email) !== person) return false;
    if (day && !r.created_at.startsWith(day)) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!can("audit.read")) {
    return <PermissionDenied hint="Activity & Security is available to the Farm Owner only." />;
  }

  const select = "rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Security
        </div>
        <h1 className="mt-1.5 font-display text-2xl font-semibold text-foreground sm:text-3xl">Activity &amp; Security</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every staff sign-in, failed attempt and account change on your farm. Records are immutable and visible only to you.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Filter className="h-3.5 w-3.5" /> Filter</span>
        <select className={select} value={type} onChange={(e) => setType(e.target.value)} aria-label="Event type">
          <option value="all">All events</option>
          {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={select} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="all">All roles</option>
          {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
        <select className={select} value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Staff member">
          <option value="all">All staff</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="date" className={select} value={day} onChange={(e) => setDay(e.target.value)} aria-label="Date" />
        {(type !== "all" || role !== "all" || person !== "all" || day) && (
          <button
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
            onClick={() => { setType("all"); setRole("all"); setPerson("all"); setDay(""); }}
          >
            Reset
          </button>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
        {q.isPending ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">No activity recorded for this filter yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", e.event_type === "login_failed" ? "bg-destructive" : "bg-emerald-500")} />
                  <span className="text-sm font-medium text-foreground">{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(e.created_at)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{describeEvent(e)}</p>
                <p className="text-[11px] text-muted-foreground/80">
                  {new Date(e.created_at).toLocaleString()} · {e.device ?? "Unknown device"}
                  {e.ip_address ? ` · IP ${e.ip_address}` : ""}
                  {e.detail ? ` · ${e.detail}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
