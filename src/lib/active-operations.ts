// Active Flock Operations — a pure, read-only view over the existing layer
// rearing and broiler batch records. Nothing here stores data: age, stage and
// reminders are derived from the batch's own placement date and records.
import {
  batchAgeDays as layerAgeDays,
  stageFor,
  DEFAULT_STAGES,
  DEFAULT_SCHEDULE,
  DEFAULT_MATURITY_WEEKS,
  type LayerBatch,
  type LayerDaily,
  type LayerHealth,
  type RearingSettings,
} from "@/lib/layer-rearing";
import { batchAgeDays as broilerAgeDays, type BroilerBatch, type BroilerDaily } from "@/lib/broiler-data";

export type OperationKind = "layer-brooding" | "layer-rearing" | "broiler-brooding" | "broiler-rearing";
export type OperationStatus = "Active" | "Attention Required";

export const OPERATION_LABELS: Record<OperationKind, string> = {
  "layer-brooding": "Layer Brooding",
  "layer-rearing": "Layer Rearing",
  "broiler-brooding": "Broiler Brooding",
  "broiler-rearing": "Broiler Rearing",
};

/** Broiler records carry no stage field; brooding is read as the first 21 days. */
export const BROILER_BROODING_DAYS = 21;

export type OperationReminder = { kind: "vaccination" | "milestone" | "records" | "weight" | "transition"; text: string; overdue?: boolean };

export type ActiveOperation = {
  id: string;
  kind: OperationKind;
  species: "layer" | "broiler";
  name: string;
  category: string;
  birdsPlaced: number;
  liveBirds: number;
  ageDays: number;
  ageText: string;
  startDate: string;
  stageLabel: string;
  location: string | null;
  nextMilestone: string | null;
  status: OperationStatus;
  reminders: OperationReminder[];
};

