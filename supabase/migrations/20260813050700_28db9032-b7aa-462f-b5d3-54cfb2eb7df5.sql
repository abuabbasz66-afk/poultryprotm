-- Layer Brooding & Rearing -------------------------------------------------
CREATE TABLE public.layer_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bird_type TEXT NOT NULL DEFAULT 'Layer',
  breed TEXT,
  birds_placed INTEGER NOT NULL DEFAULT 0,
  current_birds INTEGER NOT NULL DEFAULT 0,
  placement_date DATE NOT NULL,
  start_age_days INTEGER NOT NULL DEFAULT 0,
  room TEXT,
  room_id UUID,
  source TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'rearing',
  transferred_at TIMESTAMPTZ,
  transferred_room_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.layer_batch_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.layer_batches(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  deaths INTEGER NOT NULL DEFAULT 0,
  death_reason TEXT,
  feed_kg NUMERIC NOT NULL DEFAULT 0,
  feed_type TEXT,
  feed_cost NUMERIC NOT NULL DEFAULT 0,
  water_litres NUMERIC NOT NULL DEFAULT 0,
  avg_weight_g NUMERIC,
  birds_count INTEGER,
  temperature_c NUMERIC,
  observation TEXT,
  notes TEXT,
  recorded_by UUID,
  recorded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.layer_batch_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.layer_batches(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  entry_date DATE NOT NULL DEFAULT now(),
  birds_weighed INTEGER NOT NULL DEFAULT 0,
  avg_weight_g NUMERIC NOT NULL DEFAULT 0,
  target_weight_g NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, week)
);

