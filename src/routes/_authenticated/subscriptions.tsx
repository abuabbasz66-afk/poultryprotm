import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft, CheckCircle2, Sparkles, CreditCard, Calendar,
  RefreshCw, Loader2, ShieldCheck,
} from "lucide-react";
import { format as fmtDate, parseISO, isValid as isValidDate } from "date-fns";
import { useSubscription, PLAN_PRICE_NGN, formatNaira, type PlanTier } from "@/lib/subscription";
import { PRICING_PLANS } from "@/lib/pricing-plans";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions & Billing — PoultryPro" },
      { name: "description", content: "Review your PoultryPro plan, trial status, invoices and payment history, and upgrade between Basic, Standard and Premium." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SubscriptionsPage,
});

function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValidDate(d) ? fmtDate(d, "d MMM yyyy") : "—";
}

function SubscriptionsPage() {
  const { data, isPending } = useSubscription();

  if (isPending || !data) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentPlan = data.plan;
  const effective = data.effectivePlan;
  const isTrial = data.isTrial;

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <header className="bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--ink)] text-white">
        <div className="container-x py-6 md:py-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-[color:var(--gold)]">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--gold)] font-semibold">
                Subscriptions
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-white leading-tight">
                Your PoultryPro plan
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container-x -mt-4 md:-mt-6 space-y-6">
        {/* Current plan card */}
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                Current plan
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-display text-2xl font-bold capitalize text-foreground">
                  {isTrial ? "Premium (Trial)" : `${currentPlan}`}
                </span>
                {isTrial && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--forest)]/10 text-[color:var(--forest)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
                    <Sparkles className="h-3 w-3" /> Trial
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Effective access: <span className="font-medium text-foreground capitalize">{effective}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                {isTrial ? "Trial ends" : "Renews"}
              </div>
              <div className="mt-1 font-semibold text-foreground">
                {fmtDay(data.trialEndsAt)}
              </div>
              {isTrial && (
                <div className="text-xs text-muted-foreground">
                  {data.daysRemaining} {data.daysRemaining === 1 ? "day" : "days"} remaining
                </div>
              )}
            </div>
          </div>

          {/* Progress bar for trial */}
          {isTrial && (
            <div className="mt-4 h-1.5 w-full rounded-full bg-[color:var(--forest)]/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[color:var(--forest)]"
                style={{ width: `${Math.max(2, Math.min(100, (data.daysRemaining / 30) * 100))}%` }}
              />
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <InfoTile
              icon={<Calendar className="h-4 w-4" />}
              label="Status"
              value={isTrial ? "Trial · Active" : currentPlan === "basic" ? "Free" : "Active"}
            />
            <InfoTile
              icon={<RefreshCw className="h-4 w-4" />}
              label="Auto-renewal"
              value={data.autoRenew ? "On" : "Off"}
            />
            <InfoTile
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Account"
              value={data.status === "suspended" ? "Suspended" : "Active"}
            />
          </div>
        </section>

        {/* Plan comparison */}
        <section>
          <div className="mb-3">
            <h2 className="font-display text-lg md:text-xl font-bold text-foreground">Choose your plan</h2>
            <p className="text-sm text-muted-foreground">
              All prices in Nigerian Naira, billed monthly. Cancel anytime — your farm data is always yours.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PRICING_PLANS.map((p) => (
              <PlanCard
                key={p.id}
                planId={p.id}
                name={p.name}
                tagline={p.tagline}
                priceLabel={p.priceLabel}
                features={p.features}
                featured={p.featured}
                current={currentPlan === p.id && !isTrial}
                onSelect={() => {
                  if (p.id === "basic") {
                    toast("You'll move to Basic when your current plan ends.");
                    return;
                  }
                  toast(
                    `Paystack checkout for ${p.name} (${formatNaira(PLAN_PRICE_NGN[p.id])}/mo) is coming soon.`,
                  );
                }}
              />
            ))}
          </div>
        </section>

        {/* Payment history placeholder */}
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-[var(--shadow-soft)]">
          <h2 className="font-display text-lg font-bold text-foreground">Payment history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You haven't made any payments yet. Receipts and invoices will appear here once paid subscriptions go live.
          </p>
          <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No payments recorded.
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Paid subscriptions will be processed securely via Paystack. Your data is never deleted when a plan
          expires or is downgraded.
        </p>
      </main>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
        {icon} {label}
      </div>
      <div className="mt-1 font-semibold text-foreground">{value}</div>
    </div>
  );
}

function PlanCard({
  planId, name, tagline, priceLabel, features, featured, current, onSelect,
}: {
  planId: PlanTier;
  name: string;
  tagline: string;
  priceLabel: string;
  features: string[];
  featured?: boolean;
  current?: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`relative rounded-2xl border p-5 flex flex-col ${
        featured
          ? "border-[color:var(--gold)] bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--forest)]/90 text-white shadow-[var(--shadow-lift)]"
          : "border-border bg-card shadow-[var(--shadow-soft)]"
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-5 rounded-full bg-[color:var(--gold)] text-[color:var(--ink)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">
          Most Popular
        </span>
      )}
      {current && (
        <span className="absolute -top-3 right-5 rounded-full bg-emerald-500 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">
          Current
        </span>
      )}
      <div className={`text-xs uppercase tracking-[0.14em] font-semibold ${featured ? "text-white/70" : "text-muted-foreground"}`}>
        {tagline}
      </div>
      <div className={`mt-1 text-lg font-bold ${featured ? "!text-white" : ""}`}>{name}</div>
      <div className={`mt-3 text-2xl font-display font-bold ${featured ? "!text-white" : "text-foreground"}`}>
        {priceLabel}
      </div>
      <ul className={`mt-4 space-y-1.5 text-sm flex-1 ${featured ? "text-white/90" : "text-foreground"}`}>
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${featured ? "text-[color:var(--gold)]" : "text-[color:var(--forest)]"}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSelect}
        disabled={current}
        className={`mt-5 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed ${
          featured
            ? "bg-[color:var(--gold)] text-[color:var(--ink)] hover:brightness-105"
            : planId === "basic"
              ? "border border-border bg-background text-foreground hover:bg-secondary"
              : "bg-[color:var(--forest)] text-white hover:brightness-110"
        }`}
      >
        {current ? "Current plan" : planId === "basic" ? "Downgrade to Basic" : `Upgrade to ${name.replace(" Plan", "")}`}
      </button>
    </div>
  );
}
