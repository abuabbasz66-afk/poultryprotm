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
  /** Forecast days, today first. */
  daily: WeatherDay[];
  /** The last 10 days of observed weather, used for historical correlation. */
  history: WeatherDay[];
};

export type FarmWeatherResult =
  | { ok: true; weather: FarmWeather; resolved: { latitude: number; longitude: number; place: string } }
  | { ok: false; error: string; stage: "location" | "geocode" | "forecast"; detail: string };

type Input = {
  latitude?: number | null;
  longitude?: number | null;
  location?: string | null;
  state?: string | null;
  country?: string | null;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** fetch with timeout + one retry — transient network blips must not kill the page. */
async function fetchJson(url: string, label: string): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "PoultryPro/1.0 (farm weather advisory)" },
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) throw new Error(`${label} responded ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      console.error(`[weather] ${label} attempt ${attempt + 1} failed:`, err);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${label} failed`);
}

async function geocodeOpenMeteo(q: string) {
  const json = await fetchJson(
    "https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=" + encodeURIComponent(q),
    "geocoding",
  );
  const hit = json?.results?.[0];
  if (!hit) return null;
  return {
    label: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", "),
    latitude: Number(hit.latitude),
    longitude: Number(hit.longitude),
  };
}

/** Second opinion when Open-Meteo's gazetteer does not know a village name. */
async function geocodeNominatim(q: string) {
  const json = await fetchJson(
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(q),
    "backup geocoding",
  );
  const hit = Array.isArray(json) ? json[0] : null;
  if (!hit) return null;
  return {
    label: String(hit.display_name ?? q).split(",").slice(0, 3).join(",").trim(),
    latitude: Number(hit.lat),
    longitude: Number(hit.lon),
  };
}

export const getFarmWeather = createServerFn({ method: "GET" })
  .inputValidator((input: Input) => ({
    latitude: num(input?.latitude),
    longitude: num(input?.longitude),
    location: (input?.location ?? "").trim(),
    state: (input?.state ?? "").trim(),
    country: (input?.country ?? "").trim(),
  }))
  .handler(async ({ data }): Promise<FarmWeatherResult> => {
    let place: { label: string; latitude: number; longitude: number } | null = null;

    if (data.latitude != null && data.longitude != null) {
      place = {
        label: [data.location, data.state, data.country].filter(Boolean).join(", ") || "Saved farm coordinates",
        latitude: data.latitude,
        longitude: data.longitude,
      };
    }

    if (!place) {
      const candidates = [
        [data.location, data.state, data.country].filter(Boolean).join(", "),
        [data.location, data.country].filter(Boolean).join(", "),
        [data.state, data.country].filter(Boolean).join(", "),
        data.location,
        data.state,
      ].filter((s) => s && s.length > 1) as string[];

      if (candidates.length === 0) {
        return {
          ok: false,
          stage: "location",
          error: "No farm location saved. Add your farm location in Settings.",
          detail: "Farm has no location, state or coordinates saved.",
        };
      }

      let geoDetail = "No matching place found";
      for (const q of candidates) {
        for (const fn of [geocodeOpenMeteo, geocodeNominatim]) {
          try {
            place = await fn(q);
          } catch (err) {
            geoDetail = err instanceof Error ? err.message : "Geocoding failed";
            place = null;
          }
          if (place) break;
        }
        if (place) break;
      }
      if (!place) {
        console.error("[weather] geocoding failed for", candidates, geoDetail);
        return {
          ok: false,
          stage: "geocode",
          error: `We could not locate "${candidates[0]}". Check the farm location in Settings.`,
          detail: geoDetail,
        };
      }
    }


    const params = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      timezone: "auto",
      forecast_days: "7",
      past_days: "10",
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,precipitation_probability,weather_code,is_day",
      hourly: "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,precipitation_probability",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code",
    });

    let json: any;
    try {
      json = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, "forecast");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Connection failed";
      console.error("[weather] forecast failed", { place: place.label, detail });
      return {
        ok: false,
        stage: "forecast",
        error: "Weather data could not be loaded.",
        detail,
      };
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

    const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: json.timezone ?? "UTC" });
    const history = daily.filter((x) => x.date < todayKey);
    const forecast = daily.filter((x) => x.date >= todayKey);

    const c = json.current ?? {};
    return {
      ok: true,
      resolved: { latitude: place.latitude, longitude: place.longitude, place: place.label },
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
        daily: forecast,
        history,
      },
    };
  });
