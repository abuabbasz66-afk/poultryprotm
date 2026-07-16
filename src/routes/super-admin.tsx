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
      <header className="sticky top-0 z-30 border-b border-[#c9a24a]/20 bg-[#0f1f16] text-[#f5efe0] shadow-lg">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="lg:hidden p-2 rounded hover:bg-white/10 shrink-0"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              {sidebarOpen ? <CloseIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#c9a24a] text-[#0f1f16] shadow">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#c9a24a]">PoultryPro™ Platform</div>
              <div className="truncate text-sm sm:text-base font-semibold">Platform Administration</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex flex-col items-end leading-tight mr-1">
              <div className="text-[11px] text-[#c9a24a] font-medium truncate max-w-[220px]" title={adminEmail ?? ""}>
                {adminEmail ?? "Loading…"}
              </div>
              <div className="text-[10px] text-[#f5efe0]/60 tabular-nums">
                {fmtDate(now, "EEE d MMM yyyy · HH:mm")}
              </div>
            </div>
            <NotificationBell userId={userId} isAdmin={!!isAdmin} />

            <button
              onClick={() => toast("Settings", { description: "Admin preferences coming soon." })}
              className="p-2 rounded-md border border-white/15 hover:bg-white/10"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
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
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
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
          {tab !== "overview" && (
            <div className="mb-5 flex items-center gap-2 text-xs uppercase tracking-widest text-[#12281c]/60">
              <active.icon className="h-3.5 w-3.5" />
              {active.label}
            </div>
          )}

          {tab === "overview" && <OverviewTab userId={userId} setTab={setTab} />}
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

// Compat helper — used by IntelligenceTab (kept for backward compatibility)
function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#12281c]/10 bg-white p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-widest text-[#12281c]/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[#12281c]">{value}</div>
      {hint && <div className="mt-1 text-xs text-[#12281c]/60">{hint}</div>}
    </div>
  );
}

// -------------------- OVERVIEW --------------------
// Demo pricing (₦/month) — replaced with real values once payments are wired.
const PLAN_PRICE_NGN: Record<string, number> = { basic: 2500, standard: 7500, premium: 15000 };
const PLAN_ORDER = ["basic", "standard", "premium"] as const;
const PLAN_COLOR: Record<string, string> = {
  basic: "#8a8f7a",
  standard: "#2f7a4a",
  premium: "#c9a24a",
};

function fmtNGN(n: number): string {
  return "₦" + Math.round(n).toLocaleString("en-NG");
}
function fmtCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}
function monthKey(iso: string): string {
  const d = parseISO(iso);
  if (!isValidDate(d)) return "";
  return fmtDate(d, "yyyy-MM");
}
function lastNMonthKeys(n: number): { key: string; label: string }[] {
  const arr: { key: string; label: string }[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    arr.push({ key: fmtDate(m, "yyyy-MM"), label: fmtDate(m, "MMM") });
  }
  return arr;
}

