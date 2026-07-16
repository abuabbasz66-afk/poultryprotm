import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { X, Loader2, CalendarDays } from "lucide-react";
import { format, parse } from "date-fns";
import {
  useAddRoom,
  useAddEgg, useUpdateEgg,
  useAddMortality, useUpdateMortality,
  useAddHealth, useUpdateHealth,
  useAddFeed, useUpdateFeed,
  useAddPrice, useUpdatePrice,
  HEALTH_TYPES, normalizeHealthType,
  type Room, type EggRow, type Mortality, type Health, type HealthType, type Feed, type Price,
} from "@/lib/farm-data";
import { toDateKey } from "@/lib/date-key";

export type RecordDialogState =
  | { kind: "room-add" }
  | { kind: "egg-add" }
  | { kind: "egg-edit"; item: EggRow }
  | { kind: "mortality-add" }
  | { kind: "mortality-edit"; item: Mortality }
  | { kind: "health-add" }
  | { kind: "health-edit"; item: Health }
  | { kind: "feed-add" }
  | { kind: "feed-edit"; item: Feed }
  | { kind: "feed-day-edit"; items: Feed[] }
  | { kind: "price-add" }
  | { kind: "price-edit"; item: Price };

/* ---------- Presentational primitives ---------- */

function Modal({
  open, onClose, title, subtitle, children,
}: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 backdrop-blur-sm p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-[calc(100%-24px)] mx-3 mb-3 sm:m-0 sm:max-w-lg max-h-[90dvh] sm:max-h-[92vh] flex flex-col rounded-3xl bg-[color:var(--cream)] border border-[color:var(--forest)]/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--forest)]/10 bg-background/70 px-5 py-4">
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold text-[color:var(--forest)] truncate">{title}</div>
            {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="shrink-0 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-[color:var(--forest)] uppercase tracking-wider mb-1.5">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl border border-[color:var(--forest)]/15 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-[color:var(--gold)]/40 focus:border-[color:var(--forest)]/40 transition";

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputBase + " " + (props.className ?? "")} />;
}
function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" inputMode="numeric" min={0} {...props} className={inputBase + " " + (props.className ?? "")} />;
}
function SelectInput({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputBase + " pr-8 " + (props.className ?? "")}>{children}</select>;
}
function DateInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input type="date" {...props} className={inputBase + " pr-10 " + (props.className ?? "")} />
      <CalendarDays className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--forest)]/60" />
    </div>
  );
}

