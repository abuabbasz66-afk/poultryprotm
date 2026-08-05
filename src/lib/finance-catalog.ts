/**
 * Catalogue of every expenditure and revenue category PoultryPro tracks.
 * Categories are DATA so new subcategories never require code branches.
 */

export type ExpenseCategoryKey = "production" | "operating" | "administrative";

export type ExpenseCategory = {
  key: ExpenseCategoryKey;
  label: string;
  description: string;
  subcategories: string[];
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  {
    key: "production",
    label: "Production Costs",
    description: "Daily operational spend directly tied to poultry production.",
    subcategories: [
      "Feed Purchase", "Feed Ingredients", "Medication", "Vaccines", "Vitamins",
      "Supplements", "Veterinary Services", "Laboratory Tests", "Water Supply",
      "Litter Material", "Disinfectants", "Packaging Materials", "Transport of Feed",
    ],
  },
  {
    key: "operating",
    label: "Farm Operating Expenses",
    description: "General expenses required to keep the farm running.",
    subcategories: [
      "Generator Fuel", "Diesel", "Petrol", "Generator Repairs", "Electricity Bills",
      "Borehole Maintenance", "Water Pump Repairs", "Farm Repairs", "Building Maintenance",
      "Cage Repairs", "Equipment Repairs", "Vehicle Maintenance", "Security",
      "Cleaning Materials", "Office Supplies", "Internet", "Phone Bills",
    ],
  },
  {
    key: "administrative",
    label: "Administrative Expenses",
    description: "Business management and financing expenses.",
    subcategories: [
      "Salaries", "Casual Labour", "Staff Welfare", "Bonuses", "Loan Repayment",
      "Debt Payment", "Interest", "Taxes", "Government Levies", "Insurance",
      "Rent", "Training", "Miscellaneous",
    ],
  },
];

export function expenseCategoryLabel(key: string) {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export type RevenueCategoryKey = "eggs" | "birds" | "byproducts" | "other";

export type RevenueCategory = {
  key: RevenueCategoryKey;
  label: string;
  description: string;
  /** Sales-officer accessible stream. */
  sales: boolean;
  items: { name: string; unit: string }[];
};

export const REVENUE_CATEGORIES: RevenueCategory[] = [
  {
    key: "eggs",
    label: "Egg Sales",
    description: "Table eggs, jumbo eggs, cracks and empty trays.",
    sales: true,
    items: [
      { name: "Table Eggs", unit: "crate" },
      { name: "Jumbo Eggs", unit: "crate" },
      { name: "Cracked Eggs", unit: "crate" },
      { name: "Egg Trays", unit: "piece" },
    ],
  },
  {
    key: "birds",
    label: "Bird Sales",
    description: "Spent layers, culls, broilers, chicks and point-of-lay birds.",
    sales: true,
    items: [
      { name: "Spent Layers", unit: "bird" },
      { name: "Culled Birds", unit: "bird" },
      { name: "Broilers", unit: "bird" },
      { name: "Chicks", unit: "bird" },
      { name: "Point-of-Lay Birds", unit: "bird" },
    ],
  },
  {
    key: "byproducts",
    label: "Farm By-products",
    description: "Manure, empty feed bags and other recoverables.",
    sales: true,
    items: [
      { name: "Poultry Manure", unit: "bag" },
      { name: "Empty Feed Bags", unit: "bag" },
      { name: "Empty Medicine Containers", unit: "piece" },
      { name: "Feathers", unit: "bag" },
    ],
  },
  {
    key: "other",
    label: "Other Income",
    description: "Consultancy, farm visits, training and rentals.",
    sales: false,
    items: [
      { name: "Consultancy", unit: "session" },
      { name: "Farm Visits", unit: "visit" },
      { name: "Training", unit: "session" },
      { name: "Equipment Rental", unit: "day" },
      { name: "Other Income", unit: "unit" },
    ],
  },
];

export function revenueCategoryLabel(key: string) {
  return REVENUE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/** Streams a Sales Officer may record. */
export const SALES_REVENUE_KEYS: RevenueCategoryKey[] = REVENUE_CATEGORIES
  .filter((c) => c.sales)
  .map((c) => c.key);

export const PAYMENT_METHODS = [
  "cash", "bank transfer", "pos", "cheque", "mobile money", "credit",
] as const;

export const REVENUE_UNITS = [
  "crate", "piece", "bird", "bag", "kg", "session", "visit", "day", "unit",
] as const;
