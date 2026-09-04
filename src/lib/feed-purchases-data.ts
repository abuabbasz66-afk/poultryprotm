// Feed purchases, stock adjustments, paged ledger, per-feed-type stock and
// feed cost analytics. Extends (does not replace) feed-inventory-data.ts.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { farmScope, invalidateFarm, useAuthUserId, useFarmId, useFarm, useFeed, useEggProduction } from "@/lib/farm-data";
import { useFarmContext } from "@/lib/rbac";
import { useFeedInventory, type FeedInventoryLot, type FeedLedgerEntry } from "@/lib/feed-inventory-data";
import { useFeedTypes, type FeedType } from "@/lib/feed-types-data";
import { toDateKey } from "@/lib/date-key";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const today = () => toDateKey(new Date()) ?? new Date().toISOString().slice(0, 10);

/* ------------------------------- Purchase -------------------------------- */

export type PurchaseInput = {
  feed_type: string;
  feed_type_id?: string | null;
  supplier?: string | null;
  bags: number;
  bag_size_kg: number;
  cost_per_bag: number;
  purchase_date?: string;
  reference?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  note?: string | null;
  /** Post the matching expense into Finance and link it to this stock lot. */
  postToFinance?: boolean;
};

export function purchaseTotals(bags: number, bagSizeKg: number, costPerBag: number) {
  const b = Number.isFinite(bags) ? bags : 0;
  const size = Number.isFinite(bagSizeKg) ? bagSizeKg : 0;
  const cost = Number.isFinite(costPerBag) ? costPerBag : 0;
  const totalKg = b * size;
  const totalCost = b * cost;
  return { totalKg, totalCost, costPerKg: totalKg > 0 ? totalCost / totalKg : 0 };
}

