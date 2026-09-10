// Layer Vaccination Programme & Recording.
//
// Rules that must not be broken:
//  1. A schedule is always DERIVED from the flock's hatch date (preferred) or
//     placement date. No calendar date is ever hard-coded.
//  2. A scheduled vaccination is only "completed" when a real record exists
//     against it — never because its date has passed.
//  3. Scheduled date and actual date are stored separately and never merged.
//  4. Assigning a programme snapshots the programme name + version onto the
//     flock schedule, so later edits to a programme never rewrite history.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId, useFarmId, invalidateFarm, farmScope } from "@/lib/farm-data";
import { useFarmContext } from "@/lib/rbac";

// ============= CONSTANTS =============

export const BASELINE_PROGRAMME_NAME = "Recommended Nigerian Layer Baseline";

export const VACCINATION_DISCLAIMER =
  "Vaccination schedules may vary according to maternal antibody levels, vaccine type, local disease pressure, farm history and veterinary recommendations. PoultryPro supports your record keeping — it does not replace your veterinarian.";

export const GUMBORO_NOTE =
  "Gumboro vaccination timing may need adjustment based on maternal antibody levels, vaccine type, local disease pressure and veterinary guidance.";

export const ROUTES = [
  "Hatchery Injection",
  "Oral",
  "Drinking Water",
  "Eye Drop",
  "Wing Web",
  "Subcutaneous",
  "Intramuscular",
  "Spray",
] as const;

/** Days ahead of the due date at which a vaccination starts showing as due soon. */
export const REMINDER_WINDOW_DAYS = 3;

export function isGumboro(disease: string | null | undefined) {
  return /gumboro|ibd/i.test(disease ?? "");
}

// ============= TYPES =============

