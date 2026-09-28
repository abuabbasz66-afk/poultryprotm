import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  useAuthUserId,
  useEggs,
  useFarm,
  useFeed,
  useHealth,
  useMortality,
  useRooms,
} from "@/lib/farm-data";
import { useExpenses, useRevenue } from "@/lib/finance-data";
import { useFeedInventory, useFeedStockAnalytics } from "@/lib/feed-inventory-data";
import { usePermissions } from "@/lib/rbac";
import { useSyncState } from "@/lib/offline/status";
import { useToday } from "@/lib/use-today";
import { toDateKey } from "@/lib/date-key";
import { flockAge } from "@/lib/flock-age";
import { getFarmWeather, type FarmWeather } from "@/lib/weather.functions";
import { buildGuidance } from "@/lib/weather-guidance";
import type { FlockProfile } from "@/lib/weather-advisory";
import {
  generateFarmIntelligence,
  type FarmIntelligence,
  type IntelAlert,
  type WeatherInput,
} from "@/lib/intelligence/engine";

export type AlertStatus = "active" | "acknowledged" | "resolved";
export type AlertStateRow = {
  id: string;
  farm_id: string;
  alert_key: string;
  category: string;
  severity: string;
  room: string | null;
  title: string;
  message: string | null;
  status: AlertStatus;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
};

/** Reads the same weather query the Weather page uses (shared cache), falling back to its local copy. */
function useFarmWeatherInput(enabled: boolean): WeatherInput | null {
  const farm = useFarm().data;
  const rooms = useRooms().data ?? [];
  const fetchWeather = useServerFn(getFarmWeather);
  const q = useQuery({
    queryKey: [
      "weather",
      farm?.id,
      farm?.latitude,
      farm?.longitude,
      farm?.location,
      farm?.state,
      farm?.country,
    ],
    enabled: enabled && !!farm,
    staleTime: 15 * 60_000,
    retry: 1,
    queryFn: () =>
      fetchWeather({
        data: {
          latitude: farm?.latitude ?? null,
          longitude: farm?.longitude ?? null,
          location: farm?.location ?? null,
          state: farm?.state ?? null,
          country: farm?.country ?? null,
        },
      }),
  });

  return useMemo(() => {
    if (!enabled || !farm) return null;
    let weather: FarmWeather | null = q.data?.ok ? q.data.weather : null;
    if (!weather && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`pp:weather:${farm.id}`);
        const cached = raw ? (JSON.parse(raw) as { weather: FarmWeather; at: string }) : null;
        // A cached forecast older than 3 hours no longer describes "now".
        if (cached && Date.now() - new Date(cached.at).getTime() < 3 * 3600_000)
          weather = cached.weather;
      } catch {
        /* unreadable cache */
      }
    }
    if (!weather) return null;
    const active = rooms.filter((r) => (r.status ?? "active") === "active");
    const broilerRooms = active.filter((r) => r.bird_type === "Broiler");
    const layerRooms = active.filter((r) => r.bird_type !== "Broiler");
    const group = layerRooms.length >= broilerRooms.length ? layerRooms : broilerRooms;
    const ages = group
      .map((r) => flockAge(r))
      .filter((a) => a.status !== "missing")
      .map((a) => a.days);
    const flock: FlockProfile = {
      kind: group === broilerRooms && broilerRooms.length ? "broiler" : "layer",
      label: "Flock",
      ageDays: ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null,
      birds: group.reduce((s, r) => s + (r.current ?? 0), 0),
      rooms: group.length,
    };
    const g = buildGuidance(flock, {
      tempC: weather.current.tempC,
      humidity: weather.current.humidity,
      weather,
    });
    return {
      tempC: g.tempC,
      humidity: g.humidity,
      severity: g.severity,
      label: g.label,
      message: g.message,
      actions: g.actions.map((a) => a.text),
      heat: !g.actions.some((a) => a.kind === "cold"),
    };
  }, [enabled, farm, rooms, q.data]);
}

