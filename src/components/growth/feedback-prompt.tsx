import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useActivation, useOnboarding, useSaveOnboarding, useSubmitFeedback } from "@/lib/growth";

const SENTIMENTS = [
  { key: "very_useful", emoji: "😍", label: "Very useful" },
  { key: "useful", emoji: "🙂", label: "Useful" },
  { key: "figuring_out", emoji: "😐", label: "Still figuring it out" },
  { key: "difficult", emoji: "😕", label: "Difficult to use" },
  { key: "not_meeting", emoji: "😞", label: "Not meeting my needs" },
];

/**
 * Lightweight feedback ask. Only appears once the farm has genuinely used
 * PoultryPro (3+ active days), and never again after it is answered or closed.
 */
export function FeedbackPrompt() {
  const { data: activation } = useActivation();
  const { data: onboarding } = useOnboarding();
  const save = useSaveOnboarding();
  const submit = useSubmitFeedback();
  const [sentiment, setSentiment] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const eligible =
    !!activation?.activated && (activation?.activeDays ?? 0) >= 3 && !onboarding?.feedbackPromptDismissedAt;

  if (!eligible) return null;

  const dismiss = () => save.mutate({ feedback_prompt_dismissed_at: new Date().toISOString() });

  const send = async () => {
    if (!sentiment) return;
    try {
      await submit.mutateAsync({
        kind: "product",
        farmId: activation?.farmId ?? null,
        sentiment,
        message: message.trim() || null,
      });
      save.mutate({ feedback_prompt_dismissed_at: new Date().toISOString() });
      toast.success("Thank you — your feedback was sent to the PoultryPro team.");
    } catch {
      toast.error("Could not send your feedback. Please try again.");
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-base font-semibold">How is PoultryPro working for you?</h2>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss feedback request"
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SENTIMENTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSentiment(s.key)}
            aria-pressed={sentiment === s.key}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm transition ${
              sentiment === s.key
                ? "border-[color:var(--gold)] bg-secondary font-medium"
                : "border-border bg-background hover:bg-secondary"
            }`}
          >
            <span aria-hidden>{s.emoji}</span> {s.label}
          </button>
        ))}
      </div>

      {sentiment && (
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium" htmlFor="pp-feedback-text">
            What would make PoultryPro more useful to you? (optional)
          </label>
          <textarea
            id="pp-feedback-text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-input bg-background p-3 text-sm"
          />
          <button
            type="button"
            onClick={send}
            disabled={submit.isPending}
            className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {submit.isPending ? "Sending…" : "Send feedback"}
          </button>
        </div>
      )}
    </section>
  );
}
