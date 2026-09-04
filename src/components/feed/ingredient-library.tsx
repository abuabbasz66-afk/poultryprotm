// Farm ingredient library — laboratory-tested values, clearly labelled by
// source. Values outside the reference range warn; they are never changed.
import { useState } from "react";
import { AlertTriangle, Beaker, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  useFarmIngredients, useSaveFarmIngredient, useDeleteFarmIngredient,
  INGREDIENT_SOURCE_LABELS, INGREDIENT_CATEGORY_LABELS, outOfRangeFields,
  type FarmIngredient, type FarmIngredientInput, type IngredientCategory, type IngredientSource,
} from "@/lib/farm-ingredients-data";
import { friendlyError } from "@/lib/error-message";

const NUM_FIELDS: { key: keyof FarmIngredientInput; label: string; suffix?: string }[] = [
  { key: "cost_per_kg", label: "Cost per kg", suffix: "₦" },
  { key: "cp_pct", label: "Crude protein", suffix: "%" },
  { key: "me_kcal_kg", label: "Energy", suffix: "kcal/kg" },
  { key: "fat_pct", label: "Fat", suffix: "%" },
  { key: "fibre_pct", label: "Fibre", suffix: "%" },
  { key: "ash_pct", label: "Ash", suffix: "%" },
  { key: "moisture_pct", label: "Moisture", suffix: "%" },
  { key: "methionine_pct", label: "Methionine", suffix: "%" },
  { key: "lysine_pct", label: "Lysine", suffix: "%" },
  { key: "calcium_pct", label: "Calcium", suffix: "%" },
  { key: "phosphorus_pct", label: "Phosphorus", suffix: "%" },
];

export function IngredientLibrary() {
  const q = useFarmIngredients();
  const del = useDeleteFarmIngredient();
  const [editing, setEditing] = useState<FarmIngredient | "new" | null>(null);
  const list = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Ingredient library</h2>
          <p className="text-xs text-muted-foreground">
            Your farm's own tested values. Where an ingredient is not listed here, PoultryPro reference values are used and labelled as such.
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--forest)] px-4 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Ingredient
        </button>
      </div>

      {editing && (
        <IngredientForm initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}

      {list.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-center">
          <Beaker className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No ingredient profiles yet</p>
          <p className="text-xs text-muted-foreground">Add your laboratory results so formulations use your real values.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((i) => (
            <li key={i.id} className="rounded-3xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{INGREDIENT_CATEGORY_LABELS[i.category]}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => setEditing(i)} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await del.mutateAsync(i.id);
                        toast.success("Ingredient removed");
                      } catch (e) {
                        toast.error(friendlyError(e, "Unable to remove this ingredient."));
                      }
                    }}
                    className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  Source: {INGREDIENT_SOURCE_LABELS[i.source]}
                </span>
                {i.test_date && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    Tested {new Date(i.test_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {NUM_FIELDS.filter((f) => i[f.key as keyof FarmIngredient] != null).map((f) => (
                  <div key={String(f.key)} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="font-medium">
                      {String(i[f.key as keyof FarmIngredient])} {f.suffix === "₦" ? "" : f.suffix}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IngredientForm({ initial, onClose }: { initial: FarmIngredient | null; onClose: () => void }) {
  const save = useSaveFarmIngredient();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of NUM_FIELDS) {
      const raw = initial ? (initial as unknown as Record<string, unknown>)[String(f.key)] : null;
      v[String(f.key)] = raw == null ? "" : String(raw);
    }
    return v;
  });
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<IngredientCategory>(initial?.category ?? "raw_ingredient");
  const [source, setSource] = useState<IngredientSource>(initial?.source ?? "laboratory");
  const [testDate, setTestDate] = useState(initial?.test_date ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const numeric = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v === "" ? null : Number(v)]),
  ) as Partial<FarmIngredientInput>;
  const warnings = outOfRangeFields(numeric);

  const submit = async () => {
    try {
      await save.mutateAsync({
        id: initial?.id,
        values: {
          name,
          category,
          source,
          test_date: testDate || null,
          notes: notes || null,
          cost_per_kg: numeric.cost_per_kg ?? null,
          cp_pct: numeric.cp_pct ?? null,
          me_kcal_kg: numeric.me_kcal_kg ?? null,
          fat_pct: numeric.fat_pct ?? null,
          fibre_pct: numeric.fibre_pct ?? null,
          ash_pct: numeric.ash_pct ?? null,
          moisture_pct: numeric.moisture_pct ?? null,
          methionine_pct: numeric.methionine_pct ?? null,
          lysine_pct: numeric.lysine_pct ?? null,
          calcium_pct: numeric.calcium_pct ?? null,
          phosphorus_pct: numeric.phosphorus_pct ?? null,
        },
      });
      toast.success(initial ? "Ingredient updated" : "Ingredient added");
      onClose();
    } catch (e) {
      toast.error(friendlyError(e, "Unable to save this ingredient."));
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">{initial ? "Edit ingredient" : "Add ingredient"}</h3>
        <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as IngredientCategory)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
            {(Object.keys(INGREDIENT_CATEGORY_LABELS) as IngredientCategory[]).map((k) => (
              <option key={k} value={k}>{INGREDIENT_CATEGORY_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Value source</span>
          <select value={source} onChange={(e) => setSource(e.target.value as IngredientSource)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
            {(Object.keys(INGREDIENT_SOURCE_LABELS) as IngredientSource[]).map((k) => (
              <option key={k} value={k}>{INGREDIENT_SOURCE_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Test date</span>
          <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" />
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {NUM_FIELDS.map((f) => (
          <label key={String(f.key)} className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              {f.label} {f.suffix ? `(${f.suffix})` : ""}
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={values[String(f.key)] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [String(f.key)]: e.target.value }))}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
          </label>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Notes</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" />
      </label>

      {warnings.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Lab value outside configured reference range: {warnings.join(", ")}. Your value is kept exactly as entered.
        </p>
      )}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button onClick={onClose} className="min-h-11 rounded-full border border-border px-4 text-sm font-medium">Cancel</button>
        <button
          onClick={submit}
          disabled={!name.trim() || save.isPending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--forest)] px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
        </button>
      </div>
    </div>
  );
}
