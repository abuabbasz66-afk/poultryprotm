/**
 * Feed nutrition engine.
 *
 * Nutrient composition of common poultry feed ingredients (as-fed basis).
 * Values are typical West-African / NRC book values:
 *  - me      Metabolisable energy, kcal/kg
 *  - cp      Crude protein, %
 *  - cf      Crude fibre, %
 *  - ee      Ether extract (fat/oil), %
 *  - ca      Calcium, %
 *  - p       Available phosphorus, %
 *  - lys     Lysine, %
 *  - met     Methionine, %
 *  - ash     Ash, %
 */
export type NutrientProfile = {
  me: number; cp: number; cf: number; ee: number;
  ca: number; p: number; lys: number; met: number; ash: number;
};

export const NUTRIENT_KEYS = ["me", "cp", "cf", "ee", "ca", "p", "lys", "met", "ash"] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

const P = (
  me: number, cp: number, cf: number, ee: number,
  ca: number, p: number, lys: number, met: number, ash: number,
): NutrientProfile => ({ me, cp, cf, ee, ca, p, lys, met, ash });

/** Keyed by a normalised ingredient name. */
export const INGREDIENT_NUTRIENTS: Record<string, NutrientProfile> = {
  maize:              P(3350, 8.5, 2.5, 3.8, 0.02, 0.10, 0.25, 0.18, 1.3),
  "yellow maize":     P(3350, 8.5, 2.5, 3.8, 0.02, 0.10, 0.25, 0.18, 1.3),
  "white maize":      P(3330, 8.3, 2.5, 3.8, 0.02, 0.10, 0.24, 0.17, 1.3),
  sorghum:            P(3250, 9.0, 2.3, 2.9, 0.03, 0.10, 0.22, 0.16, 1.6),
  guineacorn:         P(3250, 9.0, 2.3, 2.9, 0.03, 0.10, 0.22, 0.16, 1.6),
  millet:             P(3000, 11.0, 3.5, 4.0, 0.05, 0.12, 0.28, 0.22, 2.0),
  "soybean meal":     P(2440, 44.0, 6.5, 1.5, 0.29, 0.22, 2.80, 0.62, 6.3),
  "full fat soybean": P(3300, 36.0, 5.5, 18.0, 0.25, 0.20, 2.30, 0.53, 4.5),
  "groundnut cake":   P(2500, 45.0, 7.0, 6.0, 0.15, 0.18, 1.50, 0.45, 5.0),
  "palm kernel cake": P(1550, 16.0, 16.0, 6.5, 0.30, 0.18, 0.50, 0.28, 4.5),
  "cotton seed cake": P(2100, 41.0, 12.0, 2.0, 0.20, 0.25, 1.60, 0.52, 6.0),
  "fish meal":        P(2800, 60.0, 1.0, 8.0, 5.00, 2.80, 4.50, 1.70, 20.0),
  "blood meal":       P(2700, 80.0, 1.0, 1.0, 0.30, 0.25, 6.90, 0.95, 5.0),
  "bone meal":        P(0, 1.0, 0.0, 0.0, 24.0, 12.0, 0.0, 0.0, 80.0),
  "wheat bran":       P(1300, 15.5, 11.0, 4.0, 0.14, 0.35, 0.60, 0.22, 6.0),
  "wheat offal":      P(1300, 15.5, 11.0, 4.0, 0.14, 0.35, 0.60, 0.22, 6.0),
  "rice bran":        P(2100, 12.0, 13.0, 13.0, 0.07, 0.30, 0.55, 0.25, 10.0),
  "brewers dried grain": P(2000, 25.0, 15.0, 6.5, 0.30, 0.25, 0.80, 0.45, 4.5),
  "cassava meal":     P(3200, 2.5, 4.0, 0.5, 0.15, 0.08, 0.09, 0.04, 2.5),
  "layer concentrate": P(2100, 38.0, 4.0, 5.0, 8.00, 3.00, 2.60, 1.30, 25.0),
  "broiler concentrate": P(2200, 40.0, 4.0, 6.0, 5.00, 2.50, 2.80, 1.40, 22.0),
  concentrate:        P(2100, 38.0, 4.0, 5.0, 8.00, 3.00, 2.60, 1.30, 25.0),
  limestone:          P(0, 0, 0, 0, 38.0, 0.02, 0, 0, 98.0),
  "oyster shell":     P(0, 0, 0, 0, 38.0, 0.02, 0, 0, 98.0),
  dcp:                P(0, 0, 0, 0, 23.0, 18.0, 0, 0, 95.0),
  "dicalcium phosphate": P(0, 0, 0, 0, 23.0, 18.0, 0, 0, 95.0),
  salt:               P(0, 0, 0, 0, 0, 0, 0, 0, 100.0),
  lysine:             P(0, 95.0, 0, 0, 0, 0, 78.0, 0, 0),
  "lysine hcl":       P(0, 95.0, 0, 0, 0, 0, 78.0, 0, 0),
  methionine:         P(0, 58.0, 0, 0, 0, 0, 0, 99.0, 0),
  "dl-methionine":    P(0, 58.0, 0, 0, 0, 0, 0, 99.0, 0),
  premix:             P(0, 0, 0, 0, 2.0, 1.0, 0, 0, 90.0),
  "toxin binder":     P(0, 0, 0, 0, 1.0, 0, 0, 0, 95.0),
  "palm oil":         P(8600, 0, 0, 99.0, 0, 0, 0, 0, 0),
  "vegetable oil":    P(8800, 0, 0, 99.0, 0, 0, 0, 0, 0),
  "soya oil":         P(8800, 0, 0, 99.0, 0, 0, 0, 0, 0),
};

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ");

