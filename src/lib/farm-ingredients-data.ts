// Farm-owned ingredient profiles — laboratory-tested values live here.
// PoultryPro reference values are never written into this table; they are only
// used as a fallback when a farm has not tested an ingredient.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { farmScope, invalidateFarm, useAuthUserId, useFarmId } from "@/lib/farm-data";

export type IngredientSource = "laboratory" | "supplier" | "user_entered" | "poultrypro_default";
export type IngredientCategory =
  | "raw_ingredient"
  | "finished_feed"
  | "concentrate"
  | "additive"
  | "mineral";

export const INGREDIENT_SOURCE_LABELS: Record<IngredientSource, string> = {
  laboratory: "Laboratory",
  supplier: "Supplier",
  user_entered: "User entered",
  poultrypro_default: "PoultryPro default",
};

export const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, string> = {
  raw_ingredient: "Raw ingredient",
  finished_feed: "Finished feed",
  concentrate: "Concentrate / premix",
  additive: "Additive",
  mineral: "Mineral",
};

export type FarmIngredient = {
  id: string;
  farm_id: string;
  name: string;
  category: IngredientCategory;
  cost_per_kg: number | null;
  cp_pct: number | null;
  me_kcal_kg: number | null;
  fat_pct: number | null;
  fibre_pct: number | null;
  ash_pct: number | null;
  moisture_pct: number | null;
  methionine_pct: number | null;
  lysine_pct: number | null;
  calcium_pct: number | null;
  phosphorus_pct: number | null;
  source: IngredientSource;
  test_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const numOrNull = (v: unknown) => (v == null || v === "" ? null : Number(v));

export function useFarmIngredients() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "farm-ingredients"] as const,
    enabled: !!farmId,
    queryFn: async (): Promise<FarmIngredient[]> => {
      const { data, error } = await supabase
        .from("farm_ingredients")
        .select("*")
        .eq("farm_id", farmId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        cost_per_kg: numOrNull(r.cost_per_kg),
        cp_pct: numOrNull(r.cp_pct),
        me_kcal_kg: numOrNull(r.me_kcal_kg),
        fat_pct: numOrNull(r.fat_pct),
        fibre_pct: numOrNull(r.fibre_pct),
        ash_pct: numOrNull(r.ash_pct),
        moisture_pct: numOrNull(r.moisture_pct),
        methionine_pct: numOrNull(r.methionine_pct),
        lysine_pct: numOrNull(r.lysine_pct),
        calcium_pct: numOrNull(r.calcium_pct),
        phosphorus_pct: numOrNull(r.phosphorus_pct),
      })) as FarmIngredient[];
    },
  });
}

export type FarmIngredientInput = Omit<
  FarmIngredient,
  "id" | "farm_id" | "created_at" | "updated_at"
>;

export function useSaveFarmIngredient() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  const { data: userId } = useAuthUserId();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: FarmIngredientInput }) => {
      if (!farmId) throw new Error("No farm selected.");
      const name = values.name.trim();
      if (!name) throw new Error("Enter an ingredient name.");
      if (values.cost_per_kg != null && values.cost_per_kg < 0) {
        throw new Error("Cost per kg cannot be negative.");
      }
      const payload = { ...values, name };
      if (id) {
        const { error } = await supabase.from("farm_ingredients").update(payload).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("farm_ingredients")
        .insert({ ...payload, farm_id: farmId, created_by: userId ?? null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteFarmIngredient() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("farm_ingredients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

/** Reference ranges used only to WARN — a tested value is never overwritten. */
export const REFERENCE_RANGES: Record<string, { min: number; max: number; label: string }> = {
  cp_pct: { min: 0, max: 90, label: "Crude protein" },
  me_kcal_kg: { min: 0, max: 9000, label: "Energy" },
  fat_pct: { min: 0, max: 100, label: "Fat" },
  fibre_pct: { min: 0, max: 60, label: "Fibre" },
  ash_pct: { min: 0, max: 100, label: "Ash" },
  moisture_pct: { min: 0, max: 30, label: "Moisture" },
  methionine_pct: { min: 0, max: 100, label: "Methionine" },
  lysine_pct: { min: 0, max: 100, label: "Lysine" },
  calcium_pct: { min: 0, max: 45, label: "Calcium" },
  phosphorus_pct: { min: 0, max: 30, label: "Phosphorus" },
};

export function outOfRangeFields(values: Partial<FarmIngredientInput>): string[] {
  const out: string[] = [];
  for (const [key, range] of Object.entries(REFERENCE_RANGES)) {
    const v = (values as Record<string, unknown>)[key];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < range.min || n > range.max) out.push(range.label);
  }
  return out;
}
