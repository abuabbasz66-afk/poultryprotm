import { Link } from "@tanstack/react-router";
import { Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
import { useSubscription } from "@/lib/subscription";

export function TrialBanner() {
  const { data } = useSubscription();
  if (!data?.hasFarm) return null;

  // Active trial
  if (data.isTrial) {
    const days = data.daysRemaining;
    const urgent = days <= 5;
    return (
      <div
        className={`rounded-2xl border p-4 md:p-5 shadow-[var(--shadow-soft)] ${
          urgent
            ? "border-amber-300 bg-gradient-to-r from-amber-50 to-white"
            : "border-[color:var(--forest)]/20 bg-gradient-to-r from-[color:var(--forest)]/[0.06] to-white"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                urgent
                  ? "bg-amber-100 text-amber-800"
                  : "bg-[color:var(--forest)]/10 text-[color:var(--forest)]"
              }`}
            >
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[color:var(--forest)]">
                Premium Trial · {days} {days === 1 ? "day" : "days"} remaining
              </div>
              <div className="mt-1 font-semibold text-foreground leading-snug">
                🎉 You're on a 30-day Premium Trial.
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground leading-snug">
                Enjoy full access to every PoultryPro feature before choosing a subscription.
              </div>
              {/* countdown bar */}
              <div className="mt-3 h-1.5 w-full rounded-full bg-[color:var(--forest)]/10 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    urgent ? "bg-amber-500" : "bg-[color:var(--forest)]"
                  }`}
                  style={{ width: `${Math.max(2, Math.min(100, (days / 30) * 100))}%` }}
                />
              </div>
            </div>
          </div>
          <Link
            to="/subscriptions"
            className="inline-flex items-center justify-center gap-1.5 shrink-0 rounded-full bg-[color:var(--forest)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition"
          >
            View plans <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Trial ended — only show if user is on Basic (i.e. hasn't upgraded)
  if (data.plan === "basic") {
    return (
      <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-white p-4 md:p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-amber-800">
                Trial ended
              </div>
              <div className="mt-1 font-semibold text-foreground leading-snug">
                Your free trial has ended.
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground leading-snug">
                Upgrade to continue using Premium features. Your farm data is safe and unchanged.
              </div>
            </div>
          </div>
          <Link
            to="/subscriptions"
            className="inline-flex items-center justify-center gap-1.5 shrink-0 rounded-full bg-[color:var(--gold)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] hover:brightness-105 transition"
          >
            Upgrade now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
