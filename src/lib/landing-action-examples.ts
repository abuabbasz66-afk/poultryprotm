/** Public, illustrative values only. Never connected to a farm or persisted. */
export const LANDING_ACTION_EXAMPLES = [
  {
    id: "feed", category: "Feed", title: "Feed stock running low", priority: "High",
    issue: "Recorded stock may cover only 3 more days.",
    evidence: "300 kg calculated stock ÷ 100 kg/day average recorded usage over 7 days = 3 days. Assumes usage stays similar.",
    next: "Confirm the physical stock count and arrange a purchase before supplies run out.",
    quality: "Recent records · estimate", status: "Open",
  },
  {
    id: "eggs", category: "Production", title: "Egg production below its recent baseline", priority: "Medium",
    issue: "The last 3 recorded days average 720 eggs, below the previous 7-day average of 800.",
    evidence: "720 versus 800 eggs/day: a 10% decline. Same example flock; no recorded change in bird count.",
    next: "Verify the egg count, then review feed, water, mortality and recent management changes.",
    quality: "Recent records · comparison", status: "Acknowledged",
  },
  {
    id: "mortality", category: "Health", title: "Unusual mortality; investigate", priority: "High",
    issue: "6 deaths recorded today, compared with a recent daily average of 1.",
    evidence: "6 of 1,000 birds at risk = 0.6% today. Previous 7 recorded days: 1 death/day on average.",
    next: "Verify the record, check the flock and water supply, and seek veterinary advice if deaths continue or birds show signs of illness.",
    quality: "Recent records · not a diagnosis", status: "In progress",
  },
  {
    id: "records", category: "Records", title: "Missing farm records", priority: "Medium",
    issue: "No egg entry for 3 days; a reliable current trend cannot be calculated.",
    evidence: "The last egg entry is 3 days old. Missing days are unknown, not zero production.",
    next: "Check the original farm log and enter only verified figures for the missing dates.",
    quality: "Limited evidence · records needed", status: "Open",
  },
] as const;