/** Runs the pure intelligence engine over the farm's cached (offline-capable) data. */
export function useFarmIntelligence(): {
  data: FarmIntelligence;
  loading: boolean;
  farmId: string | null;
} {
  const today = useToday();
  const { can, loading: permsLoading } = usePermissions();
  const farm = useFarm().data;
  const rooms = useRooms();
  const eggs = useEggs();
  const mortality = useMortality();
  const feed = useFeed();
  const health = useHealth();
  const canFinance = !permsLoading && can("financials.read");
  const expenses = useExpenses();
  const revenue = useRevenue();
  const inv = useFeedInventory();
  const stock = useFeedStockAnalytics();
  const sync = useSyncState();
  const weather = useFarmWeatherInput(!permsLoading && can("dashboard.view"));

  const data = useMemo(
    () =>
      generateFarmIntelligence({
        todayKey: toDateKey(today) ?? "",
        hour: new Date().getHours(),
        rooms: rooms.data ?? [],
        eggs: eggs.data ?? [],
        mortality: mortality.data ?? [],
        feed: feed.data ?? [],
        health: health.data ?? [],
        expenses: canFinance ? (expenses.data ?? []) : [],
        revenue: canFinance ? (revenue.data ?? []) : [],
        stock: inv.data
          ? { hasLots: inv.data.length > 0, stockKg: stock.stockKg, avgDailyKg: stock.avgDailyKg }
          : null,
        weather,
        permissions: {
          production: can("production.read"),
          mortality: can("mortality.read"),
          feed: can("feed.read"),
          health: can("health.read"),
          inventory: can("inventory.read") || can("feed.read"),
          finance: canFinance && !!expenses.data && !!revenue.data,
          weather: can("dashboard.view"),
        },
        sync: { offline: !sync.online, pending: sync.pending },
      }),
    [
      today,
      can,
      canFinance,
      rooms.data,
      eggs.data,
      mortality.data,
      feed.data,
      health.data,
      expenses.data,
      revenue.data,
      inv.data,
      stock.stockKg,
      stock.avgDailyKg,
      weather,
      sync.online,
      sync.pending,
    ],
  );

  return {
    data,
    loading: permsLoading || rooms.isPending || eggs.isPending,
    farmId: farm?.id ?? null,
  };
}

const statesKey = (farmId: string | null) => ["farm-alert-states", farmId];

/**
 * Persisted alert lifecycle (active → acknowledged → resolved). Current alerts
 * are upserted by stable key; alerts in an evaluated category that no longer
 * fire are marked resolved. Skipped offline — the UI falls back to "active".
 */
export function useAlertStates(intel: FarmIntelligence, farmId: string | null, ready: boolean) {
  const qc = useQueryClient();
  const { data: userId } = useAuthUserId();
  const sync = useSyncState();
  const q = useQuery({
    queryKey: statesKey(farmId),
    enabled: !!farmId,
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("farm_alert_states")
        .select("*")
        .eq("farm_id", farmId!)
        .gte("last_seen_at", since)
        .order("last_seen_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as AlertStateRow[];
    },
  });

  const lastSig = useRef("");
  useEffect(() => {
    if (!ready || !farmId || !q.data || !sync.online) return;
    const sig = JSON.stringify([
      farmId,
      intel.alerts.map((a) => [a.key, a.severity, a.title]),
      intel.evaluated,
    ]);
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    const rows = new Map(q.data.map((r) => [r.alert_key, r]));
    const now = new Date().toISOString();
    const hourAgo = Date.now() - 3600_000;
    const writes: PromiseLike<unknown>[] = [];
    const current = new Set(intel.alerts.map((a) => a.key));

    for (const a of intel.alerts) {
      const row = rows.get(a.key);
      const payload = {
        severity: a.severity,
        category: a.category,
        room: a.room ?? null,
        title: a.title,
        message: a.happened,
        last_seen_at: now,
      };
      if (!row || row.status === "resolved") {
        writes.push(
          supabase.from("farm_alert_states").upsert(
            {
              farm_id: farmId,
              alert_key: a.key,
              ...payload,
              status: "active",
              first_seen_at: now,
              resolved_at: null,
              acknowledged_at: null,
              acknowledged_by: null,
            },
            { onConflict: "farm_id,alert_key" },
          ),
        );
      } else if (
        row.severity !== a.severity ||
        row.title !== a.title ||
        new Date(row.last_seen_at).getTime() < hourAgo
      ) {
        writes.push(supabase.from("farm_alert_states").update(payload).eq("id", row.id));
      }
    }
    for (const row of q.data) {
      if (row.status === "resolved" || current.has(row.alert_key)) continue;
      if (!intel.evaluated.includes(row.category as never)) continue;
      writes.push(
        supabase
          .from("farm_alert_states")
          .update({ status: "resolved", resolved_at: now })
          .eq("id", row.id),
      );
    }
    if (writes.length) {
      void Promise.all(writes).then(() => qc.invalidateQueries({ queryKey: statesKey(farmId) }));
    }
  }, [ready, farmId, q.data, intel, sync.online, qc]);

  const acknowledge = useCallback(
    async (a: IntelAlert) => {
      if (!farmId) return;
      const now = new Date().toISOString();
      await supabase.from("farm_alert_states").upsert(
        {
          farm_id: farmId,
          alert_key: a.key,
          category: a.category,
          severity: a.severity,
          room: a.room ?? null,
          title: a.title,
          message: a.happened,
          status: "acknowledged",
          acknowledged_at: now,
          acknowledged_by: userId ?? null,
          last_seen_at: now,
        },
        { onConflict: "farm_id,alert_key" },
      );
      await qc.invalidateQueries({ queryKey: statesKey(farmId) });
    },
    [farmId, userId, qc],
  );

  const statusOf = useCallback(
    (key: string): AlertStatus => {
      const row = q.data?.find((r) => r.alert_key === key);
      return row && row.status !== "resolved" ? row.status : "active";
    },
    [q.data],
  );

  return { rows: q.data ?? [], statusOf, acknowledge, loading: q.isPending };
}
