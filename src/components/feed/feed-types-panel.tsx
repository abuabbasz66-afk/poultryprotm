// Feed types: classification (raw ingredient / finished feed / concentrate)
// and each farm's OWN minimum stock level. Also shows live stock per feed.
import { useState } from "react";
import { AlertTriangle, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  useFeedTypes, useSaveFeedType, useDeleteFeedType,
  MATERIAL_CLASS_LABELS, type FeedType, type MaterialClass,
} from "@/lib/feed-types-data";
import { useFeedTypeStock } from "@/lib/feed-purchases-data";
import { friendlyError } from "@/lib/error-message";

const kg = (n: number) => `${Math.round(n * 10) / 10} kg`;

export function FeedTypesPanel() {
  const typesQ = useFeedTypes();
  const stock = useFeedTypeStock();
  const del = useDeleteFeedType();
  const [editing, setEditing] = useState<FeedType | "new" | null>(null);

  const types = typesQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Stock status</h2>
            <p className="text-xs text-muted-foreground">Live stock per feed against your own minimum level.</p>
          </div>
          <button
            onClick={() => setEditing("new")}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[color:var(--forest)] px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Feed type
          </button>
        </div>

        {stock.rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No feed stock recorded. Add a feed type and record your first purchase.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {stock.rows.map((r) => (
              <li key={r.key} className="rounded-2xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.type ? MATERIAL_CLASS_LABELS[r.type.material_class] : "Unclassified"} · {r.lots} active batch{r.lots === 1 ? "" : "es"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{kg(r.stockKg)}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.daysRemaining != null && Number.isFinite(r.daysRemaining)
                        ? `~${Math.floor(r.daysRemaining)} days left (estimate)`
                        : "Not enough usage history"}
                    </p>
                  </div>
                </div>
                {r.low && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> Low stock — {r.name} is below your minimum of {kg(r.thresholdKg)}.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <FeedTypeForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <div className="rounded-3xl border border-border bg-card p-4 md:p-5">
        <h2 className="font-display text-lg font-semibold">Feed types &amp; minimum levels</h2>
        {types.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No feed types yet. Add one to set its own low-stock level.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {types.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {MATERIAL_CLASS_LABELS[t.material_class]} · minimum {kg(t.low_stock_kg)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => setEditing(t)} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await del.mutateAsync(t.id);
                        toast.success("Feed type removed");
                      } catch (e) {
                        toast.error(friendlyError(e, "Unable to remove this feed type."));
                      }
                    }}
                    className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FeedTypeForm({ initial, onClose }: { initial: FeedType | null; onClose: () => void }) {
  const save = useSaveFeedType();
  const [name, setName] = useState(initial?.name ?? "");
  const [cls, setCls] = useState<MaterialClass>(initial?.material_class ?? "finished_feed");
  const [low, setLow] = useState(String(initial?.low_stock_kg ?? 0));

  const submit = async () => {
    try {
      await save.mutateAsync({
        id: initial?.id,
        values: { name, material_class: cls, low_stock_kg: Number(low) || 0 },
      });
      toast.success(initial ? "Feed type updated" : "Feed type added");
      onClose();
    } catch (e) {
      toast.error(friendlyError(e, "Unable to save this feed type."));
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">{initial ? "Edit feed type" : "Add feed type"}</h3>
        <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Layer Mash" className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Classification</span>
          <select value={cls} onChange={(e) => setCls(e.target.value as MaterialClass)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
            {(Object.keys(MATERIAL_CLASS_LABELS) as MaterialClass[]).map((k) => (
              <option key={k} value={k}>{MATERIAL_CLASS_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Minimum stock (kg)</span>
          <input type="number" inputMode="decimal" min={0} value={low} onChange={(e) => setLow(e.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" />
        </label>
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button onClick={onClose} className="min-h-11 rounded-full border border-border px-4 text-sm font-medium">Cancel</button>
        <button
          onClick={submit}
          disabled={!name.trim() || save.isPending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--forest)] px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
        </button>
      </div>
    </div>
  );
}
