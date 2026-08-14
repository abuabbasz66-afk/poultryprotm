// ---------------------------------------------------------------------------
// PoultryPro AI — Data Validation layer
//
// No record automatically becomes trusted intelligence input. Every record is
// classified VALID / REVIEW_REQUIRED / INVALID by deterministic rules. Only
// VALID records feed the baselines, forecasts and cross-farm aggregation.
// Nothing here mutates farm data — it only classifies it.
// ---------------------------------------------------------------------------
import type { EggRow, Feed, Health, Mortality, Room } from "@/lib/farm-data";
import { eggSlots, type EggColumn } from "@/lib/rooms";
import { totalEggsFromRow } from "@/lib/egg-normalize";
import { roomBirdsOn } from "@/lib/production-percent";

export type QualityStatus = "VALID" | "REVIEW_REQUIRED" | "INVALID";

export type QualityFlag = {
  sourceTable: "egg_production" | "mortality" | "feed_usage" | "health_records" | "rooms";
  sourceId: string;
  entryDate: string | null;
  rule: string;
  status: QualityStatus;
  detail: string;
};

export type QualityReport = {
  flags: QualityFlag[];
  /** ids that must be excluded from learning datasets */
  invalid: Set<string>;
  review: Set<string>;
  counts: { valid: number; review: number; invalid: number; total: number };
  /** 0-100 share of records that passed every rule */
  score: number;
};

const CRATE = 30;
const isDate = (s: string | null | undefined) =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

const todayKey = () => new Date().toISOString().slice(0, 10);

