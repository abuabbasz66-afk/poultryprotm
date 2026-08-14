// Persistence for AI intelligence output: recommendation lifecycle, farmer
// approval/rejection (the learning signal), outcome tracking and data-quality
// review flags. Every query is farm-scoped and enforced again by RLS.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { farmScope, useAuthUserId, useFarmId } from "@/lib/farm-data";
import type { Insight } from "@/lib/ai/engine";
import type { QualityFlag } from "@/lib/ai/quality";
import {
  EMPTY_PERFORMANCE, signalWeight,
  type Benchmarks, type Decision, type Outcome, type Performance,
} from "@/lib/ai/learning";

export const INTELLIGENCE_VERSION = "v1.1";

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
  decision_reason: string | null;
  outcome: string | null;
  outcome_date: string | null;
  outcome_note: string | null;
  room_label: string | null;
  before_metrics: unknown;
  after_metrics: unknown;
  intelligence_version: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const COLUMNS =
  "id, insight_key, category, severity, title, summary, confidence, status, feedback, feedback_note, decision_reason, outcome, outcome_date, outcome_note, room_label, before_metrics, after_metrics, intelligence_version, reviewed_at, created_at";

export function useAiRecommendations() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "ai", "recommendations"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<StoredRecommendation[]> => {
      const { data, error } = await supabase
        .from("ai_recommendations")
        .select(COLUMNS)
        .eq("farm_id", farmId!)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as StoredRecommendation[];
    },
  });
}

/** Records newly generated insights once, so decisions and outcomes can be tracked over time. */
export function useSyncInsights() {
  const { data: farmId } = useFarmId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ insights, baselines }: { insights: Insight[]; baselines?: unknown }) => {
      if (!farmId || insights.length === 0) return;
      const { data: existing, error } = await supabase
        .from("ai_recommendations")
        .select("insight_key")
        .eq("farm_id", farmId)
        .in("status", ["open", "new", "viewed", "approved"]);
      if (error) throw error;
      const live = new Set((existing ?? []).map((r) => r.insight_key));
      const rows = insights
        .filter((i) => !live.has(i.key))
        .map((i) => ({
          farm_id: farmId,
          insight_key: i.key,
          category: i.category,
          severity: i.severity,
          title: i.title,
          summary: i.observed,
          confidence: i.confidence.score,
          status: "open",
          intelligence_version: INTELLIGENCE_VERSION,
          before_metrics: (baselines ?? {}) as unknown as Json,
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

function useInvalidateAi() {
  const { data: farmId } = useFarmId();
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [...farmScope(farmId), "ai", "recommendations"] });
    qc.invalidateQueries({ queryKey: [...farmScope(farmId), "ai", "performance"] });
    qc.invalidateQueries({ queryKey: [...farmScope(farmId), "ai", "signals"] });
  };
}

/**
 * Approve / reject / dismiss a recommendation. The decision is stored on the
 * recommendation AND written to the learning ledger so the engine's relevance
 * can be measured per farm over time.
 */
export function useDecideRecommendation() {
  const { data: farmId } = useFarmId();
  const { data: userId } = useAuthUserId();
  const invalidate = useInvalidateAi();
  return useMutation({
    mutationFn: async (args: {
      rec: StoredRecommendation;
      decision: Decision;
      reason?: string | null;
      note?: string | null;
    }) => {
      if (!farmId) throw new Error("No farm selected");
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("ai_recommendations")
        .update({
          status: args.decision,
          decision_reason: args.reason ?? null,
          feedback: args.decision === "approved" ? "helpful" : args.decision === "rejected" ? "not_helpful" : "dismissed",
          feedback_note: args.note ?? null,
          reviewed_at: now,
          resolved_by: userId ?? null,
          resolved_at: args.decision === "approved" ? null : now,
        })
        .eq("id", args.rec.id);
      if (error) throw error;

      const { error: signalError } = await supabase.from("ai_learning_signals").insert({
        farm_id: farmId,
        recommendation_id: args.rec.id,
        signal_type: args.decision,
        insight_key: args.rec.insight_key,
        category: args.rec.category,
        weight: signalWeight(args.decision),
        intelligence_version: INTELLIGENCE_VERSION,
        created_by: userId ?? null,
        payload: {
          severity: args.rec.severity,
          confidence: args.rec.confidence,
          reason: args.reason ?? null,
          note: args.note ?? null,
        },
      });
      if (signalError) throw signalError;
    },
    onSuccess: invalidate,
  });
}

/** Close the loop: what actually happened after the farmer acted. */
export function useRecordOutcome() {
  const { data: farmId } = useFarmId();
  const { data: userId } = useAuthUserId();
  const invalidate = useInvalidateAi();
  return useMutation({
    mutationFn: async (args: {
      rec: StoredRecommendation;
      outcome: Outcome;
      note?: string | null;
      afterMetrics?: unknown;
    }) => {
      if (!farmId) throw new Error("No farm selected");
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("ai_recommendations")
        .update({
          status: "completed",
          outcome: args.outcome,
          outcome_date: now,
          outcome_note: args.note ?? null,
          after_metrics: (args.afterMetrics ?? {}) as unknown as Json,
          acted_on: now,
          resolved_by: userId ?? null,
          resolved_at: now,
        })
        .eq("id", args.rec.id);
      if (error) throw error;

      const { error: signalError } = await supabase.from("ai_learning_signals").insert({
        farm_id: farmId,
        recommendation_id: args.rec.id,
        signal_type: "outcome",
        insight_key: args.rec.insight_key,
        category: args.rec.category,
        weight: signalWeight("outcome", args.outcome),
        intelligence_version: INTELLIGENCE_VERSION,
        created_by: userId ?? null,
        payload: {
          outcome: args.outcome,
          note: args.note ?? null,
          before: (args.rec.before_metrics ?? null) as Json,
          after: (args.afterMetrics ?? null) as Json,
        },
      });
      if (signalError) throw signalError;
    },
    onSuccess: invalidate,
  });
}

/** How the engine is performing for THIS farm. */
export function useRecommendationPerformance() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "ai", "performance"],
    enabled: !!farmId,
    networkMode: "always",
    queryFn: async (): Promise<Performance> => {
      const { data, error } = await supabase.rpc("ai_recommendation_performance", { _farm_id: farmId! });
      if (error) throw error;
      return { ...EMPTY_PERFORMANCE, ...((data ?? {}) as Partial<Performance>) };
    },
  });
}

/** Anonymous comparison against farms of a similar size. Never names another farm. */
export function useFarmBenchmarks() {
  const { data: farmId } = useFarmId();
  return useQuery({
    queryKey: [...farmScope(farmId), "ai", "benchmarks"],
    enabled: !!farmId,
    networkMode: "always",
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Benchmarks> => {
      const { data, error } = await supabase.rpc("ai_farm_benchmarks", { _farm_id: farmId! });
      if (error) throw error;
      return (data ?? { available: false }) as Benchmarks;
    },
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
