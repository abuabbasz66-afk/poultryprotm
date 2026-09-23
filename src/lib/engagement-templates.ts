// Approved, template-ready message content.
//
// Tone rules: helpful, human, professional, concise. No pressure, no guilt,
// no fake urgency, no "LAST CHANCE", no emoji storms. Every message explains
// what the farmer already has, what they can do, and gives ONE clear action
// plus a genuine way to get help.
import type { AudienceRow, Segment } from "@/lib/engagement";

export const SUPPORT_PHONE = "2348065301413";
export const SUPPORT_DISPLAY = "0806 530 1413";
const SITE = "https://poultrypro.life";
export const LINKS = {
  app: `${SITE}/dashboard`,
  setup: `${SITE}/onboarding`,
  plans: `${SITE}/pricing`,
  upgrade: `${SITE}/subscriptions`,
  academy: `${SITE}/academy`,
};

export type CampaignKey =
  | "WELCOME"
  | "SETUP_REMINDER"
  | "FIRST_VALUE"
  | "FEATURE_EDUCATION"
  | "PREMIUM_VALUE"
  | "SUBSCRIPTION_EXPIRING"
  | "SUBSCRIPTION_EXPIRED"
  | "PAYMENT_FAILED"
  | "CHECKOUT_REMINDER"
  | "REACTIVATION"
  | "SUPPORT_OFFER";

export type Campaign = {
  key: CampaignKey;
  label: string;
  category: "service" | "marketing";
  purpose: string;
  segments: Segment[];
  build: (row: AudienceRow) => string;
};

const HELP = `Need help? Reply HELP, or call/WhatsApp PoultryPro on ${SUPPORT_DISPLAY}.`;

function firstName(row: AudienceRow): string {
  const source = row.full_name || row.farm_name || "";
  const name = source.trim().split(/\s+/)[0];
  return name ? name : "there";
}