/** Best-effort lookup: exact match, then substring match on either side. */
export function lookupNutrients(name: string): NutrientProfile | null {
  const n = norm(name);
  if (!n) return null;
  if (INGREDIENT_NUTRIENTS[n]) return INGREDIENT_NUTRIENTS[n];
  let best: { key: string; profile: NutrientProfile } | null = null;
  for (const [key, profile] of Object.entries(INGREDIENT_NUTRIENTS)) {
    if (n.includes(key) || key.includes(n)) {
      if (!best || key.length > best.key.length) best = { key, profile };
    }
  }
  return best?.profile ?? null;
}

export type NutritionLine = {
  name: string;
  weightKg: number;
  inclusionPct: number;
  profile: NutrientProfile | null;
};

export type NutritionResult = {
  /** Weighted nutrient values of the finished feed (per kg / %). */
  totals: NutrientProfile;
  /** Weight (kg) whose ingredients had a known nutrient profile. */
  knownKg: number;
  totalKg: number;
  /** 0–100: how much of the mix weight could be analysed. */
  coveragePct: number;
  unknown: string[];
  lines: NutritionLine[];
};

/**
 * Weighted-average nutrient analysis.
 * Each nutrient is averaged over the KNOWN weight only, so an unrecognised
 * ingredient dilutes confidence (coveragePct) rather than silently dragging
 * every value toward zero.
 */
export function computeNutrition(
  items: { name: string; weightKg: number }[],
): NutritionResult {
  const totalKg = items.reduce((s, i) => s + Math.max(0, i.weightKg), 0);
  const lines: NutritionLine[] = items.map((i) => ({
    name: i.name,
    weightKg: Math.max(0, i.weightKg),
    inclusionPct: totalKg > 0 ? (Math.max(0, i.weightKg) / totalKg) * 100 : 0,
    profile: lookupNutrients(i.name),
  }));

  const knownKg = lines.reduce((s, l) => s + (l.profile ? l.weightKg : 0), 0);
  const totals = { me: 0, cp: 0, cf: 0, ee: 0, ca: 0, p: 0, lys: 0, met: 0, ash: 0 } as NutrientProfile;
  if (knownKg > 0) {
    for (const l of lines) {
      if (!l.profile) continue;
      const w = l.weightKg / knownKg;
      for (const k of NUTRIENT_KEYS) totals[k] += l.profile[k] * w;
    }
  }

  return {
    totals,
    knownKg,
    totalKg,
    coveragePct: totalKg > 0 ? (knownKg / totalKg) * 100 : 0,
    unknown: lines.filter((l) => !l.profile && l.weightKg > 0).map((l) => l.name),
    lines,
  };
}

/* ------------------------------ Target specs ----------------------------- */

export type BirdSpec = {
  id: string;
  label: string;
  ranges: Partial<Record<NutrientKey, [number, number]>>;
};

export const BIRD_SPECS: BirdSpec[] = [
  {
    id: "layer",
    label: "Layer (in lay)",
    ranges: { me: [2650, 2850], cp: [16, 18], cf: [3, 7], ee: [3, 6], ca: [3.5, 4.5], p: [0.35, 0.45], lys: [0.75, 0.9], met: [0.35, 0.45] },
  },
  {
    id: "grower",
    label: "Grower / Pullet",
    ranges: { me: [2600, 2800], cp: [15, 17], cf: [4, 8], ee: [3, 6], ca: [0.9, 1.2], p: [0.35, 0.45], lys: [0.65, 0.8], met: [0.3, 0.4] },
  },
  {
    id: "chick",
    label: "Chick / Starter mash",
    ranges: { me: [2750, 2950], cp: [19, 21], cf: [3, 5], ee: [3, 6], ca: [0.9, 1.1], p: [0.4, 0.5], lys: [1.0, 1.2], met: [0.45, 0.55] },
  },
  {
    id: "broiler_starter",
    label: "Broiler Starter",
    ranges: { me: [2900, 3050], cp: [21, 23], cf: [3, 5], ee: [4, 8], ca: [0.9, 1.1], p: [0.45, 0.5], lys: [1.2, 1.4], met: [0.5, 0.6] },
  },
  {
    id: "broiler_finisher",
    label: "Broiler Finisher",
    ranges: { me: [3000, 3200], cp: [18, 20], cf: [3, 5], ee: [5, 9], ca: [0.85, 1.0], p: [0.4, 0.45], lys: [1.0, 1.2], met: [0.42, 0.5] },
  },
];

export type NutrientStatus = "low" | "ok" | "high" | "none";

export function statusFor(spec: BirdSpec, key: NutrientKey, value: number): NutrientStatus {
  const r = spec.ranges[key];
  if (!r) return "none";
  if (value < r[0]) return "low";
  if (value > r[1]) return "high";
  return "ok";
}

export const NUTRIENT_META: Record<NutrientKey, { label: string; unit: string; digits: number; group: "macro" | "micro" }> = {
  me:  { label: "Energy (ME)", unit: "kcal/kg", digits: 0, group: "macro" },
  cp:  { label: "Crude Protein", unit: "%", digits: 2, group: "macro" },
  cf:  { label: "Crude Fibre", unit: "%", digits: 2, group: "macro" },
  ee:  { label: "Fat (Ether Extract)", unit: "%", digits: 2, group: "macro" },
  ca:  { label: "Calcium", unit: "%", digits: 2, group: "micro" },
  p:   { label: "Av. Phosphorus", unit: "%", digits: 2, group: "micro" },
  lys: { label: "Lysine", unit: "%", digits: 2, group: "micro" },
  met: { label: "Methionine", unit: "%", digits: 2, group: "micro" },
  ash: { label: "Ash", unit: "%", digits: 2, group: "micro" },
};
