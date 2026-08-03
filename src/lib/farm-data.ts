import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { offlineList, offlineValue, readCache, runOrQueue } from "@/lib/offline/data";
import { isOnline } from "@/lib/offline/status";

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
export type PriceCategory = "eggs" | "feed" | "ingredient" | "medicine" | "vaccines" | "other";
export type Price = {
  id: string; item: string; unit: string; price: number; updated: string;
  effective_from?: string; category?: string; note?: string | null;
};
export type PriceHistoryRow = {
  id: string;
  item: string;
  category: string;
  unit: string;
  old_price: number | null;
  new_price: number;
  effective_from: string;
  updated_by: string | null;
  device: string | null;
  note: string | null;
  created_at: string;
};

// ============= QUERY KEY POLICY =============
// All farm-specific query keys MUST be nested under ["farm", farmId, ...].
// The active auth user id is a separate top-level key so that on identity
// change the root cache clear (in __root.tsx) also invalidates the farm id
// resolver, which prevents any child ["farm", <previous-farm-id>, ...] entry
// from being re-used by the next signed-in user. Never construct a
// farm-scoped key without a resolved farmId — pass enabled: !!farmId.
//
// OFFLINE POLICY: every read goes through `offlineList` / `offlineValue`,
// which cache the last server response in encrypted IndexedDB and overlay any
// pending offline writes. Every write goes through `runOrQueue`, which sends
// to the cloud when connected and otherwise appends to the local outbox.
// `networkMode: "always"` is required so React Query does not pause while the
// device is offline — our own layer decides what to do.

const AUTH_USER_KEY = ["auth-user-id"] as const;
const FARM_ID_KEY = (userId: string | null | undefined) =>
  ["farm-id", userId ?? "anon"] as const;

export function farmScope(farmId: string | null | undefined) {
  return ["farm", farmId ?? "none"] as const;
}
function farmKey(farmId: string | null | undefined, ...parts: readonly (string | number)[]) {
  return [...farmScope(farmId), ...parts] as const;
}
/** Stable IndexedDB cache key for a farm-scoped collection. */
function cacheKey(farmId: string | null | undefined, name: string) {
  return `farm:${farmId ?? "none"}:${name}`;
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
    networkMode: "always",
    queryFn: async (): Promise<string | null> => {
      // getSession() reads the persisted session from this device, so a
      // previously signed-in farmer stays logged in with no connection.
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user?.id) return sessionData.session.user.id;
      if (!isOnline()) return null;
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
    networkMode: "always",
    retry: 1,
    queryFn: async (): Promise<string | null> => {
      const value = await offlineValue<string | null>({
        userId,
        cacheKey: `user:${userId}:farm-id`,
        fetcher: async () => {
          // Membership first: owners AND staff (manager, sales, future roles)
          // all resolve their farm through farm_members. Owner-only lookups
          // left staff accounts with no farm id at all.
          const { data: members, error: memberErr } = await supabase
            .from("farm_members")
            .select("farm_id, role_key, status, created_at")
            .eq("user_id", userId!)
            .eq("status", "active")
            .order("created_at", { ascending: true });
          const member =
            members?.find((m) => m.role_key === "owner") ?? members?.[0] ?? null;
          if (memberErr) {
            console.error("[farm] membership lookup failed", { userId, error: memberErr.message });
            throw memberErr;
          }
          if (member?.farm_id) {
            console.info("[farm] resolved via membership", {
              userId, farmId: member.farm_id, role: member.role_key,
            });
            return member.farm_id;
          }

          // Fallback for legacy owners without a roster row yet.
          const { data, error } = await supabase
            .from("farms")
            .select("id")
            .eq("owner_id", userId!)
            .maybeSingle();
          if (error) {
            console.error("[farm] owner lookup failed", { userId, error: error.message });
            throw error;
          }
          console.info("[farm] resolved via ownership", { userId, farmId: data?.id ?? null });
          return data?.id ?? null;
        },
      });
      return value ?? null;
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
  feed_source: "purchased" | "self_produced";
};

export function useFarm() {
  const { data: userId } = useAuthUserId();
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "profile"),
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<Farm | null> => {
      const value = await offlineValue<Farm | null>({
        userId,
        cacheKey: cacheKey(farmId, "profile"),
        fetcher: async () => {
          const { data, error } = await supabase
            .from("farms")
            .select("id, name, location, state, country, farm_type, bird_type, rooms_count, owner_name, phone, bird_count, subscription_plan, bag_weight_kg, feed_source")
            .eq("id", farmId!)
            .maybeSingle();
          if (error) throw error;
          if (!data) return null;
          return {
            ...data,
            bag_weight_kg: data.bag_weight_kg == null ? null : Number(data.bag_weight_kg),
            feed_source: (data as any).feed_source ?? "purchased",
          } as Farm;
        },
      });
      return value ?? null;
    },
    staleTime: 60_000,
  });
}


