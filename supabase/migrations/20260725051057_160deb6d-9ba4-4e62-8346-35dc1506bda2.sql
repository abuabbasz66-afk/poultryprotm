
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.feed_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  feed_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'purchase' CHECK (source IN ('purchase','production','adjustment')),
  initial_kg NUMERIC(12,2) NOT NULL CHECK (initial_kg >= 0),
  remaining_kg NUMERIC(12,2) NOT NULL CHECK (remaining_kg >= 0),
  unit_cost_per_kg NUMERIC(12,4) NOT NULL DEFAULT 0,
  supplier TEXT,
  batch_number TEXT,
  purchase_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  expiry_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feed_inventory_farm_date ON public.feed_inventory(farm_id, purchase_date);
CREATE INDEX idx_feed_inventory_farm_remaining ON public.feed_inventory(farm_id) WHERE remaining_kg > 0;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_inventory TO authenticated;
GRANT ALL ON public.feed_inventory TO service_role;
ALTER TABLE public.feed_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farm owner manages feed_inventory"
  ON public.feed_inventory FOR ALL
  USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

CREATE TRIGGER trg_feed_inventory_updated_at
  BEFORE UPDATE ON public.feed_inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.feed_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  action TEXT NOT NULL CHECK (action IN ('purchase','production','usage','adjustment')),
  quantity_kg NUMERIC(12,2) NOT NULL,
  balance_after_kg NUMERIC(14,2) NOT NULL DEFAULT 0,
  inventory_id UUID REFERENCES public.feed_inventory(id) ON DELETE SET NULL,
  source_ref UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feed_ledger_farm_date ON public.feed_ledger(farm_id, entry_date DESC, created_at DESC);
CREATE INDEX idx_feed_ledger_source_ref ON public.feed_ledger(source_ref) WHERE source_ref IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_ledger TO authenticated;
GRANT ALL ON public.feed_ledger TO service_role;
ALTER TABLE public.feed_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farm owner manages feed_ledger"
  ON public.feed_ledger FOR ALL
  USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.farm_feed_stock_kg(_farm_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(remaining_kg), 0)::NUMERIC FROM public.feed_inventory WHERE farm_id = _farm_id;
$$;

