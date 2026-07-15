import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — PoultryPro" },
      { name: "description", content: "Set a new password for your PoultryPro account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // Supabase automatically parses the recovery token from the URL hash
    // and emits PASSWORD_RECOVERY when the client is ready to update password.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setMsg("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setMsg("Passwords do not match."); return; }
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. Please sign in.");
      await supabase.auth.signOut();
      navigate({ to: "/auth", search: { mode: "signin" } });
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <Link to="/" className="flex items-center gap-3 mb-6">
          <img src={logoAsset.url} alt="PoultryPro" className="h-9 w-9 rounded" />
          <div>
            <div className="font-semibold text-foreground">PoultryPro™</div>
            <div className="text-xs text-muted-foreground">Smart Poultry Farm Management</div>
          </div>
        </Link>
        <h1 className="text-xl font-semibold text-foreground mb-1">Set a new password</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {ready ? "Enter and confirm your new password below."
            : "Waiting for your reset link session… Open this page from the email link."}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">New password</label>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoComplete="new-password" disabled={!ready} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Confirm password</label>
            <input type="password" required minLength={6} value={confirm} onChange={e => setConfirm(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoComplete="new-password" disabled={!ready} />
          </div>
          {msg && <p className="text-sm text-destructive">{msg}</p>}
          <button type="submit" disabled={loading || !ready}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
