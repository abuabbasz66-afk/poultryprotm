/**
 * Feed nutrition engine.
 *
 * Two tiers of ingredient data:
 *  1. LABORATORY TESTED  – exact values from Humane Diagnostic and Nutritional
 *     Laboratory reports (ABZ Global Resources). Never rounded or replaced.
 *  2. Reference book values – generic fallbacks for ingredients that have not
 *     been laboratory tested yet.
 *
 * Units (as-fed basis):
 *  - me       Metabolisable energy, kcal/kg
 *  - cp       Crude protein, %
 *  - cf       Crude fibre, %
 *  - ee       Crude fat / ether extract, %
 *  - moisture Moisture, %
 *  - ash      Ash, %
 *  - ca       Calcium, %
 *  - p        Available phosphorus, %
 *  - lys      Lysine, %
 *  - met      Methionine, %
 */
export type NutrientProfile = {
  me: number; cp: number; cf: number; ee: number;
  ca: number; p: number; lys: number; met: number; ash: number;
  /** Optional — only recorded where a laboratory measured it. */
  moisture?: number;
};

export const NUTRIENT_KEYS = [
  "me", "cp", "ee", "cf", "moisture", "ash", "ca", "p", "lys", "met",
] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export type NutritionSource = "Laboratory Tested" | "Reference Database";

/** Reference limits supplied by the laboratory report (kept apart from actuals). */
export type ReferenceLimits = Partial<Record<NutrientKey, { min?: number; max?: number }>>;

export type IngredientNutrition = {
  /** Canonical display name. */
  name: string;
  profile: NutrientProfile;
  nutrition_source: NutritionSource;
  lab_tested: boolean;
  laboratory?: string;
  lab_division?: string;
  report_date?: string;
  report_number?: string;
  prepared_for?: string;
  reference_limits?: ReferenceLimits;
  /** Alternate spellings farmers may type. */
  aliases?: string[];
};

const P = (
  me: number, cp: number, cf: number, ee: number,
  ca: number, p: number, lys: number, met: number, ash: number,
): NutrientProfile => ({ me, cp, cf, ee, ca, p, lys, met, ash });

const LAB = "HUMANE DIAGNOSTIC AND NUTRITIONAL LABORATORY";
const LAB_DIVISION = "A Division of Humane Agro Nig. Ltd.";
const PREPARED_FOR = "ABZ Global Resources";

/* ------------------------- Laboratory-tested profiles ------------------------ */

export const LAB_INGREDIENTS: IngredientNutrition[] = [
  {
    name: "Maize",
    // CP 9.93 · Fat 1.95 · Fibre 2.51 · Moisture 8.08 · Ash 2.21 · ME 3163.120
    profile: { me: 3163.120, cp: 9.93, cf: 2.51, ee: 1.95, moisture: 8.08, ash: 2.21, ca: 0.02, p: 0.10, lys: 0.25, met: 0.18 },
    nutrition_source: "Laboratory Tested",
    lab_tested: true,
    laboratory: LAB, lab_division: LAB_DIVISION, prepared_for: PREPARED_FOR,
    report_date: "2025-10-28", report_number: "HGL25/594",
    aliases: ["yellow maize", "white maize", "corn"],
  },
  {
    name: "Soybean Meal (SBM)",
    profile: { me: 2812.395, cp: 47.47, cf: 5.09, ee: 7.70, moisture: 10.35, ash: 4.87, ca: 0.29, p: 0.22, lys: 2.80, met: 0.62 },
    nutrition_source: "Laboratory Tested",
    lab_tested: true,
    laboratory: LAB, lab_division: LAB_DIVISION, prepared_for: PREPARED_FOR,
    report_date: "2025-12-08", report_number: "HGL25/NUT/631",
    reference_limits: { ee: { max: 4.5 } },
    aliases: ["soybean meal", "sbm", "soya meal", "soyabean meal"],
  },
  {
    name: "Wheat Offal",
    profile: { me: 1498.855, cp: 15.31, cf: 23.75, ee: 2.95, moisture: 9.27, ash: 4.56, ca: 0.14, p: 0.35, lys: 0.60, met: 0.22 },
    nutrition_source: "Laboratory Tested",
    lab_tested: true,
    laboratory: LAB, lab_division: LAB_DIVISION, prepared_for: PREPARED_FOR,
    report_date: "2025-10-23", report_number: "HGL25/587",
    reference_limits: { cf: { max: 17 } },
    aliases: ["wheat bran", "wheat offals"],
  },
  {
    name: "Layer Concentrate",
    profile: { me: 2376.763, cp: 30.47, cf: 3.55, ee: 2.44, moisture: 6.99, ash: 21.70, ca: 8.00, p: 3.00, lys: 2.60, met: 1.30 },
    nutrition_source: "Laboratory Tested",
    lab_tested: true,
    laboratory: LAB, lab_division: LAB_DIVISION, prepared_for: PREPARED_FOR,
    report_date: "2025-10-11", report_number: "HGL25/NUT/569",
    aliases: ["concentrate", "layers concentrate"],
  },
  {
    name: "Baobab Powder",
    profile: { me: 1991.808, cp: 10.93, cf: 26.38, ee: 2.87, moisture: 6.38, ash: 14.78, ca: 0, p: 0, lys: 0, met: 0 },
    nutrition_source: "Laboratory Tested",
    lab_tested: true,
    laboratory: LAB, lab_division: LAB_DIVISION, prepared_for: PREPARED_FOR,
    report_date: "2025-10-28", report_number: "HGL25/595",
    aliases: ["baobab", "kuka powder", "kuka"],
  },
];

