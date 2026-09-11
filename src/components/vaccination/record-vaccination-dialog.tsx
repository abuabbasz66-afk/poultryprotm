import { useEffect, useMemo, useState } from "react";
import { Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRooms } from "@/lib/farm-data";
import type { LayerBatch } from "@/lib/layer-rearing";
import {
  GUMBORO_NOTE,
  ROUTES,
  daysBetween,
  dueDateFor,
  flockAnchor,
  isGumboro,
  todayKey,
  useSaveVaccinationRecord,
  type FlockSchedule,
  type RecordInput,
  type VaccinationRecord,
} from "@/lib/vaccination";

const NONE = "__none__";

type Draft = {
  batch_id: string;
  room_id: string;
  schedule_id: string;
  disease: string;
  vaccine: string;
  scheduled_date: string;
  vaccination_date: string;
  bird_age_days: string;
  birds_present: string;
  birds_vaccinated: string;
  batch_number: string;
  manufacturer: string;
  expiry_date: string;
  route: string;
  administration_method: string;
  dose: string;
  water_volume_litres: string;
  person_responsible: string;
  veterinarian: string;
  notes: string;
  at_hatchery: boolean;
  hatchery_name: string;
};

const EMPTY: Draft = {
  batch_id: "",
  room_id: NONE,
  schedule_id: NONE,
  disease: "",
  vaccine: "",
  scheduled_date: "",
  vaccination_date: todayKey(),
  bird_age_days: "",
  birds_present: "",
  birds_vaccinated: "",
  batch_number: "",
  manufacturer: "",
  expiry_date: "",
  route: "",
  administration_method: "",
  dose: "",
  water_volume_litres: "",
  person_responsible: "",
  veterinarian: "",
  notes: "",
  at_hatchery: false,
  hatchery_name: "",
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const text = (v: string) => (v.trim() === "" ? null : v.trim());

export function RecordVaccinationDialog({
  open,
  onOpenChange,
  batches,
  schedules,
  farmName,
  editing,
  presetScheduleId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batches: LayerBatch[];
  schedules: FlockSchedule[];
  farmName: string;
  editing?: VaccinationRecord | null;
  presetScheduleId?: string | null;
}) {
  const rooms = useRooms();
  const save = useSaveVaccinationRecord();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [overrideCount, setOverrideCount] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  useEffect(() => {
    if (!open) return;
    setOverrideCount(false);
    if (editing) {
      setDraft({
        batch_id: editing.batch_id ?? "",
        room_id: editing.room_id ?? NONE,
        schedule_id: editing.schedule_id ?? NONE,
        disease: editing.disease,
        vaccine: editing.vaccine,
        scheduled_date: editing.scheduled_date ?? "",
        vaccination_date: editing.vaccination_date,
        bird_age_days: editing.bird_age_days?.toString() ?? "",
        birds_present: editing.birds_present?.toString() ?? "",
        birds_vaccinated: editing.birds_vaccinated?.toString() ?? "",
        batch_number: editing.batch_number ?? "",
        manufacturer: editing.manufacturer ?? "",
        expiry_date: editing.expiry_date ?? "",
        route: editing.route ?? "",
        administration_method: editing.administration_method ?? "",
        dose: editing.dose ?? "",
        water_volume_litres: editing.water_volume_litres?.toString() ?? "",
        person_responsible: editing.person_responsible ?? "",
        veterinarian: editing.veterinarian ?? "",
        notes: editing.notes ?? "",
        at_hatchery: editing.at_hatchery,
        hatchery_name: editing.hatchery_name ?? "",
      });
      return;
    }
    const preset = presetScheduleId ? schedules.find((s) => s.id === presetScheduleId) : undefined;
    const batch = preset
      ? batches.find((b) => b.id === preset.batch_id)
      : batches[0];
    setDraft({
      ...EMPTY,
      batch_id: batch?.id ?? "",
      room_id: batch?.room_id ?? NONE,
      birds_present: batch?.current_birds?.toString() ?? "",
      ...(preset
        ? {
            schedule_id: preset.id,
            disease: preset.disease,
            vaccine: preset.vaccine,
            route: preset.route,
            scheduled_date: preset.scheduled_date,
            bird_age_days: String(preset.age_days),
            at_hatchery: /hatchery/i.test(preset.route),
          }
        : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, presetScheduleId]);

  const batch = batches.find((b) => b.id === draft.batch_id);
  const batchSchedules = useMemo(
    () => schedules.filter((s) => s.batch_id === draft.batch_id).sort((a, b) => a.sequence - b.sequence),
    [schedules, draft.batch_id],
  );

  /** Selecting a planned vaccination fills disease, vaccine, route, date and age. */
  const pickSchedule = (id: string) => {
    if (id === NONE) {
      set("schedule_id", NONE);
      return;
    }
    const s = batchSchedules.find((x) => x.id === id);
    if (!s) return;
    setDraft((d) => ({
      ...d,
      schedule_id: id,
      disease: s.disease,
      vaccine: s.vaccine,
      route: s.route,
      scheduled_date: s.scheduled_date,
      bird_age_days: String(s.age_days),
      at_hatchery: /hatchery/i.test(s.route),
    }));
  };

  const pickBatch = (id: string) => {
    const b = batches.find((x) => x.id === id);
    setDraft((d) => ({
      ...d,
      batch_id: id,
      schedule_id: NONE,
      room_id: b?.room_id ?? NONE,
      birds_present: b?.current_birds?.toString() ?? d.birds_present,
    }));
  };

  /** Bird age is derived from the flock's own hatch/placement date. */
  const derivedAge = useMemo(() => {
    if (!batch) return null;
    const anchor = flockAnchor(batch);
    if (!anchor || !draft.vaccination_date) return null;
    return daysBetween(anchor.date, draft.vaccination_date) + 1;
  }, [batch, draft.vaccination_date]);

  const submit = async () => {
    if (!draft.batch_id) return toast.error("Choose the flock this vaccination belongs to.");
    if (!draft.disease.trim()) return toast.error("Enter the disease being vaccinated against.");
    if (!draft.vaccine.trim()) return toast.error("Enter the vaccine used.");
    if (!draft.vaccination_date) return toast.error("Enter the vaccination date.");
    if (draft.vaccination_date > todayKey())
      return toast.error("The vaccination date cannot be in the future.");
    const present = num(draft.birds_present);
    const given = num(draft.birds_vaccinated);
    if (given != null && present != null && given > present && !overrideCount)
      return toast.error(
        "Birds vaccinated is more than birds present. Tick the override to save it anyway.",
      );
    if (draft.expiry_date && draft.expiry_date < draft.vaccination_date)
      return toast.error("The vaccine expiry date is before the vaccination date.");

    const payload: RecordInput = {
      id: editing?.id,
      batch_id: draft.batch_id,
      schedule_id: draft.schedule_id === NONE ? null : draft.schedule_id,
      programme_id:
        draft.schedule_id === NONE
          ? null
          : (batchSchedules.find((s) => s.id === draft.schedule_id)?.programme_id ?? null),
      room_id: draft.room_id === NONE ? null : draft.room_id,
      bird_type: batch?.bird_type ?? "Layer",
      disease: draft.disease.trim(),
      vaccine: draft.vaccine.trim(),
      scheduled_date: text(draft.scheduled_date),
      vaccination_date: draft.vaccination_date,
      bird_age_days: num(draft.bird_age_days),
      birds_present: present,
      birds_vaccinated: given,
      batch_number: text(draft.batch_number),
      manufacturer: text(draft.manufacturer),
      expiry_date: text(draft.expiry_date),
      route: text(draft.route),
      administration_method: text(draft.administration_method),
      dose: text(draft.dose),
      water_volume_litres: num(draft.water_volume_litres),
      person_responsible: text(draft.person_responsible),
      veterinarian: text(draft.veterinarian),
      notes: text(draft.notes),
      at_hatchery: draft.at_hatchery,
      hatchery_name: draft.at_hatchery ? text(draft.hatchery_name) : null,
    };

    try {
      await save.mutateAsync(payload);
      toast.success(editing ? "Vaccination record updated." : "Vaccination recorded.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the vaccination.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit vaccination" : "Record vaccination"}</DialogTitle>
          <DialogDescription>
            Capture what was actually given. The planned date is kept separately so you can see
            whether the flock was vaccinated early, on schedule or late.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Farm">
              <Input value={farmName} readOnly className="bg-muted/40" />
            </Field>
            <Field label="Flock" required>
              <Select value={draft.batch_id} onValueChange={pickBatch}>
                <SelectTrigger><SelectValue placeholder="Choose a flock" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Room">
              <Select value={draft.room_id} onValueChange={(v) => set("room_id", v)}>
                <SelectTrigger><SelectValue placeholder="No room" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No room</SelectItem>
                  {(rooms.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Bird type">
              <Input value={batch?.bird_type ?? "Layer"} readOnly className="bg-muted/40" />
            </Field>
            <Field label="Planned vaccination" hint="Fills the disease, vaccine, route and planned date.">
              <Select value={draft.schedule_id} onValueChange={pickSchedule}>
                <SelectTrigger><SelectValue placeholder="Not on the plan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not on the plan</SelectItem>
                  {batchSchedules.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.age_label} · {s.vaccine} ({s.disease})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Programme">
              <Input
                value={batchSchedules[0]?.programme_name ?? "None assigned"}
                readOnly
                className="bg-muted/40"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Disease" required>
              <Input value={draft.disease} onChange={(e) => set("disease", e.target.value)} />
            </Field>
            <Field label="Vaccine" required>
              <Input value={draft.vaccine} onChange={(e) => set("vaccine", e.target.value)} />
            </Field>
          </div>

          {isGumboro(draft.disease) && (
            <p className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {GUMBORO_NOTE}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Scheduled date" hint="Kept as planned — never overwritten.">
              <Input type="date" value={draft.scheduled_date} onChange={(e) => set("scheduled_date", e.target.value)} />
            </Field>
            <Field label="Vaccination date" required>
              <Input type="date" value={draft.vaccination_date} onChange={(e) => set("vaccination_date", e.target.value)} />
            </Field>
            <Field
              label="Bird age (days)"
              hint={derivedAge != null ? `Flock is about ${derivedAge} days old on that date.` : undefined}
            >
              <Input
                type="number"
                inputMode="numeric"
                value={draft.bird_age_days}
                onChange={(e) => set("bird_age_days", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Birds present">
              <Input type="number" inputMode="numeric" value={draft.birds_present} onChange={(e) => set("birds_present", e.target.value)} />
            </Field>
            <Field label="Birds vaccinated">
              <Input type="number" inputMode="numeric" value={draft.birds_vaccinated} onChange={(e) => set("birds_vaccinated", e.target.value)} />
            </Field>
          </div>

          {num(draft.birds_vaccinated) != null &&
            num(draft.birds_present) != null &&
            (num(draft.birds_vaccinated) as number) > (num(draft.birds_present) as number) && (
              <label className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
                <Checkbox checked={overrideCount} onCheckedChange={(v) => setOverrideCount(!!v)} />
                More birds vaccinated than present — save anyway (I have checked the numbers).
              </label>
            )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Vaccine batch / lot number">
              <Input value={draft.batch_number} onChange={(e) => set("batch_number", e.target.value)} />
            </Field>
            <Field label="Manufacturer">
              <Input value={draft.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
            </Field>
            <Field label="Expiry date">
              <Input type="date" value={draft.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Route">
              <Select value={draft.route || NONE} onValueChange={(v) => set("route", v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Choose a route" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not stated</SelectItem>
                  {ROUTES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Administration method">
              <Input
                placeholder="e.g. mixed in morning drinking water"
                value={draft.administration_method}
                onChange={(e) => set("administration_method", e.target.value)}
              />
            </Field>
            <Field label="Dose / quantity">
              <Input value={draft.dose} onChange={(e) => set("dose", e.target.value)} />
            </Field>
            <Field label="Water volume (litres)" hint="Only when given in drinking water.">
              <Input
                type="number"
                inputMode="decimal"
                value={draft.water_volume_litres}
                onChange={(e) => set("water_volume_litres", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Person responsible">
              <Input value={draft.person_responsible} onChange={(e) => set("person_responsible", e.target.value)} />
            </Field>
            <Field label="Veterinarian / supervisor">
              <Input value={draft.veterinarian} onChange={(e) => set("veterinarian", e.target.value)} />
            </Field>
          </div>

          <div className="space-y-2 rounded-xl border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={draft.at_hatchery}
                onCheckedChange={(v) => set("at_hatchery", !!v)}
              />
              Administered at the hatchery
            </label>
            <p className="text-xs text-muted-foreground">
              Tick this for chicks already vaccinated before delivery — for example Day 1 Marek's —
              so the flock is not vaccinated a second time by mistake.
            </p>
            {draft.at_hatchery && (
              <Field label="Hatchery name">
                <Input value={draft.hatchery_name} onChange={(e) => set("hatchery_name", e.target.value)} />
              </Field>
            )}
          </div>

          <Field label="Notes">
            <Textarea rows={3} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Record vaccination"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
