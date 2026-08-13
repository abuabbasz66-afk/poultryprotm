// Layer Brooding & Rearing.
//
// A rearing batch is a placement of day-old (or young) layer chicks that is
// tracked from Day 1 through brooding, growing and pullet development until it
// reaches the farm's configured maturity threshold and is transferred into the
// existing Layer Production module (rooms + egg_production).
//
// Rules that must not be broken:
//  1. Age is NEVER stored. It is always derived from the placement date, so a
//     batch grows a day older on its own.
//  2. Nothing here touches existing production / mortality / feed / health
//     records. Rearing records live in their own tables, keyed by batch.
//  3. Target weights, stage boundaries and the reminder schedule are farm
//     configuration — no invented breed standards.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId, useFarmId, invalidateFarm, farmScope } from "@/lib/farm-data";

// ============= TYPES =============

export type LayerBatch = {
  id: string;
  farm_id: string;
  name: string;
  bird_type: string;
  breed: string | null;
  birds_placed: number;
  current_birds: number;
  placement_date: string;
  start_age_days: number;
  room: string | null;
  room_id: string | null;
  source: string | null;
  notes: string | null;
  status: string;
  transferred_at: string | null;
  transferred_room_id: string | null;
  created_at: string;
};

export type LayerDaily = {
  id: string;
  batch_id: string;
  entry_date: string;
  deaths: number;
  death_reason: string | null;
  feed_kg: number;
  feed_type: string | null;
  feed_cost: number;
  water_litres: number;
  avg_weight_g: number | null;
  birds_count: number | null;
  temperature_c: number | null;
  observation: string | null;
  notes: string | null;
};

export type LayerWeight = {
  id: string;
  batch_id: string;
  week: number;
  entry_date: string;
  birds_weighed: number;
  avg_weight_g: number;
  target_weight_g: number | null;
  notes: string | null;
};

export const LAYER_HEALTH_KINDS = ["vaccination", "medication", "observation", "check"] as const;
export type LayerHealthKind = (typeof LAYER_HEALTH_KINDS)[number];

export type LayerHealth = {
  id: string;
  batch_id: string;
  kind: string;
  name: string;
  entry_date: string;
  dosage: string | null;
  administered_by: string | null;
  status: string;
  notes: string | null;
};

export type StageConfig = { key: string; label: string; fromDay: number };
export type ScheduleItem = { key: string; day: number; title: string; kind: string; note?: string };

export type RearingSettings = {
  farm_id: string;
  stages: StageConfig[];
  /** breed (lowercase) -> { week -> target grams }. Farmer-configured only. */
  weight_targets: Record<string, Record<string, number>>;
  schedule: ScheduleItem[];
  maturity_weeks: number;
};

export const DEFAULT_STAGES: StageConfig[] = [
  { key: "day-old", label: "Day-old", fromDay: 0 },
  { key: "brooding", label: "Brooding", fromDay: 1 },
  { key: "grower", label: "Grower", fromDay: 28 },
  { key: "developer", label: "Developer", fromDay: 56 },
  { key: "pre-lay", label: "Pre-Lay", fromDay: 105 },
  { key: "point-of-lay", label: "Point of Lay", fromDay: 126 },
];

export const DEFAULT_MATURITY_WEEKS = 18;

/** Management timeline. Deliberately free of medication instructions. */
export const DEFAULT_SCHEDULE: ScheduleItem[] = [
  { key: "setup", day: 1, title: "Brooding setup check", kind: "task" },
  { key: "wk1", day: 7, title: "Week 1 weight check", kind: "weight" },
  { key: "d14", day: 14, title: "Scheduled management task", kind: "task" },
  { key: "wk3", day: 21, title: "Week 3 weight check", kind: "weight" },
  { key: "brooding-review", day: 28, title: "Brooding-stage review", kind: "stage" },
  { key: "grower", day: 35, title: "Grower transition", kind: "stage" },
  { key: "developer", day: 56, title: "Developer transition", kind: "stage" },
  { key: "wk12", day: 84, title: "Week 12 weight check", kind: "weight" },
  { key: "prelay", day: 112, title: "Pre-lay preparation", kind: "stage" },
];

export const defaultSettings = (farmId: string): RearingSettings => ({
  farm_id: farmId,
  stages: DEFAULT_STAGES,
  weight_targets: {},
  schedule: DEFAULT_SCHEDULE,
  maturity_weeks: DEFAULT_MATURITY_WEEKS,
});