CREATE OR REPLACE FUNCTION public.consume_feed_fifo(
  _farm_id UUID, _kg NUMERIC, _entry_date DATE, _source_ref UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _remaining NUMERIC := _kg;
  _take NUMERIC;
  _lot RECORD;
  _balance NUMERIC;
BEGIN
  IF _kg IS NULL OR _kg <= 0 THEN RETURN; END IF;
  FOR _lot IN
    SELECT id, remaining_kg FROM public.feed_inventory
    WHERE farm_id = _farm_id AND remaining_kg > 0
    ORDER BY purchase_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN _remaining <= 0;
    _take := LEAST(_lot.remaining_kg, _remaining);
    UPDATE public.feed_inventory SET remaining_kg = remaining_kg - _take WHERE id = _lot.id;
    _balance := public.farm_feed_stock_kg(_farm_id);
    INSERT INTO public.feed_ledger(farm_id, entry_date, action, quantity_kg, balance_after_kg, inventory_id, source_ref, note)
    VALUES (_farm_id, _entry_date, 'usage', -_take, _balance, _lot.id, _source_ref, 'Auto-deducted from daily feed usage');
    _remaining := _remaining - _take;
  END LOOP;
  IF _remaining > 0 THEN
    _balance := public.farm_feed_stock_kg(_farm_id);
    INSERT INTO public.feed_ledger(farm_id, entry_date, action, quantity_kg, balance_after_kg, inventory_id, source_ref, note)
    VALUES (_farm_id, _entry_date, 'usage', -_remaining, _balance, NULL, _source_ref,
            'Usage recorded with no inventory on hand — add a purchase to reconcile.');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.on_feed_usage_apply_inventory()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _bag_weight NUMERIC;
  _kg NUMERIC;
  _lot RECORD;
  _restore NUMERIC;
  _balance NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(bag_weight_kg, 25) INTO _bag_weight FROM public.farms WHERE id = NEW.farm_id;
    _kg := COALESCE(NEW.bags, 0) * COALESCE(_bag_weight, 25);
    IF _kg > 0 THEN PERFORM public.consume_feed_fifo(NEW.farm_id, _kg, NEW.date::date, NEW.id); END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    FOR _lot IN
      SELECT l.id AS ledger_id, l.inventory_id, l.quantity_kg, i.initial_kg
      FROM public.feed_ledger l LEFT JOIN public.feed_inventory i ON i.id = l.inventory_id
      WHERE l.source_ref = OLD.id AND l.action = 'usage'
    LOOP
      _restore := -_lot.quantity_kg;
      IF _lot.inventory_id IS NOT NULL AND _restore > 0 THEN
        UPDATE public.feed_inventory SET remaining_kg = LEAST(initial_kg, remaining_kg + _restore) WHERE id = _lot.inventory_id;
      END IF;
      DELETE FROM public.feed_ledger WHERE id = _lot.ledger_id;
    END LOOP;
    _balance := public.farm_feed_stock_kg(OLD.farm_id);
    INSERT INTO public.feed_ledger(farm_id, entry_date, action, quantity_kg, balance_after_kg, source_ref, note)
    VALUES (OLD.farm_id, OLD.date::date, 'adjustment', 0, _balance, OLD.id, 'Reversed deleted feed usage');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(bag_weight_kg, 25) INTO _bag_weight FROM public.farms WHERE id = NEW.farm_id;
    _kg := COALESCE(NEW.bags, 0) * COALESCE(_bag_weight, 25);
    FOR _lot IN
      SELECT l.id AS ledger_id, l.inventory_id, l.quantity_kg, i.initial_kg
      FROM public.feed_ledger l LEFT JOIN public.feed_inventory i ON i.id = l.inventory_id
      WHERE l.source_ref = NEW.id AND l.action = 'usage'
    LOOP
      _restore := -_lot.quantity_kg;
      IF _lot.inventory_id IS NOT NULL AND _restore > 0 THEN
        UPDATE public.feed_inventory SET remaining_kg = LEAST(initial_kg, remaining_kg + _restore) WHERE id = _lot.inventory_id;
      END IF;
      DELETE FROM public.feed_ledger WHERE id = _lot.ledger_id;
    END LOOP;
    IF _kg > 0 THEN PERFORM public.consume_feed_fifo(NEW.farm_id, _kg, NEW.date::date, NEW.id); END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_feed_usage_apply_inventory ON public.feed_usage;
CREATE TRIGGER trg_feed_usage_apply_inventory
  AFTER INSERT OR UPDATE OR DELETE ON public.feed_usage
  FOR EACH ROW EXECUTE FUNCTION public.on_feed_usage_apply_inventory();

CREATE OR REPLACE FUNCTION public.on_feed_inventory_log()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _balance NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.initial_kg > 0 THEN
    _balance := public.farm_feed_stock_kg(NEW.farm_id);
    INSERT INTO public.feed_ledger(farm_id, entry_date, action, quantity_kg, balance_after_kg, inventory_id, note)
    VALUES (
      NEW.farm_id, NEW.purchase_date,
      CASE WHEN NEW.source = 'production' THEN 'production'
           WHEN NEW.source = 'adjustment' THEN 'adjustment'
           ELSE 'purchase' END,
      NEW.initial_kg, _balance, NEW.id,
      COALESCE(NEW.note, INITCAP(NEW.source) || ' · ' || NEW.feed_type)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_feed_inventory_log ON public.feed_inventory;
CREATE TRIGGER trg_feed_inventory_log
  AFTER INSERT ON public.feed_inventory
  FOR EACH ROW EXECUTE FUNCTION public.on_feed_inventory_log();
