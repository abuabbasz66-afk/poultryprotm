import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { CalendarDays, ChevronDown, Copy, Eraser, Loader2, X } from "lucide-react";
import type { Room } from "@/lib/farm-data";

/* =============================================================
   Schema-driven daily recording modal.

   Every daily-operations recording screen (Feed, Mortality, Health,
   Medication, Vaccination, Sales, Expenses, Water, Environmental, …)
   renders a card per room from useRooms(), a live summary panel and
   a single Save/Update action. Behaviour (edit mode, copy-yesterday,
   draft autosave, keyboard nav) is shared here so every module feels
   the same.
   ============================================================= */

export type FieldDef = {
  key: string;
  label: string;
  type?: "number" | "text";
  placeholder?: string;
  step?: string;
  min?: number;
  suffix?: string;
};

export type RoomValue = Record<string, number | string>;

export type SummaryTile = {
  label: string;
  value: string | number;
  accent?: boolean;
  hint?: string;
};

export type ModuleSchema<TValue extends RoomValue = RoomValue> = {
  moduleId: string;
  title: string;
  subtitle?: string;
  fields: FieldDef[];
  emptyValue: TValue;
  /** Keys that Copy-Yesterday will prefill by default. Omit for none. */
  copyableKeys?: (keyof TValue & string)[];
  isEmpty: (v: TValue) => boolean;
  summary: (entries: { room: Room; value: TValue }[], allRooms: Room[]) => SummaryTile[];
  saveVerb?: string;
};

export type ExistingEntry<TValue> = { id: string; room: string; value: TValue };

type DailyRecordingModalProps<TValue extends RoomValue> = {
  open: boolean;
  onClose: () => void;
  farmId: string | null | undefined;
  rooms: Room[];
  schema: ModuleSchema<TValue>;
  /** Records that already exist for the currently selected date. */
  existingForDate: (date: string) => ExistingEntry<TValue>[];
  /** The most recent completed day (used by Copy Yesterday). */
  yesterdayFor: (date: string) => { room: string; value: TValue }[];
  /** Save handler receives per-room deltas. Existing rows carry their id. */
  onSave: (args: {
    date: string;
    entries: { room: string; existingId?: string; value: TValue }[];
  }) => Promise<void>;
};

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const inputBase =
  "w-full rounded-xl border border-[color:var(--forest)]/15 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-[color:var(--gold)]/40 focus:border-[color:var(--forest)]/40 transition";

