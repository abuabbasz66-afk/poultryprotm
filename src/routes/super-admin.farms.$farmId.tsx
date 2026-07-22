// Super Admin — Farm Intelligence drill-down. Read-only view of a single farm's
// production, feed, mortality, health, and pricing history. Also hosts the
// Support Mode banner so an admin can log time-bounded access to this farm.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft, Loader2, ShieldCheck, Warehouse, Users2, Egg, Wheat, Skull,
  Stethoscope, DollarSign, LifeBuoy, Activity, TrendingUp, Bird,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, LineChart, Line, BarChart, Bar,
} from "recharts";
import { format as fmtDate, parseISO, isValid as isValidDate } from "date-fns";
import { useAuthUserId } from "@/lib/farm-data";
import { useIsSuperAdmin } from "@/lib/admin-api";
import {
  useFarmIntelligence, useActivityLog,
  useActiveSupportSession, useStartSupport, useEndSupport,
} from "@/lib/admin-monitoring";
import { toast } from "sonner";

export const Route = createFileRoute("/super-admin/farms/$farmId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Farm Intelligence — PoultryPro Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FarmIntelligencePage,
});

type Tab = "overview" | "production" | "feed" | "mortality" | "health" | "finance" | "inventory" | "activity";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "production", label: "Production", icon: Egg },
  { id: "feed", label: "Feed", icon: Wheat },
  { id: "mortality", label: "Mortality", icon: Skull },
  { id: "health", label: "Health", icon: Stethoscope },
  { id: "finance", label: "Finance", icon: DollarSign },
  { id: "inventory", label: "Inventory", icon: Warehouse },
  { id: "activity", label: "Activity", icon: Activity },
];

function fmtDay(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValidDate(d) ? fmtDate(d, "d MMM yyyy") : "—";
}
function fmtDT(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValidDate(d) ? fmtDate(d, "d MMM yyyy, HH:mm") : "—";
}
function num(n: unknown, digits = 0) {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-NG", { maximumFractionDigits: digits });
}

