import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shown instead of the app whenever a staff account still carries
 * `must_change_password`. The owner-issued temporary password can never be
 * used to browse the farm — it only gets you as far as this screen.
 */
export function ForcePasswordChange({ fullName }: { fullName?: string }) {
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Your new password must be at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      const { error: rpcError } = await supabase.rpc("complete_password_change");
      if (rpcError) throw rpcError;
      await qc.invalidateQueries();
      toast.success("Password updated. Welcome to PoultryPro.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not update your password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-lift)]"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--forest)]/10">
          <KeyRound className="h-6 w-6 text-[color:var(--forest)]" />
        </div>
        <h1 className="mt-5 font-display text-xl font-semibold text-foreground">
          Set your own password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {fullName ? `${fullName}, your` : "Your"} account was created with a temporary password.
          Choose a private password to continue.
        </p>

        <label className="mt-6 block text-sm font-medium text-foreground">
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-[color:var(--forest)]"
            required
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-foreground">
          Confirm password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-[color:var(--forest)]"
            required
          />
        </label>

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--forest)] px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save password and continue"}
        </button>
      </form>
    </div>
  );
}
