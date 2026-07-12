import { createFileRoute, Link } from "@tanstack/react-router";
import heroAsset from "@/assets/hero-layer-birds.jpg.asset.json";
import founderAsset from "@/assets/founder-abubakar.jpg.asset.json";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";
import eggsImg from "@/assets/eggs.jpg";
import {
  Egg, Bird, LineChart, HeartPulse, Wheat, Wallet, LayoutDashboard,
  ShieldCheck, Sparkles, ArrowRight, MapPin, Trophy, Cpu, Users, Leaf,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

const stats = [
  { icon: Bird, label: "Birds Managed", value: "3,957" },
  { icon: Egg, label: "Eggs Recorded", value: "93,521+" },
  { icon: Wheat, label: "Crates Tracked", value: "3,074+" },
  { icon: Wallet, label: "Revenue Tracked", value: "₦15M+" },
];

const architecture = [
  {
    step: "01",
    title: "Capture",
    tag: "Farm Records",
    desc: "Digitise daily poultry activities and convert scattered notebooks into structured operational data — production, feed, health, mortality and prices.",
    icon: LayoutDashboard,
  },
  {
    step: "02",
    title: "Understand",
    tag: "Farm Analytics",
    desc: "Turn captured records into production analytics, financial intelligence, performance trends and management insights that explain what happened.",
    icon: LineChart,
  },
  {
    step: "03",
    title: "Predict",
    tag: "PoultryPro AI Intelligence",
    desc: "Progressively apply AI to spot abnormal patterns, forecast production, monitor operational risk and support earlier, evidence-based decisions.",
    icon: Sparkles,
  },
];

const features = [
  { icon: LayoutDashboard, title: "Interactive Dashboard", desc: "Real-time visibility into birds, eggs, feed, mortality, revenue and profitability.", tier: "Capture + Understand" },
  { icon: Egg, title: "Production Management", desc: "Track daily egg production, crates and extras across every room and flock.", tier: "Capture" },
  { icon: Wheat, title: "Feed Management", desc: "Monitor daily feed usage, cost tracking and efficiency formulas.", tier: "Capture + Understand" },
  { icon: HeartPulse, title: "Health Records", desc: "Log vaccinations, medications, vitamin schedules and health observations.", tier: "Capture" },
  { icon: LineChart, title: "Financial Analytics", desc: "Daily and monthly profitability, revenue trends and production economics.", tier: "Understand" },
  { icon: ShieldCheck, title: "Mortality Tracking", desc: "Room-based mortality logging, loss analysis and historical records.", tier: "Capture + Understand" },
];

const tiers = [
  {
    name: "Basic",
    tagline: "Farm Records",
    promise: "Capture what happened.",
    points: ["Daily production, feed, health & mortality records", "Room and flock management", "Current prices & simple revenue tracking"],
    highlight: false,
  },
  {
    name: "Standard",
    tagline: "Farm Analytics",
    promise: "Understand what happened.",
    points: ["Everything in Basic", "Production & financial analytics", "Performance trends and management insights", "Profitability & feed-efficiency dashboards"],
    highlight: true,
  },
  {
    name: "Premium",
    tagline: "PoultryPro AI Intelligence",
    promise: "Predict what may happen next.",
    points: ["Everything in Standard", "AI-assisted abnormal pattern detection", "Production forecasting & risk monitoring", "Decision-support intelligence (progressively rolling out)"],
    highlight: false,
  },
];


const problems = [
  "Critical farm data lost in notebooks and scattered records",
  "Decisions made without real-time operational visibility",
  "Feed — the largest cost — poorly monitored",
  "Profitability and performance trends invisible",
  "Health and mortality events under-documented",
];

const timeline = [
  { phase: "Available Today", items: ["Farm Records — production, feed, health, mortality", "Farm Analytics — profitability & performance dashboards", "Interactive dashboard across every room and flock"] },
  { phase: "Rolling Out (Premium AI)", items: ["Abnormal production & mortality pattern detection", "Feed-efficiency and cost-anomaly monitoring", "Production forecasting & decision-support alerts"] },
  { phase: "Long-Term Vision", items: ["Mobile app for iOS & Android + farmer onboarding", "Farmer marketplace & partner ecosystem", "Africa's leading AI poultry ecosystem by 2030"] },
];

function Index() {
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
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <a href="#architecture" className="text-muted-foreground hover:text-foreground transition">Architecture</a>
            <a href="#features" className="text-muted-foreground hover:text-foreground transition">Features</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition">Pricing</a>
            <a href="#founder" className="text-muted-foreground hover:text-foreground transition">Founder</a>
            <a href="#roadmap" className="text-muted-foreground hover:text-foreground transition">Roadmap</a>
          </nav>
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
            View Dashboard <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <section id="top" className="relative overflow-hidden">
        <div className="container-x pt-14 pb-20 md:pt-24 md:pb-32 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-secondary-foreground">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" />
              Capture · Understand · Predict
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[1.02] tracking-tight">
              Smart poultry farm <em className="italic text-[color:var(--forest)]">management &amp; intelligence.</em>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              PoultryPro digitises daily farm activities, converts records into production and financial
              intelligence, and progressively applies AI to forecast production and flag operational risk —
              turning everyday operations into evidence-based decisions.
            </p>

            <div className="flex flex-wrap gap-3">
              <a href="#features" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition shadow-[var(--shadow-lift)]">
                Explore the platform <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#founder" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium hover:bg-secondary transition">
                Meet the founder
              </a>
            </div>
            <div className="flex items-center gap-3 pt-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4 text-[color:var(--gold)]" />
              Winner — Airtel-sponsored 3MTT × NextGen Knowledge Showcase
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-[var(--shadow-lift)] ring-1 ring-border">
              <img src={heroAsset.url} alt="Modern poultry farm" width={1600} height={1200} className="w-full h-[520px] object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--forest)]/40 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex gap-3">
                <div className="flex-1 rounded-2xl bg-background/95 backdrop-blur px-4 py-3">
                  <div className="text-xs text-muted-foreground">Today's Eggs</div>
                  <div className="font-display text-2xl font-semibold">3,159</div>
                  <div className="text-[11px] text-[color:var(--forest)]">104 crates · +0.4%</div>
                </div>
                <div className="flex-1 rounded-2xl bg-background/95 backdrop-blur px-4 py-3">
                  <div className="text-xs text-muted-foreground">Active Rooms</div>
                  <div className="font-display text-2xl font-semibold">3</div>
                  <div className="text-[11px] text-muted-foreground">3,957 birds</div>
                </div>
              </div>
            </div>
            <div className="absolute -top-6 -right-6 hidden md:block rounded-2xl bg-[color:var(--gold)] text-[color:var(--ink)] px-5 py-4 shadow-[var(--shadow-lift)] rotate-3">
              <div className="text-xs font-medium uppercase tracking-wider">Profit Analysed</div>
              <div className="font-display text-2xl font-bold">₦8.01M+</div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="container-x py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
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
      </section>

      <section id="architecture" className="py-24">
        <div className="container-x">
          <div className="max-w-2xl">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">Product Architecture</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold leading-tight">
              Three progressive levels of farm intelligence.
            </h2>
            <p className="mt-5 text-muted-foreground text-lg">
              PoultryPro is built as a journey: Record Management → Business Intelligence → Predictive Intelligence.
              Each level unlocks the next.
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
              Africa's poultry industry runs on notebooks.
            </h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              Poultry contributes 6–8% of Nigeria's GDP and over 25% of agricultural GDP — yet most farms
              still operate manually, losing profit to invisible inefficiencies every single day.
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
              One intelligent platform. Every farm decision.
            </h2>
            <p className="mt-5 text-muted-foreground text-lg">
              From feed to finance, PoultryPro brings the operating discipline of a modern
              enterprise to poultry farms of every size.
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
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">Validated Impact</span>
            <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight">
              Proven with real operational data.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Tested across a working commercial farm — PoultryPro has tracked thousands of birds,
              analysed tens of thousands of eggs, and turned everyday activity into measurable profit.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              {[
                { k: "3", v: "Active production rooms" },
                { k: "19", v: "Bags of feed monitored daily" },
                { k: "₦15M+", v: "Revenue tracked" },
                { k: "₦8M+", v: "Profit analysed" },
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
              AgriTech Innovator · Project Manager · Agribusiness Manager
            </p>
            <blockquote className="font-display text-2xl md:text-3xl italic leading-snug border-l-2 border-[color:var(--gold)] pl-6">
              "Farmers deserve intelligent tools that transform data into decisions,
              and decisions into profitability."
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
          <div className="max-w-2xl">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--forest)] font-medium">Subscription Plans</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold leading-tight">
              Grow from records to intelligence.
            </h2>
            <p className="mt-5 text-muted-foreground text-lg">
              Every plan builds on the last — start with structured records, unlock analytics,
              and progressively adopt PoultryPro AI Intelligence as it rolls out.
            </p>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-5">
            {tiers.map((t) => (
              <div key={t.name} className={`rounded-3xl border p-7 flex flex-col ${t.highlight ? "bg-[color:var(--forest)] text-primary-foreground border-transparent shadow-[var(--shadow-lift)]" : "bg-card border-border"}`}>
                <div className={`text-[11px] uppercase tracking-widest font-medium ${t.highlight ? "text-[color:var(--gold)]" : "text-[color:var(--forest)]"}`}>{t.tagline}</div>
                <h3 className="mt-1 font-display text-3xl font-semibold">{t.name}</h3>
                <p className={`mt-2 text-sm ${t.highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{t.promise}</p>
                <ul className="mt-6 space-y-3 text-sm flex-1">
                  {t.points.map((p) => (
                    <li key={p} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] flex-none" />
                      <span className={t.highlight ? "text-primary-foreground/90" : "text-muted-foreground"}>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-8 text-xs text-muted-foreground">
            Farm Records and Farm Analytics are working platform capabilities today. PoultryPro AI
            Intelligence features are progressively rolling out and are clearly labelled inside the product.
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

      <footer className="border-t border-border py-10">
        <div className="container-x flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logoAsset.url} alt="PoultryPro" width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="font-display font-semibold text-foreground">PoultryPro™</span>
            <span>· Katsina State, Nigeria</span>
          </div>
          <div>© {new Date().getFullYear()} Abubakar Sadiq Abbas · ABZ Global Resource</div>
        </div>
      </footer>
    </div>
  );
}
