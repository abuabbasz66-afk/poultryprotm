import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CloudSun, Droplets, Wind, Thermometer, CloudRain, Loader2, AlertTriangle,
  MapPin, RefreshCw, ChevronDown, Baby, Drumstick, Egg, ShieldAlert, Info,
} from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { getFarmWeather } from "@/lib/weather.functions";
import {
  RISK_META, advisory, combinedRisk, conditionLabel, dayRisk, peakWindow,
  riskRank, tomorrowAlert, worstRisk, type FlockProfile, type RiskLevel,
} from "@/lib/weather-advisory";
import { useFarm, useRooms, useEggs, useMortality } from "@/lib/farm-data";
import { flockAge } from "@/lib/flock-age";
import { useBroilerBatches, batchAgeDays } from "@/lib/broiler-data";
import { useLayerBatches, batchAgeDays as layerAgeDays } from "@/lib/layer-rearing";
import { computeProductionSeries } from "@/lib/production-percent";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/weather")({
  head: () => ({
    meta: [
      { title: "Farm Weather & Bird Advisory — PoultryPro" },
      { name: "description", content: "Live weather for your farm location translated into poultry heat-stress risk, age-aware bird advisories and a 7-day flock risk forecast." },
      { property: "og:title", content: "Farm Weather & Bird Advisory — PoultryPro" },
      { property: "og:description", content: "Weather to bird risk to action: poultry-specific heat-stress advisories for layers, broilers and brooding chicks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequirePermission permission="dashboard.view" hint="Weather advisory is not part of your access.">
      <WeatherPage />
    </RequirePermission>
  ),
});

const c1 = (n: number) => `${n.toFixed(1)}°C`;

function RiskBadge({ level, size = "sm" }: { level: RiskLevel; size?: "sm" | "lg" }) {
  const m = RISK_META[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wide",
        m.badge,
        size === "lg" ? "px-3.5 py-1.5 text-xs" : "px-2.5 py-0.5 text-[10px]",
      )}
    >
      <span aria-hidden>{m.emoji}</span> {m.label}
    </span>
  );
}

