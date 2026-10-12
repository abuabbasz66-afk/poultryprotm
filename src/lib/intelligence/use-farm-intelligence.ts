import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useEggs, useFarm, useFeed, useHealth, useMortality, useRooms } from "@/lib/farm-data";
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
  type IntelInput,
  type WeatherInput,
} from "@/lib/intelligence/engine";
import {
  isOpen,
  suppressedByCooldown,
  toActionItem,
  type ActionItem,
  type ActionStatus,
  type ActionVerb,
} from "@/lib/intelligence/actions";

export type AlertStatus = ActionStatus;
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
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  priority: string | null;
  evidence: string | null;
  generated_at: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  in_progress_at: string | null;
  dismissed_at: string | null;
  dismiss_reason: string | null;
  cooldown_until: string | null;
};

export type AlertEventRow = {
  id: string;
  alert_key: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  assigned_to: string | null;
  actor: string | null;
  created_at: string;
};

/** Reads the same weather query the Weather page uses (shared cache), falling back to its local copy. */
function useFarmWeatherInput(enabled: boolean): WeatherInput | null {
  const farm = useFarm().data;
  const roomsData = useRooms().data;
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
    const active = (roomsData ?? []).filter((r) => (r.status ?? "active") === "active");
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
  }, [enabled, farm, roomsData, q.data]);
}

/** Runs the pure intelligence engine over the farm's cached (offline-capable) data. */
export function useFarmIntelligence(): {
  data: FarmIntelligence;
  items: ActionItem[];
  input: IntelInput;
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

  const input = useMemo<IntelInput>(
    () => ({
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
  const data = useMemo(() => generateFarmIntelligence(input), [input]);
  const items = useMemo(() => data.alerts.map((a) => toActionItem(a, input)), [data, input]);

  return {
    data,
    items,
    input,
    loading: permsLoading || rooms.isPending || eggs.isPending,
    farmId: farm?.id ?? null,
  };
}

const statesKey = (farmId: string | null) => ["farm-alert-states", farmId];
const eventsKey = (farmId: string | null) => ["farm-alert-events", farmId];

/**
 * Persisted alert lifecycle. The sync step only opens alerts and auto-resolves
 * ones that stopped firing; workflow changes (acknowledge, assign, start,
 * resolve, dismiss) go through the alert_transition database function, which
 * checks permissions and writes the history. Skipped offline.
 */
export function useAlertStates(intel: FarmIntelligence, farmId: string | null, ready: boolean) {
  const qc = useQueryClient();
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
      const reopen =
        !row ||
        row.status === "resolved" ||
        (row.status === "dismissed" && !suppressedByCooldown(a, row));
      if (reopen) {
        writes.push(
          row
            ? supabase
                .from("farm_alert_states")
                .update({
                  ...payload,
                  status: "active",
                  first_seen_at: now,
                  generated_at: now,
                  resolved_at: null,
                  dismissed_at: null,
                  acknowledged_at: null,
                  cooldown_until: null,
                })
                .eq("id", row.id)
            : supabase.from("farm_alert_states").insert({
                farm_id: farmId,
                alert_key: a.key,
                ...payload,
                status: "active",
                first_seen_at: now,
                generated_at: now,
              }),
        );
      } else if (
        row.status !== "dismissed" &&
        (row.severity !== a.severity ||
          row.title !== a.title ||
          new Date(row.last_seen_at).getTime() < hourAgo)
      ) {
        writes.push(supabase.from("farm_alert_states").update(payload).eq("id", row.id));
      }
    }
    for (const row of q.data) {
      if (!isOpen(row.status) || current.has(row.alert_key)) continue;
      if (!intel.evaluated.includes(row.category as never)) continue;
      writes.push(
        supabase
          .from("farm_alert_states")
          .update({ status: "resolved", resolved_at: now })
          .eq("id", row.id),
      );
    }
    if (writes.length) {
      void Promise.all(writes).then(() => {
        void qc.invalidateQueries({ queryKey: statesKey(farmId) });
        void qc.invalidateQueries({ queryKey: eventsKey(farmId) });
      });
    }
  }, [ready, farmId, q.data, intel, sync.online, qc]);

  const transition = useCallback(
    async (
      a: Pick<IntelAlert, "key" | "category" | "severity" | "title" | "happened" | "room">,
      action: ActionVerb,
      opts: { note?: string; assignee?: string; priority?: string; evidence?: string } = {},
    ) => {
      if (!farmId) throw new Error("No farm selected");
      const { error } = await supabase.rpc("alert_transition", {
        _farm: farmId,
        _key: a.key,
        _action: action,
        _note: opts.note ?? undefined,
        _assignee: opts.assignee ?? undefined,
        _alert: {
          category: a.category,
          severity: a.severity,
          title: a.title,
          message: a.happened,
          room: a.room ?? null,
          priority: opts.priority ?? null,
          evidence: opts.evidence ?? null,
        },
      });
      if (error) throw new Error(error.message);
      await Promise.all([
        qc.invalidateQueries({ queryKey: statesKey(farmId) }),
        qc.invalidateQueries({ queryKey: eventsKey(farmId) }),
      ]);
    },
    [farmId, qc],
  );

  const acknowledge = useCallback((a: IntelAlert) => transition(a, "acknowledge"), [transition]);

  const rowOf = useCallback((key: string) => q.data?.find((r) => r.alert_key === key), [q.data]);
  const statusOf = useCallback(
    (key: string): AlertStatus => {
      const row = rowOf(key);
      return row && row.status !== "resolved" ? row.status : "active";
    },
    [rowOf],
  );

  return { rows: q.data ?? [], rowOf, statusOf, acknowledge, transition, loading: q.isPending };
}

/** Action history for the farm (most recent first). */
export function useAlertEvents(farmId: string | null) {
  return useQuery({
    queryKey: eventsKey(farmId),
    enabled: !!farmId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farm_alert_events")
        .select(
          "id, alert_key, action, from_status, to_status, note, assigned_to, actor, created_at",
        )
        .eq("farm_id", farmId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as AlertEventRow[];
    },
  });
}

/** Active farm members (id = auth user id) for assignment and names in history. */
export function useFarmPeople(farmId: string | null) {
  return useQuery({
    queryKey: ["farm-people", farmId],
    enabled: !!farmId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farm_members")
        .select("user_id, full_name, status")
        .eq("farm_id", farmId!);
      if (error) throw error;
      return (data ?? [])
        .filter((m) => m.user_id)
        .map((m) => ({
          id: m.user_id as string,
          name: m.full_name,
          active: m.status === "active",
        }));
    },
  });
}
