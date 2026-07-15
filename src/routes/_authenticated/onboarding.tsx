import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Create Your Farm Profile — PoultryPro" },
      { name: "description", content: "Set up your poultry farm profile to start using PoultryPro." },
    ],
  }),
  component: OnboardingPage,
});

const FARM_TYPES = ["Layers", "Broilers", "Breeders", "Mixed Poultry"] as const;

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [farmType, setFarmType] = useState<string>("Layers");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [birdCount, setBirdCount] = useState<string>("");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If a farm already exists for this user, skip onboarding.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("farms").select("id").limit(1).maybeSingle();
      if (!cancelled) {
        if (data?.id) navigate({ to: "/dashboard", replace: true });
        else setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Farm name is required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw userErr ?? new Error("Not signed in");
      const parsedBirds = birdCount.trim() ? Math.max(0, parseInt(birdCount, 10) || 0) : null;
      const { error: insErr } = await supabase.from("farms").insert({
        owner_id: userRes.user.id,
        name: name.trim(),
        state: state.trim() || null,
        country: country.trim() || "Nigeria",
        farm_type: farmType,
        owner_name: ownerName.trim() || null,
        phone: phone.trim() || null,
        bird_count: parsedBirds,
      });
      if (insErr) throw insErr;
      await qc.invalidateQueries();
      navigate({ to: "/dashboard", replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create farm");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <img src={logoAsset.url} alt="PoultryPro" className="h-9 w-9 rounded" />
          <div>
            <div className="font-semibold text-foreground">PoultryPro™</div>
            <div className="text-xs text-muted-foreground">Smart Poultry Farm Management</div>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] uppercase tracking-[0.18em] mb-3">
          <Sparkles className="h-3.5 w-3.5" /> Farm setup
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-1">Create your farm profile</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your farm's records, analytics and AI Intelligence are private to you.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Farm Name" required>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="State / Location">
              <input value={state} onChange={e => setState(e.target.value)}
                placeholder="e.g. Katsina State"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Country">
              <input value={country} onChange={e => setCountry(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
          </div>

          <Field label="Farm Type">
            <select value={farmType} onChange={e => setFarmType(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {FARM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          <Field label="Owner / Manager Name">
            <input value={ownerName} onChange={e => setOwnerName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone Number">
              <input value={phone} onChange={e => setPhone(e.target.value)}
                inputMode="tel"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Number of Birds">
              <input value={birdCount} onChange={e => setBirdCount(e.target.value)}
                inputMode="numeric" pattern="[0-9]*"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button type="submit" disabled={submitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {submitting ? "Creating…" : "Create Farm & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
      {children}
    </div>
  );
}
