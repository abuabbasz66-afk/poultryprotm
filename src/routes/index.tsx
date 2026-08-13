import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import heroAsset from "@/assets/hero-layer-birds.jpg.asset.json";
import founderAsset from "@/assets/founder-abubakar.jpg.asset.json";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";
import eggsImg from "@/assets/eggs.jpg";
import {
  Egg, Bird, LineChart, HeartPulse, Wheat, Wallet, LayoutDashboard,
  ShieldCheck, Sparkles, ArrowRight, MapPin, Trophy, Cpu, Users, Leaf,
  Calculator, FileText, Brain, Mic, TrendingUp, CloudSun, Radio, Camera,
  Sliders, DollarSign, Syringe, BarChart3, Store, Handshake, Smartphone,
  Baby, Drumstick,
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

const HOME_TITLE = "PoultryPro | Smart Poultry Farm Management Platform";
const HOME_DESC =
  "PoultryPro is a digital poultry farm management platform helping farmers manage production, feed, health, mortality, finance, bird age, weather advisories and farm performance.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://poultrypro.life/" },
    ],
    links: [{ rel: "canonical", href: "https://poultrypro.life/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "PoultryPro",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, Android, iOS",
          url: "https://poultrypro.life/",
          description: HOME_DESC,
          offers: [
            { "@type": "Offer", name: "Basic", price: "0", priceCurrency: "NGN" },
            { "@type": "Offer", name: "Standard", price: "950", priceCurrency: "NGN" },
            { "@type": "Offer", name: "Premium", price: "1950", priceCurrency: "NGN" },
          ],
          provider: {
            "@type": "Organization",
            name: "Greenfield Contracts & Agro Limited",
            url: "https://poultrypro.life/",
          },
        }),
      },
    ],
  }),
  component: Index,
});


function useAuthed() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);
  return authed;
}



type LivePlatformStats = {
  registered_farms: number;
  registered_users: number;
  total_birds: number;
  production_records: number;
  feed_records: number;
  mortality_records: number;
  health_records: number;
  rooms: number;
  eggs: number;
  premium_farms: number;
  revenue_tracked: number;
  profit_analysed: number;
};

const STAT_KEYS: (keyof LivePlatformStats)[] = [
  "registered_farms", "registered_users", "total_birds", "production_records",
  "feed_records", "mortality_records", "health_records", "rooms", "eggs",
  "premium_farms", "revenue_tracked", "profit_analysed",
];

async function fetchLivePlatformStats(): Promise<LivePlatformStats> {
  const { data, error } = await supabase.rpc("landing_platform_stats");
  if (error) throw error;
  const row = (data ?? {}) as Record<string, number | string>;
  const out = {} as LivePlatformStats;
  for (const k of STAT_KEYS) out[k] = Number(row[k]) || 0;
  return out;
}

function useLivePlatformStats() {
  return useQuery({
    queryKey: ["landing-platform-stats"],
    queryFn: fetchLivePlatformStats,
    // Always hit the database on mount so investors never see a stale/empty card.
    staleTime: 0,
    gcTime: 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
  });
}

function fmtStat(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "No data available yet";
  return n.toLocaleString("en-US");
}

function fmtMoney(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "No data available yet";
  return `₦${Math.round(n).toLocaleString("en-US")}`;
}

