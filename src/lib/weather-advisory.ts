// Poultry-specific weather interpretation.
//
// This is NOT a human heat index. Bird heat load is driven by temperature AND
// humidity together, because birds cool themselves by panting (evaporative
// loss) and humid air blocks that. We use the poultry Temperature-Humidity
// Index (THI, Celsius form) and then shift the thresholds by bird type and
// age, because a 35-day broiler and a 5-day chick experience the same air
// very differently.
//
// Everything here is an AGRICULTURAL MANAGEMENT ADVISORY — never a veterinary
// diagnosis, and never a medication recommendation.

import type { FarmWeather, WeatherDay, WeatherHour } from "@/lib/weather.functions";

export type RiskLevel = "low" | "watch" | "moderate" | "high" | "severe";

export const RISK_META: Record<RiskLevel, { label: string; emoji: string; badge: string; dot: string; bar: string }> = {
  low: { label: "Low", emoji: "🟢", badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  watch: { label: "Watch", emoji: "🟡", badge: "bg-amber-400/10 text-amber-600 border-amber-400/25", dot: "bg-amber-400", bar: "bg-amber-400" },
  moderate: { label: "Moderate", emoji: "🟠", badge: "bg-orange-500/10 text-orange-600 border-orange-500/25", dot: "bg-orange-500", bar: "bg-orange-500" },
  high: { label: "High", emoji: "🔴", badge: "bg-red-500/10 text-red-600 border-red-500/25", dot: "bg-red-500", bar: "bg-red-500" },
  severe: { label: "Severe", emoji: "🚨", badge: "bg-red-600/15 text-red-700 border-red-600/35", dot: "bg-red-600", bar: "bg-red-600" },
};

export const RISK_ORDER: RiskLevel[] = ["low", "watch", "moderate", "high", "severe"];
export const riskRank = (r: RiskLevel) => RISK_ORDER.indexOf(r);
export const worstRisk = (a: RiskLevel, b: RiskLevel) => (riskRank(a) >= riskRank(b) ? a : b);

export type FlockKind = "broiler" | "layer" | "brooding";

export type FlockProfile = {
  kind: FlockKind;
  label: string;
  /** Age in days, when known. */
  ageDays: number | null;
  birds: number;
  rooms: number;
};

/** Poultry THI (Celsius). Panting-based cooling makes humidity a real driver. */
export function poultryTHI(tempC: number, humidity: number) {
  return 0.8 * tempC + (humidity / 100) * (tempC - 14.4) + 46.4;
}

/**
 * Threshold shift (in THI points) applied per flock. A negative shift means
 * the flock reaches a given risk level at a LOWER THI, i.e. it is more
 * vulnerable: heavy finishing broilers and mature laying hens carry the most
 * metabolic heat, while young chicks are mainly at risk from cold, not heat.
 */
function thiShift(flock: FlockProfile): number {
  const age = flock.ageDays;
  if (flock.kind === "broiler") {
    if (age == null) return -1;
    if (age >= 29) return -4; // finishing birds, heaviest heat load
    if (age >= 22) return -3;
    if (age >= 15) return -1;
    if (age >= 8) return 0;
    return 2; // day-olds tolerate warmth, they need it
  }
  if (flock.kind === "layer") {
    if (age == null) return -2;
    if (age >= 140) return -3; // in lay: heat suppresses intake, eggs and shell quality
    if (age >= 70) return -1;
    return 0;
  }
  // brooding / rearing
  if (age == null) return 1;
  if (age <= 14) return 3;
  if (age <= 42) return 1;
  return 0;
}

const BASE = { watch: 72, moderate: 76, high: 80, severe: 84 };

export function heatRisk(tempC: number, humidity: number, flock: FlockProfile): RiskLevel {
  const thi = poultryTHI(tempC, humidity) - thiShift(flock);
  if (thi >= BASE.severe) return "severe";
  if (thi >= BASE.high) return "high";
  if (thi >= BASE.moderate) return "moderate";
  if (thi >= BASE.watch) return "watch";
  return "low";
}

/** Chill risk matters most for chicks; brooder heat, not outdoor air, is the fix. */
export function chillRisk(tempC: number, flock: FlockProfile): RiskLevel {
  const age = flock.ageDays ?? 999;
  if (flock.kind === "brooding" || age <= 21) {
    if (tempC < 16) return "high";
    if (tempC < 20) return "moderate";
    if (tempC < 24) return "watch";
    return "low";
  }
  if (tempC < 10) return "moderate";
  if (tempC < 14) return "watch";
  return "low";
}

export function combinedRisk(tempC: number, humidity: number, flock: FlockProfile): RiskLevel {
  return worstRisk(heatRisk(tempC, humidity, flock), chillRisk(tempC, flock));
}

export function dayRisk(day: WeatherDay, flock: FlockProfile): RiskLevel {
  return worstRisk(heatRisk(day.highC, day.humidity, flock), chillRisk(day.lowC, flock));
}

/** Peak-risk window for a given calendar day, e.g. "1 PM – 5 PM". */
export function peakWindow(hours: WeatherHour[], date: string, flock: FlockProfile) {
  const dayHours = hours.filter((h) => h.time.slice(0, 10) === date);
  const risky = dayHours.filter((h) => riskRank(heatRisk(h.tempC, h.humidity, flock)) >= riskRank("moderate"));
  if (risky.length === 0) return null;
  const hr = (t: string) => Number(t.slice(11, 13));
  const fmt = (n: number) => `${((n + 11) % 12) + 1} ${n < 12 ? "AM" : "PM"}`;
  const start = hr(risky[0]!.time);
  const end = hr(risky[risky.length - 1]!.time);
  const peak = risky.reduce((a, b) => (poultryTHI(b.tempC, b.humidity) > poultryTHI(a.tempC, a.humidity) ? b : a));
  return {
    label: start === end ? fmt(start) : `${fmt(start)} – ${fmt(end + 1)}`,
    level: heatRisk(peak.tempC, peak.humidity, flock),
    hours: risky.length,
  };
}

/** Short, actionable, management-only guidance. Never medication advice. */
export function advisory(
  level: RiskLevel,
  flock: FlockProfile,
  ctx: { tempC: number; humidity: number; rainChance: number; peak?: string | null },
): string[] {
  const out: string[] = [];
  const age = flock.ageDays;
  const chilly = riskRank(chillRisk(ctx.tempC, flock)) >= riskRank("watch");

  if (flock.kind === "brooding") {
    out.push(
      "Young stock detected. Outdoor temperature must NOT be used to set brooder temperature — measure it at chick level and watch chick distribution (evenly spread = comfortable, huddled = cold, spread to walls and panting = too hot).",
    );
    if (chilly) out.push("Cool air expected. Check brooder heat, block draughts at chick level and keep litter dry before nightfall.");
    if (riskRank(level) >= riskRank("moderate")) out.push("Warm conditions expected. Ease off brooder heat gradually, increase fresh-air exchange without creating draughts, and keep cool clean water always available.");
    if (age != null && age > 42) out.push("Growing pullets: keep feed and water space adequate and weigh a sample weekly to stay on the target growth curve.");
    out.push("Consult a veterinarian if birds show signs of illness or severe distress.");
    return out;
  }

  const heatLine: Record<RiskLevel, string> = {
    low: "Conditions are comfortable for the flock. Maintain normal ventilation, water and routine checks.",
    watch: "Mild heat load possible. Watch drinking behaviour and keep ventilation steady through the warmest hours.",
    moderate: `Moderate heat risk expected${ctx.peak ? ` around ${ctx.peak}` : ""}. Monitor drinking behaviour and ventilation, particularly during the afternoon.`,
    high: `High heat risk expected${ctx.peak ? ` around ${ctx.peak}` : " this afternoon"}. Ensure unrestricted access to clean cool water, maximise ventilation and airflow at bird level, and avoid unnecessary handling during peak heat.`,
    severe: `Severe heat risk expected${ctx.peak ? ` around ${ctx.peak}` : ""}. Treat this as an emergency management day: extra drinkers with cool water, maximum airflow, no handling, no transport, and physically check the house during the peak period.`,
  };
  out.push(heatLine[level]);

  if (flock.kind === "broiler") {
    if (age != null && age >= 22) out.push("Finishing broilers carry the highest heat load. Shift feeding to the cooler early morning and evening hours and record water intake — a drop in water usually appears before any other sign.");
    else if (age != null && age <= 14) out.push("Young broilers still need warmth. Confirm house temperature at bird level rather than relying on outdoor readings.");
    if (riskRank(level) >= riskRank("moderate")) out.push("Track daily feed intake, weight gain and mortality closely today; heat-suppressed intake shows up as slower gain and a worse feed conversion later in the cycle.");
  } else {
    if (age != null && age >= 140) out.push("Laying flock: expect intake to fall before egg numbers do. Keep feed available in the cooler hours, watch shell quality and collect eggs more often so they do not sit in the heat.");
    if (riskRank(level) >= riskRank("moderate")) out.push("Collect eggs more frequently and check for a rise in broken or thin-shelled eggs over the next few days.");
  }

  if (chilly) out.push("Cool spell expected. Reduce draughts, keep litter dry and confirm birds are not crowding for warmth.");
  if (ctx.rainChance >= 60) out.push("Rain likely: check roofing and drainage, keep litter dry and protect feed from damp — wet litter and damp feed create their own problems.");
  if (ctx.humidity >= 80 && riskRank(level) >= riskRank("watch")) out.push("Humidity is high, so birds cannot cool themselves by panting as effectively. Prioritise air movement over air temperature alone.");

  out.push("Management advisory only — not a veterinary diagnosis. Never medicate because of weather; call a veterinarian if birds show illness or severe distress.");
  return out;
}

/** Tomorrow's alert, when it warrants one. */
export function tomorrowAlert(weather: FarmWeather, flocks: FlockProfile[]) {
  const tomorrow = weather.daily[1];
  if (!tomorrow) return null;
  let level: RiskLevel = "low";
  let worstFlock: FlockProfile | null = null;
  for (const f of flocks) {
    const r = dayRisk(tomorrow, f);
    if (riskRank(r) > riskRank(level)) {
      level = r;
      worstFlock = f;
    }
  }
  if (riskRank(level) < riskRank("high")) return null;
  const peak = worstFlock ? peakWindow(weather.hourly, tomorrow.date, worstFlock) : null;
  return { level, day: tomorrow, flock: worstFlock, peak };
}

export const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 81: "Rain showers",
  82: "Violent rain showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
};
export const conditionLabel = (code: number) => WEATHER_CODES[code] ?? "Mixed conditions";
