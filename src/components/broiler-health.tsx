import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Syringe, Pill, Plus, Trash2, Pencil, CalendarClock, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toDateKey } from "@/lib/date-key";
import {
  useBroilerVaccinations, useBroilerMedications,
  useSaveBroilerVaccination, useDeleteBroilerVaccination,
  useSaveBroilerMedication, useDeleteBroilerMedication,
  batchAgeDays, ageLabel, broilerHealthAlerts,
  type BroilerBatch, type BroilerVaccination, type BroilerMedication,
} from "@/lib/broiler-data";

const todayKey = () => toDateKey(new Date())!;
const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

/** Farm-wide age & vaccination reminders, shown above the batch list. */
export function BroilerAgeAlerts({ batches }: { batches: BroilerBatch[] }) {
  const vaccQ = useBroilerVaccinations();
  const alerts = useMemo(
    () => broilerHealthAlerts(batches, vaccQ.data ?? []),
    [batches, vaccQ.data],
  );

  if (alerts.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <CalendarClock className="h-4 w-4 text-amber-600" /> Age &amp; vaccination reminders
      </div>
      <ul className="mt-3 space-y-2">
        {alerts.map((a, i) => (
          <li key={`${a.batchId}-${a.day}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              a.tone === "overdue"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : a.tone === "due"
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-700"
                  : "border-border bg-muted text-muted-foreground",
            )}>
              {a.tone}
            </span>
            <span className="font-medium text-foreground">{a.batchName}</span>
            <span className="text-muted-foreground">
              — {a.name} (day {a.day}). {a.note}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Vaccination + medication register for one batch. */
export function BroilerHealthPanel({ batch, canWrite, canDelete }: {
  batch: BroilerBatch; canWrite: boolean; canDelete: boolean;
}) {
  const vaccQ = useBroilerVaccinations();
  const medQ = useBroilerMedications();
  const delVacc = useDeleteBroilerVaccination();
  const delMed = useDeleteBroilerMedication();

  const [vaccFor, setVaccFor] = useState<BroilerVaccination | "new" | null>(null);
  const [medFor, setMedFor] = useState<BroilerMedication | "new" | null>(null);

  const vaccinations = (vaccQ.data ?? []).filter((v) => v.batch_id === batch.id);
  const medications = (medQ.data ?? []).filter((m) => m.batch_id === batch.id);
  const age = batchAgeDays(batch.date_placed);

  const remove = (kind: "vacc" | "med", id: string, label: string) => {
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    const m = kind === "vacc" ? delVacc : delMed;
    m.mutate(id, {
      onSuccess: () => toast.success("Record deleted"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
    });
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      {/* Vaccinations */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Syringe className="h-4 w-4 text-primary" /> Vaccinations
          </div>
          <span className="text-[11px] text-muted-foreground">{ageLabel(age)}</span>
        </div>

        {vaccinations.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No vaccinations recorded for this batch yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr><th className="py-1.5">Vaccine</th><th>Date</th><th>Age</th><th>By</th><th /></tr>
              </thead>
              <tbody>
                {vaccinations.map((v) => (
                  <tr key={v.id} className="border-t border-border/60">
                    <td className="py-2 font-medium text-foreground">{v.vaccine_name}</td>
                    <td>{v.date_given}</td>
                    <td>{v.age_days != null ? `Day ${v.age_days}` : "—"}</td>
                    <td className="text-muted-foreground">{v.administered_by || "—"}</td>
                    <td className="text-right">
                      <RowBtns
                        canWrite={canWrite} canDelete={canDelete}
                        onEdit={() => setVaccFor(v)}
                        onDelete={() => remove("vacc", v.id, v.vaccine_name)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canWrite && (
          <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={() => setVaccFor("new")}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add vaccination
          </Button>
        )}
      </div>

      {/* Medications */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Pill className="h-4 w-4 text-primary" /> Medication
        </div>

        {medications.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No medication recorded for this batch yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr><th className="py-1.5">Drug</th><th>Dosage</th><th>Period</th><th>Purpose</th><th /></tr>
              </thead>
              <tbody>
                {medications.map((m) => (
                  <tr key={m.id} className="border-t border-border/60">
                    <td className="py-2 font-medium text-foreground">{m.drug_name}</td>
                    <td>{m.dosage || "—"}</td>
                    <td>{m.start_date}{m.end_date ? ` → ${m.end_date}` : ""}</td>
                    <td className="text-muted-foreground">{m.purpose || "—"}</td>
                    <td className="text-right">
                      <RowBtns
                        canWrite={canWrite} canDelete={canDelete}
                        onEdit={() => setMedFor(m)}
                        onDelete={() => remove("med", m.id, m.drug_name)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canWrite && (
          <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={() => setMedFor("new")}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add medication
          </Button>
        )}
        {medications.some((m) => m.end_date && m.end_date >= todayKey()) && (
          <p className="mt-3 flex items-start gap-1.5 text-[12px] text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            A treatment is still running — observe the withdrawal period before selling birds.
          </p>
        )}
      </div>

      {vaccFor && (
        <VaccinationDialog
          batch={batch}
          editing={vaccFor === "new" ? null : vaccFor}
          onClose={() => setVaccFor(null)}
        />
      )}
      {medFor && (
        <MedicationDialog
          batch={batch}
          editing={medFor === "new" ? null : medFor}
          onClose={() => setMedFor(null)}
        />
      )}
    </div>
  );
}

function RowBtns({ canWrite, canDelete, onEdit, onDelete }: {
  canWrite: boolean; canDelete: boolean; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {canWrite && (
        <button className="text-muted-foreground hover:text-foreground" onClick={onEdit} aria-label="Edit record">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      {canDelete && (
        <button className="text-muted-foreground hover:text-destructive" onClick={onDelete} aria-label="Delete record">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}

function VaccinationDialog({ batch, editing, onClose }: {
  batch: BroilerBatch; editing: BroilerVaccination | null; onClose: () => void;
}) {
  const save = useSaveBroilerVaccination();
  const [name, setName] = useState(editing?.vaccine_name ?? "");
  const [date, setDate] = useState(editing?.date_given ?? todayKey());
  const [by, setBy] = useState(editing?.administered_by ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const ageDays = batchAgeDays(batch.date_placed, new Date(`${date}T00:00:00`));

  const submit = () => {
    if (!name.trim()) { toast.error("Enter the vaccine name"); return; }
    save.mutate({
      id: editing?.id,
      batch_id: batch.id,
      vaccine_name: name,
      date_given: date,
      age_days: ageDays,
      administered_by: by,
      notes,
    }, {
      onSuccess: () => { toast.success(editing ? "Vaccination updated" : "Vaccination recorded"); onClose(); },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit vaccination" : "Record vaccination"} — {batch.name}</DialogTitle>
          <DialogDescription>Birds are {ageLabel(ageDays)} on the selected date.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Vaccine">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} list="broiler-vaccines" placeholder="e.g. Newcastle (Lasota)" />
          </Field>
          <datalist id="broiler-vaccines">
            {["Marek's", "Newcastle (Lasota)", "Infectious Bronchitis", "Gumboro (IBD)", "Fowl Pox", "Infectious Coryza"].map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date given"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Administered by"><input className={inputCls} value={by} onChange={(e) => setBy(e.target.value)} placeholder="e.g. Dr. Musa" /></Field>
          </div>
          <Field label="Notes"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : editing ? "Save changes" : "Save vaccination"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MedicationDialog({ batch, editing, onClose }: {
  batch: BroilerBatch; editing: BroilerMedication | null; onClose: () => void;
}) {
  const save = useSaveBroilerMedication();
  const [drug, setDrug] = useState(editing?.drug_name ?? "");
  const [dosage, setDosage] = useState(editing?.dosage ?? "");
  const [start, setStart] = useState(editing?.start_date ?? todayKey());
  const [end, setEnd] = useState(editing?.end_date ?? "");
  const [purpose, setPurpose] = useState(editing?.purpose ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const submit = () => {
    if (!drug.trim()) { toast.error("Enter the drug name"); return; }
    save.mutate({
      id: editing?.id,
      batch_id: batch.id,
      drug_name: drug,
      dosage, start_date: start, end_date: end || null, purpose, notes,
    }, {
      onSuccess: () => { toast.success(editing ? "Medication updated" : "Medication recorded"); onClose(); },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit medication" : "Record medication"} — {batch.name}</DialogTitle>
          <DialogDescription>Treatments, antibiotics, vitamins and supplements given to this batch.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Drug / product"><input className={inputCls} value={drug} onChange={(e) => setDrug(e.target.value)} placeholder="e.g. Oxytetracycline" /></Field>
            <Field label="Dosage"><input className={inputCls} value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g. 1g / 2 litres" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date"><input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="End date"><input type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          <Field label="Purpose"><input className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. CRD treatment" /></Field>
          <Field label="Notes"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : editing ? "Save changes" : "Save medication"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
