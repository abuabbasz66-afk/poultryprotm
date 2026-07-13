import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Egg, Bird, TrendingDown, TrendingUp, Wheat, DollarSign,
  Skull, Syringe, Droplets, Plus, Pencil, Trash2, MapPin,
  Sparkles, ArrowLeft, LayoutDashboard, LineChart as LineChartIcon,
  Brain, Activity, AlertTriangle, Gauge, Radar, Lightbulb, ArrowRight, LogOut, Upload,
  ChevronDown, MoreVertical,
} from "lucide-react";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import {
  useRooms, useEggs, useMortality, useHealth, useFeed, usePrices,
  useAddRoom, useDeleteRoom,
  useAddEgg, useAddMortality, useAddHealth, useAddFeed,
  useAddPrice, useDeletePrice, useDeleteMortality, useDeleteFeed,
  type Room, type EggRow, type Mortality, type Health, type Feed, type Price,
} from "@/lib/farm-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Farm Dashboard — PoultryPro" },
      { name: "description", content: "Live poultry farm operations: production, feed, health, mortality and profitability." },
      { property: "og:title", content: "Farm Dashboard — PoultryPro" },
      { property: "og:description", content: "Real-time visibility into every bird, egg, and naira." },
    ],
  }),
  component: Dashboard,
});

