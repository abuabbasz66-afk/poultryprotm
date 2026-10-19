/** Finance entry amounts are denominated in NGN; reject unknown currencies. */
export function parseRecordedRevenue(value: unknown, currency: unknown): number | null {
  if (currency !== "NGN" || value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function formatRecordedRevenue(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount < 0) return "Not yet available";
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", notation: amount >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: amount >= 1_000_000 ? 1 : 2,
  }).format(amount);
}