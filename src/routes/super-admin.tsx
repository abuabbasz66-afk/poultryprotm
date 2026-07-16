import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, Warehouse, CreditCard, Activity, Brain,
  HeartPulse, FileText, Menu, X as CloseIcon, LogOut, Search,
  ShieldCheck, ArrowLeft, Loader2, AlertTriangle, Bell, Settings,
  TrendingUp, TrendingDown, UserPlus, Building2, CheckCircle2,
  PauseCircle, Sparkles, DollarSign, PieChart as PieIcon,
  LineChart as LineIcon, Database, Mail, Server, HardDrive,
  Zap, Megaphone, Wrench, ShieldPlus, UserMinus, Send, PackagePlus,
  Wheat, Skull, Stethoscope, Pill, Upload,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId } from "@/lib/farm-data";
import {
  useIsSuperAdmin, usePlatformStats, useAdminAccounts, useAdminFarms,
  useAdminFarmSummary, useAdminIntelligence, useAdminAuditLog,
  useChangeSubscription, useSetAccountStatus,
  type AdminAccount, type AdminFarm, type AuditEntry,
} from "@/lib/admin-api";
import { toast } from "sonner";
import { format as fmtDate, parseISO, isValid as isValidDate } from "date-fns";

export const Route = createFileRoute("/super-admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Super Admin — PoultryPro Platform" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SuperAdminPage,
});

type Tab =
  | "overview" | "accounts" | "farms" | "subscriptions"
  | "activity" | "intelligence" | "health" | "audit";

const NAV: { id: Tab; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "accounts", label: "Accounts", icon: Users },
  { id: "farms", label: "Farms", icon: Warehouse },
  { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { id: "activity", label: "Platform Activity", icon: Activity },
  { id: "intelligence", label: "AI Intelligence", icon: Brain },
  { id: "health", label: "Platform Health", icon: HeartPulse },
  { id: "audit", label: "Admin Audit Log", icon: FileText },
];

function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValidDate(d) ? fmtDate(d, "d MMM yyyy") : "—";
}
function fmtDT(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValidDate(d) ? fmtDate(d, "d MMM yyyy, HH:mm") : "—";
}
function planLabel(p: string | null | undefined): string {
  return p ? p[0].toUpperCase() + p.slice(1) : "—";
}
function planTone(p: string | null | undefined): string {
  if (p === "premium") return "bg-amber-100 text-amber-900 border-amber-300";
  if (p === "standard") return "bg-emerald-100 text-emerald-900 border-emerald-300";
  return "bg-slate-100 text-slate-800 border-slate-300";
}
function statusTone(s: string | null | undefined): string {
  return s === "suspended"
    ? "bg-red-100 text-red-900 border-red-300"
    : "bg-emerald-100 text-emerald-900 border-emerald-300";
}