// ---------- Helpers ----------
const naira = (n: number) => "₦" + n.toLocaleString("en-NG");

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function todayShortLabel() {
  return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Dashboard() {
  const navigate = useNavigate();
  const roomsQ = useRooms();
  const eggsQ = useEggs();
  const mortalityQ = useMortality();
  const healthQ = useHealth();
  const feedQ = useFeed();
  const pricesQ = usePrices();

  const rooms: Room[] = roomsQ.data ?? [];
  const eggs: EggRow[] = eggsQ.data ?? [];
  const mortality: Mortality[] = mortalityQ.data ?? [];
  const health: Health[] = healthQ.data ?? [];
  const feed: Feed[] = feedQ.data ?? [];
  const prices: Price[] = pricesQ.data ?? [];

  const addRoomM = useAddRoom();
  const delRoomM = useDeleteRoom();
  const addEggM = useAddEgg();
  const addMortalityM = useAddMortality();
  const addHealthM = useAddHealth();
  const addFeedM = useAddFeed();
  const addPriceM = useAddPrice();
  const delPriceM = useDeletePrice();
  const delMortalityM = useDeleteMortality();
  const delFeedM = useDeleteFeed();

  const [feedTab, setFeedTab] = useState<"Usage" | "Formulas">("Usage");
  const [area, setArea] = useState<"records" | "analytics" | "ai">("records");
  const [forecastOpen, setForecastOpen] = useState(false);
  const [mortalityOpen, setMortalityOpen] = useState(false);
  const [feedEffOpen, setFeedEffOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [bagWeightKg, setBagWeightKg] = useState<number | null>(null);
  const [mortShowAll, setMortShowAll] = useState(false);
  const [feedShowAll, setFeedShowAll] = useState(false);
  const [expandedMortDate, setExpandedMortDate] = useState<string | null>(null);
  const [expandedFeedDate, setExpandedFeedDate] = useState<string | null>(null);
  const [eggShowAll, setEggShowAll] = useState(false);

  // Derived
  const totalBirds = rooms.reduce((s, r) => s + r.current, 0);
  const totalLoss = rooms.reduce((s, r) => s + (r.initial - r.current), 0);
  const today = eggs[0];
  const todayCrates = today ? today.r2 + today.r3 + today.r4 : 0;
  const todayExtra = today?.extra ?? 0;
  const todayEggs = todayCrates * 30 + todayExtra;
  const yesterdayEggs = eggs[1] ? (eggs[1].r2 + eggs[1].r3 + eggs[1].r4) * 30 + eggs[1].extra : todayEggs;
  const diffPct = yesterdayEggs ? ((todayEggs - yesterdayEggs) / yesterdayEggs) * 100 : 0;
  const totalEggs = eggs.reduce((s, r) => s + (r.r2 + r.r3 + r.r4) * 30 + r.extra, 0);
  const totalCrates = eggs.reduce((s, r) => s + r.r2 + r.r3 + r.r4, 0);
  const monthlyMortality = mortality.reduce((s, m) => s + m.loss, 0);
  const latestFeedDate = feed[0]?.date;
  const feedToday = latestFeedDate ? feed.filter(f => f.date === latestFeedDate).reduce((s, f) => s + f.bags, 0) : 0;
  const productionRate = totalBirds ? Math.round((todayEggs / totalBirds) * 100) : 0;
  const last7Eggs = eggs.slice(0, 7);
  const sevenDayAvgEggs = last7Eggs.length
    ? Math.round(last7Eggs.reduce((s, r) => s + (r.r2 + r.r3 + r.r4) * 30 + r.extra, 0) / last7Eggs.length)
    : 0;
  const currentLayRate = totalBirds ? (totalEggs / totalBirds) * 100 : 0;
  const eggPrice = prices.find(p => p.item === "Egg")?.price ?? 4900;
  const feedPrice = prices.find(p => p.item.startsWith("Feed"))?.price ?? 13600;
  const todayRevenue = Math.round((todayEggs / 30) * eggPrice);
  const todayCost = Math.round(feedToday * feedPrice);
  const todayProfit = todayRevenue - todayCost;

  const chartData = useMemo(
    () => [...eggs].reverse().map(e => ({
      name: e.label.replace(/^[A-Za-z]{3}, /, ""),
      "ROOM 2": e.r2, "ROOM 3": e.r3, "ROOM 4": e.r4, "Extra Eggs": e.extra,
    })),
    [eggs],
  );

  const profitData = useMemo(
    () => [...eggs].reverse().map(e => {
      const rev = ((e.r2 + e.r3 + e.r4) * 30 + e.extra) / 30 * eggPrice;
      const cost = 19 * feedPrice; // stable ~19 bags/day baseline
      return { name: e.label.replace(/^[A-Za-z]{3}, /, ""), Revenue: Math.round(rev), Cost: cost, Profit: Math.round(rev - cost) };
    }),
    [eggs, eggPrice, feedPrice],
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  // Actions (persisted to database)
  const addRoom = () => {
    const n = prompt("Room name (e.g. ROOM 5)"); if (!n) return;
    const b = parseInt(prompt("Initial birds") || "0", 10) || 0;
    addRoomM.mutate({ name: n, initial: b }, {
      onError: (e) => alert("Failed to save room: " + (e as Error).message),
    });
  };
  const delRoom = (id: string) => {
    if (!confirm("Delete this room?")) return;
    delRoomM.mutate(id, { onError: (e) => alert("Failed to delete: " + (e as Error).message) });
  };

  const recordProduction = () => {
    const label = prompt("Date label (e.g. Sat, 21 Feb)", todayLabel()); if (!label) return;
    const dateInput = prompt("Date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!dateInput) return;
    const r2 = +(prompt("ROOM 2 crates", "0") || "0");
    const r3 = +(prompt("ROOM 3 crates", "0") || "0");
    const r4 = +(prompt("ROOM 4 crates", "0") || "0");
    const extra = +(prompt("Extra eggs", "0") || "0");
    addEggM.mutate({ date: dateInput, label, r2, r3, r4, extra }, {
      onError: (e) => alert("Failed to save production: " + (e as Error).message),
    });
  };

  const addMortality = () => {
    const room = prompt("Room (e.g. ROOM 3)"); if (!room) return;
    const cause = prompt("Cause", "Unknown") || "Unknown";
    const dateStr = prompt("Date (e.g. 21 Feb)", todayShortLabel()) || todayShortLabel();
    const loss = +(prompt("Loss (birds)", "1") || "1");
    if (!loss) return;
    addMortalityM.mutate({ room: room.toUpperCase(), cause, date: dateStr, loss }, {
      onError: (e) => alert("Failed to save mortality: " + (e as Error).message),
    });
  };

  const addHealth = () => {
    const name = prompt("Name (e.g. MIAVIT)"); if (!name) return;
    const type = ((prompt("Type: Vitamin or Vaccination", "Vitamin") || "Vitamin") as Health["type"]);
    const scope = prompt("Scope (All Rooms or ROOM 2 / ROOM 3 / ROOM 4)", "All Rooms") || "All Rooms";
    const date = prompt("Date (e.g. 21 Feb)", todayShortLabel()) || todayShortLabel();
    addHealthM.mutate({ name: name.toUpperCase(), scope, type, date }, {
      onError: (e) => alert("Failed to save health record: " + (e as Error).message),
    });
  };

  const recordFeed = () => {
    const room = prompt("Room (e.g. ROOM 3)"); if (!room) return;
    const bags = +(prompt("Bags", "1") || "1");
    const date = prompt("Date (e.g. 21 Feb)", todayShortLabel()) || todayShortLabel();
    if (!bags) return;
    addFeedM.mutate({ room: room.toUpperCase(), bags, date }, {
      onError: (e) => alert("Failed to save feed: " + (e as Error).message),
    });
  };

  const addPrice = () => {
    const item = prompt("Item"); if (!item) return;
    const unit = prompt("Unit", "1") || "1";
    const price = +(prompt("Price (NGN)", "0") || "0");
    const updated = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    addPriceM.mutate({ item, unit, price, updated }, {
      onError: (e) => alert("Failed to save price: " + (e as Error).message),
    });
  };
  const delPrice = (id: string) => {
    if (!confirm("Delete this price?")) return;
    delPriceM.mutate(id, { onError: (e) => alert("Failed to delete: " + (e as Error).message) });
  };

  const delMortalityRow = (id: string) => {
    if (!confirm("Delete this mortality record?")) return;
    delMortalityM.mutate(id, { onError: (e) => alert("Failed to delete: " + (e as Error).message) });
  };
  const delFeedRow = (id: string) => {
    if (!confirm("Delete this feed record?")) return;
    delFeedM.mutate(id, { onError: (e) => alert("Failed to delete: " + (e as Error).message) });
  };

  // --- Mortality aggregation (grouped by date, preserving arrival order) ---
  type MortGroup = { date: string; total: number; byRoom: Record<string, number>; causes: string[]; items: Mortality[] };
  const mortalityByDate = useMemo<MortGroup[]>(() => {
    const map = new Map<string, MortGroup>();
    for (const m of mortality) {
      let g = map.get(m.date);
      if (!g) { g = { date: m.date, total: 0, byRoom: {}, causes: [], items: [] }; map.set(m.date, g); }
      g.total += m.loss;
      g.byRoom[m.room] = (g.byRoom[m.room] ?? 0) + m.loss;
      if (!g.causes.includes(m.cause)) g.causes.push(m.cause);
      g.items.push(m);
    }
    return Array.from(map.values());
  }, [mortality]);

  const totalInitialBirds = rooms.reduce((s, r) => s + r.initial, 0);
  const mortalityRatePct = totalInitialBirds ? (monthlyMortality / totalInitialBirds) * 100 : 0;
  const leadingCause = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of mortality) c[m.cause] = (c[m.cause] ?? 0) + m.loss;
    const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return top?.[0] ?? "—";
  }, [mortality]);

  // --- Feed aggregation (grouped by date, dynamic rooms) ---
  type FeedGroup = { date: string; byRoom: Record<string, number>; total: number; items: Feed[] };
  const feedByDate = useMemo<FeedGroup[]>(() => {
    const map = new Map<string, FeedGroup>();
    for (const f of feed) {
      let g = map.get(f.date);
      if (!g) { g = { date: f.date, byRoom: {}, total: 0, items: [] }; map.set(f.date, g); }
      g.byRoom[f.room] = (g.byRoom[f.room] ?? 0) + f.bags;
      g.total += f.bags;
      g.items.push(f);
    }
    return Array.from(map.values());
  }, [feed]);

  const feedRoomNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of rooms) set.add(r.name);
    for (const f of feed) set.add(f.room);
    return Array.from(set).sort();
  }, [rooms, feed]);

  const feed7 = feedByDate.slice(0, 7);
  const feed30 = feedByDate.slice(0, 30);
  const feed7Avg = feed7.length ? feed7.reduce((s, g) => s + g.total, 0) / feed7.length : 0;
  const feed30Total = feed30.reduce((s, g) => s + g.total, 0);
  const bagKg = bagWeightKg ?? 25;
  const feedPerBirdG = totalBirds ? (feedToday * bagKg * 1000) / totalBirds : 0;

  return (
    <div className="min-h-screen bg-background text-foreground pb-14">
      {/* Header */}
      <header className="bg-[color:var(--forest)] text-primary-foreground">
        <div className="container-x flex items-center justify-between py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img src={logoAsset.url} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
              <span className="font-display font-semibold">PoultryPro™</span>
            </div>
            <Link
              to="/import"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-xs text-primary-foreground/90 hover:bg-white/10"
              title="Import historical records from CSV"
            >
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </Link>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-xs text-primary-foreground/90 hover:bg-white/10"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
        <div className="container-x pb-10 pt-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Capture</span>
            <ArrowRight className="h-3 w-3 opacity-60" />
            <span>Understand</span>
            <ArrowRight className="h-3 w-3 opacity-60" />
            <span>Predict</span>
          </div>
          <div className="mt-1.5 text-xs text-primary-foreground/70 max-w-2xl">
            Farm Records &amp; Analytics active · PoultryPro AI Intelligence progressively rolling out on Premium
          </div>
          <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold">ABZ GLOBAL RESOURCE</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-primary-foreground/80">
            <MapPin className="h-4 w-4" /> Katsina State, Nigeria
          </div>
          <div className="mt-2 text-sm text-primary-foreground/70">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm">
            <Bird className="h-4 w-4 text-[color:var(--gold)]" />
            <span className="font-semibold">{totalBirds.toLocaleString()} birds</span>
            <span className="text-primary-foreground/60">·</span>
            <span className="text-primary-foreground/80">{rooms.length} rooms</span>
          </div>
        </div>
      </header>

      <main className="container-x -mt-6 space-y-6">
        {/* Product-area navigation: Capture → Understand → Predict */}
        <nav aria-label="Dashboard areas" className="rounded-3xl bg-card border border-border p-2 shadow-[var(--shadow-soft)]">
          <div className="grid grid-cols-3 gap-1.5">
            <AreaTab
              active={area === "records"} onClick={() => setArea("records")}
              num="01" stage="CAPTURE" title="Farm Records" plan="Basic" icon={LayoutDashboard}
            />
            <AreaTab
              active={area === "analytics"} onClick={() => setArea("analytics")}
              num="02" stage="UNDERSTAND" title="Farm Analytics" plan="Standard" icon={LineChartIcon}
            />
            <AreaTab
              active={area === "ai"} onClick={() => setArea("ai")}
              num="03" stage="PREDICT" title="AI Intelligence" plan="Premium" icon={Brain} premium
            />
          </div>
        </nav>

        {area === "analytics" && (
          <div className="space-y-6">
            <SectionIntro
              stage="UNDERSTAND" plan="Standard" title="Farm Analytics"
              body="Turn structured farm records into production, financial and operational intelligence."
            />

            {/* Operational Intelligence Summary — computed from existing records */}
            <Card>
              <CardHeader
                title={<span className="inline-flex items-center gap-2"><Gauge className="h-5 w-5 text-[color:var(--forest)]" /> Operational Intelligence Summary</span>}
                subtitle="Executive view calculated from your live farm records"
              />
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <InsightRow
                  label="Production vs 80% target"
                  value={`${productionRate}%`}
                  detail={productionRate >= 80
                    ? `${productionRate - 80} pts above target`
                    : `${80 - productionRate} pts below target`}
                  positive={productionRate >= 80}
                />
                <InsightRow
                  label="Today vs previous recorded day"
                  value={`${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%`}
                  detail={`${todayEggs.toLocaleString()} eggs today · ${yesterdayEggs.toLocaleString()} prior`}
                  positive={diffPct >= 0}
                />
                <InsightRow
                  label="Highest producing room today"
                  value={(() => {
                    if (!today) return "—";
                    const arr = [
                      { name: "ROOM 2", v: today.r2 },
                      { name: "ROOM 3", v: today.r3 },
                      { name: "ROOM 4", v: today.r4 },
                    ].sort((a, b) => b.v - a.v);
                    return `${arr[0].name} · ${arr[0].v} crates`;
                  })()}
                  detail="Based on latest recorded production"
                  positive
                />
                <InsightRow
                  label="Monthly mortality total"
                  value={String(monthlyMortality)}
                  detail={`${feedToday} bags fed today · today's profit ${naira(todayProfit)}`}
                  positive={monthlyMortality <= 5}
                />
              </div>
            </Card>


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard tone="mint" icon={Egg} label="Today's Eggs" value={todayEggs.toLocaleString()}
            hint={`${todayCrates} crates + ${todayExtra} extra`}
            trend={diffPct >= 0 ? { up: true, text: `${diffPct.toFixed(1)}% vs yesterday` } : { up: false, text: `${Math.abs(diffPct).toFixed(1)}% vs yesterday` }} />
          <KpiCard tone="plain" icon={Bird} label="Total Birds" value={totalBirds.toLocaleString()} hint={`Across ${rooms.length} rooms`} />
          <KpiCard tone="sky" icon={TrendingUp} label="Production Rate" value={`${productionRate}%`} hint="Target: 80%" />
          <KpiCard tone="peach" icon={Skull} label="Monthly Mortality" value={String(monthlyMortality)} hint="This month" />
          <KpiCard tone="plain" icon={Wheat} label="Feed Today" value={`${feedToday} bags`} hint="All rooms" />
          <KpiCard tone="mint" icon={DollarSign} label="Today's Profit" value={naira(todayProfit)} hint={`Revenue: ${naira(todayRevenue)}`} />
        </div>

        {/* Monthly Egg Production */}
        <Card>
          <CardHeader
            title="Monthly Egg Production"
            subtitle="Crates per room & extra eggs (this month)"
            right={<div className="text-right"><div className="font-display text-2xl font-semibold text-[color:var(--forest)]">{totalEggs.toLocaleString()}</div><div className="text-xs text-muted-foreground">total eggs</div></div>}
          />
          <div className="h-72 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 85)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ROOM 2" fill="oklch(0.32 0.06 155)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="ROOM 3" fill="oklch(0.78 0.15 78)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="ROOM 4" fill="oklch(0.55 0.15 240)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Extra Eggs" fill="oklch(0.55 0.22 15)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Monthly Profit */}
        <Card>
          <CardHeader
            title="Monthly Profit Overview"
            subtitle="Revenue vs feed cost (this month)"
            right={<div className="text-right"><div className="font-display text-2xl font-semibold text-[color:var(--forest)]">{naira(profitData.reduce((s, d) => s + d.Profit, 0))}</div><div className="text-xs text-muted-foreground">from {naira(profitData.reduce((s, d) => s + d.Revenue, 0))} revenue</div></div>}
          />
          <div className="h-72 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitData} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 85)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => "₦" + (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: number) => naira(v)} contentStyle={{ borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Revenue" stroke="oklch(0.32 0.06 155)" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Cost" stroke="oklch(0.78 0.15 78)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
          </div>
        )}

        {area === "records" && (
          <div className="space-y-6">
            <SectionIntro
              stage="CAPTURE" plan="Basic" title="Farm Records"
              body="Digitise daily poultry activities and maintain structured operational records across production, feed, flock health, mortality and farm rooms."
            />

        {/* Daily Egg Production table */}
        <Card>
          <CardHeader
            title={<span className="inline-flex items-center gap-2"><Egg className="h-5 w-5 text-[color:var(--forest)]" /> Daily Egg Production</span>}
            subtitle="One row per room per date — click Record to add a new day"
            right={<ActionBtn onClick={recordProduction} icon={Plus}>Record Production</ActionBtn>}
          />
          <div className="grid grid-cols-3 gap-3 mt-4">
            <MiniStat label="Today's Production" value={`${todayCrates} cr`} tone="mint" />
            <MiniStat label="7-Day Avg" value={`${sevenDayAvgEggs.toLocaleString()} eggs`} tone="sky" />
            <MiniStat label="Current Lay Rate" value={`${currentLayRate.toFixed(1)}%`} tone="plain" />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  {rooms.map(r => (
                    <th key={r.id} className="py-2 pr-4 font-medium whitespace-nowrap">{r.name.replace(/^ROOM\s*/i, "R")}</th>
                  ))}
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Extra</th>
                </tr>
              </thead>
              <tbody>
                {(eggShowAll ? eggs : eggs.slice(0, 7)).map(e => {
                  const roomVal = (name: string): number | null => {
                    const n = name.toUpperCase();
                    if (n === "ROOM 2") return e.r2;
                    if (n === "ROOM 3") return e.r3;
                    if (n === "ROOM 4") return e.r4;
                    return null;
                  };
                  return (
                    <tr key={e.id ?? e.date + e.label} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 whitespace-nowrap">{e.label}</td>
                      {rooms.map(r => {
                        const v = roomVal(r.name);
                        return (
                          <td key={r.id} className="py-2.5 pr-4 tabular-nums">
                            {v === null ? <span className="text-muted-foreground/50" title="Not recorded">—</span> : v}
                          </td>
                        );
                      })}
                      <td className="py-2.5 pr-4">
                        <span className="inline-flex items-center rounded-full bg-[color:var(--forest)] text-primary-foreground px-2.5 py-0.5 text-xs font-medium">
                          {e.r2 + e.r3 + e.r4}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{e.extra ? `+${e.extra}` : "—"}</td>
                    </tr>
                  );
                })}
                {eggs.length === 0 && (
                  <tr><td colSpan={rooms.length + 3} className="py-4 text-center text-muted-foreground text-xs">
                    <span className="font-medium">Pending entry</span> — no production records yet.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {eggs.length > 7 && (
            <div className="mt-3 text-center">
              <button onClick={() => setEggShowAll(v => !v)} className="text-xs font-medium text-[color:var(--forest)] hover:underline">
                {eggShowAll ? "Show latest 7 only" : `View all ${eggs.length} production records`}
              </button>
            </div>
          )}
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Room overview */}
          <Card>
            <CardHeader title="Room Overview" subtitle="Current status per room" />
            <div className="mt-4 space-y-2">
              {rooms.map(r => {
                const todayR = today ? (r.name === "ROOM 2" ? today.r2 : r.name === "ROOM 3" ? today.r3 : r.name === "ROOM 4" ? today.r4 : 0) : 0;
                const loss = r.initial - r.current;
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-2xl bg-secondary/50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--forest)]/10 text-[color:var(--forest)]"><Bird className="h-4 w-4" /></span>
                      <div>
                        <div className="font-semibold text-sm">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.current.toLocaleString()} birds</div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="inline-flex items-center gap-1 text-[color:var(--forest)]"><Egg className="h-3.5 w-3.5" /> {todayR} <span className="text-muted-foreground text-xs">crates</span></div>
                      {loss > 0 && <div className="text-xs text-destructive flex items-center gap-1 justify-end mt-0.5"><TrendingDown className="h-3 w-3" /> {loss}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Mortality */}
          <Card>
            <CardHeader title="Mortality Log" subtitle="Grouped by date" right={<ActionBtn onClick={addMortality} icon={Plus}>Add</ActionBtn>} />
            <div className="grid grid-cols-3 gap-3 mt-4">
              <MiniStat label="Total Loss" value={String(monthlyMortality)} tone="peach" />
              <MiniStat label="Mortality Rate" value={mortalityRatePct.toFixed(2) + "%"} tone="plain" />
              <MiniStat label="Leading Cause" value={leadingCause} tone="mint" />
            </div>
            <div className="mt-4 space-y-2">
              {(mortShowAll ? mortalityByDate : mortalityByDate.slice(0, 7)).map(g => {
                const isOpen = expandedMortDate === g.date;
                const cause = g.causes.length > 1 ? "Mixed" : (g.causes[0] ?? "—");
                const breakdown = Object.entries(g.byRoom)
                  .map(([r, n]) => `${r.replace(/^ROOM\s*/i, "R")}: ${n}`)
                  .join(" · ");
                return (
                  <div key={g.date} className="rounded-xl bg-destructive/5 border border-destructive/10 overflow-hidden">
                    <button
                      onClick={() => setExpandedMortDate(isOpen ? null : g.date)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive"><Skull className="h-3.5 w-3.5" /></span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{g.date} <span className="text-destructive">· -{g.total} birds</span></div>
                          <div className="text-xs text-muted-foreground truncate">{breakdown || "—"} <span className="opacity-70">| {cause}</span></div>
                        </div>
                      </div>
                      <ChevronDown className={"h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (isOpen ? "rotate-180" : "")} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-destructive/10 bg-background/60 px-3 py-2 space-y-1.5">
                        {g.items.map(m => (
                          <div key={m.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium">{m.room}</span>
                              <span className="text-muted-foreground truncate">· {m.cause}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-destructive font-semibold">-{m.loss}</span>
                              <button onClick={() => delMortalityRow(m.id)} className="text-destructive/70 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {mortalityByDate.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">No mortality records yet.</div>
              )}
            </div>
            {mortalityByDate.length > 7 && (
              <div className="mt-3 text-center">
                <button onClick={() => setMortShowAll(v => !v)} className="text-xs font-medium text-[color:var(--forest)] hover:underline">
                  {mortShowAll ? "Show latest 7 only" : `View all mortality records (${mortalityByDate.length})`}
                </button>
              </div>
            )}
          </Card>
        </div>

        {/* Health */}
        <Card>
          <CardHeader title="Health Records" subtitle="Vaccinations, vitamins & observations" right={<ActionBtn onClick={addHealth} icon={Plus}>Add</ActionBtn>} />
          <div className="mt-4 space-y-2">
            {health.map(h => (
              <div key={h.id} className="flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={"grid h-9 w-9 place-items-center rounded-lg " + (h.type === "Vaccination" ? "bg-blue-500/10 text-blue-600" : "bg-[color:var(--forest)]/10 text-[color:var(--forest)]")}>
                    {h.type === "Vaccination" ? <Syringe className="h-4 w-4" /> : <Droplets className="h-4 w-4" />}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{h.name}</div>
                    <div className="text-xs text-muted-foreground">{h.scope}</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + (h.type === "Vaccination" ? "bg-blue-500/10 text-blue-700" : "bg-[color:var(--forest)]/10 text-[color:var(--forest)]")}>{h.type}</span>
                  <div className="text-xs text-muted-foreground mt-1">{h.date}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Room Management */}
        <Card>
          <CardHeader
            title={<span className="inline-flex items-center gap-2"><Bird className="h-5 w-5 text-[color:var(--forest)]" /> Room Management</span>}
            subtitle="Add, edit or remove poultry rooms — scalable for unlimited rooms"
            right={<ActionBtn onClick={addRoom} icon={Plus}>Add Room</ActionBtn>}
          />
          <div className="grid grid-cols-3 gap-3 mt-4">
            <MiniStat label="Total Birds" value={totalBirds.toLocaleString()} tone="sky" />
            <MiniStat label="Active Rooms" value={String(rooms.length)} tone="mint" />
            <MiniStat label="Total Loss" value={String(totalLoss)} tone="peach" />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Room</th>
                  <th className="py-2 pr-4 font-medium">Current</th>
                  <th className="py-2 pr-4 font-medium">Initial</th>
                  <th className="py-2 pr-4 font-medium">Loss</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(r => {
                  const loss = r.initial - r.current;
                  const pct = ((loss / (r.initial || 1)) * 100).toFixed(1);
                  return (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-3 pr-4 flex items-center gap-2"><Bird className="h-4 w-4 text-[color:var(--forest)]" />{r.name}</td>
                      <td className="py-3 pr-4">{r.current.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{r.initial.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-destructive">-{loss} <span className="text-xs">({pct}%)</span></td>
                      <td className="py-3 pr-4"><span className="inline-flex rounded-full bg-[color:var(--forest)] text-primary-foreground px-2.5 py-0.5 text-xs font-medium">Healthy</span></td>
                      <td className="py-3 pr-4 text-right">
                        <button onClick={() => delRoom(r.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4 inline" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Feed Management */}
        <Card>
          <CardHeader
            title="Feed Management"
            subtitle="Formulas & daily usage"
            right={
              <div className="inline-flex rounded-full bg-secondary p-1 text-xs font-medium">
                {(["Usage", "Formulas"] as const).map(t => (
                  <button key={t} onClick={() => setFeedTab(t)} className={"px-3 py-1 rounded-full transition " + (feedTab === t ? "bg-[color:var(--forest)] text-primary-foreground" : "text-muted-foreground")}>{t}</button>
                ))}
              </div>
            }
          />
          <div className="mt-4 flex justify-end">
            <ActionBtn onClick={recordFeed} icon={Plus}>Record Feed</ActionBtn>
          </div>
          {feedTab === "Usage" ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <MiniStat label="Today's Feed" value={`${feedToday} bags`} tone="sky" />
                <MiniStat label="7-Day Avg" value={`${feed7Avg.toFixed(1)} bags`} tone="mint" />
                <MiniStat label="Feed / Bird" value={`${feedPerBirdG.toFixed(0)} g`} tone="plain" />
                <MiniStat label="30-Day Usage" value={`${feed30Total.toFixed(1)} bags`} tone="peach" />
              </div>
              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground bg-[color:var(--gold)]/10">
                      <th className="py-2 px-3 font-medium">Date</th>
                      {feedRoomNames.map(rn => (
                        <th key={rn} className="py-2 px-3 font-medium text-right whitespace-nowrap">{rn.replace(/^ROOM\s*/i, "R")}</th>
                      ))}
                      <th className="py-2 px-3 font-medium text-right whitespace-nowrap">Total</th>
                      <th className="py-2 px-2 w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(feedShowAll ? feedByDate : feedByDate.slice(0, 7)).map(g => {
                      const isOpen = expandedFeedDate === g.date;
                      return (
                        <Fragment key={g.date}>
                          <tr key={g.date} className="border-t border-border/60 hover:bg-[color:var(--gold)]/5 cursor-pointer" onClick={() => setExpandedFeedDate(isOpen ? null : g.date)}>
                            <td className="py-2 px-3 font-medium whitespace-nowrap">{g.date}</td>
                            {feedRoomNames.map(rn => (
                              <td key={rn} className="py-2 px-3 text-right tabular-nums">{g.byRoom[rn] ? g.byRoom[rn] : <span className="text-muted-foreground/50">—</span>}</td>
                            ))}
                            <td className="py-2 px-3 text-right font-semibold tabular-nums whitespace-nowrap">{g.total} bags</td>
                            <td className="py-2 px-2 text-muted-foreground"><ChevronDown className={"h-3.5 w-3.5 transition-transform " + (isOpen ? "rotate-180" : "")} /></td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-background/60">
                              <td colSpan={feedRoomNames.length + 3} className="px-3 py-2">
                                <div className="space-y-1">
                                  {g.items.map(f => (
                                    <div key={f.id} className="flex items-center justify-between text-xs">
                                      <span className="font-medium">{f.room}</span>
                                      <div className="flex items-center gap-3">
                                        <span className="tabular-nums">{f.bags} bags</span>
                                        <button onClick={(e) => { e.stopPropagation(); delFeedRow(f.id); }} className="text-destructive/70 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {feedByDate.length === 0 && (
                      <tr><td colSpan={feedRoomNames.length + 3} className="py-4 text-center text-muted-foreground">No feed records yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {feedByDate.length > 7 && (
                <div className="mt-3 text-center">
                  <button onClick={() => setFeedShowAll(v => !v)} className="text-xs font-medium text-[color:var(--forest)] hover:underline">
                    {feedShowAll ? "Show latest 7 only" : `View all feed records (${feedByDate.length})`}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="mt-4 p-6 text-center text-muted-foreground text-sm bg-secondary/40 rounded-xl">No custom formulas yet.</div>
          )}
        </Card>

        {/* Prices */}
        <Card>
          <CardHeader
            title={<span className="inline-flex items-center gap-2"><DollarSign className="h-5 w-5 text-[color:var(--forest)]" /> Current Prices</span>}
            subtitle="Update egg, feed, and ingredient prices anytime"
            right={<ActionBtn onClick={addPrice} icon={Plus}>Add Price Item</ActionBtn>}
          />
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Item</th>
                  <th className="py-2 pr-4 font-medium">Unit</th>
                  <th className="py-2 pr-4 font-medium">Price (₦)</th>
                  <th className="py-2 pr-4 font-medium">Last Updated</th>
                  <th className="py-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {prices.map(p => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-3 pr-4">{p.item}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{p.unit}</td>
                    <td className="py-3 pr-4 font-semibold">{naira(p.price)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{p.updated}</td>
                    <td className="py-3 pr-4 text-right space-x-3">
                      <button className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4 inline" /></button>
                      <button onClick={() => delPrice(p.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4 inline" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
          </div>
        )}

        {area === "ai" && (
          <div className="space-y-6">
            <SectionIntro
              stage="PREDICT" plan="Premium" title="PoultryPro AI Intelligence" premium
              body="Progressively applying artificial intelligence to detect abnormal farm patterns, forecast production and support earlier evidence-based decisions."
            />

            {/* AI Intelligence Preview — computed from real records */}
            <div className="rounded-3xl border border-[color:var(--gold)]/40 bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--ink)] text-primary-foreground p-6 md:p-7 shadow-[var(--shadow-lift)]">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
                <Sparkles className="h-3.5 w-3.5" /> AI Intelligence Preview
              </div>
              <h3 className="mt-1 font-display text-2xl md:text-3xl font-semibold">Analytical decision-support preview</h3>
              <p className="mt-1 text-sm text-primary-foreground/70 max-w-2xl">
                Rule-based observations generated from your existing farm records while full ML models progressively roll out.
              </p>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                <PreviewInsight
                  kicker="Production Monitoring"
                  metric={`${productionRate}%`}
                  metricLabel={`Farm target: 80%`}
                  observation={
                    productionRate >= 80
                      ? `Current production is ${productionRate - 80} percentage points above the configured farm target.`
                      : `Current production is ${80 - productionRate} percentage point${80 - productionRate === 1 ? "" : "s"} below the configured farm target.`
                  }
                  action="Review recent production, feed and health records for changes that may require investigation."
                />
                <PreviewInsight
                  kicker="Production Trend"
                  metric={`${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%`}
                  metricLabel="vs previous recorded day"
                  observation={
                    diffPct >= 0
                      ? `Today's recorded production is ${diffPct.toFixed(1)}% higher than the previous recorded day.`
                      : `Today's recorded production is ${Math.abs(diffPct).toFixed(1)}% lower than the previous recorded day.`
                  }
                  action="Continue monitoring the next production records to determine whether this movement is temporary or developing into a trend."
                />
                <PreviewInsight
                  kicker="Mortality Watch"
                  metric={String(monthlyMortality)}
                  metricLabel="losses this month"
                  observation={
                    monthlyMortality === 0
                      ? "No mortality has been recorded this month across active rooms."
                      : `${monthlyMortality} bird loss${monthlyMortality === 1 ? "" : "es"} recorded this month across active rooms.`
                  }
                  action="Cross-check mortality entries against recent health records and feed batches for any correlated changes."
                />
                <PreviewInsight
                  kicker="Feed vs Production"
                  metric={`${feedToday} bags`}
                  metricLabel={`for ${todayEggs.toLocaleString()} eggs today`}
                  observation={`Today's feed usage is ${feedToday} bags against ${todayEggs.toLocaleString()} eggs produced across ${rooms.length} rooms.`}
                  action="Watch for feed usage rising while egg output stays flat — an early signal of efficiency change."
                />
              </div>

              <div className="mt-5 text-[11px] text-primary-foreground/60 border-t border-white/10 pt-3">
                PoultryPro AI Intelligence provides operational decision support and does not replace veterinary diagnosis or professional farm management judgement.
              </div>
            </div>

            {/* Capability cards — Progressive Rollout */}
            <Card>
              <CardHeader
                title={<span className="inline-flex items-center gap-2"><Brain className="h-5 w-5 text-[color:var(--forest)]" /> Premium AI Capabilities</span>}
                subtitle="Progressively rolling out on the Premium plan"
              />
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <AiCard icon={LineChartIcon} title="Production Forecasting"
                  desc="Analyse historical egg production patterns to support short-term production forecasting."
                  active={forecastOpen}
                  onClick={() => setForecastOpen(v => !v)}
                  actionLabel={forecastOpen ? "Hide 7-day forecast" : "Open 7-day forecast"}
                  badge="Early Predictive Model" />
                <AiCard icon={TrendingDown} title="Production Decline Detection"
                  desc="Monitor production trends and flag unusual declines for earlier investigation." />
                <AiCard icon={AlertTriangle} title="Mortality Risk Monitoring"
                  desc="Analyse mortality patterns across rooms and flocks to identify abnormal changes."
                  active={mortalityOpen}
                  onClick={() => setMortalityOpen(v => !v)}
                  actionLabel={mortalityOpen ? "Hide mortality risk monitor" : "Open mortality risk monitor"}
                  badge="Early Risk Model" />
                <AiCard icon={Wheat} title="Feed Efficiency Monitoring"
                  desc="Compare feed usage with production performance to identify possible efficiency changes."
                  active={feedEffOpen}
                  onClick={() => setFeedEffOpen(v => !v)}
                  actionLabel={feedEffOpen ? "Hide feed efficiency monitor" : "Open feed efficiency monitor"}
                  badge="Early Efficiency Model" />
                <AiCard icon={Radar} title="Abnormal Farm Activity Detection"
                  desc="Cross-analyse production, mortality, feed and health records to detect unusual operational patterns."
                  active={activityOpen}
                  onClick={() => setActivityOpen(v => !v)}
                  actionLabel={activityOpen ? "Hide activity monitor" : "Open activity monitor"}
                  badge="Early Anomaly Model" />
                <AiCard icon={Lightbulb} title="AI-Supported Farm Insights"
                  desc="Transform farm data patterns into clear operational observations and decision-support recommendations." />
              </div>
            </Card>

            {forecastOpen && (
              <ProductionForecast eggs={eggs} totalBirds={totalBirds} />
            )}

            {mortalityOpen && (
              <MortalityRiskMonitor rooms={rooms} mortality={mortality} eggs={eggs} health={health} />
            )}

            {feedEffOpen && (
              <FeedEfficiencyMonitor
                rooms={rooms} feed={feed} eggs={eggs} mortality={mortality} health={health}
                bagWeightKg={bagWeightKg} onBagWeightChange={setBagWeightKg}
              />
            )}

            {activityOpen && (
              <AbnormalActivityMonitor
                rooms={rooms} eggs={eggs} feed={feed} mortality={mortality} health={health}
                bagWeightKg={bagWeightKg}
              />
            )}
          </div>
        )}

        <div className="pt-6 text-center text-xs text-muted-foreground">
          {new Date().getFullYear()} ABZ GLOBAL RESOURCE — Poultry Farm Management System
        </div>
      </main>
    </div>
  );
}

/* ------------------ small building blocks ------------------ */

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-3xl bg-card border border-border p-5 md:p-6 shadow-[var(--shadow-soft)]">{children}</section>;
}

function CardHeader({ title, subtitle, right }: { title: React.ReactNode; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-xl md:text-2xl font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

const toneMap = {
  mint: "bg-[color:var(--forest)]/8 border-[color:var(--forest)]/15",
  sky: "bg-blue-500/8 border-blue-500/15",
  peach: "bg-[color:var(--gold)]/15 border-[color:var(--gold)]/25",
  plain: "bg-card border-border",
} as const;

function KpiCard({ tone, icon: Icon, label, value, hint, trend }: {
  tone: keyof typeof toneMap; icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; hint?: string;
  trend?: { up: boolean; text: string };
}) {
  return (
    <div className={"rounded-2xl border p-5 " + toneMap[tone]}>
      <div className="flex items-start justify-between">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-background/60"><Icon className="h-4 w-4 text-[color:var(--forest)]" /></span>
      </div>
      <div className="mt-3 font-display text-3xl md:text-4xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      {trend && (
        <div className={"mt-2 text-xs inline-flex items-center gap-1 " + (trend.up ? "text-[color:var(--forest)]" : "text-destructive")}>
          {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} {trend.text}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: keyof typeof toneMap }) {
  return (
    <div className={"rounded-xl border p-3 " + toneMap[tone]}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Egg className="h-3.5 w-3.5" /> {label}</div>
      <div className="font-display text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function ActionBtn({ onClick, icon: Icon, children }: { onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--forest)] text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition">
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function AreaTab({ active, onClick, num, stage, title, plan, icon: Icon, premium }: {
  active: boolean; onClick: () => void; num: string; stage: string; title: string; plan: string;
  icon: React.ComponentType<{ className?: string }>; premium?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "group text-left rounded-2xl border p-3 md:p-4 transition " +
        (active
          ? (premium
              ? "bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--ink)] text-primary-foreground border-[color:var(--gold)]/50 shadow-[var(--shadow-soft)]"
              : "bg-[color:var(--forest)] text-primary-foreground border-[color:var(--forest)] shadow-[var(--shadow-soft)]")
          : "bg-card text-foreground border-border hover:border-[color:var(--forest)]/40")
      }
    >
      <div className="flex items-center gap-2">
        <span className={"grid h-8 w-8 shrink-0 place-items-center rounded-lg " + (active ? "bg-white/10 text-[color:var(--gold)]" : "bg-[color:var(--forest)]/8 text-[color:var(--forest)]")}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className={"text-[10px] uppercase tracking-[0.18em] " + (active ? "text-[color:var(--gold)]" : "text-muted-foreground")}>
            {num} · {stage}
          </div>
          <div className="text-sm md:text-base font-semibold truncate">{title}</div>
        </div>
      </div>
      <div className={"mt-2 hidden md:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " + (active ? "bg-white/10 text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
        {plan} plan
      </div>
    </button>
  );
}

function SectionIntro({ stage, plan, title, body, premium }: {
  stage: string; plan: string; title: string; body: string; premium?: boolean;
}) {
  return (
    <div className={"rounded-3xl border p-5 md:p-6 " + (premium
      ? "bg-gradient-to-br from-[color:var(--forest)]/5 to-[color:var(--gold)]/10 border-[color:var(--gold)]/30"
      : "bg-card border-border")}>
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)]">
        <span>{stage}</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="rounded-full bg-[color:var(--forest)]/8 px-2 py-0.5 text-[10px] tracking-[0.16em] text-[color:var(--forest)]">{plan} plan</span>
        {premium && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] tracking-[0.16em] text-[color:var(--ink)]">
            <Sparkles className="h-3 w-3" /> Progressive rollout
          </span>
        )}
      </div>
      <h2 className="mt-1 font-display text-2xl md:text-3xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-3xl">{body}</p>
    </div>
  );
}

function InsightRow({ label, value, detail, positive }: {
  label: string; value: string; detail: string; positive: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground min-w-0">{label}</div>
        <span className={"shrink-0 inline-flex items-center gap-1 text-xs " + (positive ? "text-[color:var(--forest)]" : "text-destructive")}>
          <Activity className="h-3 w-3" />
        </span>
      </div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function PreviewInsight({ kicker, metric, metricLabel, observation, action }: {
  kicker: string; metric: string; metricLabel: string; observation: string; action: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--gold)]">{kicker}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <div className="font-display text-2xl font-semibold text-primary-foreground">{metric}</div>
        <div className="text-[11px] text-primary-foreground/60">{metricLabel}</div>
      </div>
      <div className="mt-2 text-xs text-primary-foreground/85 leading-relaxed">
        <span className="text-primary-foreground/60">Observation: </span>{observation}
      </div>
      <div className="mt-1.5 text-xs text-primary-foreground/85 leading-relaxed">
        <span className="text-primary-foreground/60">Suggested action: </span>{action}
      </div>
    </div>
  );
}

function AiCard({ icon: Icon, title, desc, active, onClick, actionLabel, badge }: {
  icon: React.ComponentType<{ className?: string }>; title: string; desc: string;
  active?: boolean; onClick?: () => void; actionLabel?: string; badge?: string;
}) {
  const interactive = typeof onClick === "function";
  const Wrap: React.ElementType = interactive ? "button" : "div";
  return (
    <Wrap
      {...(interactive ? { onClick, type: "button" } : {})}
      className={
        "relative text-left rounded-2xl border p-4 transition w-full " +
        (interactive
          ? (active
              ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10 shadow-[var(--shadow-soft)]"
              : "border-border bg-secondary/30 hover:border-[color:var(--forest)]/40 hover:bg-secondary/50")
          : "border-border bg-secondary/30")
      }
    >
      <span className="absolute right-3 top-3 rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase text-[color:var(--ink)]">
        {badge ?? "Progressive Rollout"}
      </span>
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--forest)]/10 text-[color:var(--forest)]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="mt-3 font-display text-base md:text-lg font-semibold pr-24">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{desc}</div>
      {interactive && (
        <div className={"mt-3 inline-flex items-center gap-1 text-xs font-medium " + (active ? "text-[color:var(--forest)]" : "text-[color:var(--forest)]/80")}>
          <Sparkles className="h-3 w-3" /> {actionLabel}
          <ArrowRight className="h-3 w-3" />
        </div>
      )}
    </Wrap>
  );
}

/* ------------------ Production Forecast ------------------ */

function ProductionForecast({ eggs, totalBirds }: { eggs: EggRow[]; totalBirds: number }) {
  const forecast = useMemo(() => computeForecast(eggs, totalBirds), [eggs, totalBirds]);

  if (!forecast) {
    return (
      <Card>
        <CardHeader
          title="7-Day Production Forecast"
          subtitle="Short-term production outlook calculated from recent farm production patterns."
        />
        <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Not enough historical production records yet to generate a forecast. Add a few more daily egg-production entries to unlock the 7-day outlook.
        </div>
      </Card>
    );
  }

  const {
    latestTotal, latestPct, avgForecast, low, high, direction, chartData, boundaryLabel,
  } = forecast;

  const isDeclining = direction === "Declining" || direction === "Stable with downward movement";
  const isImproving = direction === "Increasing" || direction === "Stable with upward movement";
  const directionTone =
    direction === "Increasing" ? "text-[color:var(--forest)]"
    : direction === "Declining" ? "text-destructive"
    : direction === "Stable with upward movement" ? "text-[color:var(--forest)]/80"
    : direction === "Stable with downward movement" ? "text-destructive/80"
    : "text-muted-foreground";
  const DirectionIcon =
    isImproving ? TrendingUp
    : isDeclining ? TrendingDown
    : Activity;

  const observation =
    direction === "Increasing"
      ? "Recent production records indicate a clearly improving production pattern."
      : direction === "Stable with upward movement"
        ? "Recent production remains within its normal range but shows a mild upward movement."
        : direction === "Declining"
          ? "Recent production records indicate a clearly softening production pattern that warrants attention."
          : direction === "Stable with downward movement"
            ? "Recent production remains within its normal range but shows a mild downward movement worth monitoring."
            : "Recent production records indicate a relatively stable production pattern with minimal movement.";
  const outlook =
    direction === "Declining"
      ? `Projected daily production over the next 7 days is around ${avgForecast.toLocaleString()} eggs, within a ${low.toLocaleString()}–${high.toLocaleString()} range if the current downward movement continues.`
      : `Production is projected to remain within roughly ${low.toLocaleString()}–${high.toLocaleString()} eggs per day (average ~${avgForecast.toLocaleString()}) if current operating conditions remain similar.`;
  const action =
    direction === "Declining"
      ? "Investigate recent feed, health and mortality records for changes that may be driving the decline, and continue monitoring daily production closely."
      : direction === "Stable with downward movement"
        ? "Continue monitoring feed, health and daily egg production to confirm whether the mild downward movement remains within normal variation."
        : "Continue monitoring feed usage, mortality and daily egg production for changes that may affect the projected trend.";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)]">
            <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> Predict</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] tracking-[0.16em] text-[color:var(--ink)]">Early Predictive Model</span>
          </div>
          <h2 className="mt-1 font-display text-2xl md:text-3xl font-semibold">7-Day Production Forecast</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Short-term production outlook calculated from recent farm production patterns.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <ForecastStat
          label="Current Production"
          value={latestTotal.toLocaleString()}
          hint={`${latestPct}% production rate${totalBirds ? ` · ${totalBirds.toLocaleString()} birds` : ""}`}
        />
        <ForecastStat
          label="7-Day Forecast (avg/day)"
          value={avgForecast.toLocaleString()}
          hint="Projected average daily eggs"
        />
        <ForecastStat
          label="Expected Range"
          value={`${low.toLocaleString()}–${high.toLocaleString()}`}
          hint="Based on recent variation"
        />
        <ForecastStat
          label="Forecast Direction"
          value={direction}
          hint="From recent production trend"
          valueClassName={directionTone}
          icon={DirectionIcon}
        />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold">Production Trend &amp; 7-Day Outlook</h3>
            <p className="text-xs text-muted-foreground">Historical daily eggs on the left of the marker · forecast on the right.</p>
          </div>
        </div>
        <div className="h-72 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 85)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine x={boundaryLabel} stroke="oklch(0.55 0.15 60)" strokeDasharray="4 4"
                label={{ value: "Forecast starts", position: "top", fill: "oklch(0.45 0.12 60)", fontSize: 10 }} />
              <Line type="monotone" dataKey="Historical" stroke="oklch(0.32 0.06 155)" strokeWidth={2.5} dot={{ r: 2 }} connectNulls={false} />
              <Line type="monotone" dataKey="Forecast" stroke="oklch(0.55 0.15 60)" strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 2 }} connectNulls={false} />
              <Line type="monotone" dataKey="Upper" stroke="oklch(0.55 0.15 60)" strokeOpacity={0.35} strokeWidth={1} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="Lower" stroke="oklch(0.55 0.15 60)" strokeOpacity={0.35} strokeWidth={1} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/8 p-4 md:p-5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink)]">
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> PoultryPro Insight
        </div>
        <div className="mt-2 text-sm leading-relaxed">
          <div><span className="text-muted-foreground">Observation: </span>{observation}</div>
          <div className="mt-1.5"><span className="text-muted-foreground">7-Day Outlook: </span>{outlook}</div>
          <div className="mt-1.5"><span className="text-muted-foreground">Suggested Action: </span>{action}</div>
        </div>
        {direction === "Declining" && (
          <div className="mt-3 inline-flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Recent production shows a downward movement — flagged for attention. This is a pattern signal only and does not diagnose disease.</span>
          </div>
        )}
      </div>

      <div className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
        Forecast generated from historical farm production patterns and recent production trends. Forecasts provide operational decision support and may change as new farm records are added.
      </div>
    </Card>
  );
}

function ForecastStat({ label, value, hint, valueClassName, icon: Icon }: {
  label: string; value: string; hint?: string; valueClassName?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={"mt-1.5 font-display text-2xl md:text-3xl font-semibold inline-flex items-center gap-2 " + (valueClassName ?? "")}>
        {Icon && <Icon className="h-5 w-5" />} {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

type ForecastResult = {
  latestTotal: number;
  latestPct: number;
  avgForecast: number;
  low: number;
  high: number;
  direction: "Increasing" | "Stable with upward movement" | "Stable" | "Stable with downward movement" | "Declining";
  chartData: Array<{ name: string; Historical: number | null; Forecast: number | null; Upper: number | null; Lower: number | null }>;
  boundaryLabel: string;
};

function computeForecast(eggs: EggRow[], totalBirds: number): ForecastResult | null {
  if (!eggs || eggs.length < 3) return null;
  // Order chronologically (ascending) — value is total eggs per day
  const ordered = [...eggs].sort((a, b) => a.date.localeCompare(b.date));
  const totals = ordered.map(e => ({
    date: e.date,
    label: e.label.replace(/^[A-Za-z]{3}, /, ""),
    value: (e.r2 + e.r3 + e.r4) * 30 + e.extra,
  }));

  // Use last up to 7 days for trend detection
  const recent = totals.slice(-Math.min(7, totals.length));
  const values = recent.map(r => r.value);
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;

  // Linear regression slope on recent values (x = 0..n-1)
  const xMean = (n - 1) / 2;
  let num = 0, den = 0;
  values.forEach((v, i) => { num += (i - xMean) * (v - mean); den += (i - xMean) ** 2; });
  const slope = den === 0 ? 0 : num / den;

  // Residual standard deviation around the fitted line — drives the range
  const residuals = values.map((v, i) => v - (mean + slope * (i - xMean)));
  const variance = residuals.reduce((s, v) => s + v * v, 0) / n;
  const std = Math.sqrt(variance);

  // Anchor forecast at the last historical value so the chart continues smoothly
  const lastVal = values[n - 1];
  const forecastValues: number[] = [];
  for (let k = 1; k <= 7; k++) {
    forecastValues.push(Math.max(0, Math.round(lastVal + slope * k)));
  }

  // Card metrics derived directly from plotted forecast values
  const avgForecast = Math.round(forecastValues.reduce((s, v) => s + v, 0) / forecastValues.length);
  const spread = Math.max(std, Math.max(mean, 1) * 0.02); // at least ±2% for a visible range
  const forecastMin = Math.min(...forecastValues);
  const forecastMax = Math.max(...forecastValues);
  const low = Math.max(0, Math.round(forecastMin - spread));
  const high = Math.round(forecastMax + spread);

  // Direction from slope strength (as % of mean per day) and projected 7-day movement (as % of mean)
  const slopePctPerDay = mean === 0 ? 0 : (slope / mean) * 100;
  const forecastDelta = forecastValues[forecastValues.length - 1] - forecastValues[0];
  const projectedMovePct = mean === 0 ? 0 : (forecastDelta / mean) * 100;
  // Thresholds: strong ≈ ≥0.6%/day slope AND ≥3% total 7-day move; mild ≈ ≥0.15%/day AND ≥0.8% total move
  const STRONG_SLOPE = 0.6;
  const MILD_SLOPE = 0.15;
  const STRONG_MOVE = 3;
  const MILD_MOVE = 0.8;
  let direction: ForecastResult["direction"] = "Stable";
  if (slopePctPerDay >= STRONG_SLOPE && projectedMovePct >= STRONG_MOVE) direction = "Increasing";
  else if (slopePctPerDay <= -STRONG_SLOPE && projectedMovePct <= -STRONG_MOVE) direction = "Declining";
  else if (slopePctPerDay >= MILD_SLOPE && projectedMovePct >= MILD_MOVE) direction = "Stable with upward movement";
  else if (slopePctPerDay <= -MILD_SLOPE && projectedMovePct <= -MILD_MOVE) direction = "Stable with downward movement";


  // Historical portion of chart: last 14 days (total eggs per day, same unit as forecast)
  const historical = totals.slice(-Math.min(14, totals.length));
  const boundaryLabel = historical[historical.length - 1].label;

  const chartData: ForecastResult["chartData"] = [];
  historical.forEach((h, i) => {
    chartData.push({
      name: h.label,
      Historical: h.value,
      // Seed forecast at the boundary so the dashed line starts from the last historical value
      Forecast: i === historical.length - 1 ? h.value : null,
      Upper: i === historical.length - 1 ? h.value : null,
      Lower: i === historical.length - 1 ? h.value : null,
    });
  });

  const lastDate = new Date(historical[historical.length - 1].date + "T00:00:00");
  for (let k = 1; k <= 7; k++) {
    const d = new Date(lastDate);
    d.setDate(lastDate.getDate() + k);
    const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const v = forecastValues[k - 1];
    chartData.push({
      name: label,
      Historical: null,
      Forecast: v,
      Upper: Math.round(v + spread),
      Lower: Math.max(0, Math.round(v - spread)),
    });
  }

  const latest = totals[totals.length - 1];
  // Current production rate = latest total eggs ÷ current live birds × 100
  const latestPct = totalBirds > 0
    ? Math.round((latest.value / totalBirds) * 1000) / 10
    : 0;

  return {
    latestTotal: latest.value,
    latestPct,
    avgForecast,
    low,
    high,
    direction,
    chartData,
    boundaryLabel,
  };
}

/* ------------------ Mortality Risk Monitor ------------------ */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Parse dates like "16 Jan", "3 Feb", "Today" — assume year matches the latest egg record's year.
function parseShortDate(s: string, anchor: Date): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (/^today$/i.test(trimmed)) return new Date(anchor);
  const m = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon === undefined) return null;
  let year = anchor.getFullYear();
  const candidate = new Date(year, mon, day);
  // If the parsed date sits in the future relative to the anchor, roll back one year
  if (candidate.getTime() > anchor.getTime() + 24 * 60 * 60 * 1000) year -= 1;
  return new Date(year, mon, day);
}

type MortalityRiskProps = {
  rooms: Room[];
  mortality: Mortality[];
  eggs: EggRow[];
  health: Health[];
};

function MortalityRiskMonitor({ rooms, mortality, eggs, health }: MortalityRiskProps) {
  const analysis = useMemo(
    () => computeMortalityRisk(rooms, mortality, eggs, health),
    [rooms, mortality, eggs, health],
  );

  if (!analysis) {
    return (
      <Card>
        <CardHeader
          title="Mortality Risk Monitor"
          subtitle="Early operational risk monitoring based on mortality patterns and farm records."
        />
        <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Not enough mortality or room records yet to generate a risk analysis.
        </div>
      </Card>
    );
  }

  const {
    levelLabel, levelTone, score, monthlyMortality, mostAffectedRoom,
    patternLabel, rooms: roomRows, timeline, insight, periodLabel,
  } = analysis;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)]">
            <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> Predict</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] tracking-[0.16em] text-[color:var(--ink)]">Early Risk Model</span>
          </div>
          <h2 className="mt-1 font-display text-2xl md:text-3xl font-semibold">Mortality Risk Monitor</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Early operational risk monitoring based on mortality patterns and farm records.
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Analysis window: {periodLabel}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <ForecastStat
          label="Current Risk Level"
          value={levelLabel}
          hint={`Risk score ${score}/100`}
          valueClassName={levelTone}
          icon={AlertTriangle}
        />
        <ForecastStat
          label="Mortality This Month"
          value={String(monthlyMortality)}
          hint="Total bird losses recorded this month"
        />
        <ForecastStat
          label="Most Affected Room"
          value={mostAffectedRoom ? mostAffectedRoom.name : "—"}
          hint={mostAffectedRoom
            ? `${mostAffectedRoom.lost} lost · ${mostAffectedRoom.events} event${mostAffectedRoom.events === 1 ? "" : "s"}`
            : "No mortality recorded in period"}
        />
        <ForecastStat
          label="Recent Mortality Pattern"
          value={patternLabel}
          hint="Based on frequency and concentration"
        />
      </div>

      {/* Room-level risk analysis */}
      <div className="mt-6">
        <h3 className="font-display text-lg font-semibold">Room-Level Risk Analysis</h3>
        <p className="text-xs text-muted-foreground">Each active room analysed separately from stored mortality and bird records.</p>

        {/* Mobile: stacked cards */}
        <div className="mt-3 grid gap-3 md:hidden">
          {roomRows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No active rooms configured.</div>
          )}
          {roomRows.map(r => (
            <div key={r.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{r.name}</div>
                <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + riskBadgeClass(r.levelLabel)}>
                  {r.levelLabel} · {r.score}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Live Birds</dt><dd>{r.current.toLocaleString()}</dd></div>
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Lost (period)</dt><dd>{r.lost}</dd></div>
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Mortality %</dt><dd>{r.ratePct.toFixed(2)}%</dd></div>
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Events</dt><dd>{r.events}</dd></div>
                <div className="col-span-2"><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Last Event</dt><dd className="text-muted-foreground">{r.lastEventLabel ?? "—"}</dd></div>
              </dl>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="mt-3 hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-4 font-medium">Room</th>
                <th className="py-2 pr-4 font-medium">Live Birds</th>
                <th className="py-2 pr-4 font-medium">Lost (period)</th>
                <th className="py-2 pr-4 font-medium">Mortality %</th>
                <th className="py-2 pr-4 font-medium">Events</th>
                <th className="py-2 pr-4 font-medium">Last Event</th>
                <th className="py-2 pr-4 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {roomRows.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-3 pr-4 font-medium">{r.name}</td>
                  <td className="py-3 pr-4">{r.current.toLocaleString()}</td>
                  <td className="py-3 pr-4">{r.lost}</td>
                  <td className="py-3 pr-4">{r.ratePct.toFixed(2)}%</td>
                  <td className="py-3 pr-4">{r.events}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{r.lastEventLabel ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + riskBadgeClass(r.levelLabel)}>
                      {r.levelLabel} · {r.score}
                    </span>
                  </td>
                </tr>
              ))}
              {roomRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-muted-foreground">No active rooms configured.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-6">
        <h3 className="font-display text-lg font-semibold">Mortality Pattern Timeline</h3>
        <p className="text-xs text-muted-foreground">Bird losses by date and room — repeated events in the same room stack together.</p>
        <div className="h-64 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeline.data} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 85)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {timeline.roomKeys.map((key, idx) => (
                <Bar key={key} dataKey={key} stackId="m" fill={TIMELINE_COLORS[idx % TIMELINE_COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {timeline.data.length === 0 && (
          <div className="mt-2 text-xs text-muted-foreground">No mortality events in the current analysis window.</div>
        )}
      </div>

      {/* Insight */}
      <div className="mt-6 rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/8 p-4 md:p-5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink)]">
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> PoultryPro Risk Insight
        </div>
        <div className="mt-2 text-sm leading-relaxed">
          <div><span className="text-muted-foreground">Observation: </span>{insight.observation}</div>
          <div className="mt-1.5"><span className="text-muted-foreground">Risk Interpretation: </span>{insight.interpretation}</div>
          <div className="mt-1.5"><span className="text-muted-foreground">Suggested Action: </span>{insight.action}</div>
        </div>
        {insight.repeatedRoom && (
          <div className="mt-3 inline-flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Repeated mortality events recorded in {insight.repeatedRoom} within the analysis period.
              Pattern is concentrated in one production room rather than evenly distributed across the farm.
            </span>
          </div>
        )}
      </div>

      {/* Methodology */}
      <div className="mt-4 rounded-2xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed">
        <div className="font-medium text-[color:var(--ink)]">Risk Methodology (transparent weighted score, 0–100)</div>
        <ul className="mt-1.5 grid gap-1 md:grid-cols-2 text-muted-foreground">
          <li>Mortality Rate — 40%</li>
          <li>Mortality Event Frequency — 30%</li>
          <li>Room Concentration — 20%</li>
          <li>Recent Trend — 10%</li>
        </ul>
        <div className="mt-2 text-muted-foreground">
          Classification: 0–24 LOW · 25–49 MODERATE · 50–74 ELEVATED · 75–100 HIGH.
        </div>
        <div className="mt-2 text-muted-foreground">
          Risk monitoring is generated from recorded farm mortality and operational patterns. It provides early decision
          support and does not constitute veterinary diagnosis.
        </div>
      </div>
    </Card>
  );
}

const TIMELINE_COLORS = [
  "oklch(0.55 0.15 60)",
  "oklch(0.45 0.12 155)",
  "oklch(0.6 0.14 25)",
  "oklch(0.5 0.12 250)",
  "oklch(0.6 0.14 320)",
];

function riskBadgeClass(level: RiskLevel): string {
  switch (level) {
    case "HIGH": return "bg-destructive text-destructive-foreground";
    case "ELEVATED": return "bg-[color:var(--gold)]/30 text-[color:var(--ink)]";
    case "MODERATE": return "bg-[color:var(--gold)]/15 text-[color:var(--ink)]";
    default: return "bg-[color:var(--forest)] text-primary-foreground";
  }
}

type RiskLevel = "LOW" | "MODERATE" | "ELEVATED" | "HIGH";
type PatternLabel = "Isolated" | "Stable" | "Increasing" | "Repeated" | "Declining";

type RoomRisk = {
  id: string;
  name: string;
  current: number;
  lost: number;
  events: number;
  ratePct: number;
  lastEventLabel: string | null;
  lastEventTime: number | null;
  score: number;
  levelLabel: RiskLevel;
};

type MortalityAnalysis = {
  levelLabel: RiskLevel;
  levelTone: string;
  score: number;
  monthlyMortality: number;
  mostAffectedRoom: { name: string; lost: number; events: number } | null;
  patternLabel: PatternLabel;
  rooms: RoomRisk[];
  timeline: { data: Array<Record<string, string | number>>; roomKeys: string[] };
  insight: { observation: string; interpretation: string; action: string; repeatedRoom: string | null };
  periodLabel: string;
};

function classifyRisk(score: number): RiskLevel {
  if (score >= 75) return "HIGH";
  if (score >= 50) return "ELEVATED";
  if (score >= 25) return "MODERATE";
  return "LOW";
}

function riskTone(level: RiskLevel): string {
  switch (level) {
    case "HIGH": return "text-destructive";
    case "ELEVATED": return "text-[color:var(--gold)]";
    case "MODERATE": return "text-[color:var(--ink)]";
    default: return "text-[color:var(--forest)]";
  }
}

function computeMortalityRisk(
  rooms: Room[], mortality: Mortality[], eggs: EggRow[], health: Health[],
): MortalityAnalysis | null {
  if (!rooms || rooms.length === 0) return null;

  // Anchor "today" to the latest recorded egg-production date (falls back to now)
  const orderedEggs = [...eggs].sort((a, b) => b.date.localeCompare(a.date));
  const anchor = orderedEggs[0]
    ? new Date(orderedEggs[0].date + "T00:00:00")
    : new Date();

  const PERIOD_DAYS = 30;
  const periodStart = new Date(anchor);
  periodStart.setDate(periodStart.getDate() - PERIOD_DAYS + 1);

  // Parse mortality entries into dated events within the period
  const parsed = mortality
    .map(m => {
      const d = parseShortDate(m.date, anchor);
      return d ? { ...m, when: d, ts: d.getTime() } : null;
    })
    .filter((x): x is Mortality & { when: Date; ts: number } => x !== null)
    .filter(e => e.ts >= periodStart.getTime() && e.ts <= anchor.getTime() + 24 * 60 * 60 * 1000);

  // Group per room
  const perRoom = new Map<string, { lost: number; events: number; lastTs: number | null; lastLabel: string | null }>();
  rooms.forEach(r => perRoom.set(r.name, { lost: 0, events: 0, lastTs: null, lastLabel: null }));
  parsed.forEach(e => {
    const bucket = perRoom.get(e.room) ?? { lost: 0, events: 0, lastTs: null, lastLabel: null };
    bucket.lost += e.loss;
    bucket.events += 1;
    if (bucket.lastTs === null || e.ts > bucket.lastTs) {
      bucket.lastTs = e.ts;
      bucket.lastLabel = e.when.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    }
    perRoom.set(e.room, bucket);
  });

  const totalLostPeriod = parsed.reduce((s, e) => s + e.loss, 0);
  const totalEventsPeriod = parsed.length;
  const totalBirdsBaseline = rooms.reduce((s, r) => s + r.current, 0) + totalLostPeriod;

  // Room risk rows
  const roomRows: RoomRisk[] = rooms.map(r => {
    const b = perRoom.get(r.name) ?? { lost: 0, events: 0, lastTs: null, lastLabel: null };
    const baseline = r.current + b.lost; // birds present at start of period
    const ratePct = baseline > 0 ? (b.lost / baseline) * 100 : 0;
    const shareOfFarm = totalLostPeriod > 0 ? b.lost / totalLostPeriod : 0;
    const rateScore = Math.min(100, (ratePct / 2) * 100); // 2% mortality → 100
    const freqScore = Math.min(100, (b.events / 5) * 100); // 5 events in 30d → 100
    const concScore = shareOfFarm * 100;
    // Room-level trend: last half vs prior half of period
    const half = periodStart.getTime() + (PERIOD_DAYS / 2) * 24 * 60 * 60 * 1000;
    const roomEvents = parsed.filter(e => e.room === r.name);
    const prior = roomEvents.filter(e => e.ts < half).reduce((s, e) => s + e.loss, 0);
    const recent = roomEvents.filter(e => e.ts >= half).reduce((s, e) => s + e.loss, 0);
    const trendScore = recent === 0 && prior === 0 ? 0
      : recent > prior * 1.3 ? 100
      : recent < prior * 0.7 ? 0
      : 50;
    const score = Math.round(rateScore * 0.4 + freqScore * 0.3 + concScore * 0.2 + trendScore * 0.1);
    const levelLabel = classifyRisk(score);
    return {
      id: r.id,
      name: r.name,
      current: r.current,
      lost: b.lost,
      events: b.events,
      ratePct,
      lastEventLabel: b.lastLabel,
      lastEventTime: b.lastTs,
      score,
      levelLabel,
    };
  });

  // Farm-level risk score
  const farmRatePct = totalBirdsBaseline > 0 ? (totalLostPeriod / totalBirdsBaseline) * 100 : 0;
  const farmRateScore = Math.min(100, (farmRatePct / 2) * 100);
  const farmFreqScore = Math.min(100, (totalEventsPeriod / 5) * 100);
  const maxShare = roomRows.reduce((m, r) => {
    const share = totalLostPeriod > 0 ? r.lost / totalLostPeriod : 0;
    return Math.max(m, share);
  }, 0);
  const farmConcScore = maxShare * 100;
  const halfTs = periodStart.getTime() + (PERIOD_DAYS / 2) * 24 * 60 * 60 * 1000;
  const priorTotal = parsed.filter(e => e.ts < halfTs).reduce((s, e) => s + e.loss, 0);
  const recentTotal = parsed.filter(e => e.ts >= halfTs).reduce((s, e) => s + e.loss, 0);
  const farmTrendScore = recentTotal === 0 && priorTotal === 0 ? 0
    : recentTotal > priorTotal * 1.3 ? 100
    : recentTotal < priorTotal * 0.7 ? 0
    : 50;
  const farmScore = Math.round(farmRateScore * 0.4 + farmFreqScore * 0.3 + farmConcScore * 0.2 + farmTrendScore * 0.1);
  const farmLevel = classifyRisk(farmScore);

  // Monthly mortality — restrict to the anchor's calendar month
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1).getTime();
  const monthlyMortality = parsed
    .filter(e => e.ts >= monthStart)
    .reduce((s, e) => s + e.loss, 0);

  // Most affected room in period
  const mostAffected = [...roomRows]
    .filter(r => r.lost > 0 || r.events > 0)
    .sort((a, b) => b.lost - a.lost || b.events - a.events)[0] ?? null;
  const mostAffectedRoom = mostAffected
    ? { name: mostAffected.name, lost: mostAffected.lost, events: mostAffected.events }
    : null;

  // Pattern label
  let patternLabel: PatternLabel = "Stable";
  const repeatedRoomRow = roomRows.find(r => r.events >= 2 && (maxShare >= 0.6 || r.events >= 3));
  if (totalEventsPeriod === 0) patternLabel = "Stable";
  else if (totalEventsPeriod === 1) patternLabel = "Isolated";
  else if (repeatedRoomRow) patternLabel = "Repeated";
  else if (recentTotal > priorTotal * 1.3) patternLabel = "Increasing";
  else if (recentTotal < priorTotal * 0.7 && priorTotal > 0) patternLabel = "Declining";
  else patternLabel = "Stable";

  // Timeline: one row per date with mortality, one bar segment per room
  const dateMap = new Map<string, Record<string, string | number>>();
  const activeRoomKeys = rooms.filter(r => parsed.some(e => e.room === r.name)).map(r => r.name);
  parsed
    .slice()
    .sort((a, b) => a.ts - b.ts)
    .forEach(e => {
      const key = e.when.toISOString().slice(0, 10);
      const label = e.when.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const row = dateMap.get(key) ?? { name: label };
      activeRoomKeys.forEach(k => { if (row[k] === undefined) row[k] = 0; });
      row[e.room] = ((row[e.room] as number) ?? 0) + e.loss;
      dateMap.set(key, row);
    });
  const timelineData = Array.from(dateMap.values());

  // Insight text
  const periodLabel = `${periodStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${anchor.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  const observation = totalEventsPeriod === 0
    ? "No mortality events have been recorded in the current analysis window."
    : repeatedRoomRow
      ? `Repeated mortality events have been recorded in ${repeatedRoomRow.name} within the current analysis period. The pattern is concentrated in one production room rather than evenly distributed across the farm.`
      : mostAffectedRoom
        ? `${totalEventsPeriod} mortality event${totalEventsPeriod === 1 ? "" : "s"} totalling ${totalLostPeriod} bird${totalLostPeriod === 1 ? "" : "s"} recorded across ${activeRoomKeys.length} room${activeRoomKeys.length === 1 ? "" : "s"}, with the highest concentration in ${mostAffectedRoom.name}.`
        : `${totalEventsPeriod} mortality event${totalEventsPeriod === 1 ? "" : "s"} recorded in the current period.`;

  const interpretation = `Risk score ${farmScore}/100 (${farmLevel}) — driven by a ${farmRatePct.toFixed(2)}% period mortality rate, ${totalEventsPeriod} event${totalEventsPeriod === 1 ? "" : "s"} in ${PERIOD_DAYS} days, ${Math.round(maxShare * 100)}% concentration in the most affected room, and a ${farmTrendScore >= 100 ? "rising" : farmTrendScore <= 0 ? "easing" : "steady"} recent trend.`;

  const roomHealth = repeatedRoomRow
    ? health.filter(h => h.scope === repeatedRoomRow.name || /all rooms/i.test(h.scope))
    : health;
  const recentHealthNote = roomHealth.length === 0
    ? "No recent health records are available for cross-reference."
    : `Recent health records available for cross-reference: ${roomHealth.slice(0, 3).map(h => h.name).join(", ")}.`;

  const action = repeatedRoomRow
    ? `Review recent health observations, vaccination and medication records for ${repeatedRoomRow.name}; check feed changes or feed batches, water availability, environmental observations and production movement for that room. ${recentHealthNote}`
    : totalEventsPeriod === 0
      ? "Continue capturing daily mortality checks to keep the risk model current."
      : `Cross-check mortality entries against recent health, feed and production records. ${recentHealthNote}`;

  return {
    levelLabel: farmLevel,
    levelTone: riskTone(farmLevel),
    score: farmScore,
    monthlyMortality,
    mostAffectedRoom,
    patternLabel,
    rooms: roomRows.sort((a, b) => b.score - a.score),
    timeline: { data: timelineData, roomKeys: activeRoomKeys },
    insight: {
      observation,
      interpretation,
      action,
      repeatedRoom: repeatedRoomRow ? repeatedRoomRow.name : null,
    },
    periodLabel,
  };
}

/* ------------------ Feed Efficiency Monitor ------------------ */

type FeedEfficiencyProps = {
  rooms: Room[];
  feed: Feed[];
  eggs: EggRow[];
  mortality: Mortality[];
  health: Health[];
  bagWeightKg: number | null;
  onBagWeightChange: (v: number | null) => void;
};

type EffStatus = "EFFICIENT" | "STABLE" | "WATCH" | "DECLINING" | "INSUFFICIENT DATA";
type MovementLabel = "IMPROVING" | "STABLE" | "WATCH" | "DECLINING" | "INSUFFICIENT DATA";

function FeedEfficiencyMonitor({
  rooms, feed, eggs, mortality, health, bagWeightKg, onBagWeightChange,
}: FeedEfficiencyProps) {
  const analysis = useMemo(
    () => computeFeedEfficiency(rooms, feed, eggs, mortality, health, bagWeightKg),
    [rooms, feed, eggs, mortality, health, bagWeightKg],
  );

  const hasWeight = typeof bagWeightKg === "number" && bagWeightKg > 0;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)]">
            <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> Predict</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] tracking-[0.16em] text-[color:var(--ink)]">Early Efficiency Model</span>
          </div>
          <h2 className="mt-1 font-display text-2xl md:text-3xl font-semibold">Feed Efficiency Monitor</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Operational efficiency monitoring based on feed usage and egg production patterns.
          </p>
          {analysis && (
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Matched records: {analysis.matched.length} · Latest matched date: {analysis.latestLabel ?? "—"}
            </p>
          )}
        </div>
      </div>

      {/* Farm configuration */}
      <div className="mt-5 rounded-2xl border border-border bg-secondary/30 p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Standard Feed Bag Weight (kg)
            </label>
            <input
              type="number" inputMode="decimal" min={0} step={0.5}
              value={hasWeight ? String(bagWeightKg) : ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onBagWeightChange(Number.isFinite(v) && v > 0 ? v : null);
              }}
              placeholder="Configure bag weight in kg"
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Configurable by the farm administrator. Used to convert bag-based feed records into kilogrammes.
            </p>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {hasWeight
              ? `1 bag = ${bagWeightKg} kg`
              : "Feed weight configuration required for kg-based efficiency calculations."}
          </div>
        </div>
      </div>

      {!analysis && (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Not enough matched feed and production records yet to generate a feed efficiency analysis.
        </div>
      )}

      {analysis && (
        <>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ForecastStat
              label="Current Efficiency Status"
              value={analysis.status}
              hint={analysis.hasBaseline
                ? `Movement score ${analysis.score} (negative = improving)`
                : "At least 3 preceding matched records required for a movement score"}
              valueClassName={effTone(analysis.status)}
              icon={Gauge}
            />
            <ForecastStat
              label="Feed Used — Latest Matched Date"
              value={`${fmtNum(analysis.latest.bags)} bags`}
              hint={hasWeight ? `${fmtNum(analysis.latest.bags * (bagWeightKg as number))} kg` : "Configure bag weight for kg"}
            />
            <ForecastStat
              label="Egg Output — Latest Matched Date"
              value={analysis.latest.eggs.toLocaleString()}
              hint={`Matched date: ${analysis.latest.label}`}
            />
            <ForecastStat
              label="Feed per Egg — Latest Matched Date"
              value={hasWeight && analysis.latest.feedPerEggG !== undefined ? `${fmtNum(analysis.latest.feedPerEggG)} g` : "—"}
              hint={hasWeight && analysis.latest.feedPerEggKg !== undefined
                ? `${fmtNum(analysis.latest.feedPerEggKg, 3)} kg per egg`
                : "Bag weight required"}
            />
          </div>

          {!analysis.hasBaseline && (
            <div className="mt-4 rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-4 text-sm">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink)]">Baseline Unavailable</div>
              <p className="mt-1 text-muted-foreground">
                More matched feed and production records are required to establish a reliable efficiency baseline.
                Current feed-per-egg values are still shown above.
              </p>
            </div>
          )}

          {/* Trend chart */}
          <div className="mt-6">
            <h3 className="font-display text-lg font-semibold">Feed and Production Trend</h3>
            <p className="text-xs text-muted-foreground">
              Only dates where valid matching feed and production records exist are compared. Missing records are not treated as zero.
            </p>
            <div className="h-72 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysis.chartData} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 85)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="left" type="monotone" dataKey="Eggs" stroke="oklch(0.32 0.06 155)" strokeWidth={2.5} dot={{ r: 2 }} connectNulls={false} />
                  <Line yAxisId="right" type="monotone" dataKey="Feed (bags)" stroke="oklch(0.55 0.15 60)" strokeWidth={2.5} dot={{ r: 2 }} connectNulls={false} />
                  {hasWeight && (
                    <Line yAxisId="right" type="monotone" dataKey="Feed per Egg (g)" stroke="oklch(0.5 0.12 250)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} connectNulls={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Room-level */}
          <div className="mt-6">
            <h3 className="font-display text-lg font-semibold">Room-Level Feed Efficiency</h3>
            <p className="text-xs text-muted-foreground">
              Rooms with matched feed and production records analysed separately. Unmatched dates are excluded.
            </p>

            {/* Mobile cards */}
            <div className="mt-3 grid gap-3 md:hidden">
              {analysis.roomRows.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No rooms with matched feed and production records in the analysis window.
                </div>
              )}
              {analysis.roomRows.map(r => (
                <div key={r.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{r.name}</div>
                    <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + movementBadgeClass(r.movement)}>
                      {r.movement}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Live Birds</dt><dd>{r.current.toLocaleString()}</dd></div>
                    <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Feed Used</dt><dd>{fmtNum(r.bags)} bags{r.kg !== null ? ` · ${fmtNum(r.kg)} kg` : ""}</dd></div>
                    <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Eggs Produced</dt><dd>{r.eggs.toLocaleString()}</dd></div>
                    <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Feed per Bird</dt><dd>{r.feedPerBirdG !== null ? `${fmtNum(r.feedPerBirdG)} g` : "—"}</dd></div>
                    <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Feed per Egg</dt><dd>{r.feedPerEggG !== null ? `${fmtNum(r.feedPerEggG)} g` : "—"}</dd></div>
                  </dl>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="mt-3 hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-2 pr-4 font-medium">Room</th>
                    <th className="py-2 pr-4 font-medium">Live Birds</th>
                    <th className="py-2 pr-4 font-medium">Feed Used</th>
                    <th className="py-2 pr-4 font-medium">Eggs Produced</th>
                    <th className="py-2 pr-4 font-medium">Feed / Bird</th>
                    <th className="py-2 pr-4 font-medium">Feed / Egg</th>
                    <th className="py-2 pr-4 font-medium">Efficiency Movement</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.roomRows.map(r => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-3 pr-4 font-medium">{r.name}</td>
                      <td className="py-3 pr-4">{r.current.toLocaleString()}</td>
                      <td className="py-3 pr-4">{fmtNum(r.bags)} bags{r.kg !== null ? ` · ${fmtNum(r.kg)} kg` : ""}</td>
                      <td className="py-3 pr-4">{r.eggs.toLocaleString()}</td>
                      <td className="py-3 pr-4">{r.feedPerBirdG !== null ? `${fmtNum(r.feedPerBirdG)} g` : "—"}</td>
                      <td className="py-3 pr-4">{r.feedPerEggG !== null ? `${fmtNum(r.feedPerEggG)} g` : "—"}</td>
                      <td className="py-3 pr-4">
                        <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + movementBadgeClass(r.movement)}>
                          {r.movement}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {analysis.roomRows.length === 0 && (
                    <tr><td colSpan={7} className="py-4 text-muted-foreground">No rooms with matched feed and production records.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insight */}
          <div className="mt-6 rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/8 p-4 md:p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink)]">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> PoultryPro Efficiency Insight
            </div>
            <div className="mt-2 text-sm leading-relaxed">
              <div><span className="text-muted-foreground">Observation: </span>{analysis.insight.observation}</div>
              <div className="mt-1.5"><span className="text-muted-foreground">Efficiency Interpretation: </span>{analysis.insight.interpretation}</div>
              <div className="mt-1.5"><span className="text-muted-foreground">Suggested Action: </span>{analysis.insight.action}</div>
            </div>
          </div>

          {/* Methodology */}
          <div className="mt-4 rounded-2xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed">
            <div className="font-medium text-[color:var(--ink)]">Efficiency Methodology (transparent weighted movement)</div>
            <ul className="mt-1.5 grid gap-1 md:grid-cols-2 text-muted-foreground">
              <li>Feed-per-Egg Change — 50%</li>
              <li>Production Movement — 25%</li>
              <li>Feed Usage Movement — 15%</li>
              <li>Room-Level Variation — 10%</li>
            </ul>
            <div className="mt-2 text-muted-foreground">
              {analysis.hasBaseline ? (
                <>
                  Latest matched date vs preceding matched baseline:
                  feed-per-egg {fmtSigned(analysis.movements.feedPerEggPct)}% ·
                  production {fmtSigned(analysis.movements.productionPct)}% ·
                  feed usage {fmtSigned(analysis.movements.feedPct)}% ·
                  room variation {fmtNum(analysis.movements.roomVariationPct)}%.
                </>
              ) : (
                <>
                  Movement metrics: BASELINE UNAVAILABLE — feed-per-egg, production, feed usage and
                  room-level variation percentages will appear once at least 3 preceding matched
                  daily records exist.
                </>
              )}
            </div>
            <div className="mt-2 text-muted-foreground">
              Classification: Strong positive improvement → EFFICIENT · Minimal material change → STABLE ·
              Moderate negative movement → WATCH · Sustained significant negative movement → DECLINING.
            </div>
            <div className="mt-2 text-muted-foreground">
              Feed efficiency monitoring is generated from recorded feed usage and egg production patterns. Results
              depend on the completeness and accuracy of farm records and provide operational decision support.
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function effTone(s: EffStatus): string {
  switch (s) {
    case "EFFICIENT": return "text-[color:var(--forest)]";
    case "STABLE": return "text-muted-foreground";
    case "WATCH": return "text-[color:var(--gold)]";
    case "DECLINING": return "text-destructive";
    case "INSUFFICIENT DATA": return "text-muted-foreground";
  }
}

function movementBadgeClass(m: MovementLabel): string {
  switch (m) {
    case "IMPROVING": return "bg-[color:var(--forest)] text-primary-foreground";
    case "STABLE": return "bg-secondary text-[color:var(--ink)]";
    case "WATCH": return "bg-[color:var(--gold)]/25 text-[color:var(--ink)]";
    case "DECLINING": return "bg-destructive text-destructive-foreground";
    case "INSUFFICIENT DATA": return "bg-secondary text-muted-foreground";
  }
}

function fmtNum(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: dp });
}

function fmtSigned(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const s = n >= 0 ? "+" : "";
  return s + n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

type MatchedDay = {
  date: string; label: string; bags: number; eggs: number;
  kg?: number; feedPerEggKg?: number; feedPerEggG?: number;
};

type RoomEffRow = {
  id: string; name: string; current: number;
  bags: number; eggs: number;
  kg: number | null; feedPerBirdG: number | null; feedPerEggG: number | null;
  movement: MovementLabel;
};

type FeedEffAnalysis = {
  matched: MatchedDay[];
  latest: MatchedDay;
  latestLabel: string | null;
  status: EffStatus;
  score: number;
  chartData: Array<Record<string, string | number | null>>;
  roomRows: RoomEffRow[];
  insight: { observation: string; interpretation: string; action: string };
  movements: { feedPerEggPct: number; productionPct: number; feedPct: number; roomVariationPct: number };
  hasBaseline: boolean;
};

function computeFeedEfficiency(
  rooms: Room[], feed: Feed[], eggs: EggRow[], mortality: Mortality[], health: Health[], bagWeightKg: number | null,
): FeedEffAnalysis | null {
  if (!eggs || eggs.length === 0 || !feed || feed.length === 0) return null;

  const orderedEggs = [...eggs].sort((a, b) => b.date.localeCompare(a.date));
  const anchor = new Date(orderedEggs[0].date + "T00:00:00");

  type FeedRow = { room: string; bags: number; when: Date; iso: string };
  const feedRows: FeedRow[] = feed
    .map(f => {
      const d = parseShortDate(f.date, anchor);
      return d ? { room: f.room, bags: f.bags, when: d, iso: d.toISOString().slice(0, 10) } : null;
    })
    .filter((x): x is FeedRow => x !== null);

  if (feedRows.length === 0) return null;

  const eggsByIso = new Map<string, EggRow>();
  eggs.forEach(e => eggsByIso.set(e.date, e));

  const feedByDate = new Map<string, number>();
  feedRows.forEach(r => feedByDate.set(r.iso, (feedByDate.get(r.iso) ?? 0) + r.bags));

  const matched: MatchedDay[] = [];
  Array.from(feedByDate.entries())
    .filter(([iso]) => eggsByIso.has(iso))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([iso, bags]) => {
      const e = eggsByIso.get(iso)!;
      const eggTotal = (e.r2 + e.r3 + e.r4) * 30 + e.extra;
      const day: MatchedDay = {
        date: iso,
        label: new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        bags,
        eggs: eggTotal,
      };
      if (typeof bagWeightKg === "number" && bagWeightKg > 0) {
        day.kg = bags * bagWeightKg;
        day.feedPerEggKg = eggTotal > 0 ? day.kg / eggTotal : 0;
        day.feedPerEggG = day.feedPerEggKg * 1000;
      }
      matched.push(day);
    });

  if (matched.length === 0) return null;

  const latest = matched[matched.length - 1];
  const preceding = matched.slice(0, -1);
  const hasBaseline = preceding.length >= 3;

  const chartData: Array<Record<string, string | number | null>> = matched.map(d => ({
    name: d.label,
    Eggs: d.eggs,
    "Feed (bags)": d.bags,
    "Feed per Egg (g)": d.feedPerEggG ?? null,
  }));

  const avg = (xs: number[]) => xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;

  // Movements only when we have a valid baseline (>= 3 preceding matched records)
  const baseline = hasBaseline ? preceding.slice(-Math.min(preceding.length, 7)) : [];
  const baselineEggs = avg(baseline.map(d => d.eggs));
  const baselineBags = avg(baseline.map(d => d.bags));
  const baselineFpE = baselineEggs > 0 ? baselineBags / baselineEggs : 0;
  const latestFpE = latest.eggs > 0 ? latest.bags / latest.eggs : 0;

  const productionPct = hasBaseline && baselineEggs > 0 ? ((latest.eggs - baselineEggs) / baselineEggs) * 100 : NaN;
  const feedPct = hasBaseline && baselineBags > 0 ? ((latest.bags - baselineBags) / baselineBags) * 100 : NaN;
  const feedPerEggPct = hasBaseline && baselineFpE > 0 ? ((latestFpE - baselineFpE) / baselineFpE) * 100 : NaN;

  const roomShareEggs = computeRoomEggShare(rooms, eggs);

  const feedByRoomDate = new Map<string, Map<string, number>>();
  feedRows.forEach(r => {
    const m = feedByRoomDate.get(r.room) ?? new Map<string, number>();
    m.set(r.iso, (m.get(r.iso) ?? 0) + r.bags);
    feedByRoomDate.set(r.room, m);
  });

  const roomRows: RoomEffRow[] = rooms.map(room => {
    const roomMap = feedByRoomDate.get(room.name) ?? new Map<string, number>();
    const roomMatched = Array.from(roomMap.entries())
      .filter(([iso]) => eggsByIso.has(iso))
      .sort((a, b) => a[0].localeCompare(b[0]));
    if (roomMatched.length === 0) {
      return {
        id: room.id, name: room.name, current: room.current,
        bags: 0, eggs: 0, kg: null, feedPerBirdG: null, feedPerEggG: null,
        movement: "INSUFFICIENT DATA" as MovementLabel,
      };
    }
    const share = roomShareEggs.get(room.id) ?? 0;
    // Use ONLY the latest matched date's feed for this room (do not combine dates)
    const [latestIso, latestBagsRoom] = roomMatched[roomMatched.length - 1];
    const eLatest = eggsByIso.get(latestIso)!;
    const latestEggsRoom = ((eLatest.r2 + eLatest.r3 + eLatest.r4) * 30 + eLatest.extra) * share;
    const kg = typeof bagWeightKg === "number" && bagWeightKg > 0 ? latestBagsRoom * bagWeightKg : null;
    const feedPerBirdG = kg !== null && room.current > 0 ? (kg * 1000) / room.current : null;
    const feedPerEggG = kg !== null && latestEggsRoom > 0 ? (kg * 1000) / latestEggsRoom : null;

    // Room baseline: need at least 3 preceding matched days for this room
    const roomPreceding = roomMatched.slice(0, -1);
    let movement: MovementLabel = "INSUFFICIENT DATA";
    if (roomPreceding.length >= 3) {
      const bpeOf = (iso: string, bags: number) => {
        const e = eggsByIso.get(iso);
        if (!e) return 0;
        const eg = ((e.r2 + e.r3 + e.r4) * 30 + e.extra) * share;
        return eg > 0 ? bags / eg : 0;
      };
      const latestBpE = bpeOf(latestIso, latestBagsRoom);
      const priorBpEs = roomPreceding.slice(-7).map(([iso, b]) => bpeOf(iso, b)).filter(v => v > 0);
      const priorBpE = priorBpEs.length ? priorBpEs.reduce((s, v) => s + v, 0) / priorBpEs.length : 0;
      const move = priorBpE > 0 ? ((latestBpE - priorBpE) / priorBpE) * 100 : 0;
      movement =
        move <= -5 ? "IMPROVING"
        : move >= 15 ? "DECLINING"
        : move >= 5 ? "WATCH"
        : "STABLE";
    }

    return {
      id: room.id, name: room.name, current: room.current,
      bags: latestBagsRoom, eggs: Math.round(latestEggsRoom),
      kg, feedPerBirdG, feedPerEggG, movement,
    };
  });

  const activeRoomFpE = roomRows.filter(r => r.eggs > 0 && r.bags > 0).map(r => r.bags / r.eggs);
  let roomVariationPct = 0;
  if (activeRoomFpE.length >= 2) {
    const m = activeRoomFpE.reduce((s, v) => s + v, 0) / activeRoomFpE.length;
    const v = activeRoomFpE.reduce((s, x) => s + (x - m) ** 2, 0) / activeRoomFpE.length;
    roomVariationPct = m > 0 ? (Math.sqrt(v) / m) * 100 : 0;
  }

  let status: EffStatus;
  let score = 0;
  if (!hasBaseline) {
    status = "INSUFFICIENT DATA";
  } else {
    score = Math.round(
      feedPerEggPct * 0.5 + (-productionPct) * 0.25 + feedPct * 0.15 + roomVariationPct * 0.1,
    );
    status =
      score <= -5 ? "EFFICIENT"
      : score >= 15 ? "DECLINING"
      : score >= 5 ? "WATCH"
      : "STABLE";
  }

  let observation: string;
  let interpretation: string;
  let action: string;

  if (!hasBaseline) {
    observation = `${matched.length} valid matched feed and production date${matched.length === 1 ? "" : "s"} ${matched.length === 1 ? "is" : "are"} currently available. Current feed-per-egg efficiency has been calculated, but there is not yet enough historical matched data to determine a reliable efficiency trend.`;
    interpretation = "INSUFFICIENT DATA — a minimum of three preceding matched daily records is required before PoultryPro assigns an efficiency movement classification.";
    action = "Continue recording feed usage and egg production daily for each room. PoultryPro will automatically establish an efficiency baseline as additional matched records become available.";
  } else {
    const feedDir = describeMove(feedPct, "feed usage");
    const eggDir = describeMove(productionPct, "egg output");
    const fpeDir = feedPerEggPct > 1
      ? "feed consumed per egg has increased, indicating a possible decline in production efficiency"
      : feedPerEggPct < -1
        ? "feed consumed per egg has decreased, indicating improving production efficiency"
        : "feed consumed per egg has remained largely unchanged";
    observation = `Latest matched date (${latest.label}) compared with the preceding ${baseline.length} matched record${baseline.length === 1 ? "" : "s"}: ${feedDir} while ${eggDir}. ${capitalise(fpeDir)}.`;
    interpretation = `Status ${status} — feed-per-egg movement ${fmtSigned(feedPerEggPct)}%, production movement ${fmtSigned(productionPct)}%, feed usage movement ${fmtSigned(feedPct)}%, room-level variation ${fmtNum(roomVariationPct)}%. Composite movement score ${score} (negative values indicate improving efficiency).`;
    const worstRoom = [...roomRows]
      .filter(r => r.eggs > 0 && r.movement !== "INSUFFICIENT DATA")
      .sort((a, b) => movementRank(b.movement) - movementRank(a.movement))[0];
    const recentMortalityCount = mortality.length;
    const recentHealth = health.slice(0, 2).map(h => h.name).join(", ");
    action = status === "EFFICIENT"
      ? "Continue capturing daily feed and production records to keep the efficiency baseline current."
      : `Review recent feed formulation and feed batch changes, feed distribution records${worstRoom ? `, and room-level production movement for ${worstRoom.name}` : ""}, bird population changes${recentMortalityCount > 0 ? " and recent mortality patterns" : ""}, water availability records if available${recentHealth ? `, and recent health observations (${recentHealth})` : ""}.`;
  }

  return {
    matched, latest, latestLabel: latest.label,
    status, score, chartData, roomRows,
    insight: { observation, interpretation, action },
    movements: { feedPerEggPct, productionPct, feedPct, roomVariationPct },
    hasBaseline,
  };
}

function computeRoomEggShare(rooms: Room[], eggs: EggRow[]): Map<string, number> {
  // Derive each room's share of daily eggs from its crate contribution (r2/r3/r4) over the recorded window.
  const share = new Map<string, number>();
  const totals: Record<string, number> = { r2: 0, r3: 0, r4: 0 };
  let all = 0;
  eggs.forEach(e => {
    totals.r2 += e.r2 * 30;
    totals.r3 += e.r3 * 30;
    totals.r4 += e.r4 * 30;
    all += (e.r2 + e.r3 + e.r4) * 30 + e.extra;
  });
  rooms.forEach(r => {
    const trimmed = r.name.replace(/\s+/g, "").toLowerCase();
    const rk = trimmed.endsWith("2") ? "r2" : trimmed.endsWith("3") ? "r3" : trimmed.endsWith("4") ? "r4" : null;
    const roomTotal = rk ? totals[rk] : 0;
    share.set(r.id, all > 0 ? roomTotal / all : 0);
  });
  return share;
}

function describeMove(pct: number, subject: string): string {
  if (pct > 2) return `${subject} increased by ${fmtNum(pct, 1)}%`;
  if (pct < -2) return `${subject} decreased by ${fmtNum(Math.abs(pct), 1)}%`;
  return `${subject} remained stable`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function movementRank(m: MovementLabel): number {
  return m === "DECLINING" ? 3 : m === "WATCH" ? 2 : m === "STABLE" ? 1 : 0;
}

/* ------------------ Abnormal Farm Activity Detection ------------------ */

type AbnormalProps = {
  rooms: Room[];
  eggs: EggRow[];
  feed: Feed[];
  mortality: Mortality[];
  health: Health[];
  bagWeightKg: number | null;
};

type ActivityLevel = "NORMAL" | "WATCH" | "ELEVATED" | "HIGH";

type SignalKey = "production" | "mortality" | "feed" | "health";

type RoomActivityRow = {
  id: string;
  name: string;
  score: number;
  level: ActivityLevel;
  signals: Record<SignalKey, { score: number | null; label: string; note: string }>;
  triggered: SignalKey[];
};

type AbnormalAnalysis = {
  score: number;
  level: ActivityLevel;
  periodLabel: string;
  signalsAnalysed: string[];
  roomsMonitored: number;
  mostAffected: RoomActivityRow | null;
  rooms: RoomActivityRow[];
  insight: { observation: string; connection: string; interpretation: string; action: string };
  limited: boolean;
};

function classifyActivity(score: number): ActivityLevel {
  if (score >= 75) return "HIGH";
  if (score >= 50) return "ELEVATED";
  if (score >= 25) return "WATCH";
  return "NORMAL";
}

function activityBadgeClass(level: ActivityLevel): string {
  switch (level) {
    case "HIGH": return "bg-destructive text-destructive-foreground";
    case "ELEVATED": return "bg-[color:var(--gold)]/30 text-[color:var(--ink)]";
    case "WATCH": return "bg-[color:var(--gold)]/15 text-[color:var(--ink)]";
    default: return "bg-[color:var(--forest)] text-primary-foreground";
  }
}

function activityTone(level: ActivityLevel): string {
  switch (level) {
    case "HIGH": return "text-destructive";
    case "ELEVATED": return "text-[color:var(--gold)]";
    case "WATCH": return "text-[color:var(--ink)]";
    default: return "text-[color:var(--forest)]";
  }
}

function AbnormalActivityMonitor({ rooms, eggs, feed, mortality, health, bagWeightKg }: AbnormalProps) {
  const analysis = useMemo(
    () => computeAbnormalActivity(rooms, eggs, feed, mortality, health, bagWeightKg),
    [rooms, eggs, feed, mortality, health, bagWeightKg],
  );

  if (!analysis) {
    return (
      <Card>
        <CardHeader
          title="Abnormal Farm Activity Monitor"
          subtitle="Cross-signal operational monitoring based on production, mortality, feed and health records."
        />
        <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Not enough farm records yet to run cross-signal activity detection.
        </div>
      </Card>
    );
  }

  const { score, level, periodLabel, signalsAnalysed, roomsMonitored, mostAffected, rooms: roomRows, insight, limited } = analysis;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)]">
            <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> Predict</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] tracking-[0.16em] text-[color:var(--ink)]">Early Anomaly Model</span>
          </div>
          <h2 className="mt-1 font-display text-2xl md:text-3xl font-semibold">Abnormal Farm Activity Monitor</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Cross-signal operational monitoring based on production, mortality, feed and health records.
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Analysis window: {periodLabel}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <ForecastStat
          label="Current Activity Status"
          value={level}
          hint={`Abnormal activity score ${score}/100`}
          valueClassName={activityTone(level)}
          icon={Radar}
        />
        <ForecastStat
          label="Signals Analysed"
          value={String(signalsAnalysed.length)}
          hint={signalsAnalysed.length ? signalsAnalysed.join(" · ") : "No signals with sufficient data"}
        />
        <ForecastStat
          label="Rooms Monitored"
          value={String(roomsMonitored)}
          hint="Each active room analysed independently"
        />
        <ForecastStat
          label="Most Affected Room"
          value={mostAffected ? mostAffected.name : "—"}
          hint={mostAffected ? `${mostAffected.level} · score ${mostAffected.score}` : "No cross-signal pattern detected"}
        />
      </div>

      {limited && (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/30 p-4 text-sm">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Limited Signal Data</div>
          <div className="mt-1 text-muted-foreground">
            PoultryPro is monitoring available farm records. Additional matched production, feed, mortality and health records will strengthen cross-signal activity detection.
          </div>
        </div>
      )}

      {score >= 50 && mostAffected && (
        <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Cross-signal activity detected in {mostAffected.name}</div>
              <div className="mt-1 text-destructive/90">
                {mostAffected.triggered.length >= 2
                  ? `${mostAffected.triggered.map(s => signalPretty(s)).join(" and ")} signals occurred together within the current analysis window. Review recent ${mostAffected.name} operational and health records.`
                  : `${signalPretty(mostAffected.triggered[0] ?? "production")} signal is elevated. Review recent ${mostAffected.name} operational and health records.`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room-level table */}
      <div className="mt-6">
        <h3 className="font-display text-lg font-semibold">Room-Level Anomaly Analysis</h3>
        <p className="text-xs text-muted-foreground">Each active room analysed independently from its own production, mortality, feed and health records.</p>

        {/* Mobile stacked cards */}
        <div className="mt-3 grid gap-3 md:hidden">
          {roomRows.map(r => (
            <div key={r.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{r.name}</div>
                <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + activityBadgeClass(r.level)}>
                  {r.level} · {r.score}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Production</dt><dd>{r.signals.production.label}</dd></div>
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Mortality</dt><dd>{r.signals.mortality.label}</dd></div>
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Feed</dt><dd>{r.signals.feed.label}</dd></div>
                <div><dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Health context</dt><dd>{r.signals.health.label}</dd></div>
              </dl>
            </div>
          ))}
          {roomRows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No active rooms configured.</div>
          )}
        </div>

        {/* Desktop table */}
        <div className="mt-3 hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-4 font-medium">Room</th>
                <th className="py-2 pr-4 font-medium">Production Signal</th>
                <th className="py-2 pr-4 font-medium">Mortality Signal</th>
                <th className="py-2 pr-4 font-medium">Feed Signal</th>
                <th className="py-2 pr-4 font-medium">Health Context</th>
                <th className="py-2 pr-4 font-medium">Activity Score</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {roomRows.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-3 pr-4 font-medium">{r.name}</td>
                  <td className="py-3 pr-4">{r.signals.production.label}</td>
                  <td className="py-3 pr-4">{r.signals.mortality.label}</td>
                  <td className="py-3 pr-4">{r.signals.feed.label}</td>
                  <td className="py-3 pr-4">{r.signals.health.label}</td>
                  <td className="py-3 pr-4">{r.score}</td>
                  <td className="py-3 pr-4">
                    <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + activityBadgeClass(r.level)}>
                      {r.level}
                    </span>
                  </td>
                </tr>
              ))}
              {roomRows.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-muted-foreground">No active rooms configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insight */}
      <div className="mt-6 rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/8 p-4 md:p-5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink)]">
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" /> PoultryPro Cross-Signal Insight
        </div>
        <div className="mt-2 text-sm leading-relaxed">
          <div><span className="text-muted-foreground">Observation: </span>{insight.observation}</div>
          <div className="mt-1.5"><span className="text-muted-foreground">Signal Connection: </span>{insight.connection}</div>
          <div className="mt-1.5"><span className="text-muted-foreground">Risk Interpretation: </span>{insight.interpretation}</div>
          <div className="mt-1.5"><span className="text-muted-foreground">Suggested Action: </span>{insight.action}</div>
        </div>
      </div>

      {/* Methodology */}
      <div className="mt-4 rounded-2xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed">
        <div className="font-medium text-[color:var(--ink)]">Abnormal Activity Detection Methodology (0–100)</div>
        <ul className="mt-1.5 grid gap-1 md:grid-cols-2 text-muted-foreground">
          <li>Production Anomaly — 30%</li>
          <li>Mortality Pattern — 30%</li>
          <li>Feed Efficiency Anomaly — 25%</li>
          <li>Health Record Context — 15%</li>
        </ul>
        <div className="mt-2 text-muted-foreground">
          Available weights are re-normalised when a signal has insufficient data. Classification: 0–24 NORMAL · 25–49 WATCH · 50–74 ELEVATED · 75–100 HIGH.
        </div>
        <div className="mt-2 text-muted-foreground">
          PoultryPro Abnormal Farm Activity Detection provides early operational decision support based on recorded farm patterns. It does not constitute veterinary diagnosis or confirm disease.
        </div>
      </div>
    </Card>
  );
}

function signalPretty(k: SignalKey): string {
  return k === "production" ? "Production" : k === "mortality" ? "Mortality" : k === "feed" ? "Feed efficiency" : "Health record";
}

function computeAbnormalActivity(
  rooms: Room[], eggs: EggRow[], feed: Feed[], mortality: Mortality[], health: Health[], bagWeightKg: number | null,
): AbnormalAnalysis | null {
  if (!rooms || rooms.length === 0) return null;
  if (!eggs || eggs.length === 0) return null;

  const orderedEggs = [...eggs].sort((a, b) => b.date.localeCompare(a.date));
  const anchor = new Date(orderedEggs[0].date + "T00:00:00");
  const PERIOD_DAYS = 30;
  const periodStart = new Date(anchor);
  periodStart.setDate(periodStart.getDate() - PERIOD_DAYS + 1);
  const periodLabel = `${periodStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${anchor.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  // Reuse existing per-room mortality analysis
  const mortalityAnalysis = computeMortalityRisk(rooms, mortality, eggs, health);
  const mortalityByRoom = new Map<string, RoomRisk>();
  mortalityAnalysis?.rooms.forEach(r => mortalityByRoom.set(r.name, r));

  // Reuse existing feed efficiency (only if feed records exist)
  const feedAnalysis = feed && feed.length > 0
    ? computeFeedEfficiency(rooms, feed, eggs, mortality, health, bagWeightKg)
    : null;
  const feedByRoom = new Map<string, RoomEffRow>();
  feedAnalysis?.roomRows.forEach(r => feedByRoom.set(r.name, r));

  // Sort eggs ascending by date for production trend
  const eggsAsc = [...eggs].sort((a, b) => a.date.localeCompare(b.date));
  const eggInPeriod = eggsAsc.filter(e => {
    const t = new Date(e.date + "T00:00:00").getTime();
    return t >= periodStart.getTime() && t <= anchor.getTime() + 24 * 60 * 60 * 1000;
  });

  const roomKeyMap: Record<string, "r2" | "r3" | "r4" | null> = {};
  rooms.forEach(r => {
    const trimmed = r.name.replace(/\s+/g, "").toLowerCase();
    roomKeyMap[r.id] = trimmed.endsWith("2") ? "r2" : trimmed.endsWith("3") ? "r3" : trimmed.endsWith("4") ? "r4" : null;
  });

  const signalKeysAnalysed = new Set<SignalKey>();

  const roomRows: RoomActivityRow[] = rooms.map(room => {
    const rk = roomKeyMap[room.id];
    const signals: RoomActivityRow["signals"] = {
      production: { score: null, label: "Insufficient data", note: "" },
      mortality:  { score: null, label: "Insufficient data", note: "" },
      feed:       { score: null, label: "Insufficient data", note: "" },
      health:     { score: null, label: "Insufficient data", note: "" },
    };

    // --- Production signal (per room) ---
    if (rk) {
      const series = eggInPeriod.map(e => e[rk] * 30);
      if (series.length >= 8) {
        const half = Math.floor(series.length / 2);
        const prior = series.slice(0, half);
        const recent = series.slice(-half);
        const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
        const priorAvg = avg(prior);
        const recentAvg = avg(recent);
        const declinePct = priorAvg > 0 ? ((priorAvg - recentAvg) / priorAvg) * 100 : 0;
        // Only decline counts as anomaly signal
        const clamped = Math.max(0, declinePct);
        const score = Math.min(100, clamped * 10); // 10% decline → 100
        const label = declinePct >= 5
          ? `Decline ${declinePct.toFixed(1)}%`
          : declinePct >= 2
            ? `Mild decline ${declinePct.toFixed(1)}%`
            : declinePct <= -2
              ? `Rising ${Math.abs(declinePct).toFixed(1)}%`
              : "Stable";
        signals.production = { score, label, note: `Recent ${recent.length}-day avg ${recentAvg.toFixed(0)} eggs/day vs prior ${prior.length}-day avg ${priorAvg.toFixed(0)}.` };
        signalKeysAnalysed.add("production");
      }
    }

    // --- Mortality signal (per room) ---
    const mr = mortalityByRoom.get(room.name);
    if (mr) {
      signals.mortality = {
        score: mr.score,
        label: mr.events === 0
          ? "No events"
          : `${mr.events} event${mr.events === 1 ? "" : "s"} · ${mr.lost} lost`,
        note: `Period mortality ${mr.ratePct.toFixed(2)}%.`,
      };
      signalKeysAnalysed.add("mortality");
    }

    // --- Feed signal (per room) ---
    const fr = feedByRoom.get(room.name);
    if (fr && fr.movement !== "INSUFFICIENT DATA") {
      const map: Record<string, number> = { IMPROVING: 0, STABLE: 15, WATCH: 55, DECLINING: 90 };
      const s = map[fr.movement] ?? 0;
      signals.feed = { score: s, label: fr.movement, note: "Room-level feed-per-egg movement vs preceding matched records." };
      signalKeysAnalysed.add("feed");
    }

    // --- Health record context (per room) ---
    // Room-specific records may contribute to the room's health signal.
    // Farm-wide ("All Rooms") records are contextual only and MUST NOT
    // independently elevate a specific room's anomaly score.
    if (health && health.length > 0) {
      const parsedHealth = health
        .map(h => {
          const d = parseShortDate(h.date, anchor);
          return d ? { ...h, ts: d.getTime() } : null;
        })
        .filter((x): x is Health & { ts: number } => x !== null)
        .filter(h => h.ts >= periodStart.getTime() && h.ts <= anchor.getTime() + 24 * 60 * 60 * 1000);

      const roomSpecific = parsedHealth.filter(h => h.scope === room.name);
      const farmWide = parsedHealth.filter(h => /all rooms/i.test(h.scope));

      if (roomSpecific.length > 0) {
        const s = Math.min(100, roomSpecific.length * 30);
        signals.health = {
          score: s,
          label: `Room-specific record${roomSpecific.length === 1 ? "" : "s"} (${roomSpecific.length})`,
          note: roomSpecific.slice(0, 2).map(h => `${h.name} (${h.type})`).join(", "),
        };
        signalKeysAnalysed.add("health");
      } else if (farmWide.length > 0) {
        // Contextual only — does not contribute to this room's score.
        signals.health = {
          score: null,
          label: "Farm-wide context available",
          note: farmWide.slice(0, 2).map(h => `${h.name} (${h.type}, All Rooms)`).join(", "),
        };
      } else {
        signals.health = { score: null, label: "No recent health context", note: "" };
      }
    } else {
      signals.health = { score: null, label: "No recent health context", note: "" };
    }

    // --- Weighted score with re-normalisation ---
    const weights: Record<SignalKey, number> = { production: 0.30, mortality: 0.30, feed: 0.25, health: 0.15 };
    let total = 0;
    let weightSum = 0;
    (Object.keys(weights) as SignalKey[]).forEach(k => {
      const s = signals[k].score;
      if (s !== null) {
        total += s * weights[k];
        weightSum += weights[k];
      }
    });
    const roomScore = weightSum > 0 ? Math.round(total / weightSum) : 0;
    const level = classifyActivity(roomScore);
    const triggered = (Object.keys(signals) as SignalKey[]).filter(k => (signals[k].score ?? 0) >= 50);

    return { id: room.id, name: room.name, score: roomScore, level, signals, triggered };
  });

  // Farm-level: weighted by current bird count
  const totalBirds = rooms.reduce((s, r) => s + r.current, 0);
  const farmScore = totalBirds > 0
    ? Math.round(roomRows.reduce((s, r) => {
        const room = rooms.find(rr => rr.id === r.id)!;
        return s + r.score * (room.current / totalBirds);
      }, 0))
    : 0;
  const farmLevel = classifyActivity(farmScore);

  const mostAffected = [...roomRows].sort((a, b) => b.score - a.score)[0] ?? null;

  const limited = signalKeysAnalysed.size < 3;

  // --- Insight ---
  const combos = roomRows.filter(r => r.triggered.length >= 2);
  const observation = combos.length > 0
    ? `Cross-signal pattern detected in ${combos.map(r => r.name).join(", ")}: ${combos.map(r => `${r.triggered.map(signalPretty).join(" + ")} in ${r.name}`).join("; ")}.`
    : mostAffected && mostAffected.triggered.length === 1
      ? `${signalPretty(mostAffected.triggered[0])} signal is elevated in ${mostAffected.name}. No other independent signal is currently elevated in the same room.`
      : "No abnormal cross-signal pattern has been detected in the current analysis window based on available farm records.";

  const connection = combos.length > 0
    ? "Two or more independent signals occurred together in the same room within the current analysis window. Combinations of signals are more indicative of an operational pattern warranting review than any single fluctuation."
    : "PoultryPro cross-references production, mortality, feed and health signals per room. A single normal fluctuation is not treated as a confirmed anomaly.";

  const strongest = mostAffected
    ? mostAffected.triggered.length > 0
      ? mostAffected.triggered.map(signalPretty).join(", ")
      : "no individually elevated signal"
    : "no active room";

  const interpretation = `Farm activity score ${farmScore}/100 (${farmLevel}) across ${roomRows.length} monitored room${roomRows.length === 1 ? "" : "s"} using ${signalKeysAnalysed.size} of 4 signal categor${signalKeysAnalysed.size === 1 ? "y" : "ies"}${limited ? " (weights re-normalised due to insufficient data on other signals)" : ""}. Strongest contributing signals: ${strongest}.`;

  // Health-context clarification for the most affected room.
  const healthClarification = mostAffected
    ? mostAffected.signals.health.label === "Farm-wide context available"
      ? ` Farm-wide health records are available for contextual review; however, no room-specific health record is currently associated with ${mostAffected.name}. Farm-wide records are not treated as a room-specific health signal and do not increase ${mostAffected.name}'s activity score.`
      : mostAffected.signals.health.label.startsWith("Room-specific")
        ? ` A room-specific health record is associated with ${mostAffected.name} within the analysis window; this is presented as context and does not imply that any vaccination, vitamin or medication record caused mortality or production movement.`
        : ""
    : "";

  const targetRoom = mostAffected && mostAffected.score >= 25 ? mostAffected.name : null;
  const action = targetRoom
    ? `Review ${targetRoom} production records, recent mortality events, feed formulation and feed batches, water availability, environmental observations, vaccination and medication records, and bird population changes.${healthClarification} This may be associated with an operational pattern; the pattern warrants review before drawing further conclusions.`
    : `Continue capturing daily production, feed, mortality and health records. PoultryPro will strengthen cross-signal activity detection as additional matched records become available.${healthClarification}`;

  return {
    score: farmScore,
    level: farmLevel,
    periodLabel,
    signalsAnalysed: Array.from(signalKeysAnalysed).map(signalPretty),
    roomsMonitored: roomRows.length,
    mostAffected,
    rooms: roomRows.sort((a, b) => b.score - a.score),
    insight: { observation, connection, interpretation, action },
    limited,
  };
}
