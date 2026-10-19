import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseRecordedRevenue } from "@/lib/platform-revenue";

/** Aggregate-only public statistics from the landing_platform_stats RPC (no farm-level data). */
export type LivePlatformStats = {
  registered_farms: number;
  registered_users: number;
  total_birds: number;
  production_records: number;
  feed_records: number;
  mortality_records: number;
  health_records: number;
  rooms: number;
  eggs: number;
  premium_farms: number;
  revenue_tracked: number;
  profit_analysed: number;
  egg_value: number | null;
  excluded_value_records: number | null;
};

const STAT_KEYS: (Exclude<keyof LivePlatformStats, "egg_value" | "excluded_value_records">)[] = [
  "registered_farms", "registered_users", "total_birds", "production_records",
  "feed_records", "mortality_records", "health_records", "rooms", "eggs",
  "premium_farms", "revenue_tracked", "profit_analysed",
];

export async function fetchLivePlatformStats(): Promise<LivePlatformStats> {
  const { data, error } = await supabase.rpc("landing_platform_stats");
  if (error) throw error;
  const row = (data ?? {}) as Record<string, number | string>;
  const out = {} as LivePlatformStats;
  for (const k of STAT_KEYS) out[k] = Number(row[k]) || 0;
  const { data: value, error: valueError } = await supabase.rpc("landing_all_farm_egg_value");
  const valueRow = (value ?? {}) as Record<string, unknown>;
  out.egg_value = valueError ? null : parseRecordedRevenue(valueRow.egg_value, valueRow.currency);
  out.excluded_value_records = valueError ? null : Number(valueRow.excluded_records) || 0;
  return out;
}

export function useLivePlatformStats() {
  return useQuery({
    queryKey: ["landing-platform-stats"],
    queryFn: fetchLivePlatformStats,
    // Always hit the database on mount so investors never see a stale/empty card.
    staleTime: 0,
    gcTime: 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
  });
}
