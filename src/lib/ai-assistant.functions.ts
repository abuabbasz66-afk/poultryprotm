// PoultryPro AI Assistant — grounded, farm-isolated natural language layer.
//
// The model NEVER sees another farm's data: the caller's membership is checked
// server-side, the snapshot is the caller's own computed metrics, and the
// system prompt forbids inventing values that are not in that snapshot.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AssistantTurn = { role: "user" | "assistant"; content: string };

export type AssistantInput = {
  farmId: string;
  question: string;
  snapshot: unknown;
  history: AssistantTurn[];
};

export type AssistantResult =
  | { ok: true; answer: string }
  | { ok: false; error: string; code?: number };

const SYSTEM = `You are PoultryPro AI, a farm intelligence assistant for a single poultry farm in Nigeria.

GROUNDING RULES — these override everything else:
- The JSON snapshot in the next message is the ONLY source of facts about this farm. It is already validated and farm-isolated.
- Never invent, estimate or borrow a number that is not in the snapshot. If a figure is missing, say plainly that the farm has not recorded it yet and name the record that would supply it.
- Never reference or compare against any other named farm.
- Always label what you are saying: recorded fact, AI analysis, prediction, or recommendation. State a confidence level (high / medium / low) for anything that is not a recorded fact.
- Predictions must state their range when the snapshot provides one.

SAFETY RULES:
- You may suggest actions but you must never instruct the farmer to administer medication, vaccination, a feed change or a financial transaction as a settled decision. Recommend, explain the reasoning, and tell the farmer to confirm with their veterinarian or their own judgement before acting.
- You cannot execute anything in the app. Do not claim you have made a change.

STYLE:
- Plain, practical English for a working farmer. Short paragraphs or bullets. Use ₦ for money and state units.
- Be concise: answer the question first, then the reasoning, then what to check.`;

export const askFarmAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AssistantInput) => {
    const question = String(input?.question ?? "").trim();
    if (!question) throw new Error("A question is required");
    return {
      farmId: String(input?.farmId ?? ""),
      question: question.slice(0, 2000),
      snapshot: input?.snapshot ?? {},
      history: Array.isArray(input?.history) ? input.history.slice(-8) : [],
    } satisfies AssistantInput;
  })
  .handler(async ({ data, context }): Promise<AssistantResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, error: "AI is not configured for this workspace." };

    // Farm isolation: the caller must be a member of the farm they are asking about.
    const { data: ctx, error: ctxError } = await context.supabase.rpc("my_farm_context");
    if (ctxError) return { ok: false, error: "Could not verify your farm access." };
    const callerFarm = (ctx as { farm_id?: string } | null)?.farm_id ?? null;
    if (!callerFarm || (data.farmId && data.farmId !== callerFarm)) {
      return { ok: false, error: "You do not have access to this farm's intelligence." };
    }

    const messages = [
      { role: "system", content: SYSTEM },
      { role: "system", content: `FARM SNAPSHOT (validated records only):\n${JSON.stringify(data.snapshot).slice(0, 60_000)}` },
      ...data.history.map((t) => ({ role: t.role, content: t.content })),
      { role: "user", content: data.question },
    ];

    let response: Response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({ model: "google/gemini-3.6-flash", messages }),
      });
    } catch {
      return { ok: false, error: "Could not reach the AI service. Check your connection and try again." };
    }

    if (response.status === 429) {
      return { ok: false, error: "The AI assistant is busy right now. Please try again in a moment.", code: 429 };
    }
    if (response.status === 402) {
      return { ok: false, error: "AI credits are exhausted for this workspace. Add credits to continue.", code: 402 };
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[ai-assistant] gateway error", response.status, detail.slice(0, 500));
      return { ok: false, error: "The AI assistant could not answer that right now.", code: response.status };
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = payload.choices?.[0]?.message?.content?.trim();
    if (!answer) return { ok: false, error: "The AI assistant returned an empty answer." };

    // Persist both turns under the caller's own RLS context (private per user).
    await context.supabase.from("ai_assistant_messages").insert([
      { farm_id: callerFarm, user_id: context.userId, role: "user", content: data.question },
      { farm_id: callerFarm, user_id: context.userId, role: "assistant", content: answer },
    ]);

    return { ok: true, answer };
  });
