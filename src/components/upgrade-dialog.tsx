import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, LineChart as LineChartIcon, Brain, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type UpgradeTier = "standard" | "premium";

const CONTENT: Record<UpgradeTier, {
  stage: string;
  planLabel: string;
  headline: string;
  tagline: string;
  icon: typeof LineChartIcon;
  bullets: string[];
  primary: string;
}> = {
  standard: {
    stage: "02 · UNDERSTAND",
    planLabel: "Standard Plan",
    headline: "Understand your farm performance.",
    tagline: "Turn your daily records into clear operational and financial intelligence.",
    icon: LineChartIcon,
    bullets: [
      "Production analytics",
      "Revenue and profit tracking",
      "Farm performance trends",
      "Operational analytics",
      "Financial insights",
    ],
    primary: "Upgrade to Standard",
  },
  premium: {
    stage: "03 · PREDICT",
    planLabel: "Premium Plan",
    headline: "Predict earlier. Act smarter.",
    tagline: "Unlock PoultryPro AI Intelligence for your farm.",
    icon: Brain,
    bullets: [
      "7-Day Production Forecast",
      "Production Decline Detection",
      "Mortality Risk Monitoring",
      "Feed Efficiency Monitoring",
      "Abnormal Farm Activity Detection",
      "AI-Supported Farm Insights",
    ],
    primary: "Unlock PoultryPro AI",
  },
};

export function UpgradeDialog({
  tier,
  open,
  onOpenChange,
}: {
  tier: UpgradeTier | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!tier) return null;
  const c = CONTENT[tier];
  const Icon = c.icon;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <div className="bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--ink)] p-6 text-primary-foreground">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--gold)]">
            <Sparkles className="h-3.5 w-3.5" /> {c.stage}
          </div>
          <div className="mt-3 flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[color:var(--gold)]">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogHeader className="space-y-1 text-left">
                <div className="inline-flex w-fit items-center rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase text-[color:var(--gold)]">
                  {c.planLabel}
                </div>
                <DialogTitle className="font-display text-xl leading-tight text-primary-foreground">
                  {c.headline}
                </DialogTitle>
                <DialogDescription className="text-primary-foreground/75">
                  {c.tagline}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            You'll unlock
          </div>
          <ul className="mt-3 space-y-2.5">
            {c.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-foreground">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color:var(--forest)]/10 text-[color:var(--forest)]">
                  <Check className="h-3 w-3" />
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition"
            >
              Maybe Later
            </button>
            <Link
              to="/subscriptions"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--gold)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)] hover:brightness-95 transition"
            >
              {c.primary}
            </Link>
          </DialogFooter>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            View plan details on your Subscriptions page.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
