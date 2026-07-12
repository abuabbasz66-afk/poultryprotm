
-- ============ FARMS ============
CREATE TABLE public.farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Farm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farms TO authenticated;
GRANT ALL ON public.farms TO service_role;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their farm" ON public.farms
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Helper: current user's farm id
CREATE OR REPLACE FUNCTION public.current_farm_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.farms WHERE owner_id = auth.uid() LIMIT 1;
$$;

-- ============ ROOMS ============
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  current INT NOT NULL DEFAULT 0,
  initial INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rooms_farm_idx ON public.rooms(farm_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Farm owner manages rooms" ON public.rooms
  FOR ALL TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

-- ============ EGG PRODUCTION ============
CREATE TABLE public.egg_production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  label TEXT NOT NULL,
  r2 INT NOT NULL DEFAULT 0,
  r3 INT NOT NULL DEFAULT 0,
  r4 INT NOT NULL DEFAULT 0,
  extra INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (farm_id, date)
);
CREATE INDEX egg_farm_date_idx ON public.egg_production(farm_id, date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.egg_production TO authenticated;
GRANT ALL ON public.egg_production TO service_role;
ALTER TABLE public.egg_production ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Farm owner manages egg production" ON public.egg_production
  FOR ALL TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

-- ============ MORTALITY ============
CREATE TABLE public.mortality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  room TEXT NOT NULL,
  cause TEXT NOT NULL DEFAULT 'Unknown',
  date TEXT NOT NULL,
  loss INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mortality_farm_idx ON public.mortality(farm_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mortality TO authenticated;
GRANT ALL ON public.mortality TO service_role;
ALTER TABLE public.mortality ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Farm owner manages mortality" ON public.mortality
  FOR ALL TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

-- ============ HEALTH RECORDS ============
CREATE TABLE public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'All Rooms',
  type TEXT NOT NULL DEFAULT 'Vitamin',
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX health_farm_idx ON public.health_records(farm_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_records TO authenticated;
GRANT ALL ON public.health_records TO service_role;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Farm owner manages health records" ON public.health_records
  FOR ALL TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

-- ============ FEED USAGE ============
CREATE TABLE public.feed_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  room TEXT NOT NULL,
  bags NUMERIC(10,2) NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX feed_farm_idx ON public.feed_usage(farm_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_usage TO authenticated;
GRANT ALL ON public.feed_usage TO service_role;
ALTER TABLE public.feed_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Farm owner manages feed usage" ON public.feed_usage
  FOR ALL TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

-- ============ PRICES ============
CREATE TABLE public.prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '1',
  price INT NOT NULL DEFAULT 0,
  updated TEXT NOT NULL DEFAULT to_char(now(), 'DD Mon YYYY'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX prices_farm_idx ON public.prices(farm_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prices TO authenticated;
GRANT ALL ON public.prices TO service_role;
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Farm owner manages prices" ON public.prices
  FOR ALL TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

-- ============ AUTO-CREATE FARM + DEFAULTS ON NEW USER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_farm_id UUID;
BEGIN
  INSERT INTO public.farms (owner_id, name)
  VALUES (NEW.id, 'My Farm')
  RETURNING id INTO new_farm_id;

  INSERT INTO public.rooms (farm_id, name, current, initial) VALUES
    (new_farm_id, 'ROOM 2', 0, 0),
    (new_farm_id, 'ROOM 3', 0, 0),
    (new_farm_id, 'ROOM 4', 0, 0);

  INSERT INTO public.prices (farm_id, item, unit, price) VALUES
    (new_farm_id, 'Egg', '30', 4900),
    (new_farm_id, 'Feed after all Expenses', '1', 13600);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
