// Add Feed Purchase — bags-first entry with live kg / cost / cost-per-kg maths
// and an optional linked Finance expense (never a second, unlinked one).
import { useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAddFeedPurchase, purchaseTotals } from "@/lib/feed-purchases-data";
import { useFeedTypes } from "@/lib/feed-types-data";
import { useFarm } from "@/lib/farm-data";
import { toDateKey } from "@/lib/date-key";
import { errorMessage } from "@/lib/error-message";

const nairaFmt = (n: number) => `₦${Math.round(n).toLocaleString()}`;

export function PurchaseForm({ onClose }: { onClose: () => void }) {
  const farm = useFarm();
  const typesQ = useFeedTypes();
  const add = useAddFeedPurchase();
  const defaultBag = farm.data?.bag_weight_kg ?? 25;

  const [feedType, setFeedType] = useState("");
  const [supplier, setSupplier] = useState("");
  const [bags, setBags] = useState("");
  const [bagSize, setBagSize] = useState(String(defaultBag));
  const [costPerBag, setCostPerBag] = useState("");
  const [date, setDate] = useState(toDateKey(new Date()) ?? "");
  const [reference, setReference] = useState("");
  const [expiry, setExpiry] = useState("");
  const [note, setNote] = useState("");
  const [postToFinance, setPostToFinance] = useState(true);

  const totals = useMemo(
    () => purchaseTotals(Number(bags), Number(bagSize), Number(costPerBag)),
    [bags, bagSize, costPerBag],
  );

  const valid =
    feedType.trim().length > 0 &&
    Number(bags) > 0 &&
    Number(bagSize) > 0 &&
    Number(costPerBag) >= 0;

  const submit = async () => {
    try {
      await add.mutateAsync({
        feed_type: feedType.trim(),
        feed_type_id: (typesQ.data ?? []).find((t) => t.name === feedType.trim())?.id ?? null,
        supplier: supplier.trim() || null,
        bags: Number(bags),
        bag_size_kg: Number(bagSize),
        cost_per_bag: Number(costPerBag),
        purchase_date: date || undefined,
        reference: reference.trim() || null,
        batch_number: reference.trim() || null,
        expiry_date: expiry || null,
        note: note.trim() || null,
        postToFinance,
      });
      toast.success("Feed purchase recorded");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, "Unable to save this purchase. Please try again."));
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">Add feed purchase</h3>
        <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Feed name / type">
          <input
            list="feed-type-options"
            value={feedType}
            onChange={(e) => setFeedType(e.target.value)}
            placeholder="e.g. Layer Mash"
            className={inputCls}
          />
          <datalist id="feed-type-options">
            {(typesQ.data ?? []).map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Supplier">
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Optional" className={inputCls} />
        </Field>
        <Field label="Number of bags">
          <input inputMode="decimal" type="number" min={0} value={bags} onChange={(e) => setBags(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Bag size (kg)">
          <input inputMode="decimal" type="number" min={0} value={bagSize} onChange={(e) => setBagSize(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Cost per bag (₦)">
          <input inputMode="decimal" type="number" min={0} value={costPerBag} onChange={(e) => setCostPerBag(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Purchase date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Reference / batch">
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" className={inputCls} />
        </Field>
        <Field label="Expiry date">
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className={inputCls} />
          </Field>
        </div>
      </div>

      {/* Live calculation preview */}
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-muted/40 p-3 text-center">
        <Calc label="Total quantity" value={`${Math.round(totals.totalKg * 10) / 10} kg`} />
        <Calc label="Total cost" value={nairaFmt(totals.totalCost)} />
        <Calc label="Cost per kg" value={totals.totalKg > 0 ? nairaFmt(totals.costPerKg) : "—"} />
      </div>

      <label className="mt-3 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={postToFinance}
          onChange={(e) => setPostToFinance(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border"
        />
        <span className="text-muted-foreground">
          Also record this as a feed expense in Finance (linked to this stock, so it is not counted twice).
        </span>
      </label>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button onClick={onClose} className="min-h-11 rounded-full border border-border px-4 text-sm font-medium">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!valid || add.isPending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--forest)] px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save purchase
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-[color:var(--forest)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Calc({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