/** Persist per-farm bag weight (kg per bag). Feed is captured in kg;
 *  bag counts are derived by dividing kg by this configurable weight. */
export function useUpdateFarmBagWeight() {
  const qc = useQueryClient();
  const { data: userId } = useAuthUserId();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: { farmId: string; bagWeightKg: number }) => {
      if (!input.farmId) throw new Error("No farm found for this user.");
      if (!Number.isFinite(input.bagWeightKg) || input.bagWeightKg <= 0) {
        throw new Error("Bag weight must be greater than zero.");
      }
      return runOrQueue({
        userId, farmId: input.farmId, table: "farms", op: "update", rowId: input.farmId,
        payload: { bag_weight_kg: input.bagWeightKg },
        perform: async () => {
          const { error } = await supabase
            .from("farms")
            .update({ bag_weight_kg: input.bagWeightKg })
            .eq("id", input.farmId);
          if (error) throw error;
        },
      });
    },
    onSuccess: (_r, vars) => invalidateFarm(qc, vars.farmId),
  });
}

export function useRooms() {
  const { data: userId } = useAuthUserId();
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "rooms"),
    enabled: !!farmId,
    networkMode: "always",
    queryFn: (): Promise<Room[]> =>
      offlineList<Room>({
        userId,
        cacheKey: cacheKey(farmId, "rooms"),
        table: "rooms",
        fetcher: async () => {
          const { data, error } = await supabase
            .from("rooms")
            .select("id, name, current, initial")
            .eq("farm_id", farmId!)
            .order("name");
          if (error) throw error;
          return (data ?? []) as Room[];
        },
      }),
  });
}

export function useEggs() {
  const { data: userId } = useAuthUserId();
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "eggs"),
    enabled: !!farmId,
    networkMode: "always",
    queryFn: (): Promise<EggRow[]> =>
      offlineList<EggRow>({
        userId,
        cacheKey: cacheKey(farmId, "eggs"),
        table: "egg_production",
        fetcher: async () => {
          const { data, error } = await supabase
            .from("egg_production")
            .select("id, date, label, r2, r3, r4, extra")
            .eq("farm_id", farmId!)
            .order("date", { ascending: false });
          if (error) throw error;
          return (data ?? []) as EggRow[];
        },
      }),
  });
}

export function useMortality() {
  const { data: userId } = useAuthUserId();
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "mortality"),
    enabled: !!farmId,
    networkMode: "always",
    queryFn: (): Promise<Mortality[]> =>
      offlineList<Mortality>({
        userId,
        cacheKey: cacheKey(farmId, "mortality"),
        table: "mortality",
        fetcher: async () => {
          const { data, error } = await supabase
            .from("mortality")
            .select("id, room, cause, date, loss")
            .eq("farm_id", farmId!)
            .order("created_at", { ascending: false });
          if (error) throw error;
          return (data ?? []) as Mortality[];
        },
      }),
  });
}

