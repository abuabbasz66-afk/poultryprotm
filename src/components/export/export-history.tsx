import { useQuery } from "@tanstack/react-query";
import { FileClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFarmId } from "@/lib/farm-data";

type LogRow = {
  id: string;
  actor_name: string | null;
  export_label: string;
  format: string;
  range_label: string;
  row_count: number;
  created_at: string;
};

const FORMAT_LABEL: Record<string, string> = { pdf: "PDF", excel: "Excel", csv: "CSV" };

/** Recent export activity — metadata only; no report files are stored. */
export function ExportHistoryCard() {
  const { data: farmId } = useFarmId();
  const q = useQuery({
    queryKey: ["export", "history", farmId],
    enabled: !!farmId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_audit_log")
        .select("id,actor_name,export_label,format,range_label,row_count,created_at")
        .eq("farm_id", farmId!)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const rows = q.data ?? [];

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
      <div className="flex items-center gap-2">
        <FileClock className="h-5 w-5 text-[color:var(--forest)]" />
        <h2 className="font-display text-xl font-semibold">Recent Exports</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        A record of who downloaded what and when. Report files are never stored.
      </p>

      {q.isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No records have been exported yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{r.export_label}</div>
                <div className="text-xs text-muted-foreground">
                  {r.range_label} · {r.row_count.toLocaleString()} records
                  {r.actor_name ? ` · ${r.actor_name}` : ""}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {FORMAT_LABEL[r.format] ?? r.format} ·{" "}
                {new Date(r.created_at).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
