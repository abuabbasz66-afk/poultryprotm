import { createServerFn } from "@tanstack/react-start";
import {
  fetchMetNo,
  fetchOpenMeteo,
  geocodeNominatim,
  geocodeOpenMeteo,
  type FarmWeather,
  type Place,
} from "@/lib/weather-sources";

export type { FarmWeather, WeatherDay, WeatherHour } from "@/lib/weather-sources";

export type FarmWeatherResult =
  | {
      ok: true;
      weather: FarmWeather;
      resolved: { latitude: number; longitude: number; place: string };
      /** True when live providers failed and a recent cached forecast is served instead. */
      stale: boolean;
    }
  | { ok: false; error: string; stage: "location" | "geocode" | "forecast"; detail: string };

type Input = {
  latitude?: number | null;
  longitude?: number | null;
  location?: string | null;
  state?: string | null;
  country?: string | null;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

const FRESH_MS = 30 * 60_000; // reuse a forecast for 30 minutes
const STALE_MS = 12 * 60 * 60_000; // beyond this, a cached forecast is useless

export const getFarmWeather = createServerFn({ method: "GET" })
  .inputValidator((input: Input) => ({
    latitude: num(input?.latitude),
    longitude: num(input?.longitude),
    location: (input?.location ?? "").trim(),
    state: (input?.state ?? "").trim(),
    country: (input?.country ?? "").trim(),
  }))
  .handler(async ({ data }): Promise<FarmWeatherResult> => {
    let place: Place | null = null;

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

    const resolved = { latitude: place.latitude, longitude: place.longitude, place: place.label };
    // Farms in the same town share one cache row: the providers rate-limit by
    // server IP, so re-fetching per farm is what breaks the page.
    const cacheKey = `${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let cached: { payload: FarmWeather; fetched_at: string } | null = null;
    try {
      const { data: row } = await supabaseAdmin
        .from("weather_cache" as never)
        .select("payload, fetched_at")
        .eq("cache_key", cacheKey)
        .maybeSingle();
      cached = (row as unknown as { payload: FarmWeather; fetched_at: string } | null) ?? null;
    } catch (err) {
      console.error("[weather] cache read failed:", err);
    }

    const ageMs = cached ? Date.now() - new Date(cached.fetched_at).getTime() : Infinity;
    if (cached && ageMs < FRESH_MS) {
      return { ok: true, weather: { ...cached.payload, place: place.label }, resolved, stale: false };
    }

    let weather: FarmWeather | null = null;
    let detail = "Connection failed";
    for (const provider of [fetchOpenMeteo, fetchMetNo]) {
      try {
        weather = await provider(place);
        break;
      } catch (err) {
        detail = err instanceof Error ? err.message : "Connection failed";
        weather = null;
      }
    }

    if (weather) {
      try {
        await supabaseAdmin
          .from("weather_cache" as never)
          .upsert({ cache_key: cacheKey, payload: weather, fetched_at: new Date().toISOString() } as never);
      } catch (err) {
        console.error("[weather] cache write failed:", err);
      }
      return { ok: true, weather, resolved, stale: false };
    }

    console.error("[weather] all providers failed", { place: place.label, detail });

    if (cached && ageMs < STALE_MS) {
      return { ok: true, weather: { ...cached.payload, place: place.label }, resolved, stale: true };
    }

    return { ok: false, stage: "forecast", error: "Weather data could not be loaded.", detail };
  });
