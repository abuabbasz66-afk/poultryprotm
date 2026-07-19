export type PricingPlan = {
  id: "basic" | "standard" | "premium";
  name: string;
  tagline: string;
  price: number;            // NGN monthly (0 = Free)
  priceLabel: string;       // display label e.g. "Free" or "₦950/month"
  featured?: boolean;
  cta: string;
  features: string[];
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "basic",
    name: "Basic Plan",
    tagline: "Always free · Perfect for small farms",
    price: 0,
    priceLabel: "Free",
    cta: "Get Started",
    features: [
      "1 Farm",
      "Up to 500 Birds",
      "Farm Records",
      "Egg Production",
      "Feed Records",
      "Mortality Records",
      "Health Records",
      "Mobile Friendly",
      "Email Support",
    ],
  },
  {
    id: "standard",
    name: "Standard Plan",
    tagline: "For commercial poultry farms",
    price: 950,
    priceLabel: "₦950/month",
    featured: true,
    cta: "Choose Standard",
    features: [
      "Everything in Basic",
      "Up to 5 Farms",
      "Up to 5,000 Birds",
      "Advanced Analytics",
      "Revenue Tracking",
      "Financial Dashboard",
      "CSV Export",
      "PDF Reports",
      "Priority Support",
    ],
  },
  {
    id: "premium",
    name: "Premium Plan",
    tagline: "Complete AI-powered platform",
    price: 1950,
    priceLabel: "₦1,950/month",
    cta: "Choose Premium",
    features: [
      "Everything in Standard",
      "AI Intelligence",
      "Disease Prediction",
      "Production Forecasting",
      "Feed Optimization",
      "Performance Alerts",
      "Multi-user Access",
      "24/7 Priority Support",
      "Future AI Features Included",
    ],
  },
];
