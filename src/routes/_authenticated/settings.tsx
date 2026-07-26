import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, UserCircle, Save, Scale, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFarm, useFarmId } from "@/lib/farm-data";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Farm Settings & Profile — PoultryPro" },
      { name: "description", content: "Manage your farm profile, contact details and measurement preferences in PoultryPro." },
      { property: "og:title", content: "Farm Settings & Profile — PoultryPro" },
      { property: "og:description", content: "Manage your farm profile, contact details and measurement preferences." },
    ],
  }),
  component: SettingsPage,
});

type FormState = {
  name: string; owner_name: string; phone: string;
  location: string; state: string; country: string;
  bag_weight_kg: string;
};

const EMPTY: FormState = {
  name: "", owner_name: "", phone: "", location: "", state: "", country: "", bag_weight_kg: "25",
};

function SettingsPage() {
  const farmQ = useFarm();
  const { data: farmId } = useFarmId();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    const f = farmQ.data;
    if (!f) return;
    setForm({
      name: f.name ?? "",
      owner_name: (f as any).owner_name ?? "",
      phone: (f as any).phone ?? "",
      location: (f as any).location ?? "",
      state: (f as any).state ?? "",
      country: (f as any).country ?? "",
      bag_weight_kg: f.bag_weight_kg ? String(f.bag_weight_kg) : "25",
    });
  }, [farmQ.data]);

  const save = useMutation({
    mutationFn: async (values: FormState) => {
      if (!farmId) throw new Error("No farm");
      const weight = Number(values.bag_weight_kg);
      const { error } = await supabase
        .from("farms")
        .update({
          name: values.name.trim(),
          owner_name: values.owner_name.trim() || null,
          phone: values.phone.trim() || null,
          location: values.location.trim() || null,
          state: values.state.trim() || null,
          country: values.country.trim() || null,
          bag_weight_kg: Number.isFinite(weight) && weight > 0 ? weight : 25,
        })
        .eq("id", farmId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Farm settings saved");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save settings"),
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--ink)] text-primary-foreground">
        <div className="mx-auto max-w-4xl px-4 py-8 md:py-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
            <SettingsIcon className="h-3.5 w-3.5" /> Workspace
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-primary-foreground/80">
            Farm profile, contact details and measurement preferences.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <section id="profile" className="scroll-mt-24 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
          <div className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-[color:var(--forest)]" />
            <h2 className="font-display text-xl font-semibold">Farm Profile</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Shown across your dashboard, reports and exports.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Farm name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Owner name" value={form.owner_name} onChange={(v) => setForm({ ...form, owner_name: v })} />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label="Location / town" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
            <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[color:var(--forest)]" />
            <h2 className="font-display text-xl font-semibold">Measurement Preferences</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Kilograms are the source of truth for feed. Bag counts are derived from this weight.
          </p>
          <div className="mt-5 max-w-xs">
            <Field
              label="Feed bag weight (kg)"
              value={form.bag_weight_kg}
              onChange={(v) => setForm({ ...form, bag_weight_kg: v })}
              type="number"
            />
            <div className="mt-2 flex gap-2">
              {["25", "50", "100"].map((w) => (
                <button
                  key={w}
                  onClick={() => setForm({ ...form, bag_weight_kg: w })}
                  className={
                    "rounded-full border px-3 py-1 text-xs transition " +
                    (form.bag_weight_kg === w
                      ? "border-[color:var(--forest)] bg-[color:var(--forest)] text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-secondary")
                  }
                >
                  {form.bag_weight_kg === w && <Check className="mr-1 inline h-3 w-3" />}{w} kg
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            onClick={() => save.mutate(form)}
            disabled={save.isPending || !farmId}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--forest)] px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </main>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-[color:var(--forest)] focus:ring-2 focus:ring-[color:var(--forest)]/20"
      />
    </label>
  );
}