// ============= AGE & STAGE =============

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Age in days today — derived, never stored. */
export function batchAgeDays(
  b: Pick<LayerBatch, "placement_date" | "start_age_days">,
  on: Date = new Date(),
) {
  const start = new Date(`${b.placement_date}T00:00:00`);
  const days = Math.floor((startOfDay(on).getTime() - start.getTime()) / 86_400_000);
  return Math.max(0, days) + (Number(b.start_age_days) || 0);
}

export function ageLabel(days: number) {
  const weeks = Math.floor(days / 7);
  if (days < 7) return `Day ${days + 1}`;
  return `${weeks} ${weeks === 1 ? "Week" : "Weeks"}`;
}

export function ageDetail(days: number) {
  const weeks = Math.floor(days / 7);
  return { days, weeks, label: `${weeks} ${weeks === 1 ? "Week" : "Weeks"} · ${days} Days` };
}

export function stageFor(days: number, stages: StageConfig[] = DEFAULT_STAGES): StageConfig {
  const ordered = [...stages].sort((a, b) => a.fromDay - b.fromDay);
  let cur = ordered[0];
  for (const s of ordered) if (days >= s.fromDay) cur = s;
  return cur;
}

export function stageIndex(days: number, stages: StageConfig[] = DEFAULT_STAGES) {
  const ordered = [...stages].sort((a, b) => a.fromDay - b.fromDay);
  return Math.max(
    0,
    ordered.findIndex((s) => s.key === stageFor(days, ordered).key),
  );
}

export function isReadyForProduction(days: number, maturityWeeks: number) {
  return days >= maturityWeeks * 7;
}

export function progressToLay(days: number, maturityWeeks: number) {
  return Math.max(0, Math.min(100, (days / (maturityWeeks * 7)) * 100));
}

export const LAYER_BATCH_STATUSES = ["rearing", "transferred", "closed"] as const;
export const LAYER_STATUS_LABELS: Record<string, string> = {
  rearing: "Rearing",
  transferred: "In Layer Production",
  closed: "Closed",
};
export const LAYER_STATUS_TONES: Record<string, string> = {
  rearing: "bg-emerald-500/12 text-emerald-700 border-emerald-500/30",
  transferred: "bg-sky-500/12 text-sky-700 border-sky-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

// ============= METRICS =============

export type BatchMetrics = {
  batch: LayerBatch;
  days: number;
  weeks: number;
  ageLabel: string;
  stage: StageConfig;
  stageIdx: number;
  ready: boolean;
  progress: number;
  daily: LayerDaily[];
  weights: LayerWeight[];
  health: LayerHealth[];
  deaths: number;
  mortalityPct: number | null;
  feedKg: number;
  feedToday: number;
  feedWeek: number;
  feedCost: number;
  feedPerBirdKg: number | null;
  waterLitres: number;
  waterToday: number;
  waterPerBird: number | null;
  lastWeight: LayerWeight | null;
  nextMilestone: (ScheduleItem & { inDays: number }) | null;
  nextVaccination: LayerHealth | null;
  growthStatus: string;
};

const sum = (rows: number[]) => rows.reduce((s, n) => s + (Number(n) || 0), 0);
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function computeBatchMetrics(
  batch: LayerBatch,
  allDaily: LayerDaily[],
  allWeights: LayerWeight[],
  allHealth: LayerHealth[],
  settings: RearingSettings,
  on: Date = new Date(),
): BatchMetrics {
  const daily = allDaily.filter((d) => d.batch_id === batch.id);
  const weights = allWeights.filter((w) => w.batch_id === batch.id).sort((a, b) => a.week - b.week);
  const health = allHealth.filter((h) => h.batch_id === batch.id);

  const days = batchAgeDays(batch, on);
  const stages = settings.stages?.length ? settings.stages : DEFAULT_STAGES;
  const today = iso(startOfDay(on));
  const weekAgo = iso(new Date(startOfDay(on).getTime() - 6 * 86_400_000));

  const deaths = sum(daily.map((d) => d.deaths));
  const feedKg = sum(daily.map((d) => d.feed_kg));
  const waterLitres = sum(daily.map((d) => d.water_litres));
  const birds = Math.max(0, batch.current_birds);

  const lastWeight = weights.length ? weights[weights.length - 1] : null;
  const target =
    lastWeight?.target_weight_g ?? targetWeight(settings, batch.breed, lastWeight?.week ?? 0);
  let growthStatus = "No weight recorded";
  if (lastWeight && target) {
    const diff = lastWeight.avg_weight_g - target;
    const pct = (diff / target) * 100;
    growthStatus =
      pct >= 2
        ? "Above target"
        : pct <= -5
          ? "Below target"
          : pct < 0
            ? "Slightly below target"
            : "On target";
  } else if (lastWeight) {
    growthStatus = "No target configured";
  }

  const schedule = settings.schedule?.length ? settings.schedule : DEFAULT_SCHEDULE;
  const next = [...schedule].sort((a, b) => a.day - b.day).find((s) => s.day >= days) ?? null;

  const upcomingVax =
    health
      .filter((h) => h.kind === "vaccination" && h.status !== "done" && h.entry_date >= today)
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date))[0] ?? null;

  return {
    batch,
    days,
    weeks: Math.floor(days / 7),
    ageLabel: ageDetail(days).label,
    stage: stageFor(days, stages),
    stageIdx: stageIndex(days, stages),
    ready: isReadyForProduction(days, settings.maturity_weeks || DEFAULT_MATURITY_WEEKS),
    progress: progressToLay(days, settings.maturity_weeks || DEFAULT_MATURITY_WEEKS),
    daily,
    weights,
    health,
    deaths,
    mortalityPct: batch.birds_placed > 0 ? (deaths / batch.birds_placed) * 100 : null,
    feedKg,
    feedToday: sum(daily.filter((d) => d.entry_date === today).map((d) => d.feed_kg)),
    feedWeek: sum(daily.filter((d) => d.entry_date >= weekAgo).map((d) => d.feed_kg)),
    feedCost: sum(daily.map((d) => d.feed_cost)),
    feedPerBirdKg: birds > 0 ? feedKg / birds : null,
    waterLitres,
    waterToday: sum(daily.filter((d) => d.entry_date === today).map((d) => d.water_litres)),
    waterPerBird: birds > 0 ? waterLitres / birds : null,
    lastWeight,
    nextMilestone: next ? { ...next, inDays: next.day - days } : null,
    nextVaccination: upcomingVax,
    growthStatus,
  };
}

