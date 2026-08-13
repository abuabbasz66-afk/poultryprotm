// Recent farm activities — a unified, read-only feed built from the records
// the farm already has (production, feed, mortality, health, prices).
// Nothing is invented: every entry maps 1:1 to a stored record.
import type { EggRow, Feed, Health, Mortality, Price } from "@/lib/farm-data";
import { toDateKey } from "@/lib/date-key";
import { totalEggsFromRow } from "@/lib/egg-normalize";

export type ActivityKind = "production" | "feed" | "mortality" | "health" | "price";

export type FarmActivity = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  room?: string | null;
  dateKey: string;
  dateLabel: string;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildFarmActivities(input: {
  eggs: EggRow[];
  feed: Feed[];
  mortality: Mortality[];
  health: Health[];
  prices: Price[];
  bagWeightKg: number;
}): FarmActivity[] {
  const { eggs, feed, mortality, health, prices, bagWeightKg } = input;
  const out: FarmActivity[] = [];

  for (const e of eggs) {
    const total = totalEggsFromRow(e);
    out.push({
      id: `egg-${e.id ?? e.date}`,
      kind: "production",
      title: `Production recorded — ${total.toLocaleString()} eggs`,
      detail: e.extra ? `${e.extra} extra eggs` : undefined,
      dateKey: toDateKey(e.date) ?? e.date,
      dateLabel: e.label || e.date,
    });
  }

  for (const f of feed) {
    out.push({
      id: `feed-${f.id}`,
      kind: "feed",
      title: `Feed issued — ${round1(f.bags * bagWeightKg)} kg`,
      detail: `${round1(f.bags)} bags`,
      room: f.room,
      dateKey: toDateKey(f.date) ?? f.date,
      dateLabel: f.date,
    });
  }

  for (const m of mortality) {
    const loss = Math.abs(Number(m.loss) || 0);
    out.push({
      id: `mort-${m.id}`,
      kind: "mortality",
      title: `Mortality recorded — ${loss} ${loss === 1 ? "bird" : "birds"}`,
      detail: m.cause || undefined,
      room: m.room,
      dateKey: toDateKey(m.date) ?? m.date,
      dateLabel: m.date,
    });
  }

  for (const h of health) {
    out.push({
      id: `health-${h.id}`,
      kind: "health",
      title: `Health record added — ${h.name}`,
      detail: h.type,
      room: h.scope,
      dateKey: toDateKey(h.date) ?? h.date,
      dateLabel: h.date,
    });
  }

  for (const p of prices) {
    const key = toDateKey(p.effective_from ?? p.updated) ?? toDateKey(p.updated) ?? p.updated;
    out.push({
      id: `price-${p.id}`,
      kind: "price",
      title: `Price updated — ${p.item}`,
      detail: `₦${Number(p.price).toLocaleString("en-NG")} / ${p.unit}`,
      dateKey: key,
      dateLabel: p.updated,
    });
  }

  return out.sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0));
}
