// Farmer-facing weather guidance: temperature bands, adjusted for humidity,
// bird type and age, turned into a short message plus practical actions.
// Management advice only — never medication instructions.

import type { FarmWeather } from "@/lib/weather-sources";
import type { FlockProfile } from "@/lib/weather-advisory";

export type Severity = "normal" | "watch" | "warning" | "critical";

export const SEVERITY_META: Record<Severity, { label: string; emoji: string; badge: string; ring: string }> = {
  normal: { label: "Normal", emoji: "🟢", badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25", ring: "border-emerald-500/25" },
  watch: { label: "Watch", emoji: "🟡", badge: "bg-amber-400/15 text-amber-700 border-amber-400/30", ring: "border-amber-400/40" },
  warning: { label: "Warning", emoji: "🟠", badge: "bg-orange-500/10 text-orange-700 border-orange-500/30", ring: "border-orange-500/40" },
  critical: { label: "Critical", emoji: "🔴", badge: "bg-red-600/10 text-red-700 border-red-600/35", ring: "border-red-600/40" },
};

const SEV_ORDER: Severity[] = ["normal", "watch", "warning", "critical"];
export const severityRank = (s: Severity) => SEV_ORDER.indexOf(s);

export type ActionKind = "water" | "air" | "feed" | "birds" | "cold";
export const ACTION_EMOJI: Record<ActionKind, string> = { water: "💧", air: "🌬️", feed: "🌾", birds: "🐔", cold: "🧣" };
export type Action = { kind: ActionKind; text: string };

type Band = { min: number; label: string; emoji: string; severity: Severity; message: string; actions: Action[] };

const A = (kind: ActionKind, text: string): Action => ({ kind, text });

/** Adult-bird bands (layers in particular), coldest first. */
const ADULT_BANDS: Band[] = [
  {
    min: -Infinity, label: "Very cold", emoji: "🥶", severity: "watch",
    message: "It's quite cold today. Your birds may use more energy to stay warm. Check the house for cold drafts and make sure the birds have easy access to feed and clean water.",
    actions: [A("cold", "Check for cold drafts"), A("cold", "Keep litter dry"), A("birds", "Monitor bird behaviour"), A("birds", "Give extra attention to young birds"), A("air", "Keep ventilation adequate without harmful drafts")],
  },
  {
    min: 15, label: "Cool", emoji: "🌥️", severity: "normal",
    message: "The weather is cool today. Your birds should generally be comfortable, but keep an eye on their behaviour, especially early in the morning and at night.",
    actions: [A("cold", "Keep the house dry"), A("cold", "Avoid unnecessary drafts"), A("feed", "Monitor feed and water intake"), A("birds", "Watch for birds huddling together")],
  },
  {
    min: 18, label: "Comfortable", emoji: "🙂", severity: "normal",
    message: "Nice conditions for your flock. The temperature is comfortable for the birds. Keep your normal feeding, watering and ventilation routine.",
    actions: [A("air", "Maintain normal ventilation"), A("water", "Keep clean water available"), A("birds", "Continue routine monitoring")],
  },
  {
    min: 20, label: "Ideal conditions", emoji: "✅", severity: "normal",
    message: "Great conditions for your flock today. The temperature is within a comfortable range for laying birds. Keep your normal farm routine and continue monitoring the house.",
    actions: [A("feed", "Maintain normal feeding"), A("air", "Maintain good ventilation"), A("water", "Keep fresh water available"), A("birds", "Continue routine health checks")],
  },
  {
    min: 24, label: "Getting warm", emoji: "🌤️", severity: "watch",
    message: "It's starting to get warm. Your birds may begin to feel the heat, especially during the afternoon. Keep ventilation moving and make sure fresh water is available.",
    actions: [A("air", "Increase airflow where possible"), A("water", "Check all drinkers"), A("water", "Keep water fresh"), A("feed", "Monitor feed intake"), A("birds", "Watch egg production and shell quality")],
  },
  {
    min: 27, label: "Heat stress watch", emoji: "🌡️", severity: "watch",
    message: "Your flock may be feeling the heat. Take a few minutes to check the house, especially ventilation and water availability. Watch for panting or birds spreading their wings.",
    actions: [A("air", "Increase ventilation"), A("water", "Check all drinkers"), A("water", "Provide cool, clean water"), A("birds", "Reduce unnecessary handling"), A("birds", "Check the birds more often"), A("feed", "Move feeding away from the hottest hours where appropriate")],
  },
  {
    min: 30, label: "High heat", emoji: "🔥", severity: "warning",
    message: "It's hot enough to need attention. Your birds may be under heat stress. Focus on airflow, cool water and reducing unnecessary activity during the hottest hours.",
    actions: [A("air", "Maximise safe ventilation"), A("water", "Check every drinker"), A("water", "Keep water as cool as practical"), A("birds", "Avoid unnecessary handling"), A("birds", "Watch for panting and unusual behaviour"), A("feed", "Monitor feed intake and production")],
  },
  {
    min: 32, label: "Severe heat", emoji: "🔥", severity: "warning",
    message: "Your flock needs extra attention today. Heat stress can become serious at these temperatures. Make cooling and water your priority and check the birds regularly.",
    actions: [A("water", "Make sure water access is unrestricted"), A("air", "Maximise airflow"), A("water", "Check drinkers frequently"), A("birds", "Avoid handling birds during peak heat"), A("birds", "Monitor mortality closely"), A("air", "Use appropriate cooling measures"), A("birds", "Follow your farm's heat-stress plan")],
  },
  {
    min: 35, label: "Critical heat", emoji: "🚨", severity: "critical",
    message: "High heat alert. Your flock is at serious risk of heat stress. Please check the house and birds now. Water and airflow should be your first priorities.",
    actions: [A("water", "Check all water lines and drinkers now"), A("air", "Maximise ventilation and airflow"), A("air", "Provide appropriate cooling"), A("birds", "Avoid moving or handling birds"), A("birds", "Watch the birds and mortality closely"), A("birds", "Call a vet or farm adviser if birds show severe distress")],
  },
  {
    min: 38, label: "Extreme heat", emoji: "🚨", severity: "critical",
    message: "Extreme heat alert. Please act now — your birds may be at significant risk. Check water, ventilation and bird behaviour now and keep checking until temperatures fall.",
    actions: [A("water", "Make sure every bird can reach water"), A("air", "Maximise safe airflow"), A("air", "Switch on any available cooling"), A("birds", "Postpone unnecessary farm activities"), A("birds", "Monitor mortality closely"), A("birds", "Follow your emergency heat-stress plan"), A("birds", "Seek veterinary help if birds show severe distress")],
  },
];

const hasHumidity = (h: number | null | undefined): h is number => typeof h === "number" && Number.isFinite(h) && h > 0;

/**
 * Degrees added to the air temperature before picking a band. Humid air stops
 * birds cooling by panting, so heat bands arrive sooner. Only applied when it
 * is already warm — humidity does not make cold weather "hotter".
 */
function humidityShift(tempC: number, rh: number | null): number {
  if (!hasHumidity(rh) || tempC < 24) return 0;
  if (rh >= 80) return 3;
  if (rh >= 70) return 2;
  if (rh >= 60) return 0.5;
  if (rh < 40) return -1;
  return 0;
}

/** Heavier / producing birds carry more body heat. */
function ageShift(flock: FlockProfile, tempC: number): number {
  if (tempC < 24) return 0;
  const age = flock.ageDays;
  if (flock.kind === "broiler" && age != null) return age >= 29 ? 2 : age >= 22 ? 1 : 0;
  if (flock.kind === "layer" && age != null && age >= 140) return 0.5;
  return 0;
}

/** Brooding target (°C) by chick age, general starting guidance. */
export function broodingTarget(ageDays: number): [number, number] {
  if (ageDays <= 7) return [32, 35];
  if (ageDays <= 14) return [29, 32];
  if (ageDays <= 21) return [26, 29];
  if (ageDays <= 28) return [24, 27];
  return [21, 24];
}

export type Guidance = {
  flock: FlockProfile;
  mode: "adult" | "chick";
  tempC: number;
  humidity: number | null;
  humidityConsidered: boolean;
  label: string;
  emoji: string;
  severity: Severity;
  message: string;
  actions: Action[];
  /** Short notes: humidity, forecast trend, chick target, support protocol. */
  notes: string[];
  flockLine: string;
};

function isChick(flock: FlockProfile) {
  const age = flock.ageDays;
  if (age == null) return flock.kind === "brooding";
  if (flock.kind === "brooding") return age <= 42;
  if (flock.kind === "broiler") return age <= 14;
  return age <= 35;
}

export function flockLine(flock: FlockProfile) {
  const kind = flock.kind === "broiler" ? "Broiler flock" : flock.kind === "brooding" ? "Chicks / rearing" : "Layer flock";
  const age = flock.ageDays;
  if (age == null) return kind;
  return `${kind} | ${age < 14 ? `${age} day${age === 1 ? "" : "s"}` : `${Math.floor(age / 7)} weeks`}`;
}

function chickGuidance(flock: FlockProfile, tempC: number, rh: number | null, afternoon: boolean): Guidance {
  const age = flock.ageDays ?? 7;
  const [lo, hi] = broodingTarget(age);
  const base = { flock, mode: "chick" as const, tempC, humidity: hasHumidity(rh) ? rh : null, humidityConsidered: false, flockLine: flockLine(flock) };
  const target = `Brooder target for this age: about ${lo}–${hi}°C at chick level. Outdoor temperature is only a guide — go by the brooder thermometer and how the chicks behave.`;
  const behaviour = "Chicks spread evenly = comfortable. Crowding under the heat source = too cold. Moving away from the heat, panting = too warm.";
  const notes = [target, behaviour];

  if (tempC < lo - 8) {
    return {
      ...base, label: "Cold for chicks", emoji: "🥶", severity: tempC < lo - 14 ? "warning" : "watch",
      message: "Your chicks may be feeling cold. If they are crowding together under the heat source, increase the available heat and check the brooder temperature.",
      actions: [A("cold", "Check brooder heat is working"), A("cold", "Block drafts at chick level"), A("cold", "Keep litter dry"), A("birds", "Watch for crowding under the heater"), A("water", "Keep water clean and slightly warm, not cold")],
      notes,
    };
  }
  if (tempC >= hi) {
    return {
      ...base, label: "Warm for chicks", emoji: "🌡️", severity: tempC >= hi + 3 ? "warning" : "watch",
      message: `The brooder may get too warm${afternoon ? " this afternoon" : " today"}. Check the temperature and watch the chicks — if they move away from the heat source or pant, reduce the heat gradually.`,
      actions: [A("cold", "Reduce brooder heat gradually"), A("air", "Increase fresh air without drafts"), A("water", "Keep cool, clean water available"), A("birds", "Watch for chicks moving away from heat")],
      notes,
    };
  }
  return {
    ...base, label: "Keep brooder steady", emoji: "🐣", severity: "normal",
    message: "Outdoor conditions are manageable. Keep the brooder at the right temperature for the chicks' age and let their behaviour guide small adjustments.",
    actions: [A("cold", "Check brooder temperature morning and evening"), A("water", "Keep clean water available"), A("birds", "Watch how the chicks spread out")],
    notes,
  };
}

/** Forecast trend over the next ~8 hours, when hourly data exists. */
function trendNote(weather: FarmWeather | null, tempC: number): string | null {
  const next = weather?.hourly?.slice(1, 9) ?? [];
  if (next.length < 3) return null;
  const max = Math.max(...next.map((h) => h.tempC));
  const min = Math.min(...next.map((h) => h.tempC));
  const rain = Math.max(...next.map((h) => h.rainChance));
  if (max - tempC >= 3 && max >= 27) return `☀️ Temperatures are expected to rise to about ${Math.round(max)}°C in the coming hours. Check ventilation and water before the hottest period.`;
  if (tempC - min >= 3 || rain >= 60) return "🌧️ Cooler conditions are expected later. Keep normal ventilation but avoid strong drafts, and keep litter dry.";
  return null;
}

export function buildGuidance(
  flock: FlockProfile,
  input: { tempC: number; humidity: number | null; hour?: number; weather?: FarmWeather | null },
): Guidance {
  const { tempC } = input;
  const rh = hasHumidity(input.humidity) ? input.humidity : null;
  const hour = input.hour ?? new Date().getHours();
  const afternoon = hour >= 11 && hour < 17;
  const trend = trendNote(input.weather ?? null, tempC);

  if (isChick(flock)) {
    const g = chickGuidance(flock, tempC, rh, afternoon);
    if (trend) g.notes.push(trend);
    return g;
  }

  const hShift = humidityShift(tempC, rh);
  const effective = tempC + hShift + ageShift(flock, tempC);
  const band = [...ADULT_BANDS].reverse().find((b) => effective >= b.min)!;
  let message = band.message;
  if (hShift >= 2 && band.min >= 24) {
    message = "Heat stress risk is higher than the temperature alone suggests. The air is humid, which makes it harder for your birds to cool themselves. Increase airflow and make sure clean, cool water is readily available.";
  }
  if (afternoon && band.min >= 27) message = message.replace(/today\.?/, "this afternoon.");
  if (hour >= 19 || hour < 6) {
    if (band.min >= 27) message += " Heat can linger in the house after dark, so keep air moving tonight.";
  }

  const notes: string[] = [];
  if (rh != null && hShift > 0) notes.push(`💧 Humidity is ${Math.round(rh)}%, so the advisory is stronger than for the same temperature in dry air.`);
  if (rh == null) notes.push("Humidity data is not available right now, so this advisory is based on temperature only.");
  if (flock.kind === "layer" && (flock.ageDays ?? 0) >= 140 && band.min >= 27) notes.push("Laying birds often eat less before egg numbers drop — keep an eye on feed intake and shell quality over the next few days.");
  if (flock.kind === "broiler" && (flock.ageDays ?? 0) >= 22 && band.min >= 27) notes.push("Heavier broilers feel heat most. Record water intake — a drop often shows up before anything else.");
  if (trend) notes.push(trend);
  if (severityRank(band.severity) >= severityRank("warning")) {
    notes.push("If you use electrolytes or vitamins, follow your farm's approved heat-stress support protocol or consult your veterinarian.");
  }

  return {
    flock, mode: "adult", tempC, humidity: rh, humidityConsidered: rh != null,
    label: band.label, emoji: band.emoji, severity: band.severity, message,
    actions: band.actions, notes, flockLine: flockLine(flock),
  };
}

/** Top priorities for compact displays: one per category, in order. */
export function priorityActions(g: Guidance, max = 3): Action[] {
  const seen = new Set<ActionKind>();
  const out: Action[] = [];
  for (const a of g.actions) {
    if (seen.has(a.kind)) continue;
    seen.add(a.kind);
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
}
