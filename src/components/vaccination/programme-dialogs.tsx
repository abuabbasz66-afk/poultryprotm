import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { useUpdateLayerBatch, type LayerBatch } from "@/lib/layer-rearing";
import {
  ROUTES,
  VACCINATION_DISCLAIMER,
  dueDateFor,
  flockAnchor,
  formatDate,
  useAssignProgramme,
  useCreateCustomProgramme,
  type FlockSchedule,
  type ProgrammeItem,
  type VaccinationProgramme,
} from "@/lib/vaccination";

/** Assign a programme to a flock and generate its due dates. */
export function AssignProgrammeDialog({
  open,
  onOpenChange,
  batches,
  programmes,
  items,
  schedules,
  presetBatchId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batches: LayerBatch[];
  programmes: VaccinationProgramme[];
  items: ProgrammeItem[];
  schedules: FlockSchedule[];
  presetBatchId?: string | null;
}) {
  const assign = useAssignProgramme();
  const updateBatch = useUpdateLayerBatch();
  const [batchId, setBatchId] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [hatchDate, setHatchDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setBatchId(presetBatchId ?? batches[0]?.id ?? "");
    setProgrammeId(programmes[0]?.id ?? "");
    setHatchDate("");
  }, [open, presetBatchId, batches, programmes]);

  const batch = batches.find((b) => b.id === batchId);
  const programme = programmes.find((p) => p.id === programmeId);
  const programmeItems = useMemo(
    () => items.filter((i) => i.programme_id === programmeId).sort((a, b) => a.sequence - b.sequence),
    [items, programmeId],
  );
  const anchor = batch ? flockAnchor(batch) : null;
  const existing = schedules.some((s) => s.batch_id === batchId && s.programme_id === programmeId);

  const submit = async () => {
    if (!batch || !programme) return toast.error("Choose a flock and a programme.");
    let effective = anchor;
    if (hatchDate) {
      try {
        await updateBatch.mutateAsync({ id: batch.id, hatch_date: hatchDate });
        effective = { date: hatchDate, source: "hatch" };
      } catch {
        return toast.error("Could not save the hatch date.");
      }
    }
    if (!effective)
      return toast.error("Add the flock's hatch or placement date to generate its schedule.");
    if (!programmeItems.length) return toast.error("This programme has no vaccinations yet.");
    try {
      await assign.mutateAsync({
        batchId: batch.id,
        programmeId: programme.id,
        programmeName: programme.name,
        programmeVersion: programme.version,
        anchor: effective,
        items: programmeItems,
        replace: existing,
      });
      toast.success(`${programme.name} assigned to ${batch.name}.`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign the programme.");
    }
  };

  const previewAnchor = hatchDate
    ? { date: hatchDate, source: "hatch" as const }
    : anchor;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign vaccination programme</DialogTitle>
          <DialogDescription>
            Due dates are worked out from the flock's own hatch date, or its placement date when no
            hatch date is recorded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Flock</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger><SelectValue placeholder="Choose a flock" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Programme</Label>
              <Select value={programmeId} onValueChange={setProgrammeId}>
                <SelectTrigger><SelectValue placeholder="Choose a programme" /></SelectTrigger>
                <SelectContent>
                  {programmes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.is_baseline ? "" : " (custom)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!anchor && (
            <div className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <Label className="text-xs">Hatch date</Label>
              <p className="text-xs text-amber-800">
                Add the flock's hatch or placement date to generate its vaccination schedule.
              </p>
              <Input type="date" value={hatchDate} onChange={(e) => setHatchDate(e.target.value)} />
            </div>
          )}

          {anchor && (
            <div className="space-y-1.5">
              <Label className="text-xs">Hatch date (optional)</Label>
              <Input
                type="date"
                value={hatchDate}
                placeholder={anchor.date}
                onChange={(e) => setHatchDate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                {anchor.source === "hatch"
                  ? `Schedule calculated from hatch date ${formatDate(anchor.date)}.`
                  : `Schedule calculated from placement date ${formatDate(anchor.date)}. Add a hatch date for a more precise plan.`}
              </p>
            </div>
          )}

          {existing && (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              This flock already has this programme. Saving will rebuild its planned dates. Recorded
              vaccinations are never changed.
            </p>
          )}

          {previewAnchor && programmeItems.length > 0 && (
            <div className="rounded-xl border border-border">
              <p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Planned dates
              </p>
              <ul className="divide-y divide-border">
                {programmeItems.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{i.age_label}</span>
                    <span className="flex-1 truncate">{i.vaccine} · {i.disease}</span>
                    <span className="font-medium">{formatDate(dueDateFor(previewAnchor.date, i.age_days))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="flex gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {VACCINATION_DISCLAIMER}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={assign.isPending || updateBatch.isPending}>
            {(assign.isPending || updateBatch.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Assign programme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DraftItem = {
  age_days: string;
  age_label: string;
  disease: string;
  vaccine: string;
  route: string;
  note: string;
};

const BLANK: DraftItem = { age_days: "", age_label: "", disease: "", vaccine: "", route: "Oral", note: "" };

/** Build a farm's own veterinary programme. The baseline is never modified. */
export function CustomProgrammeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const create = useCreateCustomProgramme();
  const [name, setName] = useState("");
  const [birdType, setBirdType] = useState("Layer");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<DraftItem[]>([{ ...BLANK }]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setBirdType("Layer");
    setNotes("");
    setRows([{ ...BLANK }]);
  }, [open]);

  const update = (i: number, key: keyof DraftItem, value: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)));

  const submit = async () => {
    if (!name.trim()) return toast.error("Give the programme a name.");
    const items = rows
      .filter((r) => r.disease.trim() && r.vaccine.trim() && r.age_days.trim())
      .map((r) => ({
        age_days: Number(r.age_days),
        age_label: r.age_label.trim() || `Day ${Number(r.age_days)}`,
        disease: r.disease.trim(),
        vaccine: r.vaccine.trim(),
        route: r.route,
        note: r.note.trim() || null,
      }));
    if (!items.length) return toast.error("Add at least one vaccination with an age, disease and vaccine.");
    if (items.some((i) => !Number.isFinite(i.age_days) || i.age_days < 1))
      return toast.error("Target age must be a day number of 1 or more.");
    try {
      await create.mutateAsync({ name, bird_type: birdType, notes: notes.trim() || null, items });
      toast.success("Custom programme created.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the programme.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custom veterinary programme</DialogTitle>
          <DialogDescription>
            Build your own plan with your veterinarian. The recommended baseline stays exactly as it
            is.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Programme name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bird type</Label>
              <Select value={birdType} onValueChange={setBirdType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Layer">Layer</SelectItem>
                  <SelectItem value="Broiler">Broiler</SelectItem>
                  <SelectItem value="Cockerel">Cockerel</SelectItem>
                  <SelectItem value="Noiler">Noiler</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-6">
                <Input
                  className="sm:col-span-1"
                  placeholder="Age (days)"
                  type="number"
                  inputMode="numeric"
                  value={row.age_days}
                  onChange={(e) => update(i, "age_days", e.target.value)}
                />
                <Input
                  className="sm:col-span-1"
                  placeholder="Label e.g. Week 6"
                  value={row.age_label}
                  onChange={(e) => update(i, "age_label", e.target.value)}
                />
                <Input
                  className="sm:col-span-1"
                  placeholder="Disease"
                  value={row.disease}
                  onChange={(e) => update(i, "disease", e.target.value)}
                />
                <Input
                  className="sm:col-span-1"
                  placeholder="Vaccine"
                  value={row.vaccine}
                  onChange={(e) => update(i, "vaccine", e.target.value)}
                />
                <Select value={row.route} onValueChange={(v) => update(i, "route", v)}>
                  <SelectTrigger className="sm:col-span-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROUTES.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 sm:col-span-1">
                  <Input
                    placeholder="Note"
                    value={row.note}
                    onChange={(e) => update(i, "note", e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove step"
                    onClick={() => setRows((r) => (r.length === 1 ? r : r.filter((_, x) => x !== i)))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setRows((r) => [...r, { ...BLANK }])}>
              <Plus className="mr-2 h-4 w-4" /> Add vaccination
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create programme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
