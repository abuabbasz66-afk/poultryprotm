export type PricingPlan = {
  id: "starter" | "growth" | "enterprise";
  name: string;
  tagline: string;
  priceLabel: string;
  priceSub: string;
  featured?: boolean;
  cta: string;
  features: string[];
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For smallholder farms getting organized",
    priceLabel: "₦5,000",
    priceSub: "per month",
    cta: "Start with Starter",
    features: [
      "1 farm",
      "Up to 500 birds",
      "Daily production & feed records",
      "Mortality & health log",
      "Mobile & offline entry",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For commercial farms scaling up",
    priceLabel: "₦15,000",
    priceSub: "per month",
    featured: true,
    cta: "Choose Growth",
    features: [
      "Up to 5 farms",
      "Up to 5,000 birds",
      "Advanced analytics dashboard",
      "AI-supported insights & predictions",
      "PDF, Excel & CSV reports",
      "Multi-user access (up to 5 staff)",
      "Priority email support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For integrators & multi-site operators",
    priceLabel: "Custom",
    priceSub: "tailored to your operation",
    cta: "Talk to Sales",
    features: [
      "Unlimited farms & birds",
      "Platform administration console",
      "Custom AI models & benchmarks",
      "API access & data export",
      "Single sign-on (SSO)",
      "Dedicated account manager",
      "24/7 priority support & SLA",
    ],
  },
];
