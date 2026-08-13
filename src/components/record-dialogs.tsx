import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { X, Loader2, CalendarDays } from "lucide-react";
import { format, parse } from "date-fns";
import {
  useAddRoom, useUpdateRoom,
  useAddEgg, useUpdateEgg,
  useAddMortality, useUpdateMortality,
  useAddHealth, useUpdateHealth,
  useAddFeed, useUpdateFeed,
  useAddPrice, useUpdatePrice,
  useFarm,
  HEALTH_TYPES, normalizeHealthType,
  type Room, type EggRow, type Mortality, type Health, type HealthType, type Feed, type Price,
} from "@/lib/farm-data";
import { toDateKey } from "@/lib/date-key";
import { FeedRecordingModal } from "@/components/daily-recording/FeedRecordingModal";
import { eggSlots, productionRooms, ROOM_STATUSES, ROOM_STATUS_LABELS, roomStatus, type RoomStatus } from "@/lib/rooms";
import { useSaveRevenue } from "@/lib/finance-data";
import { logSecurityEvent } from "@/lib/security-events";

export type RecordDialogState =
  | { kind: "room-add" }
  | { kind: "room-edit"; item: Room }
  | { kind: "room-cull"; item: Room }
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

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
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
  const [birdType, setBirdType] = useState("Layers");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [batch, setBatch] = useState("");
  const [stocked, setStocked] = useState(todayIso());
  const m = useAddRoom();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || m.isPending) return;
    m.mutate(
      {
        name: name.trim(),
        initial: Number(initial) || 0,
        bird_type: birdType.trim() || null,
        breed: breed.trim() || null,
        age_weeks: age === "" ? null : Number(age),
        batch_number: batch.trim() || null,
        date_stocked: stocked || null,
      },
      {
        onSuccess: () => {
          toast.success("Room added", { description: `${name.trim().toUpperCase()} is now active.` });
          void logSecurityEvent("room_created", {
            detail: `${name.trim().toUpperCase()} stocked with ${Number(initial) || 0} birds`,
            metadata: { room: name.trim().toUpperCase(), birds: Number(initial) || 0, breed, batch },
          });
          onClose();
        },
        onError: (err) => toast.error("Failed to add room", { description: (err as Error).message }),
      },
    );
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Room name" hint="Room numbers are permanent — existing rooms are never renumbered.">
        <TextInput value={name} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="ROOM 5" autoFocus required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bird type">
          <SelectInput value={birdType} onChange={(e) => setBirdType(e.target.value)}>
            {["Layers", "Broilers", "Pullets", "Cockerels", "Noiler", "Turkey", "Other"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Number of birds">
          <NumberInput value={initial} onChange={(e) => setInitial(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date stocked">
          <DateInput value={stocked} onChange={(e) => setStocked(e.target.value)} />
        </Field>
        <Field label="Breed">
          <TextInput value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="ISA Brown" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Age (weeks)">
          <NumberInput value={age} onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))} placeholder="18" />
        </Field>
        <Field label="Batch number" hint="Optional.">
          <TextInput value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="B-2026-05" />
        </Field>
      </div>
      <Actions onCancel={onClose} submitting={m.isPending} submitLabel="Save Room" disabled={!name.trim()} />
    </form>
  );
}

