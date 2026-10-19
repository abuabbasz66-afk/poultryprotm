/** Owner reports all production crates sold daily; this remains a rounded snapshot, not a live sales ledger aggregate. */
export const PUBLIC_PRODUCTION_VALUE = {
  amount: 76_600_000,
  currency: "NGN",
  farm: "ABZ Global Resource",
  asOf: "2026-10-19",
  source: "owner-supplied-snapshot",
  salesBasis: "owner-confirmed-daily-crate-sales",
} as const;