import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFarmId, useFeed, useFarm, invalidateFarm, farmScope } from "@/lib/farm-data";
import { toDateKey } from "@/lib/date-key";

export type InventorySource = "purchase" | "production" | "adjustment";
export type LedgerAction = "purchase" | "production" | "usage" | "adjustment";

export type FeedInventoryLot = {
  id: string;
  farm_id: string;
  feed_type: string;
  source: InventorySource;
  initial_kg: number;
  remaining_kg: number;
  unit_cost_per_kg: number;
  supplier: string | null;
  batch_number: string | null;
  purchase_date: string;
  expiry_date: string | null;
  note: string | null;
  created_at: string;
};

export type FeedLedgerEntry = {
  id: string;
  farm_id: string;
  entry_date: string;
  action: LedgerAction;
  quantity_kg: number;
  balance_after_kg: number;
  inventory_id: string | null;
  source_ref: string | null;
  note: string | null;
  created_at: string;
};

const num = (v: unknown) => (v == null ? 0 : Number(v));

export function useFeedInventory() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "feed-inventory"] as const,
    enabled: !!farmId,
    queryFn: async (): Promise<FeedInventoryLot[]> => {
      const { data, error } = await supabase
        .from("feed_inventory")
        .select("id, farm_id, feed_type, source, initial_kg, remaining_kg, unit_cost_per_kg, supplier, batch_number, purchase_date, expiry_date, note, created_at")
        .eq("farm_id", farmId!)
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        initial_kg: num(r.initial_kg),
        remaining_kg: num(r.remaining_kg),
        unit_cost_per_kg: num(r.unit_cost_per_kg),
      })) as FeedInventoryLot[];
    },
  });
}

export function useFeedLedger(limit = 200) {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "feed-ledger", limit] as const,
    enabled: !!farmId,
    queryFn: async (): Promise<FeedLedgerEntry[]> => {
      const { data, error } = await supabase
        .from("feed_ledger")
        .select("id, farm_id, entry_date, action, quantity_kg, balance_after_kg, inventory_id, source_ref, note, created_at")
        .eq("farm_id", farmId!)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        quantity_kg: num(r.quantity_kg),
        balance_after_kg: num(r.balance_after_kg),
      })) as FeedLedgerEntry[];
    },
  });
}

export type AddInventoryInput = {
  feed_type: string;
  quantity_kg: number;
  unit_cost_per_kg?: number;
  source?: InventorySource;
  supplier?: string | null;
  batch_number?: string | null;
  purchase_date?: string;
  expiry_date?: string | null;
  note?: string | null;
};

export function useAddInventoryLot() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return useMutation({
    mutationFn: async (input: AddInventoryInput) => {
      if (!farmId) throw new Error("No farm found for this user.");
      if (!Number.isFinite(input.quantity_kg) || input.quantity_kg <= 0) {
        throw new Error("Quantity must be greater than zero.");
      }
      const payload = {
        farm_id: farmId,
        feed_type: input.feed_type.trim() || "Layer Feed",
        source: input.source ?? "purchase",
        initial_kg: input.quantity_kg,
        remaining_kg: input.quantity_kg,
        unit_cost_per_kg: input.unit_cost_per_kg ?? 0,
        supplier: input.supplier ?? null,
        batch_number: input.batch_number ?? null,
        purchase_date: input.purchase_date ?? (toDateKey(new Date()) ?? new Date().toISOString().slice(0, 10)),
        expiry_date: input.expiry_date ?? null,
        note: input.note ?? null,
      };
      const { error } = await supabase.from("feed_inventory").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdateInventoryLot() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return useMutation({
    mutationFn: async (input: Partial<FeedInventoryLot> & { id: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("feed_inventory").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteInventoryLot() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feed_inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

/**
 * Aggregate stock, usage and depletion analytics from live data (client-side —
 * inventory row counts are small per farm). All calculations tenant-scoped by
 * the underlying queries.
 */
export function useFeedStockAnalytics() {
  const inv = useFeedInventory();
  const feed = useFeed();
  const farm = useFarm();
  const bagWeightKg = farm.data?.bag_weight_kg ?? 25;

  const analytics = useMemo(() => {
    const lots = inv.data ?? [];
    const usageRows = feed.data ?? [];
    const stockKg = lots.reduce((s, l) => s + l.remaining_kg, 0);
    const purchasedKg = lots.reduce((s, l) => s + l.initial_kg, 0);
    const usedKg = Math.max(0, purchasedKg - stockKg);

    // Daily usage series (last 30 days) from feed_usage rows
    const today = toDateKey(new Date()) ?? new Date().toISOString().slice(0, 10);
    const byDate = new Map<string, number>();
    for (const r of usageRows) {
      const key = toDateKey(r.date) ?? r.date;
      byDate.set(key, (byDate.get(key) ?? 0) + r.bags * bagWeightKg);
    }
    const todayKg = byDate.get(today) ?? 0;
    const lastNKg = (days: number) => {
      let total = 0;
      const now = new Date(today + "T00:00:00");
      for (let i = 0; i < days; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = toDateKey(d)!;
        total += byDate.get(key) ?? 0;
      }
      return total;
    };
    const last7Kg = lastNKg(7);
    const last30Kg = lastNKg(30);
    const avgDailyKg = last7Kg > 0 ? last7Kg / 7 : last30Kg / 30;

    const daysRemaining = avgDailyKg > 0 ? stockKg / avgDailyKg : Infinity;
    const depletion = Number.isFinite(daysRemaining)
      ? new Date(Date.now() + daysRemaining * 86400000)
      : null;

    let status: "healthy" | "low" | "critical" | "empty" = "healthy";
    if (stockKg <= 0) status = "empty";
    else if (Number.isFinite(daysRemaining) && daysRemaining < 5) status = "critical";
    else if (Number.isFinite(daysRemaining) && daysRemaining < 10) status = "low";

    // Recommend purchase: bring stock back to 30 days of runway.
    const targetKg = avgDailyKg * 30;
    const recommendPurchaseKg = Math.max(0, Math.ceil(targetKg - stockKg));
    const recommendPurchaseBags = Math.ceil(recommendPurchaseKg / bagWeightKg);

    return {
      bagWeightKg,
      stockKg,
      purchasedKg,
      usedKg,
      todayKg,
      last7Kg,
      last30Kg,
      avgDailyKg,
      daysRemaining,
      depletion,
      status,
      recommendPurchaseKg,
      recommendPurchaseBags,
    };
  }, [inv.data, feed.data, bagWeightKg]);

  return { ...analytics, isLoading: inv.isLoading || feed.isLoading };
}