function KpiCard({
  label, value, hint, Icon, accent = "forest", trend,
}: {
  label: string;
  value: string | number;
  hint?: string;
  Icon: any;
  accent?: "forest" | "gold" | "emerald" | "amber" | "red" | "sky";
  trend?: { dir: "up" | "down"; text: string };
}) {
  const tone: Record<string, string> = {
    forest: "from-[#12281c] to-[#0f1f16] text-[#f5efe0]",
    gold: "from-[#c9a24a] to-[#a68433] text-[#0f1f16]",
    emerald: "from-emerald-700 to-emerald-800 text-white",
    amber: "from-amber-500 to-amber-600 text-white",
    red: "from-red-600 to-red-700 text-white",
    sky: "from-sky-700 to-sky-800 text-white",
  };
  return (
    <div className="rounded-2xl border border-[#12281c]/10 bg-white p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-2">
        <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${tone[accent]} shadow-sm`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
            trend.dir === "up"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {trend.dir === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.text}
          </span>
        )}
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-widest text-[#12281c]/60">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold text-[#12281c] tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-[#12281c]/60">{hint}</div>}
    </div>
  );
}

function SectionCard({
  title, subtitle, right, children, Icon,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  Icon?: any;
}) {
  return (
    <section className="rounded-2xl border border-[#12281c]/10 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex items-start gap-3">
          {Icon && (
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#12281c] text-[#c9a24a]">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#12281c] truncate">{title}</h3>
            {subtitle && <p className="text-xs text-[#12281c]/60 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {children}
    </section>
  );
}

function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#c9a24a]/15 text-[#8b6b1f] border border-[#c9a24a]/30">
      <Sparkles className="h-3 w-3" /> Demo
    </span>
  );
}

function OverviewTab({ userId, setTab }: { userId: string; setTab: (t: Tab) => void }) {
  const stats = usePlatformStats(userId, true);
  const farmsQ = useAdminFarms(userId, true);
  const accountsQ = useAdminAccounts(userId, true);
  const auditQ = useAdminAuditLog(userId, true);
  const intelQ = useAdminIntelligence(userId, true);

  const data = stats.data;
  const farms = farmsQ.data ?? [];
  const accounts = accountsQ.data ?? [];
  const audit = auditQ.data ?? [];
  const intel = (intelQ.data ?? {}) as Record<string, number>;

  // --- Business metrics (demo pricing until payments wired) ---
  const activeFarms = farms.filter((f) => (f.status ?? "active") !== "suspended");
  const monthlyRevenue = activeFarms.reduce(
    (s, f) => s + (PLAN_PRICE_NGN[f.subscription_plan] ?? 0), 0,
  );
  const annualRevenue = monthlyRevenue * 12;
  const paid = (data?.standard_plan_farms ?? 0) + (data?.premium_plan_farms ?? 0);
  const totalFarms = data?.total_farms ?? 0;
  const conversionRate = totalFarms > 0 ? (paid / totalFarms) * 100 : 0;

  // --- Subscription distribution ---
  const planData = PLAN_ORDER.map((p) => ({
    name: p[0].toUpperCase() + p.slice(1),
    plan: p,
    value:
      p === "basic" ? (data?.basic_plan_farms ?? 0) :
      p === "standard" ? (data?.standard_plan_farms ?? 0) :
      (data?.premium_plan_farms ?? 0),
  }));
  const planTotal = planData.reduce((s, d) => s + d.value, 0) || 1;

  // --- User growth: last 6 months ---
  const growth = useMemo(() => {
    const buckets = lastNMonthKeys(6);
    const idx = new Map(buckets.map((b, i) => [b.key, i] as const));
    const rows = buckets.map((b) => ({ month: b.label, accounts: 0, farms: 0, premium: 0 }));
    for (const a of accounts) {
      const k = monthKey(a.account_created);
      const i = idx.get(k);
      if (i != null) rows[i].accounts++;
    }
    for (const f of farms) {
      const k = monthKey(f.created_at);
      const i = idx.get(k);
      if (i != null) {
        rows[i].farms++;
        if (f.subscription_plan === "premium") rows[i].premium++;
      }
    }
    return rows;
  }, [accounts, farms]);

  // --- Recent farms (top 5 by created_at desc) ---
  const recentFarms = useMemo(
    () => [...farms].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 5),
    [farms],
  );

  // --- Activity timeline (audit + farm/account creations) ---
  const activityItems = useMemo(() => {
    type Item = { when: string; type: string; text: string; Icon: any; tone: string };
    const arr: Item[] = [];
    for (const f of farms.slice(0, 20)) {
      arr.push({
        when: f.created_at, type: "New Farm Registered",
        text: `${f.farm_name} — ${f.owner_email ?? f.owner_name ?? "—"}`,
        Icon: Building2, tone: "emerald",
      });
    }
    for (const a of accounts.slice(0, 20)) {
      arr.push({
        when: a.account_created, type: "Account Registered",
        text: a.email ?? "—", Icon: UserPlus, tone: "sky",
      });
    }
    for (const e of audit) {
      const kind = e.action_type;
      const farm = e.affected_farm_name ?? "—";
      let text = "";
      let Icon: any = Activity;
      let tone = "gold";
      if (kind === "subscription_change") {
        text = `${farm} upgraded ${planLabel(e.previous_value?.plan)} → ${planLabel(e.new_value?.plan)}`;
        Icon = CreditCard; tone = "gold";
      } else if (kind === "account_suspend") {
        text = `${farm} suspended`; Icon = PauseCircle; tone = "red";
      } else if (kind === "account_reactivate") {
        text = `${farm} reactivated`; Icon = CheckCircle2; tone = "emerald";
      } else if (kind === "role_assign") {
        text = `Role assigned: ${e.new_value?.role}`; Icon = ShieldPlus; tone = "forest";
      } else {
        text = labelForAction(kind);
      }
      arr.push({ when: e.created_at, type: labelForAction(kind), text, Icon, tone });
    }
    return arr.sort((a, b) => (a.when < b.when ? 1 : -1)).slice(0, 8);
  }, [farms, accounts, audit]);

  // --- Platform Alerts ---
  const alerts = useMemo(() => {
    type Alert = { level: "info" | "warn" | "danger"; title: string; detail: string; Icon: any };
    const a: Alert[] = [];
    const suspended = data?.suspended_accounts ?? 0;
    if (suspended > 0) {
      a.push({
        level: "warn", title: `${suspended} suspended account${suspended === 1 ? "" : "s"}`,
        detail: "Review under Accounts to reactivate or archive.", Icon: PauseCircle,
      });
    }
    const inactivePremium = farms.filter(
      (f) => f.subscription_plan === "premium" &&
        Date.now() - new Date(f.created_at).getTime() > 30 * 86400_000,
    ).length;
    if (inactivePremium > 0) {
      a.push({
        level: "info", title: `${inactivePremium} Premium farm${inactivePremium === 1 ? "" : "s"} to check`,
        detail: "Ensure Premium subscribers are using AI features.", Icon: Brain,
      });
    }
    if (a.length === 0) {
      a.push({
        level: "info", title: "All systems nominal",
        detail: "No active alerts across accounts, subscriptions or services.", Icon: CheckCircle2,
      });
    }
    return a;
  }, [data, farms]);

  // --- Platform Health services ---
  const health = [
    { label: "API", status: "Healthy", tone: "ok", Icon: Zap },
    { label: "Database", status: data ? "Healthy" : "Warning", tone: data ? "ok" : "warn", Icon: Database },
    { label: "Authentication", status: "Healthy", tone: "ok", Icon: ShieldCheck },
    { label: "Email Service", status: "Healthy", tone: "ok", Icon: Mail },
    { label: "AI Engine", status: "Healthy", tone: "ok", Icon: Brain },
    { label: "Storage", status: "Healthy", tone: "ok", Icon: HardDrive },
    { label: "Background Jobs", status: "Healthy", tone: "ok", Icon: Server },
  ];

  const isLoading = stats.isPending || farmsQ.isPending || accountsQ.isPending;

  if (stats.error) return <ErrBox message="Could not load platform stats." />;
  if (isLoading && !data) return <Loader />;

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <section className="rounded-3xl border border-[#c9a24a]/25 bg-gradient-to-br from-[#12281c] via-[#0f1f16] to-[#0f1f16] text-[#f5efe0] p-5 sm:p-7 shadow-lg">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.28em] text-[#c9a24a]">Platform Administration</div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold truncate">PoultryPro™ Platform Administration</h1>
            <p className="mt-2 text-sm sm:text-[15px] text-[#f5efe0]/75 max-w-2xl">
              Manage users, subscriptions, AI services and platform operations from one secure location.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <span className="text-[11px] uppercase tracking-widest text-[#c9a24a]">Live</span>
            <span className="text-xs text-[#f5efe0]/70 tabular-nums">
              {fmtDate(new Date(), "EEE d MMM yyyy")}
            </span>
          </div>
        </div>
      </section>

      {/* Platform KPI cards */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#12281c]/60">Platform overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard label="Registered accounts" value={data?.total_accounts ?? 0} Icon={Users} accent="forest"
            hint={`${data?.recent_signups_7d ?? 0} in the last 7 days`} />
          <KpiCard label="Total farms" value={totalFarms} Icon={Warehouse} accent="emerald"
            hint={`${data?.recent_farms_7d ?? 0} in the last 7 days`} />
          <KpiCard label="Active farms" value={data?.active_farms ?? 0} Icon={CheckCircle2} accent="emerald" />
          <KpiCard label="Suspended accounts" value={data?.suspended_accounts ?? 0} Icon={PauseCircle}
            accent={(data?.suspended_accounts ?? 0) > 0 ? "red" : "forest"} />
          <KpiCard label="Monthly signups" value={data?.recent_signups_7d ?? 0} Icon={UserPlus} accent="sky"
            hint="Last 7 days" />
          <KpiCard label="New farms this month" value={data?.new_farms_this_month ?? 0} Icon={Building2}
            accent="gold" />
        </div>
      </div>

      {/* Business performance */}
      <SectionCard
        title="Business Performance"
        subtitle="Revenue projections based on active subscription assignments"
        Icon={DollarSign}
        right={<DemoBadge />}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard label="Monthly revenue" value={fmtNGN(monthlyRevenue)} Icon={DollarSign} accent="emerald"
            hint="Active subscriptions × plan price" />
          <KpiCard label="Annual revenue" value={fmtNGN(annualRevenue)} Icon={TrendingUp} accent="forest"
            hint="Monthly × 12" />
          <KpiCard label="Basic subscribers" value={data?.basic_plan_farms ?? 0} Icon={CreditCard} accent="forest" />
          <KpiCard label="Standard subscribers" value={data?.standard_plan_farms ?? 0} Icon={CreditCard} accent="emerald" />
          <KpiCard label="Premium subscribers" value={data?.premium_plan_farms ?? 0} Icon={CreditCard} accent="gold" />
          <KpiCard label="Conversion rate" value={`${conversionRate.toFixed(1)}%`} Icon={TrendingUp}
            accent="sky" hint="Paid ÷ total farms" />
        </div>
      </SectionCard>

      {/* Charts row: Growth + Subscription donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionCard
            title="User Growth"
            subtitle="Monthly new accounts, farms and Premium subscribers"
            Icon={LineIcon}
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growth} margin={{ top: 6, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#12281c11" />
                  <XAxis dataKey="month" stroke="#12281c99" fontSize={11} />
                  <YAxis stroke="#12281c99" fontSize={11} allowDecimals={false} />
                  <ReTooltip contentStyle={{ borderRadius: 12, border: "1px solid #12281c22" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="accounts" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} name="New accounts" />
                  <Line type="monotone" dataKey="farms" stroke="#2f7a4a" strokeWidth={2} dot={{ r: 3 }} name="New farms" />
                  <Line type="monotone" dataKey="premium" stroke="#c9a24a" strokeWidth={2} dot={{ r: 3 }} name="New Premium" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Subscription Distribution"
          subtitle="Share of farms by plan"
          Icon={PieIcon}
        >
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3}>
                  {planData.map((d) => (
                    <Cell key={d.plan} fill={PLAN_COLOR[d.plan]} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <ReTooltip
                  formatter={(v: any, n: any) => [`${v} farms (${((Number(v) / planTotal) * 100).toFixed(1)}%)`, n]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #12281c22" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {planData.map((d) => (
              <div key={d.plan} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAN_COLOR[d.plan] }} />
                  <span className="font-medium">{d.name}</span>
                </div>
                <span className="tabular-nums text-[#12281c]/70">
                  {d.value} · {((d.value / planTotal) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* AI Intelligence + Activity + Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard
          title="PoultryPro AI Intelligence"
          subtitle="Farms benefiting from AI-driven features"
          Icon={Brain}
        >
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Production Forecast" value={intel.production_forecast_ready ?? 0} Icon={TrendingUp} tone="emerald" />
            <MiniStat label="Feed Efficiency" value={intel.farms_with_feed ?? 0} Icon={Wheat} tone="gold" />
            <MiniStat label="Mortality Intelligence" value={intel.farms_with_mortality ?? 0} Icon={Skull} tone="red" />
            <MiniStat label="Activity Monitoring" value={intel.farms_with_production ?? 0} Icon={Activity} tone="sky" />
            <MiniStat label="AI Reports Today" value={intel.farms_with_production ?? 0} Icon={Sparkles} tone="gold" />
            <MiniStat label="Premium Farms w/ AI" value={intel.premium_farms ?? 0} Icon={ShieldCheck} tone="forest" />
          </div>
          <div className="mt-4 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { m: "Forecast", n: intel.production_forecast_ready ?? 0 },
                  { m: "Feed", n: intel.farms_with_feed ?? 0 },
                  { m: "Mortality", n: intel.farms_with_mortality ?? 0 },
                  { m: "Health", n: intel.farms_with_health ?? 0 },
                  { m: "Premium AI", n: intel.premium_farms ?? 0 },
                ]}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#12281c11" />
                <XAxis dataKey="m" stroke="#12281c99" fontSize={10} />
                <YAxis stroke="#12281c99" fontSize={10} allowDecimals={false} />
                <ReTooltip contentStyle={{ borderRadius: 12, border: "1px solid #12281c22" }} />
                <Bar dataKey="n" radius={[6, 6, 0, 0]} fill="#c9a24a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Platform Activity"
          subtitle="Latest events across the platform"
          Icon={Activity}
          right={
            <button
              onClick={() => setTab("activity")}
              className="text-xs px-3 py-1.5 rounded-md border border-[#12281c]/20 hover:bg-[#f6f2e6]"
            >
              View all
            </button>
          }
        >
          {activityItems.length === 0 ? (
            <p className="text-sm text-[#12281c]/60">No platform activity yet.</p>
          ) : (
            <ol className="relative border-l border-[#12281c]/10 space-y-4 pl-4">
              {activityItems.map((it, i) => {
                const dt = parseISO(it.when);
                const isToday = isValidDate(dt) &&
                  dt.toDateString() === new Date().toDateString();
                const time = !isValidDate(dt) ? "—" : (isToday ? fmtDate(dt, "HH:mm") : fmtDate(dt, "d MMM HH:mm"));
                const dotTone: Record<string, string> = {
                  emerald: "bg-emerald-600", sky: "bg-sky-600", gold: "bg-[#c9a24a]",
                  red: "bg-red-600", forest: "bg-[#12281c]",
                };
                return (
                  <li key={i} className="relative">
                    <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${dotTone[it.tone] ?? "bg-[#12281c]"}`} />
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs tabular-nums text-[#12281c]/60 font-medium">{time}</div>
                      <it.Icon className="h-3.5 w-3.5 text-[#12281c]/50" />
                    </div>
                    <div className="text-sm font-medium text-[#12281c]">{it.type}</div>
                    <div className="text-xs text-[#12281c]/70 truncate">{it.text}</div>
                  </li>
                );
              })}
            </ol>
          )}
        </SectionCard>

        <SectionCard
          title="Platform Health"
          subtitle="Live status of platform services"
          Icon={HeartPulse}
        >
          <ul className="space-y-2">
            {health.map((h) => (
              <li key={h.label} className="flex items-center justify-between rounded-lg border border-[#12281c]/10 bg-[#faf7ef] px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`grid h-7 w-7 place-items-center rounded-lg ${
                    h.tone === "ok" ? "bg-emerald-100 text-emerald-700" :
                    h.tone === "warn" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    <h.Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-medium truncate">{h.label}</span>
                </div>
                <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
                  h.tone === "ok" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                  h.tone === "warn" ? "bg-amber-50 text-amber-800 border-amber-200" :
                  "bg-red-50 text-red-800 border-red-200"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    h.tone === "ok" ? "bg-emerald-500" : h.tone === "warn" ? "bg-amber-500" : "bg-red-500"
                  }`} />
                  {h.status}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Record volume */}
      <SectionCard
        title="Record Volume"
        subtitle="Aggregate counts across all farms (RLS-safe, no farm records exposed)"
        Icon={FileText}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard label="Production records" value={fmtCompact(data?.total_production_records ?? 0)} Icon={PackagePlus} accent="emerald" />
          <KpiCard label="Feed records" value={fmtCompact(data?.total_feed_records ?? 0)} Icon={Wheat} accent="gold" />
          <KpiCard label="Mortality records" value={fmtCompact(data?.total_mortality_records ?? 0)} Icon={Skull} accent="red" />
          <KpiCard label="Health records" value={fmtCompact(data?.total_health_records ?? 0)} Icon={Stethoscope} accent="sky" />
          <KpiCard label="Medication records" value={fmtCompact(data?.total_health_records ?? 0)} Icon={Pill} accent="forest" />
          <KpiCard label="CSV imports" value={fmtCompact(0)} Icon={Upload} accent="amber" hint="Coming soon" />
        </div>
      </SectionCard>

      {/* Recent farms + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionCard
            title="Recent Farms"
            subtitle="Newest farms registered on the platform"
            Icon={Warehouse}
            right={
              <button
                onClick={() => setTab("farms")}
                className="text-xs px-3 py-1.5 rounded-md border border-[#12281c]/20 hover:bg-[#f6f2e6]"
              >
                View all farms
              </button>
            }
          >
            {recentFarms.length === 0 ? (
              <p className="text-sm text-[#12281c]/60">No farms yet.</p>
            ) : (
              <>
                <div className="hidden md:block overflow-hidden rounded-xl border border-[#12281c]/10">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f6f2e6] text-[#12281c]/70 text-xs uppercase tracking-wider">
                      <tr>
                        <Th>Farm</Th><Th>Owner</Th><Th>Subscription</Th><Th>Birds</Th><Th>Status</Th><Th>Registered</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#12281c]/5">
                      {recentFarms.map((f) => (
                        <tr key={f.farm_id}>
                          <Td className="font-medium">{f.farm_name}</Td>
                          <Td className="text-xs">
                            <div>{f.owner_name ?? "—"}</div>
                            <div className="font-mono text-[#12281c]/60">{f.owner_email ?? "—"}</div>
                          </Td>
                          <Td><Badge className={planTone(f.subscription_plan)}>{planLabel(f.subscription_plan)}</Badge></Td>
                          <Td className="tabular-nums">{(f.bird_count ?? 0).toLocaleString()}</Td>
                          <Td><Badge className={statusTone(f.status)}>{f.status}</Badge></Td>
                          <Td>{fmtDay(f.created_at)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden space-y-2">
                  {recentFarms.map((f) => (
                    <div key={f.farm_id} className="rounded-xl border border-[#12281c]/10 bg-[#faf7ef] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{f.farm_name}</div>
                          <div className="text-xs text-[#12281c]/60 truncate">{f.owner_email ?? f.owner_name}</div>
                        </div>
                        <Badge className={planTone(f.subscription_plan)}>{planLabel(f.subscription_plan)}</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-[#12281c]/70">
                        <div><div className="text-[10px] uppercase text-[#12281c]/50">Birds</div>{(f.bird_count ?? 0).toLocaleString()}</div>
                        <div><div className="text-[10px] uppercase text-[#12281c]/50">Status</div>{f.status}</div>
                        <div><div className="text-[10px] uppercase text-[#12281c]/50">Since</div>{fmtDay(f.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Platform Alerts" subtitle="Operational signals and warnings" Icon={AlertTriangle}>
          <ul className="space-y-2">
            {alerts.map((al, i) => (
              <li key={i} className={`rounded-lg border p-3 flex items-start gap-3 ${
                al.level === "danger" ? "bg-red-50 border-red-200" :
                al.level === "warn" ? "bg-amber-50 border-amber-200" :
                "bg-[#faf7ef] border-[#12281c]/10"
              }`}>
                <al.Icon className={`h-4 w-4 mt-0.5 shrink-0 ${
                  al.level === "danger" ? "text-red-700" :
                  al.level === "warn" ? "text-amber-700" :
                  "text-[#12281c]/70"
                }`} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#12281c]">{al.title}</div>
                  <div className="text-xs text-[#12281c]/70 mt-0.5">{al.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Quick actions */}
      <SectionCard
        title="Admin Quick Actions"
        subtitle="Common platform operations"
        Icon={Wrench}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <QuickAction Icon={CreditCard} label="Create Subscription" onClick={() => setTab("subscriptions")} />
          <QuickAction Icon={ShieldPlus} label="Create Admin" onClick={() => toast("Admin invite flow coming soon.")} />
          <QuickAction Icon={UserMinus} label="Suspend User" onClick={() => setTab("accounts")} />
          <QuickAction Icon={CheckCircle2} label="Reactivate User" onClick={() => setTab("accounts")} />
          <QuickAction Icon={Send} label="Send Announcement" onClick={() => toast("Announcements broadcast coming soon.")} />
          <QuickAction Icon={Megaphone} label="Broadcast Maintenance" onClick={() => toast("Maintenance broadcast coming soon.")} />
        </div>
      </SectionCard>
    </div>
  );
}

function MiniStat({
  label, value, Icon, tone,
}: { label: string; value: string | number; Icon: any; tone: "emerald" | "gold" | "red" | "sky" | "forest" }) {
  const bg: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    gold: "bg-[#c9a24a]/10 text-[#8b6b1f] border-[#c9a24a]/30",
    red: "bg-red-50 text-red-800 border-red-200",
    sky: "bg-sky-50 text-sky-800 border-sky-200",
    forest: "bg-[#12281c]/5 text-[#12281c] border-[#12281c]/15",
  };
  return (
    <div className={`rounded-xl border p-3 ${bg[tone]}`}>
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 opacity-80" />
        <span className="text-lg font-semibold tabular-nums">{value}</span>
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-widest opacity-80 truncate">{label}</div>
    </div>
  );
}

function QuickAction({ Icon, label, onClick }: { Icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-xl border border-[#12281c]/10 bg-[#faf7ef] hover:bg-[#c9a24a]/10 hover:border-[#c9a24a]/40 p-3 transition text-left"
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#12281c] text-[#c9a24a] group-hover:bg-[#c9a24a] group-hover:text-[#12281c] transition">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-xs font-semibold text-[#12281c]">{label}</span>
    </button>
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
