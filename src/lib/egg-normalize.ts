// Shared egg normalisation utility for PoultryPro.
// Rule: 30 eggs = 1 crate. Extras of >= 30 roll into crates.
//
// Canonical total: totalEggs = (recordedCrates * 30) + originalExtra
//                             = (normalisedCrates * 30) + remainingExtra
//
// This normalisation is display-only; underlying farm records are never modified.

export type EggRowLike = { r2: number; r3: number; r4: number; extra: number };

export type NormalisedEggs = {
  /** Complete crates after rolling extras into crates. */
  crates: number;
  /** Remaining loose eggs in the range 0–29. */
  extra: number;
  /** Full egg quantity, guaranteed equal to crates*30 + extra. */
  totalEggs: number;
};

export function normaliseEggs(recordedCrates: number, extraEggs: number): NormalisedEggs {
  const safeCrates = Math.max(0, Math.floor(Number(recordedCrates) || 0));
  const safeExtra = Math.max(0, Math.floor(Number(extraEggs) || 0));
  const totalEggs = safeCrates * 30 + safeExtra;
  const crates = Math.floor(totalEggs / 30);
  const extra = totalEggs % 30;
  return { crates, extra, totalEggs };
}

export function totalEggsFromRow(r: EggRowLike): number {
  return (r.r2 + r.r3 + r.r4) * 30 + r.extra;
}

export function normaliseEggRow(r: EggRowLike): NormalisedEggs {
  return normaliseEggs(r.r2 + r.r3 + r.r4, r.extra);
}
