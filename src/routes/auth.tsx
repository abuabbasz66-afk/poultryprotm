import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";
import heroAsset from "@/assets/hero-layer-birds.jpg.asset.json";
import { toast } from "sonner";
import {
  ArrowLeft, Eye, EyeOff, Check, ShieldCheck, Lock, CloudUpload,
  Headphones, ClipboardList, LineChart, Sparkles,
} from "lucide-react";

type AuthMode = "signin" | "signup" | "forgot";

function getPasswordResetRedirectUrl() {
  const { origin, hostname } = window.location;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const baseUrl = isLocal ? origin : "https://poultrypro.life";
  return `${baseUrl}/reset-password`;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: AuthMode; redirect?: string } => {
    const m = search.mode;
    const r = typeof search.redirect === "string" ? search.redirect : undefined;
    return {
      mode: m === "signup" || m === "forgot" || m === "signin" ? m : undefined,
      redirect: r,
    };
  },
  head: () => ({
    meta: [
      { title: "Sign in — PoultryPro" },
      { name: "description", content: "Sign in or create your PoultryPro account to manage your farm." },
    ],
  }),
  component: AuthPage,
});

function passwordScore(pw: string) {
  return {
    length: pw.length >= 8,
    number: /\d/.test(pw),
    upper: /[A-Z]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [mode, setMode] = useState<AuthMode>(search.mode ?? "signin");

  // Separate, independent state per form. Switching modes must never share data.
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [stateRegion, setStateRegion] = useState("");

  const [forgotEmail, setForgotEmail] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Derived values for the currently active form
  const email = mode === "signin" ? signInEmail : mode === "signup" ? signUpEmail : forgotEmail;
  const setEmail = (v: string) => {
    if (mode === "signin") setSignInEmail(v);
    else if (mode === "signup") setSignUpEmail(v);
    else setForgotEmail(v);
  };
  const password = mode === "signin" ? signInPassword : signUpPassword;
  const setPassword = (v: string) => {
    if (mode === "signin") setSignInPassword(v);
    else setSignUpPassword(v);
  };

  const redirectTo = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/dashboard";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirectTo });
    });
  }, [navigate, redirectTo]);

  // Sync mode with URL so browser back/forward moves between Sign In / Create Account.
  useEffect(() => {
    const next = search.mode ?? "signin";
    setMode((current) => (current === next ? current : next));
    setMsg(null);
    setShowPassword(false);
  }, [search.mode]);

  const pwChecks = useMemo(() => passwordScore(signUpPassword), [signUpPassword]);
  const pwStrength = Object.values(pwChecks).filter(Boolean).length;

  const setModeAndUrl = (m: AuthMode) => {
    if (m === mode) return;
    setMsg(null);
    navigate({ to: "/auth", search: { mode: m, redirect: search.redirect }, replace: false });
  };


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        if (pwStrength < 4) throw new Error("Please meet all password requirements.");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/onboarding",
            data: {
              full_name: fullName,
              farm_name: farmName,
              phone,
              country,
              state: stateRegion,
            },
          },
        });
        if (error) throw error;
        await qc.cancelQueries();
        qc.clear();
        toast.success("Account created. Let's set up your farm.");
        navigate({ to: "/onboarding" });
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await qc.cancelQueries();
        qc.clear();
        navigate({ to: redirectTo });
      } else {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) throw new Error("Please enter your email address.");
        const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: getPasswordResetRedirectUrl(),
        });
        if (error) {
          if (import.meta.env.DEV) console.error("[password-recovery]", error.message);
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

  const heading =
    mode === "signin" ? "Welcome back"
    : mode === "signup" ? "Create your PoultryPro Account"
    : "Reset your password";
  const sub =
    mode === "signin" ? "Sign in to continue managing your poultry farm."
    : mode === "signup" ? "Start digitizing your poultry farm in minutes."
    : "Enter your email and we'll send you a secure reset link.";

  const submitLabel = loading
    ? (mode === "signin" ? "Signing in…" : mode === "signup" ? "Creating account…" : "Sending link…")
    : (mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Send reset link");

  return (
    <div className="min-h-screen bg-[#FAF9F6] hero-fade-up">
      <div className="lg:grid lg:grid-cols-[45fr_55fr] min-h-screen">
        {/* LEFT: form */}
        <div className="flex flex-col px-5 sm:px-10 lg:px-16 py-6 lg:py-10">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
            <Link to="/" className="flex items-center gap-2" aria-label="PoultryPro home">
              <img src={logoAsset.url} alt="" className="h-8 w-8 rounded" />
              <span className="font-semibold text-foreground">PoultryPro™</span>
            </Link>
          </div>

          <div className="mx-auto w-full max-w-md flex-1 flex flex-col justify-center py-10">
            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{heading}</h1>
              <p className="mt-2 text-[15px] text-muted-foreground">{sub}</p>
            </div>

            {mode !== "forgot" && (
              <div className="mb-6 grid grid-cols-2 rounded-full bg-secondary/70 p-1 text-sm">
                <button type="button" onClick={() => setModeAndUrl("signin")}
                  className={`rounded-full px-3 py-2 font-medium transition ${mode === "signin" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  Sign In
                </button>
                <button type="button" onClick={() => setModeAndUrl("signup")}
                  className={`rounded-full px-3 py-2 font-medium transition ${mode === "signup" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  Create Account
                </button>
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Full Name" value={fullName} onChange={setFullName} type="text" autoComplete="name" required />
                  <Field label="Farm Name" value={farmName} onChange={setFarmName} type="text" required />
                </div>
              )}

              <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" required />

              {mode === "signup" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Phone Number" value={phone} onChange={setPhone} type="tel" autoComplete="tel" />
                  <Field label="Country" value={country} onChange={setCountry} type="text" />
                </div>
              )}
              {mode === "signup" && (
                <Field label="State / Region" value={stateRegion} onChange={setStateRegion} type="text" />
              )}

              {mode !== "forgot" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-foreground">Password</label>
                    {mode === "signin" && (
                      <button type="button" onClick={() => setModeAndUrl("forgot")}
                        className="text-xs font-medium text-[color:var(--forest)] hover:underline">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"} required minLength={mode === "signup" ? 8 : 6}
                      value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-input bg-white px-3.5 py-2.5 text-sm pr-10 outline-none transition focus:border-[color:var(--forest)] focus:ring-2 focus:ring-[color:var(--forest)]/20"
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {mode === "signup" && (
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} className={`h-1.5 flex-1 rounded-full transition ${
                            i < pwStrength
                              ? pwStrength <= 1 ? "bg-red-400"
                              : pwStrength === 2 ? "bg-amber-400"
                              : pwStrength === 3 ? "bg-yellow-500"
                              : "bg-emerald-500"
                              : "bg-border"
                          }`} />
                        ))}
                      </div>
                      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <PwCheck ok={pwChecks.length} label="8+ characters" />
                        <PwCheck ok={pwChecks.number} label="Number" />
                        <PwCheck ok={pwChecks.upper} label="Uppercase" />
                        <PwCheck ok={pwChecks.special} label="Special character" />
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {mode === "signup" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                  <input
                    type={showPassword ? "text" : "password"} required minLength={8}
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-input bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[color:var(--forest)] focus:ring-2 focus:ring-[color:var(--forest)]/20"
                    autoComplete="new-password"
                  />
                </div>
              )}

              {mode === "signin" && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-[color:var(--forest)] focus:ring-[color:var(--forest)]/30" />
                  Remember me on this device
                </label>
              )}

              {msg && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{msg}</p>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full rounded-lg bg-[color:var(--forest)] px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {submitLabel}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" && (
                <>Don't have an account?{" "}
                  <button onClick={() => setModeAndUrl("signup")} className="font-semibold text-[color:var(--forest)] hover:underline">Create Account</button>
                </>
              )}
              {mode === "signup" && (
                <>Already have an account?{" "}
                  <button onClick={() => setModeAndUrl("signin")} className="font-semibold text-[color:var(--forest)] hover:underline">Sign In</button>
                </>
              )}
              {mode === "forgot" && (
                <button onClick={() => setModeAndUrl("signin")} className="font-medium hover:text-foreground">← Back to sign in</button>
              )}
            </div>

            {/* Trust section */}
            <div className="mt-10 pt-6 border-t border-border/70">
              <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Trusted by poultry farmers across Nigeria
              </p>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <TrustBadge icon={<CloudUpload className="h-3.5 w-3.5" />} label="Secure Cloud" />
                <TrustBadge icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Private Data" />
                <TrustBadge icon={<Lock className="h-3.5 w-3.5" />} label="Encrypted Login" />
                <TrustBadge icon={<Headphones className="h-3.5 w-3.5" />} label="Reliable Support" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: branding panel */}
        <div className="relative hidden lg:block overflow-hidden">
          <img src={heroAsset.url} alt="Modern poultry farm" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--forest)]/95 via-[color:var(--forest)]/85 to-[color:var(--ink)]/90" />
          <div className="relative flex h-full flex-col justify-between p-12 xl:p-16 text-white">
            <div className="flex items-center gap-3">
              <img src={logoAsset.url} alt="" className="h-10 w-10 rounded-lg bg-white/10 p-1" />
              <div>
                <div className="text-lg font-semibold">PoultryPro™</div>
                <div className="text-xs text-white/70">Smart Poultry Management Platform</div>
              </div>
            </div>

            <div className="max-w-lg">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
                <Sparkles className="h-3 w-3" />
                Built for modern poultry farms
              </div>
              <h2 className="mt-5 text-4xl xl:text-5xl font-bold tracking-tight leading-[1.05]">
                Run a smarter, more profitable poultry farm.
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-white/85">
                Digitize your farm records, understand performance, monitor profitability
                and unlock intelligent insights—all in one platform.
              </p>

              <ul className="mt-8 space-y-3">
                <Feature icon={<ClipboardList className="h-4 w-4" />} label="Daily Farm Records" />
                <Feature icon={<LineChart className="h-4 w-4" />} label="Business Analytics" />
                <Feature icon={<Sparkles className="h-4 w-4" />} label="AI-powered Insights" />
              </ul>
            </div>

            <div className="text-xs text-white/60">
              © {new Date().getFullYear()} PoultryPro™. Empowering African poultry farmers.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type, autoComplete, required }: {
  label: string; value: string; onChange: (v: string) => void;
  type: string; autoComplete?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <input
        type={type} required={required} value={value} onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-input bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[color:var(--forest)] focus:ring-2 focus:ring-[color:var(--forest)]/20"
      />
    </div>
  );
}

function PwCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`inline-flex items-center gap-1.5 ${ok ? "text-emerald-600" : "text-muted-foreground"}`}>
      <Check className={`h-3 w-3 ${ok ? "opacity-100" : "opacity-40"}`} />
      {label}
    </li>
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1.5 text-muted-foreground">
      {icon}
      <span className="truncate">{label}</span>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">{icon}</span>
      <span className="text-[15px] font-medium">{label}</span>
    </li>
  );
}