/** Farmer-configured target for a breed/week. Returns null when not configured. */
export function targetWeight(
  settings: RearingSettings,
  breed: string | null | undefined,
  week: number,
): number | null {
  const table =
    settings.weight_targets?.[(breed ?? "").trim().toLowerCase()] ??
    settings.weight_targets?.["default"];
  const v = table?.[String(week)];
  return Number.isFinite(Number(v)) ? Number(v) : null;
}

/** Remaining birds after each recorded mortality entry, newest first. */
export function mortalityLedger(m: BatchMetrics) {
  const rows = [...m.daily]
    .filter((d) => d.deaths > 0)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  let alive = m.batch.birds_placed;
  const out = rows.map((r) => {
    alive = Math.max(0, alive - r.deaths);
    return { ...r, remaining: alive };
  });
  return out.reverse();
}

/** Water-pattern watch: flags a day that deviates strongly from the recent mean. */
export function waterAlerts(m: BatchMetrics) {
  const rows = [...m.daily]
    .filter((d) => d.water_litres > 0)
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
    .slice(0, 8);
  if (rows.length < 4) return [] as { date: string; change: number }[];
  const [latest, ...rest] = rows;
  const mean = sum(rest.map((r) => r.water_litres)) / rest.length;
  if (!mean) return [];
  const change = ((latest.water_litres - mean) / mean) * 100;
  return Math.abs(change) >= 20 ? [{ date: latest.entry_date, change }] : [];
}

/** Age-driven notifications. Kept sparse on purpose. */
export function batchNotifications(m: BatchMetrics, settings: RearingSettings): string[] {
  const out: string[] = [];
  const maturity = (settings.maturity_weeks || DEFAULT_MATURITY_WEEKS) * 7;
  if (m.batch.status !== "rearing") return out;
  if (m.days === 7) out.push(`${m.batch.name} is 7 days old.`);
  if (m.days > 0 && m.days % 7 === 0)
    out.push(`${m.batch.name}: weekly weight check is due (Week ${m.weeks}).`);
  if (m.days >= 21 && m.days < 28)
    out.push(`${m.batch.name} is approaching the end of the brooding stage.`);
  if (m.days >= 28 && m.days < 31) out.push(`${m.batch.name} has entered the grower stage.`);
  if (m.days >= 98 && m.days < 105) out.push(`${m.batch.name} is approaching the pre-lay stage.`);
  if (m.days >= maturity - 14 && m.days < maturity)
    out.push(`${m.batch.name} is approaching point of lay.`);
  if (m.days >= maturity)
    out.push(`${m.batch.name} is ready — prepare the flock for transfer to Layer Production.`);
  return out;
}