export function useHealth() {
  const { data: userId } = useAuthUserId();
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "health"),
    enabled: !!farmId,
    networkMode: "always",
    queryFn: (): Promise<Health[]> =>
      offlineList<Health>({
        userId,
        cacheKey: cacheKey(farmId, "health"),
        table: "health_records",
        fetcher: async () => {
          const { data, error } = await supabase
            .from("health_records")
            .select("id, name, scope, type, date")
            .eq("farm_id", farmId!)
            .order("created_at", { ascending: false });
          if (error) throw error;
          return (data ?? []) as Health[];
        },
      }),
  });
}

export function useFeed() {
  const { data: userId } = useAuthUserId();
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "feed"),
    enabled: !!farmId,
    networkMode: "always",
    queryFn: (): Promise<Feed[]> =>
      offlineList<Feed>({
        userId,
        cacheKey: cacheKey(farmId, "feed"),
        table: "feed_usage",
        fetcher: async () => {
          const { data, error } = await supabase
            .from("feed_usage")
            .select("id, room, bags, date")
            .eq("farm_id", farmId!)
            .order("created_at", { ascending: false });
          if (error) throw error;
          return (data ?? []).map(r => ({ ...r, bags: Number(r.bags) })) as Feed[];
        },
      }),
  });
}

export function usePrices() {
  const { data: userId } = useAuthUserId();
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "prices"),
    enabled: !!farmId,
    networkMode: "always",
    queryFn: (): Promise<Price[]> =>
      offlineList<Price>({
        userId,
        cacheKey: cacheKey(farmId, "prices"),
        table: "prices",
        fetcher: async () => {
          const { data, error } = await supabase
            .from("prices")
            .select("id, item, unit, price, updated, effective_from, category, note")
            .eq("farm_id", farmId!)
            .order("created_at");
          if (error) throw error;
          return (data ?? []) as Price[];
        },
      }),
  });
}

/** Full immutable price audit trail for the active farm (newest first). */
export function usePriceHistory() {
  const { data: userId } = useAuthUserId();
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: farmKey(farmId, "price-history"),
    enabled: !!farmId,
    networkMode: "always",
    queryFn: (): Promise<PriceHistoryRow[]> =>
      offlineList<PriceHistoryRow>({
        userId,
        cacheKey: cacheKey(farmId, "price-history"),
        table: "price_history",
        fetcher: async () => {
          const { data, error } = await supabase
            .from("price_history")
            .select("id, item, category, unit, old_price, new_price, effective_from, updated_by, device, note, created_at")
            .eq("farm_id", farmId!)
            .order("effective_from", { ascending: false });
          if (error) throw error;
          return (data ?? []).map(r => ({
            ...r,
            old_price: r.old_price == null ? null : Number(r.old_price),
            new_price: Number(r.new_price),
          })) as PriceHistoryRow[];
        },
      }),
  });
}


// ============= MUTATIONS =============
// Each mutation resolves the CURRENT farmId (from the RLS-scoped useFarmId
// query) and invalidates only that farm's cache subtree — never a bare
// ["rooms"] / ["eggs"] key that could shadow a different farm.
// Writes route through runOrQueue so they succeed with or without a network.

function useFarmIdOrThrow(): string | null {
  const { data: farmId } = useFarmId();
  return farmId ?? null;
}

/** Shared identity for offline writes. */
function useWriteCtx() {
  const { data: userId } = useAuthUserId();
  const farmId = useFarmIdOrThrow();
  return { userId: userId ?? null, farmId };
}