function WeatherPage() {
  const farm = useFarm().data;
  const rooms = useRooms().data ?? [];
  const eggs = useEggs().data ?? [];
  const mortality = useMortality().data ?? [];
  const broilers = useBroilerBatches().data ?? [];
  const layerBatches = useLayerBatches().data ?? [];

  const fetchWeather = useServerFn(getFarmWeather);
  const weatherQ = useQuery({
    queryKey: ["weather", farm?.location, farm?.state, farm?.country],
    enabled: !!farm,
    staleTime: 15 * 60_000,
    queryFn: () =>
      fetchWeather({
        data: { location: farm?.location ?? null, state: farm?.state ?? null, country: farm?.country ?? null },
      }),
  });

  const flocks = useMemo<FlockProfile[]>(() => {
    const out: FlockProfile[] = [];

    const activeRooms = rooms.filter((r) => (r.status ?? "active") === "active");
    const layerRooms = activeRooms.filter((r) => (r.bird_type ?? "Layer") !== "Broiler");
    if (layerRooms.length) {
      const ages = layerRooms.map((r) => flockAge(r)).filter((a) => a.status !== "missing").map((a) => a.days);
      out.push({
        kind: "layer",
        label: `Layer houses (${layerRooms.length} room${layerRooms.length > 1 ? "s" : ""})`,
        ageDays: ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null,
        birds: layerRooms.reduce((s, r) => s + (r.current ?? 0), 0),
        rooms: layerRooms.length,
      });
    }

    const broilerRooms = activeRooms.filter((r) => (r.bird_type ?? "") === "Broiler");
    const activeBatches = broilers.filter((b) => (b.status ?? "active") === "active");
    if (activeBatches.length) {
      const ages = activeBatches.map((b) => batchAgeDays(b.date_placed));
      out.push({
        kind: "broiler",
        label: `Broilers (${activeBatches.length} batch${activeBatches.length > 1 ? "es" : ""})`,
        ageDays: Math.max(...ages),
        birds: activeBatches.reduce((s, b) => s + (b.current_birds ?? 0), 0),
        rooms: activeBatches.length,
      });
    } else if (broilerRooms.length) {
      const ages = broilerRooms.map((r) => flockAge(r)).filter((a) => a.status !== "missing").map((a) => a.days);
      out.push({
        kind: "broiler",
        label: `Broiler houses (${broilerRooms.length} room${broilerRooms.length > 1 ? "s" : ""})`,
        ageDays: ages.length ? Math.max(...ages) : null,
        birds: broilerRooms.reduce((s, r) => s + (r.current ?? 0), 0),
        rooms: broilerRooms.length,
      });
    }

    const rearing = layerBatches.filter((b) => b.status === "rearing");
    if (rearing.length) {
      const ages = rearing.map((b) => layerAgeDays(b.placement_date, b.start_age_days));
      out.push({
        kind: "brooding",
        label: `Brooding & rearing (${rearing.length} batch${rearing.length > 1 ? "es" : ""})`,
        ageDays: Math.min(...ages),
        birds: rearing.reduce((s, b) => s + (b.current_birds ?? 0), 0),
        rooms: rearing.length,
      });
    }

    if (!out.length) {
      const kind = (farm?.bird_type ?? "").toLowerCase().includes("broiler") ? "broiler" : "layer";
      out.push({
        kind,
        label: farm?.bird_type ? `${farm.bird_type} flock` : "Farm flock",
        ageDays: null,
        birds: farm?.bird_count ?? 0,
        rooms: farm?.rooms_count ?? 0,
      });
    }
    return out;
  }, [rooms, broilers, layerBatches, farm]);

  const result = weatherQ.data;
  const weather = result?.ok ? result.weather : null;

  const alert = useMemo(() => (weather ? tomorrowAlert(weather, flocks) : null), [weather, flocks]);

  // Historical connection: lay rate on elevated-risk days vs calm days.
  const history = useMemo(() => {
    if (!weather || !weather.history.length) return null;
    const layerFlock = flocks.find((f) => f.kind === "layer");
    if (!layerFlock) return null;
    const series = computeProductionSeries(eggs, rooms, mortality);
    const byDate = new Map(series.map((s) => [s.date, s]));
    const hot: number[] = [];
    const calm: number[] = [];
    for (const day of weather.history) {
      const prod = byDate.get(day.date);
      if (!prod || prod.overallPct == null) continue;
      const risk = dayRisk(day, layerFlock);
      (riskRank(risk) >= riskRank("moderate") ? hot : calm).push(prod.overallPct);
    }
    if (hot.length < 2 || calm.length < 2) return null;
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    return { hot: avg(hot), calm: avg(calm), hotDays: hot.length, calmDays: calm.length };
  }, [weather, flocks, eggs, rooms, mortality]);

  return (
    <div className="container-x py-6 md:py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 font-display text-2xl md:text-3xl">
            <CloudSun className="h-6 w-6 text-[color:var(--gold)]" /> Farm Weather &amp; Bird Advisory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Weather → bird risk → what to do. Interpreted for your flock, not a generic forecast.
          </p>
          {weather && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {weather.place}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => weatherQ.refetch()}
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium hover:bg-muted"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", weatherQ.isFetching && "animate-spin")} /> Refresh
        </button>
      </header>

      {weatherQ.isLoading && (
        <div className="flex items-center gap-2 rounded-2xl border p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the weather for your farm location…
        </div>
      )}

      {result && !result.ok && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
          <p>{result.error}</p>
        </div>
      )}

      {weather && (
        <>
          {alert && (
            <TomorrowAlert alert={alert} weather={weather} />
          )}

          <CurrentConditions weather={weather} flocks={flocks} />

          <section className="grid gap-4 lg:grid-cols-2">
            {flocks.map((f) => (
              <FlockAdvisory key={f.label} flock={f} weather={weather} />
            ))}
          </section>

          <Forecast weather={weather} flocks={flocks} />

          {history && (
            <section className="rounded-3xl border p-5 md:p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <Info className="h-4 w-4 text-[color:var(--gold)]" /> Historical pattern
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Over the last 10 days, your average lay rate was{" "}
                <strong className="text-foreground">{history.hot.toFixed(2)}%</strong> across {history.hotDays} elevated
                heat-risk day{history.hotDays > 1 ? "s" : ""} and{" "}
                <strong className="text-foreground">{history.calm.toFixed(2)}%</strong> across {history.calmDays} calmer
                day{history.calmDays > 1 ? "s" : ""}.{" "}
                {history.hot < history.calm
                  ? "Production was lower during periods of elevated heat risk. This is an observed association, not a proven cause."
                  : "No reduction was observed during elevated heat-risk days."}
              </p>
            </section>
          )}

          <p className="rounded-2xl border border-dashed p-4 text-xs text-muted-foreground">
            <ShieldAlert className="mr-1.5 inline h-3.5 w-3.5" />
            This is an agricultural management advisory, not a veterinary diagnosis. PoultryPro never recommends
            medication or antibiotics based on weather. If birds show signs of illness or severe distress, contact a
            qualified veterinarian.
          </p>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Droplets; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-background/60 p-3.5">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function CurrentConditions({
  weather,
  flocks,
}: {
  weather: NonNullable<ReturnType<typeof useCurrentWeatherType>>;
  flocks: FlockProfile[];
}) {
  const cur = weather.current;
  const level = flocks.reduce<RiskLevel>(
    (acc, f) => worstRisk(acc, combinedRisk(cur.tempC, cur.humidity, f)),
    "low",
  );
  return (
    <section className="rounded-3xl border p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Current conditions</h2>
        <span className="text-xs text-muted-foreground">{conditionLabel(cur.code)}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric icon={Thermometer} label="Temperature" value={c1(cur.tempC)} />
        <Metric icon={Droplets} label="Humidity" value={`${Math.round(cur.humidity)}%`} />
        <Metric icon={Thermometer} label="Feels like" value={c1(cur.feelsLikeC)} />
        <Metric icon={Wind} label="Wind" value={`${Math.round(cur.windKph)} km/h`} />
        <Metric icon={CloudRain} label="Rain chance" value={`${Math.round(cur.rainChance)}%`} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-muted/50 p-4">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Bird weather risk right now</span>
        <RiskBadge level={level} size="lg" />
        <span className="text-xs text-muted-foreground">
          Scored from temperature and humidity together using poultry thresholds — not a human heat index.
        </span>
      </div>
    </section>
  );
}