/**
 * Laboratory-tested FINISHED FEED reference (not a raw ingredient).
 * Shown for comparison only; never auto-added to the ingredient selector.
 */
export const LAB_FEED_REFERENCES: IngredientNutrition[] = [
  {
    name: "Laboratory-Tested Layer Mash Reference",
    profile: { me: 2399.040, cp: 25.16, cf: 13.02, ee: 2.57, moisture: 8.66, ash: 14.65, ca: 0, p: 0, lys: 0, met: 0.53 },
    nutrition_source: "Laboratory Tested",
    lab_tested: true,
    laboratory: LAB, lab_division: LAB_DIVISION, prepared_for: PREPARED_FOR,
    report_date: "2025-10-23", report_number: "HGL25/586",
  },
];

/* --------------------- Generic fallback (book) values ---------------------- */

/** Keyed by a normalised ingredient name. Used only when no lab profile matches. */
export const INGREDIENT_NUTRIENTS: Record<string, NutrientProfile> = {
  sorghum:            P(3250, 9.0, 2.3, 2.9, 0.03, 0.10, 0.22, 0.16, 1.6),
  guineacorn:         P(3250, 9.0, 2.3, 2.9, 0.03, 0.10, 0.22, 0.16, 1.6),
  millet:             P(3000, 11.0, 3.5, 4.0, 0.05, 0.12, 0.28, 0.22, 2.0),
  "full fat soybean": P(3300, 36.0, 5.5, 18.0, 0.25, 0.20, 2.30, 0.53, 4.5),
  "groundnut cake":   P(2500, 45.0, 7.0, 6.0, 0.15, 0.18, 1.50, 0.45, 5.0),
  "palm kernel cake": P(1550, 16.0, 16.0, 6.5, 0.30, 0.18, 0.50, 0.28, 4.5),
  "cotton seed cake": P(2100, 41.0, 12.0, 2.0, 0.20, 0.25, 1.60, 0.52, 6.0),
  "fish meal":        P(2800, 60.0, 1.0, 8.0, 5.00, 2.80, 4.50, 1.70, 20.0),
  "blood meal":       P(2700, 80.0, 1.0, 1.0, 0.30, 0.25, 6.90, 0.95, 5.0),
  "bone meal":        P(0, 1.0, 0.0, 0.0, 24.0, 12.0, 0.0, 0.0, 80.0),
  "rice bran":        P(2100, 12.0, 13.0, 13.0, 0.07, 0.30, 0.55, 0.25, 10.0),
  "brewers dried grain": P(2000, 25.0, 15.0, 6.5, 0.30, 0.25, 0.80, 0.45, 4.5),
  "cassava meal":     P(3200, 2.5, 4.0, 0.5, 0.15, 0.08, 0.09, 0.04, 2.5),
  "broiler concentrate": P(2200, 40.0, 4.0, 6.0, 5.00, 2.50, 2.80, 1.40, 22.0),
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

const tokens = (s: string) => norm(s).split(" ").filter(Boolean);

/** True when every token of `key` appears as a whole word in `n` (no partial-word hits). */
function tokenSubset(key: string, n: string): boolean {
  const kt = tokens(key);
  if (!kt.length) return false;
  const nt = new Set(tokens(n));
  return kt.every((t) => nt.has(t));
}

/** Laboratory profile lookup (exact name or alias only). */
export function lookupLabIngredient(name: string): IngredientNutrition | null {
  const n = norm(name);
  if (!n) return null;
  for (const ing of LAB_INGREDIENTS) {
    const keys = [norm(ing.name), ...(ing.aliases ?? []).map(norm)];
    if (keys.includes(n)) return ing;
  }
  return null;
}

/** Laboratory profile lookup allowing whole-word fuzzy matching (e.g. "yellow maize"). */
function lookupLabIngredientFuzzy(name: string): IngredientNutrition | null {
  const n = norm(name);
  if (!n) return null;
  let best: { len: number; ing: IngredientNutrition } | null = null;
  for (const ing of LAB_INGREDIENTS) {
    for (const k of [norm(ing.name), ...(ing.aliases ?? []).map(norm)]) {
      if (k.length < 3) continue;
      if (tokenSubset(k, n) && (!best || k.length > best.len)) best = { len: k.length, ing };
    }
  }
  return best?.ing ?? null;
}

/** Full ingredient info: laboratory profile first, generic book values as fallback. */
export function lookupIngredient(name: string): IngredientNutrition | null {
  const exactLab = lookupLabIngredient(name);
  if (exactLab) return exactLab;

  const n = norm(name);
  if (!n) return null;

  // An exact reference-book match beats a loose laboratory name match, so
  // "broiler concentrate" never picks up Layer Concentrate figures.
  if (INGREDIENT_NUTRIENTS[n]) {
    return { name, profile: INGREDIENT_NUTRIENTS[n], nutrition_source: "Reference Database", lab_tested: false };
  }

  const fuzzyLab = lookupLabIngredientFuzzy(name);
  if (fuzzyLab) {
    // Prefer a more specific book entry when one matches more of the typed name.
    let bookBest: { key: string; profile: NutrientProfile } | null = null;
    for (const [key, profile] of Object.entries(INGREDIENT_NUTRIENTS)) {
      if (tokenSubset(key, n) && (!bookBest || key.length > bookBest.key.length)) bookBest = { key, profile };
    }
    const labKeyLen = Math.max(
      ...[norm(fuzzyLab.name), ...(fuzzyLab.aliases ?? []).map(norm)]
        .filter((k) => tokenSubset(k, n))
        .map((k) => k.length),
    );
    if (bookBest && bookBest.key.length > labKeyLen) {
      return { name, profile: bookBest.profile, nutrition_source: "Reference Database", lab_tested: false };
    }
    return fuzzyLab;
  }

  let best: { key: string; profile: NutrientProfile } | null = null;
  for (const [key, profile] of Object.entries(INGREDIENT_NUTRIENTS)) {
    if (tokenSubset(key, n) || n.includes(key)) {
      if (!best || key.length > best.key.length) best = { key, profile };
    }
  }
  return best ? { name, profile: best.profile, nutrition_source: "Reference Database", lab_tested: false } : null;
}


/** Back-compat helper. */
export function lookupNutrients(name: string): NutrientProfile | null {
  return lookupIngredient(name)?.profile ?? null;
}

export type ReferenceFlag = {
  ingredient: string;
  nutrient: NutrientKey;
  actual: number;
  limit: number;
  kind: "above" | "below";
};

export type NutritionLine = {
  name: string;
  weightKg: number;
  inclusionPct: number;
  profile: NutrientProfile | null;
  info: IngredientNutrition | null;
  labTested: boolean;
};

export type NutritionResult = {
  /** Weighted values of the finished feed (per kg / %). */
  totals: NutrientProfile & { moisture: number };
  /** Per-nutrient analysed weight — a nutrient missing on an ingredient is excluded. */
  knownKgByNutrient: Record<NutrientKey, number>;
  knownKg: number;
  totalKg: number;
  /** 0–100: how much of the mix weight could be analysed. */
  coveragePct: number;
  labKg: number;
  labCoveragePct: number;
  unknown: string[];
  flags: ReferenceFlag[];
  lines: NutritionLine[];
};

/**
 * Weight-based (never bag-based) weighted analysis.
 *   nutrient % = Σ(weightKg × nutrient%) ÷ Σ(analysed weightKg)
 *   ME kcal/kg = Σ(weightKg × ME) ÷ Σ(analysed weightKg)
 */
export function computeNutrition(
  items: { name: string; weightKg: number }[],
): NutritionResult {
  const totalKg = items.reduce((s, i) => s + Math.max(0, i.weightKg), 0);
  const lines: NutritionLine[] = items.map((i) => {
    const info = lookupIngredient(i.name);
    return {
      name: i.name,
      weightKg: Math.max(0, i.weightKg),
      inclusionPct: totalKg > 0 ? (Math.max(0, i.weightKg) / totalKg) * 100 : 0,
      profile: info?.profile ?? null,
      info,
      labTested: !!info?.lab_tested,
    };
  });

  const knownKg = lines.reduce((s, l) => s + (l.profile ? l.weightKg : 0), 0);
  const labKg = lines.reduce((s, l) => s + (l.labTested ? l.weightKg : 0), 0);

  const totals = { me: 0, cp: 0, cf: 0, ee: 0, ca: 0, p: 0, lys: 0, met: 0, ash: 0, moisture: 0 };
  const knownKgByNutrient = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as Record<NutrientKey, number>;

  for (const k of NUTRIENT_KEYS) {
    let sum = 0;
    let w = 0;
    for (const l of lines) {
      const v = l.profile?.[k];
      if (v == null || l.weightKg <= 0) continue;
      sum += v * l.weightKg;
      w += l.weightKg;
    }
    knownKgByNutrient[k] = w;
    totals[k] = w > 0 ? sum / w : 0;
  }

  const flags: ReferenceFlag[] = [];
  for (const l of lines) {
    const limits = l.info?.reference_limits;
    if (!limits || l.weightKg <= 0) continue;
    for (const k of NUTRIENT_KEYS) {
      const lim = limits[k];
      const actual = l.profile?.[k];
      if (!lim || actual == null) continue;
      if (lim.max != null && actual > lim.max) flags.push({ ingredient: l.info!.name, nutrient: k, actual, limit: lim.max, kind: "above" });
      if (lim.min != null && actual < lim.min) flags.push({ ingredient: l.info!.name, nutrient: k, actual, limit: lim.min, kind: "below" });
    }
  }

  return {
    totals,
    knownKgByNutrient,
    knownKg,
    totalKg,
    coveragePct: totalKg > 0 ? (knownKg / totalKg) * 100 : 0,
    labKg,
    labCoveragePct: totalKg > 0 ? (labKg / totalKg) * 100 : 0,
    unknown: lines.filter((l) => !l.profile && l.weightKg > 0).map((l) => l.name),
    flags,
    lines,
  };
}

/* ------------------------------ Target specs ----------------------------- */

export type BirdSpec = {
  id: string;
  label: string;
  ranges: Partial<Record<NutrientKey, [number, number]>>;
};

/** Targets ONLY. These never overwrite an actual laboratory value. */
export const BIRD_SPECS: BirdSpec[] = [
  {
    id: "layer",
    label: "Layer (in lay)",
    ranges: { me: [2650, 2850], cp: [16, 18], cf: [3, 7], ee: [3, 6], moisture: [8, 13], ca: [3.5, 4.5], p: [0.35, 0.45], lys: [0.75, 0.9], met: [0.35, 0.45] },
  },
  {
    id: "grower",
    label: "Grower / Pullet",
    ranges: { me: [2600, 2800], cp: [15, 17], cf: [4, 8], ee: [3, 6], moisture: [8, 13], ca: [0.9, 1.2], p: [0.35, 0.45], lys: [0.65, 0.8], met: [0.3, 0.4] },
  },
  {
    id: "chick",
    label: "Chick / Starter mash",
    ranges: { me: [2750, 2950], cp: [19, 21], cf: [3, 5], ee: [3, 6], moisture: [8, 13], ca: [0.9, 1.1], p: [0.4, 0.5], lys: [1.0, 1.2], met: [0.45, 0.55] },
  },
  {
    id: "broiler_starter",
    label: "Broiler Starter",
    ranges: { me: [2900, 3050], cp: [21, 23], cf: [3, 5], ee: [4, 8], moisture: [8, 13], ca: [0.9, 1.1], p: [0.45, 0.5], lys: [1.2, 1.4], met: [0.5, 0.6] },
  },
  {
    id: "broiler_finisher",
    label: "Broiler Finisher",
    ranges: { me: [3000, 3200], cp: [18, 20], cf: [3, 5], ee: [5, 9], moisture: [8, 13], ca: [0.85, 1.0], p: [0.4, 0.45], lys: [1.0, 1.2], met: [0.42, 0.5] },
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
  ee:  { label: "Crude Fat", unit: "%", digits: 2, group: "macro" },
  cf:  { label: "Crude Fibre", unit: "%", digits: 2, group: "macro" },
  moisture: { label: "Moisture", unit: "%", digits: 2, group: "macro" },
  ash: { label: "Ash", unit: "%", digits: 2, group: "macro" },
  ca:  { label: "Calcium", unit: "%", digits: 2, group: "micro" },
  p:   { label: "Av. Phosphorus", unit: "%", digits: 2, group: "micro" },
  lys: { label: "Lysine", unit: "%", digits: 2, group: "micro" },
  met: { label: "Methionine", unit: "%", digits: 2, group: "micro" },
};
