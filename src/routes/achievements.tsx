import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, Award, Bird, Egg, FileText, Handshake, LayoutDashboard, Medal, Newspaper,
  Trophy, Users, Star, RefreshCw,
} from "lucide-react";
import heroAsset from "@/assets/hero-layer-birds.jpg.asset.json";
import founderAsset from "@/assets/founder-abubakar.jpg.asset.json";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";
import { SiteFooter } from "@/components/site-footer";
import { InternationalRecognitionSection } from "@/components/recognition/international-recognition";
import { useLivePlatformStats } from "@/lib/platform-stats";

const TITLE = "Achievements & Recognition | PoultryPro";
const DESC =
  "PoultryPro's journey: awards, competition milestones, media coverage, industry engagement and live platform progress — built in Nigeria, recognised for innovation.";

export const Route = createFileRoute("/achievements")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://poultrypro.life/achievements" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://poultrypro.life/achievements" }],
  }),
  component: AchievementsPage,
});

// Verified facts only. Add `date` / `url` fields only when officially confirmed.
const AWARDS = [
  { icon: Trophy, name: "Airtel-Sponsored 3MTT NextGen Knowledge Showcase", recognition: "Katsina State Winner", desc: "Recognised as Katsina State winner for presenting PoultryPro as a practical digital solution for poultry-farm management." },
  { icon: Medal, name: "NXTGEN National Innovation Challenge", recognition: "Finalist, Abuja", desc: "Selected among the national finalists in Abuja for PoultryPro's farm-management innovation." },
  { icon: Award, name: "NXTGEN Innovation Challenge — International Grand Finale", recognition: "Finalist and awarded — London, United Kingdom", desc: "Reached the Grand Finale at ExCeL London as a finalist, where the founder received Grand Finale recognition." },
  { icon: Star, name: "3MTT Fellow of the Week", recognition: "Fellow of the Week", desc: "Highlighted by the 3MTT programme for the work behind PoultryPro." },
];

type Media = { outlet: string; desc: string; url?: string };
// Article URLs not yet supplied — cards show no link until a verified URL is added.
const MEDIA: Media[] = [
  { outlet: "Daily Trust", desc: "Featured in Agriculture." },
  { outlet: "Legit News", desc: "Featured in Technology and Agriculture." },
  { outlet: "Katsina Post", desc: "Article recognising the PoultryPro innovation." },
  { outlet: "African Farmers Voice Magazine", desc: "Print recognition." },
];

// Order is thematic; dates are shown only where verified.
const JOURNEY: { title: string; date?: string }[] = [
  { title: "PoultryPro developed from practical poultry-farm management experience." },
  { title: "The platform launched and began serving real users." },
  { title: "Katsina State recognition through the Airtel-sponsored 3MTT NextGen Knowledge Showcase." },
  { title: "Selection as an NXTGEN National Innovation Challenge finalist in Abuja." },
  { title: "Finalist and awarded at the NXTGEN International Grand Finale in London.", date: "9 October 2026" },
  { title: "Continued development of the platform for poultry farmers." },
];

const btnPrimary =
  "inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors";
const btnGhost =
  "inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-secondary transition-colors";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--forest)]">{children}</span>;
}