// ============= READS =============

export function useLayerBatches() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "layer-batches"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<LayerBatch[]> => {
      const { data, error } = await supabase
        .from("layer_batches")
        .select(
          "id, farm_id, name, bird_type, breed, birds_placed, current_birds, placement_date, start_age_days, room, room_id, source, notes, status, transferred_at, transferred_room_id, created_at",
        )
        .eq("farm_id", farmId!)
        .order("placement_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LayerBatch[];
    },
  });
}

export function useLayerDaily() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "layer-daily"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<LayerDaily[]> => {
      const { data, error } = await supabase
        .from("layer_batch_daily")
        .select(
          "id, batch_id, entry_date, deaths, death_reason, feed_kg, feed_type, feed_cost, water_litres, avg_weight_g, birds_count, temperature_c, observation, notes",
        )
        .eq("farm_id", farmId!)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LayerDaily[];
    },
  });
}

export function useLayerWeights() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "layer-weights"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<LayerWeight[]> => {
      const { data, error } = await supabase
        .from("layer_batch_weights")
        .select(
          "id, batch_id, week, entry_date, birds_weighed, avg_weight_g, target_weight_g, notes",
        )
        .eq("farm_id", farmId!)
        .order("week", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LayerWeight[];
    },
  });
}

export function useLayerHealth() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "layer-health"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<LayerHealth[]> => {
      const { data, error } = await supabase
        .from("layer_batch_health")
        .select("id, batch_id, kind, name, entry_date, dosage, administered_by, status, notes")
        .eq("farm_id", farmId!)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LayerHealth[];
    },
  });
}

export function useRearingSettings() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "layer-rearing-settings"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<RearingSettings> => {
      const { data, error } = await supabase
        .from("layer_rearing_settings")
        .select("farm_id, stages, weight_targets, schedule, maturity_weeks")
        .eq("farm_id", farmId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return defaultSettings(farmId!);
      const s = data as unknown as RearingSettings;
      return {
        farm_id: farmId!,
        stages: Array.isArray(s.stages) && s.stages.length ? s.stages : DEFAULT_STAGES,
        weight_targets: (s.weight_targets ?? {}) as RearingSettings["weight_targets"],
        schedule: Array.isArray(s.schedule) && s.schedule.length ? s.schedule : DEFAULT_SCHEDULE,
        maturity_weeks: s.maturity_weeks || DEFAULT_MATURITY_WEEKS,
      };
    },
  });
}

// ============= WRITES =============

function useCtx() {
  const { data: userId } = useAuthUserId();
  const { data: farmId } = useFarmId();
  return { userId: userId ?? null, farmId: farmId ?? null };
}