function Actions({
  onCancel, submitting, submitLabel, disabled,
}: { onCancel: () => void; submitting: boolean; submitLabel: string; disabled?: boolean }) {
  return (
    <div className="mt-6 flex justify-end gap-2 border-t border-[color:var(--forest)]/10 pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground hover:opacity-90 transition"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={submitting || disabled}
        className="inline-flex items-center gap-2 rounded-full bg-[color:var(--forest)] text-primary-foreground px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {submitting ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}

/* ---------- Utils ---------- */

const todayIso = () => new Date().toISOString().slice(0, 10);
const isoToLabel = (iso: string) => {
  // "2026-07-15" -> "Wed, 15 Jul"
  try { return format(parse(iso, "yyyy-MM-dd", new Date()), "EEE, d MMM"); }
  catch { return iso; }
};
const isoToShort = (iso: string) => {
  try { return format(parse(iso, "yyyy-MM-dd", new Date()), "d MMM"); }
  catch { return iso; }
};

/* ---------- Forms ---------- */

function RoomAddForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [initial, setInitial] = useState<number | "">("");
  const m = useAddRoom();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || m.isPending) return;
    m.mutate(
      { name: name.trim(), initial: Number(initial) || 0 },
      {
        onSuccess: () => { toast.success("Room added successfully"); onClose(); },
        onError: (err) => toast.error("Failed to add room", { description: (err as Error).message }),
      },
    );
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Room name" hint="Uppercase names are recommended, e.g. ROOM 5.">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
          placeholder="ROOM 5"
          autoFocus
          required
        />
      </Field>
      <Field label="Initial bird count">
        <NumberInput
          value={initial}
          onChange={(e) => setInitial(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="0"
        />
      </Field>
      <Actions onCancel={onClose} submitting={m.isPending} submitLabel="Save Room" disabled={!name.trim()} />
    </form>
  );
}

function EggForm({ item, onClose, rooms }: { item?: EggRow; onClose: () => void; rooms: Room[] }) {
  const isEdit = !!item;
  const [date, setDate] = useState(item?.date ?? todayIso());
  // r2/r3/r4 remain the schema columns. Distribute existing values on edit.
  const [r2, setR2] = useState<number | "">(item?.r2 ?? 0);
  const [r3, setR3] = useState<number | "">(item?.r3 ?? 0);
  const [r4, setR4] = useState<number | "">(item?.r4 ?? 0);
  const [extra, setExtra] = useState<number | "">(item?.extra ?? 0);
  const add = useAddEgg();
  const upd = useUpdateEgg();
  const pending = add.isPending || upd.isPending;

  const totalCrates = (Number(r2) || 0) + (Number(r3) || 0) + (Number(r4) || 0);
  const totalExtra = Number(extra) || 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const payload = {
      date,
      label: isoToLabel(date),
      r2: Number(r2) || 0,
      r3: Number(r3) || 0,
      r4: Number(r4) || 0,
      extra: Number(extra) || 0,
    };
    const done = {
      onSuccess: () => { toast.success(isEdit ? "Production record updated" : "Production record saved successfully"); onClose(); },
      onError: (err: unknown) => toast.error("Failed to save production", { description: (err as Error).message }),
    };
    if (isEdit && item) upd.mutate({ id: item.id, ...payload }, done);
    else add.mutate(payload, done);
  };

  // Dynamic room inputs — map current rooms; fall back to fixed slots when farm has none yet.
  const slots = useMemo(() => {
    const assigned: { name: string; getter: number | ""; setter: (v: number | "") => void; key: "r2" | "r3" | "r4" }[] = [];
    const state: [number | "", (v: number | "") => void, "r2" | "r3" | "r4"][] = [
      [r2, setR2, "r2"], [r3, setR3, "r3"], [r4, setR4, "r4"],
    ];
    const names = rooms.length ? rooms.slice(0, 3).map((r) => r.name) : ["ROOM 2", "ROOM 3", "ROOM 4"];
    names.forEach((n, i) => {
      const [g, s, k] = state[i];
      assigned.push({ name: n, getter: g, setter: s, key: k });
    });
    return assigned;
  }, [rooms, r2, r3, r4]);

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Production date">
        <DateInput value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>

      <div className="space-y-3">
        {slots.map((s) => (
          <div key={s.key} className="rounded-2xl border border-[color:var(--forest)]/10 bg-background/60 p-3">
            <div className="text-xs font-semibold text-[color:var(--forest)] mb-2">{s.name}</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Crates">
                <NumberInput
                  value={s.getter}
                  onChange={(e) => s.setter(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0"
                />
              </Field>
              {s.key === "r4" ? (
                <Field label="Extra eggs">
                  <NumberInput
                    value={extra}
                    onChange={(e) => setExtra(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0"
                  />
                </Field>
              ) : <div />}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-[color:var(--forest)]/8 border border-[color:var(--forest)]/15 px-4 py-3">
        <div className="text-[11px] uppercase tracking-wider text-[color:var(--forest)] font-semibold">Production Summary</div>
        <div className="mt-1 flex items-baseline justify-between gap-4">
          <div>
            <div className="font-display text-2xl font-semibold text-[color:var(--forest)]">{totalCrates}</div>
            <div className="text-[11px] text-muted-foreground">total crates</div>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-semibold text-[color:var(--forest)]">{totalExtra}</div>
            <div className="text-[11px] text-muted-foreground">extra eggs</div>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-semibold text-[color:var(--gold)]">{totalCrates * 30 + totalExtra}</div>
            <div className="text-[11px] text-muted-foreground">total eggs</div>
          </div>
        </div>
      </div>

      <Actions onCancel={onClose} submitting={pending} submitLabel={isEdit ? "Save Changes" : "Save Production"} />
    </form>
  );
}

function MortalityForm({ item, onClose, rooms }: { item?: Mortality; onClose: () => void; rooms: Room[] }) {
  const isEdit = !!item;
  const [room, setRoom] = useState(item?.room ?? (rooms[0]?.name ?? ""));
  const [cause, setCause] = useState(item?.cause ?? "Unknown");
  const [date, setDate] = useState(item?.date ?? todayIso());

  const [loss, setLoss] = useState<number | "">(item?.loss ?? 1);
  const add = useAddMortality();
  const upd = useUpdateMortality();
  const pending = add.isPending || upd.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !room || !loss) return;
    const dateStr = date; // ISO
    const payload = { room: room.toUpperCase(), cause: cause.trim() || "Unknown", date: dateStr, loss: Number(loss) };
    const done = {
      onSuccess: () => { toast.success(isEdit ? "Mortality record updated" : "Mortality recorded"); onClose(); },
      onError: (err: unknown) => toast.error("Failed to save mortality", { description: (err as Error).message }),
    };
    if (isEdit && item) upd.mutate({ id: item.id, ...payload }, done);
    else add.mutate(payload, done);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Room">
          {rooms.length > 0 ? (
            <SelectInput value={room} onChange={(e) => setRoom(e.target.value)} required>
              {!room && <option value="">Select room</option>}
              {rooms.map((r) => (<option key={r.id} value={r.name}>{r.name}</option>))}
              {isEdit && item && !rooms.find((r) => r.name === item.room) && <option value={item.room}>{item.room}</option>}
            </SelectInput>
          ) : (
            <TextInput value={room} onChange={(e) => setRoom(e.target.value.toUpperCase())} placeholder="ROOM 3" required />
          )}
        </Field>
        <Field label="Bird loss">
          <NumberInput
            min={1}
            value={loss}
            onChange={(e) => setLoss(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="1"
            required
          />
        </Field>
      </div>
      <Field label="Date">
        <DateInput value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <Field label="Suspected cause" hint="Optional description, e.g. heat stress, injury, unknown.">
        <TextInput value={cause} onChange={(e) => setCause(e.target.value)} placeholder="Unknown" />
      </Field>
      <Actions onCancel={onClose} submitting={pending} submitLabel={isEdit ? "Save Changes" : "Save Mortality"} disabled={!room || !loss} />
    </form>
  );
}

function HealthForm({ item, onClose, rooms }: { item?: Health; onClose: () => void; rooms: Room[] }) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? "");
  const [type, setType] = useState<HealthType>((item?.type as HealthType) ?? "Vitamin");
  const [scope, setScope] = useState(item?.scope ?? "All Rooms");
  const [date, setDate] = useState(todayIso());
  const add = useAddHealth();
  const upd = useUpdateHealth();
  const pending = add.isPending || upd.isPending;

  const scopeOptions = useMemo(() => ["All Rooms", ...rooms.map((r) => r.name)], [rooms]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !name.trim()) return;
    const normalized = normalizeHealthType(type) ?? "Observation";
    const payload = { name: name.trim().toUpperCase(), scope, type: normalized, date };
    const done = {
      onSuccess: () => { toast.success(isEdit ? "Health record updated" : "Health record saved"); onClose(); },
      onError: (err: unknown) => toast.error("Failed to save health record", { description: (err as Error).message }),
    };
    if (isEdit && item) upd.mutate({ id: item.id, ...payload }, done);
    else add.mutate(payload, done);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name" hint="Product, vaccine or observation title.">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="MIAVIT" autoFocus required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <SelectInput value={type} onChange={(e) => setType(e.target.value as HealthType)}>
            {HEALTH_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
          </SelectInput>
        </Field>
        <Field label="Scope">
          <SelectInput value={scope} onChange={(e) => setScope(e.target.value)}>
            {scopeOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
            {isEdit && item && !scopeOptions.includes(item.scope) && <option value={item.scope}>{item.scope}</option>}
          </SelectInput>
        </Field>
      </div>
      <Field label="Date">
        <DateInput value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <Actions onCancel={onClose} submitting={pending} submitLabel={isEdit ? "Save Changes" : "Save Health Record"} disabled={!name.trim()} />
    </form>
  );
}

function FeedForm({ item, onClose, rooms }: { item?: Feed; onClose: () => void; rooms: Room[] }) {
  const isEdit = !!item;
  const [room, setRoom] = useState(item?.room ?? (rooms[0]?.name ?? ""));
  const [bags, setBags] = useState<number | "">(item?.bags ?? 1);
  const [date, setDate] = useState(todayIso());
  const add = useAddFeed();
  const upd = useUpdateFeed();
  const pending = add.isPending || upd.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !room || !bags) return;
    const payload = { room: room.toUpperCase(), bags: Number(bags), date };
    const done = {
      onSuccess: () => { toast.success(isEdit ? "Feed record updated" : "Feed usage recorded"); onClose(); },
      onError: (err: unknown) => toast.error("Failed to save feed", { description: (err as Error).message }),
    };
    if (isEdit && item) upd.mutate({ id: item.id, ...payload }, done);
    else add.mutate(payload, done);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Room">
          {rooms.length > 0 ? (
            <SelectInput value={room} onChange={(e) => setRoom(e.target.value)} required>
              {!room && <option value="">Select room</option>}
              {rooms.map((r) => (<option key={r.id} value={r.name}>{r.name}</option>))}
              {isEdit && item && !rooms.find((r) => r.name === item.room) && <option value={item.room}>{item.room}</option>}
            </SelectInput>
          ) : (
            <TextInput value={room} onChange={(e) => setRoom(e.target.value.toUpperCase())} placeholder="ROOM 3" required />
          )}
        </Field>
        <Field label="Bags">
          <NumberInput
            min={1}
            step="any"
            value={bags}
            onChange={(e) => setBags(e.target.value === "" ? "" : Number(e.target.value))}
            required
          />
        </Field>
      </div>
      <Field label="Date">
        <DateInput value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <Actions onCancel={onClose} submitting={pending} submitLabel={isEdit ? "Save Changes" : "Save Feed"} disabled={!room || !bags} />
    </form>
  );
}

function FeedDayEditForm({ items, onClose }: { items: Feed[]; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, number | "">>(
    () => Object.fromEntries(items.map((f) => [f.id, f.bags])),
  );
  const upd = useUpdateFeed();
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    let updated = 0;
    let failed = 0;
    for (const f of items) {
      const next = Number(values[f.id]);
      if (!Number.isFinite(next) || next === f.bags) continue;
      try {
        await upd.mutateAsync({ id: f.id, bags: next });
        updated++;
      } catch (err) {
        failed++;
        toast.error(`Failed to update ${f.room}`, { description: (err as Error).message });
      }
    }
    setSubmitting(false);
    if (updated > 0) toast.success(`${updated} feed record${updated === 1 ? "" : "s"} updated`);
    if (failed === 0) onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        {items.map((f) => (
          <div key={f.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-[color:var(--forest)]/10 bg-background/60 px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">{f.room}</div>
              <div className="text-[11px] text-muted-foreground">{f.date}</div>
            </div>
            <NumberInput
              min={0}
              step="any"
              className="w-24 text-right"
              value={values[f.id]}
              onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
          </div>
        ))}
      </div>
      <Actions onCancel={onClose} submitting={submitting} submitLabel="Save Changes" />
    </form>
  );
}

function PriceAddForm({ onClose }: { onClose: () => void }) {
  const [item, setItem] = useState("");
  const [unit, setUnit] = useState("1");
  const [price, setPrice] = useState<number | "">("");
  const m = useAddPrice();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (m.isPending || !item.trim()) return;
    const updated = format(new Date(), "d MMM yyyy");
    m.mutate(
      { item: item.trim(), unit: unit.trim() || "1", price: Number(price) || 0, updated },
      {
        onSuccess: () => { toast.success("Price item added"); onClose(); },
        onError: (err) => toast.error("Failed to save price", { description: (err as Error).message }),
      },
    );
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Item">
        <TextInput value={item} onChange={(e) => setItem(e.target.value)} placeholder="Egg" autoFocus required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit" hint="e.g. crate, bag, kg.">
          <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="crate" />
        </Field>
        <Field label="Price (₦)">
          <NumberInput
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="0"
            required
          />
        </Field>
      </div>
      <Actions onCancel={onClose} submitting={m.isPending} submitLabel="Save Price" disabled={!item.trim()} />
    </form>
  );
}

function PriceEditForm({ item, onClose }: { item: Price; onClose: () => void }) {
  const [name, setName] = useState(item.item);
  const [unit, setUnit] = useState(item.unit);
  const [price, setPrice] = useState<number | "">(item.price);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const m = useUpdatePrice();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (m.isPending || !name.trim()) return;
    setErrorMsg(null);
    const updated = format(new Date(), "d MMM yyyy");
    m.mutate(
      { id: item.id, item: name.trim(), unit: unit.trim() || "1", price: Number(price) || 0, updated },
      {
        onSuccess: () => { toast.success("Price updated"); onClose(); },
        onError: (err) => {
          const msg = (err as Error).message || "Could not update price. Please try again.";
          setErrorMsg(msg);
          toast.error("Failed to update price", { description: msg });
        },
      },
    );
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Item">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit" hint="e.g. crate, bag, kg.">
          <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
        <Field label="Price (₦)">
          <NumberInput
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
            required
          />
        </Field>
      </div>
      {errorMsg && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm px-3 py-2">
          {errorMsg}
        </div>
      )}
      <Actions onCancel={onClose} submitting={m.isPending} submitLabel="Save Changes" disabled={!name.trim()} />
    </form>
  );
}

/* ---------- Confirm dialog (delete) ---------- */

export function RecordConfirmDialog({
  state, onClose,
}: {
  state: { title: string; message: string; confirmLabel?: string; onConfirm: () => void | Promise<void> } | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!state) setBusy(false); }, [state]);
  if (!state) return null;
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try { await state.onConfirm(); onClose(); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={busy ? () => {} : onClose} title={state.title}>
      <p className="text-sm text-muted-foreground">{state.message}</p>
      <div className="mt-6 flex justify-end gap-2 border-t border-[color:var(--forest)]/10 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-full px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground hover:opacity-90 transition disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-destructive text-destructive-foreground px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {state.confirmLabel ?? "Delete Record"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Root dispatcher ---------- */

export function RecordDialogs({
  state, onClose, rooms,
}: {
  state: RecordDialogState | null; onClose: () => void; rooms: Room[];
}) {
  if (!state) return null;
  const common = { open: true, onClose };
  switch (state.kind) {
    case "room-add":
      return <Modal {...common} title="Add Room" subtitle="Create a new laying room for your farm."><RoomAddForm onClose={onClose} /></Modal>;
    case "egg-add":
      return <Modal {...common} title="Record Production" subtitle="Add today's egg production for your farm."><EggForm onClose={onClose} rooms={rooms} /></Modal>;
    case "egg-edit":
      return <Modal {...common} title="Edit Production" subtitle="Update this production record."><EggForm onClose={onClose} rooms={rooms} item={state.item} /></Modal>;
    case "mortality-add":
      return <Modal {...common} title="Add Mortality" subtitle="Record bird losses to keep your flock health accurate."><MortalityForm onClose={onClose} rooms={rooms} /></Modal>;
    case "mortality-edit":
      return <Modal {...common} title="Edit Mortality" subtitle="Update this mortality record."><MortalityForm onClose={onClose} rooms={rooms} item={state.item} /></Modal>;
    case "health-add":
      return <Modal {...common} title="Add Health Record" subtitle="Log a vaccination, vitamin, medication or observation."><HealthForm onClose={onClose} rooms={rooms} /></Modal>;
    case "health-edit":
      return <Modal {...common} title="Edit Health Record" subtitle="Update this health record."><HealthForm onClose={onClose} rooms={rooms} item={state.item} /></Modal>;
    case "feed-add":
      return <Modal {...common} title="Record Feed" subtitle="Log feed usage for a room."><FeedForm onClose={onClose} rooms={rooms} /></Modal>;
    case "feed-edit":
      return <Modal {...common} title="Edit Feed Record" subtitle="Update this feed record."><FeedForm onClose={onClose} rooms={rooms} item={state.item} /></Modal>;
    case "feed-day-edit":
      return <Modal {...common} title="Edit Feed Day" subtitle={`Update bag counts for ${state.items[0]?.date ?? "this day"}.`}><FeedDayEditForm items={state.items} onClose={onClose} /></Modal>;
    case "price-add":
      return <Modal {...common} title="Add Price Item" subtitle="Track a new item on your price list."><PriceAddForm onClose={onClose} /></Modal>;
    case "price-edit":
      return <Modal {...common} title="Edit Price Item" subtitle={`Update ${state.item.item} on your price list.`}><PriceEditForm item={state.item} onClose={onClose} /></Modal>;
  }
}
