// Persistence for AI intelligence output: recommendation lifecycle, farmer
// feedback (the learning signal) and data-quality review flags. Every query is
// farm-scoped and enforced again by RLS on the server.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { farmScope, useFarmId } from "@/lib/farm-data";
import type { Insight } from "@/lib/ai/engine";
import type { QualityFlag } from "@/lib/ai/quality";

export type StoredRecommendation = {
  id: string;
  insight_key: string;
  category: string;
  severity: string;
  title: string;
  summary: string;
  confidence: number;
  status: string;
  feedback: string | null;
  feedback_note: string | null;
  created_at: string;
};

export function useAiRecommendations() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "ai", "recommendations"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<StoredRecommendation[]> => {
      const { data, error } = await supabase
        .from("ai_recommendations")
        .select("id, insight_key, category, severity, title, summary, confidence, status, feedback, feedback_note, created_at")
        .eq("farm_id", farmId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as StoredRecommendation[];
    },
  });
}

/** Records newly generated insights once, so feedback and outcomes can be tracked over time. */
export function useSyncInsights() {
  const { data: farmId } = useFarmId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (insights: Insight[]) => {
      if (!farmId || insights.length === 0) return;
      const { data: existing, error } = await supabase
        .from("ai_recommendations")
        .select("insight_key")
        .eq("farm_id", farmId)
        .eq("status", "open");
      if (error) throw error;
      const open = new Set((existing ?? []).map((r) => r.insight_key));
      const rows = insights
        .filter((i) => !open.has(i.key))
        .map((i) => ({
          farm_id: farmId,
          insight_key: i.key,
          category: i.category,
          severity: i.severity,
          title: i.title,
          summary: i.observed,
          confidence: i.confidence.score,
          detail: {
            kind: i.kind,
            whyItMatters: i.whyItMatters,
            whatToCheck: i.whatToCheck,
            recommendation: i.recommendation ?? null,
            evidence: i.evidence,
            confidence: i.confidence,
          },
        }));
      if (!rows.length) return;
      const { error: insertError } = await supabase.from("ai_recommendations").insert(rows);
      if (insertError) throw insertError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...farmScope(farmId), "ai", "recommendations"] }),
  });
}

/** Farmer feedback closes the loop: helpful / not helpful / acted on. */
export function useInsightFeedback() {
  const { data: farmId } = useFarmId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, feedback, note }: { id: string; feedback: string; note?: string }) => {
      const { error } = await supabase
        .from("ai_recommendations")
        .update({
          feedback,
          feedback_note: note ?? null,
          status: feedback === "acted_on" ? "acted_on" : "reviewed",
          acted_on: feedback === "acted_on" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...farmScope(farmId), "ai", "recommendations"] }),
  });
}

export function useSaveQualityFlag() {
  const { data: farmId } = useFarmId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (flag: QualityFlag) => {
      if (!farmId) throw new Error("No farm selected");
      const { error } = await supabase.from("ai_data_quality_flags").insert({
        farm_id: farmId,
        source_table: flag.sourceTable,
        source_id: flag.sourceId,
        entry_date: flag.entryDate,
        rule: flag.rule,
        status: flag.status,
        detail: flag.detail,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...farmScope(farmId), "ai", "flags"] }),
  });
}

export type AssistantMessage = { id: string; role: string; content: string; created_at: string };

export function useAssistantHistory() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "ai", "assistant"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<AssistantMessage[]> => {
      const { data, error } = await supabase
        .from("ai_assistant_messages")
        .select("id, role, content, created_at")
        .eq("farm_id", farmId!)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AssistantMessage[];
    },
  });
}
