import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId } from "@/lib/farm-data";

/**
 * PoultryPro Academy data layer.
 *
 * Content lives in `academy_categories` / `academy_tutorials` (public read is
 * limited by RLS to published, non-archived rows), learner state lives in
 * `academy_progress`, and learning analytics in `academy_events`. Nothing here
 * touches farm data, so Academy queries never slow the farm dashboard.
 */

export type AcademyDifficulty = "Beginner" | "Intermediate" | "Advanced";

export type AcademyCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

export type AcademyTutorial = {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  description: string;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  difficulty: AcademyDifficulty;
  keywords: string[];
  is_published: boolean;
  is_featured: boolean;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const CATEGORY_COLUMNS = "id,name,slug,description,icon,sort_order,is_active";
const TUTORIAL_COLUMNS =
  "id,category_id,title,slug,description,video_url,thumbnail_url,duration_seconds,difficulty,keywords,is_published,is_featured,is_archived,sort_order,created_at,updated_at";

/** Format seconds as m:ss — the shape farmers already see on the cards. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function useAcademyCategories() {
  return useQuery({
    queryKey: ["academy", "categories"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AcademyCategory[]> => {
      const { data, error } = await supabase
        .from("academy_categories")
        .select(CATEGORY_COLUMNS)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as AcademyCategory[];
    },
  });
}

/**
 * Published tutorials. `limit` keeps landing-page payloads small; the full
 * catalogue page passes no limit.
 */
export function useAcademyTutorials(options?: { limit?: number }) {
  const limit = options?.limit;
  return useQuery({
    queryKey: ["academy", "tutorials", limit ?? "all"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AcademyTutorial[]> => {
      let q = supabase
        .from("academy_tutorials")
        .select(TUTORIAL_COLUMNS)
        .eq("is_published", true)
        .eq("is_archived", false)
        .order("sort_order");
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AcademyTutorial[];
    },
  });
}

/** Admin view: every tutorial, including drafts and archived rows (RLS-gated). */
export function useAllAcademyTutorials(enabled = true) {
  return useQuery({
    queryKey: ["academy", "tutorials", "admin"],
    enabled,
    queryFn: async (): Promise<AcademyTutorial[]> => {
      const { data, error } = await supabase
        .from("academy_tutorials")
        .select(TUTORIAL_COLUMNS)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as AcademyTutorial[];
    },
  });
}

export function useAcademyTutorial(slug: string) {
  return useQuery({
    queryKey: ["academy", "tutorial", slug],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AcademyTutorial | null> => {
      const { data, error } = await supabase
        .from("academy_tutorials")
        .select(TUTORIAL_COLUMNS)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AcademyTutorial | null;
    },
  });
}

/** The signed-in learner's completed tutorial ids. */
export function useAcademyProgress() {
  const { data: userId } = useAuthUserId();
  return useQuery({
    queryKey: ["academy", "progress", userId ?? "anon"],
    enabled: !!userId,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("academy_progress")
        .select("tutorial_id,completed")
        .eq("completed", true);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.tutorial_id as string));
    },
  });
}

export function useSetTutorialCompletion() {
  const qc = useQueryClient();
  const { data: userId } = useAuthUserId();
  return useMutation({
    mutationFn: async ({ tutorialId, completed }: { tutorialId: string; completed: boolean }) => {
      if (!userId) throw new Error("Sign in to save your learning progress.");
      const { error } = await supabase.from("academy_progress").upsert(
        {
          user_id: userId,
          tutorial_id: tutorialId,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        },
        { onConflict: "user_id,tutorial_id" },
      );
      if (error) throw error;
      if (completed) {
        await supabase
          .from("academy_events")
          .insert({ user_id: userId, tutorial_id: tutorialId, event_type: "complete" });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academy", "progress"] });
    },
  });
}

/** Records a view for learning analytics. Silent no-op for signed-out visitors. */
export async function trackTutorialView(tutorialId: string, userId: string | null | undefined) {
  if (!userId) return;
  await supabase
    .from("academy_events")
    .insert({ user_id: userId, tutorial_id: tutorialId, event_type: "view" });
}

/** Case-insensitive search over title, description and keywords. */
export function searchAcademy(list: AcademyTutorial[], query: string): AcademyTutorial[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((t) =>
    [t.title, t.description, t.difficulty, ...(t.keywords ?? [])].join(" ").toLowerCase().includes(q),
  );
}
