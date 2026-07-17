import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { PRICING_PLANS } from "@/lib/pricing-plans";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — PoultryPro™" },
      { name: "description", content: "Simple, transparent pricing for poultry farms of every size. Starter, Growth and Enterprise plans." },
      { property: "og:title", content: "Pricing — PoultryPro™" },
      { property: "og:description", content: "Simple, transparent pricing for poultry farms of every size." },
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
          <h1 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight">Simple pricing for every farm size</h1>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free for 14 days on any plan. No card required. Upgrade, downgrade or cancel anytime.
          </p>
        </section>

        <section className="container-x pb-16">
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
                    Most popular
                  </span>
                )}
                <div className={`text-xs uppercase tracking-[0.18em] font-semibold ${p.featured ? "text-white/70" : "text-muted-foreground"}`}>{p.tagline}</div>
                <div className={`mt-1 text-xl font-bold ${p.featured ? "!text-white" : ""}`}>{p.name}</div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className={`text-4xl font-bold tracking-tight ${p.featured ? "!text-white" : ""}`}>{p.priceLabel}</span>
                  <span className={`text-sm ${p.featured ? "text-white/70" : "text-muted-foreground"}`}>{p.priceSub}</span>
                </div>
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
            All plans include daily records, mobile access, secure cloud backup, and free updates. Annual billing saves approximately 15%.
            Need something custom? <Link to="/" hash="founder" className="text-[color:var(--forest)] font-semibold hover:underline">Contact our team</Link>.
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
