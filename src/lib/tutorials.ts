/**
 * Centralized PoultryPro Learning Center tutorial catalog.
 *
 * This is the single source of truth for the public Learning Center UI.
 * Videos are intentionally NOT hosted yet: `video_url` is `null` for every
 * tutorial slot, and the UI renders a "Tutorial coming soon" state for those.
 *
 * To publish a tutorial later:
 *   1. Upload the video (Lovable Cloud storage bucket, or any hosting provider)
 *   2. Set `video_url` (and optionally `thumbnail_url`, `duration`)
 *   3. Set `is_published: true`
 *
 * The same `Tutorial` shape maps 1:1 to a future `tutorials` database table,
 * so `getTutorials()` can be swapped to a remote fetch without touching the UI.
 */

export type TutorialDifficulty = "Beginner" | "Intermediate" | "Advanced";

export type TutorialCategoryId =
  | "getting-started"
  | "daily-records"
  | "feed"
  | "health"
  | "finance"
  | "analytics-ai"
  | "advanced";

export interface TutorialCategory {
  id: TutorialCategoryId;
  /** Short label used by filter chips */
  label: string;
  /** Full name used on cards and in the player */
  name: string;
  description: string;
  order: number;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: TutorialCategoryId;
  /** null until a real video is uploaded — never use placeholder/fake URLs */
  video_url: string | null;
  /** null falls back to a generated gradient thumbnail */
  thumbnail_url: string | null;
  /** "m:ss" once known, otherwise null */
  duration: string | null;
  difficulty: TutorialDifficulty;
  order: number;
  is_published: boolean;
  /** Keywords used by the Learning Center search field */
  keywords?: string[];
}

export const TUTORIAL_CATEGORIES: TutorialCategory[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    name: "Getting Started",
    description: "Create your farm, set up rooms and understand the dashboard.",
    order: 1,
  },
  {
    id: "daily-records",
    label: "Daily Records",
    name: "Daily Farm Records",
    description: "Record production, feed, mortality, water and health every day.",
    order: 2,
  },
  {
    id: "feed",
    label: "Feed",
    name: "Feed Management",
    description: "Inventory, purchases, daily usage, formulas and feed costs.",
    order: 3,
  },
  {
    id: "health",
    label: "Health",
    name: "Health & Vaccination",
    description: "Health records, medication, vaccination and bird monitoring.",
    order: 4,
  },
  {
    id: "finance",
    label: "Finance",
    name: "Finance",
    description: "Income, expenses, profit and financial analytics.",
    order: 5,
  },
  {
    id: "analytics-ai",
    label: "Analytics & AI",
    name: "Analytics & AI",
    description: "Trends, alerts, AI farm insights and recommendations.",
    order: 6,
  },
  {
    id: "advanced",
    label: "Advanced",
    name: "Advanced Features",
    description: "Multiple farms, staff, billing and account settings.",
    order: 7,
  },
];

/**
 * Recorded walkthrough durations ("m:ss"), keyed by tutorial id.
 * A tutorial is published automatically when a recording exists here.
 */
const TUTORIAL_DURATIONS: Record<string, string> = {
  "featured-first-5-minutes": "0:39",
  "gs-welcome": "0:39",
  "gs-create-farm": "0:33",
  "gs-rooms": "0:40",
  "gs-birds": "0:35",
  "gs-dashboard": "0:39",
  "dr-production": "0:40",
  "dr-feed": "0:35",
  "dr-mortality": "0:31",
  "dr-water": "0:30",
  "dr-health": "0:30",
  "fd-inventory": "0:28",
  "fd-purchase": "0:28",
  "fd-usage": "0:28",
  "fd-formula": "0:39",
  "fd-costs": "0:28",
  "hl-records": "0:30",
  "hl-medication": "0:31",
  "hl-vaccination": "0:30",
  "hl-monitoring": "0:28",
  "fi-income": "0:27",
  "fi-expenses": "0:27",
  "fi-profit": "0:28",
  "fi-analytics": "0:28",
  "an-analytics": "0:29",
  "an-trends": "0:32",
  "an-alerts": "0:28",
  "an-insights": "0:29",
  "an-recommendations": "0:30",
  "ad-multi-farm": "0:28",
  "ad-staff": "0:33",
  "ad-billing": "0:28",
  "ad-settings": "0:28",
};