function FarmIntelligencePage() {
  const { farmId } = Route.useParams();
  const navigate = useNavigate();
  const { data: userId, isPending: userPending } = useAuthUserId();
  const { data: isAdmin, isPending: rolePending } = useIsSuperAdmin();
  const intel = useFarmIntelligence(userId ?? null, farmId);
  const support = useActiveSupportSession(userId ?? null, farmId);
  const [tab, setTab] = useState<Tab>("overview");

  if (userPending || rolePending || intel.isPending) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f6f2e6] text-[#12281c]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#0f1f16] text-[#f5efe0] px-4 text-center">
        <div className="max-w-md space-y-3">
          <ShieldCheck className="h-10 w-10 text-red-400 mx-auto" />
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="opacity-80 text-sm">This area is restricted to PoultryPro platform administrators.</p>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="px-4 py-2 rounded-md bg-[#c9a24a] text-[#0f1f16] font-semibold"
          >Back to farm dashboard</button>
        </div>
      </div>
    );
  }
  if (intel.isError || !intel.data) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f6f2e6] text-[#12281c] px-4">
        <div className="text-sm">
          Could not load this farm.{" "}
          <Link to="/super-admin" className="underline">Back to admin</Link>
        </div>
      </div>
    );
  }

  const d = intel.data;
  const farm = (d.farm ?? {}) as Record<string, unknown>;
  const farmName = String(farm.name ?? "Farm");

  return (
    <div className="min-h-screen bg-[#f6f2e6] text-[#12281c]">
      <header className="sticky top-0 z-30 border-b border-[#c9a24a]/20 bg-[#0f1f16] text-[#f5efe0] shadow-lg">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/super-admin" className="p-2 rounded-md border border-white/15 hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#c9a24a] text-[#0f1f16]">
              <Warehouse className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#c9a24a]">Farm Intelligence</div>
              <div className="truncate text-sm sm:text-base font-semibold">{farmName}</div>
            </div>
          </div>
          <SupportControls
            farmId={farmId}
            farmName={farmName}
            userId={userId ?? null}
            active={support.data ?? null}
          />
        </div>

        {support.data && (
          <div className="bg-amber-500/90 text-[#0f1f16] px-4 sm:px-6 py-2 text-xs sm:text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4" />
              <span className="font-semibold">Support Mode active</span>
              <span className="opacity-80">since {fmtDT(support.data.started_at)} — {support.data.reason}</span>
            </div>
          </div>
        )}
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Farm header card */}
        <section className="rounded-2xl border border-[#12281c]/10 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <Meta label="Owner" value={String(d.owner?.email ?? farm.owner_name ?? "—")} />
            <Meta label="Plan" value={String(farm.subscription_plan ?? "basic")} />
            <Meta label="Status" value={String(farm.status ?? "active")} />
            <Meta label="Location" value={[farm.location, farm.state, farm.country].filter(Boolean).join(", ") || "—"} />
            <Meta label="Registered" value={fmtDay(String(farm.created_at ?? ""))} />
            <Meta label="Last sign-in" value={fmtDT(d.owner?.last_sign_in_at ?? null)} />
          </div>
        </section>

        {/* Totals */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi icon={Bird} label="Birds" value={num(d.totals.birds)} />
          <Kpi icon={Egg} label="Eggs" value={num(d.totals.eggs)} />
          <Kpi icon={Egg} label="Crates" value={num(d.totals.crates)} />
          <Kpi icon={Wheat} label="Feed bags" value={num(d.totals.feed_bags, 1)} />
          <Kpi icon={Skull} label="Mortality" value={num(d.totals.mortality)} />
          <Kpi icon={Stethoscope} label="Health records" value={num(d.totals.health_records)} />
        </section>

        {/* Tabs */}
        <nav className="flex flex-wrap gap-1 border-b border-[#12281c]/10">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md border-b-2 transition ${
                  active
                    ? "border-[#c9a24a] text-[#12281c] font-semibold bg-white"
                    : "border-transparent text-[#12281c]/70 hover:text-[#12281c]"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </nav>

        {tab === "overview" && <OverviewSection d={d} />}
        {tab === "production" && <ProductionSection d={d} />}
        {tab === "feed" && <FeedSection d={d} />}
        {tab === "mortality" && <MortalitySection d={d} />}
        {tab === "health" && <HealthSection d={d} />}
        {tab === "finance" && <FinanceSection d={d} />}
        {tab === "inventory" && <InventorySection d={d} />}
        {tab === "activity" && <FarmActivitySection userId={userId ?? null} farmId={farmId} />}
      </div>
    </div>
  );
}

