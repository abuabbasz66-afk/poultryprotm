import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFarmId, farmScope } from "@/lib/farm-data";
import { usePermissions } from "@/lib/rbac";
import { PermissionDenied } from "@/components/permission-denied";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/recycle-bin")({
  component: RecycleBinPage,
  head: () => ({
    meta: [
      { title: "Recycle Bin — PoultryPro" },
      { name: "description", content: "Restore farm records deleted by mistake in the last 30 days." },
      { property: "og:title", content: "Recycle Bin — PoultryPro" },
      { property: "og:description", content: "Undo accidental deletes of eggs, feed, mortality, sales and more." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string;
  table_name: string;
  data: Record<string, any>;
  batch_id: number;
  deleted_at: string;
};

const LABELS: Record<string, string> = {
  egg_production: "Egg record",
  mortality: "Mortality",
  feed_usage: "Feed usage",
  feed_inventory: "Feed stock",
  feed_ledger: "Feed stock movement",
  feed_types: "Feed type",
  feed_formulas: "Feed formula",
  feed_formula_versions: "Formula version",
  feed_formula_ingredients: "Formula ingredient",
  farm_ingredients: "Ingredient",
  farm_expenses: "Expense",
  farm_revenue: "Income",
  prices: "Price",
  rooms: "Room",
  health_records: "Health record",
  vaccination_records: "Vaccination",
  vaccination_programmes: "Vaccination programme",
  vaccination_programme_items: "Programme item",
  flock_vaccination_schedules: "Vaccination schedule",
  broiler_batches: "Broiler batch",
  broiler_daily: "Broiler daily record",
  broiler_medications: "Broiler medication",
  broiler_sales: "Broiler sale",
  broiler_vaccinations: "Broiler vaccination",
  layer_batches: "Rearing batch",
  layer_batch_daily: "Rearing daily record",
  layer_batch_health: "Rearing health",
  layer_batch_milestones: "Rearing milestone",
  layer_batch_weights: "Rearing weight",
};

function describe(r: Row) {
  const d = r.data;
  const date = d.date ?? d.entry_date ?? d.record_date ?? d.usage_date ?? d.sale_date ?? d.purchase_date;
  const name = d.name ?? d.item ?? d.description ?? d.vaccine_name ?? d.subcategory ?? d.category;
  const amount = d.amount != null ? `₦${Number(d.amount).toLocaleString()}` : null;
  return [date, name, amount].filter(Boolean).join(" · ") || "—";
}

function RecycleBinPage() {
  const { isOwner, loading } = usePermissions();
  const { data: farmId } = useFarmId();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["recycle-bin", farmId],
    enabled: !!farmId && isOwner,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.rpc("recycle_bin_list", { _farm_id: farmId! });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of q.data ?? []) m.set(r.batch_id, (m.get(r.batch_id) ?? 0) + 1);
    return m;
  }, [q.data]);

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("recycle_bin_restore", { _id: id });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(n > 1 ? `${n} records restored` : "Record restored");
      qc.invalidateQueries({ queryKey: ["recycle-bin"] });
      qc.invalidateQueries({ queryKey: farmScope(farmId) });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not restore"),
    onSettled: () => setBusy(null),
  });

  const purge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("recycle_bin_purge", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recycle-bin"] }),
    onSettled: () => setBusy(null),
  });

  if (loading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isOwner) return <PermissionDenied />;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Trash2 className="h-6 w-6" /> Recycle Bin</h1>
        <p className="text-sm text-muted-foreground">
          Records deleted in the last 30 days. Restore anything removed by mistake. After 30 days they are removed for good.
        </p>
      </div>

      {q.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : q.error ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : !q.data?.length ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">The recycle bin is empty.</div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {q.data.map((r) => {
            const group = counts.get(r.batch_id) ?? 1;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{LABELS[r.table_name] ?? r.table_name}</div>
                  <div className="truncate text-sm text-muted-foreground">{describe(r)}</div>
                  <div className="text-xs text-muted-foreground">
                    Deleted {new Date(r.deleted_at).toLocaleString()}
                    {group > 1 && ` · deleted together with ${group - 1} other record${group > 2 ? "s" : ""}`}
                  </div>
                </div>
                <Button size="sm" disabled={!!busy} onClick={() => { setBusy(r.id); restore.mutate(r.id); }}>
                  {busy === r.id && restore.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Restore{group > 1 ? " all" : ""}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!!busy}
                  onClick={() => {
                    if (confirm("Remove this record for good? This cannot be undone.")) { setBusy(r.id); purge.mutate(r.id); }
                  }}
                >
                  Delete forever
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
