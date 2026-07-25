
ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS feed_source TEXT NOT NULL DEFAULT 'purchased'
  CHECK (feed_source IN ('purchased','self_produced'));

CREATE TABLE IF NOT EXISTS public.feed_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  bag_weight_kg NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_formulas TO authenticated;
GRANT ALL ON public.feed_formulas TO service_role;
ALTER TABLE public.feed_formulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Farm owners manage their formulas" ON public.feed_formulas
  FOR ALL TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS feed_formulas_one_active_per_farm
  ON public.feed_formulas(farm_id) WHERE is_active;

CREATE TRIGGER trg_feed_formulas_updated
  BEFORE UPDATE ON public.feed_formulas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.feed_formula_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID NOT NULL REFERENCES public.feed_formulas(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity_kg NUMERIC NOT NULL DEFAULT 0,
  price_per_unit NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg','bag')),
  unit_weight_kg NUMERIC NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_formula_ingredients TO authenticated;
GRANT ALL ON public.feed_formula_ingredients TO service_role;
ALTER TABLE public.feed_formula_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Farm owners manage their ingredients" ON public.feed_formula_ingredients
  FOR ALL TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS feed_formula_ingredients_by_formula
  ON public.feed_formula_ingredients(formula_id, position);

CREATE TRIGGER trg_feed_formula_ingredients_updated
  BEFORE UPDATE ON public.feed_formula_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
