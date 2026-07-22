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

// ============= QUERY KEY POLICY =============
// All farm-specific query keys MUST be nested under ["farm", farmId, ...].
// The active auth user id is a separate top-level key so that on identity
// change the root cache clear (in __root.tsx) also invalidates the farm id
// resolver, which prevents any child ["farm", <previous-farm-id>, ...] entry
// from being re-used by the next signed-in user. Never construct a
// farm-scoped key without a resolved farmId — pass enabled: !!farmId.

const AUTH_USER_KEY = ["auth-user-id"] as const;
const FARM_ID_KEY = (userId: string | null | undefined) =>
  ["farm-id", userId ?? "anon"] as const;

export function farmScope(farmId: string | null | undefined) {
  return ["farm", farmId ?? "none"] as const;
}
function farmKey(farmId: string | null | undefined, ...parts: readonly (string | number)[]) {
  return [...farmScope(farmId), ...parts] as const;
}

/** Invalidate every cache entry belonging to a specific farm. */
export function invalidateFarm(qc: QueryClient, farmId: string | null | undefined) {
  if (!farmId) return;
  qc.invalidateQueries({ queryKey: farmScope(farmId) });
}

/** Remove every cache entry belonging to a specific farm (hard eviction). */
export function removeFarm(qc: QueryClient, farmId: string | null | undefined) {
  if (!farmId) return;
  qc.removeQueries({ queryKey: farmScope(farmId) });
}

// ============= AUTH / FARM RESOLVERS =============

export function useAuthUserId() {
  return useQuery({
    queryKey: AUTH_USER_KEY,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      return data.user?.id ?? null;
    },
    staleTime: Infinity,
  });
}

export function useFarmId() {
  const { data: userId, isPending: userPending } = useAuthUserId();
  return useQuery({
    queryKey: FARM_ID_KEY(userId),
    enabled: !userPending && !!userId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("farms")
        .select("id")
        .eq("owner_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    staleTime: 5 * 60_000,
  });
}

export type Farm = {
  id: string;
  name: string;
  location: string | null;
  state: string | null;
  country: string;
  farm_type: string | null;
  bird_type: string | null;
  rooms_count: number | null;
  owner_name: string | null;
  phone: string | null;
  bird_count: number | null;
  subscription_plan: string | null;
  bag_weight_kg: number | null;
};

export function useFarm() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "profile"),
    enabled: !!farmId,
    queryFn: async (): Promise<Farm | null> => {
      const { data, error } = await supabase
        .from("farms")
        .select("id, name, location, state, country, farm_type, bird_type, rooms_count, owner_name, phone, bird_count, subscription_plan, bag_weight_kg")
        .eq("id", farmId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...data, bag_weight_kg: data.bag_weight_kg == null ? null : Number(data.bag_weight_kg) } as Farm;
    },
    staleTime: 60_000,
  });
}

/** Persist per-farm bag weight (kg per bag). Feed is captured in kg;
 *  bag counts are derived by dividing kg by this configurable weight. */
export function useUpdateFarmBagWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { farmId: string; bagWeightKg: number }) => {
      if (!input.farmId) throw new Error("No farm found for this user.");
      if (!Number.isFinite(input.bagWeightKg) || input.bagWeightKg <= 0) {
        throw new Error("Bag weight must be greater than zero.");
      }
      const { error } = await supabase
        .from("farms")
        .update({ bag_weight_kg: input.bagWeightKg })
        .eq("id", input.farmId);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => invalidateFarm(qc, vars.farmId),
  });
}

export function useRooms() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "rooms"),
    enabled: !!farmId,
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, name, current, initial")
        .eq("farm_id", farmId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Room[];
    },
  });
}

export function useEggs() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "eggs"),
    enabled: !!farmId,
    queryFn: async (): Promise<EggRow[]> => {
      const { data, error } = await supabase
        .from("egg_production")
        .select("id, date, label, r2, r3, r4, extra")
        .eq("farm_id", farmId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EggRow[];
    },
  });
}

export function useMortality() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "mortality"),
    enabled: !!farmId,
    queryFn: async (): Promise<Mortality[]> => {
      const { data, error } = await supabase
        .from("mortality")
        .select("id, room, cause, date, loss")
        .eq("farm_id", farmId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Mortality[];
    },
  });
}

export function useHealth() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "health"),
    enabled: !!farmId,
    queryFn: async (): Promise<Health[]> => {
      const { data, error } = await supabase
        .from("health_records")
        .select("id, name, scope, type, date")
        .eq("farm_id", farmId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Health[];
    },
  });
}

export function useFeed() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "feed"),
    enabled: !!farmId,
    queryFn: async (): Promise<Feed[]> => {
      const { data, error } = await supabase
        .from("feed_usage")
        .select("id, room, bags, date")
        .eq("farm_id", farmId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(r => ({ ...r, bags: Number(r.bags) })) as Feed[];
    },
  });
}

export function usePrices() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "prices"),
    enabled: !!farmId,
    queryFn: async (): Promise<Price[]> => {
      const { data, error } = await supabase
        .from("prices")
        .select("id, item, unit, price, updated")
        .eq("farm_id", farmId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Price[];
    },
  });
}

// ============= MUTATIONS =============
// Each mutation resolves the CURRENT farmId (from the RLS-scoped useFarmId
// query) and invalidates only that farm's cache subtree — never a bare
// ["rooms"] / ["eggs"] key that could shadow a different farm.

function useFarmIdOrThrow(): string | null {
  const { data: farmId } = useFarmId();
  return farmId ?? null;
}

export function useAddRoom() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (input: { name: string; initial: number }) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const { error } = await supabase.from("rooms").insert({
        farm_id: farmId, name: input.name.toUpperCase(), initial: input.initial, current: input.initial,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (input: { id: string; current?: number; initial?: number; name?: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("rooms").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useAddEgg() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (input: Omit<EggRow, "id">) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const { error } = await supabase
        .from("egg_production")
        .upsert({ farm_id: farmId, ...input }, { onConflict: "farm_id,date" });
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdateEgg() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (input: Partial<EggRow> & { id: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("egg_production").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteEgg() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("egg_production").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useAddMortality() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (input: Omit<Mortality, "id">) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const { error } = await supabase.from("mortality").insert({ farm_id: farmId, ...input });
      if (error) throw error;
      const { data: rm } = await supabase
        .from("rooms")
        .select("id, current")
        .eq("farm_id", farmId)
        .eq("name", input.room.toUpperCase())
        .maybeSingle();
      if (rm) {
        await supabase
          .from("rooms")
          .update({ current: Math.max(0, rm.current - input.loss) })
          .eq("id", rm.id);
      }
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteMortality() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mortality").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdateMortality() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (input: Partial<Mortality> & { id: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("mortality").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useAddHealth() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (input: Omit<Health, "id">) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const { error } = await supabase.from("health_records").insert({ farm_id: farmId, ...input });
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteHealth() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("health_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdateHealth() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (input: Partial<Health> & { id: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("health_records").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useAddFeed() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (input: Omit<Feed, "id">) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const { error } = await supabase.from("feed_usage").insert({ farm_id: farmId, ...input });
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdateFeed() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (input: Partial<Feed> & { id: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("feed_usage").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteFeed() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feed_usage").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useAddPrice() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (input: Omit<Price, "id">) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const { error } = await supabase.from("prices").insert({ farm_id: farmId, ...input });
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdatePrice() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (input: Partial<Price> & { id: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("prices").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeletePrice() {
  const qc = useQueryClient();
  const farmId = useFarmIdOrThrow();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}