function useAdminEmail() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  return email;
}

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function SuperAdminPage() {
  const navigate = useNavigate();
  const { data: userId, isPending: userPending } = useAuthUserId();
  const { data: isAdmin, isPending: rolePending, isError: roleError } = useIsSuperAdmin();
  const [tab, setTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const adminEmail = useAdminEmail();
  const now = useLiveClock();

  if (userPending || rolePending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1f16] text-[#f5efe0]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!userId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0f1f16] text-[#f5efe0] px-4">
        <ShieldCheck className="h-10 w-10 opacity-70" />
        <p>You must sign in to access this area.</p>
        <Link to="/auth" className="px-4 py-2 rounded-md bg-[#c9a24a] text-[#0f1f16] font-semibold">Sign in</Link>
      </div>
    );
  }
  if (roleError || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0f1f16] text-[#f5efe0] px-4 text-center">
        <ShieldCheck className="h-10 w-10 text-red-400" />
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="text-sm opacity-80 max-w-md">
          This area is restricted to PoultryPro platform administrators.
        </p>
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="px-4 py-2 rounded-md bg-[#c9a24a] text-[#0f1f16] font-semibold"
        >
          Back to farm dashboard
        </button>
      </div>
    );
  }

  const active = NAV.find((n) => n.id === tab)!;

  return (
    <div className="min-h-screen bg-[#f6f2e6] text-[#12281c]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-[#12281c]/10 bg-[#0f1f16] text-[#f5efe0]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded hover:bg-white/10"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              {sidebarOpen ? <CloseIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <ShieldCheck className="h-6 w-6 text-[#c9a24a]" />
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-widest text-[#c9a24a]">PoultryPro Platform</div>
              <div className="text-sm sm:text-base font-semibold">Super Admin Console</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-white/20 hover:bg-white/10"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Farm dashboard
            </Link>
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-white/20 hover:bg-white/10"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${sidebarOpen ? "block" : "hidden"} lg:block fixed lg:sticky top-[57px] lg:top-[57px] z-20 h-[calc(100vh-57px)] w-64 bg-[#12281c] text-[#f5efe0] overflow-y-auto`}
        >
          <nav className="p-3 space-y-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              const isActive = tab === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => { setTab(n.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                    isActive
                      ? "bg-[#c9a24a] text-[#0f1f16] font-semibold"
                      : "hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </button>
              );
            })}
          </nav>
          <div className="px-4 py-3 text-[10px] uppercase tracking-widest text-[#c9a24a]/70">
            Platform admin
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mb-5 flex items-center gap-2 text-xs uppercase tracking-widest text-[#12281c]/60">
            <active.icon className="h-3.5 w-3.5" />
            {active.label}
          </div>

          {tab === "overview" && <OverviewTab userId={userId} />}
          {tab === "accounts" && <AccountsTab userId={userId} />}
          {tab === "farms" && <FarmsTab userId={userId} />}
          {tab === "subscriptions" && <SubscriptionsTab userId={userId} />}
          {tab === "activity" && <ActivityTab userId={userId} />}
          {tab === "intelligence" && <IntelligenceTab userId={userId} />}
          {tab === "health" && <HealthTab userId={userId} />}
          {tab === "audit" && <AuditTab userId={userId} />}
        </main>
      </div>
    </div>
  );
}

// -------------------- OVERVIEW --------------------
function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#12281c]/10 bg-white p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-widest text-[#12281c]/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[#12281c]">{value}</div>
      {hint && <div className="mt-1 text-xs text-[#12281c]/60">{hint}</div>}
    </div>
  );
}
function OverviewTab({ userId }: { userId: string }) {
  const { data, isPending, error } = usePlatformStats(userId, true);
  if (isPending) return <Loader />;
  if (error || !data) return <ErrBox message="Could not load platform stats." />;
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-3">Accounts & Farms</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Registered accounts" value={data.total_accounts} />
          <StatCard label="Total farms" value={data.total_farms} />
          <StatCard label="Active farms" value={data.active_farms} />
          <StatCard label="Suspended" value={data.suspended_accounts} />
          <StatCard label="New farms this month" value={data.new_farms_this_month} />
          <StatCard label="Signups (7d)" value={data.recent_signups_7d} />
          <StatCard label="New farms (7d)" value={data.recent_farms_7d} />
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-3">Plans</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Basic" value={data.basic_plan_farms} />
          <StatCard label="Standard" value={data.standard_plan_farms} />
          <StatCard label="Premium" value={data.premium_plan_farms} />
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-3">Platform activity</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Production records" value={data.total_production_records} />
          <StatCard label="Feed records" value={data.total_feed_records} />
          <StatCard label="Mortality records" value={data.total_mortality_records} />
          <StatCard label="Health records" value={data.total_health_records} />
        </div>
      </section>
    </div>
  );
}

