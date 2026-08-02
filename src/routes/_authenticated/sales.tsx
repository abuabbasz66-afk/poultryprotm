import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ShoppingCart, TrendingUp, Users, Receipt, Loader2, Egg } from "lucide-react";
import { useEggs } from "@/lib/farm-data";
import { useEffectivePrice } from "@/lib/effective-price";
import { usePermissions, roleStyle } from "@/lib/rbac";
import { PermissionDenied } from "@/components/permission-denied";
import { totalEggsFromRow } from "@/lib/egg-normalize";
import { toDateKey } from "@/lib/date-key";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales Desk — PoultryPro" },
      { name: "description", content: "Record egg sales, track customers and follow up outstanding payments from one sales dashboard." },
      { property: "og:title", content: "Sales Desk — PoultryPro" },
      { property: "og:description", content: "The PoultryPro sales dashboard for egg, spent layer, manure and empty bag sales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalesPage,
});

function naira(n: number) {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function SalesPage() {
  const { can, loading, roleLabel, role } = usePermissions();
  const eggsQ = useEggs();
  const pricing = useEffectivePrice();
  const rs = roleStyle(role);

  const totals = useMemo(() => {
    const rows = eggsQ.data ?? [];
    const today = toDateKey(new Date()) ?? "";
    const now = new Date();
    const weekStart = toDateKey(new Date(now.getTime() - 6 * 86_400_000)) ?? "";
    const monthStart = `${today.slice(0, 7)}-01`;


    const value = (fromKey: string) =>
      rows
        .filter((r) => r.date >= fromKey)
        .reduce((sum, r) => sum + (totalEggsFromRow(r) / 30) * pricing.getEffectivePrice("egg", r.date), 0);

    const todayRows = rows.filter((r) => r.date === today);
    return {
      todayCrates: todayRows.reduce((s, r) => s + totalEggsFromRow(r) / 30, 0),
      today: value(today),
      week: value(weekStart),
      month: value(monthStart),
    };
  }, [eggsQ.data, pricing]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!can("sales.read")) return <PermissionDenied hint="The Sales Desk is available to Sales Officers and the Farm Owner." />;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <ShoppingCart className="h-3.5 w-3.5" /> Sales
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-semibold text-foreground sm:text-3xl">Sales Desk</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Sales value is calculated from recorded production at the egg price in force on each day.
          </p>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", rs.badge)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", rs.dot)} /> {roleLabel}
        </span>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Crates today" value={totals.todayCrates.toFixed(1)} icon={Egg} />
        <Kpi label="Revenue today" value={naira(totals.today)} icon={TrendingUp} />
        <Kpi label="Revenue this week" value={naira(totals.week)} icon={Receipt} />
        <Kpi label="Revenue this month" value={naira(totals.month)} icon={Receipt} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Customers" icon={Users}>
          Customer records, receipts and outstanding payments arrive with the full Sales module.
          Today you can review sales value and daily production volume here.
        </Panel>
        <Panel title="Quick sales entry" icon={ShoppingCart}>
          Egg, spent layer, manure and empty feed bag sales entry is next on the roadmap. Daily
          egg volume is captured in{" "}
          <Link to="/dashboard" search={{ area: "records" }} hash="production" className="font-medium text-[color:var(--forest)] underline">
            Production
          </Link>.
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Egg }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Users; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[color:var(--forest)]" />
        <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