// helper for typing only
declare function useCurrentWeatherType(): import("@/lib/weather.functions").FarmWeather | null;

function flockIcon(kind: FlockProfile["kind"]) {
  return kind === "broiler" ? Drumstick : kind === "brooding" ? Baby : Egg;
}

function FlockAdvisory({
  flock,
  weather,
}: {
  flock: FlockProfile;
  weather: import("@/lib/weather.functions").FarmWeather;
}) {
  const Icon = flockIcon(flock.kind);
  const today = weather.daily[0];
  const level = today
    ? worstRisk(dayRisk(today, flock), combinedRisk(weather.current.tempC, weather.current.humidity, flock))
    : combinedRisk(weather.current.tempC, weather.current.humidity, flock);
  const peak = today ? peakWindow(weather.hourly, today.date, flock) : null;
  const lines = advisory(level, flock, {
    tempC: weather.current.tempC,
    humidity: weather.current.humidity,
    rainChance: today?.rainChance ?? weather.current.rainChance,
    peak: peak?.label ?? null,
  });

  return (
    <article className="rounded-3xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-[color:var(--gold)]" /> {flock.label}
        </h3>
        <RiskBadge level={level} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {flock.ageDays == null ? "Age not recorded" : `Age ${flock.ageDays} day${flock.ageDays === 1 ? "" : "s"}`}
        {flock.birds ? ` · ${flock.birds.toLocaleString()} birds` : ""}
        {flock.rooms ? ` · ${flock.rooms} unit${flock.rooms > 1 ? "s" : ""}` : ""}
      </p>
      {peak && riskRank(peak.level) >= riskRank("moderate") && (
        <p className="mt-3 rounded-xl bg-orange-500/10 px-3 py-2 text-xs font-medium text-orange-700">
          Peak heat-risk period: {peak.label}
        </p>
      )}
      <ul className="mt-3 space-y-2 text-sm">
        {lines.map((l, i) => (
          <li key={i} className={cn("flex gap-2", i === lines.length - 1 && "text-xs text-muted-foreground")}>
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", RISK_META[level].dot)} aria-hidden />
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Forecast({
  weather,
  flocks,
}: {
  weather: import("@/lib/weather.functions").FarmWeather;
  flocks: FlockProfile[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="rounded-3xl border p-5 md:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide">7-day flock risk forecast</h2>
      <div className="mt-4 hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2">Day</th><th>High</th><th>Low</th><th>Humidity</th><th>Rain</th><th>Bird risk</th>
            </tr>
          </thead>
          <tbody>
            {weather.daily.map((d, i) => {
              const level = flocks.reduce<RiskLevel>((acc, f) => worstRisk(acc, dayRisk(d, f)), "low");
              return (
                <tr key={d.date} className="border-t">
                  <td className="py-2.5 font-medium">
                    {i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                  </td>
                  <td className="tabular-nums">{c1(d.highC)}</td>
                  <td className="tabular-nums">{c1(d.lowC)}</td>
                  <td className="tabular-nums">{d.humidity}%</td>
                  <td className="tabular-nums">{d.rainChance}%</td>
                  <td><RiskBadge level={level} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-2 md:hidden">
        {weather.daily.map((d, i) => {
          const level = flocks.reduce<RiskLevel>((acc, f) => worstRisk(acc, dayRisk(d, f)), "low");
          const isOpen = open === d.date;
          return (
            <div key={d.date} className="rounded-2xl border">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 p-3 text-left"
                onClick={() => setOpen(isOpen ? null : d.date)}
              >
                <span className="text-sm font-medium">
                  {i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">{Math.round(d.highC)}° / {Math.round(d.lowC)}°</span>
                  <RiskBadge level={level} />
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                </span>
              </button>
              {isOpen && (
                <div className="grid grid-cols-2 gap-2 border-t p-3 text-xs text-muted-foreground">
                  <span>Humidity: <strong className="text-foreground">{d.humidity}%</strong></span>
                  <span>Rain: <strong className="text-foreground">{d.rainChance}%</strong></span>
                  <span>Wind: <strong className="text-foreground">{Math.round(d.windKph)} km/h</strong></span>
                  <span>{conditionLabel(d.code)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TomorrowAlert({
  alert,
  weather,
}: {
  alert: NonNullable<ReturnType<typeof tomorrowAlert>>;
  weather: import("@/lib/weather.functions").FarmWeather;
}) {
  const [open, setOpen] = useState(false);
  const flock = alert.flock;
  const lines = flock
    ? advisory(alert.level, flock, {
        tempC: alert.day.highC,
        humidity: alert.day.humidity,
        rainChance: alert.day.rainChance,
        peak: alert.peak?.label ?? null,
      })
    : [];
  return (
    <section className="rounded-3xl border border-red-500/30 bg-red-500/5 p-5">
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen(!open)}>
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4" /> ⚠️ Weather alert
          </span>
          <span className="mt-1 block text-sm">
            {alert.level === "severe" ? "Severe" : "High"} heat-stress risk expected tomorrow
            {flock ? ` for ${flock.label.toLowerCase()}` : ""}. High {c1(alert.day.highC)} · {alert.day.humidity}% humidity
            {alert.peak ? ` · peak ${alert.peak.label}` : ""}.
          </span>
        </span>
        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-3 space-y-2 border-t border-red-500/20 pt-3 text-sm">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
              <span>{l}</span>
            </li>
          ))}
          <li className="text-xs text-muted-foreground">Forecast for {new Date(`${alert.day.date}T00:00:00`).toLocaleDateString()} at {weather.place}.</li>
        </ul>
      )}
    </section>
  );
}