export function DailyRecordingModal<TValue extends RoomValue>({
  open,
  onClose,
  farmId,
  rooms,
  schema,
  existingForDate,
  yesterdayFor,
  onSave,
}: DailyRecordingModalProps<TValue>) {
  const [date, setDate] = useState(todayIso());
  const [values, setValues] = useState<Record<string, TValue>>({});
  const [saving, setSaving] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const initialisedForRef = useRef<string>("");
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const draftKey = useMemo(
    () => `poultrypro.draft.${schema.moduleId}.${farmId ?? "anon"}.${date}`,
    [schema.moduleId, farmId, date],
  );

  const existing = useMemo(() => existingForDate(date), [existingForDate, date]);
  const existingByRoom = useMemo(() => {
    const map = new Map<string, ExistingEntry<TValue>>();
    for (const e of existing) map.set(e.room.toUpperCase(), e);
    return map;
  }, [existing]);
  const hasExisting = existing.length > 0;

  // Initialise per-room values whenever the date changes.
  //  1. Load draft from localStorage
  //  2. Otherwise preload existing records for that date (edit-mode)
  //  3. Otherwise start empty
  useEffect(() => {
    if (!open) return;
    const stamp = `${schema.moduleId}:${date}:${farmId ?? "anon"}`;
    if (initialisedForRef.current === stamp) return;
    initialisedForRef.current = stamp;

    let draft: Record<string, TValue> | null = null;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(draftKey);
        if (raw) draft = JSON.parse(raw) as Record<string, TValue>;
      } catch {
        draft = null;
      }
    }

    const initial: Record<string, TValue> = {};
    for (const room of rooms) {
      const roomKey = room.name.toUpperCase();
      if (draft && draft[roomKey]) initial[roomKey] = draft[roomKey];
      else if (existingByRoom.has(roomKey))
        initial[roomKey] = { ...(existingByRoom.get(roomKey)!.value as TValue) };
      else initial[roomKey] = { ...schema.emptyValue };
    }
    setValues(initial);
  }, [open, date, rooms, schema, existingByRoom, draftKey, farmId]);

  // Reset init guard when the modal closes so re-opening re-hydrates cleanly.
  useEffect(() => {
    if (!open) initialisedForRef.current = "";
  }, [open]);

  // Debounced draft autosave.
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(values));
      } catch {
        // ignore quota errors
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [open, values, draftKey]);

  // Esc-to-close + scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const setRoomField = (roomName: string, key: string, next: number | string) => {
    setValues((prev) => ({
      ...prev,
      [roomName]: { ...(prev[roomName] ?? schema.emptyValue), [key]: next } as TValue,
    }));
  };

  const clearAll = () => {
    const next: Record<string, TValue> = {};
    for (const r of rooms) next[r.name.toUpperCase()] = { ...schema.emptyValue };
    setValues(next);
    toast("Cleared all rooms", { description: "Draft has been reset." });
  };

  const applyYesterday = (keys: (keyof TValue & string)[]) => {
    const y = yesterdayFor(date);
    if (!y.length) {
      toast("Nothing to copy", { description: "No prior day's records were found." });
      setShowCopyMenu(false);
      return;
    }
    const prev = values;
    const next: Record<string, TValue> = {};
    for (const room of rooms) {
      const roomKey = room.name.toUpperCase();
      const src = y.find((e) => e.room.toUpperCase() === roomKey)?.value;
      const base = { ...(prev[roomKey] ?? schema.emptyValue) } as TValue;
      if (src) {
        for (const k of keys) {
          const v = (src as TValue)[k];
          if (v !== undefined && v !== null && v !== "") (base as RoomValue)[k] = v;
        }
      }
      next[roomKey] = base;
    }
    setValues(next);
    setShowCopyMenu(false);
    toast.success("Copied from previous day", {
      description: `${keys.join(", ")} prefilled. Review before saving.`,
      action: {
        label: "Undo",
        onClick: () => setValues(prev),
      },
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const entries: { room: string; existingId?: string; value: TValue }[] = [];
    for (const room of rooms) {
      const roomKey = room.name.toUpperCase();
      const v = values[roomKey] ?? schema.emptyValue;
      if (schema.isEmpty(v)) {
        // Skip empty rooms unless they already have a saved record — for
        // now we treat "empty on save" as "no change" rather than delete.
        continue;
      }
      entries.push({
        room: roomKey,
        existingId: existingByRoom.get(roomKey)?.id,
        value: v,
      });
    }
    if (!entries.length) {
      toast("Nothing to save", { description: "Enter at least one room's values." });
      return;
    }
    setSaving(true);
    try {
      await onSave({ date, entries });
      toast.success(hasExisting ? `${schema.title} updated` : `${schema.title} saved`);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(draftKey);
        } catch {
          /* noop */
        }
      }
      onClose();
    } catch (err) {
      toast.error(`Failed to save ${schema.title.toLowerCase()}`, {
        description: (err as Error).message,
      });
    } finally {
      setSaving(false);
    }
  };

  // Live summary computation
  const summaryEntries = rooms.map((room) => ({
    room,
    value: (values[room.name.toUpperCase()] ?? schema.emptyValue) as TValue,
  }));
  const tiles = schema.summary(summaryEntries, rooms);

  // ---------- Keyboard nav ----------
  // Tab already works natively. We add ArrowUp/Down to jump to the same field
  // in the previous/next room, ArrowLeft/Right for adjacent fields in the row.
  const focusCell = (roomIdx: number, fieldIdx: number) => {
    const room = rooms[roomIdx];
    const field = schema.fields[fieldIdx];
    if (!room || !field) return;
    const el = inputsRef.current[`${room.name.toUpperCase()}:${field.key}`];
    el?.focus();
    el?.select?.();
  };
  const handleKey = (e: ReactKeyboardEvent<HTMLInputElement>, roomIdx: number, fieldIdx: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusCell(Math.min(rooms.length - 1, roomIdx + 1), fieldIdx);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusCell(Math.max(0, roomIdx - 1), fieldIdx);
    } else if (e.key === "ArrowRight" && (e.target as HTMLInputElement).selectionStart === (e.target as HTMLInputElement).value.length) {
      e.preventDefault();
      focusCell(roomIdx, Math.min(schema.fields.length - 1, fieldIdx + 1));
    } else if (e.key === "ArrowLeft" && (e.target as HTMLInputElement).selectionStart === 0) {
      e.preventDefault();
      focusCell(roomIdx, Math.max(0, fieldIdx - 1));
    }
  };

  const saveLabel = hasExisting
    ? `Update ${schema.saveVerb ?? "Record"}`
    : `Save ${schema.saveVerb ?? "Record"}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 backdrop-blur-sm p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-[calc(100%-24px)] mx-3 mb-3 sm:m-0 sm:max-w-2xl max-h-[92dvh] sm:max-h-[92vh] flex flex-col rounded-3xl bg-[color:var(--cream)] border border-[color:var(--forest)]/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--forest)]/10 bg-background/70 px-5 py-4">
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold text-[color:var(--forest)] truncate">
              {schema.title}
            </div>
            {schema.subtitle && (
              <div className="text-xs text-muted-foreground mt-0.5">{schema.subtitle}</div>
            )}
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="shrink-0 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Date + toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="block sm:flex-1">
              <div className="text-xs font-medium text-[color:var(--forest)] uppercase tracking-wider mb-1.5">
                Record date
              </div>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputBase + " pr-10"}
                  required
                />
                <CalendarDays className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--forest)]/60" />
              </div>
            </label>
            <div className="flex items-center gap-2">
              {schema.copyableKeys && schema.copyableKeys.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCopyMenu((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--forest)]/20 bg-background px-3 py-2 text-xs font-medium text-[color:var(--forest)] hover:bg-secondary transition"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy Yesterday <ChevronDown className="h-3 w-3" />
                  </button>
                  {showCopyMenu && (
                    <div className="absolute right-0 top-full mt-1 z-10 w-56 rounded-2xl border border-[color:var(--forest)]/15 bg-[color:var(--cream)] shadow-xl p-1">
                      <button
                        type="button"
                        onClick={() => applyYesterday(schema.copyableKeys!)}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-secondary"
                      >
                        Copy all fields
                      </button>
                      {schema.copyableKeys.map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => applyYesterday([k])}
                          className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-secondary capitalize"
                        >
                          Copy {k}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--forest)]/20 bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary transition"
              >
                <Eraser className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          </div>

          {hasExisting && (
            <div className="rounded-xl bg-[color:var(--gold)]/10 border border-[color:var(--gold)]/30 px-3 py-2 text-xs text-[color:var(--forest)]">
              Records already exist for this date — editing will update the existing entries.
            </div>
          )}

          {/* Per-room cards */}
          {rooms.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[color:var(--forest)]/20 px-4 py-8 text-center text-sm text-muted-foreground">
              No rooms yet. Add a room from your dashboard to begin recording.
            </div>
          )}
          <div className="space-y-3">
            {rooms.map((room, roomIdx) => {
              const roomKey = room.name.toUpperCase();
              const v = values[roomKey] ?? schema.emptyValue;
              const isExisting = existingByRoom.has(roomKey);
              return (
                <div
                  key={room.id}
                  className="rounded-2xl border border-[color:var(--forest)]/10 bg-background/60 p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-[color:var(--forest)]">
                      {room.name}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {isExisting ? "Editing" : "New"} · {room.current} birds
                    </div>
                  </div>
                  <div
                    className={
                      schema.fields.length === 1
                        ? "grid grid-cols-1 gap-2"
                        : schema.fields.length === 2
                          ? "grid grid-cols-2 gap-2"
                          : "grid grid-cols-2 sm:grid-cols-3 gap-2"
                    }
                  >
                    {schema.fields.map((field, fieldIdx) => (
                      <label key={field.key} className="block">
                        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          {field.label}
                          {field.suffix && (
                            <span className="ml-1 text-muted-foreground/60 normal-case">
                              ({field.suffix})
                            </span>
                          )}
                        </div>
                        <input
                          ref={(el) => {
                            inputsRef.current[`${roomKey}:${field.key}`] = el;
                          }}
                          type={field.type === "text" ? "text" : "number"}
                          inputMode={field.type === "text" ? undefined : "decimal"}
                          step={field.step ?? (field.type === "text" ? undefined : "any")}
                          min={field.min ?? (field.type === "text" ? undefined : 0)}
                          placeholder={field.placeholder ?? "0"}
                          value={
                            (v as RoomValue)[field.key] === undefined
                              ? ""
                              : String((v as RoomValue)[field.key])
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (field.type === "text") setRoomField(roomKey, field.key, raw);
                            else setRoomField(roomKey, field.key, raw === "" ? "" : Number(raw));
                          }}
                          onKeyDown={(e) => handleKey(e, roomIdx, fieldIdx)}
                          className={inputBase}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live summary */}
          {tiles.length > 0 && (
            <div className="rounded-2xl bg-[color:var(--forest)]/8 border border-[color:var(--forest)]/15 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-[color:var(--forest)] font-semibold mb-2">
                Live Summary
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {tiles.map((t) => (
                  <div key={t.label}>
                    <div
                      className={
                        "font-display text-2xl font-semibold " +
                        (t.accent ? "text-[color:var(--gold)]" : "text-[color:var(--forest)]")
                      }
                    >
                      {t.value}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{t.label}</div>
                    {t.hint && (
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5">{t.hint}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-[color:var(--forest)]/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground hover:opacity-90 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || rooms.length === 0}
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--forest)] text-primary-foreground px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Saving…" : saveLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
