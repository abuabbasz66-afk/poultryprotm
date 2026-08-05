import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { farmScope, useAuthUserId, useFarmId } from "@/lib/farm-data";
import { useFarmContext } from "@/lib/rbac";

export type ExpenseRow = {
  id: string;
  farm_id: string;
  entry_date: string;
  category: string;
  subcategory: string;
  description: string | null;
  amount: number;
  payment_method: string;
  supplier: string | null;
  receipt_path: string | null;
  notes: string | null;
  recorded_by: string | null;
  recorded_by_name: string | null;
  created_at: string;
};

export type RevenueRow = {
  id: string;
  farm_id: string;
  entry_date: string;
  category: string;
  item: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  customer: string | null;
  payment_method: string;
  notes: string | null;
  recorded_by: string | null;
  recorded_by_name: string | null;
  created_at: string;
};

export type ExpenseInput = Omit<ExpenseRow, "id" | "farm_id" | "created_at" | "recorded_by" | "recorded_by_name">;
export type RevenueInput = Omit<RevenueRow, "id" | "farm_id" | "created_at" | "recorded_by" | "recorded_by_name">;

function num(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function useExpenses() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "expenses"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<ExpenseRow[]> => {
      const { data, error } = await supabase
        .from("farm_expenses")
        .select("*")
        .eq("farm_id", farmId!)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, amount: num(r.amount) })) as ExpenseRow[];
    },
  });
}

export function useRevenue() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "revenue"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<RevenueRow[]> => {
      const { data, error } = await supabase
        .from("farm_revenue")
        .select("*")
        .eq("farm_id", farmId!)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        amount: num(r.amount),
        quantity: num(r.quantity),
        unit_price: num(r.unit_price),
      })) as RevenueRow[];
    },
  });
}

function useActor() {
  const { data: userId } = useAuthUserId();
  const { data: ctx } = useFarmContext();
  return {
    recorded_by: userId ?? null,
    recorded_by_name: ctx?.fullName || ctx?.email || null,
  };
}

/** Invalidate every surface that derives from money movements. */
function useFinanceInvalidate() {
  const qc = useQueryClient();
  const { data: farmId } = useFarmId();
  return () => qc.invalidateQueries({ queryKey: farmScope(farmId) });
}

export function useSaveExpense() {
  const { data: farmId } = useFarmId();
  const actor = useActor();
  const invalidate = useFinanceInvalidate();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ExpenseInput }) => {
      if (!farmId) throw new Error("No farm selected");
      if (id) {
        const { error } = await supabase.from("farm_expenses").update(values).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("farm_expenses").insert({ ...values, farm_id: farmId, ...actor });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSaveRevenue() {
  const { data: farmId } = useFarmId();
  const actor = useActor();
  const invalidate = useFinanceInvalidate();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: RevenueInput }) => {
      if (!farmId) throw new Error("No farm selected");
      if (id) {
        const { error } = await supabase.from("farm_revenue").update(values).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("farm_revenue").insert({ ...values, farm_id: farmId, ...actor });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteFinanceRow(table: "farm_expenses" | "farm_revenue") {
  const invalidate = useFinanceInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Uploads a receipt to the private bucket and returns its storage path. */
export async function uploadReceipt(farmId: string, file: File) {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${farmId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function receiptUrl(path: string) {
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
