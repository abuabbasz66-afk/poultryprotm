import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
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
        {/* KPI cards */}
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