export function useAddLayerBatch() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: {
      name: string;
      breed?: string | null;
      birds_placed: number;
      placement_date: string;
      start_age_days?: number;
      room?: string | null;
      source?: string | null;
      notes?: string | null;
    }) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const { error } = await supabase.from("layer_batches").insert({
        farm_id: farmId,
        name: input.name.trim(),
        bird_type: "Layer",
        breed: input.breed?.trim() || null,
        birds_placed: input.birds_placed,
        current_birds: input.birds_placed,
        placement_date: input.placement_date,
        start_age_days: input.start_age_days ?? 0,
        room: input.room?.trim() || null,
        source: input.source?.trim() || null,
        notes: input.notes?.trim() || null,
        status: "rearing",
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdateLayerBatch() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (
      input: { id: string } & Partial<Omit<LayerBatch, "id" | "farm_id" | "created_at">>,
    ) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("layer_batches").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteLayerBatch() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("layer_batches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useRecordLayerDaily() {
  const qc = useQueryClient();
  const { farmId, userId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: {
      batch_id: string;
      entry_date: string;
      deaths: number;
      death_reason?: string | null;
      feed_kg: number;
      feed_type?: string | null;
      feed_cost?: number;
      water_litres: number;
      avg_weight_g?: number | null;
      birds_count?: number | null;
      temperature_c?: number | null;
      observation?: string | null;
      notes?: string | null;
      /** Birds alive before this entry, so the head-count stays in step. */
      current_birds: number;
    }) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const { error } = await supabase.from("layer_batch_daily").insert({
        farm_id: farmId,
        batch_id: input.batch_id,
        entry_date: input.entry_date,
        deaths: input.deaths,
        death_reason: input.death_reason?.trim() || null,
        feed_kg: input.feed_kg,
        feed_type: input.feed_type?.trim() || null,
        feed_cost: input.feed_cost ?? 0,
        water_litres: input.water_litres,
        avg_weight_g: input.avg_weight_g ?? null,
        birds_count: input.birds_count ?? null,
        temperature_c: input.temperature_c ?? null,
        observation: input.observation?.trim() || null,
        notes: input.notes?.trim() || null,
        recorded_by: userId,
      });
      if (error) throw error;

      if (input.deaths > 0) {
        const next = Math.max(0, input.current_birds - input.deaths);
        const { error: upErr } = await supabase
          .from("layer_batches")
          .update({ current_birds: next })
          .eq("id", input.batch_id);
        if (upErr) throw upErr;
      }
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteLayerDaily() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("layer_batch_daily").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useRecordLayerWeight() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: {
      batch_id: string;
      week: number;
      entry_date: string;
      birds_weighed: number;
      avg_weight_g: number;
      target_weight_g?: number | null;
      notes?: string | null;
    }) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const { error } = await supabase.from("layer_batch_weights").upsert(
        {
          farm_id: farmId,
          batch_id: input.batch_id,
          week: input.week,
          entry_date: input.entry_date,
          birds_weighed: input.birds_weighed,
          avg_weight_g: input.avg_weight_g,
          target_weight_g: input.target_weight_g ?? null,
          notes: input.notes?.trim() || null,
        },
        { onConflict: "batch_id,week" },
      );
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteLayerWeight() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("layer_batch_weights").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useRecordLayerHealth() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: {
      batch_id: string;
      kind: string;
      name: string;
      entry_date: string;
      dosage?: string | null;
      administered_by?: string | null;
      status?: string;
      notes?: string | null;
    }) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const { error } = await supabase.from("layer_batch_health").insert({
        farm_id: farmId,
        batch_id: input.batch_id,
        kind: input.kind,
        name: input.name.trim(),
        entry_date: input.entry_date,
        dosage: input.dosage?.trim() || null,
        administered_by: input.administered_by?.trim() || null,
        status: input.status ?? "done",
        notes: input.notes?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteLayerHealth() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("layer_batch_health").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useSaveRearingSettings() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: Partial<Omit<RearingSettings, "farm_id">>) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const { error } = await supabase.from("layer_rearing_settings").upsert(
        {
          farm_id: farmId,
          ...(input.stages ? { stages: input.stages } : {}),
          ...(input.schedule ? { schedule: input.schedule } : {}),
          ...(input.weight_targets ? { weight_targets: input.weight_targets } : {}),
          ...(input.maturity_weeks ? { maturity_weeks: input.maturity_weeks } : {}),
        } as never,
        { onConflict: "farm_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

/**
 * Transfer a matured rearing batch into the existing Layer Production module.
 * The flock is NOT duplicated: a production room is created (or an existing one
 * linked) and the batch is marked "transferred" and linked to that room. Every
 * rearing record stays attached to the batch, so the full history is preserved.
 */
export function useTransferToProduction() {
  const qc = useQueryClient();
  const { farmId } = useCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: {
      batch: LayerBatch;
      roomName?: string;
      existingRoomId?: string | null;
    }) => {
      if (!farmId) throw new Error("No farm found for this user.");
      let roomId = input.existingRoomId ?? null;

      if (!roomId) {
        const { data, error } = await supabase
          .from("rooms")
          .insert({
            farm_id: farmId,
            name: (input.roomName ?? input.batch.name).trim(),
            current: input.batch.current_birds,
            initial: input.batch.birds_placed,
            status: "active",
            bird_type: "Layer",
            breed: input.batch.breed,
            date_stocked: input.batch.placement_date,
            age_status: "recorded",
            age_anchor_date: input.batch.placement_date,
            age_recorded_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw error;
        roomId = data.id as string;
      } else {
        const { error } = await supabase
          .from("rooms")
          .update({
            current: input.batch.current_birds,
            bird_type: "Layer",
            breed: input.batch.breed,
            age_status: "recorded",
            age_anchor_date: input.batch.placement_date,
            age_recorded_at: new Date().toISOString(),
          })
          .eq("id", roomId);
        if (error) throw error;
      }

      const { error: bErr } = await supabase
        .from("layer_batches")
        .update({
          status: "transferred",
          transferred_at: new Date().toISOString(),
          transferred_room_id: roomId,
          room_id: roomId,
        })
        .eq("id", input.batch.id);
      if (bErr) throw bErr;
      return roomId;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}
