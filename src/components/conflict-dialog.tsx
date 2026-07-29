import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { listOutbox, removeOutbox, updateOutbox, type OutboxItem } from "@/lib/offline/outbox";
import { refreshPendingCount } from "@/lib/offline/data";
import { syncNow } from "@/lib/offline/sync-engine";

function label(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function show(v: unknown) {
  if (v == null || v === "") return "—";
  return String(v);
}

/**
 * "Two versions of this record exist." Nothing is ever overwritten silently —
 * the farmer chooses Keep Local, Keep Cloud, or merges field by field.
 */
export function ConflictDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [picks, setPicks] = useState<Record<string, "local" | "cloud">>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id ?? null;
    const all = await listOutbox(uid);
    setItems(all.filter((i) => i.status === "conflict"));
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const current = items[0];

  const finish = async (uid: string) => {
    await refreshPendingCount(uid);
    await load();
    void syncNow({ silent: true });
  };

  const keepCloud = async (item: OutboxItem) => {
    setBusy(true);
    await removeOutbox(item.id);
    await finish(item.userId);
    setBusy(false);
  };

  const keepLocal = async (item: OutboxItem) => {
    setBusy(true);
    // Re-base on the cloud version so the write applies cleanly next pass.
    await updateOutbox(item.id, { userId: item.userId, status: "pending", cloud: null, lastError: null });
    await finish(item.userId);
    setBusy(false);
  };

  const merge = async (item: OutboxItem) => {
    setBusy(true);
    const merged: Record<string, unknown> = { ...item.payload };
    for (const key of Object.keys(item.payload)) {
      if ((picks[key] ?? "local") === "cloud") merged[key] = item.cloud?.[key];
    }
    await updateOutbox(item.id, { userId: item.userId, status: "pending", payload: merged, cloud: null, lastError: null });
    await finish(item.userId);
    setPicks({});
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Two versions of this record exist
          </DialogTitle>
          <DialogDescription>
            This record changed in the cloud while you were offline. Choose which version to keep — nothing is
            overwritten until you decide.
          </DialogDescription>
        </DialogHeader>

        {!current ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No records need review.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label(current.table)} · saved {new Date(current.createdAt).toLocaleString()}
            </p>

            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-px bg-border text-[11px] font-semibold uppercase tracking-wide">
                <div className="bg-muted px-2.5 py-1.5">Field</div>
                <div className="bg-muted px-2.5 py-1.5">This device</div>
                <div className="bg-muted px-2.5 py-1.5">Cloud</div>
              </div>
              {Object.keys(current.payload).map((k) => {
                const pick = picks[k] ?? "local";
                return (
                  <div key={k} className="grid grid-cols-[1fr_1fr_1fr] gap-px bg-border text-xs">
                    <div className="bg-background px-2.5 py-2 font-medium">{label(k)}</div>
                    <button
                      type="button"
                      onClick={() => setPicks((p) => ({ ...p, [k]: "local" }))}
                      className={`px-2.5 py-2 text-left ${pick === "local" ? "bg-primary/10 font-semibold" : "bg-background"}`}
                    >
                      {show(current.payload[k])}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPicks((p) => ({ ...p, [k]: "cloud" }))}
                      className={`px-2.5 py-2 text-left ${pick === "cloud" ? "bg-primary/10 font-semibold" : "bg-background"}`}
                    >
                      {show(current.cloud?.[k])}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void keepLocal(current)}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                Keep local version
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void keepCloud(current)}
                className="rounded-lg border border-input px-3 py-2 text-xs font-semibold transition hover:bg-accent disabled:opacity-50"
              >
                Keep cloud version
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void merge(current)}
                className="rounded-lg border border-input px-3 py-2 text-xs font-semibold transition hover:bg-accent disabled:opacity-50"
              >
                Merge selected
              </button>
            </div>

            {items.length > 1 && (
              <p className="text-xs text-muted-foreground">{items.length - 1} more record(s) to review after this one.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
