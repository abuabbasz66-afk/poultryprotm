import { useEffect, useMemo, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPENSE_CATEGORIES, PAYMENT_METHODS, REVENUE_CATEGORIES, REVENUE_UNITS,
  type RevenueCategoryKey,
} from "@/lib/finance-catalog";
import {
  uploadReceipt, useSaveExpense, useSaveRevenue,
  type ExpenseRow, type RevenueRow,
} from "@/lib/finance-data";
import { dayKey } from "@/lib/finance-analytics";
import { useFarmId } from "@/lib/farm-data";

const field = "mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--forest)]";

export function ExpenseDialog({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing?: ExpenseRow | null }) {
  const { data: farmId } = useFarmId();
  const save = useSaveExpense();
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].key as string);
  const [subcategory, setSubcategory] = useState(EXPENSE_CATEGORIES[0].subcategories[0]);
  const [entryDate, setEntryDate] = useState(dayKey(new Date()));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const subcategories = useMemo(
    () => EXPENSE_CATEGORIES.find((c) => c.key === category)?.subcategories ?? [],
    [category],
  );

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCategory(editing.category);
      setSubcategory(editing.subcategory);
      setEntryDate(editing.entry_date);
      setAmount(String(editing.amount));
      setDescription(editing.description ?? "");
      setPaymentMethod(editing.payment_method);
      setSupplier(editing.supplier ?? "");
      setNotes(editing.notes ?? "");
    } else {
      setCategory(EXPENSE_CATEGORIES[0].key);
      setSubcategory(EXPENSE_CATEGORIES[0].subcategories[0]);
      setEntryDate(dayKey(new Date()));
      setAmount("");
      setDescription("");
      setPaymentMethod(PAYMENT_METHODS[0]);
      setSupplier("");
      setNotes("");
    }
    setFile(null);
  }, [open, editing]);

  useEffect(() => {
    if (!subcategories.includes(subcategory)) setSubcategory(subcategories[0] ?? "");
  }, [subcategories, subcategory]);

  const submit = async () => {
    const value = Number(amount);
    if (!(value > 0)) { toast.error("Enter an amount greater than zero."); return; }
    setBusy(true);
    try {
      let receipt_path = editing?.receipt_path ?? null;
      if (file && farmId) receipt_path = await uploadReceipt(farmId, file);
      await save.mutateAsync({
        id: editing?.id,
        values: {
          entry_date: entryDate,
          category,
          subcategory,
          description: description || null,
          amount: value,
          payment_method: paymentMethod,
          supplier: supplier || null,
          receipt_path,
          notes: notes || null,
        },
      });
      toast.success(editing ? "Expense updated" : "Expense recorded");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the expense");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit expense" : "Record expense"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Date</Label>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Amount (₦)</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="mt-1.5" />
          </div>
          <div>
            <Label>Category</Label>
            <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Subcategory</Label>
            <select className={field} value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
              {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was purchased" className="mt-1.5" />
          </div>
          <div>
            <Label>Payment method</Label>
            <select className={field} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <Label>Supplier (optional)</Label>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="mt-1.5" />
          </div>
          <div className="sm:col-span-2">
            <Label className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> Receipt (optional)</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1.5" />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1.5" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Save expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RevenueDialog({
  open, onOpenChange, editing, allowedCategories,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: RevenueRow | null;
  allowedCategories?: RevenueCategoryKey[];
}) {
  const save = useSaveRevenue();
  const categories = useMemo(
    () => REVENUE_CATEGORIES.filter((c) => !allowedCategories || allowedCategories.includes(c.key)),
    [allowedCategories],
  );
  const [category, setCategory] = useState<string>(categories[0]?.key ?? "eggs");
  const [item, setItem] = useState(categories[0]?.items[0]?.name ?? "");
  const [entryDate, setEntryDate] = useState(dayKey(new Date()));
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState(categories[0]?.items[0]?.unit ?? "unit");
  const [unitPrice, setUnitPrice] = useState("");
  const [customer, setCustomer] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const items = useMemo(
    () => categories.find((c) => c.key === category)?.items ?? [],
    [categories, category],
  );

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCategory(editing.category);
      setItem(editing.item);
      setEntryDate(editing.entry_date);
      setQuantity(String(editing.quantity));
      setUnit(editing.unit);
      setUnitPrice(String(editing.unit_price));
      setCustomer(editing.customer ?? "");
      setPaymentMethod(editing.payment_method);
      setNotes(editing.notes ?? "");
    } else {
      const first = categories[0];
      setCategory(first?.key ?? "eggs");
      setItem(first?.items[0]?.name ?? "");
      setUnit(first?.items[0]?.unit ?? "unit");
      setEntryDate(dayKey(new Date()));
      setQuantity("1");
      setUnitPrice("");
      setCustomer("");
      setPaymentMethod(PAYMENT_METHODS[0]);
      setNotes("");
    }
  }, [open, editing, categories]);

  const total = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  const pickItem = (name: string) => {
    setItem(name);
    const match = items.find((i) => i.name === name);
    if (match) setUnit(match.unit);
  };

  const submit = async () => {
    if (!item) { toast.error("Choose the item sold."); return; }
    if (!(total > 0)) { toast.error("Quantity and unit price must give a total above zero."); return; }
    setBusy(true);
    try {
      await save.mutateAsync({
        id: editing?.id,
        values: {
          entry_date: entryDate,
          category,
          item,
          quantity: Number(quantity) || 0,
          unit,
          unit_price: Number(unitPrice) || 0,
          amount: total,
          customer: customer || null,
          payment_method: paymentMethod,
          notes: notes || null,
        },
      });
      toast.success(editing ? "Revenue updated" : "Revenue recorded");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the sale");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit revenue" : "Record revenue"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Date</Label>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Category</Label>
            <select
              className={field}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                const first = categories.find((c) => c.key === e.target.value)?.items[0];
                if (first) { setItem(first.name); setUnit(first.unit); }
              }}
            >
              {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Item sold</Label>
            <select className={field} value={item} onChange={(e) => pickItem(e.target.value)}>
              {items.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Unit</Label>
            <select className={field} value={unit} onChange={(e) => setUnit(e.target.value)}>
              {REVENUE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Unit price (₦)</Label>
            <Input inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0" className="mt-1.5" />
          </div>
          <div className="sm:col-span-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
            Total amount: <strong>₦{Math.round(total).toLocaleString("en-NG")}</strong>
          </div>
          <div>
            <Label>Customer (optional)</Label>
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Payment method</Label>
            <select className={field} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1.5" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Save revenue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