export type VaccinationProgramme = {
  id: string;
  farm_id: string | null;
  name: string;
  bird_type: string;
  version: number;
  is_baseline: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProgrammeItem = {
  id: string;
  programme_id: string;
  farm_id: string | null;
  sequence: number;
  age_days: number;
  age_label: string;
  disease: string;
  vaccine: string;
  route: string;
  note: string | null;
};

export type FlockSchedule = {
  id: string;
  farm_id: string;
  batch_id: string;
  programme_id: string;
  programme_item_id: string | null;
  programme_name: string;
  programme_version: number;
  sequence: number;
  age_days: number;
  age_label: string;
  disease: string;
  vaccine: string;
  route: string;
  note: string | null;
  scheduled_date: string;
  anchor_source: string;
  status: string;
};

export type VaccinationRecord = {
  id: string;
  farm_id: string;
  batch_id: string | null;
  schedule_id: string | null;
  programme_id: string | null;
  room_id: string | null;
  bird_type: string;
  disease: string;
  vaccine: string;
  scheduled_date: string | null;
  vaccination_date: string;
  bird_age_days: number | null;
  birds_present: number | null;
  birds_vaccinated: number | null;
  batch_number: string | null;
  manufacturer: string | null;
  expiry_date: string | null;
  route: string | null;
  administration_method: string | null;
  dose: string | null;
  water_volume_litres: number | null;
  person_responsible: string | null;
  veterinarian: string | null;
  notes: string | null;
  at_hatchery: boolean;
  hatchery_name: string | null;
  recorded_by: string | null;
  recorded_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type ScheduleStatus =
  | "completed"
  | "overdue"
  | "due_today"
  | "due_soon"
  | "upcoming"
  | "not_applicable";

export const STATUS_LABELS: Record<ScheduleStatus, string> = {
  completed: "Completed",
  overdue: "Overdue",
  due_today: "Due today",
  due_soon: "Due soon",
  upcoming: "Upcoming",
  not_applicable: "Not applicable",
};

export const STATUS_TONES: Record<ScheduleStatus, string> = {
  completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  overdue: "bg-destructive/15 text-destructive border-destructive/30",
  due_today: "bg-amber-500/20 text-amber-800 border-amber-500/40",
  due_soon: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  upcoming: "bg-muted text-muted-foreground border-border",
  not_applicable: "bg-muted text-muted-foreground border-border",
};

export const STATUS_DOTS: Record<ScheduleStatus, string> = {
  completed: "bg-emerald-500",
  overdue: "bg-destructive",
  due_today: "bg-amber-500",
  due_soon: "bg-amber-400",
  upcoming: "bg-muted-foreground/40",
  not_applicable: "bg-muted-foreground/30",
};

// ============= DATE MATHS =============

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Local YYYY-MM-DD for today. */
export function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Adds days to a YYYY-MM-DD key without timezone drift. */
export function addDays(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return todayKey(dt);
}

/** Whole days between two YYYY-MM-DD keys (b - a). */
export function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = Date.UTC(ay, (am ?? 1) - 1, ad ?? 1);
  const db = Date.UTC(by, (bm ?? 1) - 1, bd ?? 1);
  return Math.round((db - da) / 86_400_000);
}

/** Day 1 is the hatch/placement day itself, so Day N = anchor + (N - 1). */
export function dueDateFor(anchorDate: string, ageDays: number) {
  return addDays(anchorDate, Math.max(0, ageDays - 1));
}

export type Anchor = { date: string; source: "hatch" | "placement" } | null;

export function flockAnchor(batch: {
  hatch_date?: string | null;
  placement_date?: string | null;
}): Anchor {
  if (batch.hatch_date) return { date: batch.hatch_date.slice(0, 10), source: "hatch" };
  if (batch.placement_date) return { date: batch.placement_date.slice(0, 10), source: "placement" };
  return null;
}

export function formatDate(key: string | null | undefined) {
  if (!key) return "—";
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ============= STATUS =============

export function scheduleStatus(
  schedule: Pick<FlockSchedule, "scheduled_date" | "status">,
  record: VaccinationRecord | undefined,
  today = todayKey(),
): ScheduleStatus {
  if (record) return "completed";
  if (schedule.status === "not_applicable") return "not_applicable";
  const diff = daysBetween(today, schedule.scheduled_date.slice(0, 10));
  if (diff < 0) return "overdue";
  if (diff === 0) return "due_today";
  if (diff <= REMINDER_WINDOW_DAYS) return "due_soon";
  return "upcoming";
}

export type Variance = { days: number; label: string; tone: "early" | "on" | "late" };

export function scheduleVariance(
  scheduledDate: string | null | undefined,
  actualDate: string | null | undefined,
): Variance | null {
  if (!scheduledDate || !actualDate) return null;
  const days = daysBetween(scheduledDate.slice(0, 10), actualDate.slice(0, 10));
  if (days === 0) return { days, label: "On schedule", tone: "on" };
  if (days < 0)
    return { days, label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} early`, tone: "early" };
  return { days, label: `${days} day${days === 1 ? "" : "s"} late`, tone: "late" };
}

// ============= READS =============

const SCHEDULE_COLS =
  "id, farm_id, batch_id, programme_id, programme_item_id, programme_name, programme_version, sequence, age_days, age_label, disease, vaccine, route, note, scheduled_date, anchor_source, status";

const RECORD_COLS =
  "id, farm_id, batch_id, schedule_id, programme_id, room_id, bird_type, disease, vaccine, scheduled_date, vaccination_date, bird_age_days, birds_present, birds_vaccinated, batch_number, manufacturer, expiry_date, route, administration_method, dose, water_volume_litres, person_responsible, veterinarian, notes, at_hatchery, hatchery_name, recorded_by, recorded_by_name, created_at, updated_at";

export function useVaccinationProgrammes() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "vaccination-programmes"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<VaccinationProgramme[]> => {
      const { data, error } = await supabase
        .from("vaccination_programmes")
        .select(
          "id, farm_id, name, bird_type, version, is_baseline, is_active, notes, created_at, updated_at",
        )
        .or(`farm_id.is.null,farm_id.eq.${farmId}`)
        .eq("is_active", true)
        .order("is_baseline", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as VaccinationProgramme[];
    },
  });
}

export function useProgrammeItems() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "vaccination-programme-items"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<ProgrammeItem[]> => {
      const { data, error } = await supabase
        .from("vaccination_programme_items")
        .select("id, programme_id, farm_id, sequence, age_days, age_label, disease, vaccine, route, note")
        .or(`farm_id.is.null,farm_id.eq.${farmId}`)
        .order("sequence");
      if (error) throw error;
      return (data ?? []) as ProgrammeItem[];
    },
  });
}

export function useFlockSchedules() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "vaccination-schedules"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<FlockSchedule[]> => {
      const { data, error } = await supabase
        .from("flock_vaccination_schedules")
        .select(SCHEDULE_COLS)
        .eq("farm_id", farmId!)
        .order("scheduled_date");
      if (error) throw error;
      return (data ?? []) as FlockSchedule[];
    },
  });
}

export function useVaccinationRecords() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "vaccination-records"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<VaccinationRecord[]> => {
      const { data, error } = await supabase
        .from("vaccination_records")
        .select(RECORD_COLS)
        .eq("farm_id", farmId!)
        .is("deleted_at", null)
        .order("vaccination_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VaccinationRecord[];
    },
  });
}

// ============= WRITES =============

function useCtx() {
  const { data: farmId } = useFarmId();
  const { data: userId } = useAuthUserId();
  const { data: ctx } = useFarmContext();
  return { farmId: farmId ?? null, userId: userId ?? null, actorName: ctx?.fullName ?? null };
}

export type AssignInput = {
  batchId: string;
  programmeId: string;
  programmeName: string;
  programmeVersion: number;
  anchor: { date: string; source: "hatch" | "placement" };
  items: ProgrammeItem[];
  /** Replace an existing schedule for this flock+programme. */
  replace?: boolean;
};

export function useAssignProgramme() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: AssignInput) => {
      if (!farmId) throw new Error("No farm selected.");
      if (input.replace) {
        const { error: delErr } = await supabase
          .from("flock_vaccination_schedules")
          .delete()
          .eq("batch_id", input.batchId)
          .eq("programme_id", input.programmeId);
        if (delErr) throw delErr;
      }
      const rows = input.items.map((item) => ({
        farm_id: farmId,
        batch_id: input.batchId,
        programme_id: input.programmeId,
        programme_item_id: item.id,
        programme_name: input.programmeName,
        programme_version: input.programmeVersion,
        sequence: item.sequence,
        age_days: item.age_days,
        age_label: item.age_label,
        disease: item.disease,
        vaccine: item.vaccine,
        route: item.route,
        note: item.note,
        scheduled_date: dueDateFor(input.anchor.date, item.age_days),
        anchor_source: input.anchor.source,
      }));
      const { error } = await supabase.from("flock_vaccination_schedules").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useRemoveFlockProgramme() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: { batchId: string; programmeId: string }) => {
      const { error } = await supabase
        .from("flock_vaccination_schedules")
        .delete()
        .eq("batch_id", input.batchId)
        .eq("programme_id", input.programmeId);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export type RecordInput = {
  id?: string;
  batch_id: string | null;
  schedule_id: string | null;
  programme_id: string | null;
  room_id: string | null;
  bird_type: string;
  disease: string;
  vaccine: string;
  scheduled_date: string | null;
  vaccination_date: string;
  bird_age_days: number | null;
  birds_present: number | null;
  birds_vaccinated: number | null;
  batch_number: string | null;
  manufacturer: string | null;
  expiry_date: string | null;
  route: string | null;
  administration_method: string | null;
  dose: string | null;
  water_volume_litres: number | null;
  person_responsible: string | null;
  veterinarian: string | null;
  notes: string | null;
  at_hatchery: boolean;
  hatchery_name: string | null;
};

export function useSaveVaccinationRecord() {
  const qc = useQueryClient();
  const { farmId, userId, actorName } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: RecordInput) => {
      if (!farmId) throw new Error("No farm selected.");
      const { id, ...rest } = input;
      if (id) {
        const { error } = await supabase.from("vaccination_records").update(rest).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("vaccination_records").insert({
        ...rest,
        farm_id: farmId,
        recorded_by: userId,
        recorded_by_name: actorName,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

/** Soft delete — the row stays for audit, and disappears from every read. */
export function useDeleteVaccinationRecord() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vaccination_records")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export type CustomProgrammeInput = {
  name: string;
  bird_type: string;
  notes: string | null;
  items: {
    age_days: number;
    age_label: string;
    disease: string;
    vaccine: string;
    route: string;
    note: string | null;
  }[];
};

export function useCreateCustomProgramme() {
  const qc = useQueryClient();
  const { farmId, userId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: CustomProgrammeInput) => {
      if (!farmId) throw new Error("No farm selected.");
      const { data, error } = await supabase
        .from("vaccination_programmes")
        .insert({
          farm_id: farmId,
          name: input.name.trim(),
          bird_type: input.bird_type,
          notes: input.notes,
          is_baseline: false,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      const rows = input.items.map((item, i) => ({
        programme_id: data.id as string,
        farm_id: farmId,
        sequence: i + 1,
        age_days: item.age_days,
        age_label: item.age_label,
        disease: item.disease,
        vaccine: item.vaccine,
        route: item.route,
        note: item.note,
      }));
      if (rows.length) {
        const { error: itemErr } = await supabase.from("vaccination_programme_items").insert(rows);
        if (itemErr) throw itemErr;
      }
      return data.id as string;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

// ============= DERIVED VIEWS =============

export type TimelineEntry = {
  schedule: FlockSchedule;
  record: VaccinationRecord | undefined;
  status: ScheduleStatus;
  variance: Variance | null;
};

export type FlockTimeline = {
  batchId: string;
  batchName: string;
  anchor: Anchor;
  programmeName: string | null;
  entries: TimelineEntry[];
};

export function buildTimelines(
  batches: { id: string; name: string; hatch_date?: string | null; placement_date?: string | null }[],
  schedules: FlockSchedule[],
  records: VaccinationRecord[],
  today = todayKey(),
): FlockTimeline[] {
  const byBatch = new Map<string, FlockSchedule[]>();
  for (const s of schedules) {
    const list = byBatch.get(s.batch_id) ?? [];
    list.push(s);
    byBatch.set(s.batch_id, list);
  }
  const recordBySchedule = new Map<string, VaccinationRecord>();
  for (const r of records) {
    if (!r.schedule_id) continue;
    const existing = recordBySchedule.get(r.schedule_id);
    if (!existing || r.vaccination_date < existing.vaccination_date)
      recordBySchedule.set(r.schedule_id, r);
  }

  return batches.map((b) => {
    const list = (byBatch.get(b.id) ?? []).sort((x, y) => x.sequence - y.sequence);
    const entries: TimelineEntry[] = list.map((s) => {
      const record = recordBySchedule.get(s.id);
      return {
        schedule: s,
        record,
        status: scheduleStatus(s, record, today),
        variance: record ? scheduleVariance(s.scheduled_date, record.vaccination_date) : null,
      };
    });
    return {
      batchId: b.id,
      batchName: b.name,
      anchor: flockAnchor(b),
      programmeName: list[0]?.programme_name ?? null,
      entries,
    };
  });
}

export type VaccinationStats = {
  upcoming: number;
  dueToday: number;
  dueSoon: number;
  overdue: number;
  completed: number;
  totalScheduled: number;
  completionRate: number;
  onTimeRate: number;
  flocksWithOverdue: number;
};

export function summarise(timelines: FlockTimeline[]): VaccinationStats {
  let upcoming = 0, dueToday = 0, dueSoon = 0, overdue = 0, completed = 0, total = 0, onTime = 0;
  let flocksWithOverdue = 0;
  for (const t of timelines) {
    let hasOverdue = false;
    for (const e of t.entries) {
      if (e.status === "not_applicable") continue;
      total += 1;
      if (e.status === "completed") {
        completed += 1;
        if ((e.variance?.days ?? 0) <= 0) onTime += 1;
      } else if (e.status === "overdue") {
        overdue += 1;
        hasOverdue = true;
      } else if (e.status === "due_today") dueToday += 1;
      else if (e.status === "due_soon") dueSoon += 1;
      else upcoming += 1;
    }
    if (hasOverdue) flocksWithOverdue += 1;
  }
  return {
    upcoming,
    dueToday,
    dueSoon,
    overdue,
    completed,
    totalScheduled: total,
    completionRate: total ? (completed / total) * 100 : 0,
    onTimeRate: completed ? (onTime / completed) * 100 : 0,
    flocksWithOverdue,
  };
}

export type VaccinationReminder = {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
};

/** Plain-language reminders reused by the dashboard and Today's Farm. */
export function buildReminders(timelines: FlockTimeline[]): VaccinationReminder[] {
  const out: VaccinationReminder[] = [];
  const today = todayKey();
  for (const t of timelines) {
    for (const e of t.entries) {
      if (e.status === "overdue") {
        out.push({
          id: e.schedule.id,
          severity: "critical",
          message: `${t.batchName} has an overdue ${e.schedule.vaccine} (${e.schedule.disease}) vaccination from ${formatDate(e.schedule.scheduled_date)}.`,
        });
      } else if (e.status === "due_today") {
        out.push({
          id: e.schedule.id,
          severity: "warning",
          message: `${t.batchName} has ${e.schedule.vaccine} (${e.schedule.disease}) vaccination due today.`,
        });
      } else if (e.status === "due_soon") {
        const days = daysBetween(today, e.schedule.scheduled_date.slice(0, 10));
        out.push({
          id: e.schedule.id,
          severity: "info",
          message: `${t.batchName} has ${e.schedule.vaccine} (${e.schedule.disease}) vaccination due in ${days} day${days === 1 ? "" : "s"}.`,
        });
      }
    }
  }
  const rank = { critical: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Farm-wide vaccination reminders, ready for the dashboard / action centre. */
export function useVaccinationReminders(
  batches: { id: string; name: string; hatch_date?: string | null; placement_date?: string | null }[] | undefined,
) {
  const schedulesQ = useFlockSchedules();
  const recordsQ = useVaccinationRecords();
  return useMemo(() => {
    if (!batches?.length) return [] as VaccinationReminder[];
    const timelines = buildTimelines(batches, schedulesQ.data ?? [], recordsQ.data ?? []);
    return buildReminders(timelines);
  }, [batches, schedulesQ.data, recordsQ.data]);
}