CREATE TABLE public.layer_batch_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.layer_batches(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'observation',
  name TEXT NOT NULL,
  entry_date DATE NOT NULL,
  dosage TEXT,
  administered_by TEXT,
  status TEXT NOT NULL DEFAULT 'done',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.layer_rearing_settings (
  farm_id UUID PRIMARY KEY REFERENCES public.farms(id) ON DELETE CASCADE,
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  weight_targets JSONB NOT NULL DEFAULT '{}'::jsonb,
  schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  maturity_weeks INTEGER NOT NULL DEFAULT 18,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.layer_batch_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.layer_batches(id) ON DELETE CASCADE,
  milestone_key TEXT NOT NULL,
  done_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, milestone_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.layer_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layer_batch_daily TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layer_batch_weights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layer_batch_health TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layer_rearing_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layer_batch_milestones TO authenticated;
GRANT ALL ON public.layer_batches TO service_role;
GRANT ALL ON public.layer_batch_daily TO service_role;
GRANT ALL ON public.layer_batch_weights TO service_role;
GRANT ALL ON public.layer_batch_health TO service_role;
GRANT ALL ON public.layer_rearing_settings TO service_role;
GRANT ALL ON public.layer_batch_milestones TO service_role;

ALTER TABLE public.layer_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layer_batch_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layer_batch_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layer_batch_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layer_rearing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layer_batch_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "layer_batches_read" ON public.layer_batches FOR SELECT TO authenticated USING (public.can(farm_id, 'rooms.read'));
CREATE POLICY "layer_batches_insert" ON public.layer_batches FOR INSERT TO authenticated WITH CHECK (public.can(farm_id, 'rooms.write'));
CREATE POLICY "layer_batches_update" ON public.layer_batches FOR UPDATE TO authenticated USING (public.can(farm_id, 'rooms.write')) WITH CHECK (public.can(farm_id, 'rooms.write'));
CREATE POLICY "layer_batches_delete" ON public.layer_batches FOR DELETE TO authenticated USING (public.can(farm_id, 'rooms.write'));

CREATE POLICY "layer_daily_read" ON public.layer_batch_daily FOR SELECT TO authenticated USING (public.can(farm_id, 'rooms.read'));
CREATE POLICY "layer_daily_insert" ON public.layer_batch_daily FOR INSERT TO authenticated WITH CHECK (public.can(farm_id, 'rooms.write'));
CREATE POLICY "layer_daily_update" ON public.layer_batch_daily FOR UPDATE TO authenticated USING (public.can(farm_id, 'rooms.write')) WITH CHECK (public.can(farm_id, 'rooms.write'));
CREATE POLICY "layer_daily_delete" ON public.layer_batch_daily FOR DELETE TO authenticated USING (public.can(farm_id, 'rooms.write'));

CREATE POLICY "layer_weights_read" ON public.layer_batch_weights FOR SELECT TO authenticated USING (public.can(farm_id, 'rooms.read'));
CREATE POLICY "layer_weights_insert" ON public.layer_batch_weights FOR INSERT TO authenticated WITH CHECK (public.can(farm_id, 'rooms.write'));
CREATE POLICY "layer_weights_update" ON public.layer_batch_weights FOR UPDATE TO authenticated USING (public.can(farm_id, 'rooms.write')) WITH CHECK (public.can(farm_id, 'rooms.write'));
CREATE POLICY "layer_weights_delete" ON public.layer_batch_weights FOR DELETE TO authenticated USING (public.can(farm_id, 'rooms.write'));

CREATE POLICY "layer_health_read" ON public.layer_batch_health FOR SELECT TO authenticated USING (public.can(farm_id, 'health.read'));
CREATE POLICY "layer_health_insert" ON public.layer_batch_health FOR INSERT TO authenticated WITH CHECK (public.can(farm_id, 'health.write'));
CREATE POLICY "layer_health_update" ON public.layer_batch_health FOR UPDATE TO authenticated USING (public.can(farm_id, 'health.write')) WITH CHECK (public.can(farm_id, 'health.write'));
CREATE POLICY "layer_health_delete" ON public.layer_batch_health FOR DELETE TO authenticated USING (public.can(farm_id, 'health.write'));

CREATE POLICY "layer_settings_read" ON public.layer_rearing_settings FOR SELECT TO authenticated USING (public.can(farm_id, 'rooms.read'));
CREATE POLICY "layer_settings_insert" ON public.layer_rearing_settings FOR INSERT TO authenticated WITH CHECK (public.can(farm_id, 'rooms.write'));
CREATE POLICY "layer_settings_update" ON public.layer_rearing_settings FOR UPDATE TO authenticated USING (public.can(farm_id, 'rooms.write')) WITH CHECK (public.can(farm_id, 'rooms.write'));
CREATE POLICY "layer_settings_delete" ON public.layer_rearing_settings FOR DELETE TO authenticated USING (public.can(farm_id, 'rooms.write'));

CREATE POLICY "layer_milestones_read" ON public.layer_batch_milestones FOR SELECT TO authenticated USING (public.can(farm_id, 'rooms.read'));
CREATE POLICY "layer_milestones_insert" ON public.layer_batch_milestones FOR INSERT TO authenticated WITH CHECK (public.can(farm_id, 'rooms.write'));
CREATE POLICY "layer_milestones_update" ON public.layer_batch_milestones FOR UPDATE TO authenticated USING (public.can(farm_id, 'rooms.write')) WITH CHECK (public.can(farm_id, 'rooms.write'));
CREATE POLICY "layer_milestones_delete" ON public.layer_batch_milestones FOR DELETE TO authenticated USING (public.can(farm_id, 'rooms.write'));

CREATE TRIGGER layer_batches_touch BEFORE UPDATE ON public.layer_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER layer_daily_touch BEFORE UPDATE ON public.layer_batch_daily FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER layer_weights_touch BEFORE UPDATE ON public.layer_batch_weights FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER layer_health_touch BEFORE UPDATE ON public.layer_batch_health FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER layer_settings_touch BEFORE UPDATE ON public.layer_rearing_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX layer_daily_batch_idx ON public.layer_batch_daily(batch_id, entry_date DESC);
CREATE INDEX layer_health_batch_idx ON public.layer_batch_health(batch_id, entry_date DESC);
CREATE INDEX layer_batches_farm_idx ON public.layer_batches(farm_id, created_at DESC);