// "Complete Flock Profile" — one-time (editable) bird age entry for a flock.
//
// The farmer either knows the real placement date, or only the current age in
// weeks. In the second case we back-calculate an ESTIMATED start date from
// today and label it as such. Nothing historical is ever touched.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { X, Loader2, CalendarDays } from "lucide-react";
import { useUpdateRoom, type Room } from "@/lib/farm-data";
import { BIRD_TYPES, estimatedStartDate, flockAge, hasAge } from "@/lib/flock-age";

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function FlockAgeDialog({ room, onClose }: { room: Room; onClose: () => void }) {
  const editing = hasAge(room);
  const [birdType, setBirdType] = useState<string>(() => {
    const t = (room.bird_type ?? "").toLowerCase();
    return BIRD_TYPES.find((b) => t.includes(b.toLowerCase())) ?? (t.includes("layer") ? "Layer" : "Other");
  });
  const [breed, setBreed] = useState(room.breed ?? "");
  const [mode, setMode] = useState<"date" | "weeks">(room.age_anchor_date ? "date" : "weeks");
  const [dayOld, setDayOld] = useState(false);
  const [weeks, setWeeks] = useState<number | "">(() => {
    const a = flockAge(room);
    return a.status === "missing" ? "" : a.weeks;
  });
  const [placed, setPlaced] = useState(room.age_anchor_date ?? room.date_stocked ?? todayIso());
  const m = useUpdateRoom();

  const anchor = useMemo(() => {
    if (dayOld) return todayIso();
    if (mode === "date") return placed;
    return weeks === "" ? null : estimatedStartDate(Number(weeks));
  }, [dayOld, mode, placed, weeks]);

  const preview = anchor ? flockAge({ age_status: "recorded", age_anchor_date: anchor }) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!anchor || m.isPending) return;
    m.mutate(
      {
        id: room.id,
        bird_type: birdType,
        breed: breed.trim() || null,
        age_anchor_date: anchor,
        age_status: dayOld || mode === "date" ? "recorded" : "estimated",
        age_recorded_at: new Date().toISOString(),
        age_weeks: preview ? preview.weeks : null,
        date_stocked: room.date_stocked ?? anchor,
      },
      {
        onSuccess: () => {
          toast.success(editing ? "Flock age updated" : "Flock profile completed", {
            description: "Historical farm records were not changed.",
          });
          onClose();
        },
        onError: (err) => toast.error("Could not save bird age", { description: (err as Error).message }),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 backdrop-blur-sm p-0 sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-[calc(100%-24px)] mx-3 mb-3 sm:m-0 sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">🐔 {editing ? "Edit Flock Age" : "Complete Flock Profile"}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{room.name} · {room.current.toLocaleString()} birds</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {editing && (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
            Changing the flock start date will update the current age and future age-based reminders. Historical farm records will not be changed.
          </p>
        )}

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Bird type</span>
              <select value={birdType} onChange={(e) => setBirdType(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
                {BIRD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Breed <span className="font-normal text-muted-foreground">(optional)</span></span>
              <input value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="ISA Brown" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </label>
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm">
            <input type="checkbox" checked={dayOld} onChange={(e) => setDayOld(e.target.checked)} className="h-4 w-4" />
            These are day-old chicks
          </label>

          {!dayOld && (
            <>
              <div className="inline-flex rounded-full bg-secondary p-1 text-xs font-medium">
                {([["date", "I know the placement date"], ["weeks", "I know the current age"]] as const).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setMode(k)}
                    className={"px-3 py-1 rounded-full transition " + (mode === k ? "bg-[color:var(--forest)] text-primary-foreground" : "text-muted-foreground")}>
                    {label}
                  </button>
                ))}
              </div>

              {mode === "date" ? (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Placement / start date</span>
                  <input type="date" value={placed} onChange={(e) => setPlaced(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                </label>
              ) : (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Current bird age (weeks)</span>
                  <input type="number" min={0} value={weeks} onChange={(e) => setWeeks(e.target.value === "" ? "" : Number(e.target.value))} placeholder="6" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                  {anchor && (
                    <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" /> Estimated Start Date: <strong className="text-foreground">{anchor}</strong>
                    </span>
                  )}
                </label>
              )}
            </>
          )}

          {preview && (
            <div className="rounded-xl border border-border bg-secondary/50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bird Age</p>
              <p className="text-lg font-semibold">{preview.weeks} {preview.weeks === 1 ? "Week" : "Weeks"}</p>
              <p className="text-sm text-muted-foreground">{preview.days} Days · updates automatically every day</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary">Cancel</button>
          <button type="submit" disabled={!anchor || m.isPending} className="inline-flex items-center gap-2 rounded-full bg-[color:var(--forest)] px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save Bird Age
          </button>
        </div>
      </form>
    </div>
  );
}
