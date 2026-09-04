// Stock adjustment — writes a new ledger movement, never edits history.
import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useStockAdjustment } from "@/lib/feed-purchases-data";
import { useFeedStockAnalytics } from "@/lib/feed-inventory-data";
import { friendlyError } from "@/lib/error-message";
import { toDateKey } from "@/lib/date-key";

export function AdjustmentForm({ onClose }: { onClose: () => void }) {
  const adjust = useStockAdjustment();
  const stats = useFeedStockAnalytics();
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(toDateKey(new Date()) ?? "");

  const submit = async () => {
    try {
      await adjust.mutateAsync({
        direction,
        quantity_kg: Number(qty),
        reason: reason.trim(),
        entry_date: date || undefined,
      });
      toast.success("Stock adjustment recorded");
      onClose();
    } catch (e) {
      toast.error(friendlyError(e, "Unable to save this adjustment. Please try again."));
    }
  };

  const valid = Number(qty) > 0 && reason.trim().length > 0;

  return (
    <div className="rounded-3xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">Stock adjustment</h3>
        <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Available now: {Math.round(stats.stockKg * 10) / 10} kg. Adjustments are added as new entries — earlier records stay untouched.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Adjustment</span>
          <div className="grid grid-cols-2 gap-2">
            {(["remove", "add"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`min-h-11 rounded-xl border px-3 text-sm font-medium ${
                  direction === d ? "border-[color:var(--forest)] bg-[color:var(--forest)]/10" : "border-border"
                }`}
              >
                {d === "remove" ? "Remove stock" : "Add stock"}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Quantity (kg)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Reason</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Spillage, stock count correction"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button onClick={onClose} className="min-h-11 rounded-full border border-border px-4 text-sm font-medium">Cancel</button>
        <button
          onClick={submit}
          disabled={!valid || adjust.isPending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--forest)] px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {adjust.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save adjustment
        </button>
      </div>
    </div>
  );
}
