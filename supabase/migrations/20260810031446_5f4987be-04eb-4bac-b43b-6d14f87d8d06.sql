CREATE TABLE public.broiler_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name text NOT NULL,
  breed text,
  house text,
  date_placed date NOT NULL DEFAULT CURRENT_DATE,
  birds_placed integer NOT NULL DEFAULT 0,
  current_birds integer NOT NULL DEFAULT 0,
  chick_unit_cost numeric NOT NULL DEFAULT 0,
  target_weight_kg numeric NOT NULL DEFAULT 2.2,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broiler_batches TO authenticated;
GRANT ALL ON public.broiler_batches TO service_role;
ALTER TABLE public.broiler_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broiler_batches_select" ON public.broiler_batches FOR SELECT TO authenticated
  USING (farm_id IN (SELECT public.my_farm_ids()));
CREATE POLICY "broiler_batches_insert" ON public.broiler_batches FOR INSERT TO authenticated
  WITH CHECK (public.can(farm_id, 'rooms.write'));
CREATE POLICY "broiler_batches_update" ON public.broiler_batches FOR UPDATE TO authenticated
  USING (public.can(farm_id, 'rooms.write')) WITH CHECK (public.can(farm_id, 'rooms.write'));
CREATE POLICY "broiler_batches_delete" ON public.broiler_batches FOR DELETE TO authenticated
  USING (public.can(farm_id, 'rooms.delete'));

CREATE TABLE public.broiler_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.broiler_batches(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  deaths integer NOT NULL DEFAULT 0,
  feed_kg numeric NOT NULL DEFAULT 0,
  avg_weight_g numeric,
  water_litres numeric,
  notes text,
  recorded_by uuid,
  recorded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, entry_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broiler_daily TO authenticated;
GRANT ALL ON public.broiler_daily TO service_role;
ALTER TABLE public.broiler_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broiler_daily_select" ON public.broiler_daily FOR SELECT TO authenticated
  USING (farm_id IN (SELECT public.my_farm_ids()));
CREATE POLICY "broiler_daily_insert" ON public.broiler_daily FOR INSERT TO authenticated
  WITH CHECK (public.can(farm_id, 'production.write'));
CREATE POLICY "broiler_daily_update" ON public.broiler_daily FOR UPDATE TO authenticated
  USING (public.can_edit_recent(farm_id, 'production.write', created_at))
  WITH CHECK (public.can_edit_recent(farm_id, 'production.write', created_at));
CREATE POLICY "broiler_daily_delete" ON public.broiler_daily FOR DELETE TO authenticated
  USING (public.can(farm_id, 'production.delete'));

CREATE TABLE public.broiler_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.broiler_batches(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  birds integer NOT NULL DEFAULT 0,
  total_weight_kg numeric NOT NULL DEFAULT 0,
  price_per_kg numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  customer text,
  payment_method text NOT NULL DEFAULT 'Cash',
  notes text,
  recorded_by uuid,
  recorded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broiler_sales TO authenticated;
GRANT ALL ON public.broiler_sales TO service_role;
ALTER TABLE public.broiler_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broiler_sales_select" ON public.broiler_sales FOR SELECT TO authenticated
  USING (farm_id IN (SELECT public.my_farm_ids()));
CREATE POLICY "broiler_sales_insert" ON public.broiler_sales FOR INSERT TO authenticated
  WITH CHECK (public.can(farm_id, 'sales.write'));
CREATE POLICY "broiler_sales_update" ON public.broiler_sales FOR UPDATE TO authenticated
  USING (public.can_edit_recent(farm_id, 'sales.write', created_at))
  WITH CHECK (public.can_edit_recent(farm_id, 'sales.write', created_at));
CREATE POLICY "broiler_sales_delete" ON public.broiler_sales FOR DELETE TO authenticated
  USING (public.can(farm_id, 'sales.write'));

CREATE TRIGGER broiler_batches_updated_at BEFORE UPDATE ON public.broiler_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER broiler_daily_updated_at BEFORE UPDATE ON public.broiler_daily
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER broiler_sales_updated_at BEFORE UPDATE ON public.broiler_sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX broiler_daily_batch_date_idx ON public.broiler_daily (batch_id, entry_date DESC);
CREATE INDEX broiler_sales_batch_date_idx ON public.broiler_sales (batch_id, entry_date DESC);
CREATE INDEX broiler_batches_farm_idx ON public.broiler_batches (farm_id, status);