// -------------------- ACCOUNTS --------------------
function AccountsTab({ userId }: { userId: string }) {
  const { data, isPending, error } = useAdminAccounts(userId, true);
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState<"all" | "basic" | "standard" | "premium">("all");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");

  const rows = useMemo(() => {
    let r = data ?? [];
    if (plan !== "all") r = r.filter((x) => x.subscription_plan === plan);
    if (status !== "all") r = r.filter((x) => (x.status ?? "active") === status);
    const s = q.trim().toLowerCase();
    if (s) {
      r = r.filter((x) =>
        (x.email ?? "").toLowerCase().includes(s) ||
        (x.owner_name ?? "").toLowerCase().includes(s) ||
        (x.farm_name ?? "").toLowerCase().includes(s)
      );
    }
    return r;
  }, [data, q, plan, status]);

  if (isPending) return <Loader />;
  if (error) return <ErrBox message="Could not load accounts." />;

  return (
    <div className="space-y-4">
      <Filters
        q={q} setQ={setQ}
        selects={[
          { label: "Plan", value: plan, onChange: (v) => setPlan(v as any),
            options: [["all","All plans"],["basic","Basic"],["standard","Standard"],["premium","Premium"]] },
          { label: "Status", value: status, onChange: (v) => setStatus(v as any),
            options: [["all","All statuses"],["active","Active"],["suspended","Suspended"]] },
        ]}
      />

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-[#12281c]/10 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f6f2e6] text-[#12281c]/70 text-xs uppercase tracking-wider">
            <tr>
              <Th>Owner</Th><Th>Email</Th><Th>Farm</Th>
              <Th>Plan</Th><Th>Status</Th><Th>Created</Th><Th>Last sign-in</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#12281c]/5">
            {rows.map((a) => (
              <tr key={a.user_id}>
                <Td>{a.owner_name ?? "—"}</Td>
                <Td className="font-mono text-xs">{a.email ?? "—"}</Td>
                <Td>{a.farm_name ?? <span className="text-[#12281c]/50">No farm yet</span>}</Td>
                <Td><Badge className={planTone(a.subscription_plan)}>{planLabel(a.subscription_plan)}</Badge></Td>
                <Td><Badge className={statusTone(a.status)}>{a.status ?? "—"}</Badge></Td>
                <Td>{fmtDay(a.account_created)}</Td>
                <Td>{fmtDT(a.last_sign_in)}</Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[#12281c]/60">No accounts match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {rows.map((a) => (
          <div key={a.user_id} className="rounded-xl border border-[#12281c]/10 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{a.owner_name ?? "—"}</div>
                <div className="text-xs font-mono text-[#12281c]/70 break-all">{a.email}</div>
              </div>
              <Badge className={planTone(a.subscription_plan)}>{planLabel(a.subscription_plan)}</Badge>
            </div>
            <div className="mt-2 text-xs space-y-1">
              <div><span className="text-[#12281c]/60">Farm:</span> {a.farm_name ?? "—"}</div>
              <div><span className="text-[#12281c]/60">Status:</span> {a.status ?? "—"}</div>
              <div><span className="text-[#12281c]/60">Joined:</span> {fmtDay(a.account_created)}</div>
              <div><span className="text-[#12281c]/60">Last sign-in:</span> {fmtDT(a.last_sign_in)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------- FARMS --------------------
function FarmsTab({ userId }: { userId: string }) {
  const { data, isPending, error } = useAdminFarms(userId, true);
  const [q, setQ] = useState("");
  const [openFarm, setOpenFarm] = useState<string | null>(null);

  const rows = useMemo(() => {
    let r = data ?? [];
    const s = q.trim().toLowerCase();
    if (s) {
      r = r.filter((x) =>
        x.farm_name.toLowerCase().includes(s) ||
        (x.owner_name ?? "").toLowerCase().includes(s) ||
        (x.owner_email ?? "").toLowerCase().includes(s) ||
        (x.location ?? "").toLowerCase().includes(s)
      );
    }
    return r;
  }, [data, q]);

  if (isPending) return <Loader />;
  if (error) return <ErrBox message="Could not load farms." />;

  return (
    <div className="space-y-4">
      <Filters q={q} setQ={setQ} placeholder="Search farm, owner, email, location…" />
      <div className="hidden md:block rounded-xl border border-[#12281c]/10 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f6f2e6] text-[#12281c]/70 text-xs uppercase tracking-wider">
            <tr>
              <Th>Farm</Th><Th>Owner</Th><Th>Location</Th>
              <Th>Birds</Th><Th>Rooms</Th><Th>Plan</Th><Th>Status</Th><Th>Created</Th><Th>{" "}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#12281c]/5">
            {rows.map((f) => (
              <tr key={f.farm_id}>
                <Td className="font-medium">{f.farm_name}</Td>
                <Td>
                  <div>{f.owner_name ?? "—"}</div>
                  <div className="text-xs text-[#12281c]/60 font-mono">{f.owner_email}</div>
                </Td>
                <Td>{[f.location, f.state, f.country].filter(Boolean).join(", ") || "—"}</Td>
                <Td>{f.bird_count ?? "—"}</Td>
                <Td>{f.rooms_count}</Td>
                <Td><Badge className={planTone(f.subscription_plan)}>{planLabel(f.subscription_plan)}</Badge></Td>
                <Td><Badge className={statusTone(f.status)}>{f.status}</Badge></Td>
                <Td>{fmtDay(f.created_at)}</Td>
                <Td>
                  <button
                    onClick={() => setOpenFarm(f.farm_id)}
                    className="text-xs px-2 py-1 rounded border border-[#12281c]/20 hover:bg-[#f6f2e6]"
                  >
                    View
                  </button>
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-[#12281c]/60">No farms match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {rows.map((f) => (
          <div key={f.farm_id} className="rounded-xl border border-[#12281c]/10 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold">{f.farm_name}</div>
              <Badge className={planTone(f.subscription_plan)}>{planLabel(f.subscription_plan)}</Badge>
            </div>
            <div className="mt-2 text-xs space-y-1">
              <div><span className="text-[#12281c]/60">Owner:</span> {f.owner_name ?? "—"}</div>
              <div><span className="text-[#12281c]/60">Email:</span> <span className="font-mono">{f.owner_email}</span></div>
              <div><span className="text-[#12281c]/60">Location:</span> {[f.location, f.state, f.country].filter(Boolean).join(", ") || "—"}</div>
              <div><span className="text-[#12281c]/60">Birds / Rooms:</span> {f.bird_count ?? "—"} / {f.rooms_count}</div>
              <div><span className="text-[#12281c]/60">Status:</span> {f.status}</div>
            </div>
            <button
              onClick={() => setOpenFarm(f.farm_id)}
              className="mt-3 w-full text-xs px-3 py-2 rounded border border-[#12281c]/20 hover:bg-[#f6f2e6]"
            >
              View support summary
            </button>
          </div>
        ))}
      </div>

      {openFarm && (
        <FarmSummaryModal userId={userId} farmId={openFarm} onClose={() => setOpenFarm(null)} />
      )}
    </div>
  );
}

function FarmSummaryModal({ userId, farmId, onClose }: { userId: string; farmId: string; onClose: () => void }) {
  const { data, isPending } = useAdminFarmSummary(userId, farmId);
  const setStatus = useSetAccountStatus(userId);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Farm support summary</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><CloseIcon className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          {isPending && <Loader />}
          {data && (
            <>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-[#12281c]/60">Farm</div>
                <div className="mt-1 font-semibold text-base">{data.farm?.name}</div>
                <div className="text-xs text-[#12281c]/70">
                  {[data.farm?.location, data.farm?.state, data.farm?.country].filter(Boolean).join(", ") || "—"}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Info label="Owner" value={data.owner?.email ?? "—"} />
                <Info label="Owner name" value={data.farm?.owner_name ?? "—"} />
                <Info label="Plan" value={planLabel(data.farm?.subscription_plan)} />
                <Info label="Status" value={data.farm?.status ?? "—"} />
                <Info label="Bird count" value={data.farm?.bird_count ?? "—"} />
                <Info label="Rooms" value={data.rooms_count} />
                <Info label="Account created" value={fmtDay(data.owner?.created_at)} />
                <Info label="Last sign-in" value={fmtDT(data.owner?.last_sign_in_at)} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-[#12281c]/60 mb-2">Records</div>
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Production records" value={`${data.production_count} · latest ${fmtDay(data.production_latest)}`} />
                  <Info label="Feed records" value={`${data.feed_count} · latest ${fmtDay(data.feed_latest)}`} />
                  <Info label="Mortality records" value={`${data.mortality_count} · latest ${fmtDay(data.mortality_latest)}`} />
                  <Info label="Health records" value={`${data.health_count} · latest ${fmtDay(data.health_latest)}`} />
                  <Info label="Price records" value={data.price_count} />
                  <Info label="AI Intelligence" value={data.production_count >= 7 ? "Available" : "Insufficient data"} />
                </div>
              </div>
              <div className="pt-3 border-t">
                <div className="text-[11px] uppercase tracking-widest text-[#12281c]/60 mb-2">Account actions</div>
                {data.farm?.status === "suspended" ? (
                  <button
                    disabled={setStatus.isPending}
                    onClick={async () => {
                      await setStatus.mutateAsync({ farm_id: farmId, new_status: "active" });
                      toast.success("Account reactivated");
                    }}
                    className="px-3 py-2 rounded-md bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
                  >
                    Reactivate account
                  </button>
                ) : confirmSuspend ? (
                  <div className="flex gap-2">
                    <button
                      disabled={setStatus.isPending}
                      onClick={async () => {
                        await setStatus.mutateAsync({ farm_id: farmId, new_status: "suspended", reason: "Suspended by admin" });
                        toast.success("Account suspended");
                        setConfirmSuspend(false);
                      }}
                      className="px-3 py-2 rounded-md bg-red-700 text-white text-sm font-medium disabled:opacity-50"
                    >
                      Confirm suspend
                    </button>
                    <button onClick={() => setConfirmSuspend(false)} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmSuspend(true)}
                    className="px-3 py-2 rounded-md border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50"
                  >
                    Suspend account
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------- SUBSCRIPTIONS --------------------
function SubscriptionsTab({ userId }: { userId: string }) {
  const { data, isPending, error } = useAdminFarms(userId, true);
  const change = useChangeSubscription(userId);
  const [target, setTarget] = useState<{ farm: AdminFarm; plan: string } | null>(null);

  if (isPending) return <Loader />;
  if (error || !data) return <ErrBox message="Could not load farms." />;

  return (
    <div className="space-y-4">
      <div className="hidden md:block rounded-xl border border-[#12281c]/10 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f6f2e6] text-[#12281c]/70 text-xs uppercase tracking-wider">
            <tr>
              <Th>Farm</Th><Th>Owner</Th><Th>Current plan</Th><Th>Status</Th><Th>Since</Th><Th>Change to</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#12281c]/5">
            {data.map((f) => (
              <tr key={f.farm_id}>
                <Td className="font-medium">{f.farm_name}</Td>
                <Td className="text-xs">
                  <div>{f.owner_name ?? "—"}</div>
                  <div className="font-mono text-[#12281c]/60">{f.owner_email}</div>
                </Td>
                <Td><Badge className={planTone(f.subscription_plan)}>{planLabel(f.subscription_plan)}</Badge></Td>
                <Td><Badge className={statusTone(f.status)}>{f.status}</Badge></Td>
                <Td>{fmtDay(f.created_at)}</Td>
                <Td>
                  <PlanPicker
                    current={f.subscription_plan}
                    onPick={(plan) => setTarget({ farm: f, plan })}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {data.map((f) => (
          <div key={f.farm_id} className="rounded-xl border border-[#12281c]/10 bg-white p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{f.farm_name}</div>
                <div className="text-xs text-[#12281c]/60 font-mono">{f.owner_email}</div>
              </div>
              <Badge className={planTone(f.subscription_plan)}>{planLabel(f.subscription_plan)}</Badge>
            </div>
            <div className="mt-3">
              <PlanPicker current={f.subscription_plan} onPick={(plan) => setTarget({ farm: f, plan })} />
            </div>
          </div>
        ))}
      </div>

      {target && (
        <ConfirmDialog
          title="Change subscription plan"
          message={`Change ${target.farm.farm_name} from ${planLabel(target.farm.subscription_plan)} to ${planLabel(target.plan)}?`}
          confirmLabel="Change plan"
          onConfirm={async () => {
            try {
              await change.mutateAsync({ farm_id: target.farm.farm_id, new_plan: target.plan, reason: "Admin plan change" });
              toast.success(`Plan changed to ${planLabel(target.plan)}`);
              setTarget(null);
            } catch (e: any) {
              toast.error(e?.message ?? "Failed to change plan");
            }
          }}
          onCancel={() => setTarget(null)}
          busy={change.isPending}
        />
      )}
    </div>
  );
}

function PlanPicker({ current, onPick }: { current: string; onPick: (p: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {(["basic", "standard", "premium"] as const).map((p) => (
        <button
          key={p}
          disabled={p === current}
          onClick={() => onPick(p)}
          className={`text-xs px-2 py-1 rounded border ${
            p === current
              ? "border-[#12281c]/20 bg-[#f6f2e6] text-[#12281c]/40 cursor-not-allowed"
              : "border-[#12281c]/30 hover:bg-[#12281c] hover:text-white"
          }`}
        >
          {planLabel(p)}
        </button>
      ))}
    </div>
  );
}

// -------------------- ACTIVITY --------------------
function ActivityTab({ userId }: { userId: string }) {
  const { data: audit } = useAdminAuditLog(userId, true);
  const { data: farms } = useAdminFarms(userId, true);
  const { data: accounts } = useAdminAccounts(userId, true);

  const items = useMemo(() => {
    type Item = { when: string; type: string; text: string };
    const arr: Item[] = [];
    (farms ?? []).slice(0, 25).forEach((f) => {
      arr.push({ when: f.created_at, type: "Farm created", text: `${f.farm_name} (${f.owner_email ?? "—"})` });
    });
    (accounts ?? []).slice(0, 25).forEach((a) => {
      arr.push({ when: a.account_created, type: "Account registered", text: a.email ?? "—" });
    });
    (audit ?? []).forEach((e) => {
      arr.push({ when: e.created_at, type: labelForAction(e.action_type), text: describeAudit(e) });
    });
    return arr.sort((a, b) => (a.when < b.when ? 1 : -1)).slice(0, 60);
  }, [audit, farms, accounts]);

  if (!items.length) return <Loader />;
  return (
    <div className="rounded-xl border border-[#12281c]/10 bg-white divide-y divide-[#12281c]/5">
      {items.map((it, i) => (
        <div key={i} className="p-3 sm:p-4 flex items-start justify-between gap-3 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#12281c]/60">{it.type}</div>
            <div className="mt-0.5">{it.text}</div>
          </div>
          <div className="text-xs text-[#12281c]/60 whitespace-nowrap">{fmtDT(it.when)}</div>
        </div>
      ))}
    </div>
  );
}

// -------------------- INTELLIGENCE --------------------
function IntelligenceTab({ userId }: { userId: string }) {
  const { data, isPending, error } = useAdminIntelligence(userId, true);
  if (isPending) return <Loader />;
  if (error || !data) return <ErrBox message="Could not load intelligence summary." />;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <StatCard label="Farms with production data" value={data.farms_with_production ?? 0} />
      <StatCard label="Farms with feed data" value={data.farms_with_feed ?? 0} />
      <StatCard label="Farms with mortality data" value={data.farms_with_mortality ?? 0} />
      <StatCard label="Farms with health data" value={data.farms_with_health ?? 0} />
      <StatCard label="Premium farms (AI Insights)" value={data.premium_farms ?? 0} />
      <StatCard label="Production forecast ready" value={data.production_forecast_ready ?? 0}
        hint="Farms with ≥ 7 production days" />
    </div>
  );
}

// -------------------- HEALTH --------------------
function HealthTab({ userId }: { userId: string }) {
  const { data } = usePlatformStats(userId, true);
  const items = [
    { label: "Authentication", status: "Operational", tone: "ok" },
    { label: "Database connectivity", status: data ? "Operational" : "Checking…", tone: data ? "ok" : "warn" },
    { label: "Email delivery (notify.poultrypro.life)", status: "Configured", tone: "ok" },
    { label: "AI Intelligence engine", status: "Operational", tone: "ok" },
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#12281c]/10 bg-white divide-y divide-[#12281c]/5">
        {items.map((i) => (
          <div key={i.label} className="p-4 flex items-center justify-between text-sm">
            <div className="font-medium">{i.label}</div>
            <span className={`text-xs px-2 py-1 rounded-full border ${
              i.tone === "ok" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
              i.tone === "warn" ? "bg-amber-50 text-amber-800 border-amber-200" :
              "bg-red-50 text-red-800 border-red-200"
            }`}>{i.status}</span>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[#12281c]/10 bg-white p-4 text-xs text-[#12281c]/70 flex gap-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <p>
          Operational summaries only. Environment secrets, service-role keys and database credentials
          are never exposed to this dashboard.
        </p>
      </div>
    </div>
  );
}

// -------------------- AUDIT --------------------
function AuditTab({ userId }: { userId: string }) {
  const { data, isPending, error } = useAdminAuditLog(userId, true);
  if (isPending) return <Loader />;
  if (error) return <ErrBox message="Could not load audit log." />;
  const items = data ?? [];
  if (!items.length) return <div className="text-sm text-[#12281c]/60">No admin actions recorded yet.</div>;
  return (
    <div className="rounded-xl border border-[#12281c]/10 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#f6f2e6] text-[#12281c]/70 text-xs uppercase tracking-wider">
          <tr>
            <Th>When</Th><Th>Admin</Th><Th>Action</Th><Th>Target farm</Th><Th>Change</Th><Th>Reason</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#12281c]/5">
          {items.map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap">{fmtDT(e.created_at)}</Td>
              <Td className="font-mono text-xs">{e.admin_email ?? "—"}</Td>
              <Td>{labelForAction(e.action_type)}</Td>
              <Td>{e.affected_farm_name ?? "—"}</Td>
              <Td className="text-xs">{describeAudit(e)}</Td>
              <Td className="text-xs">{e.reason ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------------------- shared bits --------------------
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-3 py-2 font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full border ${className}`}>{children}</span>;
}
function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-[#12281c]/60">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}
function Loader() {
  return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
}
function ErrBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 p-4 text-sm flex gap-2">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {message}
    </div>
  );
}
function Filters({
  q, setQ, placeholder = "Search…", selects = [],
}: {
  q: string; setQ: (v: string) => void; placeholder?: string;
  selects?: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }[];
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#12281c]/50" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 rounded-md border border-[#12281c]/20 bg-white text-sm"
        />
      </div>
      {selects.map((s) => (
        <select
          key={s.label}
          value={s.value}
          onChange={(e) => s.onChange(e.target.value)}
          className="px-3 py-2 rounded-md border border-[#12281c]/20 bg-white text-sm"
        >
          {s.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ))}
    </div>
  );
}
function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onCancel, busy,
}: {
  title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="mt-2 text-sm text-[#12281c]/80">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-2 rounded border text-sm">Cancel</button>
          <button
            disabled={busy}
            onClick={onConfirm}
            className="px-3 py-2 rounded bg-[#12281c] text-white text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function labelForAction(a: string): string {
  switch (a) {
    case "subscription_change": return "Subscription change";
    case "account_suspend": return "Account suspended";
    case "account_reactivate": return "Account reactivated";
    case "role_assign": return "Role assigned";
    default: return a;
  }
}
function describeAudit(e: AuditEntry): string {
  if (e.action_type === "subscription_change") {
    return `${planLabel(e.previous_value?.plan)} → ${planLabel(e.new_value?.plan)}`;
  }
  if (e.action_type === "account_suspend" || e.action_type === "account_reactivate") {
    return `${e.previous_value?.status ?? "?"} → ${e.new_value?.status ?? "?"}`;
  }
  if (e.action_type === "role_assign") {
    return `role=${e.new_value?.role}`;
  }
  return "";
}
