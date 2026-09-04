-- 1. Feed types (per farm) -------------------------------------------------
CREATE TABLE public.feed_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name text NOT NULL,
  material_class text NOT NULL DEFAULT 'finished_feed'
    CHECK (material_class IN ('raw_ingredient','finished_feed','concentrate')),
  low_stock_kg numeric NOT NULL DEFAULT 0 CHECK (low_stock_kg >= 0),
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (farm_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_types TO authenticated;
GRANT ALL ON public.feed_types TO service_role;
ALTER TABLE public.feed_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed types readable by farm" ON public.feed_types FOR SELECT TO authenticated USING (public.can(farm_id, 'feed.read'));
CREATE POLICY "feed types insert" ON public.feed_types FOR INSERT TO authenticated WITH CHECK (public.can(farm_id, 'feed.write'));
CREATE POLICY "feed types update" ON public.feed_types FOR UPDATE TO authenticated USING (public.can(farm_id, 'feed.write')) WITH CHECK (public.can(farm_id, 'feed.write'));
CREATE POLICY "feed types delete" ON public.feed_types FOR DELETE TO authenticated USING (public.can(farm_id, 'feed.delete'));
CREATE TRIGGER feed_types_updated_at BEFORE UPDATE ON public.feed_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Farm ingredient profiles ----------------------------------------------
CREATE TABLE public.farm_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'raw_ingredient'
    CHECK (category IN ('raw_ingredient','finished_feed','concentrate','additive','mineral')),
  cost_per_kg numeric CHECK (cost_per_kg IS NULL OR cost_per_kg >= 0),
  cp_pct numeric,
  me_kcal_kg numeric,
  fat_pct numeric,
  fibre_pct numeric,
  ash_pct numeric,
  moisture_pct numeric,
  methionine_pct numeric,
  lysine_pct numeric,
  calcium_pct numeric,
  phosphorus_pct numeric,
  source text NOT NULL DEFAULT 'user_entered'
    CHECK (source IN ('laboratory','supplier','user_entered','poultrypro_default')),
  test_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (farm_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_ingredients TO authenticated;
GRANT ALL ON public.farm_ingredients TO service_role;
ALTER TABLE public.farm_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "farm ingredients readable" ON public.farm_ingredients FOR SELECT TO authenticated USING (public.can(farm_id, 'feed.read') OR public.can(farm_id, 'formulas.read'));
CREATE POLICY "farm ingredients insert" ON public.farm_ingredients FOR INSERT TO authenticated WITH CHECK (public.can(farm_id, 'formulas.write'));
CREATE POLICY "farm ingredients update" ON public.farm_ingredients FOR UPDATE TO authenticated USING (public.can(farm_id, 'formulas.write')) WITH CHECK (public.can(farm_id, 'formulas.write'));
CREATE POLICY "farm ingredients delete" ON public.farm_ingredients FOR DELETE TO authenticated USING (public.can(farm_id, 'formulas.write'));
CREATE TRIGGER farm_ingredients_updated_at BEFORE UPDATE ON public.farm_ingredients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Formulation version snapshots -----------------------------------------
CREATE TABLE public.feed_formula_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  formula_id uuid NOT NULL REFERENCES public.feed_formulas(id) ON DELETE CASCADE,
  version integer NOT NULL,
  name text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost_per_kg numeric,
  total_kg numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formula_id, version)
);
GRANT SELECT, INSERT, DELETE ON public.feed_formula_versions TO authenticated;
GRANT ALL ON public.feed_formula_versions TO service_role;
ALTER TABLE public.feed_formula_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "formula versions readable" ON public.feed_formula_versions FOR SELECT TO authenticated USING (public.can(farm_id, 'formulas.read') OR public.can(farm_id, 'feed.read'));
CREATE POLICY "formula versions insert" ON public.feed_formula_versions FOR INSERT TO authenticated WITH CHECK (public.can(farm_id, 'formulas.write'));
CREATE POLICY "formula versions delete" ON public.feed_formula_versions FOR DELETE TO authenticated USING (public.can(farm_id, 'formulas.write'));

-- 4. Extend feed inventory --------------------------------------------------
ALTER TABLE public.feed_inventory
  ADD COLUMN IF NOT EXISTS feed_type_id uuid REFERENCES public.feed_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bags numeric,
  ADD COLUMN IF NOT EXISTS bag_size_kg numeric,
  ADD COLUMN IF NOT EXISTS total_cost numeric,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS expense_id uuid REFERENCES public.farm_expenses(id) ON DELETE SET NULL;

-- 5. Ledger: allow transfer / return / opening ------------------------------
ALTER TABLE public.feed_ledger DROP CONSTRAINT IF EXISTS feed_ledger_action_check;
ALTER TABLE public.feed_ledger ADD CONSTRAINT feed_ledger_action_check
  CHECK (action IN ('purchase','production','usage','adjustment','transfer','return','opening'));

-- 6. Indexes ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS feed_ledger_farm_date_idx ON public.feed_ledger (farm_id, entry_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS feed_inventory_farm_date_idx ON public.feed_inventory (farm_id, purchase_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS feed_types_farm_idx ON public.feed_types (farm_id);
CREATE INDEX IF NOT EXISTS farm_ingredients_farm_idx ON public.farm_ingredients (farm_id);
CREATE INDEX IF NOT EXISTS feed_formula_versions_formula_idx ON public.feed_formula_versions (formula_id, version DESC);