// ---------- Support Mode ----------
function SupportControls({
  farmId, farmName, userId, active,
}: { farmId: string; farmName: string; userId: string | null; active: { id: string } | null }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const start = useStartSupport(userId);
  const end = useEndSupport(userId);

  if (active) {
    return (
      <button
        onClick={async () => {
          try {
            await end.mutateAsync(active.id);
            toast.success("Support Mode ended");
          } catch (e) {
            toast.error("Could not end Support Mode", { description: String((e as Error).message) });
          }
        }}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-amber-500 text-[#0f1f16] font-semibold hover:brightness-95"
      >
        <LifeBuoy className="h-3.5 w-3.5" /> End Support Mode
      </button>
    );
  }
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-white/20 hover:bg-white/10"
      >
        <LifeBuoy className="h-3.5 w-3.5" /> Enter Support Mode
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl bg-white text-[#12281c] p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Enter Support Mode</h3>
            <p className="text-xs text-[#12281c]/70">
              You are about to log support access to <b>{farmName}</b>. All access remains read-only.
              Every action is recorded to the audit log.
            </p>
            <label className="block text-xs">
              Reason (required)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Customer support ticket #…"
                className="mt-1 w-full rounded-md border border-[#12281c]/20 p-2 text-sm"
              />
            </label>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-xs rounded-md border border-[#12281c]/20"
              >Cancel</button>
              <button
                disabled={reason.trim().length < 3 || start.isPending}
                onClick={async () => {
                  try {
                    await start.mutateAsync({ farm_id: farmId, reason: reason.trim() });
                    toast.success("Support Mode activated");
                    setOpen(false);
                    setReason("");
                  } catch (e) {
                    toast.error("Could not start Support Mode", { description: String((e as Error).message) });
                  }
                }}
                className="px-3 py-1.5 text-xs rounded-md bg-[#0f1f16] text-white disabled:opacity-40"
              >Activate</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Section components ----------
function OverviewSection({ d }: { d: import("@/lib/admin-monitoring").FarmIntelligencePayload }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartCard title="Egg production (90 days)">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={d.production_90}>
            <defs>
              <linearGradient id="p90" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#0f7a3f" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#0f7a3f" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#12281c22" />
            <XAxis dataKey="d" hide />
            <YAxis width={40} tick={{ fontSize: 10 }} />
            <ReTooltip />
            <Area dataKey="v" stroke="#0f7a3f" fill="url(#p90)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Mortality (90 days)">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={d.mortality_90}>
            <CartesianGrid strokeDasharray="3 3" stroke="#12281c22" />
            <XAxis dataKey="d" hide />
            <YAxis width={40} tick={{ fontSize: 10 }} />
            <ReTooltip />
            <Bar dataKey="v" fill="#b91c1c" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Feed usage (90 days, bags)">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={d.feed_90}>
            <CartesianGrid strokeDasharray="3 3" stroke="#12281c22" />
            <XAxis dataKey="d" hide />
            <YAxis width={40} tick={{ fontSize: 10 }} />
            <ReTooltip />
            <Line dataKey="v" stroke="#c9a24a" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <RoomsCard rooms={d.rooms} />
    </div>
  );
}

function RoomsCard({ rooms }: { rooms: Array<Record<string, unknown>> }) {
  return (
    <div className="rounded-2xl border border-[#12281c]/10 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-widest text-[#12281c]/60">
        <Users2 className="h-3.5 w-3.5" /> Rooms
      </div>
      {rooms.length === 0 ? (
        <div className="text-sm text-[#12281c]/60">No rooms configured.</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {rooms.map((r) => (
            <div key={String(r.id)} className="rounded-lg border border-[#12281c]/10 p-3 text-sm">
              <div className="font-semibold">{String(r.name ?? "Room")}</div>
              <div className="text-xs text-[#12281c]/70">
                {num(r.current)} / {num(r.initial)} birds
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductionSection({ d }: { d: import("@/lib/admin-monitoring").FarmIntelligencePayload }) {
  return (
    <TableCard
      title="Recent egg production"
      rows={d.recent_production}
      cols={[
        { k: "date", label: "Date", fmt: (v) => fmtDay(String(v ?? "")) },
        { k: "label", label: "Room" },
        { k: "r2", label: "R2" },
        { k: "r3", label: "R3" },
        { k: "r4", label: "R4" },
        { k: "extra", label: "Extra" },
      ]}
    />
  );
}
function FeedSection({ d }: { d: import("@/lib/admin-monitoring").FarmIntelligencePayload }) {
  return (
    <TableCard
      title="Recent feed usage"
      rows={d.recent_feed}
      cols={[
        { k: "date", label: "Date", fmt: (v) => fmtDay(String(v ?? "")) },
        { k: "room", label: "Room" },
        { k: "bags", label: "Bags" },
      ]}
    />
  );
}
function MortalitySection({ d }: { d: import("@/lib/admin-monitoring").FarmIntelligencePayload }) {
  return (
    <TableCard
      title="Recent mortality"
      rows={d.recent_mortality}
      cols={[
        { k: "date", label: "Date", fmt: (v) => fmtDay(String(v ?? "")) },
        { k: "room", label: "Room" },
        { k: "cause", label: "Cause" },
        { k: "loss", label: "Loss" },
      ]}
    />
  );
}
function HealthSection({ d }: { d: import("@/lib/admin-monitoring").FarmIntelligencePayload }) {
  return (
    <TableCard
      title="Recent health records"
      rows={d.recent_health}
      cols={[
        { k: "date", label: "Date", fmt: (v) => fmtDay(String(v ?? "")) },
        { k: "name", label: "Name" },
        { k: "scope", label: "Scope" },
        { k: "type", label: "Type" },
      ]}
    />
  );
}
function FinanceSection({ d }: { d: import("@/lib/admin-monitoring").FarmIntelligencePayload }) {
  return (
    <div className="space-y-4">
      <TableCard
        title="Recent prices"
        rows={d.prices}
        cols={[
          { k: "item", label: "Item" },
          { k: "price", label: "Price", fmt: (v) => `₦${num(v, 2)}` },
          { k: "created_at", label: "Recorded", fmt: (v) => fmtDT(String(v ?? "")) },
        ]}
      />
      <EmptyState
        title="Full finance module coming soon"
        detail="Sales, expenses, cash flow, and P&L will appear here once the finance tables are enabled."
      />
    </div>
  );
}
function InventorySection({ d }: { d: import("@/lib/admin-monitoring").FarmIntelligencePayload }) {
  const feedBags = d.totals.feed_bags;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-[#12281c]/10 bg-white p-5 shadow-sm">
        <div className="text-xs uppercase tracking-widest text-[#12281c]/60 mb-2">Feed used to date</div>
        <div className="text-3xl font-semibold">{num(feedBags, 1)} bags</div>
      </div>
      <EmptyState
        title="Medication & equipment inventory"
        detail="Enable inventory modules to see stock levels and reorder points."
      />
    </div>
  );
}

function FarmActivitySection({ userId, farmId }: { userId: string | null; farmId: string }) {
  const q = useActivityLog(userId, { farm_id: farmId, limit: 200 }, !!userId);
  const rows = q.data ?? [];
  return (
    <div className="rounded-2xl border border-[#12281c]/10 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-widest text-[#12281c]/60">
        <Activity className="h-3.5 w-3.5" /> Farm activity ({rows.length})
      </div>
      {q.isPending ? (
        <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-[#12281c]/60">No activity recorded yet.</div>
      ) : (
        <div className="divide-y divide-[#12281c]/10">
          {rows.map((r) => (
            <div key={r.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{humaniseAction(r.module, r.action)}</div>
                <div className="text-xs text-[#12281c]/60 truncate">
                  {r.user_email ?? "—"} · {r.module}
                </div>
              </div>
              <div className="text-xs tabular-nums text-[#12281c]/70 shrink-0">{fmtDT(r.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Small primitives ----------
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-widest text-[#12281c]/50">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}
function Kpi({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#12281c]/10 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#12281c]/60">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#12281c]/10 bg-white p-5 shadow-sm">
      <div className="text-xs uppercase tracking-widest text-[#12281c]/60 mb-3">{title}</div>
      {children}
    </div>
  );
}
function TableCard({
  title, rows, cols,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  cols: Array<{ k: string; label: string; fmt?: (v: unknown) => string }>;
}) {
  return (
    <div className="rounded-2xl border border-[#12281c]/10 bg-white p-5 shadow-sm overflow-x-auto">
      <div className="text-xs uppercase tracking-widest text-[#12281c]/60 mb-3">{title}</div>
      {rows.length === 0 ? (
        <div className="text-sm text-[#12281c]/60">No records.</div>
      ) : (
        <table className="w-full text-sm min-w-[500px]">
          <thead className="text-xs uppercase tracking-wider text-[#12281c]/60">
            <tr>{cols.map((c) => <th key={c.k} className="text-left px-2 py-2 font-medium">{c.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[#12281c]/5">
            {rows.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.k} className="px-2 py-2">
                    {c.fmt ? c.fmt(r[c.k]) : String(r[c.k] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#12281c]/20 bg-white/40 p-6 text-center">
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-[#12281c]/60 mt-1">{detail}</div>
    </div>
  );
}
function humaniseAction(module: string, action: string): string {
  const m = module[0].toUpperCase() + module.slice(1);
  const parts = action.split("_");
  const verb = parts[parts.length - 1] ?? action;
  return `${m} ${verb}`;
}

// Small helper to satisfy dependency imports
const _touch: typeof useMemo = useMemo;
void _touch;
