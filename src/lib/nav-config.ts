import {
  LayoutDashboard, Egg, Wheat, HeartPulse, Syringe, Bird, Package, DollarSign,
  LineChart, Brain, Upload, Settings, UserCircle, CreditCard, Sparkles,
  ClipboardList, Beaker, TrendingUp, Receipt, PiggyBank, Tags, AlertTriangle,
  Activity, Gauge, type LucideIcon,
} from "lucide-react";

export type NavLeaf = {
  label: string;
  icon: LucideIcon;
  to: string;
  search?: Record<string, string>;
  hash?: string;
  premium?: boolean;
};

export type NavEntry = NavLeaf & { children?: NavLeaf[] };

export type NavSection = { heading: string; items: NavEntry[] };

/**
 * Single source of truth for authenticated navigation.
 * Desktop sidebar and the mobile drawer both render from this config, so
 * feature parity is structural — a module can never exist on one device only.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    heading: "Operations",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard", search: { area: "records" } },
      { label: "Production", icon: Egg, to: "/dashboard", search: { area: "records" }, hash: "production" },
      {
        label: "Feed Management", icon: Wheat, to: "/feed", search: { tab: "overview" },
        children: [
          { label: "Overview", icon: Sparkles, to: "/feed", search: { tab: "overview" } },
          { label: "Warehouse / Inventory", icon: Package, to: "/feed", search: { tab: "inventory" } },
          { label: "Feed Ledger", icon: ClipboardList, to: "/feed", search: { tab: "ledger" } },
          { label: "Feed Formulation", icon: Beaker, to: "/feed", search: { tab: "formulation" } },
          { label: "Feed Analytics", icon: Gauge, to: "/feed", search: { tab: "overview" }, hash: "feed-intelligence" },
        ],
      },
      { label: "Health Records", icon: HeartPulse, to: "/dashboard", search: { area: "records" }, hash: "health" },
      { label: "Medication & Vaccination", icon: Syringe, to: "/dashboard", search: { area: "records" }, hash: "health" },
      { label: "Bird Management", icon: Bird, to: "/dashboard", search: { area: "records" }, hash: "rooms" },
      { label: "Inventory", icon: Package, to: "/feed", search: { tab: "inventory" } },
    ],
  },
  {
    heading: "Business",
    items: [
      {
        label: "Finance", icon: DollarSign, to: "/dashboard", search: { area: "analytics" }, hash: "finance",
        children: [
          { label: "Revenue", icon: TrendingUp, to: "/dashboard", search: { area: "analytics" }, hash: "finance" },
          { label: "Expenses", icon: Receipt, to: "/dashboard", search: { area: "analytics" }, hash: "finance" },
          { label: "Profit", icon: PiggyBank, to: "/dashboard", search: { area: "analytics" }, hash: "all-time-profit" },
          { label: "Current Prices", icon: Tags, to: "/dashboard", search: { area: "records" }, hash: "prices" },
        ],
      },
      { label: "Analytics & Reports", icon: LineChart, to: "/dashboard", search: { area: "analytics" } },
      {
        label: "AI Insights", icon: Brain, to: "/dashboard", search: { area: "ai" }, premium: true,
        children: [
          { label: "Production Insights", icon: LineChart, to: "/dashboard", search: { area: "ai" }, hash: "ai-production", premium: true },
          { label: "Feed Intelligence", icon: Wheat, to: "/feed", search: { tab: "overview" }, hash: "feed-intelligence", premium: true },
          { label: "Profit Analysis", icon: PiggyBank, to: "/dashboard", search: { area: "ai" }, hash: "ai-insights", premium: true },
          { label: "Mortality Prediction", icon: Activity, to: "/dashboard", search: { area: "ai" }, hash: "ai-mortality", premium: true },
          { label: "Feed Shortage Alerts", icon: AlertTriangle, to: "/feed", search: { tab: "inventory" }, premium: true },
        ],
      },
      { label: "Billing & Plans", icon: CreditCard, to: "/subscriptions" },
    ],
  },
  {
    heading: "Workspace",
    items: [
      { label: "Import CSV", icon: Upload, to: "/import" },
      { label: "Settings", icon: Settings, to: "/settings" },
      { label: "Farm Profile", icon: UserCircle, to: "/settings", hash: "profile" },
    ],
  },
];
