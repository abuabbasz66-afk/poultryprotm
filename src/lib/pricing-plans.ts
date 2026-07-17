export type PricingPlan = {
  id: "basic" | "standard" | "premium";
  name: string;
  tagline: string;
  featured?: boolean;
  cta: string;
  features: string[];
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "basic",
    name: "Basic Plan",
    tagline: "Perfect for small and growing poultry farms",
    cta: "Get Started",
    features: [
      "1 Farm",
      "Up to 500 Birds",
      "Daily Production Records",
      "Feed Management",
      "Mortality Records",
      "Health Records",
      "Basic Reports",
      "Mobile Friendly",
      "Offline Data Entry",
      "Email Support",
    ],
  },
  {
    id: "standard",
    name: "Standard Plan",
    tagline: "Designed for commercial poultry farms",
    featured: true,
    cta: "Choose Standard",
    features: [
      "Up to 5 Farms",
      "Up to 5,000 Birds",
      "Advanced Analytics",
      "Financial Dashboard",
      "Feed Inventory",
      "Revenue & Expense Tracking",
      "AI Insights",
      "PDF, Excel & CSV Reports",
      "Multi-user Access",
      "Priority Support",
    ],
  },
  {
    id: "premium",
    name: "Premium Plan",
    tagline: "Complete solution for large poultry businesses and enterprises",
    cta: "Contact Sales",
    features: [
      "Unlimited Farms",
      "Unlimited Birds",
      "Platform Administration",
      "Advanced AI Intelligence",
      "Disease Prediction",
      "Performance Forecasting",
      "API Access",
      "Dedicated Account Manager",
      "Multi-Branch Management",
      "Role-Based User Permissions",
      "Custom Reports",
      "24/7 Priority Support",
    ],
  },
];
