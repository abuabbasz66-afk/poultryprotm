// Broiler management data layer.
//
// Broilers are batch-based, not room-based: each placement of day-old chicks is
// a batch that is tracked daily (deaths, feed, weight) until it is sold out.
// Layers keep using rooms/egg_production — the two dashboards are separate but
// share prices, permissions and the same farm id.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId, useFarmId, invalidateFarm, farmScope } from "@/lib/farm-data";

export type BroilerBatch = {
  id: string;
  farm_id: string;
  name: string;
  breed: string | null;
  house: string | null;
  date_placed: string;
  birds_placed: number;
  current_birds: number;
  chick_unit_cost: number;
  target_weight_kg: number;
  status: string;
  notes: string | null;
  created_at: string;
};

export type BroilerDaily = {
  id: string;
  batch_id: string;
  entry_date: string;
  deaths: number;
  feed_kg: number;
  avg_weight_g: number | null;
  water_litres: number | null;
  notes: string | null;
};

export type BroilerSale = {
  id: string;
  batch_id: string;
  entry_date: string;
  birds: number;
  total_weight_kg: number;
  price_per_kg: number;
  amount: number;
  customer: string | null;
  payment_method: string;
  notes: string | null;
};

export const BROILER_STATUSES = ["active", "sold", "closed"] as const;
export type BroilerStatus = (typeof BROILER_STATUSES)[number];

export const BROILER_STATUS_LABELS: Record<BroilerStatus, string> = {
  active: "Active",
  sold: "Sold Out",
  closed: "Closed",
};

export const BROILER_STATUS_TONES: Record<BroilerStatus, string> = {
  active: "bg-emerald-500/12 text-emerald-700 border-emerald-500/30",
  sold: "bg-sky-500/12 text-sky-700 border-sky-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

export function batchStatus(b: Pick<BroilerBatch, "status">): BroilerStatus {
  const s = (b.status ?? "active") as BroilerStatus;
  return (BROILER_STATUSES as readonly string[]).includes(s) ? s : "active";
}

// ============= READS =============

export function useBroilerBatches() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "broiler-batches"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<BroilerBatch[]> => {
      const { data, error } = await supabase
        .from("broiler_batches")
        .select("id, farm_id, name, breed, house, date_placed, birds_placed, current_birds, chick_unit_cost, target_weight_kg, status, notes, created_at")
        .eq("farm_id", farmId!)
        .order("date_placed", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BroilerBatch[];
    },
  });
}

export function useBroilerDaily() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "broiler-daily"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<BroilerDaily[]> => {
      const { data, error } = await supabase
        .from("broiler_daily")
        .select("id, batch_id, entry_date, deaths, feed_kg, avg_weight_g, water_litres, notes")
        .eq("farm_id", farmId!)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BroilerDaily[];
    },
  });
}

export function useBroilerSales() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "broiler-sales"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<BroilerSale[]> => {
      const { data, error } = await supabase
        .from("broiler_sales")
        .select("id, batch_id, entry_date, birds, total_weight_kg, price_per_kg, amount, customer, payment_method, notes")
        .eq("farm_id", farmId!)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BroilerSale[];
    },
  });
}

// ============= WRITES =============

function useCtx() {
  const { data: userId } = useAuthUserId();
  const { data: farmId } = useFarmId();
  return { userId: userId ?? null, farmId: farmId ?? null };
}

export function useAddBroilerBatch() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: {
      name: string; breed?: string | null; house?: string | null;
      date_placed: string; birds_placed: number; chick_unit_cost: number;
      target_weight_kg: number; notes?: string | null;
    }) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const { error } = await supabase.from("broiler_batches").insert({
        farm_id: farmId,
        name: input.name.trim(),
        breed: input.breed?.trim() || null,
        house: input.house?.trim() || null,
        date_placed: input.date_placed,
        birds_placed: input.birds_placed,
        current_birds: input.birds_placed,
        chick_unit_cost: input.chick_unit_cost,
        target_weight_kg: input.target_weight_kg,
        notes: input.notes?.trim() || null,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdateBroilerBatch() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: { id: string } & Partial<Omit<BroilerBatch, "id" | "farm_id" | "created_at">>) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("broiler_batches").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteBroilerBatch() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("broiler_batches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useRecordBroilerDaily() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: {
      batch_id: string; entry_date: string; deaths: number; feed_kg: number;
      avg_weight_g?: number | null; water_litres?: number | null; notes?: string | null;
      /** Birds alive before this entry, used to keep the batch head-count in step. */
      current_birds: number;
    }) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const { error } = await supabase.from("broiler_daily").upsert({
        farm_id: farmId,
        batch_id: input.batch_id,
        entry_date: input.entry_date,
        deaths: input.deaths,
        feed_kg: input.feed_kg,
        avg_weight_g: input.avg_weight_g ?? null,
        water_litres: input.water_litres ?? null,
        notes: input.notes?.trim() || null,
      }, { onConflict: "batch_id,entry_date" });
      if (error) throw error;

      const next = Math.max(0, input.current_birds - input.deaths);
      const { error: upErr } = await supabase
        .from("broiler_batches")
        .update({ current_birds: next })
        .eq("id", input.batch_id);
      if (upErr) throw upErr;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteBroilerDaily() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("broiler_daily").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useRecordBroilerSale() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: {
      batch_id: string; entry_date: string; birds: number; total_weight_kg: number;
      price_per_kg: number; customer?: string | null; payment_method: string;
      notes?: string | null; current_birds: number;
    }) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const amount = input.total_weight_kg * input.price_per_kg;
      const { error } = await supabase.from("broiler_sales").insert({
        farm_id: farmId,
        batch_id: input.batch_id,
        entry_date: input.entry_date,
        birds: input.birds,
        total_weight_kg: input.total_weight_kg,
        price_per_kg: input.price_per_kg,
        amount,
        customer: input.customer?.trim() || null,
        payment_method: input.payment_method,
        notes: input.notes?.trim() || null,
      });
      if (error) throw error;

      const next = Math.max(0, input.current_birds - input.birds);
      const { error: upErr } = await supabase
        .from("broiler_batches")
        .update({ current_birds: next, status: next === 0 ? "sold" : "active" })
        .eq("id", input.batch_id);
      if (upErr) throw upErr;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteBroilerSale() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("broiler_sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}
