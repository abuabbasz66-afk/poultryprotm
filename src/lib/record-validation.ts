// Pure checks for unusual or impossible farm records, plus the shared
// feed-cost-per-crate formula. Warnings never block authorised users: a
// suspicious value can be saved after the user confirms it, because real farms
// sometimes record eggs gathered over more than one collection or day.

const CRATE = 30;

/** Feed cost to produce one crate (30 usable eggs). Null when it can't be known. */
export function feedCostPerCrate(feedKg: number, usableEggs: number, costPerKg: number): number | null {
  if (!Number.isFinite(feedKg) || !Number.isFinite(usableEggs) || !Number.isFinite(costPerKg)) return null;
  if (feedKg < 0 || usableEggs <= 0 || costPerKg <= 0) return null;
  return ((feedKg / usableEggs) * CRATE) * costPerKg;
}

export type RecordWarning = { level: "warning" | "error"; message: string };

export type EggRoomInput = {
  name: string;
  collectedEggs: number;
  brokenEggs: number;
  /** Birds in the room on the production date; null when unknown. */
  birds: number | null;
};

/**
 * Egg checks per room:
 * - negative or non-whole numbers → error
 * - broken more than collected → error (already enforced by the form)
 * - eggs from a room with no birds recorded → warning
 * - more eggs than birds (lay above 100%) → warning, since one hen lays at most
 *   one egg a day; valid only if eggs from more than one day were combined.
 */
export function checkEggRecord(rooms: EggRoomInput[]): RecordWarning[] {
  const out: RecordWarning[] = [];
  for (const r of rooms) {
    const vals = [r.collectedEggs, r.brokenEggs];
    if (vals.some((v) => !Number.isFinite(v) || v < 0)) {
      out.push({ level: "error", message: `${r.name}: numbers cannot be negative.` });
      continue;
    }
    if (vals.some((v) => !Number.isInteger(v))) {
      out.push({ level: "error", message: `${r.name}: use whole numbers of crates and eggs.` });
      continue;
    }
    if (r.collectedEggs === 0) continue;
    if (r.birds === 0) {
      out.push({
        level: "warning",
        message: `${r.name} has no birds recorded, but ${r.collectedEggs} eggs were entered. Check the room or its bird count.`,
      });
    } else if (r.birds !== null && r.collectedEggs > r.birds) {
      const pct = (r.collectedEggs / r.birds) * 100;
      out.push({
        level: "warning",
        message: `${r.name}: ${r.collectedEggs} eggs from ${r.birds} birds is ${pct.toFixed(0)}% lay. A hen lays at most one egg a day, so this only fits if eggs from more than one day were combined.`,
      });
    }
  }
  return out;
}

/** Mortality checks against the birds present in the room on that date. */
export function checkMortalityRecord(input: { room: string; loss: number; birdsAtRisk: number | null }): RecordWarning[] {
  const { room, loss, birdsAtRisk } = input;
  if (!Number.isFinite(loss) || loss <= 0) return [{ level: "error", message: "Enter at least 1 bird." }];
  if (!Number.isInteger(loss)) return [{ level: "error", message: "Use a whole number of birds." }];
  if (birdsAtRisk === null) return [];
  if (loss > birdsAtRisk) {
    return [{
      level: "warning",
      message: `${room} had ${birdsAtRisk} birds on that date, but ${loss} deaths were entered. This would leave a negative bird balance. Check the room and number.`,
    }];
  }
  if (birdsAtRisk > 0 && loss / birdsAtRisk > 0.05) {
    return [{
      level: "warning",
      message: `${loss} deaths is ${((loss / birdsAtRisk) * 100).toFixed(1)}% of ${room} in one entry. Please double-check the number. If it is correct, consider contacting your veterinarian.`,
    }];
  }
  return [];
}

/** Bird balance after losses; never silently clamps — negative means the records disagree. */
export function birdBalance(opening: number, losses: number, added = 0, removed = 0): number {
  return opening + added - losses - removed;
}