function slot(
  id: string,
  title: string,
  description: string,
  category: TutorialCategoryId,
  difficulty: TutorialDifficulty,
  order: number,
  keywords: string[] = [],
): Tutorial {
  const duration = TUTORIAL_DURATIONS[id] ?? null;
  const published = duration !== null;
  return {
    id,
    title,
    description,
    category,
    video_url: published ? `/tutorials/videos/${id}.mp4` : null,
    thumbnail_url: published ? `/tutorials/thumbs/${id}.jpg` : null,
    duration,
    difficulty,
    order,
    is_published: published,
    keywords,
  };
}


/** The featured "start here" tutorial shown at the top of the Learning Center. */
export const FEATURED_TUTORIAL: Tutorial = slot(
  "featured-first-5-minutes",
  "Start Here: Your First 5 Minutes with PoultryPro",
  "Learn the basics of PoultryPro and start managing your farm digitally.",
  "getting-started",
  "Beginner",
  0,
  ["onboarding", "introduction", "digital poultry farming", "setup"],
);

export const TUTORIALS: Tutorial[] = [
  // 1. Getting Started
  slot("gs-welcome", "Welcome to PoultryPro", "A quick tour of the platform and what you can manage with it.", "getting-started", "Beginner", 1, ["intro", "tour"]),
  slot("gs-create-farm", "Creating Your Farm", "Register your farm profile and configure the essentials.", "getting-started", "Beginner", 2, ["farm setup", "profile"]),
  slot("gs-rooms", "Setting Up Farm Rooms", "Create rooms or pens and organise your flock housing.", "getting-started", "Beginner", 3, ["rooms", "pens", "housing"]),
  slot("gs-birds", "Adding Your Birds", "Add bird populations, placement dates and flock ages.", "getting-started", "Beginner", 4, ["birds", "flock", "bird age"]),
  slot("gs-dashboard", "Understanding the Dashboard", "Read your farm KPIs, charts and daily summary at a glance.", "getting-started", "Beginner", 5, ["dashboard", "kpi"]),

  // 2. Daily Farm Records
  slot("dr-production", "Recording Production", "Log daily egg production per room, crates and extra eggs.", "daily-records", "Beginner", 1, ["eggs", "production", "crates", "poultry production records"]),
  slot("dr-feed", "Recording Feed", "Record daily feed consumption in kilograms per room.", "daily-records", "Beginner", 2, ["feed", "kg", "consumption"]),
  slot("dr-mortality", "Recording Mortality", "Log bird losses accurately and keep your population correct.", "daily-records", "Beginner", 3, ["mortality", "bird losses"]),
  slot("dr-water", "Recording Water", "Track daily water intake to spot early health signals.", "daily-records", "Beginner", 4, ["water", "intake"]),
  slot("dr-health", "Recording Health Records", "Capture observations, treatments and health notes daily.", "daily-records", "Beginner", 5, ["health", "observations"]),

  // 3. Feed Management
  slot("fd-inventory", "Managing Feed Inventory", "Keep stock levels accurate and avoid running out of feed.", "feed", "Intermediate", 1, ["inventory", "stock"]),
  slot("fd-purchase", "Recording Purchased Feed", "Log feed purchases, bag weights and supplier costs.", "feed", "Beginner", 2, ["purchase", "bags", "supplier"]),
  slot("fd-usage", "Recording Daily Feed Usage", "Track consumption per bird and per room over time.", "feed", "Beginner", 3, ["usage", "per bird"]),
  slot("fd-formula", "Creating a Feed Formula", "Build a feed formula and see cost per kg instantly.", "feed", "Advanced", 4, ["formula", "ration", "cost per kg"]),
  slot("fd-costs", "Understanding Feed Costs", "Read cost composition, inclusion rates and nutrition analysis.", "feed", "Intermediate", 5, ["cost", "nutrition", "protein", "energy"]),

  // 4. Health & Vaccination
  slot("hl-records", "Managing Health Records", "Organise your farm's complete health history.", "health", "Beginner", 1, ["health records", "poultry health records"]),
  slot("hl-medication", "Recording Medication", "Log treatments, dosage and withdrawal periods.", "health", "Intermediate", 2, ["medication", "treatment"]),
  slot("hl-vaccination", "Recording Vaccination", "Schedule and record vaccinations for every flock.", "health", "Intermediate", 3, ["vaccination", "vaccine", "schedule"]),
  slot("hl-monitoring", "Monitoring Bird Health", "Use trends and alerts to catch problems early.", "health", "Advanced", 4, ["monitoring", "disease"]),

  // 5. Finance
  slot("fi-income", "Recording Farm Income", "Capture egg sales, bird sales and other revenue.", "finance", "Beginner", 1, ["income", "revenue", "sales"]),
  slot("fi-expenses", "Recording Farm Expenses", "Track feed, labour, drugs, utilities and other costs.", "finance", "Beginner", 2, ["expenses", "costs"]),
  slot("fi-profit", "Understanding Farm Profit", "See real profit, margins and cost per egg.", "finance", "Intermediate", 3, ["profit", "margin", "cost per egg"]),
  slot("fi-analytics", "Using Financial Analytics", "Compare periods and understand your farm finance trends.", "finance", "Advanced", 4, ["farm finance", "analytics", "reports"]),

  // 6. Analytics & AI
  slot("an-analytics", "Understanding Farm Analytics", "Read production, feed and mortality analytics correctly.", "analytics-ai", "Intermediate", 1, ["poultry analytics", "analytics"]),
  slot("an-trends", "Reading Production Trends", "Spot lay-rate changes and performance trends over time.", "analytics-ai", "Intermediate", 2, ["trends", "lay rate"]),
  slot("an-alerts", "Understanding Farm Alerts", "Know what each alert means and how to respond.", "analytics-ai", "Beginner", 3, ["alerts", "warnings"]),
  slot("an-insights", "AI Farm Insights", "Let AI surface what changed on your farm and why.", "analytics-ai", "Advanced", 4, ["ai", "insights"]),
  slot("an-recommendations", "AI Recommendations", "Turn AI recommendations into daily farm actions.", "analytics-ai", "Advanced", 5, ["ai", "recommendations"]),

  // 7. Advanced
  slot("ad-multi-farm", "Managing Multiple Farms", "Run several farms from one PoultryPro account.", "advanced", "Advanced", 1, ["multiple farms"]),
  slot("ad-staff", "Managing Staff and Users", "Invite staff and control what each role can do.", "advanced", "Advanced", 2, ["staff", "roles", "permissions"]),
  slot("ad-billing", "Subscription & Billing", "Manage your plan, payments and billing history.", "advanced", "Beginner", 3, ["subscription", "billing", "payment"]),
  slot("ad-settings", "Account Settings", "Update your profile, farm settings and preferences.", "advanced", "Beginner", 4, ["settings", "account"]),
];

/**
 * Returns the tutorial catalog sorted by category order then tutorial order.
 * Swap the body for a remote fetch when videos move to a database/storage.
 */
export function getTutorials(): Tutorial[] {
  const catOrder = new Map(TUTORIAL_CATEGORIES.map((c) => [c.id, c.order]));
  return [...TUTORIALS].sort(
    (a, b) =>
      (catOrder.get(a.category) ?? 99) - (catOrder.get(b.category) ?? 99) ||
      a.order - b.order,
  );
}

export function getCategory(id: TutorialCategoryId): TutorialCategory | undefined {
  return TUTORIAL_CATEGORIES.find((c) => c.id === id);
}

export function categoryName(id: TutorialCategoryId): string {
  return getCategory(id)?.name ?? "Tutorial";
}

/** Case-insensitive search across title, description, category and keywords. */
export function searchTutorials(list: Tutorial[], query: string): Tutorial[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((t) => {
    const haystack = [
      t.title,
      t.description,
      categoryName(t.category),
      t.difficulty,
      ...(t.keywords ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