/** One honest sentence about what this farmer has actually recorded. */
function progressLine(row: AudienceRow): string {
  const parts: string[] = [];
  if (row.has_production) parts.push("production");
  if (row.has_feed) parts.push("feed");
  if (row.has_health) parts.push("flock health");
  if (row.has_finance) parts.push("income and expenses");
  if (parts.length === 0) return "";
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Your ${list} records are already building a useful picture of your farm.`;
}

function daysLeft(row: AudienceRow): number | null {
  if (!row.expires_at) return null;
  const ms = new Date(row.expires_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function join(...lines: (string | null | undefined)[]): string {
  return lines.filter((l) => l && l.trim()).join("\n\n");
}

export const CAMPAIGNS: Campaign[] = [
  {
    key: "WELCOME",
    label: "Welcome",
    category: "marketing",
    purpose: "Greet a new farmer and point them at the first useful step.",
    segments: ["REGISTERED_NOT_SETUP", "SETUP_INCOMPLETE"],
    build: (r) =>
      join(
        `Hello ${firstName(r)}, welcome to PoultryPro.`,
        "Your farm account is ready. Start by recording your daily activities — eggs, feed, mortality — and PoultryPro will begin showing you what is happening on your farm.",
        `Open your farm: ${LINKS.app}`,
        HELP,
      ),
  },
  {
    key: "SETUP_REMINDER",
    label: "Setup reminder",
    category: "marketing",
    purpose: "Help someone who registered but has not finished farm setup.",
    segments: ["REGISTERED_NOT_SETUP", "SETUP_INCOMPLETE"],
    build: (r) =>
      join(
        `Hello ${firstName(r)}, this is PoultryPro.`,
        r.farm_name
          ? `${r.farm_name} is set up on PoultryPro, but a few steps are still outstanding: adding your birds, your rooms and your first production record.`
          : "Your PoultryPro account is created, but your farm is not set up yet. Adding your farm, birds and rooms takes about five minutes.",
        "Once those are in, your dashboard starts showing real figures for your own farm.",
        `Continue setup: ${LINKS.setup}`,
        HELP,
      ),
  },
  {
    key: "FIRST_VALUE",
    label: "First value",
    category: "marketing",
    purpose: "Show a farmer the value of the records they have already kept.",
    segments: ["ACTIVATED_FREE", "ACTIVE_FREE"],
    build: (r) =>
      join(
        `Hello ${firstName(r)}, this is PoultryPro.`,
        progressLine(r) || "You have started building your farm history on PoultryPro.",
        "Open your dashboard to see your production trend, feed usage and mortality in one place.",
        `View your farm: ${LINKS.app}`,
        HELP,
      ),
  },
  {
    key: "FEATURE_EDUCATION",
    label: "Feature education",
    category: "marketing",
    purpose: "Teach one useful thing the farmer may not have found yet.",
    segments: ["ACTIVATED_FREE", "ACTIVE_FREE", "PREMIUM_ACTIVE"],
    build: (r) =>
      join(
        `Hello ${firstName(r)}, a quick tip from PoultryPro.`,
        r.has_feed
          ? "Your feed records can show your cost per bird and warn you before stock runs out — open Feed, then Cost & Efficiency."
          : "Recording each feed delivery and daily usage lets PoultryPro show your feed cost per bird and warn you before stock runs out.",
        `Short guides are in the Academy: ${LINKS.academy}`,
        HELP,
      ),
  },
  {
    key: "PREMIUM_VALUE",
    label: "Premium value",
    category: "marketing",
    purpose: "Explain what a paid plan adds to records the farmer already keeps.",
    segments: ["ACTIVE_FREE", "ACTIVATED_FREE"],
    build: (r) =>
      join(
        `Hello ${firstName(r)}, this is PoultryPro.`,
        progressLine(r) || "You have started building a farm history on PoultryPro.",
        "A paid plan adds deeper production analysis, feed efficiency monitoring, financial reports and farm intelligence on top of the records you are already keeping. Standard is ₦950/month and Premium is ₦1,950/month. Your free plan continues to work either way.",
        `See what is included: ${LINKS.plans}`,
        HELP,
      ),
  },
  {
    key: "SUBSCRIPTION_EXPIRING",
    label: "Subscription expiring",
    category: "service",
    purpose: "Remind a paying farmer that their plan is about to end.",
    segments: ["PREMIUM_EXPIRING"],
    build: (r) => {
      const d = daysLeft(r);
      const when = d === null ? "soon" : d <= 1 ? "tomorrow" : `in ${d} days`;
      return join(
        `Hello ${firstName(r)}, this is PoultryPro.`,
        `Your PoultryPro paid access ends ${when}. Renewing keeps your advanced analysis, reports and farm intelligence running without interruption. Your farm records stay safe either way.`,
        `Renew here: ${LINKS.upgrade}`,
        HELP,
      );
    },
  },
  {
    key: "SUBSCRIPTION_EXPIRED",
    label: "Subscription ended",
    category: "service",
    purpose: "Tell a farmer their plan ended and how to continue.",
    segments: ["PREMIUM_EXPIRED", "CANCELLED"],
    build: (r) =>
      join(
        `Hello ${firstName(r)}, this is PoultryPro.`,
        "Your PoultryPro paid access has ended. Your farm data remains safe and you can keep recording on the free plan.",
        `Continue with a paid plan whenever you are ready: ${LINKS.upgrade}`,
        HELP,
      ),
  },
  {
    key: "PAYMENT_FAILED",
    label: "Payment did not complete",
    category: "service",
    purpose: "Let a farmer know a payment failed, without blaming them.",
    segments: ["PAYMENT_FAILED"],
    build: (r) =>
      join(
        `Hello ${firstName(r)}, this is PoultryPro.`,
        "We could not complete your PoultryPro subscription payment. This often happens for reasons outside your control, and nothing was lost — your farm data is safe.",
        `You can try again here: ${LINKS.upgrade}`,
        HELP,
      ),
  },
  {
    key: "CHECKOUT_REMINDER",
    label: "Checkout reminder",
    category: "marketing",
    purpose: "One gentle reminder after an unfinished upgrade.",
    segments: ["CHECKOUT_STARTED"],
    build: (r) =>
      join(
        `Hello ${firstName(r)}, this is PoultryPro.`,
        "Your PoultryPro upgrade is still waiting — the payment was not completed. If you ran into a problem, tell us and we will help.",
        `Continue upgrade: ${LINKS.upgrade}`,
        HELP,
      ),
  },
  {
    key: "REACTIVATION",
    label: "Reactivation",
    category: "marketing",
    purpose: "Invite a farmer who stopped recording to come back.",
    segments: ["INACTIVE_FREE"],
    build: (r) =>
      join(
        `Hello ${firstName(r)}, this is PoultryPro.`,
        progressLine(r) ||
          "Your PoultryPro farm account is still here and your records are safe.",
        "Recording a few days again is enough for your production and feed trends to become useful once more.",
        `Open your farm: ${LINKS.app}`,
        HELP,
      ),
  },
  {
    key: "SUPPORT_OFFER",
    label: "Support offer",
    category: "service",
    purpose: "Offer direct help — used for call requests and stuck farmers.",
    segments: [
      "REGISTERED_NOT_SETUP",
      "SETUP_INCOMPLETE",
      "ACTIVATED_FREE",
      "ACTIVE_FREE",
      "INACTIVE_FREE",
      "CHECKOUT_STARTED",
      "PAYMENT_FAILED",
      "PREMIUM_ACTIVE",
      "PREMIUM_EXPIRING",
      "PREMIUM_EXPIRED",
      "CANCELLED",
    ],
    build: (r) =>
      join(
        `Hello ${firstName(r)}, this is PoultryPro.`,
        "If anything on PoultryPro is unclear, we are happy to walk you through it — setting up rooms, recording production, or reading your reports.",
        `Reply to this message, or call ${SUPPORT_DISPLAY}. We can also call you back at a time that suits you.`,
      ),
  },
];

/** Campaigns that make sense for a segment, best fit first. */
export function campaignsForSegment(segment: Segment): Campaign[] {
  return CAMPAIGNS.filter((c) => c.segments.includes(segment));
}

export function waLink(phone: string, body: string): string {
  const digits = phone.replace(/[^\d]/g, "").replace(/^0/, "234");
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}