function PlatformStats() {
  const { data, isPending, isError, refetch } = useLivePlatformStats();
  const items = [
    { icon: Users, label: "Registered farms", v: data?.registered_farms },
    { icon: Users, label: "Registered users", v: data?.registered_users },
    { icon: Bird, label: "Birds managed", v: data?.total_birds },
    { icon: Egg, label: "Eggs recorded", v: data?.eggs },
    { icon: LayoutDashboard, label: "Rooms managed", v: data?.rooms },
  ];
  if (isError && !data) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6 text-sm">
        Live statistics are unavailable right now.
        <button type="button" onClick={() => refetch()} className={btnGhost}>
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {items.map((s) => (
        <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
          <s.icon className="h-5 w-5 text-[color:var(--forest)]" />
          <div className="mt-3 font-display text-3xl font-semibold leading-none">
            {isPending ? (
              <span role="status" aria-label="Loading" className="inline-block h-7 w-20 animate-pulse rounded-md bg-muted" />
            ) : s.v ? (
              s.v.toLocaleString("en-US")
            ) : (
              <span className="text-base text-muted-foreground">No data yet</span>
            )}
          </div>
          <div className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function AchievementsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="container-x flex h-16 items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoAsset.url} alt="PoultryPro home" width={40} height={40} className="h-9 w-9 object-contain" />
            <span className="font-display text-lg font-semibold tracking-tight">PoultryPro<sup className="text-[10px] text-muted-foreground">™</sup></span>
          </Link>
          <nav className="flex items-center gap-2 text-sm font-medium">
            <Link to="/" className="hidden sm:inline-flex px-3 py-2 text-muted-foreground hover:text-foreground">Home</Link>
            <Link to="/auth" search={{ mode: "signup" }} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90">
              Create Farm Account
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* A: Hero */}
        <section className="relative overflow-hidden">
          <div className="container-x grid items-center gap-10 py-16 md:py-24 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-6 hero-fade-up">
              <Eyebrow>Achievements &amp; Recognition</Eyebrow>
              <h1 className="font-display text-4xl md:text-6xl font-semibold leading-[1.05]">
                Built in Nigeria. Recognised for Innovation.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
                PoultryPro is building practical digital tools to help poultry farmers manage their operations, understand their data, and make better decisions. Explore the milestones, recognition, and progress behind our journey.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/" className={btnPrimary}>Explore PoultryPro <ArrowRight className="h-4 w-4" /></Link>
                <Link to="/auth" search={{ mode: "signup" }} className={btnGhost}>Create a Farm Account</Link>
              </div>
            </div>
            <div className="lg:col-span-6">
              <img
                src={heroAsset.url}
                alt="Laying hens in a modern poultry house"
                width={1600}
                height={1200}
                fetchPriority="high"
                className="h-[280px] w-full rounded-[2rem] object-cover ring-1 ring-border shadow-[var(--shadow-lift)] md:h-[460px]"
              />
            </div>
          </div>
        </section>

        {/* B: Awards */}
        <section aria-labelledby="awards" className="border-y border-border bg-card/60 py-16 md:py-24">
          <div className="container-x">
            <Eyebrow>Awards &amp; competitions</Eyebrow>
            <h2 id="awards" className="mt-2 font-display text-3xl md:text-4xl font-semibold">Milestones on the innovation stage</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {AWARDS.map((a) => (
                <article key={a.name} className="flex gap-4 rounded-2xl border border-border bg-background p-6 transition-shadow hover:shadow-[var(--shadow-lift)]">
                  <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--forest)]">
                    <a.icon className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold leading-snug">{a.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--forest)]">{a.recognition}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <InternationalRecognitionSection />

        {/* C: Media */}
        <section aria-labelledby="media" className="py-16 md:py-24">
          <div className="container-x">
            <Eyebrow>Media recognition</Eyebrow>
            <h2 id="media" className="mt-2 font-display text-3xl md:text-4xl font-semibold">Our Story Is Reaching More People</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {MEDIA.map((m) => (
                <article key={m.outlet} className="flex flex-col rounded-2xl border border-border bg-card p-6">
                  <Newspaper className="h-6 w-6 text-[color:var(--forest)]" />
                  <h3 className="mt-4 font-display text-xl font-semibold">{m.outlet}</h3>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{m.desc}</p>
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--forest)] hover:underline">
                      Read the story <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* D: Industry */}
        <section aria-labelledby="industry" className="bg-secondary/40 border-y border-border py-16 md:py-24">
          <div className="container-x grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <Eyebrow>Industry engagement</Eyebrow>
              <h2 id="industry" className="mt-2 font-display text-3xl md:text-4xl font-semibold">Connecting Innovation with the Poultry Industry</h2>
            </div>
            <div className="flex gap-4 rounded-2xl border border-border bg-background p-6 lg:col-span-7">
              <Handshake className="h-7 w-7 flex-none text-[color:var(--forest)]" />
              <div>
                <h3 className="font-display text-xl font-semibold">Presentation to the Poultry Association of Nigeria, Katsina Chapter</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  PoultryPro was presented to poultry farmers and stakeholders of the Katsina Chapter. The platform is designed around the practical challenges of poultry-farm operations — daily records, feed, health, mortality and costs — and the move from paper notebooks to digital record management.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* E: Platform growth */}
        <section aria-labelledby="growth" className="py-16 md:py-24">
          <div className="container-x">
            <Eyebrow>Platform growth · live</Eyebrow>
            <h2 id="growth" className="mt-2 font-display text-3xl md:text-4xl font-semibold">Progress Built Through Real Farm Use</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Live totals across all farms using PoultryPro. Aggregated counts only — no farm names or individual records.
            </p>
            <div className="mt-8"><PlatformStats /></div>
            <p className="mt-8 max-w-3xl border-l-2 border-primary pl-5 font-display text-xl">
              We measure progress not only by recognition, but by the practical value PoultryPro delivers to poultry-farm operations.
            </p>
          </div>
        </section>

        {/* F: Journey */}
        <section aria-labelledby="journey" className="border-y border-border bg-card/60 py-16 md:py-24">
          <div className="container-x max-w-3xl">
            <Eyebrow>The journey</Eyebrow>
            <h2 id="journey" className="mt-2 font-display text-3xl md:text-4xl font-semibold">From farm experience to a growing platform</h2>
            <ol className="mt-10 space-y-6 border-l-2 border-primary/30 pl-6">
              {JOURNEY.map((j) => (
                <li key={j.title} className="relative">
                  <span aria-hidden className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                  {j.date && <div className="text-xs font-semibold uppercase tracking-widest text-[color:var(--forest)]">{j.date}</div>}
                  <p className="leading-relaxed">{j.title}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* G: Founder */}
        <section aria-labelledby="founder" className="bg-[color:var(--forest)] py-16 text-primary-foreground md:py-24">
          <div className="container-x grid items-center gap-10 lg:grid-cols-12">
            <img
              src={founderAsset.url}
              alt="Abubakar Sadiq Abbas, founder of PoultryPro"
              width={900}
              height={1100}
              loading="lazy"
              className="mx-auto h-[380px] w-full max-w-sm rounded-3xl object-cover object-top lg:col-span-4"
            />
            <div className="space-y-5 lg:col-span-8">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--gold)]">Founder</span>
              <h2 id="founder" className="font-display text-3xl md:text-5xl font-semibold">Abubakar Sadiq Abbas</h2>
              <p className="max-w-2xl leading-relaxed opacity-85">
                PoultryPro grew from years of hands-on poultry production and farm management, combined with a background in computer science and digital transformation. Seeing how much value was lost in paper records, Abubakar built a platform that turns everyday farm work into clear, practical decisions.
              </p>
              <Link to="/" hash="founder" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--gold)] hover:underline">
                Read the full founder profile <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* H: CTA */}
        <section className="py-20 md:py-28">
          <div className="container-x max-w-3xl text-center">
            <FileText aria-hidden className="mx-auto h-8 w-8 text-[color:var(--forest)]" />
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold">The Journey Continues.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              We are building PoultryPro to help more poultry farmers organise their records, understand farm performance, and make more informed decisions.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/auth" search={{ mode: "signup" }} className={btnPrimary}>Create a Farm Account <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/" hash="features" className={btnGhost}>Explore the Platform</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
