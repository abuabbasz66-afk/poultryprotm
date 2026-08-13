import {
  LayoutDashboard, Egg, Wheat, HeartPulse, Syringe, Bird, Package, DollarSign,
  LineChart, Brain, Upload, Settings, UserCircle, CreditCard, Sparkles,
  ClipboardList, Beaker, TrendingUp, Receipt, PiggyBank, Tags, AlertTriangle,
  Activity, Gauge, Users, ShoppingCart, Bell, Drumstick, Baby, type LucideIcon,
} from "lucide-react";

export type NavLeaf = {
  label: string;
  icon: LucideIcon;
  to: string;
  search?: Record<string, string>;
  hash?: string;
  premium?: boolean;
  /** Permission required to see this entry. Omitted = visible to every role. */
  permission?: string;
};

export type NavEntry = NavLeaf & { children?: NavLeaf[] };

export type NavSection = { heading: string; items: NavEntry[] };

/**
 * Single source of truth for authenticated navigation.
 * Desktop sidebar and the mobile drawer both render from this config, so
 * feature parity is structural — a module can never exist on one device only.
 *
 * Visibility is permission-driven (see src/lib/rbac.ts): the sidebar filters
 * entries against the signed-in user's effective permissions, so adding a new
 * role never requires touching this file.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    heading: "Operations",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard", search: { area: "records" }, permission: "dashboard.view" },
      { label: "Alerts", icon: Bell, to: "/alerts", permission: "dashboard.view" },

      { label: "Production", icon: Egg, to: "/dashboard", search: { area: "records" }, hash: "production", permission: "production.read" },
      {
        label: "Feed Management", icon: Wheat, to: "/feed", search: { tab: "overview" }, permission: "feed.read",
        children: [
          { label: "Overview", icon: Sparkles, to: "/feed", search: { tab: "overview" }, permission: "feed.read" },
          { label: "Warehouse / Inventory", icon: Package, to: "/feed", search: { tab: "inventory" }, permission: "inventory.read" },
          { label: "Feed Ledger", icon: ClipboardList, to: "/feed", search: { tab: "ledger" }, permission: "inventory.read" },
          { label: "Feed Formulation", icon: Beaker, to: "/feed", search: { tab: "formulation" }, permission: "formulas.read" },
          { label: "Feed Analytics", icon: Gauge, to: "/feed", search: { tab: "overview" }, hash: "feed-intelligence", permission: "feed.read" },
        ],
      },
      { label: "Health Records", icon: HeartPulse, to: "/dashboard", search: { area: "records" }, hash: "health", permission: "health.read" },
      { label: "Medication & Vaccination", icon: Syringe, to: "/dashboard", search: { area: "records" }, hash: "health", permission: "health.read" },
      { label: "Bird Management", icon: Bird, to: "/dashboard", search: { area: "records" }, hash: "rooms", permission: "rooms.read" },
      { label: "Layer Brooding & Rearing", icon: Baby, to: "/rearing", permission: "rooms.read" },
      { label: "Broilers", icon: Drumstick, to: "/broilers", permission: "rooms.read" },
      { label: "Inventory", icon: Package, to: "/feed", search: { tab: "inventory" }, permission: "inventory.read" },
    ],
  },
  {
    heading: "Sales",
    items: [
      { label: "Sales Desk", icon: ShoppingCart, to: "/sales", permission: "sales.read" },
    ],
  },
  {
    heading: "Business",
    items: [
      {

        label: "Finance", icon: DollarSign, to: "/finance", search: { tab: "overview" }, permission: "financials.read",
        children: [
          { label: "Overview", icon: TrendingUp, to: "/finance", search: { tab: "overview" }, permission: "financials.read" },
          { label: "Expenses", icon: Receipt, to: "/finance", search: { tab: "expenses" }, permission: "financials.read" },
          { label: "Revenue", icon: PiggyBank, to: "/finance", search: { tab: "revenue" }, permission: "financials.read" },
          { label: "Financial Reports", icon: ClipboardList, to: "/finance", search: { tab: "reports" }, permission: "financials.read" },
          { label: "Current Prices", icon: Tags, to: "/prices", permission: "prices.read" },
          { label: "Price History", icon: ClipboardList, to: "/price-history", permission: "prices.read" },
        ],
      },
      { label: "Farm Profit", icon: PiggyBank, to: "/dashboard", search: { area: "analytics" }, hash: "all-time-profit", permission: "financials.read" },

      { label: "Analytics & Reports", icon: LineChart, to: "/dashboard", search: { area: "analytics" }, permission: "reports.read" },
      {
        label: "AI Insights", icon: Brain, to: "/dashboard", search: { area: "ai" }, premium: true, permission: "ai.view",
        children: [
          { label: "Production Insights", icon: LineChart, to: "/dashboard", search: { area: "ai" }, hash: "ai-production", premium: true, permission: "ai.view" },
          { label: "Feed Intelligence", icon: Wheat, to: "/feed", search: { tab: "overview" }, hash: "feed-intelligence", premium: true, permission: "ai.view" },
          { label: "Profit Analysis", icon: PiggyBank, to: "/dashboard", search: { area: "ai" }, hash: "ai-insights", premium: true, permission: "ai.view" },
          { label: "Mortality Prediction", icon: Activity, to: "/dashboard", search: { area: "ai" }, hash: "ai-mortality", premium: true, permission: "ai.view" },
          { label: "Feed Shortage Alerts", icon: AlertTriangle, to: "/feed", search: { tab: "inventory" }, premium: true, permission: "ai.view" },
        ],
      },
      { label: "Billing & Plans", icon: CreditCard, to: "/subscriptions", permission: "subscription.manage" },
    ],
  },
  {
    heading: "Workspace",
    items: [
      { label: "Staff & Users", icon: Users, to: "/staff", permission: "staff.manage" },
      { label: "Import CSV", icon: Upload, to: "/import", permission: "production.write" },
      { label: "Settings", icon: Settings, to: "/settings", permission: "settings.write" },
      { label: "Farm Profile", icon: UserCircle, to: "/settings", hash: "profile", permission: "settings.write" },
    ],
  },
];
