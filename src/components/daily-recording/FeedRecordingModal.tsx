import { useCallback, useMemo } from "react";
import { DailyRecordingModal, type ModuleSchema } from "./DailyRecordingModal";
import {
  useAddFeed,
  useFarm,
  useFarmId,
  useFeed,
  useRooms,
  useUpdateFeed,
  type Feed,
  type Room,
} from "@/lib/farm-data";
import { toDateKey } from "@/lib/date-key";
import { productionRooms } from "@/lib/rooms";

type FeedRoomValue = { kg: number | "" };

/**
 * Feed is captured in kilograms — the natural unit for feed weighing scales.
 * Bag counts are a derived display value: bags = kg / bagWeight (per-farm,
 * default 25 kg). This avoids rounding loss and lets farms with 25 kg,
 * 40 kg or 50 kg bags keep accurate feed records with a single setting.
 */
function makeFeedSchema(bagWeightKg: number): ModuleSchema<FeedRoomValue> {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    moduleId: "feed",
    title: "Feed Records",
    subtitle: `Log kilograms of feed issued to each room today. Equivalent bags calculated automatically (1 bag = ${bagWeightKg} kg).`,
    saveVerb: "Feed",
    fields: [{ key: "kg", label: "Feed issued (kg)", suffix: "kg", step: "any", min: 0 }],
    emptyValue: { kg: "" },
    copyableKeys: ["kg"],
    isEmpty: (v) => v.kg === "" || Number(v.kg) === 0,
    summary: (entries, allRooms) => {
      const filled = entries.filter((e) => e.value.kg !== "" && Number(e.value.kg) > 0);
      const totalKg = filled.reduce((s, e) => s + Number(e.value.kg || 0), 0);
      const totalBags = totalKg / bagWeightKg;
      const totalBirds = allRooms.reduce((s, r) => s + (r.current || 0), 0);
      return [
        { label: "Rooms recorded", value: `${filled.length}/${allRooms.length}` },
        {
          label: "Total feed",
          value: `${round1(totalKg)} kg`,
          hint: `${round1(totalBags)} bags · 1 bag = ${bagWeightKg} kg`,
        },
        {
          label: "Avg / room",
          value: filled.length ? `${round1(totalKg / filled.length)} kg` : "0 kg",
        },
        {
          label: "Feed / bird",
          value: totalBirds > 0 ? `${((totalKg * 1000) / totalBirds).toFixed(0)} g` : "—",
          accent: true,
          hint: totalBirds > 0 ? `${totalBirds.toLocaleString()} birds` : undefined,
        },
      ];
    },
  };
}

export function FeedRecordingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const roomsQ = useRooms();
  const feedQ = useFeed();
  const farmQ = useFarm();
  const { data: farmId } = useFarmId();
  const add = useAddFeed();
  const upd = useUpdateFeed();

  // Culled / inactive rooms never accept new feed records.
  const rooms: Room[] = productionRooms(roomsQ.data ?? []);
  const all: Feed[] = feedQ.data ?? [];
  const bagWeightKg = farmQ.data?.bag_weight_kg ?? 25;

  const schema = useMemo(() => makeFeedSchema(bagWeightKg), [bagWeightKg]);

  const byDate = useMemo(() => {
    const m = new Map<string, Feed[]>();
    for (const f of all) {
      const key = toDateKey(f.date) ?? f.date;
      const arr = m.get(key) ?? [];
      arr.push(f);
      m.set(key, arr);
    }
    return m;
  }, [all]);

  const existingForDate = useCallback(
    (date: string) => {
      const rows = byDate.get(date) ?? [];
      return rows.map((r) => ({
        id: r.id,
        room: r.room,
        value: { kg: Math.round(r.bags * bagWeightKg * 100) / 100 } as FeedRoomValue,
      }));
    },
    [byDate, bagWeightKg],
  );

  const yesterdayFor = useCallback(
    (date: string) => {
      const dates = Array.from(byDate.keys()).filter((d) => d < date).sort();
      const prev = dates[dates.length - 1];
      if (!prev) return [];
      return (byDate.get(prev) ?? []).map((r) => ({
        room: r.room,
        value: { kg: Math.round(r.bags * bagWeightKg * 100) / 100 } as FeedRoomValue,
      }));
    },
    [byDate, bagWeightKg],
  );

  const onSave = useCallback(
    async ({
      date,
      entries,
    }: {
      date: string;
      entries: { room: string; existingId?: string; value: FeedRoomValue }[];
    }) => {
      for (const entry of entries) {
        const kg = Number(entry.value.kg);
        if (!Number.isFinite(kg) || kg < 0) continue;
        const bags = kg / bagWeightKg;
        if (entry.existingId) {
          await upd.mutateAsync({ id: entry.existingId, bags, date });
        } else {
          await add.mutateAsync({ room: entry.room, bags, date });
        }
      }
    },
    [add, upd, bagWeightKg],
  );

  return (
    <DailyRecordingModal
      open={open}
      onClose={onClose}
      farmId={farmId}
      rooms={rooms}
      schema={schema}
      existingForDate={existingForDate}
      yesterdayFor={yesterdayFor}
      onSave={onSave}
    />
  );
}
