ALTER TABLE public.prices ADD COLUMN IF NOT EXISTS last_device TEXT;

CREATE OR REPLACE FUNCTION public.on_price_change_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.price_history
      (farm_id, price_id, item, category, unit, old_price, new_price, effective_from, updated_by, device, note)
    VALUES
      (NEW.farm_id, NEW.id, NEW.item, COALESCE(NEW.category, 'other'), COALESCE(NEW.unit, 'unit'),
       NULL, NEW.price, COALESCE(NEW.effective_from, now()), auth.uid(), NEW.last_device, NEW.note);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.price IS DISTINCT FROM OLD.price) THEN
    IF NEW.effective_from IS NOT DISTINCT FROM OLD.effective_from THEN
      NEW.effective_from := now();
    END IF;
    INSERT INTO public.price_history
      (farm_id, price_id, item, category, unit, old_price, new_price, effective_from, updated_by, device, note)
    VALUES
      (NEW.farm_id, NEW.id, NEW.item, COALESCE(NEW.category, 'other'), COALESCE(NEW.unit, 'unit'),
       OLD.price, NEW.price, COALESCE(NEW.effective_from, now()), auth.uid(), NEW.last_device, NEW.note);
  END IF;
  RETURN NEW;
END $$;