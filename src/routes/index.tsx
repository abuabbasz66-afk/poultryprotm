import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import heroAsset from "@/assets/hero-layer-birds.jpg.asset.json";
import founderAsset from "@/assets/founder-abubakar.jpg.asset.json";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";
import eggsImg from "@/assets/eggs.jpg";
import {
  Egg, Bird, LineChart, HeartPulse, Wheat, Wallet, LayoutDashboard,
  ShieldCheck, Sparkles, ArrowRight, MapPin, Trophy, Cpu, Users, Leaf,
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/")({
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


function formatCount(n: number): string {
  if (!n || n <= 0) return "0";
  if (n >= 1000) return `${n.toLocaleString("en-US")}+`;
  return n.toLocaleString("en-US");
}

function formatNaira(n: number): string {
  if (!n || n <= 0) return "₦0";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `₦${m >= 10 ? Math.round(m) : m.toFixed(1)}M+`;
  }
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}K+`;
  return `₦${Math.round(n).toLocaleString("en-US")}`;
}

function usePlatformStats() {
  const [s, setS] = useState<{ birds: number; eggs: number; crates: number; revenue: number }>({
    birds: 0, eggs: 0, crates: 0, revenue: 0,
  });
  useEffect(() => {
    let mounted = true;
    supabase.rpc("platform_stats").then(({ data, error }) => {
      if (!mounted || error || !data || !(data as unknown[])[0]) return;
      const row = (data as Array<{ birds: number | string; eggs: number | string; crates: number | string; revenue: number | string }>)[0];
      setS({
        birds: Number(row.birds) || 0,
        eggs: Number(row.eggs) || 0,
        crates: Number(row.crates) || 0,
        revenue: Number(row.revenue) || 0,
      });
    });
    return () => { mounted = false; };
  }, []);
  return s;
}

const architecture = [
  {
    step: "01",
    title: "Capture",
    tag: "Farm Records",
    desc: "Record eggs, feed, health, mortality and costs in one organised place — so nothing gets lost and every decision is based on facts.",
    icon: LayoutDashboard,
  },
  {
    step: "02",
    title: "Understand",
    tag: "Farm Analytics",
    desc: "Turn daily records into clear production, cost and profit views that show exactly how your farm is performing.",
    icon: LineChart,
  },
  {
    step: "03",
    title: "Predict",
    tag: "PoultryPro AI",
    desc: "Detect unusual trends, spot hidden risks earlier and make proactive decisions before small issues become costly problems.",
    icon: Sparkles,
  },
];

const features = [
  { icon: LayoutDashboard, title: "Interactive Dashboard", desc: "Monitor birds, eggs, feed, mortality and revenue from one clear view — no more digging through notebooks.", tier: "Capture + Understand" },
  { icon: Egg, title: "Production Management", desc: "Track daily egg output by room and flock so you know exactly which groups are performing best.", tier: "Capture" },
  { icon: Wheat, title: "Feed Management", desc: "Monitor feed usage and costs in real time to protect your biggest farm expense and improve efficiency.", tier: "Capture + Understand" },
  { icon: HeartPulse, title: "Health Records", desc: "Keep complete vaccination, medication and health histories to support better flock care and compliance.", tier: "Capture" },
  { icon: LineChart, title: "Financial Analytics", desc: "See daily and monthly profitability, revenue trends and where your money is really going.", tier: "Understand" },
  { icon: ShieldCheck, title: "Mortality Tracking", desc: "Log and analyse bird losses by room to identify issues faster and protect your investment.", tier: "Capture + Understand" },
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
    cta: "Join the Pilot",
    ctaHref: "mailto:contact@poultrypro.africa?subject=PoultryPro%20Basic%20Pilot",
    badge: null as string | null,
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
    cta: "Request Standard Access",
    ctaHref: "mailto:contact@poultrypro.africa?subject=PoultryPro%20Standard%20Access",
    badge: "Most Popular",
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
    cta: "Coming Soon — Join Waitlist",
    ctaHref: "mailto:contact@poultrypro.africa?subject=PoultryPro%20AI%20Intelligence%20Waitlist",
    badge: "Progressive Rollout",
    highlight: false,
  },
];



const problems = [
  "Important records get lost in notebooks or scattered across different places.",
  "Farmers cannot quickly see how birds, eggs and costs are really performing.",
  "Feed — your largest expense — is hard to track and even harder to optimise.",
  "Profitability problems often go unnoticed until it is too late to fix them.",
  "Health and mortality records are incomplete, making early intervention harder.",
];

const timeline = [
  { phase: "Available Today", items: ["Digital farm records — eggs, feed, health and mortality", "Farm analytics — production, cost and profit views", "Clean dashboard for every room and flock"] },
  { phase: "Rolling Out (Premium AI)", items: ["Early detection when egg production changes unusually", "Mortality trend monitoring and alerts", "Feed efficiency and cost pattern checks"] },
  { phase: "Long-Term Vision", items: ["Mobile apps for iOS and Android", "Farmer marketplace and partner integrations", "Africa's leading smart poultry platform"] },
];

function Index() {
  const authed = useAuthed();
  const platform = usePlatformStats();
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
            <a href="#architecture" className="text-muted-foreground hover:text-foreground transition-colors duration-200">Architecture</a>
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
              Run a smarter, more profitable poultry farm with confidence.
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-[600px] leading-relaxed font-normal">
              PoultryPro™ turns everyday farm records into clear insights and AI-powered recommendations,
              helping you reduce guesswork, cut waste and make better business decisions every day.
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

      <section className="bg-primary text-primary-foreground">
        <div className="container-x py-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--gold)] font-medium">Pilot Farm Results</div>
              <div className="mt-1 text-sm text-primary-foreground/80 max-w-2xl">
                Real operational data from a working commercial poultry farm during PoultryPro's pilot deployment.
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Bird, label: "Birds monitored", value: formatCount(platform.birds) },
              { icon: Egg, label: "Eggs recorded", value: formatCount(platform.eggs) },
              { icon: Wheat, label: "Crates recorded", value: formatCount(platform.crates) },
              { icon: Wallet, label: "Revenue recorded", value: formatNaira(platform.revenue) },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[color:var(--gold)] text-[color:var(--ink)]">
                  <s.icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-display text-2xl md:text-3xl font-semibold leading-none">{s.value}</div>
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
              PoultryPro brings your production, feed, health, mortality and financial data together so
              you can understand performance, control costs and make confident decisions.
            </p>
          </div>

          <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl bg-card border border-border p-7 hover:shadow-[var(--shadow-lift)] hover:-translate-y-0.5 transition-all">
                <div className="flex items-center justify-between">
                  <span className="inline-grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-[color:var(--forest)] font-medium">{f.tier}</span>
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
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">Pilot Farm Results</span>
            <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight">
              Built and tested on a real commercial farm.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              PoultryPro was developed alongside working poultry operations to solve practical, everyday
              challenges — not theoretical ones.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              {[
                { k: "3", v: "Active production rooms" },
                { k: "19", v: "Bags of feed tracked daily" },
                { k: "₦15M+", v: "Revenue recorded" },
                { k: "₦8M+", v: "Farm profit analysed" },
              ].map((x) => (
                <div key={x.v} className="rounded-2xl border border-border bg-card p-5">
                  <div className="font-display text-3xl font-semibold text-[color:var(--forest)]">{x.k}</div>
                  <div className="text-xs text-muted-foreground mt-1">{x.v}</div>
                </div>
              ))}
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
              From daily record keeping to intelligent alerts, PoultryPro gives you the visibility and
              insights to stay in control.
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
                title: "PoultryPro Prediction",
                desc: "Detect unusual patterns, identify risks earlier and make proactive decisions with AI-supported insights.",
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

      <section id="founder" className="py-24 bg-[color:var(--forest)] text-primary-foreground">
        <div className="container-x grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-4">
            <div className="relative">
              <img src={founderAsset.url} alt="Abubakar Sadiq Abbas" width={900} height={1100} loading="lazy" className="rounded-3xl object-cover object-top w-full h-[520px]" />
              <div className="absolute -bottom-5 -right-5 bg-[color:var(--gold)] text-[color:var(--ink)] rounded-2xl px-5 py-3">
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

          <div className="mt-8 grid md:grid-cols-3 gap-6 items-stretch">
            {tiers.map((t) => (
              <div
                key={t.name}
                className={`relative rounded-3xl border p-8 flex flex-col ${
                  t.highlight
                    ? "bg-[color:var(--forest)] text-primary-foreground border-transparent shadow-[var(--shadow-lift)] md:-translate-y-3"
                    : "bg-card border-border"
                }`}
              >
                {t.badge && (
                  <span className={`absolute -top-3 right-6 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${
                    t.highlight ? "bg-[color:var(--gold)] text-[color:var(--ink)]" : "bg-secondary text-secondary-foreground border border-border"
                  }`}>
                    {t.badge}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <span className={`font-display text-4xl font-semibold ${t.highlight ? "text-[color:var(--gold)]" : "text-[color:var(--gold)]"}`}>
                    {t.stageNum}
                  </span>
                  <span className={`text-[10px] uppercase tracking-widest font-semibold ${t.highlight ? "text-[color:var(--gold)]" : "text-[color:var(--forest)]"}`}>
                    {t.stage}
                  </span>
                </div>
                <div className={`mt-5 text-[11px] uppercase tracking-widest font-medium ${t.highlight ? "text-[color:var(--gold)]" : "text-[color:var(--forest)]"}`}>
                  {t.tagline}
                </div>
                <h3 className="mt-1 font-display text-3xl font-semibold">{t.name}</h3>
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
                  <div className={`text-xs mb-3 ${t.highlight ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    Pricing to be announced
                  </div>
                  <a
                    href={t.ctaHref}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition ${
                      t.highlight
                        ? "bg-[color:var(--gold)] text-[color:var(--ink)] hover:brightness-95"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {t.cta} <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-xs text-muted-foreground max-w-3xl">
            Basic (Farm Records) and Standard (Farm Analytics) are working platform capabilities today.
            Premium (PoultryPro AI Intelligence) features are being rolled out progressively and are
            clearly labelled inside the product — we never present unfinished capabilities as fully deployed.
          </p>
        </div>
      </section>


      <section id="roadmap" className="py-24">

        <div className="container-x">
          <div className="max-w-2xl">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">Future Roadmap</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold leading-tight">
              Toward Africa's AI-powered poultry ecosystem.
            </h2>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-5">
            {timeline.map((t, i) => (
              <div key={t.phase} className="rounded-3xl border border-border bg-card p-7 relative overflow-hidden">
                <div className="absolute top-0 right-0 h-20 w-20 rounded-bl-3xl bg-[color:var(--gold)]/20" />
                <div className="text-xs uppercase tracking-widest text-[color:var(--forest)] font-medium">Phase 0{i + 1}</div>
                <h3 className="mt-2 font-display text-2xl font-semibold">{t.phase}</h3>
                <ul className="mt-5 space-y-3">
                  {t.items.map((it) => (
                    <li key={it} className="flex items-start gap-3 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] flex-none" />
                      <span className="text-muted-foreground">{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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
                  Build the future of smart poultry farming with us.
                </h2>
                <p className="text-primary-foreground/75 text-lg max-w-2xl">
                  We're inviting investors, agricultural institutions, innovation hubs and government
                  partners to scale PoultryPro across Africa.
                </p>
              </div>
              <div className="lg:col-span-4 flex lg:justify-end">
                <a href="mailto:contact@poultrypro.africa" className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] text-[color:var(--ink)] px-7 py-4 font-medium hover:brightness-95 transition">
                  Start a conversation <ArrowRight className="h-4 w-4" />
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
