import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { PRICING_PLANS } from "@/lib/pricing-plans";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — PoultryPro™" },
      { name: "description", content: "PoultryPro subscription plans for small, commercial and enterprise poultry farms. Pricing announced soon." },
      { property: "og:title", content: "Pricing — PoultryPro™" },
      { property: "og:description", content: "PoultryPro subscription plans for poultry farms of every size." },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="container-x flex items-center justify-between py-4">
          <Link to="/" className="font-bold tracking-tight">PoultryPro™</Link>
          <div className="flex items-center gap-2">
            <Link to="/auth" search={{ mode: "signin" }} className="hidden sm:inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary">Sign in</Link>
            <Link to="/auth" search={{ mode: "signup" }} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container-x py-14 sm:py-20 text-center">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)] font-semibold">Pricing</div>
          <h1 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight">Simple plans for every farm size</h1>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your poultry operation. Every new farm starts with a 30-day Premium trial.
          </p>
        </section>


        <section className="container-x pb-16">
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--gold)]/15 text-[color:var(--gold)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em]">
              30-day free Premium trial
            </span>
          </div>


          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PRICING_PLANS.map((p) => (
              <div
                key={p.id}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  p.featured
                    ? "border-[color:var(--gold)] bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--forest)]/90 text-white shadow-[var(--shadow-lift)]"
                    : "border-border bg-card shadow-[var(--shadow-soft)]"
                }`}
              >
                {p.featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-[color:var(--gold)] text-[color:var(--ink)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">
                    Most Popular
                  </span>
                )}
                <div className={`text-xs uppercase tracking-[0.18em] font-semibold ${p.featured ? "text-white/70" : "text-muted-foreground"}`}>{p.tagline}</div>
                <div className={`mt-1 text-xl font-bold ${p.featured ? "!text-white" : ""}`}>{p.name}</div>
                <div className={`mt-3 text-3xl font-display font-bold ${p.featured ? "!text-white" : "text-foreground"}`}>{p.priceLabel}</div>
                <ul className={`mt-5 space-y-2 text-sm flex-1 ${p.featured ? "text-white/90" : "text-foreground"}`}>

                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${p.featured ? "text-[color:var(--gold)]" : "text-[color:var(--forest)]"}`} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className={`mt-6 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                    p.featured
                      ? "bg-[color:var(--gold)] text-[color:var(--ink)] hover:brightness-105"
                      : "bg-[color:var(--forest)] text-white hover:brightness-110"
                  }`}
                >
                  {p.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground text-center">
            Every new PoultryPro account starts with a 30-day Premium trial — full access to every feature. No credit card required. After the trial you can stay on Basic (free) or upgrade to Standard or Premium.
          </div>
        </section>

      </main>

      <SiteFooter />
    </div>
  );
}
