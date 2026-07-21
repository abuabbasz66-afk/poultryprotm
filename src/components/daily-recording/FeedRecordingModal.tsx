import { useCallback, useMemo } from "react";
import { DailyRecordingModal, type ModuleSchema } from "./DailyRecordingModal";
import {
  useAddFeed,
  useFarmId,
  useFeed,
  useRooms,
  useUpdateFeed,
  type Feed,
  type Room,
} from "@/lib/farm-data";
import { toDateKey } from "@/lib/date-key";

type FeedRoomValue = { bags: number | "" };

const feedSchema: ModuleSchema<FeedRoomValue> = {
  moduleId: "feed",
  title: "Feed Records",
  subtitle: "Log bags of feed issued to each room today.",
  saveVerb: "Feed",
  fields: [{ key: "bags", label: "Bags", suffix: "25 kg", step: "any", min: 0 }],
  emptyValue: { bags: "" },
  copyableKeys: ["bags"],
  isEmpty: (v) => v.bags === "" || Number(v.bags) === 0,
  summary: (entries, allRooms) => {
    const filled = entries.filter((e) => e.value.bags !== "" && Number(e.value.bags) > 0);
    const totalBags = filled.reduce((s, e) => s + Number(e.value.bags || 0), 0);
    const totalBirds = allRooms.reduce((s, r) => s + (r.current || 0), 0);
    const feedKg = totalBags * 25;
    return [
      { label: "Rooms recorded", value: `${filled.length}/${allRooms.length}` },
      { label: "Total bags", value: totalBags.toFixed(2).replace(/\.00$/, "") },
      {
        label: "Avg bags / room",
        value: filled.length ? (totalBags / filled.length).toFixed(2) : "0",
      },
      {
        label: "Feed / bird",
        value: totalBirds > 0 ? `${((feedKg * 1000) / totalBirds).toFixed(0)} g` : "—",
        accent: true,
        hint: totalBirds > 0 ? `${totalBirds.toLocaleString()} birds` : undefined,
      },
    ];
  },
};

export function FeedRecordingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const roomsQ = useRooms();
  const feedQ = useFeed();
  const { data: farmId } = useFarmId();
  const add = useAddFeed();
  const upd = useUpdateFeed();

  const rooms: Room[] = roomsQ.data ?? [];
  const all: Feed[] = feedQ.data ?? [];

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
      return rows.map((r) => ({ id: r.id, room: r.room, value: { bags: r.bags } as FeedRoomValue }));
    },
    [byDate],
  );

  const yesterdayFor = useCallback(
    (date: string) => {
      // Find the closest strictly-earlier date with entries.
      const dates = Array.from(byDate.keys())
        .filter((d) => d < date)
        .sort();
      const prev = dates[dates.length - 1];
      if (!prev) return [];
      return (byDate.get(prev) ?? []).map((r) => ({
        room: r.room,
        value: { bags: r.bags } as FeedRoomValue,
      }));
    },
    [byDate],
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
        const bags = Number(entry.value.bags);
        if (!Number.isFinite(bags) || bags < 0) continue;
        if (entry.existingId) {
          await upd.mutateAsync({ id: entry.existingId, bags, date });
        } else {
          await add.mutateAsync({ room: entry.room, bags, date });
        }
      }
    },
    [add, upd],
  );

  return (
    <DailyRecordingModal
      open={open}
      onClose={onClose}
      farmId={farmId}
      rooms={rooms}
      schema={feedSchema}
      existingForDate={existingForDate}
      yesterdayFor={yesterdayFor}
      onSave={onSave}
    />
  );
}
