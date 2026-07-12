import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Egg, Bird, TrendingDown, TrendingUp, Wheat, DollarSign,
  Skull, Syringe, Droplets, Plus, Pencil, Trash2, MapPin,
  Sparkles, ArrowLeft, LayoutDashboard, LineChart as LineChartIcon,
  Brain, Activity, AlertTriangle, Gauge, Radar, Lightbulb, ArrowRight,
} from "lucide-react";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";

export const Route = createFileRoute("/dashboard")({
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

// ---------- Seed data (mirrors screenshots) ----------
type Room = { id: string; name: string; current: number; initial: number };
type EggRow = { date: string; label: string; r2: number; r3: number; r4: number; extra: number };
type Mortality = { id: string; room: string; cause: string; date: string; loss: number };
type Health = { id: string; name: string; scope: string; type: "Vitamin" | "Vaccination"; date: string };
type Feed = { id: string; room: string; bags: number; date: string };
type Price = { id: string; item: string; unit: string; price: number; updated: string };

const seedRooms: Room[] = [
  { id: "r2", name: "ROOM 2", current: 1413, initial: 1414 },
  { id: "r3", name: "ROOM 3", current: 1324, initial: 1330 },
  { id: "r4", name: "ROOM 4", current: 1220, initial: 1222 },
];

const seedEggs: EggRow[] = [
  { date: "2026-02-20", label: "Fri, 20 Feb", r2: 39, r3: 34, r4: 31, extra: 9 },
  { date: "2026-02-19", label: "Thu, 19 Feb", r2: 39, r3: 35, r4: 31, extra: 22 },
  { date: "2026-02-18", label: "Wed, 18 Feb", r2: 40, r3: 35, r4: 31, extra: 13 },
  { date: "2026-02-17", label: "Tue, 17 Feb", r2: 39, r3: 34, r4: 31, extra: 13 },
  { date: "2026-02-16", label: "Mon, 16 Feb", r2: 38, r3: 34, r4: 31, extra: 4 },
  { date: "2026-02-15", label: "Sun, 15 Feb", r2: 38, r3: 33, r4: 30, extra: 14 },
  { date: "2026-02-14", label: "Sat, 14 Feb", r2: 40, r3: 33, r4: 31, extra: 7 },
  { date: "2026-02-13", label: "Fri, 13 Feb", r2: 39, r3: 35, r4: 31, extra: 25 },
  { date: "2026-02-12", label: "Thu, 12 Feb", r2: 38, r3: 34, r4: 31, extra: 6 },
  { date: "2026-02-11", label: "Wed, 11 Feb", r2: 39, r3: 33, r4: 31, extra: 9 },
  { date: "2026-02-10", label: "Tue, 10 Feb", r2: 39, r3: 34, r4: 31, extra: 0 },
  { date: "2026-02-09", label: "Mon, 9 Feb", r2: 39, r3: 33, r4: 32, extra: 27 },
  { date: "2026-02-08", label: "Sun, 8 Feb", r2: 39, r3: 33, r4: 30, extra: 28 },
  { date: "2026-02-07", label: "Sat, 7 Feb", r2: 40, r3: 34, r4: 32, extra: 2 },
  { date: "2026-02-06", label: "Fri, 6 Feb", r2: 38, r3: 34, r4: 31, extra: 6 },
  { date: "2026-02-05", label: "Thu, 5 Feb", r2: 38, r3: 33, r4: 31, extra: 24 },
  { date: "2026-02-04", label: "Wed, 4 Feb", r2: 39, r3: 34, r4: 31, extra: 25 },
  { date: "2026-02-03", label: "Tue, 3 Feb", r2: 39, r3: 34, r4: 31, extra: 5 },
  { date: "2026-02-02", label: "Mon, 2 Feb", r2: 38, r3: 33, r4: 31, extra: 27 },
  { date: "2026-02-01", label: "Sun, 1 Feb", r2: 39, r3: 33, r4: 31, extra: 8 },
  { date: "2026-01-25", label: "Sun, 25 Jan", r2: 38, r3: 33, r4: 30, extra: 29 },
  { date: "2026-01-24", label: "Sat, 24 Jan", r2: 38, r3: 34, r4: 30, extra: 25 },
  { date: "2026-01-23", label: "Fri, 23 Jan", r2: 37, r3: 34, r4: 31, extra: 24 },
  { date: "2026-01-22", label: "Thu, 22 Jan", r2: 37, r3: 34, r4: 32, extra: 13 },
  { date: "2026-01-16", label: "Fri, 16 Jan", r2: 36, r3: 33, r4: 30, extra: 3 },
  { date: "2026-01-10", label: "Sat, 10 Jan", r2: 37, r3: 33, r4: 31, extra: 19 },
  { date: "2025-12-31", label: "Wed, 31 Dec", r2: 35, r3: 34, r4: 30, extra: 6 },
  { date: "2025-12-30", label: "Tue, 30 Dec", r2: 36, r3: 33, r4: 29, extra: 21 },
  { date: "2025-12-29", label: "Mon, 29 Dec", r2: 37, r3: 34, r4: 30, extra: 15 },
  { date: "2025-12-27", label: "Sat, 27 Dec", r2: 35, r3: 33, r4: 28, extra: 2 },
];

const seedMortality: Mortality[] = [
  { id: "m1", room: "ROOM 3", cause: "Unknown", date: "16 Jan", loss: 1 },
  { id: "m2", room: "ROOM 3", cause: "Unknown", date: "3 Feb", loss: 1 },
  { id: "m3", room: "ROOM 4", cause: "Unknown", date: "7 Feb", loss: 2 },
  { id: "m4", room: "ROOM 3", cause: "Unknown", date: "7 Feb", loss: 1 },
  { id: "m5", room: "ROOM 3", cause: "Unknown", date: "11 Feb", loss: 1 },
];

const seedHealth: Health[] = [
  { id: "h1", name: "MIAVIT", scope: "ROOM 2", type: "Vitamin", date: "16 Jan" },
  { id: "h2", name: "MIAVIT", scope: "All Rooms", type: "Vitamin", date: "9 Feb" },
  { id: "h3", name: "LASOTA VACCINE", scope: "All Rooms", type: "Vaccination", date: "8 Feb" },
];

const seedFeed: Feed[] = [
  { id: "f1", room: "ROOM 4", bags: 5.5, date: "20 Feb" },
  { id: "f2", room: "ROOM 3", bags: 6.5, date: "20 Feb" },
  { id: "f3", room: "ROOM 2", bags: 7, date: "20 Feb" },
  { id: "f4", room: "ROOM 4", bags: 5.5, date: "19 Feb" },
];

const seedPrices: Price[] = [
  { id: "p1", item: "Egg", unit: "30", price: 4900, updated: "19 Feb 2026" },
  { id: "p2", item: "Feed after all Expenses", unit: "1", price: 13600, updated: "20 Feb 2026" },
];

// ---------- Helpers ----------
const naira = (n: number) => "₦" + n.toLocaleString("en-NG");
const uid = () => Math.random().toString(36).slice(2, 9);

function Dashboard() {
  const [rooms, setRooms] = useState<Room[]>(seedRooms);
  const [eggs, setEggs] = useState<EggRow[]>(seedEggs);
  const [mortality, setMortality] = useState<Mortality[]>(seedMortality);
  const [health, setHealth] = useState<Health[]>(seedHealth);
  const [feed, setFeed] = useState<Feed[]>(seedFeed);
  const [prices, setPrices] = useState<Price[]>(seedPrices);
  const [feedTab, setFeedTab] = useState<"Usage" | "Formulas">("Usage");
  const [area, setArea] = useState<"records" | "analytics" | "ai">("records");
  const [forecastOpen, setForecastOpen] = useState(false);

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
  const feedToday = feed.filter(f => f.date === "20 Feb").reduce((s, f) => s + f.bags, 0);
  const productionRate = totalBirds ? Math.round((todayEggs / totalBirds) * 100) : 0;
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

  // Actions
  const addRoom = () => {
    const n = prompt("Room name (e.g. ROOM 5)"); if (!n) return;
    const b = parseInt(prompt("Initial birds") || "0", 10) || 0;
    setRooms([...rooms, { id: uid(), name: n.toUpperCase(), current: b, initial: b }]);
  };
  const delRoom = (id: string) => setRooms(rooms.filter(r => r.id !== id));

  const recordProduction = () => {
    const label = prompt("Date label (e.g. Sat, 21 Feb)"); if (!label) return;
    const r2 = +(prompt("ROOM 2 crates") || "0");
    const r3 = +(prompt("ROOM 3 crates") || "0");
    const r4 = +(prompt("ROOM 4 crates") || "0");
    const extra = +(prompt("Extra eggs") || "0");
    setEggs([{ date: new Date().toISOString().slice(0, 10), label, r2, r3, r4, extra }, ...eggs]);
  };

  const addMortality = () => {
    const room = prompt("Room") || "ROOM 2";
    const loss = +(prompt("Loss") || "1");
    setMortality([{ id: uid(), room: room.toUpperCase(), cause: "Unknown", date: "Today", loss }, ...mortality]);
    setRooms(rooms.map(r => r.name === room.toUpperCase() ? { ...r, current: r.current - loss } : r));
  };

  const addHealth = () => {
    const name = prompt("Name (e.g. MIAVIT)"); if (!name) return;
    const type = (prompt("Type: Vitamin or Vaccination") || "Vitamin") as Health["type"];
    setHealth([{ id: uid(), name: name.toUpperCase(), scope: "All Rooms", type, date: "Today" }, ...health]);
  };

  const recordFeed = () => {
    const room = prompt("Room") || "ROOM 2";
    const bags = +(prompt("Bags") || "1");
    setFeed([{ id: uid(), room: room.toUpperCase(), bags, date: "Today" }, ...feed]);
  };

  const addPrice = () => {
    const item = prompt("Item"); if (!item) return;
    const unit = prompt("Unit") || "1";
    const price = +(prompt("Price (NGN)") || "0");
    setPrices([...prices, { id: uid(), item, unit, price, updated: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) }]);
  };
  const delPrice = (id: string) => setPrices(prices.filter(p => p.id !== id));

  return (
    <div className="min-h-screen bg-background text-foreground pb-14">
      {/* Header */}
      <header className="bg-[color:var(--forest)] text-primary-foreground">
        <div className="container-x flex items-center justify-between py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
          <div className="flex items-center gap-2">
            <img src={logoAsset.url} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="font-display font-semibold">PoultryPro™</span>
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
            <MiniStat label="Total Crates" value={totalCrates.toLocaleString()} tone="mint" />
            <MiniStat label="Total Eggs" value={totalEggs.toLocaleString()} tone="plain" />
            <MiniStat label="Days Recorded" value={String(eggs.length)} tone="sky" />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">ROOM 2</th>
                  <th className="py-2 pr-4 font-medium">ROOM 3</th>
                  <th className="py-2 pr-4 font-medium">ROOM 4</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Extra</th>
                </tr>
              </thead>
              <tbody>
                {eggs.map(e => (
                  <tr key={e.date + e.label} className="border-b border-border/50">
                    <td className="py-2.5 pr-4">{e.label}</td>
                    <td className="py-2.5 pr-4">{e.r2}</td>
                    <td className="py-2.5 pr-4">{e.r3}</td>
                    <td className="py-2.5 pr-4">{e.r4}</td>
                    <td className="py-2.5 pr-4">
                      <span className="inline-flex items-center rounded-full bg-[color:var(--forest)] text-primary-foreground px-2.5 py-0.5 text-xs font-medium">
                        {e.r2 + e.r3 + e.r4}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{e.extra ? `+${e.extra}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <CardHeader title="Mortality Log" subtitle="Recent bird losses" right={<ActionBtn onClick={addMortality} icon={Plus}>Add</ActionBtn>} />
            <div className="mt-4 space-y-2">
              {mortality.map(m => (
                <div key={m.id} className="flex items-center justify-between rounded-xl bg-destructive/5 border border-destructive/10 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-destructive/10 text-destructive"><Skull className="h-4 w-4" /></span>
                    <div>
                      <div className="text-sm font-semibold">{m.room}</div>
                      <div className="text-xs text-muted-foreground">{m.cause}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-destructive font-semibold text-sm">-{m.loss}</div>
                    <div className="text-xs text-muted-foreground">{m.date}</div>
                  </div>
                </div>
              ))}
            </div>
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
            <div className="mt-4 space-y-2">
              {feed.map(f => (
                <div key={f.id} className="flex items-center justify-between rounded-xl bg-[color:var(--gold)]/10 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--gold)]/20 text-[color:var(--gold)]"><Wheat className="h-4 w-4" /></span>
                    <div className="text-sm font-semibold">{f.room}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm">{f.bags} bags</div>
                    <div className="text-xs text-muted-foreground">{f.date}</div>
                  </div>
                </div>
              ))}
            </div>
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
                  desc="Analyse mortality patterns across rooms and flocks to identify abnormal changes." />
                <AiCard icon={Wheat} title="Feed Efficiency Monitoring"
                  desc="Compare feed usage with production performance to identify possible efficiency changes." />
                <AiCard icon={Radar} title="Abnormal Farm Activity Detection"
                  desc="Monitor operational records for unusual production, mortality or feed patterns." />
                <AiCard icon={Lightbulb} title="AI-Supported Farm Insights"
                  desc="Transform farm data patterns into clear operational observations and decision-support recommendations." />
              </div>
            </Card>

            {forecastOpen && (
              <ProductionForecast eggs={eggs} totalBirds={totalBirds} />
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

  const directionTone =
    direction === "Increasing" ? "text-[color:var(--forest)]"
    : direction === "Declining" ? "text-destructive"
    : "text-muted-foreground";
  const DirectionIcon =
    direction === "Increasing" ? TrendingUp
    : direction === "Declining" ? TrendingDown
    : Activity;

  const observation =
    direction === "Increasing"
      ? "Recent production records indicate a gradually improving production pattern."
      : direction === "Declining"
        ? "Recent production records indicate a softening production pattern that warrants attention."
        : "Recent production records indicate a relatively stable production pattern.";
  const outlook =
    direction === "Declining"
      ? `Projected daily production over the next 7 days is around ${avgForecast.toLocaleString()} eggs, within a ${low.toLocaleString()}–${high.toLocaleString()} range if the current downward movement continues.`
      : `Production is projected to remain within roughly ${low.toLocaleString()}–${high.toLocaleString()} eggs per day (average ~${avgForecast.toLocaleString()}) if current operating conditions remain similar.`;
  const action =
    direction === "Declining"
      ? "Investigate recent feed, health and mortality records for changes that may be driving the decline, and continue monitoring daily production closely."
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
  direction: "Increasing" | "Stable" | "Declining";
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

  // Direction from slope; cross-check against first vs last plotted forecast
  const slopePctPerDay = mean === 0 ? 0 : (slope / mean) * 100;
  const forecastDelta = forecastValues[forecastValues.length - 1] - forecastValues[0];
  const direction: ForecastResult["direction"] =
    slopePctPerDay > 0.4 && forecastDelta > 0 ? "Increasing"
    : slopePctPerDay < -0.4 && forecastDelta < 0 ? "Declining"
    : "Stable";

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
