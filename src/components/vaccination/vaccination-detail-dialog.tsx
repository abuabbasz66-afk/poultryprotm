import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRooms } from "@/lib/farm-data";
import type { LayerBatch } from "@/lib/layer-rearing";
import { formatDate, scheduleVariance, type VaccinationRecord } from "@/lib/vaccination";

export function VaccinationDetailDialog({
  record,
  batches,
  farmName,
  onOpenChange,
}: {
  record: VaccinationRecord | null;
  batches: LayerBatch[];
  farmName: string;
  onOpenChange: (v: boolean) => void;
}) {
  const rooms = useRooms();
  if (!record) return null;
  const batch = batches.find((b) => b.id === record.batch_id);
  const room = (rooms.data ?? []).find((r) => r.id === record.room_id);
  const variance = scheduleVariance(record.scheduled_date, record.vaccination_date);

  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vaccination details</DialogTitle>
          <DialogDescription>
            {record.vaccine} · {record.disease} · {formatDate(record.vaccination_date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Group title="Flock">
            <Row k="Farm" v={farmName} />
            <Row k="Flock" v={batch?.name ?? "—"} />
            <Row k="Room" v={room?.name ?? "—"} />
            <Row k="Bird type" v={record.bird_type} />
          </Group>

          <Group title="Vaccine">
            <Row k="Disease" v={record.disease} />
            <Row k="Vaccine" v={record.vaccine} />
            <Row k="Manufacturer" v={record.manufacturer ?? "—"} />
            <Row k="Batch / lot number" v={record.batch_number ?? "—"} />
            <Row k="Expiry date" v={formatDate(record.expiry_date)} />
          </Group>

          <Group title="Timing">
            <Row k="Scheduled date" v={formatDate(record.scheduled_date)} />
            <Row k="Actual date" v={formatDate(record.vaccination_date)} />
            <Row k="Schedule variance" v={variance ? variance.label : "—"} />
          </Group>

          <Group title="Birds">
            <Row k="Bird age" v={record.bird_age_days != null ? `${record.bird_age_days} days` : "—"} />
            <Row k="Birds present" v={record.birds_present?.toLocaleString() ?? "—"} />
            <Row k="Birds vaccinated" v={record.birds_vaccinated?.toLocaleString() ?? "—"} />
          </Group>

          <Group title="Administration">
            <Row k="Route" v={record.route ?? "—"} />
            <Row k="Dose / quantity" v={record.dose ?? "—"} />
            <Row k="Method" v={record.administration_method ?? "—"} />
            <Row
              k="Water volume"
              v={record.water_volume_litres != null ? `${record.water_volume_litres} litres` : "—"}
            />
            <Row k="Given at hatchery" v={record.at_hatchery ? "Yes" : "No"} />
            {record.at_hatchery && <Row k="Hatchery" v={record.hatchery_name ?? "—"} />}
          </Group>

          <Group title="People">
            <Row k="Person responsible" v={record.person_responsible ?? "—"} />
            <Row k="Veterinarian / supervisor" v={record.veterinarian ?? "—"} />
            <Row k="Recorded by" v={record.recorded_by_name ?? "—"} />
          </Group>

          {record.notes && (
            <Group title="Notes">
              <p className="text-sm text-foreground">{record.notes}</p>
            </Group>
          )}

          <Group title="Record">
            <Row k="Created" v={new Date(record.created_at).toLocaleString("en-GB")} />
            <Row k="Last updated" v={new Date(record.updated_at).toLocaleString("en-GB")} />
          </Group>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium text-foreground">{v}</span>
    </div>
  );
}