function RoomEditForm({ item, onClose }: { item: Room; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [status, setStatus] = useState<RoomStatus>(roomStatus(item));
  const [current, setCurrent] = useState<number | "">(item.current);
  const [birdType, setBirdType] = useState(item.bird_type ?? "");
  const [breed, setBreed] = useState(item.breed ?? "");
  const [age, setAge] = useState<number | "">(item.age_weeks ?? "");
  const [batch, setBatch] = useState(item.batch_number ?? "");
  const [stocked, setStocked] = useState(item.date_stocked ?? "");
  const m = useUpdateRoom();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || m.isPending) return;
    m.mutate(
      {
        id: item.id,
        name: name.trim().toUpperCase(),
        status,
        current: Number(current) || 0,
        bird_type: birdType.trim() || null,
        breed: breed.trim() || null,
        age_weeks: age === "" ? null : Number(age),
        batch_number: batch.trim() || null,
        date_stocked: stocked || null,
      },
      {
        onSuccess: () => { toast.success("Room updated"); onClose(); },
        onError: (err) => toast.error("Failed to update room", { description: (err as Error).message }),
      },
    );
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Room name" hint="Keep the original number — history stays linked to it.">
          <TextInput value={name} onChange={(e) => setName(e.target.value.toUpperCase())} required />
        </Field>
        <Field label="Status">
          <SelectInput value={status} onChange={(e) => setStatus(e.target.value as RoomStatus)}>
            {ROOM_STATUSES.map((s) => (<option key={s} value={s}>{ROOM_STATUS_LABELS[s]}</option>))}
          </SelectInput>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Current birds">
          <NumberInput value={current} onChange={(e) => setCurrent(e.target.value === "" ? "" : Number(e.target.value))} />
        </Field>
        <Field label="Bird type">
          <TextInput value={birdType} onChange={(e) => setBirdType(e.target.value)} placeholder="Layers" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Breed">
          <TextInput value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="ISA Brown" />
        </Field>
        <Field label="Age (weeks)">
          <NumberInput value={age} onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Batch number">
          <TextInput value={batch} onChange={(e) => setBatch(e.target.value)} />
        </Field>
        <Field label="Date stocked">
          <DateInput value={stocked} onChange={(e) => setStocked(e.target.value)} />
        </Field>
      </div>
      <Actions onCancel={onClose} submitting={m.isPending} submitLabel="Save Changes" disabled={!name.trim()} />
    </form>
  );
}

