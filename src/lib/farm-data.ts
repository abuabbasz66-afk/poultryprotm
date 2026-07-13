import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Room = { id: string; name: string; current: number; initial: number };
export type EggRow = { id: string; date: string; label: string; r2: number; r3: number; r4: number; extra: number };
export type Mortality = { id: string; room: string; cause: string; date: string; loss: number };
export const HEALTH_TYPES = ["Vaccination", "Vitamin", "Medication", "Treatment", "Observation"] as const;
export type HealthType = typeof HEALTH_TYPES[number];
export function normalizeHealthType(raw: string): HealthType | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  const map: Record<string, HealthType> = {
    vaccination: "Vaccination", vaccine: "Vaccination", vax: "Vaccination",
    vitamin: "Vitamin", vitamins: "Vitamin", multivitamin: "Vitamin",
    medication: "Medication", medicine: "Medication", med: "Medication", meds: "Medication", antibiotic: "Medication", antibiotics: "Medication",
    treatment: "Treatment", treat: "Treatment", therapy: "Treatment",
    observation: "Observation", observe: "Observation", note: "Observation", notes: "Observation",
  };
  return map[v] ?? null;
}
export type Health = { id: string; name: string; scope: string; type: HealthType; date: string };
export type Feed = { id: string; room: string; bags: number; date: string };
export type Price = { id: string; item: string; unit: string; price: number; updated: string };

const KEYS = {
  farm: ["farm-id"] as const,
  rooms: ["rooms"] as const,
  eggs: ["eggs"] as const,
  mortality: ["mortality"] as const,
  health: ["health"] as const,
  feed: ["feed"] as const,
  prices: ["prices"] as const,
};

function invalidateAll(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: KEYS.rooms });
  qc.invalidateQueries({ queryKey: KEYS.eggs });
  qc.invalidateQueries({ queryKey: KEYS.mortality });
  qc.invalidateQueries({ queryKey: KEYS.health });
  qc.invalidateQueries({ queryKey: KEYS.feed });
  qc.invalidateQueries({ queryKey: KEYS.prices });
}

export function useFarmId() {
  return useQuery({
    queryKey: KEYS.farm,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from("farms").select("id").limit(1).maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    staleTime: 5 * 60_000,
  });
}

export function useRooms() {
  return useQuery({
    queryKey: KEYS.rooms,
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, name, current, initial")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Room[];
    },
  });
}

export function useEggs() {
  return useQuery({
    queryKey: KEYS.eggs,
    queryFn: async (): Promise<EggRow[]> => {
      const { data, error } = await supabase
        .from("egg_production")
        .select("id, date, label, r2, r3, r4, extra")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EggRow[];
    },
  });
}

export function useMortality() {
  return useQuery({
    queryKey: KEYS.mortality,
    queryFn: async (): Promise<Mortality[]> => {
      const { data, error } = await supabase
        .from("mortality")
        .select("id, room, cause, date, loss")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Mortality[];
    },
  });
}

export function useHealth() {
  return useQuery({
    queryKey: KEYS.health,
    queryFn: async (): Promise<Health[]> => {
      const { data, error } = await supabase
        .from("health_records")
        .select("id, name, scope, type, date")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Health[];
    },
  });
}

export function useFeed() {
  return useQuery({
    queryKey: KEYS.feed,
    queryFn: async (): Promise<Feed[]> => {
      const { data, error } = await supabase
        .from("feed_usage")
        .select("id, room, bags, date")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(r => ({ ...r, bags: Number(r.bags) })) as Feed[];
    },
  });
}

export function usePrices() {
  return useQuery({
    queryKey: KEYS.prices,
    queryFn: async (): Promise<Price[]> => {
      const { data, error } = await supabase
        .from("prices")
        .select("id, item, unit, price, updated")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Price[];
    },
  });
}

async function requireFarmId(): Promise<string> {
  const { data, error } = await supabase.from("farms").select("id").limit(1).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("No farm found for this user.");
  return data.id;
}

// ============= MUTATIONS =============

export function useAddRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; initial: number }) => {
      const farm_id = await requireFarmId();
      const { error } = await supabase.from("rooms").insert({
        farm_id, name: input.name.toUpperCase(), initial: input.initial, current: input.initial,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; current?: number; initial?: number; name?: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("rooms").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAddEgg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<EggRow, "id">) => {
      const farm_id = await requireFarmId();
      const { error } = await supabase
        .from("egg_production")
        .upsert({ farm_id, ...input }, { onConflict: "farm_id,date" });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateEgg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<EggRow> & { id: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("egg_production").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteEgg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("egg_production").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAddMortality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Mortality, "id">) => {
      const farm_id = await requireFarmId();
      const { error } = await supabase.from("mortality").insert({ farm_id, ...input });
      if (error) throw error;
      // Decrement the matching room's current bird count
      const { data: rm } = await supabase
        .from("rooms")
        .select("id, current")
        .eq("name", input.room.toUpperCase())
        .maybeSingle();
      if (rm) {
        await supabase
          .from("rooms")
          .update({ current: Math.max(0, rm.current - input.loss) })
          .eq("id", rm.id);
      }
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteMortality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mortality").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateMortality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Mortality> & { id: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("mortality").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAddHealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Health, "id">) => {
      const farm_id = await requireFarmId();
      const { error } = await supabase.from("health_records").insert({ farm_id, ...input });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteHealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("health_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateHealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Health> & { id: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("health_records").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAddFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Feed, "id">) => {
      const farm_id = await requireFarmId();
      const { error } = await supabase.from("feed_usage").insert({ farm_id, ...input });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Feed> & { id: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("feed_usage").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feed_usage").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAddPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Price, "id">) => {
      const farm_id = await requireFarmId();
      const { error } = await supabase.from("prices").insert({ farm_id, ...input });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdatePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Price> & { id: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("prices").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeletePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}
