import { createServerFn } from "@tanstack/react-start";

/**
 * Farm weather feed.
 *
 * Uses Open-Meteo (keyless, no account needed) for geocoding + forecast so the
 * farmer never types weather data manually — the farm's saved location is the
 * only input. The raw numbers are interpreted for birds client-side in
 * src/lib/weather-advisory.ts; this function only fetches facts.
 */

export type WeatherHour = {
  time: string;
  tempC: number;
  humidity: number;
  feelsLikeC: number;
  windKph: number;
  rainChance: number;
};

export type WeatherDay = {
  date: string;
  highC: number;
  lowC: number;
  humidity: number;
  rainChance: number;
  windKph: number;
  code: number;
};

export type FarmWeather = {
  place: string;
  latitude: number;
  longitude: number;
  timezone: string;
  fetchedAt: string;
  current: {
    tempC: number;
    humidity: number;
    feelsLikeC: number;
    windKph: number;
    rainChance: number;
    code: number;
    isDay: boolean;
  };
  hourly: WeatherHour[];
  daily: WeatherDay[];
};

export type FarmWeatherResult =
  | { ok: true; weather: FarmWeather }
  | { ok: false; error: string };

type Input = { location?: string | null; state?: string | null; country?: string | null };

async function geocode(q: string) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=" +
    encodeURIComponent(q);
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[];
  };
  const hit = json.results?.[0];
  if (!hit) return null;
  return {
    label: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", "),
    latitude: hit.latitude,
    longitude: hit.longitude,
  };
}

export const getFarmWeather = createServerFn({ method: "GET" })
  .inputValidator((input: Input) => ({
    location: (input?.location ?? "").trim(),
    state: (input?.state ?? "").trim(),
    country: (input?.country ?? "").trim(),
  }))
  .handler(async ({ data }): Promise<FarmWeatherResult> => {
    const candidates = [
      [data.location, data.state, data.country].filter(Boolean).join(", "),
      [data.location, data.country].filter(Boolean).join(", "),
      [data.state, data.country].filter(Boolean).join(", "),
      data.location,
      data.state,
    ].filter((s) => s && s.length > 1) as string[];

    if (candidates.length === 0) {
      return { ok: false, error: "No farm location saved. Add your farm location in Settings." };
    }

    let place: Awaited<ReturnType<typeof geocode>> = null;
    for (const q of candidates) {
      try {
        place = await geocode(q);
      } catch {
        place = null;
      }
      if (place) break;
    }
    if (!place) {
      return { ok: false, error: `We could not locate "${candidates[0]}". Check the farm location in Settings.` };
    }

    const params = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      timezone: "auto",
      forecast_days: "7",
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,precipitation_probability,weather_code,is_day",
      hourly: "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,precipitation_probability",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code",
    });

    let json: any;
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
      if (!res.ok) throw new Error(`forecast ${res.status}`);
      json = await res.json();
    } catch {
      return { ok: false, error: "Weather service is unavailable right now. Please try again shortly." };
    }

    const h = json.hourly ?? {};
    const times: string[] = h.time ?? [];
    const nowIso = new Date().toISOString().slice(0, 13);
    const startIdx = Math.max(0, times.findIndex((t: string) => t.slice(0, 13) >= nowIso));

    const hourly: WeatherHour[] = times.slice(startIdx, startIdx + 48).map((t: string, i: number) => {
      const k = startIdx + i;
      return {
        time: t,
        tempC: Number(h.temperature_2m?.[k] ?? 0),
        humidity: Number(h.relative_humidity_2m?.[k] ?? 0),
        feelsLikeC: Number(h.apparent_temperature?.[k] ?? 0),
        windKph: Number(h.wind_speed_10m?.[k] ?? 0),
        rainChance: Number(h.precipitation_probability?.[k] ?? 0),
      };
    });

    const d = json.daily ?? {};
    const dayHumidity = (date: string) => {
      const vals = times
        .map((t: string, i: number) => (t.slice(0, 10) === date ? Number(h.relative_humidity_2m?.[i] ?? NaN) : NaN))
        .filter((n: number) => Number.isFinite(n));
      return vals.length ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : 0;
    };

    const daily: WeatherDay[] = (d.time ?? []).map((date: string, i: number) => ({
      date,
      highC: Number(d.temperature_2m_max?.[i] ?? 0),
      lowC: Number(d.temperature_2m_min?.[i] ?? 0),
      humidity: dayHumidity(date),
      rainChance: Number(d.precipitation_probability_max?.[i] ?? 0),
      windKph: Number(d.wind_speed_10m_max?.[i] ?? 0),
      code: Number(d.weather_code?.[i] ?? 0),
    }));

    const c = json.current ?? {};
    return {
      ok: true,
      weather: {
        place: place.label,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: json.timezone ?? "UTC",
        fetchedAt: new Date().toISOString(),
        current: {
          tempC: Number(c.temperature_2m ?? 0),
          humidity: Number(c.relative_humidity_2m ?? 0),
          feelsLikeC: Number(c.apparent_temperature ?? c.temperature_2m ?? 0),
          windKph: Number(c.wind_speed_10m ?? 0),
          rainChance: Number(c.precipitation_probability ?? hourly[0]?.rainChance ?? 0),
          code: Number(c.weather_code ?? 0),
          isDay: Number(c.is_day ?? 1) === 1,
        },
        hourly,
        daily,
      },
    };
  });