export function useAddRoom() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: { name: string; initial: number }) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const row = {
        farm_id: farmId, name: input.name.toUpperCase(), initial: input.initial, current: input.initial,
      };
      return runOrQueue({
        userId, farmId, table: "rooms", op: "insert", payload: row,
        perform: async (rowId) => {
          const { error } = await supabase.from("rooms").insert({ id: rowId, ...row });
          if (error) throw error;
        },
      });
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (id: string) =>
      runOrQueue({
        userId, farmId, table: "rooms", op: "delete", rowId: id,
        perform: async () => {
          const { error } = await supabase.from("rooms").delete().eq("id", id);
          if (error) throw error;
        },
      }),
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: { id: string; current?: number; initial?: number; name?: string }) => {
      const { id, ...patch } = input;
      const base = await findCached<Room>(userId, cacheKey(farmId, "rooms"), id);
      return runOrQueue({
        userId, farmId, table: "rooms", op: "update", rowId: id, payload: patch, base,
        perform: async () => {
          const { error } = await supabase.from("rooms").update(patch).eq("id", id);
          if (error) throw error;
        },
      });
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

/** Snapshot of a cached row, used as the conflict-detection baseline. */
async function findCached<T extends { id: string }>(
  userId: string | null,
  key: string,
  id: string,
): Promise<Record<string, unknown> | null> {
  const rows = await readCache<T[]>(userId, key);
  const row = rows?.find((r) => r.id === id);
  return (row as Record<string, unknown> | undefined) ?? null;
}

export function useAddEgg() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: Omit<EggRow, "id">) => {
      if (!farmId) throw new Error("No farm found for this user.");
      return runOrQueue({
        userId, farmId, table: "egg_production", op: "insert", payload: { farm_id: farmId, ...input },
        perform: async (rowId) => {
          const { error } = await supabase
            .from("egg_production")
            .upsert({ id: rowId, farm_id: farmId, ...input }, { onConflict: "farm_id,date" });
          if (error) throw error;
        },
      });
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdateEgg() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: Partial<EggRow> & { id: string }) => {
      const { id, ...patch } = input;
      const base = await findCached<EggRow>(userId, cacheKey(farmId, "eggs"), id);
      return runOrQueue({
        userId, farmId, table: "egg_production", op: "update", rowId: id, payload: patch, base,
        perform: async () => {
          const { error } = await supabase.from("egg_production").update(patch).eq("id", id);
          if (error) throw error;
        },
      });
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteEgg() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (id: string) =>
      runOrQueue({
        userId, farmId, table: "egg_production", op: "delete", rowId: id,
        perform: async () => {
          const { error } = await supabase.from("egg_production").delete().eq("id", id);
          if (error) throw error;
        },
      }),
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useAddMortality() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: Omit<Mortality, "id">) => {
      if (!farmId) throw new Error("No farm found for this user.");
      const result = await runOrQueue({
        userId, farmId, table: "mortality", op: "insert", payload: { farm_id: farmId, ...input },
        perform: async (rowId) => {
          const { error } = await supabase.from("mortality").insert({ id: rowId, farm_id: farmId, ...input });
          if (error) throw error;
        },
      });

      // Keep the room's live bird count in step, online or offline.
      const roomName = input.room.toUpperCase();
      if (!result.queued) {
        const { data: rm } = await supabase
          .from("rooms")
          .select("id, current")
          .eq("farm_id", farmId)
          .eq("name", roomName)
          .maybeSingle();
        if (rm) {
          await supabase
            .from("rooms")
            .update({ current: Math.max(0, rm.current - input.loss) })
            .eq("id", rm.id);
        }
      } else {
        const rooms = (await readCache<Room[]>(userId, cacheKey(farmId, "rooms"))) ?? [];
        const rm = rooms.find((r) => r.name.toUpperCase() === roomName);
        if (rm) {
          await runOrQueue({
            userId, farmId, table: "rooms", op: "update", rowId: rm.id,
            payload: { current: Math.max(0, rm.current - input.loss) },
            base: rm as unknown as Record<string, unknown>,
            perform: async () => {
              const { error } = await supabase
                .from("rooms")
                .update({ current: Math.max(0, rm.current - input.loss) })
                .eq("id", rm.id);
              if (error) throw error;
            },
          });
        }
      }
      return result;
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteMortality() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (id: string) =>
      runOrQueue({
        userId, farmId, table: "mortality", op: "delete", rowId: id,
        perform: async () => {
          const { error } = await supabase.from("mortality").delete().eq("id", id);
          if (error) throw error;
        },
      }),
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdateMortality() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: Partial<Mortality> & { id: string }) => {
      const { id, ...patch } = input;
      const base = await findCached<Mortality>(userId, cacheKey(farmId, "mortality"), id);
      return runOrQueue({
        userId, farmId, table: "mortality", op: "update", rowId: id, payload: patch, base,
        perform: async () => {
          const { error } = await supabase.from("mortality").update(patch).eq("id", id);
          if (error) throw error;
        },
      });
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useAddHealth() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: Omit<Health, "id">) => {
      if (!farmId) throw new Error("No farm found for this user.");
      return runOrQueue({
        userId, farmId, table: "health_records", op: "insert", payload: { farm_id: farmId, ...input },
        perform: async (rowId) => {
          const { error } = await supabase.from("health_records").insert({ id: rowId, farm_id: farmId, ...input });
          if (error) throw error;
        },
      });
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteHealth() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (id: string) =>
      runOrQueue({
        userId, farmId, table: "health_records", op: "delete", rowId: id,
        perform: async () => {
          const { error } = await supabase.from("health_records").delete().eq("id", id);
          if (error) throw error;
        },
      }),
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdateHealth() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: Partial<Health> & { id: string }) => {
      const { id, ...patch } = input;
      const base = await findCached<Health>(userId, cacheKey(farmId, "health"), id);
      return runOrQueue({
        userId, farmId, table: "health_records", op: "update", rowId: id, payload: patch, base,
        perform: async () => {
          const { error } = await supabase.from("health_records").update(patch).eq("id", id);
          if (error) throw error;
        },
      });
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useAddFeed() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: Omit<Feed, "id">) => {
      if (!farmId) throw new Error("No farm found for this user.");
      return runOrQueue({
        userId, farmId, table: "feed_usage", op: "insert", payload: { farm_id: farmId, ...input },
        perform: async (rowId) => {
          const { error } = await supabase.from("feed_usage").insert({ id: rowId, farm_id: farmId, ...input });
          if (error) throw error;
        },
      });
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdateFeed() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: Partial<Feed> & { id: string }) => {
      const { id, ...patch } = input;
      const base = await findCached<Feed>(userId, cacheKey(farmId, "feed"), id);
      return runOrQueue({
        userId, farmId, table: "feed_usage", op: "update", rowId: id, payload: patch, base,
        perform: async () => {
          const { error } = await supabase.from("feed_usage").update(patch).eq("id", id);
          if (error) throw error;
        },
      });
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeleteFeed() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (id: string) =>
      runOrQueue({
        userId, farmId, table: "feed_usage", op: "delete", rowId: id,
        perform: async () => {
          const { error } = await supabase.from("feed_usage").delete().eq("id", id);
          if (error) throw error;
        },
      }),
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useAddPrice() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: Omit<Price, "id">) => {
      if (!farmId) throw new Error("No farm found for this user.");
      return runOrQueue({
        userId, farmId, table: "prices", op: "insert", payload: { farm_id: farmId, ...input },
        perform: async (rowId) => {
          const { error } = await supabase.from("prices").insert({ id: rowId, farm_id: farmId, ...input });
          if (error) throw error;
        },
      });
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useUpdatePrice() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (input: Partial<Price> & { id: string }) => {
      const { id, ...patch } = input;
      const base = await findCached<Price>(userId, cacheKey(farmId, "prices"), id);
      return runOrQueue({
        userId, farmId, table: "prices", op: "update", rowId: id, payload: patch, base,
        perform: async () => {
          const { error } = await supabase.from("prices").update(patch).eq("id", id);
          if (error) throw error;
        },
      });
    },
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}

export function useDeletePrice() {
  const qc = useQueryClient();
  const { userId, farmId } = useWriteCtx();
  return useMutation({
    networkMode: "always",
    mutationFn: async (id: string) =>
      runOrQueue({
        userId, farmId, table: "prices", op: "delete", rowId: id,
        perform: async () => {
          const { error } = await supabase.from("prices").delete().eq("id", id);
          if (error) throw error;
        },
      }),
    onSuccess: () => invalidateFarm(qc, farmId),
  });
}