export function useAddFeedPurchase() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  const { data: userId } = useAuthUserId();
  const { data: ctx } = useFarmContext();

  return useMutation({
    mutationFn: async (input: PurchaseInput) => {
      if (!farmId) throw new Error("No farm selected.");
      const feedType = input.feed_type.trim();
      if (!feedType) throw new Error("Select a feed type.");
      if (!Number.isFinite(input.bags) || input.bags <= 0) throw new Error("Please enter a valid number of bags.");
      if (!Number.isFinite(input.bag_size_kg) || input.bag_size_kg <= 0) throw new Error("Please enter a valid bag size.");
      if (!Number.isFinite(input.cost_per_bag) || input.cost_per_bag < 0) throw new Error("Feed cost cannot be negative.");

      const { totalKg, totalCost, costPerKg } = purchaseTotals(input.bags, input.bag_size_kg, input.cost_per_bag);
      const purchaseDate = input.purchase_date ?? today();

      let expenseId: string | null = null;
      if (input.postToFinance && totalCost > 0) {
        const { data: exp, error: expErr } = await supabase
          .from("farm_expenses")
          .insert({
            farm_id: farmId,
            entry_date: purchaseDate,
            category: "production",
            subcategory: "Feed Purchase",
            description: `${feedType} — ${input.bags} bag(s) × ${input.bag_size_kg} kg`,
            amount: totalCost,
            payment_method: "cash",
            supplier: input.supplier ?? null,
            notes: input.reference ? `Ref: ${input.reference}` : null,
            recorded_by: userId ?? null,
            recorded_by_name: ctx?.fullName || ctx?.email || null,
          })
          .select("id")
          .single();
        if (expErr) throw expErr;
        expenseId = exp.id as string;
      }

      const { error } = await supabase.from("feed_inventory").insert({
        farm_id: farmId,
        feed_type: feedType,
        feed_type_id: input.feed_type_id ?? null,
        source: "purchase",
        initial_kg: totalKg,
        remaining_kg: totalKg,
        unit_cost_per_kg: costPerKg,
        bags: input.bags,
        bag_size_kg: input.bag_size_kg,
        total_cost: totalCost,
        reference: input.reference ?? null,
        supplier: input.supplier ?? null,
        batch_number: input.batch_number ?? null,
        purchase_date: purchaseDate,
        expiry_date: input.expiry_date ?? null,
        note: input.note ?? null,
        created_by: userId ?? null,
        expense_id: expenseId,
      });
      if (error) {
        if (expenseId) await supabase.from("farm_expenses").delete().eq("id", expenseId);
        throw error;
      }
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

/** Deleting a purchase also removes its linked expense so books stay in step. */
export function useDeletePurchaseWithExpense() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return useMutation({
    mutationFn: async (lot: Pick<FeedInventoryLot, "id"> & { expense_id?: string | null }) => {
      const { error } = await supabase.from("feed_inventory").delete().eq("id", lot.id);
      if (error) throw error;
      if (lot.expense_id) await supabase.from("farm_expenses").delete().eq("id", lot.expense_id);
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

/* ------------------------------ Adjustment ------------------------------- */

export type AdjustmentInput = {
  direction: "add" | "remove";
  quantity_kg: number;
  reason: string;
  entry_date?: string;
  feed_type?: string;
};

/**
 * Adjustments never edit history. "Add" creates an adjustment lot (which the
 * existing trigger logs); "remove" consumes stock first-in-first-out through
 * the existing server-side function and refuses to go below zero.
 */
export function useStockAdjustment() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  const { data: userId } = useAuthUserId();
  return useMutation({
    mutationFn: async (input: AdjustmentInput) => {
      if (!farmId) throw new Error("No farm selected.");
      const kg = Number(input.quantity_kg);
      if (!Number.isFinite(kg) || kg <= 0) throw new Error("Please enter a valid quantity.");
      const reason = input.reason.trim();
      if (!reason) throw new Error("Enter a reason for this adjustment.");
      const date = input.entry_date ?? today();

      if (input.direction === "add") {
        const { error } = await supabase.from("feed_inventory").insert({
          farm_id: farmId,
          feed_type: input.feed_type?.trim() || "Adjustment",
          source: "adjustment",
          initial_kg: kg,
          remaining_kg: kg,
          unit_cost_per_kg: 0,
          purchase_date: date,
          note: reason,
          created_by: userId ?? null,
        });
        if (error) throw error;
        return;
      }

      const { data: stock, error: stockErr } = await supabase.rpc("farm_feed_stock_kg", { _farm_id: farmId });
      if (stockErr) throw stockErr;
      const available = num(stock);
      if (kg > available) {
        throw new Error(
          `Insufficient feed stock. Available: ${Math.round(available * 10) / 10} kg · Requested: ${Math.round(kg * 10) / 10} kg`,
        );
      }
      const { error } = await supabase.rpc("consume_feed_fifo", {
        _farm_id: farmId,
        _kg: kg,
        _entry_date: date,
        _source_ref: null as unknown as string,
      });
      if (error) throw error;
      // Label the movement as an adjustment rather than daily usage.
      await supabase
        .from("feed_ledger")
        .update({ action: "adjustment", note: reason })
        .eq("farm_id", farmId)
        .eq("entry_date", date)
        .eq("action", "usage")
        .is("source_ref", null);
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

/* ------------------------------ Paged ledger ------------------------------ */

export type LedgerFilters = {
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export function useFeedLedgerPage(filters: LedgerFilters = {}) {
  const { data: farmId } = useFarmId();
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 25;
  return useQuery({
    queryKey: [...farmScope(farmId), "feed-ledger-page", filters] as const,
    enabled: !!farmId,
    queryFn: async (): Promise<{ rows: FeedLedgerEntry[]; total: number }> => {
      let q = supabase
        .from("feed_ledger")
        .select(
          "id, farm_id, entry_date, action, quantity_kg, balance_after_kg, inventory_id, source_ref, note, created_at",
          { count: "exact" },
        )
        .eq("farm_id", farmId!);
      if (filters.action && filters.action !== "all") q = q.eq("action", filters.action);
      if (filters.from) q = q.gte("entry_date", filters.from);
      if (filters.to) q = q.lte("entry_date", filters.to);
      const { data, error, count } = await q
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (error) throw error;
      return {
        rows: (data ?? []).map((r) => ({
          ...r,
          quantity_kg: num(r.quantity_kg),
          balance_after_kg: num(r.balance_after_kg),
        })) as FeedLedgerEntry[],
        total: count ?? 0,
      };
    },
  });
}

/* --------------------------- Stock by feed type --------------------------- */

export type FeedTypeStock = {
  key: string;
  name: string;
  type: FeedType | null;
  stockKg: number;
  lots: number;
  thresholdKg: number;
  low: boolean;
  daysRemaining: number | null;
};

export function useFeedTypeStock() {
  const inv = useFeedInventory();
  const types = useFeedTypes();
  const feed = useFeed();
  const farm = useFarm();
  const bagWeightKg = farm.data?.bag_weight_kg ?? 25;

  return useMemo(() => {
    const lots = inv.data ?? [];
    const typeList = types.data ?? [];
    const usage = feed.data ?? [];

    // Farm-wide average daily usage (last 7 days) — used to project each type.
    const byDate = new Map<string, number>();
    for (const r of usage) {
      const key = toDateKey(r.date) ?? r.date;
      byDate.set(key, (byDate.get(key) ?? 0) + r.bags * bagWeightKg);
    }
    const base = new Date((toDateKey(new Date()) ?? new Date().toISOString().slice(0, 10)) + "T00:00:00");
    let last7 = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      last7 += byDate.get(toDateKey(d) ?? "") ?? 0;
    }
    const avgDaily = last7 / 7;

    const map = new Map<string, FeedTypeStock>();
    const put = (name: string, type: FeedType | null) => {
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          key,
          name,
          type,
          stockKg: 0,
          lots: 0,
          thresholdKg: type?.low_stock_kg ?? 0,
          low: false,
          daysRemaining: null,
        });
      }
      return map.get(key)!;
    };
    for (const t of typeList) if (t.is_active) put(t.name, t);
    for (const l of lots) {
      const type = typeList.find((t) => t.id === l.feed_type_id || t.name.toLowerCase() === l.feed_type.toLowerCase()) ?? null;
      const row = put(type?.name ?? l.feed_type, type);
      row.stockKg += l.remaining_kg;
      if (l.remaining_kg > 0) row.lots += 1;
      if (type) {
        row.type = type;
        row.thresholdKg = type.low_stock_kg;
      }
    }
    const rows = Array.from(map.values());
    const totalStock = rows.reduce((s, r) => s + r.stockKg, 0);
    for (const r of rows) {
      r.low = r.thresholdKg > 0 && r.stockKg < r.thresholdKg;
      const share = totalStock > 0 ? r.stockKg / totalStock : 0;
      const dailyForType = avgDaily * share;
      r.daysRemaining = dailyForType > 0 ? r.stockKg / dailyForType : null;
    }
    rows.sort((a, b) => b.stockKg - a.stockKg);
    return { rows, avgDailyKg: avgDaily, isLoading: inv.isLoading || types.isLoading || feed.isLoading };
  }, [inv.data, inv.isLoading, types.data, types.isLoading, feed.data, feed.isLoading, bagWeightKg]);
}

/* ---------------------------- Cost & efficiency --------------------------- */

export type FeedCostAnalytics = {
  hasCost: boolean;
  avgCostPerKg: number | null;
  costToday: number | null;
  costWeek: number | null;
  costMonth: number | null;
  kgToday: number;
  kgWeek: number;
  kgMonth: number;
  feedPerBirdG: number | null;
  feedPerEggG: number | null;
  costPerEgg: number | null;
  costPerCrate: number | null;
  spendSeries: { date: string; kg: number; cost: number | null }[];
  isLoading: boolean;
};

export function useFeedCostAnalytics(days = 30): FeedCostAnalytics {
  const inv = useFeedInventory();
  const feed = useFeed();
  const eggs = useEggProduction();
  const farm = useFarm();
  const bagWeightKg = farm.data?.bag_weight_kg ?? 25;

  return useMemo(() => {
    const lots = inv.data ?? [];
    const usage = feed.data ?? [];
    const eggRows = eggs.data ?? [];

    const costedKg = lots.reduce((s, l) => s + (l.unit_cost_per_kg > 0 ? l.initial_kg : 0), 0);
    const costedValue = lots.reduce((s, l) => s + (l.unit_cost_per_kg > 0 ? l.initial_kg * l.unit_cost_per_kg : 0), 0);
    const avgCostPerKg = costedKg > 0 ? costedValue / costedKg : null;

    const kgByDate = new Map<string, number>();
    for (const r of usage) {
      const key = toDateKey(r.date) ?? r.date;
      kgByDate.set(key, (kgByDate.get(key) ?? 0) + r.bags * bagWeightKg);
    }
    const eggsByDate = new Map<string, number>();
    for (const r of eggRows) {
      const key = toDateKey(r.date) ?? r.date;
      const total = (r.r2 ?? 0) + (r.r3 ?? 0) + (r.r4 ?? 0) + (r.extra ?? 0);
      eggsByDate.set(key, (eggsByDate.get(key) ?? 0) + total);
    }

    const todayKey = toDateKey(new Date()) ?? new Date().toISOString().slice(0, 10);
    const base = new Date(todayKey + "T00:00:00");
    const series: { date: string; kg: number; cost: number | null }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const key = toDateKey(d) ?? d.toISOString().slice(0, 10);
      const kg = kgByDate.get(key) ?? 0;
      series.push({ date: key, kg, cost: avgCostPerKg != null ? kg * avgCostPerKg : null });
    }
    const sumLast = (n: number) => series.slice(-n).reduce((s, p) => s + p.kg, 0);
    const kgToday = kgByDate.get(todayKey) ?? 0;
    const kgWeek = sumLast(7);
    const kgMonth = sumLast(30);

    // Efficiency over the last 30 recorded days where both sides have data.
    let feedKg30 = 0;
    let eggsCount30 = 0;
    for (const p of series) {
      const e = eggsByDate.get(p.date);
      if (p.kg > 0 && e != null && e > 0) {
        feedKg30 += p.kg;
        eggsCount30 += e;
      }
    }
    const birds = farm.data?.bird_count ?? 0;
    const daysWithFeed = series.filter((p) => p.kg > 0).length;
    const feedPerBirdG = birds > 0 && daysWithFeed > 0 ? (sumLast(days) / daysWithFeed / birds) * 1000 : null;
    const feedPerEggG = eggsCount30 > 0 ? (feedKg30 * 1000) / eggsCount30 : null;
    const costPerEgg = feedPerEggG != null && avgCostPerKg != null ? (feedPerEggG / 1000) * avgCostPerKg : null;

    return {
      hasCost: avgCostPerKg != null,
      avgCostPerKg,
      costToday: avgCostPerKg != null ? kgToday * avgCostPerKg : null,
      costWeek: avgCostPerKg != null ? kgWeek * avgCostPerKg : null,
      costMonth: avgCostPerKg != null ? kgMonth * avgCostPerKg : null,
      kgToday,
      kgWeek,
      kgMonth,
      feedPerBirdG,
      feedPerEggG,
      costPerEgg,
      costPerCrate: costPerEgg != null ? costPerEgg * 30 : null,
      spendSeries: series,
      isLoading: inv.isLoading || feed.isLoading || eggs.isLoading,
    };
  }, [inv.data, inv.isLoading, feed.data, feed.isLoading, eggs.data, eggs.isLoading, farm.data?.bird_count, bagWeightKg, days]);
}