function RoomCullForm({ item, onClose }: { item: Room; onClose: () => void }) {
  const [date, setDate] = useState(todayIso());
  const [birds, setBirds] = useState<number | "">(item.current || "");
  const [unitPrice, setUnitPrice] = useState<number | "">("");
  const [total, setTotal] = useState<number | "">("");
  const [touchedTotal, setTouchedTotal] = useState(false);
  const [notes, setNotes] = useState("");
  const update = useUpdateRoom();
  const revenue = useSaveRevenue();
  const pending = update.isPending || revenue.isPending;

  const computed = (Number(birds) || 0) * (Number(unitPrice) || 0);
  const totalValue = touchedTotal ? Number(total) || 0 : computed;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !birds) return;
    try {
      await update.mutateAsync({
        id: item.id,
        status: "culled",
        current: 0,
        culled_on: date,
        culled_birds_sold: Number(birds) || 0,
        culled_unit_price: Number(unitPrice) || 0,
        culled_revenue: totalValue,
        culled_notes: notes.trim() || null,
      });
      if (totalValue > 0) {
        await revenue.mutateAsync({
          values: {
            entry_date: date,
            category: "birds",
            item: "Spent Layers",
            quantity: Number(birds) || 0,
            unit: "bird",
            unit_price: (Number(birds) || 0) > 0 ? totalValue / (Number(birds) || 1) : 0,
            amount: totalValue,
            customer: null,
            payment_method: "cash",
            notes: `Culling of ${item.name}${notes.trim() ? ` — ${notes.trim()}` : ""}`,
          },
        });
      }
      void logSecurityEvent("room_culled", {
        detail: `${item.name} culled — ${Number(birds) || 0} birds sold for ₦${totalValue.toLocaleString()}`,
        metadata: { room: item.name, room_id: item.id, date, birds: Number(birds) || 0, revenue: totalValue },
      });
      toast.success(`${item.name} marked as culled`, {
        description: "Birds set to zero, revenue recorded under Spent Layers. History is preserved.",
      });
      onClose();
    } catch (err) {
      toast.error("Failed to mark room as culled", { description: (err as Error).message });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-2xl border border-[color:var(--forest)]/10 bg-background/60 px-4 py-3 text-xs text-muted-foreground">
        {item.name} will stop accepting new production, feed and medication records. All existing
        history stays available in reports and analytics.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of culling">
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Birds sold">
          <NumberInput value={birds} onChange={(e) => setBirds(e.target.value === "" ? "" : Number(e.target.value))} required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Average selling price (₦)">
          <NumberInput value={unitPrice} onChange={(e) => setUnitPrice(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" />
        </Field>
        <Field label="Total revenue (₦)" hint="Auto-calculated — override if needed.">
          <NumberInput
            value={touchedTotal ? total : (computed || "")}
            onChange={(e) => { setTouchedTotal(true); setTotal(e.target.value === "" ? "" : Number(e.target.value)); }}
            placeholder="0"
          />
        </Field>
      </div>
      <Field label="Notes" hint="Optional — buyer, transport, condition of birds.">
        <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sold to Kano market buyer" />
      </Field>
      <div className="rounded-2xl bg-[color:var(--forest)]/8 border border-[color:var(--forest)]/15 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Recorded revenue: </span>
        <span className="font-semibold text-[color:var(--forest)]">₦{totalValue.toLocaleString()}</span>
        <span className="text-muted-foreground"> under Bird Sales · Spent Layers</span>
      </div>
      <Actions onCancel={onClose} submitting={pending} submitLabel="Mark as Culled" disabled={!birds} />
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
  // Combine legacy broken_r and broken_extra_r into one "Broken eggs" field per room.
  const [b2, setB2] = useState<number | "">((item?.broken_r2 ?? 0) + (item?.broken_extra_r2 ?? 0));
  const [b3, setB3] = useState<number | "">((item?.broken_r3 ?? 0) + (item?.broken_extra_r3 ?? 0));
  const [b4, setB4] = useState<number | "">((item?.broken_r4 ?? 0) + (item?.broken_extra_r4 ?? 0));
  // Per-room loose (extra) eggs.
  const [e2, setE2] = useState<number | "">(item?.extra_r2 ?? 0);
  const [e3, setE3] = useState<number | "">(item?.extra_r3 ?? 0);
  const [e4, setE4] = useState<number | "">(item?.extra_r4 ?? 0);
  const add = useAddEgg();
  const upd = useUpdateEgg();
  const pending = add.isPending || upd.isPending;

  const n = (v: number | "") => Number(v) || 0;

  // Legacy farm-level loose eggs that were never attributed to a room.
  // Preserved as-is on edit; never reassigned to a room.
  const legacyExtra = isEdit
    ? Math.max(0, (item?.extra ?? 0) - (n(item?.extra_r2 ?? 0) + n(item?.extra_r3 ?? 0) + n(item?.extra_r4 ?? 0)))
    : 0;
  const legacyBrokenExtra = isEdit
    ? Math.max(0, (item?.broken_extra ?? 0) - (n(item?.broken_extra_r2 ?? 0) + n(item?.broken_extra_r3 ?? 0) + n(item?.broken_extra_r4 ?? 0)))
    : 0;

  // Egg production columns r2/r3/r4 belong to ROOM 2/3/4. Map by room number,
  // never by list position, and skip rooms that are no longer in production.
  const slots = useMemo(() => {
    const crate: Record<"r2" | "r3" | "r4", [number | "", (v: number | "") => void]> = {
      r2: [r2, setR2], r3: [r3, setR3], r4: [r4, setR4],
    };
    const broke: Record<"r2" | "r3" | "r4", [number | "", (v: number | "") => void]> = {
      r2: [b2, setB2], r3: [b3, setB3], r4: [b4, setB4],
    };
    const loose: Record<"r2" | "r3" | "r4", [number | "", (v: number | "") => void]> = {
      r2: [e2, setE2], r3: [e3, setE3], r4: [e4, setE4],
    };
    const build = (name: string, k: "r2" | "r3" | "r4") => ({
      name, key: k,
      getter: crate[k][0], setter: crate[k][1],
      broken: broke[k][0], setBroken: broke[k][1],
      extra: loose[k][0], setExtra: loose[k][1],
    });
    const mapped = eggSlots(rooms).map((s) => build(s.room.name, s.key));
    if (mapped.length) return mapped;
    return (["r2", "r3", "r4"] as const).map((k, i) => build(["ROOM 2", "ROOM 3", "ROOM 4"][i], k));
  }, [rooms, r2, r3, r4, b2, b3, b4, e2, e3, e4]);

  const perRoom = slots.map((s) => {
    const crates = n(s.getter);
    const broken = n(s.broken);
    const extra = n(s.extra);
    const collected = crates * 30 + extra;
    return {
      key: s.key,
      name: s.name,
      crates,
      extra,
      collected,
      broken,
      usable: Math.max(0, collected - broken),
    };
  });

  const roomCrates = perRoom.reduce((a, r) => a + r.crates, 0);
  const rawExtra = perRoom.reduce((a, r) => a + r.extra, 0) + legacyExtra;
  const collected = roomCrates * 30 + rawExtra;
  const broken = perRoom.reduce((a, r) => a + r.broken, 0) + legacyBrokenExtra;
  const good = Math.max(0, collected - broken);
  const totalCrates = Math.floor(good / 30);
  const remainderExtra = good % 30;
  const breakagePct = collected > 0 ? (broken / collected) * 100 : 0;
  const overBroken = perRoom.some((r) => r.broken > r.collected) || broken > collected;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || overBroken) return;
    // Store the combined per-room broken value in the legacy broken_r columns and
    // clear the broken_extra_r columns so analytics always see the total.
    const payload = {
      date,
      label: isoToLabel(date),
      r2: n(r2), r3: n(r3), r4: n(r4),
      // `extra` / `broken_extra` remain the farm-level totals used by analytics.
      extra: n(e2) + n(e3) + n(e4) + legacyExtra,
      broken_r2: n(b2), broken_r3: n(b3), broken_r4: n(b4),
      broken_extra: legacyBrokenExtra,
      extra_r2: n(e2), extra_r3: n(e3), extra_r4: n(e4),
      broken_extra_r2: 0, broken_extra_r3: 0, broken_extra_r4: 0,
    };
    const done = {
      onSuccess: () => { toast.success(isEdit ? "Production record updated" : "Production record saved successfully"); onClose(); },
      onError: (err: unknown) => toast.error("Failed to save production", { description: (err as Error).message }),
    };
    if (isEdit && item) upd.mutate({ id: item.id, ...payload }, done);
    else add.mutate(payload, done);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Production date">
        <DateInput value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>

      <div className="space-y-3">
        {slots.map((s, i) => {
          const room = perRoom[i];
          return (
            <div key={s.key} className="rounded-2xl border border-[color:var(--forest)]/10 bg-background/60 p-3">
              <div className="text-xs font-semibold text-[color:var(--forest)] mb-2">{s.name}</div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Crates">
                  <NumberInput
                    value={s.getter}
                    onChange={(e) => s.setter(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0"
                  />
                </Field>
                <Field label="Extra eggs">
                  <NumberInput
                    value={s.extra}
                    onChange={(e) => s.setExtra(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0"
                  />
                </Field>
                <Field label="Broken eggs">
                  <NumberInput
                    value={s.broken}
                    onChange={(e) => s.setBroken(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0"
                  />
                </Field>
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                Net usable: {room.usable} eggs
                {room.collected > 0 && room.broken > 0 && ` · ${((room.broken / room.collected) * 100).toFixed(1)}% breakage`}
                {room.broken > room.collected && (
                  <span className="ml-1 font-medium text-destructive">Broken exceeds collected</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {legacyExtra + legacyBrokenExtra > 0 && (
        <div className="rounded-2xl border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 px-4 py-3 text-[11.5px] text-[color:var(--forest)]">
          This record has {legacyExtra} historical farm-level loose egg{legacyExtra === 1 ? "" : "s"}
          {legacyBrokenExtra > 0 && ` (${legacyBrokenExtra} broken)`} that were not attributed to a room. They are
          preserved in the totals below.
        </div>
      )}

      <div className="rounded-2xl bg-[color:var(--forest)]/8 border border-[color:var(--forest)]/15 px-4 py-3">
        <div className="text-[11px] uppercase tracking-wider text-[color:var(--forest)] font-semibold">Production Summary</div>

        <div className="mt-2 space-y-1.5">
          {perRoom.map((r) => (
            <div key={r.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-[12px]">
              <span className="font-medium text-[color:var(--forest)]">{r.name}</span>
              <span className="text-muted-foreground">
                Crates: <span className="font-medium text-foreground">{r.crates}</span> · Extra:{" "}
                <span className="font-medium text-foreground">{r.extra}</span> eggs · Usable:{" "}
                <span className="font-medium text-foreground">{r.usable}</span> eggs
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t border-[color:var(--forest)]/15 pt-3">
          <div className="text-[11px] uppercase tracking-wider text-[color:var(--forest)] font-semibold mb-2">Farm Total</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="font-display text-2xl font-semibold text-[color:var(--forest)]">{totalCrates}</div>
              <div className="text-[11px] text-muted-foreground">total crates</div>
            </div>
            <div>
              <div className="font-display text-2xl font-semibold text-[color:var(--forest)]">{remainderExtra}</div>
              <div className="text-[11px] text-muted-foreground">remaining loose</div>
            </div>
            <div>
              <div className="font-display text-2xl font-semibold text-[color:var(--gold)]">{good}</div>
              <div className="text-[11px] text-muted-foreground">total usable eggs</div>
            </div>
          </div>
          <div className="mt-2 text-[11.5px] text-muted-foreground">
            Collected {collected} · Extra eggs {rawExtra} · Broken {broken} · Breakage {breakagePct.toFixed(1)}%
          </div>
        </div>

        {overBroken && (
          <div className="mt-2 text-[11.5px] font-medium text-destructive">
            Broken eggs cannot be more than the eggs collected.
          </div>
        )}
      </div>

      <Actions onCancel={onClose} submitting={pending} submitLabel={isEdit ? "Save Changes" : "Save Production"} disabled={overBroken} />
    </form>
  );
}





function MortalityForm({ item, onClose, rooms }: { item?: Mortality; onClose: () => void; rooms: Room[] }) {
  const isEdit = !!item;
  const [room, setRoom] = useState(item?.room ?? (rooms[0]?.name ?? ""));
  const [cause, setCause] = useState(item?.cause ?? "Unknown");
  // Normalise any stored value (ISO, legacy "6 aPR", etc.) to a YYYY-MM-DD
  // key so the <input type="date"> pre-fills correctly on edit.
  const [date, setDate] = useState(toDateKey(item?.date) ?? item?.date ?? todayIso());

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

function HealthForm({ item, onClose, rooms: allRooms }: { item?: Health; onClose: () => void; rooms: Room[] }) {
  const rooms = useMemo(() => productionRooms(allRooms), [allRooms]);
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

function FeedForm({ item, onClose, rooms: allRooms }: { item?: Feed; onClose: () => void; rooms: Room[] }) {
  const rooms = useMemo(() => productionRooms(allRooms), [allRooms]);
  const isEdit = !!item;
  const farmQ = useFarm();
  const bagWeightKg = farmQ.data?.bag_weight_kg ?? 25;
  const [room, setRoom] = useState(item?.room ?? (rooms[0]?.name ?? ""));
  // Feed is captured in kg — bag counts are derived from the farm's bag weight.
  const initialKg = item ? Math.round(item.bags * bagWeightKg * 100) / 100 : "";
  const [kg, setKg] = useState<number | "">(initialKg);
  const [date, setDate] = useState(todayIso());
  const add = useAddFeed();
  const upd = useUpdateFeed();
  const pending = add.isPending || upd.isPending;

  const kgNum = Number(kg);
  const bagsPreview = Number.isFinite(kgNum) && kgNum > 0 ? kgNum / bagWeightKg : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !room || kg === "" || !Number.isFinite(kgNum) || kgNum <= 0) return;
    const bags = kgNum / bagWeightKg;
    const payload = { room: room.toUpperCase(), bags, date };
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
        <Field label="Feed issued (kg)">
          <NumberInput
            min={0}
            step="any"
            value={kg}
            onChange={(e) => setKg(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="e.g. 162.5"
            required
          />
        </Field>
      </div>
      <div className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
        Auto-calculated: <span className="font-semibold text-foreground tabular-nums">{bagsPreview ? (Math.round(bagsPreview * 100) / 100) : 0} bags</span>
        <span className="ml-2 opacity-70">(1 bag = {bagWeightKg} kg)</span>
      </div>
      <Field label="Date">
        <DateInput value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <Actions onCancel={onClose} submitting={pending} submitLabel={isEdit ? "Save Changes" : "Save Feed"} disabled={!room || !kg || kgNum <= 0} />
    </form>
  );
}

function FeedDayEditForm({ items, onClose }: { items: Feed[]; onClose: () => void }) {
  const farmQ = useFarm();
  const bagWeightKg = farmQ.data?.bag_weight_kg ?? 25;
  const bagsToKg = (b: number) => Math.round(b * bagWeightKg * 100) / 100;
  const [values, setValues] = useState<Record<string, number | "">>(
    () => Object.fromEntries(items.map((f) => [f.id, bagsToKg(f.bags)])),
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
      const nextKg = Number(values[f.id]);
      if (!Number.isFinite(nextKg) || nextKg < 0) continue;
      const nextBags = nextKg / bagWeightKg;
      if (Math.abs(nextBags - f.bags) < 1e-6) continue;
      try {
        await upd.mutateAsync({ id: f.id, bags: nextBags });
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
      <p className="text-[11px] text-muted-foreground">Enter kilograms — bags update automatically (1 bag = {bagWeightKg} kg).</p>
      <div className="space-y-2">
        {items.map((f) => {
          const kgVal = values[f.id];
          const kgNum = Number(kgVal);
          const bagsPreview = Number.isFinite(kgNum) && kgNum > 0 ? Math.round((kgNum / bagWeightKg) * 100) / 100 : 0;
          return (
            <div key={f.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-[color:var(--forest)]/10 bg-background/60 px-3 py-2.5">
              <div>
                <div className="text-sm font-medium">{f.room}</div>
                <div className="text-[11px] text-muted-foreground">{f.date} · {bagsPreview} bags</div>
              </div>
              <div className="flex items-center gap-1">
                <NumberInput
                  min={0}
                  step="any"
                  className="w-24 text-right"
                  value={kgVal}
                  onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value === "" ? "" : Number(e.target.value) }))}
                />
                <span className="text-[11px] text-muted-foreground">kg</span>
              </div>
            </div>
          );
        })}
      </div>
      <Actions onCancel={onClose} submitting={submitting} submitLabel="Save Changes" />
    </form>
  );
}

/* ---------- Price forms ----------
 * Prices are captured with an explicit measurement unit so financial
 * calculations across the platform stay consistent:
 *   • Eggs are priced per Crate (30 eggs).
 *   • Feed is priced per bag on the farm's configured bag weight
 *     (25 / 40 / 50 kg or custom). Cost per kg is derived as
 *     bagPrice / bagWeightKg and shown live in the form.
 *   • Everything else is a free-text unit (kg, litre, pack, …).
 * All feed cost math uses cost-per-kg × feed-used-kg, so switching
 * bag weight in Farm Settings automatically re-prices every future
 * calculation without touching historical records.
 */
type PriceCategory = "egg" | "feed" | "other";

function detectCategory(name: string): PriceCategory {
  if (/egg/i.test(name)) return "egg";
  if (/feed|mash|grower|layer|starter|concentrate/i.test(name)) return "feed";
  return "other";
}

const FEED_BAG_PRESETS = [25, 40, 50] as const;

function PriceForm({
  mode, initial, onClose,
}: {
  mode: "add" | "edit";
  initial?: Price;
  onClose: () => void;
}) {
  const farmQ = useFarm();
  const farmBagKg = farmQ.data?.bag_weight_kg ?? 25;
  const add = useAddPrice();
  const upd = useUpdatePrice();
  const pending = add.isPending || upd.isPending;

  const initialCategory = initial ? detectCategory(initial.item) : "egg";
  const initialBagKg = (() => {
    if (!initial) return farmBagKg;
    const m = /(\d+(?:\.\d+)?)\s*kg/i.exec(initial.unit || "");
    return m ? Number(m[1]) : farmBagKg;
  })();

  const [name, setName] = useState(initial?.item ?? "");
  const [category, setCategory] = useState<PriceCategory>(initialCategory);
  const [bagKg, setBagKg] = useState<number>(initialBagKg);
  const [customUnit, setCustomUnit] = useState(
    initial && detectCategory(initial.item) === "other" ? initial.unit : "",
  );
  const [price, setPrice] = useState<number | "">(initial?.price ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Keep category in sync as the user types a name (add mode only).
  useEffect(() => {
    if (mode === "add") setCategory(detectCategory(name));
  }, [name, mode]);

  const resolvedUnit =
    category === "egg" ? "Crate" :
    category === "feed" ? `${bagKg} kg Bag` :
    (customUnit.trim() || "unit");

  const costPerKg =
    category === "feed" && Number(price) > 0 && bagKg > 0
      ? Number(price) / bagKg
      : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !name.trim()) return;
    setErrorMsg(null);
    const payload = {
      item: name.trim(),
      unit: resolvedUnit,
      price: Number(price) || 0,
      updated: format(new Date(), "d MMM yyyy"),
    };
    const done = {
      onSuccess: () => { toast.success(mode === "add" ? "Price item added" : "Price updated"); onClose(); },
      onError: (err: unknown) => {
        const msg = (err as Error).message || "Could not save price. Please try again.";
        setErrorMsg(msg);
        toast.error("Failed to save price", { description: msg });
      },
    };
    if (mode === "add") add.mutate(payload, done);
    else if (initial) upd.mutate({ id: initial.id, ...payload }, done);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Item">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Table Eggs, Feed, Vitamins…"
          autoFocus
          required
        />
      </Field>

      <Field label="Category" hint="Determines how the unit and cost are measured.">
        <SelectInput value={category} onChange={(e) => setCategory(e.target.value as PriceCategory)}>
          <option value="egg">Eggs — priced per Crate</option>
          <option value="feed">Feed — priced per Bag</option>
          <option value="other">Other — custom unit</option>
        </SelectInput>
      </Field>

      {category === "feed" && (
        <Field label="Bag weight" hint="Choose the bag size this price is quoted for.">
          <div className="grid grid-cols-4 gap-2">
            {FEED_BAG_PRESETS.map(w => (
              <button
                key={w}
                type="button"
                onClick={() => setBagKg(w)}
                className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
                  bagKg === w
                    ? "border-[color:var(--forest)] bg-[color:var(--forest)]/10 text-[color:var(--forest)]"
                    : "border-border hover:border-[color:var(--forest)]/40"
                }`}
              >{w} kg</button>
            ))}
            <NumberInput
              step="any"
              min={1}
              value={FEED_BAG_PRESETS.includes(bagKg as 25 | 40 | 50) ? "" : bagKg}
              onChange={(e) => setBagKg(Number(e.target.value) || 0)}
              placeholder="Custom"
              className="rounded-lg border border-border px-2 py-2 text-sm"
            />
          </div>
        </Field>
      )}

      {category === "other" && (
        <Field label="Unit" hint="e.g. kg, litre, pack, sachet.">
          <TextInput
            value={customUnit}
            onChange={(e) => setCustomUnit(e.target.value)}
            placeholder="kg"
          />
        </Field>
      )}

      <Field label={`Price (₦ per ${resolvedUnit})`}>
        <NumberInput
          step="any"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="0"
          required
        />
      </Field>

      {category === "feed" && costPerKg !== null && (
        <div className="rounded-xl border border-[color:var(--forest)]/30 bg-[color:var(--forest)]/5 px-3 py-2 text-sm">
          <div className="font-medium text-[color:var(--forest)]">
            Cost per kg: ₦{costPerKg.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            ₦{Number(price).toLocaleString()} ÷ {bagKg} kg — used for all feed cost calculations.
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm px-3 py-2">
          {errorMsg}
        </div>
      )}

      <Actions
        onCancel={onClose}
        submitting={pending}
        submitLabel={mode === "add" ? "Save Price" : "Save Changes"}
        disabled={!name.trim()}
      />
    </form>
  );
}

function PriceAddForm({ onClose }: { onClose: () => void }) {
  return <PriceForm mode="add" onClose={onClose} />;
}

function PriceEditForm({ item, onClose }: { item: Price; onClose: () => void }) {
  return <PriceForm mode="edit" initial={item} onClose={onClose} />;
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
    case "room-edit":
      return <Modal {...common} title={`Edit ${state.item.name}`} subtitle="Update room details and lifecycle status."><RoomEditForm item={state.item} onClose={onClose} /></Modal>;
    case "room-cull":
      return <Modal {...common} title={`Mark ${state.item.name} as Culled`} subtitle="Close out this flock and record the sale."><RoomCullForm item={state.item} onClose={onClose} /></Modal>;
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
      return <FeedRecordingModal open onClose={onClose} />;
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
