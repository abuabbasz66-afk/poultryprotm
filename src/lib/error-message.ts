/**
 * Customer-facing error text.
 *
 * Application code intentionally throws short, human-readable messages
 * ("Only the Farm Owner can do this"). Infrastructure failures (database,
 * network, auth provider, payment gateway) produce technical strings that must
 * never reach a customer. This helper lets the first kind through and replaces
 * the second kind with a clean message, while still logging the raw error so
 * developers keep full diagnostics.
 */

const TECHNICAL_MARKERS = [
  "pgrst",
  "jwt",
  "sql",
  "syntax error",
  "duplicate key",
  "violates",
  "constraint",
  "relation ",
  "column ",
  "row-level security",
  "rls",
  "supabase",
  "postgres",
  "fetch",
  "networkerror",
  "failed to fetch",
  "econn",
  "timeout of",
  "status code",
  "http",
  "undefined is not",
  "cannot read prop",
  "typeerror",
  "referenceerror",
  "stack",
  "paystack",
  "api key",
  "token",
  "500",
  "401",
  "403",
];

export const GENERIC_ERROR = "Something went wrong. Please try again.";

export function friendlyError(error: unknown, fallback: string = GENERIC_ERROR): string {
  if (error) {
    // Keep full detail in the developer console / monitoring pipeline.
    console.error("[poultrypro]", error);
  }

  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const message = raw.trim();
  if (!message) return fallback;

  // Overly long or multi-line messages are almost always stack/technical output.
  if (message.length > 120 || message.includes("\n")) return fallback;

  const lower = message.toLowerCase();
  if (TECHNICAL_MARKERS.some((marker) => lower.includes(marker))) return fallback;

  // Internal sentinel codes used by server functions.
  if (lower === "forbidden") return "You don't have permission to do this.";
  if (lower === "unauthorized") return "Please sign in again to continue.";
  if (!/\s/.test(message)) return fallback; // single tokens like "PGRST116"

  return message;
}
