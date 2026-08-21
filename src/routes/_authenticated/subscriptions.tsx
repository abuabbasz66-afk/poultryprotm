import { RequirePermission } from "@/components/require-permission";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, CheckCircle2, Sparkles, CreditCard, Calendar,
  RefreshCw, Loader2, ShieldCheck, ExternalLink, AlertTriangle,
} from "lucide-react";
import { format as fmtDate, parseISO, isValid as isValidDate } from "date-fns";
import { useSubscription, PLAN_PRICE_NGN, formatNaira, type PlanTier } from "@/lib/subscription";
import { PRICING_PLANS } from "@/lib/pricing-plans";
import { toast } from "sonner";


type BillingSearch = { payment?: "success" | "failed" };

export const Route = createFileRoute("/_authenticated/subscriptions")({
  validateSearch: (search: Record<string, unknown>): BillingSearch => ({
    payment: search.payment === "success" || search.payment === "failed" ? search.payment : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Subscriptions & Billing — PoultryPro" },
      { name: "description", content: "Review your PoultryPro plan, trial status, invoices and payment history, and upgrade between Basic, Standard and Premium." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <RequirePermission permission="subscription.manage" hint="Billing is available to the Farm Owner.">
      <SubscriptionsPage />
    </RequirePermission>
  ),
});

function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValidDate(d) ? fmtDate(d, "d MMM yyyy") : "—";
}

type PaymentRow = {
  id: string;
  plan: string;
  amount_ngn: number;
  currency: string;
  reference: string;
  status: string;
  paid_at: string | null;
  created_at: string;
};

function usePayments(farmId: string | null) {
  return useQuery({
    queryKey: ["farm-payments", farmId ?? "none"],
    enabled: !!farmId,
    queryFn: async (): Promise<PaymentRow[]> => {
      const { data, error } = await supabase
        .from("farm_payments")
        .select("id, plan, amount_ngn, currency, reference, status, paid_at, created_at")
        .eq("farm_id", farmId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
  });
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

function SubscriptionsPage() {
  const { data, isPending, refetch } = useSubscription();
  const search = useSearch({ from: "/_authenticated/subscriptions" });
  const qc = useQueryClient();
  const [busyPlan, setBusyPlan] = useState<PlanTier | null>(null);
  const [managing, setManaging] = useState(false);
  const payments = usePayments(data?.farmId ?? null);

  useEffect(() => {
    if (!search.payment) return;
    if (search.payment === "success") {
      toast.success("Payment verified — your plan is now active.");
    } else {
      toast.error("Payment was not completed. You have not been charged for an unsuccessful attempt.");
    }
    refetch();
    qc.invalidateQueries({ queryKey: ["farm-payments"] });
    window.history.replaceState({}, "", "/subscriptions");
  }, [search.payment, refetch, qc]);

  async function startCheckout(plan: PlanTier) {
    if (plan === "basic") {
      toast("You'll move to Basic when your current paid period ends.");
      return;
    }
    setBusyPlan(plan);
    try {
      const res = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ plan }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.authorization_url) {
        toast.error(
          body?.error === "forbidden"
            ? "Only the farm owner can manage billing."
            : "Could not start checkout. Please try again.",
        );
        setBusyPlan(null);
        return;
      }
      toast.success("Redirecting to secure Paystack checkout…");
      window.location.href = body.authorization_url as string;
    } catch {
      toast.error("Network error starting checkout.");
      setBusyPlan(null);
    }
  }

  async function openManage() {
    setManaging(true);
    try {
      const res = await fetch("/api/paystack/manage", { headers: await authHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.link) {
        toast.error("No active Paystack subscription to manage yet.");
        return;
      }
      window.open(body.link as string, "_blank", "noopener");
    } catch {
      toast.error("Could not open the Paystack management page.");
    } finally {
      setManaging(false);
    }
  }

  if (isPending || !data) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentPlan = data.plan;
  const effective = data.effectivePlan;
  const isTrial = data.isTrial && currentPlan === "basic";
  const paymentFailed = data.paystackSubscriptionStatus === "payment_failed";


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
                {fmtDay(isTrial ? data.trialEndsAt : (data.nextPaymentAt ?? data.trialEndsAt))}
              </div>
              {isTrial && (
                <div className="text-xs text-muted-foreground">
                  {data.daysRemaining} {data.daysRemaining === 1 ? "day" : "days"} remaining
                </div>
              )}
              {data.paystackSubscriptionCode && (
                <button
                  type="button"
                  onClick={openManage}
                  disabled={managing}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
                >
                  {managing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                  Manage subscription
                </button>
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
                busy={busyPlan === p.id}
                onSelect={() => startCheckout(p.id)}
              />
            ))}

          </div>
        </section>

        {/* Payment history */}
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-[var(--shadow-soft)]">
          <h2 className="font-display text-lg font-bold text-foreground">Payment history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every Paystack transaction for this farm, verified server-side.
          </p>
          {payments.isPending ? (
            <div className="mt-4 grid place-items-center p-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (payments.data?.length ?? 0) === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No payments recorded.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Date</th>
                    <th className="py-2 pr-3 font-semibold">Plan</th>
                    <th className="py-2 pr-3 font-semibold">Amount</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">Reference</th>
                    <th className="py-2 font-semibold">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.data!.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDay(p.created_at)}</td>
                      <td className="py-2 pr-3 capitalize">{p.plan}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatNaira(Number(p.amount_ngn))}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                            p.status === "success"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : p.status === "pending"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {p.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground break-all">{p.reference}</td>
                      <td className="py-2 whitespace-nowrap">{fmtDay(p.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
  planId, name, tagline, priceLabel, features, featured, current, busy, onSelect,
}: {
  planId: PlanTier;
  name: string;
  tagline: string;
  priceLabel: string;
  features: string[];
  featured?: boolean;
  current?: boolean;
  busy?: boolean;
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
        disabled={current || busy}
        className={`mt-5 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed ${
          featured
            ? "bg-[color:var(--gold)] text-[color:var(--ink)] hover:brightness-105"
            : planId === "basic"
              ? "border border-border bg-background text-foreground hover:bg-secondary"
              : "bg-[color:var(--forest)] text-white hover:brightness-110"
        }`}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy
          ? "Starting checkout…"
          : current
            ? "Current plan"
            : planId === "basic"
              ? "Downgrade to Basic"
              : `Upgrade to ${name.replace(" Plan", "")}`}
      </button>

    </div>
  );
}