export function validateFarmData(input: {
  eggs: EggRow[];
  rooms: Room[];
  mortality: Mortality[];
  feed: Feed[];
  health: Health[];
  bagWeightKg: number | null;
}): QualityReport {
  const { eggs, rooms, mortality, feed, health } = input;
  const bagKg = input.bagWeightKg && input.bagWeightKg > 0 ? input.bagWeightKg : 25;
  const flags: QualityFlag[] = [];
  const invalid = new Set<string>();
  const review = new Set<string>();
  const today = todayKey();

  const push = (f: QualityFlag) => {
    flags.push(f);
    if (f.status === "INVALID") invalid.add(f.sourceId);
    else if (f.status === "REVIEW_REQUIRED") review.add(f.sourceId);
  };

  // ---- Rooms -------------------------------------------------------------
  for (const r of rooms) {
    if (!Number.isFinite(Number(r.current)) || Number(r.current) < 0) {
      push({ sourceTable: "rooms", sourceId: r.id, entryDate: null, rule: "impossible_bird_count",
        status: "INVALID", detail: `${r.name}: bird count is negative or missing.` });
    } else if (r.initial > 0 && r.current > r.initial) {
      push({ sourceTable: "rooms", sourceId: r.id, entryDate: null, rule: "population_exceeds_placement",
        status: "REVIEW_REQUIRED", detail: `${r.name}: current birds (${r.current}) exceed birds placed (${r.initial}).` });
    }
    if (r.age_anchor_date && r.age_anchor_date > today) {
      push({ sourceTable: "rooms", sourceId: r.id, entryDate: r.age_anchor_date, rule: "future_placement_date",
        status: "INVALID", detail: `${r.name}: placement date is in the future.` });
    }
  }

  // ---- Egg production ----------------------------------------------------
  const slots = eggSlots(rooms);
  const seenEggDates = new Map<string, string>();
  const sortedEggs = [...eggs].sort((a, b) => a.date.localeCompare(b.date));
  const eggTotals = sortedEggs.map((e) => totalEggsFromRow(e));

  sortedEggs.forEach((e, i) => {
    if (!isDate(e.date)) {
      push({ sourceTable: "egg_production", sourceId: e.id, entryDate: null, rule: "invalid_date",
        status: "INVALID", detail: `Production record has an unreadable date (${e.date}).` });
      return;
    }
    if (e.date > today) {
      push({ sourceTable: "egg_production", sourceId: e.id, entryDate: e.date, rule: "future_date",
        status: "INVALID", detail: "Production recorded for a future date." });
    }
    const dupe = seenEggDates.get(e.date);
    if (dupe) {
      push({ sourceTable: "egg_production", sourceId: e.id, entryDate: e.date, rule: "duplicate_record",
        status: "REVIEW_REQUIRED", detail: `A second production record exists for ${e.date}.` });
    } else seenEggDates.set(e.date, e.id);

    for (const { room, key } of slots) {
      const crates = Number(e[key]) || 0;
      const broken = Number((e as unknown as Record<string, number | undefined>)[`broken_${key}` as EggColumn]) || 0;
      if (crates < 0 || broken < 0) {
        push({ sourceTable: "egg_production", sourceId: e.id, entryDate: e.date, rule: "negative_value",
          status: "INVALID", detail: `${room.name}: negative eggs or broken eggs on ${e.date}.` });
        continue;
      }
      const birds = roomBirdsOn(room, e.date, mortality);
      if (birds) {
        const laid = crates * CRATE;
        if (laid > birds * 1.05) {
          push({ sourceTable: "egg_production", sourceId: e.id, entryDate: e.date, rule: "impossible_production",
            status: "INVALID", detail: `${room.name}: ${laid} eggs from ${birds} birds on ${e.date} (over 105% lay).` });
        } else if (laid > birds * 0.98) {
          push({ sourceTable: "egg_production", sourceId: e.id, entryDate: e.date, rule: "unusually_high_production",
            status: "REVIEW_REQUIRED", detail: `${room.name}: lay rate above 98% on ${e.date}.` });
        }
      }
    }

    // sudden unrealistic swing vs the previous record
    const prev = eggTotals[i - 1];
    const now = eggTotals[i];
    if (i > 0 && prev != null && prev > 200 && now != null) {
      const change = Math.abs(now - prev) / prev;
      if (change > 0.6) {
        push({ sourceTable: "egg_production", sourceId: e.id, entryDate: e.date, rule: "sudden_change",
          status: "REVIEW_REQUIRED", detail: `Total eggs changed ${(change * 100).toFixed(0)}% versus the previous record (${e.date}).` });
      }
    }
  });

  // ---- Mortality ---------------------------------------------------------
  const roomByName = new Map(rooms.map((r) => [r.name, r]));
  const seenMortality = new Set<string>();
  for (const m of mortality) {
    if (!isDate(m.date)) {
      push({ sourceTable: "mortality", sourceId: m.id, entryDate: null, rule: "invalid_date",
        status: "INVALID", detail: `Mortality record has an unreadable date (${m.date}).` });
      continue;
    }
    if (m.date > today) {
      push({ sourceTable: "mortality", sourceId: m.id, entryDate: m.date, rule: "future_date",
        status: "INVALID", detail: "Mortality recorded for a future date." });
    }
    if (!Number.isFinite(m.loss) || m.loss < 0) {
      push({ sourceTable: "mortality", sourceId: m.id, entryDate: m.date, rule: "negative_value",
        status: "INVALID", detail: "Mortality loss is negative or missing." });
      continue;
    }
    const sig = `${m.room}|${m.date}|${m.loss}|${m.cause}`;
    if (seenMortality.has(sig)) {
      push({ sourceTable: "mortality", sourceId: m.id, entryDate: m.date, rule: "duplicate_record",
        status: "REVIEW_REQUIRED", detail: `Identical mortality entry already recorded for ${m.room} on ${m.date}.` });
    } else seenMortality.add(sig);

    const room = roomByName.get(m.room);
    const birds = room ? roomBirdsOn(room, m.date, mortality) : null;
    if (birds && m.loss > birds) {
      push({ sourceTable: "mortality", sourceId: m.id, entryDate: m.date, rule: "impossible_mortality",
        status: "INVALID", detail: `${m.room}: ${m.loss} losses exceed the ${birds} birds present on ${m.date}.` });
    } else if (birds && m.loss / birds > 0.05) {
      push({ sourceTable: "mortality", sourceId: m.id, entryDate: m.date, rule: "unusually_high_mortality",
        status: "REVIEW_REQUIRED", detail: `${m.room}: ${((m.loss / birds) * 100).toFixed(1)}% of the room lost in one day (${m.date}).` });
    }
  }

  // ---- Feed --------------------------------------------------------------
  const totalBirds = rooms.reduce((s, r) => s + (Number(r.current) || 0), 0);
  for (const f of feed) {
    if (!isDate(f.date)) {
      push({ sourceTable: "feed_usage", sourceId: f.id, entryDate: null, rule: "invalid_date",
        status: "INVALID", detail: `Feed record has an unreadable date (${f.date}).` });
      continue;
    }
    if (f.date > today) {
      push({ sourceTable: "feed_usage", sourceId: f.id, entryDate: f.date, rule: "future_date",
        status: "INVALID", detail: "Feed usage recorded for a future date." });
    }
    if (!Number.isFinite(f.bags) || f.bags < 0) {
      push({ sourceTable: "feed_usage", sourceId: f.id, entryDate: f.date, rule: "negative_value",
        status: "INVALID", detail: "Feed quantity is negative or missing." });
      continue;
    }
    const kg = f.bags * bagKg;
    if (totalBirds > 0 && kg / totalBirds > 0.25) {
      push({ sourceTable: "feed_usage", sourceId: f.id, entryDate: f.date, rule: "unusually_high_feed",
        status: "REVIEW_REQUIRED", detail: `${f.room}: ${kg.toFixed(0)} kg on ${f.date} is over 250 g per bird.` });
    }
  }

  // ---- Health ------------------------------------------------------------
  for (const h of health) {
    if (!isDate(h.date)) {
      push({ sourceTable: "health_records", sourceId: h.id, entryDate: null, rule: "invalid_date",
        status: "INVALID", detail: `Health record "${h.name}" has an unreadable date.` });
    } else if (h.date > today) {
      push({ sourceTable: "health_records", sourceId: h.id, entryDate: h.date, rule: "future_date",
        status: "REVIEW_REQUIRED", detail: `Health record "${h.name}" is dated in the future.` });
    }
  }

  const total = eggs.length + mortality.length + feed.length + health.length + rooms.length;
  const flaggedIds = new Set<string>([...invalid, ...review]);
  const valid = Math.max(0, total - flaggedIds.size);

  return {
    flags,
    invalid,
    review,
    counts: { valid, review: review.size, invalid: invalid.size, total },
    score: total ? Math.round((valid / total) * 100) : 0,
  };
}

/** Records eligible for learning: VALID only (REVIEW_REQUIRED is excluded). */
export function eligible<T extends { id: string }>(rows: T[], report: QualityReport): T[] {
  return rows.filter((r) => !report.invalid.has(r.id) && !report.review.has(r.id));
}

export const QUALITY_TONE: Record<QualityStatus, string> = {
  VALID: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  REVIEW_REQUIRED: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  INVALID: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};