export function formatAge(days: number): string {
  const d = Math.max(0, Math.floor(days));
  if (d < 7) return `${d} ${d === 1 ? "day" : "days"} old`;
  const w = Math.floor(d / 7);
  const r = d % 7;
  const wk = `${w} ${w === 1 ? "week" : "weeks"}`;
  return r ? `${wk} and ${r} ${r === 1 ? "day" : "days"} old` : `${wk} old`;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgoIso = (on: Date, n: number) => iso(new Date(on.getFullYear(), on.getMonth(), on.getDate() - n));

function recordsReminder(lastEntry: string | undefined, on: Date): OperationReminder | null {
  if (!lastEntry) return { kind: "records", text: "No daily record yet — log feed, water and mortality", overdue: true };
  if (lastEntry < daysAgoIso(on, 1)) return { kind: "records", text: `Last daily record ${lastEntry} — update feed, water and mortality`, overdue: true };
  return null;
}

export function buildActiveOperations(input: {
  layerBatches: LayerBatch[];
  layerDaily: LayerDaily[];
  layerHealth: LayerHealth[];
  layerSettings: RearingSettings | null | undefined;
  broilerBatches: BroilerBatch[];
  broilerDaily: BroilerDaily[];
  on?: Date;
}): ActiveOperation[] {
  const on = input.on ?? new Date();
  const today = iso(on);
  const out: ActiveOperation[] = [];
  const stages = input.layerSettings?.stages?.length ? input.layerSettings.stages : DEFAULT_STAGES;
  const schedule = input.layerSettings?.schedule?.length ? input.layerSettings.schedule : DEFAULT_SCHEDULE;
  const maturityDays = (input.layerSettings?.maturity_weeks || DEFAULT_MATURITY_WEEKS) * 7;
  const firstRearing = [...stages].sort((a, b) => a.fromDay - b.fromDay).find((s) => s.fromDay > 1 && !/brood|day-old/i.test(s.key + s.label));

  // Layers: only batches still in the rearing workflow (transferred/closed leave the overview).
  for (const b of input.layerBatches) {
    if (b.status !== "rearing") continue;
    const days = layerAgeDays(b, on);
    const stage = stageFor(days, stages);
    const brooding = firstRearing ? days < firstRearing.fromDay : /brood|day-old/i.test(stage.key);
    const reminders: OperationReminder[] = [];
    const health = input.layerHealth.filter((h) => h.batch_id === b.id && h.kind === "vaccination" && h.status !== "done");
    const overdueVax = health.filter((h) => h.entry_date < today);
    const nextVax = health.filter((h) => h.entry_date >= today).sort((x, y) => x.entry_date.localeCompare(y.entry_date))[0];
    for (const h of overdueVax) reminders.push({ kind: "vaccination", text: `${h.name} was scheduled ${h.entry_date}`, overdue: true });
    if (nextVax) reminders.push({ kind: "vaccination", text: `${nextVax.name} scheduled ${nextVax.entry_date}` });
    const next = [...schedule].sort((x, y) => x.day - y.day).find((s) => s.day >= days) ?? null;
    if (next) reminders.push({ kind: next.kind === "weight" ? "weight" : "milestone", text: next.day === days ? `${next.title} — today` : `${next.title} in ${next.day - days} days` });
    if (brooding && firstRearing && firstRearing.fromDay - days <= 7)
      reminders.push({ kind: "transition", text: `Moves into ${firstRearing.label} stage in ${firstRearing.fromDay - days} days` });
    if (days >= maturityDays - 14)
      reminders.push({ kind: "transition", text: days >= maturityDays ? "Ready for transfer to Layer Production" : `Point of lay in ${maturityDays - days} days` });
    const last = input.layerDaily.filter((d) => d.batch_id === b.id).map((d) => d.entry_date).sort().pop();
    const rec = recordsReminder(last, on);
    if (rec) reminders.push(rec);
    out.push({
      id: b.id,
      kind: brooding ? "layer-brooding" : "layer-rearing",
      species: "layer",
      name: b.name,
      category: [b.bird_type || "Layer", b.breed].filter(Boolean).join(" · "),
      birdsPlaced: b.birds_placed,
      liveBirds: Math.max(0, b.current_birds),
      ageDays: days,
      ageText: formatAge(days),
      startDate: b.placement_date,
      stageLabel: stage.label,
      location: b.room,
      nextMilestone: next ? `${next.title} · Day ${next.day}` : null,
      status: reminders.some((r) => r.overdue) ? "Attention Required" : "Active",
      reminders,
    });
  }

  for (const b of input.broilerBatches) {
    if ((b.status ?? "active") !== "active") continue;
    const days = broilerAgeDays(b.date_placed, on);
    const brooding = days < BROILER_BROODING_DAYS;
    const reminders: OperationReminder[] = [];
    if (brooding && BROILER_BROODING_DAYS - days <= 7)
      reminders.push({ kind: "transition", text: `Brooding phase ends in ${BROILER_BROODING_DAYS - days} days` });
    const daily = input.broilerDaily.filter((d) => d.batch_id === b.id);
    const lastWeigh = daily.filter((d) => Number(d.avg_weight_g) > 0).map((d) => d.entry_date).sort().pop();
    if (!lastWeigh || lastWeigh < daysAgoIso(on, 7)) reminders.push({ kind: "weight", text: "No weight recorded in the last 7 days" });
    const rec = recordsReminder(daily.map((d) => d.entry_date).sort().pop(), on);
    if (rec) reminders.push(rec);
    out.push({
      id: b.id,
      kind: brooding ? "broiler-brooding" : "broiler-rearing",
      species: "broiler",
      name: b.name,
      category: ["Broiler", b.breed].filter(Boolean).join(" · "),
      birdsPlaced: b.birds_placed,
      liveBirds: Math.max(0, b.current_birds),
      ageDays: days,
      ageText: formatAge(days),
      startDate: b.date_placed,
      stageLabel: brooding ? "Brooding" : "Rearing / finishing",
      location: b.house,
      nextMilestone: brooding ? `Rearing phase · Day ${BROILER_BROODING_DAYS}` : b.target_weight_kg ? `Market weight target ${b.target_weight_kg} kg` : null,
      status: reminders.some((r) => r.overdue) ? "Attention Required" : "Active",
      reminders,
    });
  }

  return out.sort((a, b) => (a.status === b.status ? a.ageDays - b.ageDays : a.status === "Attention Required" ? -1 : 1));
}

export function summariseOperations(ops: ActiveOperation[]) {
  const brood = ops.filter((o) => o.kind.endsWith("brooding"));
  const rear = ops.filter((o) => o.kind.endsWith("rearing"));
  const sum = (l: ActiveOperation[]) => l.reduce((s, o) => s + o.liveBirds, 0);
  return {
    batches: ops.length,
    broodingBatches: brood.length,
    rearingBatches: rear.length,
    broodingBirds: sum(brood),
    rearingBirds: sum(rear),
    liveBirds: sum(ops),
    tasks: ops.reduce((s, o) => s + o.reminders.length, 0),
  };
}
