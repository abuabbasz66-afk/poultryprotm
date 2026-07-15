import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";
import { toast } from "sonner";

type AuthMode = "signin" | "signup" | "forgot";

function getPasswordResetRedirectUrl() {
  const { origin, hostname } = window.location;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const baseUrl = isLocal ? origin : "https://poultrypro.life";
  return `${baseUrl}/reset-password`;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: AuthMode } => {
    const m = search.mode;
    return { mode: m === "signup" || m === "forgot" || m === "signin" ? m : undefined };
  },
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
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [mode, setMode] = useState<AuthMode>(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  useEffect(() => {
    if (search.mode) setMode(search.mode);
  }, [search.mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/onboarding" },
        });
        if (error) throw error;
        // Wipe any farm/dashboard cache from a previous account on this device
        // before landing on onboarding/dashboard so no stale farm name flashes.
        await qc.cancelQueries();
        qc.clear();
        toast.success("Account created. Let's set up your farm.");
        navigate({ to: "/onboarding" });
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await qc.cancelQueries();
        qc.clear();
        navigate({ to: "/dashboard" });
      } else {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) throw new Error("Please enter your email address.");
        const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: getPasswordResetRedirectUrl(),
        });
        if (error) {
          // Safe dev-only log; never expose to end users.
          if (import.meta.env.DEV) console.error("[password-recovery]", error.message);
          // Rate-limit is the only case we surface distinctly, without revealing account existence.
          if (/rate|too many/i.test(error.message)) {
            throw new Error("Too many requests. Please wait a minute and try again.");
          }
          throw new Error("We couldn't process that request right now. Please try again shortly.");
        }
        toast.success(
          "If an account exists for this email, password reset instructions have been sent. Please check your inbox and spam folder.",
        );
        setMode("signin");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "signin" ? "Sign in to your farm"
    : mode === "signup" ? "Create your farm account"
    : "Reset your password";
  const subtitle = mode === "signin" ? "Access your saved farm records and analytics."
    : mode === "signup" ? "You'll set up your farm profile in the next step."
    : "Enter your email and we'll send you a reset link.";

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

        {mode !== "forgot" && (
          <div className="mb-6 grid grid-cols-2 rounded-full bg-secondary/60 p-1 text-sm">
            <button type="button" onClick={() => { setMode("signin"); setMsg(null); }}
              className={`rounded-full px-3 py-1.5 font-medium transition ${mode === "signin" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              Sign In
            </button>
            <button type="button" onClick={() => { setMode("signup"); setMsg(null); }}
              className={`rounded-full px-3 py-1.5 font-medium transition ${mode === "signup" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              Create Account
            </button>
          </div>
        )}

        <h1 className="text-xl font-semibold text-foreground mb-1">{title}</h1>
        <p className="text-sm text-muted-foreground mb-6">{subtitle}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoComplete="email"
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-foreground">Password</label>
                {mode === "signin" && (
                  <button type="button" onClick={() => { setMode("forgot"); setMsg(null); }}
                    className="text-xs text-[color:var(--forest)] hover:underline">
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
          )}
          {msg && <p className="text-sm text-destructive">{msg}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Please wait…"
              : mode === "signin" ? "Sign in"
              : mode === "signup" ? "Create account"
              : "Send reset link"}
          </button>
        </form>
        {mode === "forgot" && (
          <button
            onClick={() => { setMode("signin"); setMsg(null); }}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}
