/**
 * Human-facing catalogue of what a staff member can be given access to.
 *
 * Each entry maps ONE switch in the "Manage Access" dialog to the raw
 * `<module>.<action>` permissions stored in the database. The Farm Owner never
 * sees raw permission strings — they toggle modules, we translate.
 */
export type AccessItem = {
  key: string;
  label: string;
  description: string;
  /** Permissions granted when the switch is on. */
  grants: string[];
  /** Extra permissions granted when "can edit / record" is also on. */
  writes?: string[];
};

export type AccessGroup = { heading: string; items: AccessItem[] };

export const ACCESS_CATALOG: AccessGroup[] = [
  {
    heading: "Operations",
    items: [
      { key: "dashboard", label: "Dashboard", description: "Farm overview and daily summary", grants: ["dashboard.view"] },
      { key: "production", label: "Egg Production", description: "Daily crates, broken eggs and production history", grants: ["production.read"], writes: ["production.write", "production.delete"] },
      { key: "feed", label: "Feed Management", description: "Daily feed usage and feed analytics", grants: ["feed.read"], writes: ["feed.write", "feed.delete"] },
      { key: "inventory", label: "Warehouse / Inventory", description: "Feed stock, purchases and ledger", grants: ["inventory.read"], writes: ["inventory.write", "inventory.delete"] },
      { key: "formulas", label: "Feed Formulation", description: "Build and cost feed formulas", grants: ["formulas.read"], writes: ["formulas.write"] },
      { key: "health", label: "Health, Medication & Vaccination", description: "Treatments, vaccines and health records", grants: ["health.read"], writes: ["health.write", "health.delete"] },
      { key: "mortality", label: "Mortality Log", description: "Bird losses and causes", grants: ["mortality.read"], writes: ["mortality.write", "mortality.delete"] },
      { key: "flockage", label: "Flock Age & Start Date", description: "Set or change a flock's bird age and placement date", grants: ["rooms.age"] },
      { key: "rooms", label: "Bird & Batch Management", description: "Rooms, layers and broiler batches", grants: ["rooms.read"], writes: ["rooms.write", "rooms.delete"] },
    ],
  },
  {
    heading: "Commercial",
    items: [
      { key: "sales", label: "Sales Desk", description: "Record sales, customers and payments", grants: ["sales.read", "customers.read", "payments.read"], writes: ["sales.write", "customers.write", "payments.write"] },
      { key: "prices", label: "Price Management", description: "Egg, feed and ingredient prices", grants: ["prices.read"], writes: ["prices.write", "prices.delete"] },
      { key: "financials", label: "Financial Records", description: "Expenses, revenue and profit reports", grants: ["financials.read"] },
      { key: "reports", label: "Analytics & Reports", description: "Performance analytics and exports", grants: ["reports.read"], writes: ["export.run"] },
    ],
  },
  {
    heading: "Advanced",
    items: [
      { key: "ai", label: "AI Insights", description: "Predictions and intelligence modules", grants: ["ai.view"] },
      { key: "alerts", label: "Alerts & Notifications", description: "Smart alerts for prices, disease and stock", grants: ["alerts.view"] },
      { key: "audit", label: "Activity & Audit Log", description: "See who did what on the farm", grants: ["audit.read"] },
      { key: "staff", label: "Staff Management", description: "Add and manage other users", grants: ["staff.manage"] },
    ],
  },
];

export const ALL_ACCESS_ITEMS = ACCESS_CATALOG.flatMap((g) => g.items);

/** Derive switch state (on / can-write) from a flat permission list. */
export function itemState(permissions: string[], item: AccessItem) {
  const has = (p: string) => permissions.includes("*") || permissions.includes(p);
  return {
    enabled: item.grants.some(has),
    canWrite: !!item.writes?.length && item.writes.some(has),
  };
}

/** Flatten switch state back into the permission list we persist. */
export function buildPermissions(state: Record<string, { enabled: boolean; canWrite: boolean }>) {
  const out = new Set<string>();
  for (const item of ALL_ACCESS_ITEMS) {
    const s = state[item.key];
    if (!s?.enabled) continue;
    item.grants.forEach((p) => out.add(p));
    if (s.canWrite) item.writes?.forEach((p) => out.add(p));
  }
  return [...out];
}