function StatSkeleton({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-7 w-24 animate-pulse rounded-md bg-current opacity-20 align-middle ${className}`}
    />
  );
}


const architecture = [
  {
    step: "01",
    title: "Capture",
    tag: "Farm Records",
    desc: "Record eggs, feed, health, mortality, costs, bird information and other farm activities in one organised system.",
    icon: LayoutDashboard,
  },
  {
    step: "02",
    title: "Understand",
    tag: "Farm Analytics",
    desc: "Turn your farm records into clear production, cost, revenue and profitability insights.",
    icon: LineChart,
  },
  {
    step: "03",
    title: "Predict",
    tag: "Intelligent Insights",
    desc: "Use intelligent alerts, farm trends and weather-based bird advisories to identify risks earlier and make proactive decisions.",
    icon: Sparkles,
  },
];

const recognition = [
  { icon: FileText, title: "Daily Trust", desc: "Featured in Agriculture" },
  { icon: Trophy, title: "3MTT", desc: "Fellow of the Week" },
  { icon: Trophy, title: "Airtel Sponsored 3MTT NextGen Knowledge Showcase", desc: "Winner" },
  { icon: Handshake, title: "Poultry Association of Nigeria", desc: "PoultryPro presented to the Katsina Chapter" },
];

const features: { icon: any; title: string; desc: string; soon?: boolean }[] = [
  { icon: LayoutDashboard, title: "Interactive Farm Dashboard", desc: "Monitor birds, production, feed, mortality, health, revenue and farm performance from one clear view." },
  { icon: Egg, title: "Production Management", desc: "Track daily production by room and flock and understand which groups are performing best." },
  { icon: Wheat, title: "Feed Management", desc: "Monitor feed usage, inventory and costs while improving control over one of the farm's biggest expenses." },
  { icon: HeartPulse, title: "Health & Mortality", desc: "Maintain health records, treatments, vaccinations and mortality history to support better flock management." },
  { icon: Wallet, title: "Revenue & Expenditure", desc: "Track farm income, expenses, costs and profitability to understand where your money is going." },
  { icon: Bird, title: "Bird Age Tracking", desc: "Automatically track flock age from placement and understand the stage of your birds." },
  { icon: CloudSun, title: "Farm Weather & Bird Advisory", desc: "Interpret local weather conditions into practical poultry risk alerts and management recommendations." },
  { icon: Baby, title: "Layer Brooding & Rearing", desc: "Track pullets from brooding through rearing, growth stages and transfer into layer production." },
  { icon: Drumstick, title: "Broiler Dashboard", desc: "Manage broiler batches with age, growth, feed, health, mortality and performance tracking." },
  { icon: Bird, title: "Noiler Dashboard", desc: "Manage Noiler production with dedicated flock, growth, production, feed and financial insights.", soon: true },
  { icon: Users, title: "Staff & Users Management", desc: "Invite farm staff, assign roles and control access to farm information." },
  { icon: ShieldCheck, title: "Farm Alerts", desc: "Receive important alerts when farm records, trends or conditions require attention." },
  { icon: BarChart3, title: "Production Analytics", desc: "Understand production trends, room performance and historical farm records." },
  { icon: LineChart, title: "Financial Analytics", desc: "Analyse revenue, expenditure, costs and profitability over time." },
];

const operations = [
  { icon: Egg, title: "Layers", desc: "Production, eggs, feed, health, mortality, rooms and profitability." },
  { icon: Drumstick, title: "Broilers", desc: "Age, growth, feed, water, health, mortality and batch performance." },
  { icon: Bird, title: "Noilers", desc: "Flock management, growth, feed, health, production and financial performance." },
  { icon: Baby, title: "Brooding & Rearing", desc: "Track pullets from day-old through brooding, rearing and maturity." },
];

const weatherSignals = [
  "Heat stress risk",
  "Heavy rainfall",
  "High humidity",
  "Sudden temperature changes",
  "Practical management recommendations",
];

const exampleAlerts = [
  { title: "Production Alert", desc: "Room production is below its recent trend." },
  { title: "Feed Alert", desc: "Feed usage is higher than expected." },
  { title: "Mortality Alert", desc: "Recent mortality requires attention." },
  { title: "Financial Alert", desc: "Farm expenditure has increased compared with the previous period." },
];

const tiers = [
  {
    name: "Basic",
    tagline: "Farm Records",
    stage: "Capture",
    stageNum: "01",
    promise: "Start with essential record keeping.",
    subtitle: "Move from scattered notebooks to one organised, searchable record of everything that happens on your farm.",
    points: [
      "Daily egg production recording",
      "Room-based egg records",
      "Feed usage recording",
      "Mortality records",
      "Health, vaccination, medication & vitamin records",
      "Farm observations",
      "Bird and flock records",
      "Room management",
      "Historical operational records",
    ],
    price: "Free",
    priceNote: "Up to 500 birds · 1 Farm",
    cta: "Create Free Account",
    ctaHref: null as string | null,
    badge: "Available now" as string | null,
    highlight: false,
  },
  {
    name: "Standard",
    tagline: "Farm Analytics",
    stage: "Understand",
    stageNum: "02",
    promise: "Grow into business analytics.",
    subtitle: "Turn your daily records into clear financial and production insights that help you run the farm more profitably.",
    points: [
      "Everything in Basic",
      "Production percentage calculations",
      "Revenue tracking & feed cost monitoring",
      "Daily & monthly profit analysis",
      "Egg production trend analysis",
      "Historical performance comparisons",
      "Financial analytics — revenue & cost analysis",
      "Price management",
      "Farm performance reports",
      "Business intelligence dashboards",
    ],
    price: "₦950",
    priceNote: "per month · Unlimited birds",
    cta: "Start Standard Plan",
    ctaHref: null as string | null,
    badge: "Popular · Available now",
    highlight: true,
  },
  {
    name: "Premium",
    tagline: "PoultryPro AI Intelligence",
    stage: "Predict",
    stageNum: "03",
    promise: "Upgrade to AI-powered decision support.",
    subtitle: "Let PoultryPro continuously analyse your records, detect unusual patterns and alert you to risks earlier.",
    points: [
      "Everything in Basic & Standard",
      "AI-powered egg production forecasting",
      "Predictive production analysis",
      "Production decline detection",
      "Mortality risk monitoring",
      "Feed efficiency monitoring",
      "Abnormal farm activity detection",
      "Intelligent farm monitoring & early risk alerts",
      "AI-supported farm insights & recommendations",
      "PoultryPro Intelligence Dashboard",
    ],
    price: "₦1,950",
    priceNote: "per month",
    cta: "Start Premium Plan",
    ctaHref: null as string | null,
    badge: "Available now — AI-powered",
    highlight: false,
  },
];



const problems = [
  "Important records get lost in notebooks, spreadsheets or scattered across different places.",
  "Farmers cannot quickly see how birds, production, feed and costs are really performing.",
  "Feed is one of the largest farm expenses and is difficult to track and optimise.",
  "Profitability problems often go unnoticed until they become difficult to fix.",
  "Health and mortality records are often incomplete, making early intervention harder.",
];

const liveFeatures: { icon: any; title: string; desc: string }[] = [
  { icon: LayoutDashboard, title: "Live Farm Dashboard", desc: "Real-time production, mortality, feed, health and financial monitoring." },
  { icon: Wallet, title: "Profit & Financial Analytics", desc: "Automatic revenue, feed cost, daily, monthly and all-time profit analysis." },
  { icon: Wheat, title: "Feed Management", desc: "Record daily feed usage, manage feed inventory and calculate feed costs." },
  { icon: Calculator, title: "Feed Formulation & Cost Calculator", desc: "Create custom feed formulas, calculate ingredient costs, cost per kilogram and cost per bag." },
  { icon: Sparkles, title: "AI Feed Intelligence", desc: "Monitor feed inventory, estimate remaining days of feed and generate low-feed alerts." },
  { icon: LineChart, title: "Production Analytics", desc: "Interactive production trends, room performance, historical records and operational insights." },
  { icon: HeartPulse, title: "Mortality & Health Tracking", desc: "Monitor bird health, mortality trends and treatment history." },
  { icon: Baby, title: "Layer Brooding & Rearing", desc: "Track pullet development from day one through growth stages until maturity and transfer to layer rooms." },
  { icon: Drumstick, title: "Broiler Dashboard", desc: "Dedicated broiler management with growth tracking, FCR, health records and batch analytics." },
  { icon: Users, title: "Staff & Users Management", desc: "Invite farm staff, assign roles and manage permissions across your team." },
  { icon: ShieldCheck, title: "Multi-Farm Management", desc: "Secure farm-specific dashboards with complete tenant isolation." },
  { icon: FileText, title: "Smart Reporting", desc: "Automatically generate operational and financial reports." },
  { icon: CloudSun, title: "Farm Weather & Bird Advisory", desc: "Live weather forecasts interpreted into poultry-specific risk alerts and management recommendations." },
  { icon: BarChart3, title: "Production Forecasting", desc: "Predict egg production and feed consumption based on historical farm records." },
  { icon: Smartphone, title: "Mobile App — Android & iOS", desc: "Installable offline-first mobile app with automatic synchronisation when connectivity returns." },
];

const comingSoon: { icon: any; title: string; desc: string }[] = [
  { icon: Brain, title: "AI Disease Prediction", desc: "Predict disease outbreaks before symptoms appear." },
  { icon: Mic, title: "AI Voice Assistant", desc: "Ask PoultryPro questions using natural voice commands." },
  { icon: TrendingUp, title: "Market Price Intelligence", desc: "Predict future egg and feed prices." },
  { icon: Radio, title: "IoT Sensor Integration", desc: "Connect temperature, humidity, water and feed sensors." },
  { icon: Camera, title: "Smart Camera Monitoring", desc: "AI vision for bird behaviour and health monitoring." },
  { icon: Sliders, title: "Automated Feed Optimisation", desc: "Recommend the most profitable feed formulations." },
  { icon: DollarSign, title: "Profit Forecasting", desc: "Predict farm profitability for future weeks and months." },
  { icon: Syringe, title: "Smart Vaccination Assistant", desc: "Automatic vaccination schedules and reminders." },
  { icon: Store, title: "Poultry Marketplace", desc: "Buy and sell feed, chicks, eggs, equipment and other poultry products." },
  { icon: Handshake, title: "Cooperative & Investor Portal", desc: "Dedicated dashboards for cooperatives, investors and financial institutions." },
];

function Index() {
  const authed = useAuthed();
  const { data: live, isPending: statsLoading } = useLivePlatformStats();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/60">
        <div className="container-x flex h-16 items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5">
            <img src={logoAsset.url} alt="PoultryPro" width={40} height={40} className="h-9 w-9 object-contain" />
            <span className="font-display text-lg font-semibold tracking-tight">
              PoultryPro<sup className="text-[10px] text-muted-foreground">™</sup>
            </span>
          </a>
          <nav className="hidden md:flex items-center gap-10 text-sm font-medium">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors duration-200">Features</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors duration-200">Pricing</a>
            <a href="#founder" className="text-muted-foreground hover:text-foreground transition-colors duration-200">Founder</a>
            <a href="#roadmap" className="text-muted-foreground hover:text-foreground transition-colors duration-200">Roadmap</a>
          </nav>
          {authed ? (
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 transition-all duration-200">
              Open Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <div className="flex items-center gap-2">

              <Link to="/auth" search={{ mode: "signin" }} className="hidden sm:inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors duration-200">
                Sign In
              </Link>
              <Link to="/auth" search={{ mode: "signup" }} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 transition-all duration-200">
                Create Farm Account <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </header>

      <section id="top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[color:var(--forest)]/10 blur-3xl" />
          <div className="absolute top-40 -right-24 h-80 w-80 rounded-full bg-[color:var(--gold)]/15 blur-3xl" />
        </div>
        <div className="container-x pt-20 pb-24 md:pt-32 md:pb-40 grid lg:grid-cols-12 gap-14 items-center">
          <div className="lg:col-span-6 space-y-8 hero-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-secondary-foreground">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" />
              Capture · Understand · Predict
            </span>
            <h1 className="font-display font-extrabold tracking-tight text-foreground text-[2.75rem] sm:text-5xl md:text-6xl lg:text-[4.25rem] leading-[1.05]">
              Run your poultry farm with data, clarity and confidence.
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-[600px] leading-relaxed font-normal">
              PoultryPro brings production, feed, health, mortality, bird age, finance and intelligent
              farm insights into one powerful platform — helping poultry farmers make better decisions
              and protect their profits.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              {authed ? (
                <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] transition-all duration-200 shadow-[var(--shadow-lift)]">
                  Explore the Platform <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link to="/auth" search={{ mode: "signin" }} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] transition-all duration-200 shadow-[var(--shadow-lift)]">
                  Explore the Platform <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link to="/presentation" className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-6 py-3 text-sm font-semibold text-[color:var(--ink)] hover:brightness-105 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] transition-all duration-200 shadow-[var(--shadow-lift)]">
                🚀 Launch Live Demo
              </Link>
              <a href="#founder" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-secondary hover:-translate-y-0.5 transition-all duration-200">
                Meet the Founder
              </a>
            </div>

            <div className="pt-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-4 py-2 text-xs sm:text-sm font-medium text-foreground">
                <Trophy className="h-4 w-4 text-[color:var(--gold)]" />
                <span className="font-semibold">Winner</span>
                <span className="text-muted-foreground">— Airtel Sponsored 3MTT NextGen Knowledge Showcase</span>
              </span>
            </div>
          </div>

          <div className="lg:col-span-6 relative hero-fade-up" style={{ animationDelay: "120ms" }}>
            <div className="relative rounded-[2rem] overflow-hidden shadow-[0_30px_80px_-20px_rgba(15,60,40,0.35)] ring-1 ring-border/60 hero-float">
              <img src={heroAsset.url} alt="Modern poultry farm" width={1600} height={1200} className="w-full h-[420px] md:h-[560px] object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--forest)]/40 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex gap-3">
                <div className="flex-1 rounded-2xl bg-background/95 backdrop-blur px-4 py-3">
                  <div className="text-xs text-muted-foreground">Daily Records</div>
                  <div className="font-display text-lg font-semibold leading-tight">Eggs · Feed · Health</div>
                  <div className="text-[11px] text-[color:var(--forest)]">All in one place</div>
                </div>
                <div className="flex-1 rounded-2xl bg-background/95 backdrop-blur px-4 py-3">
                  <div className="text-xs text-muted-foreground">Farm View</div>
                  <div className="font-display text-lg font-semibold leading-tight">Every room</div>
                  <div className="text-[11px] text-muted-foreground">Performance at a glance</div>
                </div>
              </div>
            </div>
            <div className="absolute -top-6 -right-6 hidden md:block rounded-2xl bg-[color:var(--gold)] text-[color:var(--ink)] px-5 py-4 shadow-[var(--shadow-lift)] rotate-3">
              <div className="text-xs font-semibold uppercase tracking-wider">Practical &amp; Clear</div>
              <div className="font-display text-lg font-bold">Built for farmers</div>
            </div>
          </div>
        </div>
      </section>

      <section id="recognition" className="border-y border-border bg-card/60">
        <div className="container-x py-10 md:py-12">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <h2 className="font-display text-2xl md:text-3xl font-semibold leading-tight">
              Built in Nigeria. Recognised for Innovation.
            </h2>
            <p className="text-sm text-muted-foreground">
              Recognition earned through real farm work and public showcases.
            </p>
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recognition.map((r) => (
              <div key={r.title} className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--forest)]">
                  <r.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-snug">{r.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="container-x py-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--gold)] font-medium">Live Platform Snapshot</div>
              <div className="mt-1 text-sm text-primary-foreground/80 max-w-2xl">
                Aggregated in real time from every farm using PoultryPro — the same database that powers the dashboard.
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/70">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] animate-pulse" />
              Live • Automatically updated
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Users, label: "Registered farms", value: fmtStat(live?.registered_farms) },
              { icon: Bird, label: "Birds managed", value: fmtStat(live?.total_birds) },
              { icon: Egg, label: "Eggs recorded", value: fmtStat(live?.eggs) },
              { icon: LayoutDashboard, label: "Rooms managed", value: fmtStat(live?.rooms) },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[color:var(--gold)] text-[color:var(--ink)]">
                  <s.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="font-display text-2xl md:text-3xl font-semibold leading-none break-words">
                    {statsLoading || !live ? <StatSkeleton /> : s.value}
                  </div>
                  <div className="text-xs uppercase tracking-wider opacity-70 mt-1">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      <section id="architecture" className="py-24">
        <div className="container-x">
          <div className="max-w-2xl">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">How PoultryPro Works</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold leading-tight">
              From records to decisions in three simple steps.
            </h2>
            <p className="mt-5 text-muted-foreground text-lg">
              Capture what happens on your farm, understand what your data means, and get ahead of
              problems before they cost you money.
            </p>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-5">
            {architecture.map((a) => (
              <div key={a.title} className="relative rounded-3xl border border-border bg-card p-7 overflow-hidden">
                <div className="absolute top-0 right-0 h-24 w-24 rounded-bl-3xl bg-[color:var(--forest)]/5" />
                <div className="flex items-center justify-between">
                  <span className="font-display text-5xl font-semibold text-[color:var(--gold)]">{a.step}</span>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <a.icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-4 text-[11px] uppercase tracking-widest text-[color:var(--forest)] font-medium">{a.tag}</div>
                <h3 className="mt-1 font-display text-2xl font-semibold">{a.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      <section className="py-24">
        <div className="container-x grid lg:grid-cols-12 gap-14 items-start">
          <div className="lg:col-span-5">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">The Problem</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold leading-tight">
              Most poultry farms are flying blind.
            </h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              When records live in notebooks, spreadsheets and memory, it is impossible to see the full
              picture. Farmers miss early warning signs, struggle to control costs and leave money on the table.
            </p>
          </div>
          <div className="lg:col-span-7 space-y-3">
            {problems.map((p, i) => (
              <div key={p} className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 hover:border-[color:var(--gold)] transition">
                <span className="font-display text-3xl font-semibold text-[color:var(--gold)] w-10">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-base leading-relaxed pt-1">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-24 bg-secondary/40 border-y border-border">
        <div className="container-x">
          <div className="max-w-2xl">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">The Solution</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold leading-tight">
              One farm record. One clear truth.
            </h2>
            <p className="mt-5 text-muted-foreground text-lg">
              PoultryPro brings production, feed, health, mortality, bird age and financial data
              together so farmers can understand performance, control costs and make confident decisions.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div key={f.title} className="group min-w-0 rounded-2xl bg-card border border-border p-6 hover:shadow-[var(--shadow-lift)] hover:-translate-y-0.5 transition-all">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-grid h-11 w-11 flex-none place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
                    <f.icon className="h-5 w-5" />
                  </span>
                  {f.soon ? (
                    <span className="rounded-full bg-[color:var(--gold)]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[color:var(--ink)]">
                      Coming soon
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-widest text-[color:var(--forest)] font-medium">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      <section id="impact" className="py-24">
        <div className="container-x grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 order-2 lg:order-1">
            <img src={eggsImg} alt="Fresh eggs" width={1200} height={900} loading="lazy" className="rounded-3xl object-cover w-full h-[480px] shadow-[var(--shadow-lift)]" />
          </div>
          <div className="lg:col-span-6 order-1 lg:order-2 space-y-6">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">Live Platform Statistics</span>
            <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight">
              Real numbers from the PoultryPro platform.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Every metric below is pulled directly from the same database that powers the PoultryPro
              dashboard — updated automatically as farmers capture new records.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              {[
                { k: fmtStat(live?.registered_farms), v: "Registered farms" },
                { k: fmtStat(live?.registered_users), v: "Registered users" },
                { k: fmtStat(live?.total_birds), v: "Birds currently managed" },
                { k: fmtStat(live?.rooms), v: "Active rooms" },
                { k: fmtStat(live?.production_records), v: "Production records captured" },
                { k: fmtStat(live?.feed_records), v: "Feed records logged" },
                { k: fmtStat(live?.mortality_records), v: "Mortality records logged" },
                { k: fmtStat(live?.health_records), v: "Health records logged" },
                { k: fmtStat(live?.eggs), v: "Eggs recorded" },
                { k: fmtStat(live?.premium_farms), v: "Premium farms" },
                { k: fmtMoney(live?.revenue_tracked), v: "Revenue tracked" },
                { k: fmtMoney(live?.profit_analysed), v: "Profit analysed" },
              ].map((x) => (
                <div key={x.v} className="rounded-2xl border border-border bg-card p-5">
                  <div className="font-display text-2xl sm:text-3xl font-semibold text-[color:var(--forest)] break-words">
                    {statsLoading || !live ? <StatSkeleton className="w-20" /> : x.k}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{x.v}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--forest)] animate-pulse" />
              Live platform statistics • Automatically updated
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="py-24 bg-secondary/40 border-y border-border">
        <div className="container-x">
          <div className="max-w-2xl">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">The Product</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold leading-tight">
              Everything you need to run a data-driven farm.
            </h2>
            <p className="mt-5 text-muted-foreground text-lg">
              From daily farm records to intelligent alerts, PoultryPro gives farmers the visibility,
              analytics and tools they need to stay in control.
            </p>
          </div>

          <div className="mt-14 grid md:grid-cols-3 gap-5">
            {[
              {
                icon: LayoutDashboard,
                title: "Daily Farm Records",
                desc: "Replace scattered notebooks with one simple, organised record of eggs, feed, health and mortality.",
                preview: (
                  <div className="space-y-2">
                    {[
                      { l: "Egg production", v: "Today", tag: "Recorded" },
                      { l: "Feed usage", v: "3 bags", tag: "Recorded" },
                      { l: "Mortality", v: "0 birds", tag: "Recorded" },
                      { l: "Health check", v: "Vitamin", tag: "Logged" },
                    ].map((r) => (
                      <div key={r.l} className="flex items-center justify-between rounded-lg bg-background/70 border border-border px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--forest)]" />
                          <span className="font-medium">{r.l}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>{r.v}</span>
                          <span className="text-[10px] uppercase tracking-widest text-[color:var(--forest)]">{r.tag}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                icon: LineChart,
                title: "Farm Performance",
                desc: "See production, cost and profit trends at a glance — no spreadsheets or manual calculations required.",
                preview: (
                  <div>
                    <div className="flex items-end gap-1.5 h-24">
                      {[38, 52, 46, 60, 55, 68, 72, 66, 74, 80, 76, 82].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t bg-[color:var(--forest)]/80" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Egg production</span>
                      <span className="text-[color:var(--forest)] font-medium">Trending up</span>
                    </div>
                  </div>
                ),
              },
              {
                icon: Sparkles,
                title: "PoultryPro Intelligence",
                desc: "Identify unusual patterns, monitor farm risks and provide intelligent recommendations based on available farm data.",
                preview: (
                  <div className="space-y-2.5">
                    <div className="rounded-lg border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-widest text-[color:var(--forest)] font-medium">Pattern detected</div>
                      <div className="text-xs mt-1">Room 3 egg production is below its usual range.</div>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-widest text-[color:var(--forest)] font-medium">Suggested checks</div>
                      <div className="text-xs mt-1">Feed intake, water supply and any recent changes.</div>
                    </div>
                  </div>
                ),
              },
            ].map((c) => (
              <div key={c.title} className="rounded-3xl border border-border bg-card p-6 md:p-7 flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <c.icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-display text-xl font-semibold">{c.title}</h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
                <div className="mt-5 rounded-2xl bg-secondary/60 border border-border p-4">
                  {c.preview}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="operations" className="py-20 md:py-24">
        <div className="container-x">
          <div className="max-w-2xl">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">Built for different poultry operations</span>
            <h2 className="mt-4 font-display text-3xl md:text-5xl font-semibold leading-tight">
              One Platform. Different Poultry Operations.
            </h2>
            <p className="mt-5 text-muted-foreground text-lg">
              Whether you manage layers, broilers, Noilers or young birds, PoultryPro adapts to the way
              your farm operates.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {operations.map((o) => (
              <div key={o.title} className="min-w-0 rounded-3xl border border-border bg-card p-6 hover:border-[color:var(--gold)] transition-colors">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--forest)]/10 text-[color:var(--forest)]">
                  <o.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold uppercase tracking-wide">{o.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{o.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="weather" className="py-20 md:py-24 bg-secondary/40 border-y border-border">
        <div className="container-x grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-5">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">Farm Weather &amp; Bird Advisory</span>
            <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight">
              Weather that understands your birds.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              PoultryPro connects farm weather conditions with poultry-specific guidance, helping farmers
              understand how changing weather may affect flock comfort, production and farm management.
            </p>
            <ul className="grid sm:grid-cols-2 gap-2.5 pt-2">
              {weatherSignals.map((s) => (
                <li key={s} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-[color:var(--gold)]" />
                  <span className="text-muted-foreground">{s}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground pt-2">
              Advisory guidance only — live forecasts come from the farm's own registered location. If the
              weather service is unavailable, PoultryPro shows a clear fallback state instead of estimates.
            </p>
          </div>
          <div className="lg:col-span-6">
            <div className="rounded-[2rem] border border-border bg-card p-6 md:p-8">
              {[
                { k: "Weather", v: "Temperature, humidity, rainfall and wind for your farm location.", icon: CloudSun },
                { k: "Bird Risk", v: "Conditions interpreted into a poultry risk level for your flock and bird age.", icon: ShieldCheck },
                { k: "Farm Action", v: "Practical management steps such as ventilation, water and stocking checks.", icon: Sparkles },
              ].map((row, i, arr) => (
                <div key={row.k}>
                  <div className="flex items-start gap-4">
                    <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-[color:var(--forest)]/10 text-[color:var(--forest)]">
                      <row.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--forest)] font-semibold">{row.k}</div>
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{row.v}</p>
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="my-4 ml-5 h-6 w-px bg-[color:var(--gold)]/60" aria-hidden />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="alerts" className="py-20 md:py-24">
        <div className="container-x">
          <div className="max-w-2xl">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">Farm Alerts</span>
            <h2 className="mt-4 font-display text-3xl md:text-5xl font-semibold leading-tight">
              Know when your farm needs attention.
            </h2>
            <p className="mt-5 text-muted-foreground text-lg">
              PoultryPro helps farm owners identify important changes in production, mortality, feed usage,
              financial performance and other farm records.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {exampleAlerts.map((a) => (
              <div key={a.title} className="min-w-0 rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/5 p-5">
                <span className="text-[10px] uppercase tracking-widest text-[color:var(--forest)] font-semibold">Example</span>
                <h3 className="mt-2 font-display text-lg font-semibold">{a.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Illustrative examples only — real alerts are generated from your own farm records.
          </p>
        </div>
      </section>



      <section id="founder" className="overflow-x-clip py-24 bg-[color:var(--forest)] text-primary-foreground">
        <div className="container-x grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-4">
            <div className="relative">
              <img src={founderAsset.url} alt="Abubakar Sadiq Abbas" width={900} height={1100} loading="lazy" className="rounded-3xl object-cover object-top w-full h-[520px]" />
              <div className="absolute -bottom-5 right-2 sm:-right-5 bg-[color:var(--gold)] text-[color:var(--ink)] rounded-2xl px-5 py-3">
                <div className="text-[10px] uppercase tracking-widest">Founder</div>
                <div className="font-display text-lg font-semibold">Abubakar Sadiq Abbas</div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-8 space-y-6">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--gold)] font-medium">About the Founder</span>
            <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight">
              Abubakar Sadiq Abbas
            </h2>
            <p className="text-primary-foreground/70 uppercase text-xs tracking-widest">
              AgriTech Innovator · Project Manager · Agribusiness Specialist
            </p>
            <blockquote className="font-display text-2xl md:text-3xl italic leading-snug border-l-2 border-[color:var(--gold)] pl-6">
              "I built PoultryPro because farmers deserve technology that turns their daily work
              into smarter decisions and stronger businesses."
            </blockquote>
            <p className="text-primary-foreground/80 leading-relaxed max-w-2xl">
              PoultryPro was born from firsthand experience in poultry production and farm management,
              combined with a background in computer science and digital transformation.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 pt-4">
              {[
                { icon: Cpu, t: "MICT & B.Sc. Computer Science" },
                { icon: Wallet, t: "MBA — Business Administration" },
                { icon: Leaf, t: "Agribusiness & Digital Transformation" },
                { icon: MapPin, t: "Based in Katsina State, Nigeria" },
              ].map((x) => (
                <div key={x.t} className="flex items-center gap-3 text-sm">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
                    <x.icon className="h-4 w-4" />
                  </span>
                  {x.t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 bg-secondary/40 border-y border-border">
        <div className="container-x">
          <div className="max-w-3xl">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">Plans &amp; Subscriptions</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold leading-tight">
              A plan for every stage of your farm's growth.
            </h2>
            <p className="mt-5 text-muted-foreground text-lg">
              Start with essential record keeping, add business analytics as you grow, and unlock
              AI-powered decision support when you are ready to scale.
            </p>
          </div>

          {/* Capture → Understand → Predict rail */}
          <div className="mt-10 hidden md:flex items-center gap-4 text-xs uppercase tracking-[0.2em] font-medium">
            <span className="flex items-center gap-2 text-[color:var(--forest)]">
              <span className="h-2 w-2 rounded-full bg-[color:var(--forest)]" /> Capture
            </span>
            <span className="flex-1 h-px bg-gradient-to-r from-[color:var(--forest)] via-[color:var(--gold)] to-[color:var(--forest)]" />
            <span className="flex items-center gap-2 text-[color:var(--gold)]">
              <span className="h-2 w-2 rounded-full bg-[color:var(--gold)]" /> Understand
            </span>
            <span className="flex-1 h-px bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--forest)] to-[color:var(--forest)]" />
            <span className="flex items-center gap-2 text-[color:var(--forest)]">
              <span className="h-2 w-2 rounded-full bg-[color:var(--forest)]" /> Predict
            </span>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {tiers.map((t) => (
              <div
                key={t.name}
                className={`relative min-w-0 rounded-3xl border p-6 sm:p-8 flex flex-col ${
                  t.highlight
                    ? "bg-[color:var(--forest)] text-primary-foreground border-transparent shadow-[var(--shadow-lift)] md:-translate-y-3"
                    : "bg-card border-border"
                }`}
              >
                {t.badge && (
                  <span className={`absolute -top-3 right-4 sm:right-6 max-w-[70%] truncate rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${
                    t.highlight ? "bg-[color:var(--gold)] text-[color:var(--ink)]" : "bg-secondary text-secondary-foreground border border-border"
                  }`}>
                    {t.badge}
                  </span>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display text-4xl font-semibold text-[color:var(--gold)]">
                    {t.stageNum}
                  </span>
                  <span className={`text-[10px] uppercase tracking-widest font-semibold ${t.highlight ? "text-[color:var(--gold)]" : "text-[color:var(--forest)]"}`}>
                    {t.stage}
                  </span>
                </div>
                <div className={`mt-5 text-[11px] uppercase tracking-widest font-medium break-words ${t.highlight ? "text-[color:var(--gold)]" : "text-[color:var(--forest)]"}`}>
                  {t.tagline}
                </div>
                <h3 className="mt-1 font-display text-2xl sm:text-3xl font-semibold break-words">{t.name}</h3>

                <p className={`mt-3 text-sm italic ${t.highlight ? "text-primary-foreground/90" : "text-foreground"}`}>
                  "{t.promise}"
                </p>
                <p className={`mt-2 text-sm ${t.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {t.subtitle}
                </p>

                <div className={`mt-6 pt-5 border-t ${t.highlight ? "border-white/15" : "border-border"}`}>
                  <div className={`text-[10px] uppercase tracking-widest font-semibold mb-4 ${t.highlight ? "text-[color:var(--gold)]" : "text-muted-foreground"}`}>
                    What's included
                  </div>
                  <ul className="space-y-2.5 text-sm flex-1">
                    {t.points.map((p) => (
                      <li key={p} className="flex items-start gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] flex-none" />
                        <span className={t.highlight ? "text-primary-foreground/90" : "text-muted-foreground"}>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`mt-8 pt-6 border-t border-dashed ${t.highlight ? "border-white/15" : "border-border"}`}>
                  <div className="flex items-baseline gap-2">
                    <span className={`font-display text-3xl sm:text-4xl font-semibold ${t.highlight ? "text-[color:var(--gold)]" : "text-foreground"}`}>
                      {t.price}
                    </span>
                    <span className={`text-xs ${t.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {t.priceNote}
                    </span>
                  </div>
                  {t.ctaHref ? (
                    <a
                      href={t.ctaHref}
                      className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-center transition ${
                        t.highlight
                          ? "bg-[color:var(--gold)] text-[color:var(--ink)] hover:brightness-95"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {t.cta} <ArrowRight className="h-4 w-4 flex-none" />
                    </a>
                  ) : (
                    <Link
                      to="/auth"
                      search={{ mode: "signup" }}
                      className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-center transition ${
                        t.highlight
                          ? "bg-[color:var(--gold)] text-[color:var(--ink)] hover:brightness-95"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {t.cta} <ArrowRight className="h-4 w-4 flex-none" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Trust */}
          <div className="mt-12 rounded-3xl border border-border bg-card p-6 sm:p-8 text-center">
            <h3 className="font-display text-2xl font-semibold">Trusted by Poultry Farmers</h3>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              PoultryPro helps poultry farmers digitise farm records, monitor production, analyse
              profitability, and make better management decisions through one secure cloud platform.
            </p>
          </div>

          <p className="mt-6 text-xs sm:text-sm text-muted-foreground max-w-3xl">
            Premium AI features are currently being rolled out. All Basic and Standard features are
            fully available today.
          </p>

          {/* Final CTA */}
          <div className="mt-12 rounded-3xl bg-[color:var(--forest)] text-primary-foreground p-8 sm:p-12 text-center">
            <h3 className="font-display text-2xl sm:text-4xl font-semibold">Ready to Run Your Farm Smarter?</h3>
            <p className="mt-3 text-sm sm:text-base text-primary-foreground/80 max-w-2xl mx-auto">
              Join PoultryPro today and start recording your farm operations in minutes.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--gold)] px-6 py-3 text-sm font-semibold text-[color:var(--ink)] hover:brightness-95 transition"
              >
                Create Free Account <ArrowRight className="h-4 w-4 flex-none" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold hover:bg-white/10 transition"
              >
                View Features
              </a>
            </div>
          </div>

        </div>
      </section>


      <section id="roadmap" className="py-24 bg-[color:var(--cream)]/40">
        <div className="container-x">
          <div className="max-w-3xl">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">
              Step 11 · Product Roadmap
            </span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold leading-tight">
              Building Africa's Smart Poultry Platform
            </h2>
            <p className="mt-5 text-lg text-muted-foreground">
              PoultryPro is continuously evolving. Below are the capabilities available today
              and the innovations currently on our roadmap.
            </p>
          </div>

          {/* Available Today */}
          <div className="mt-16">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--forest)] text-primary-foreground px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] animate-pulse" />
                Available Today
              </span>
              <span className="text-sm text-muted-foreground">Shipping in production now</span>
            </div>
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {liveFeatures.map((f) => (
                <div
                  key={f.title}
                  className="group relative rounded-3xl border border-border bg-card p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                >
                  <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[color:var(--forest)]/5 blur-2xl group-hover:bg-[color:var(--forest)]/10 transition-colors" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-[color:var(--forest)]/10 text-[color:var(--forest)] flex items-center justify-center">
                      <f.icon className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--forest)]/10 text-[color:var(--forest)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
                      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--forest)] animate-pulse" />
                      Live
                    </span>
                  </div>
                  <h3 className="relative mt-5 font-display text-xl font-semibold">{f.title}</h3>
                  <p className="relative mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Coming Soon */}
          <div className="mt-20">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] text-[color:var(--ink)] px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
                <Sparkles className="h-3 w-3" />
                Coming Soon
              </span>
              <span className="text-sm text-muted-foreground">On the roadmap</span>
            </div>
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {comingSoon.map((f) => (
                <div
                  key={f.title}
                  className="group relative rounded-3xl border border-dashed border-[color:var(--gold)]/50 bg-card/60 p-6 hover:border-[color:var(--gold)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                >
                  <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[color:var(--gold)]/10 blur-2xl" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-[color:var(--gold)]/15 text-[color:var(--ink)] flex items-center justify-center">
                      <f.icon className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[color:var(--gold)]/20 text-[color:var(--ink)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
                      Coming Soon
                    </span>
                  </div>
                  <h3 className="relative mt-5 font-display text-xl font-semibold">{f.title}</h3>
                  <p className="relative mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Final Vision Card */}
          <div className="mt-20">
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[color:var(--forest)] via-[color:var(--forest)] to-[#0f3d2e] text-primary-foreground px-8 md:px-16 py-14 md:py-20">
              <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-[color:var(--gold)]/30 blur-3xl" />
              <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-[color:var(--gold)]/10 blur-3xl" />
              <div className="relative max-w-3xl">
                <Leaf className="h-9 w-9 text-[color:var(--gold)]" />
                <h3 className="mt-5 font-display text-3xl md:text-5xl font-semibold leading-[1.1]">
                  The Future of Poultry Farming Starts Here
                </h3>
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[color:var(--gold)]">
                  Long-term vision
                </p>
                <p className="mt-4 text-primary-foreground/80 text-base md:text-lg leading-relaxed">
                  PoultryPro is building toward Africa's smart poultry operating system — combining farm
                  records, analytics, artificial intelligence, predictive tools, automation and connected
                  farm technologies into one integrated platform.
                </p>
                <div className="mt-8">
                  <Link
                    to="/auth"
                    className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] text-[color:var(--ink)] px-7 py-4 font-semibold hover:brightness-95 transition"
                  >
                    Join the Future of Poultry Farming <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>



      <section id="contact" className="pb-24">
        <div className="container-x">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-[color:var(--forest)] text-primary-foreground px-8 md:px-16 py-16 md:py-24">
            <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-[color:var(--gold)]/30 blur-3xl" />
            <div className="relative grid lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-8 space-y-5">
                <Users className="h-8 w-8 text-[color:var(--gold)]" />
                <h2 className="font-display text-4xl md:text-6xl font-semibold leading-[1.05]">
                  Ready to transform your poultry farm?
                </h2>
                <p className="text-primary-foreground/75 text-lg max-w-2xl">
                  Join forward-thinking poultry farmers, farm managers and agribusinesses using
                  technology to make better decisions and build stronger, more profitable farms.
                </p>
              </div>
              <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 lg:justify-end lg:items-end">
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--gold)] text-[color:var(--ink)] px-7 py-4 font-semibold hover:brightness-95 transition"
                >
                  Create Free Account <ArrowRight className="h-4 w-4 flex-none" />
                </Link>
                <a
                  href="mailto:greenfieldcontractsagroltd@gmail.com?subject=PoultryPro%20Demo%20Request"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-7 py-4 font-semibold hover:bg-white/10 transition"
                >
                  Request a Demo
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
