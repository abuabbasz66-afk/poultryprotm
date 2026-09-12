import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Syringe,
  Plus,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Info,
  Eye,
  Pencil,
  Trash2,
  Sparkles,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/lib/rbac";
import { PermissionDenied } from "@/components/permission-denied";
import { ExportRecordsButton } from "@/components/export/export-button";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useFarm, useRooms } from "@/lib/farm-data";
import { useLayerBatches } from "@/lib/layer-rearing";
import {
  AssignProgrammeDialog,
  CustomProgrammeDialog,
} from "@/components/vaccination/programme-dialogs";
import { RecordVaccinationDialog } from "@/components/vaccination/record-vaccination-dialog";
import { VaccinationDetailDialog } from "@/components/vaccination/vaccination-detail-dialog";
import {
  GUMBORO_NOTE,
  STATUS_DOTS,
  STATUS_LABELS,
  STATUS_TONES,
  VACCINATION_DISCLAIMER,
  buildTimelines,
  formatDate,
  isGumboro,
  scheduleVariance,
  summarise,
  useDeleteVaccinationRecord,
  useFlockSchedules,
  useProgrammeItems,
  useVaccinationProgrammes,
  useVaccinationRecords,
  type VaccinationRecord,
} from "@/lib/vaccination";

export const Route = createFileRoute("/_authenticated/vaccination")({
  head: () => ({
    meta: [
      { title: "Vaccination Programme & Records — PoultryPro" },
      {
        name: "description",
        content:
          "Plan, record and track layer flock vaccination programmes with automatic due dates from each flock's hatch or placement date.",
      },
      { property: "og:title", content: "Vaccination Programme & Records — PoultryPro" },
      {
        property: "og:description",
        content:
          "Recommended Nigerian layer baseline schedule, flock timelines, hatchery vaccination, overdue reminders and full vaccination history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VaccinationPage,
});

const ALL = "all";

function VaccinationPage() {
  const { can, loading } = usePermissions();
  const farm = useFarm();
  const rooms = useRooms();
  const batchesQ = useLayerBatches();
  const programmesQ = useVaccinationProgrammes();
  const itemsQ = useProgrammeItems();
  const schedulesQ = useFlockSchedules();
  const recordsQ = useVaccinationRecords();
  const removeRecord = useDeleteVaccinationRecord();

  const [flockFilter, setFlockFilter] = useState(ALL);
  const [programmeFilter, setProgrammeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [assignOpen, setAssignOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [editing, setEditing] = useState<VaccinationRecord | null>(null);
  const [presetSchedule, setPresetSchedule] = useState<string | null>(null);
  const [detail, setDetail] = useState<VaccinationRecord | null>(null);

  const batches = batchesQ.data ?? [];
  const schedules = schedulesQ.data ?? [];
  const records = recordsQ.data ?? [];

  const timelines = useMemo(
    () => buildTimelines(batches, schedules, records),
    [batches, schedules, records],
  );

  const visibleTimelines = useMemo(
    () =>
      timelines.filter(
        (t) =>
          (flockFilter === ALL || t.batchId === flockFilter) &&
          (programmeFilter === ALL || t.programmeName === programmeFilter),
      ),
    [timelines, flockFilter, programmeFilter],
  );

  const stats = useMemo(() => summarise(visibleTimelines), [visibleTimelines]);

  const historyRows = useMemo(
    () =>
      records.filter((r) => {
        if (flockFilter !== ALL && r.batch_id !== flockFilter) return false;
        if (from && r.vaccination_date < from) return false;
        if (to && r.vaccination_date > to) return false;
        return true;
      }),
    [records, flockFilter, from, to],
  );

  if (loading) return null;
  if (!can("health.read")) {
    return (
      <PermissionDenied hint="Vaccination records are available to team members with health access." />
    );
  }
  const writable = can("health.write");
  const deletable = can("health.delete");

  const openRecord = (scheduleId: string | null) => {
    setEditing(null);
    setPresetSchedule(scheduleId);
    setRecordOpen(true);
  };

  const onDelete = async (record: VaccinationRecord) => {
    if (!window.confirm("Remove this vaccination record? It stays in your farm's audit history."))
      return;
    try {
      await removeRecord.mutateAsync(record.id);
      toast.success("Vaccination record removed.");
    } catch {
      toast.error("Could not remove the record.");
    }
  };

  const openStatuses = ["upcoming", "due_soon", "due_today", "overdue", "completed"] as const;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Syringe className="h-3.5 w-3.5" /> Flock Health
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-semibold sm:text-3xl">Vaccination</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plan, record and track flock vaccination programmes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportRecordsButton section="vaccination" />
          {writable && (
            <>
              <Button size="sm" variant="outline" onClick={() => setCustomOpen(true)}>
                <ClipboardList className="mr-2 h-4 w-4" /> Custom programme
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                <CalendarClock className="mr-2 h-4 w-4" /> Assign programme
              </Button>
              <Button size="sm" onClick={() => openRecord(null)}>
                <Plus className="mr-2 h-4 w-4" /> Add vaccination
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Controls */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Control label="Farm">
          <Input value={farm.data?.name ?? "Your farm"} readOnly className="bg-muted/40" />
        </Control>
        <Control label="Flock">
          <Select value={flockFilter} onValueChange={setFlockFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All flocks</SelectItem>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Control>
        <Control label="Programme">
          <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All programmes</SelectItem>
              {(programmesQ.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Control>
        <Control label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Control>
        <Control label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Control>
      </div>

      {/* Summary */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Upcoming" value={stats.upcoming} icon={CalendarClock} />
        <Stat label="Due today" value={stats.dueToday} icon={Syringe} tone="amber" />
        <Stat label="Overdue" value={stats.overdue} icon={AlertTriangle} tone="red" />
        <Stat label="Completed" value={stats.completed} icon={CheckCircle2} tone="green" />
        <Stat label="Total scheduled" value={stats.totalScheduled} icon={ListChecks} />
      </div>

      {stats.totalScheduled > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Metric label="Completion rate" value={`${stats.completionRate.toFixed(0)}%`} />
          <Metric label="On-time rate" value={`${stats.onTimeRate.toFixed(0)}%`} />
          <Metric label="Flocks with overdue" value={String(stats.flocksWithOverdue)} />
        </div>
      )}

      {stats.overdue > 0 && (
        <p className="mt-3 flex gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          AI-supported farm intelligence — vaccination schedule risk signal: {stats.overdue} planned
          vaccination{stats.overdue === 1 ? " is" : "s are"} past their due date across{" "}
          {stats.flocksWithOverdue} flock{stats.flocksWithOverdue === 1 ? "" : "s"}. Review with your
          veterinarian.
        </p>
      )}

      <p className="mt-3 flex gap-2 rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        {VACCINATION_DISCLAIMER}
      </p>

      {/* Timelines */}
      <section className="mt-8 space-y-4">
        <h2 className="font-display text-lg font-semibold">Flock vaccination timeline</h2>

        {!batches.length && (
          <EmptyState
            message="No layer flocks yet. Add a flock in Layer Brooding & Rearing to plan its vaccinations."
          />
        )}

        {visibleTimelines.map((t) => {
          const shown = t.entries.filter(
            (e) => statusFilter === ALL || e.status === statusFilter,
          );
          return (
            <div key={t.batchId} className="rounded-2xl border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{t.batchName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.anchor
                      ? t.anchor.source === "hatch"
                        ? `Schedule calculated from hatch date ${formatDate(t.anchor.date)}.`
                        : `Schedule calculated from placement date ${formatDate(t.anchor.date)}.`
                      : "Add the flock's hatch or placement date to generate its vaccination schedule."}
                    {t.programmeName ? ` · ${t.programmeName}` : ""}
                  </p>
                </div>
                {writable && (
                  <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                    {t.entries.length ? "Change programme" : "Assign programme"}
                  </Button>
                )}
              </div>

              {!t.entries.length ? (
                <div className="p-4">
                  <EmptyState message="No vaccination programme has been assigned to this flock." />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {shown.map((e) => (
                    <li key={e.schedule.id} className="flex flex-wrap items-center gap-3 p-4">
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", STATUS_DOTS[e.status])} />
                      <div className="min-w-[92px] text-sm font-medium">{e.schedule.age_label}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {e.schedule.vaccine} · {e.schedule.disease}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {e.schedule.route} · due {formatDate(e.schedule.scheduled_date)}
                          {e.record ? ` · given ${formatDate(e.record.vaccination_date)}` : ""}
                          {e.variance ? ` · ${e.variance.label}` : ""}
                          {e.record?.at_hatchery ? " · at hatchery" : ""}
                        </p>
                        {isGumboro(e.schedule.disease) && (
                          <p className="mt-1 text-[11px] text-amber-700">{GUMBORO_NOTE}</p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                          STATUS_TONES[e.status],
                        )}
                      >
                        {STATUS_LABELS[e.status]}
                      </span>
                      {writable && !e.record && (
                        <Button size="sm" variant="outline" onClick={() => openRecord(e.schedule.id)}>
                          Record
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      {/* History */}
      <section className="mt-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Vaccination history</h2>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {openStatuses.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!historyRows.length ? (
          <div className="rounded-2xl border border-border p-6">
            <EmptyState message="No vaccination records yet." />
            {writable && (
              <Button className="mt-3" size="sm" onClick={() => openRecord(null)}>
                <Plus className="mr-2 h-4 w-4" /> Record vaccination
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <Th>Date</Th><Th>Flock</Th><Th>Age</Th><Th>Disease</Th><Th>Vaccine</Th>
                  <Th>Batch</Th><Th>Vaccinated</Th><Th>Route</Th><Th>Administrator</Th>
                  <Th>Status</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyRows.map((r) => {
                  const variance = scheduleVariance(r.scheduled_date, r.vaccination_date);
                  return (
                    <tr key={r.id}>
                      <Td>{formatDate(r.vaccination_date)}</Td>
                      <Td>{batches.find((b) => b.id === r.batch_id)?.name ?? "—"}</Td>
                      <Td>{r.bird_age_days != null ? `${r.bird_age_days} d` : "—"}</Td>
                      <Td>{r.disease}</Td>
                      <Td>{r.vaccine}</Td>
                      <Td>{r.batch_number ?? "—"}</Td>
                      <Td>{r.birds_vaccinated?.toLocaleString() ?? "—"}</Td>
                      <Td>{r.route ?? "—"}</Td>
                      <Td>{r.person_responsible ?? r.recorded_by_name ?? "—"}</Td>
                      <Td>
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-700">
                          {variance ? variance.label : "Completed"}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" aria-label="View" onClick={() => setDetail(r)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {writable && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Edit"
                              onClick={() => {
                                setEditing(r);
                                setPresetSchedule(null);
                                setRecordOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {deletable && (
                            <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => onDelete(r)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AssignProgrammeDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        batches={batches}
        programmes={programmesQ.data ?? []}
        items={itemsQ.data ?? []}
        schedules={schedules}
        presetBatchId={flockFilter === ALL ? null : flockFilter}
      />
      <CustomProgrammeDialog open={customOpen} onOpenChange={setCustomOpen} />
      <RecordVaccinationDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        batches={batches}
        schedules={schedules}
        farmName={farm.data?.name ?? "Your farm"}
        editing={editing}
        presetScheduleId={presetSchedule}
      />
      <VaccinationDetailDialog
        record={detail}
        batches={batches}
        farmName={farm.data?.name ?? "Your farm"}
        onOpenChange={(v) => !v && setDetail(null)}
      />
      {rooms.isError && null}
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Syringe;
  tone?: "amber" | "red" | "green";
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "amber" && "text-amber-600",
            tone === "red" && "text-destructive",
            tone === "green" && "text-emerald-600",
          )}
        />
        {label}
      </div>
      <p className="mt-1.5 font-display text-2xl font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-3 py-2">{children}</td>;
}
