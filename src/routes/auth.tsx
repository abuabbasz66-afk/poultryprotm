import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PoultryPro" },
      { name: "description", content: "Sign in or create your PoultryPro account to manage your farm." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <img src={logoAsset.url} alt="PoultryPro" className="h-9 w-9 rounded" />
          <div>
            <div className="font-semibold text-foreground">PoultryPro™</div>
            <div className="text-xs text-muted-foreground">Smart Poultry Farm Management</div>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-1">
          {mode === "signin" ? "Sign in to your farm" : "Create your farm account"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signin"
            ? "Access your saved farm records and analytics."
            : "Your farm is created automatically on sign-up."}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Password</label>
            <input
              type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>
          {msg && <p className="text-sm text-destructive">{msg}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
