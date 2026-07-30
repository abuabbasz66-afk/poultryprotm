-- 1. Extend prices with effective-dating metadata
ALTER TABLE public.prices
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS note TEXT;

-- 2. Price history (immutable audit trail)
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL,
  price_id UUID,
  item TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  unit TEXT NOT NULL DEFAULT 'unit',
  old_price NUMERIC,
  new_price NUMERIC NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  device TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.price_history TO authenticated;
GRANT ALL ON public.price_history TO service_role;

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Farm owner reads price history" ON public.price_history;
CREATE POLICY "Farm owner reads price history"
  ON public.price_history FOR SELECT TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Farm owner writes price history" ON public.price_history;
CREATE POLICY "Farm owner writes price history"
  ON public.price_history FOR INSERT TO authenticated
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS price_history_farm_time_idx
  ON public.price_history (farm_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS price_history_item_idx
  ON public.price_history (farm_id, lower(item), effective_from DESC);

-- 3. Automatic history capture for the prices table
CREATE OR REPLACE FUNCTION public.on_price_change_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.price_history
      (farm_id, price_id, item, category, unit, old_price, new_price, effective_from, updated_by, note)
    VALUES
      (NEW.farm_id, NEW.id, NEW.item, COALESCE(NEW.category, 'other'), COALESCE(NEW.unit, 'unit'),
       NULL, NEW.price, COALESCE(NEW.effective_from, now()), auth.uid(), NEW.note);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.price IS DISTINCT FROM OLD.price) THEN
    IF NEW.effective_from IS NOT DISTINCT FROM OLD.effective_from THEN
      NEW.effective_from := now();
    END IF;
    INSERT INTO public.price_history
      (farm_id, price_id, item, category, unit, old_price, new_price, effective_from, updated_by, note)
    VALUES
      (NEW.farm_id, NEW.id, NEW.item, COALESCE(NEW.category, 'other'), COALESCE(NEW.unit, 'unit'),
       OLD.price, NEW.price, COALESCE(NEW.effective_from, now()), auth.uid(), NEW.note);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_price_change_history ON public.prices;
CREATE TRIGGER trg_price_change_history
  BEFORE INSERT OR UPDATE ON public.prices
  FOR EACH ROW EXECUTE FUNCTION public.on_price_change_history();

-- 4. Automatic history capture for feed formula ingredient prices
CREATE OR REPLACE FUNCTION public.on_ingredient_price_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.price_history
      (farm_id, item, category, unit, old_price, new_price, effective_from, updated_by, note)
    VALUES (NEW.farm_id, NEW.name, 'ingredient', COALESCE(NEW.unit, 'kg'),
            NULL, NEW.price_per_unit, now(), auth.uid(), 'Feed formulation ingredient');
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.price_per_unit IS DISTINCT FROM OLD.price_per_unit) THEN
    INSERT INTO public.price_history
      (farm_id, item, category, unit, old_price, new_price, effective_from, updated_by, note)
    VALUES (NEW.farm_id, NEW.name, 'ingredient', COALESCE(NEW.unit, 'kg'),
            OLD.price_per_unit, NEW.price_per_unit, now(), auth.uid(), 'Feed formulation ingredient');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ingredient_price_history ON public.feed_formula_ingredients;
CREATE TRIGGER trg_ingredient_price_history
  AFTER INSERT OR UPDATE ON public.feed_formula_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.on_ingredient_price_history();

-- 5. Backfill: categorise existing prices and seed an opening history row
UPDATE public.prices SET category =
  CASE WHEN item ILIKE '%egg%' THEN 'eggs'
       WHEN item ILIKE '%feed%' THEN 'feed'
       WHEN item ILIKE '%vaccin%' THEN 'vaccines'
       WHEN item ILIKE '%drug%' OR item ILIKE '%medic%' THEN 'medicine'
       ELSE 'other' END
WHERE category = 'other';

INSERT INTO public.price_history
  (farm_id, price_id, item, category, unit, old_price, new_price, effective_from, note)
SELECT p.farm_id, p.id, p.item, p.category, p.unit, NULL, p.price, p.created_at, 'Opening price'
FROM public.prices p
WHERE NOT EXISTS (SELECT 1 FROM public.price_history h WHERE h.price_id = p.id);