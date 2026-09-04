// Per-farm feed type catalogue: classification + farm-specific low-stock level.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { farmScope, invalidateFarm, useAuthUserId, useFarmId } from "@/lib/farm-data";

export type MaterialClass = "raw_ingredient" | "finished_feed" | "concentrate";

export const MATERIAL_CLASS_LABELS: Record<MaterialClass, string> = {
  raw_ingredient: "Raw ingredient",
  finished_feed: "Finished feed",
  concentrate: "Concentrate / premix",
};

export type FeedType = {
  id: string;
  farm_id: string;
  name: string;
  material_class: MaterialClass;
  low_stock_kg: number;
  is_active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

const num = (v: unknown) => (v == null ? 0 : Number(v));

export function useFeedTypes() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "feed-types"] as const,
    enabled: !!farmId,
    queryFn: async (): Promise<FeedType[]> => {
      const { data, error } = await supabase
        .from("feed_types")
        .select("id, farm_id, name, material_class, low_stock_kg, is_active, note, created_at, updated_at")
        .eq("farm_id", farmId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, low_stock_kg: num(r.low_stock_kg) })) as FeedType[];
    },
  });
}

export type FeedTypeInput = {
  name: string;
  material_class: MaterialClass;
  low_stock_kg: number;
  note?: string | null;
  is_active?: boolean;
};

export function useSaveFeedType() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  const { data: userId } = useAuthUserId();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: FeedTypeInput }) => {
      if (!farmId) throw new Error("No farm selected.");
      const name = values.name.trim();
      if (!name) throw new Error("Enter a feed name.");
      if (!Number.isFinite(values.low_stock_kg) || values.low_stock_kg < 0) {
        throw new Error("Minimum stock level cannot be negative.");
      }
      const payload = {
        name,
        material_class: values.material_class,
        low_stock_kg: values.low_stock_kg,
        note: values.note ?? null,
        is_active: values.is_active ?? true,
      };
      if (id) {
        const { error } = await supabase.from("feed_types").update(payload).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("feed_types")
        .insert({ ...payload, farm_id: farmId, created_by: userId ?? null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteFeedType() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feed_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}
