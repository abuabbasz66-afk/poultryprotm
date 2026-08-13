// Flock age tracking.
//
// Age is NEVER stored as a static number of weeks. We store an anchor date
// (the real or estimated placement date) and derive the current age from it,
// so every flock grows a day older automatically.
//
// `age_status`:
//   "recorded"  — the farmer gave a real placement date
//   "estimated" — the farmer only knew the current age, so the start date was
//                 back-calculated from today (clearly labelled in the UI)
//   "missing"   — nothing recorded yet; no age is ever assumed
import type { Room } from "@/lib/farm-data";

export type AgeStatus = "recorded" | "estimated" | "missing";

export const BIRD_TYPES = ["Broiler", "Layer", "Noiler", "Other"] as const;

export function ageStatus(room: Pick<Room, "age_status" | "age_anchor_date">): AgeStatus {
  if (!room.age_anchor_date) return "missing";
  return room.age_status === "estimated" ? "estimated" : "recorded";
}

export function hasAge(room: Pick<Room, "age_status" | "age_anchor_date">) {
  return ageStatus(room) !== "missing";
}

/** Whole days between the anchor date and today. */
export function ageDays(anchor: string, on: Date = new Date()) {
  const start = new Date(`${anchor}T00:00:00`);
  const today = new Date(on.getFullYear(), on.getMonth(), on.getDate());
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
}

export type FlockAge = { status: AgeStatus; days: number; weeks: number; remainderDays: number };

export function flockAge(
  room: Pick<Room, "age_status" | "age_anchor_date">,
  on: Date = new Date(),
): FlockAge {
  const status = ageStatus(room);
  if (status === "missing" || !room.age_anchor_date) {
    return { status, days: 0, weeks: 0, remainderDays: 0 };
  }
  const days = ageDays(room.age_anchor_date, on);
  return { status, days, weeks: Math.floor(days / 7), remainderDays: days % 7 };
}

export function ageLabel(age: FlockAge) {
  if (age.status === "missing") return "Age not recorded";
  return `${age.weeks} ${age.weeks === 1 ? "Week" : "Weeks"} · ${age.days} Days`;
}

/** Estimated placement date for a flock the farmer says is `weeks` old today. */
export function estimatedStartDate(weeks: number, on: Date = new Date()) {
  const d = new Date(on.getFullYear(), on.getMonth(), on.getDate() - Math.round(weeks * 7));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function roomsMissingAge(rooms: Room[]) {
  return rooms.filter((r) => (r.status ?? "active") !== "culled" && !hasAge(r));
}

/**
 * Age-based reminders (feed benchmarks, vaccination schedules, growth targets…)
 * must stay switched off until a flock's age is known.
 */
export function ageFeaturesEnabled(room: Pick<Room, "age_status" | "age_anchor_date">) {
  return hasAge(room);
}

/** Growth stage, only meaningful once the age is known. */
export function flockStage(room: Room, on: Date = new Date()): string | null {
  const age = flockAge(room, on);
  if (age.status === "missing") return null;
  const type = (room.bird_type ?? "").toLowerCase();
  if (type.includes("broiler") || type.includes("noiler")) {
    if (age.days <= 10) return "Starter";
    if (age.days <= 24) return "Grower";
    return "Finisher";
  }
  if (age.weeks < 8) return "Chick";
  if (age.weeks < 18) return "Grower / Pullet";
  if (age.weeks < 22) return "Point of Lay";
  return "Laying";
}
