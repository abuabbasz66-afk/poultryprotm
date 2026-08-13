// Weather providers and shared shapes.
//
// Two keyless providers are used, in order:
//   1. Open-Meteo  — richest data (hourly + 7-day forecast + 10 days of history).
//   2. MET Norway  — fallback when Open-Meteo rate-limits the server (HTTP 429),
//                    which happens because many apps share the same egress IP.
//
// Everything here is plain data fetching. Bird interpretation lives in
// src/lib/weather-advisory.ts.

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
  source: string;
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
  /** Observed weather for the days before today, used for historical correlation. */
  history: WeatherDay[];
};

export type Place = { label: string; latitude: number; longitude: number };

const UA = "PoultryPro/1.0 (poultry farm weather advisory; https://poultrypro.life)";

/** fetch with timeout and one retry; transient blips must not kill the page. */
export async function fetchJson(url: string, label: string): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) throw new Error(`${label} responded ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      console.error(`[weather] ${label} attempt ${attempt + 1} failed:`, err);
      // A rate limit will not clear in a second — fail fast to the next provider.
      if (err instanceof Error && err.message.includes("429")) break;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${label} failed`);
}

export async function geocodeOpenMeteo(q: string): Promise<Place | null> {
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

/** Second opinion when Open-Meteo's gazetteer is unavailable or misses a village. */
export async function geocodeNominatim(q: string): Promise<Place | null> {
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

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export async function fetchOpenMeteo(place: Place): Promise<FarmWeather> {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    timezone: "auto",
    forecast_days: "7",
    past_days: "10",
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,precipitation_probability,weather_code,is_day",
    hourly: "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,precipitation_probability",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code",
  });

  const json = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, "forecast");

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
    return Math.round(avg(vals));
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

  const timezone = json.timezone ?? "UTC";
  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  const c = json.current ?? {};

  return {
    place: place.label,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone,
    fetchedAt: new Date().toISOString(),
    source: "Open-Meteo",
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
    daily: daily.filter((x) => x.date >= todayKey),
    history: daily.filter((x) => x.date < todayKey),
  };
}

/** MET Norway symbol codes → the WMO-style codes our UI already understands. */
function symbolToCode(symbol: string): number {
  const s = symbol.replace(/_(day|night|polartwilight)$/, "");
  const map: Record<string, number> = {
    clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 45,
    lightrainshowers: 80, rainshowers: 80, heavyrainshowers: 82,
    lightrain: 61, rain: 63, heavyrain: 65,
    lightsleet: 66, sleet: 66, heavysleet: 67,
    lightsnow: 71, snow: 73, heavysnow: 75,
    lightsnowshowers: 71, snowshowers: 73, heavysnowshowers: 75,
    lightrainshowersandthunder: 95, rainandthunder: 95, heavyrainandthunder: 96,
    rainshowersandthunder: 95, snowandthunder: 96,
  };
  return map[s] ?? 3;
}

/** Approximate feels-like: humid air above 26 °C feels hotter. */
function apparent(tempC: number, humidity: number) {
  if (tempC < 26) return tempC;
  const e = (humidity / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return Math.round((tempC + 0.348 * e - 4.25) * 10) / 10;
}

export async function fetchMetNo(place: Place): Promise<FarmWeather> {
  const json = await fetchJson(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${place.latitude.toFixed(4)}&lon=${place.longitude.toFixed(4)}`,
    "backup forecast",
  );
  const series: any[] = json?.properties?.timeseries ?? [];
  if (!series.length) throw new Error("backup forecast returned no data");

  const hourly: WeatherHour[] = series.slice(0, 48).map((s) => {
    const inst = s.data?.instant?.details ?? {};
    const tempC = Number(inst.air_temperature ?? 0);
    const humidity = Number(inst.relative_humidity ?? 0);
    return {
      time: String(s.time).slice(0, 19),
      tempC,
      humidity,
      feelsLikeC: apparent(tempC, humidity),
      windKph: Math.round(Number(inst.wind_speed ?? 0) * 3.6 * 10) / 10,
      rainChance: Number(
        s.data?.next_1_hours?.details?.probability_of_precipitation ??
          s.data?.next_6_hours?.details?.probability_of_precipitation ??
          0,
      ),
    };
  });

  const byDate = new Map<string, { temps: number[]; hums: number[]; rain: number[]; wind: number[]; codes: string[] }>();
  for (const s of series) {
    const date = String(s.time).slice(0, 10);
    const inst = s.data?.instant?.details ?? {};
    const bucket = byDate.get(date) ?? { temps: [], hums: [], rain: [], wind: [], codes: [] };
    if (inst.air_temperature != null) bucket.temps.push(Number(inst.air_temperature));
    if (inst.relative_humidity != null) bucket.hums.push(Number(inst.relative_humidity));
    if (inst.wind_speed != null) bucket.wind.push(Number(inst.wind_speed) * 3.6);
    const prob =
      s.data?.next_1_hours?.details?.probability_of_precipitation ??
      s.data?.next_6_hours?.details?.probability_of_precipitation;
    if (prob != null) bucket.rain.push(Number(prob));
    const sym = s.data?.next_1_hours?.summary?.symbol_code ?? s.data?.next_6_hours?.summary?.symbol_code;
    if (sym) bucket.codes.push(String(sym));
    byDate.set(date, bucket);
  }

  const daily: WeatherDay[] = [...byDate.entries()]
    .map(([date, b]) => ({
      date,
      highC: b.temps.length ? Math.max(...b.temps) : 0,
      lowC: b.temps.length ? Math.min(...b.temps) : 0,
      humidity: Math.round(avg(b.hums)),
      rainChance: b.rain.length ? Math.max(...b.rain) : 0,
      windKph: b.wind.length ? Math.round(Math.max(...b.wind) * 10) / 10 : 0,
      code: symbolToCode(b.codes[Math.floor(b.codes.length / 2)] ?? "cloudy"),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const todayKey = new Date().toISOString().slice(0, 10);
  const now = series[0];
  const inst = now.data?.instant?.details ?? {};
  const tempC = Number(inst.air_temperature ?? 0);
  const humidity = Number(inst.relative_humidity ?? 0);
  const hour = new Date().getUTCHours();

  return {
    place: place.label,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: "UTC",
    fetchedAt: new Date().toISOString(),
    source: "MET Norway",
    current: {
      tempC,
      humidity,
      feelsLikeC: apparent(tempC, humidity),
      windKph: Math.round(Number(inst.wind_speed ?? 0) * 3.6 * 10) / 10,
      rainChance: hourly[0]?.rainChance ?? 0,
      code: symbolToCode(now.data?.next_1_hours?.summary?.symbol_code ?? "cloudy"),
      isDay: hour >= 6 && hour < 18,
    },
    hourly,
    daily: daily.filter((x) => x.date >= todayKey).slice(0, 7),
    // MET Norway is forecast-only, so there is no observed history to correlate.
    history: [],
  };
}
