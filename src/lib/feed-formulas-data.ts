import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFarmId, useFarm, invalidateFarm, farmScope } from "@/lib/farm-data";

export type FormulaIngredient = {
  id: string;
  formula_id: string;
  farm_id: string;
  name: string;
  quantity_kg: number;
  price_per_unit: number;
  unit: "kg" | "bag";
  unit_weight_kg: number;
  position: number;
};

export type FeedFormula = {
  id: string;
  farm_id: string;
  name: string;
  notes: string | null;
  is_active: boolean;
  bag_weight_kg: number | null;
  created_at: string;
  updated_at: string;
};

export type FeedFormulaWithIngredients = FeedFormula & { ingredients: FormulaIngredient[] };

const num = (v: unknown) => (v == null ? 0 : Number(v));

export function useFeedFormulas() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "feed-formulas"] as const,
    enabled: !!farmId,
    queryFn: async (): Promise<FeedFormulaWithIngredients[]> => {
      const { data: formulas, error } = await supabase
        .from("feed_formulas")
        .select("*")
        .eq("farm_id", farmId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (formulas ?? []).map((f) => f.id);
      if (!ids.length) return [];
      const { data: ings, error: iErr } = await supabase
        .from("feed_formula_ingredients")
        .select("*")
        .in("formula_id", ids)
        .order("position", { ascending: true });
      if (iErr) throw iErr;
      return (formulas ?? []).map((f) => ({
        ...(f as FeedFormula),
        bag_weight_kg: f.bag_weight_kg == null ? null : Number(f.bag_weight_kg),
        ingredients: (ings ?? [])
          .filter((i) => i.formula_id === f.id)
          .map((i) => ({
            ...(i as FormulaIngredient),
            quantity_kg: num(i.quantity_kg),
            price_per_unit: num(i.price_per_unit),
            unit_weight_kg: num(i.unit_weight_kg) || 1,
          })),
      }));
    },
  });
}

/**
 * Cost math for a formula. All quantities normalised to kg internally.
 * - For unit="bag": `quantity_kg` is the BAG COUNT and `unit_weight_kg` is the bag size (kg).
 *   Weight (kg) = bagCount × bagSize.  Line cost = bagCount × price_per_bag.
 * - For unit="kg":  `quantity_kg` is kilograms.  Line cost = kg × price_per_kg.
 */
export function computeFormulaCost(f: FeedFormulaWithIngredients, defaultBagKg: number) {
  const bagKg = f.bag_weight_kg && f.bag_weight_kg > 0 ? f.bag_weight_kg : defaultBagKg;
  let totalKg = 0;
  let totalCost = 0;
  const rows = f.ingredients.map((i) => {
    const qty = Math.max(0, i.quantity_kg);
    const ingredientBagKg = i.unit === "bag" ? Math.max(0, i.unit_weight_kg) : 0;
    const weightKg = i.unit === "bag" ? qty * ingredientBagKg : qty;
    const cost = qty * i.price_per_unit; // price_per_unit matches the chosen unit
    const perKg = weightKg > 0 ? cost / weightKg : 0;
    totalKg += weightKg;
    totalCost += cost;
    return { ...i, weightKg, pricePerKg: perKg, lineCost: cost, sharePct: 0 };
  });
  rows.forEach((r) => (r.sharePct = totalCost > 0 ? (r.lineCost / totalCost) * 100 : 0));
  const costPerKg = totalKg > 0 ? totalCost / totalKg : 0;
  const costPerBag = costPerKg * bagKg;
  const bagsProduced = bagKg > 0 ? totalKg / bagKg : 0;
  return { rows, totalKg, totalCost, costPerKg, costPerBag, bagsProduced, bagKg };
}

export function useActiveFormulaCostPerKg(): number | null {
  const q = useFeedFormulas();
  const farm = useFarm();
  return useMemo(() => {
    const list = q.data ?? [];
    const active = list.find((f) => f.is_active);
    if (!active) return null;
    const bagKg = farm.data?.bag_weight_kg && farm.data.bag_weight_kg > 0 ? farm.data.bag_weight_kg : 25;
    const c = computeFormulaCost(active, bagKg);
    return c.costPerKg > 0 ? c.costPerKg : null;
  }, [q.data, farm.data?.bag_weight_kg]);
}

/* -------------------------------- Mutations ------------------------------ */

export function useCreateFormula() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return useMutation({
    mutationFn: async (input: { name: string; notes?: string | null; bag_weight_kg?: number | null }) => {
      if (!farmId) throw new Error("No farm");
      const { data, error } = await supabase
        .from("feed_formulas")
        .insert({ farm_id: farmId, name: input.name, notes: input.notes ?? null, bag_weight_kg: input.bag_weight_kg ?? null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdateFormula() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Pick<FeedFormula, "name" | "notes" | "bag_weight_kg">> }) => {
      const { error } = await supabase.from("feed_formulas").update(input.patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteFormula() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feed_formulas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDuplicateFormula() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return useMutation({
    mutationFn: async (source: FeedFormulaWithIngredients) => {
      if (!farmId) throw new Error("No farm");
      const { data: created, error } = await supabase
        .from("feed_formulas")
        .insert({
          farm_id: farmId,
          name: `${source.name} (copy)`,
          notes: source.notes,
          bag_weight_kg: source.bag_weight_kg,
        })
        .select("id")
        .single();
      if (error) throw error;
      const newId = created.id as string;
      if (source.ingredients.length) {
        const { error: iErr } = await supabase.from("feed_formula_ingredients").insert(
          source.ingredients.map((i) => ({
            farm_id: farmId,
            formula_id: newId,
            name: i.name,
            quantity_kg: i.quantity_kg,
            price_per_unit: i.price_per_unit,
            unit: i.unit,
            unit_weight_kg: i.unit_weight_kg,
            position: i.position,
          })),
        );
        if (iErr) throw iErr;
      }
      return newId;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}


export function useSetActiveFormula() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return useMutation({
    mutationFn: async (formulaId: string | null) => {
      if (!farmId) throw new Error("No farm");
      // Clear any existing active first (unique partial index requires this).
      const { error: clearErr } = await supabase
        .from("feed_formulas")
        .update({ is_active: false })
        .eq("farm_id", farmId)
        .eq("is_active", true);
      if (clearErr) throw clearErr;
      if (formulaId) {
        const { error } = await supabase.from("feed_formulas").update({ is_active: true }).eq("id", formulaId);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpsertIngredient() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      formula_id: string;
      name: string;
      quantity_kg: number;
      price_per_unit: number;
      unit: "kg" | "bag";
      unit_weight_kg: number;
      position: number;
    }) => {
      if (!farmId) throw new Error("No farm");
      if (input.id) {
        const { id, ...patch } = input;
        const { error } = await supabase.from("feed_formula_ingredients").update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("feed_formula_ingredients").insert({ farm_id: farmId, ...input });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteIngredient() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feed_formula_ingredients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useSetFeedSource() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return useMutation({
    mutationFn: async (source: "purchased" | "self_produced") => {
      if (!farmId) throw new Error("No farm");
      const { error } = await supabase.from("farms").update({ feed_source: source }).eq("id", farmId);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}
