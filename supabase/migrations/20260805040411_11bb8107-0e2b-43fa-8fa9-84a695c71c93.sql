
CREATE TABLE public.farm_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT (now()::date),
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  supplier TEXT,
  receipt_path TEXT,
  notes TEXT,
  recorded_by UUID,
  recorded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.farm_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT (now()::date),
  category TEXT NOT NULL,
  item TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit TEXT NOT NULL DEFAULT 'unit',
  unit_price NUMERIC NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  customer TEXT,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  notes TEXT,
  recorded_by UUID,
  recorded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_farm_expenses_farm_date ON public.farm_expenses(farm_id, entry_date DESC);
CREATE INDEX idx_farm_revenue_farm_date ON public.farm_revenue(farm_id, entry_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_expenses TO authenticated;
GRANT ALL ON public.farm_expenses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_revenue TO authenticated;
GRANT ALL ON public.farm_revenue TO service_role;

ALTER TABLE public.farm_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON public.farm_expenses FOR SELECT TO authenticated
  USING (public.can(farm_id, 'expenses.read'));
CREATE POLICY "expenses_insert" ON public.farm_expenses FOR INSERT TO authenticated
  WITH CHECK (public.can(farm_id, 'expenses.write'));
CREATE POLICY "expenses_update" ON public.farm_expenses FOR UPDATE TO authenticated
  USING (public.can_edit_recent(farm_id, 'expenses.write', created_at))
  WITH CHECK (public.can_edit_recent(farm_id, 'expenses.write', created_at));
CREATE POLICY "expenses_delete" ON public.farm_expenses FOR DELETE TO authenticated
  USING (public.can(farm_id, 'expenses.delete'));

CREATE POLICY "revenue_select" ON public.farm_revenue FOR SELECT TO authenticated
  USING (public.can(farm_id, 'revenue.read'));
CREATE POLICY "revenue_insert" ON public.farm_revenue FOR INSERT TO authenticated
  WITH CHECK (public.can(farm_id, 'revenue.write'));
CREATE POLICY "revenue_update" ON public.farm_revenue FOR UPDATE TO authenticated
  USING (public.can_edit_recent(farm_id, 'revenue.write', created_at))
  WITH CHECK (public.can_edit_recent(farm_id, 'revenue.write', created_at));
CREATE POLICY "revenue_delete" ON public.farm_revenue FOR DELETE TO authenticated
  USING (public.can(farm_id, 'revenue.delete'));

CREATE TRIGGER trg_farm_expenses_updated BEFORE UPDATE ON public.farm_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_farm_revenue_updated BEFORE UPDATE ON public.farm_revenue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.role_permissions (role_key, permission) VALUES
  ('manager', 'expenses.read'),
  ('manager', 'expenses.write'),
  ('manager', 'revenue.read'),
  ('manager', 'revenue.write'),
  ('sales',   'revenue.read'),
  ('sales',   'revenue.write')
ON CONFLICT DO NOTHING;

