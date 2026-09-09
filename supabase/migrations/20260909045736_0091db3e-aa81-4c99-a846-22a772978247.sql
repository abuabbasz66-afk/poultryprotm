ALTER TABLE public.layer_batches ADD COLUMN IF NOT EXISTS hatch_date date;

CREATE TABLE public.vaccination_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid REFERENCES public.farms(id) ON DELETE CASCADE,
  name text NOT NULL,
  bird_type text NOT NULL DEFAULT 'Layer',
  version integer NOT NULL DEFAULT 1,
  is_baseline boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vaccination_programme_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid NOT NULL REFERENCES public.vaccination_programmes(id) ON DELETE CASCADE,
  farm_id uuid REFERENCES public.farms(id) ON DELETE CASCADE,
  sequence integer NOT NULL DEFAULT 0,
  age_days integer NOT NULL,
  age_label text NOT NULL,
  disease text NOT NULL,
  vaccine text NOT NULL,
  route text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.flock_vaccination_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.layer_batches(id) ON DELETE CASCADE,
  programme_id uuid NOT NULL REFERENCES public.vaccination_programmes(id) ON DELETE RESTRICT,
  programme_item_id uuid REFERENCES public.vaccination_programme_items(id) ON DELETE SET NULL,
  programme_name text NOT NULL,
  programme_version integer NOT NULL DEFAULT 1,
  sequence integer NOT NULL DEFAULT 0,
  age_days integer NOT NULL,
  age_label text NOT NULL,
  disease text NOT NULL,
  vaccine text NOT NULL,
  route text NOT NULL,
  note text,
  scheduled_date date NOT NULL,
  anchor_source text NOT NULL DEFAULT 'placement',
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, programme_id, sequence)
);

CREATE TABLE public.vaccination_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.layer_batches(id) ON DELETE SET NULL,
  schedule_id uuid REFERENCES public.flock_vaccination_schedules(id) ON DELETE SET NULL,
  programme_id uuid REFERENCES public.vaccination_programmes(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  bird_type text NOT NULL DEFAULT 'Layer',
  disease text NOT NULL,
  vaccine text NOT NULL,
  scheduled_date date,
  vaccination_date date NOT NULL,
  bird_age_days integer,
  birds_present integer,
  birds_vaccinated integer,
  batch_number text,
  manufacturer text,
  expiry_date date,
  route text,
  administration_method text,
  dose text,
  water_volume_litres numeric,
  person_responsible text,
  veterinarian text,
  notes text,
  attachment_path text,
  at_hatchery boolean NOT NULL DEFAULT false,
  hatchery_name text,
  recorded_by uuid,
  recorded_by_name text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vacc_prog_farm ON public.vaccination_programmes(farm_id);
CREATE INDEX idx_vacc_prog_items_prog ON public.vaccination_programme_items(programme_id, sequence);
CREATE INDEX idx_vacc_sched_farm_batch ON public.flock_vaccination_schedules(farm_id, batch_id, scheduled_date);
CREATE INDEX idx_vacc_records_farm_date ON public.vaccination_records(farm_id, vaccination_date);
CREATE INDEX idx_vacc_records_schedule ON public.vaccination_records(schedule_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaccination_programmes TO authenticated;
GRANT ALL ON public.vaccination_programmes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaccination_programme_items TO authenticated;
GRANT ALL ON public.vaccination_programme_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flock_vaccination_schedules TO authenticated;
GRANT ALL ON public.flock_vaccination_schedules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaccination_records TO authenticated;
GRANT ALL ON public.vaccination_records TO service_role;

ALTER TABLE public.vaccination_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccination_programme_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flock_vaccination_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccination_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read baseline or own farm programmes" ON public.vaccination_programmes
  FOR SELECT TO authenticated
  USING (farm_id IS NULL OR public.can(farm_id, 'health.read'));
CREATE POLICY "Create farm programmes" ON public.vaccination_programmes
  FOR INSERT TO authenticated
  WITH CHECK (farm_id IS NOT NULL AND public.can(farm_id, 'health.write'));
CREATE POLICY "Update farm programmes" ON public.vaccination_programmes
  FOR UPDATE TO authenticated
  USING (farm_id IS NOT NULL AND public.can(farm_id, 'health.write'))
  WITH CHECK (farm_id IS NOT NULL AND public.can(farm_id, 'health.write'));
CREATE POLICY "Delete farm programmes" ON public.vaccination_programmes
  FOR DELETE TO authenticated
  USING (farm_id IS NOT NULL AND public.can(farm_id, 'health.delete'));

CREATE POLICY "Read baseline or own farm programme items" ON public.vaccination_programme_items
  FOR SELECT TO authenticated
  USING (farm_id IS NULL OR public.can(farm_id, 'health.read'));
CREATE POLICY "Create farm programme items" ON public.vaccination_programme_items
  FOR INSERT TO authenticated
  WITH CHECK (farm_id IS NOT NULL AND public.can(farm_id, 'health.write'));
CREATE POLICY "Update farm programme items" ON public.vaccination_programme_items
  FOR UPDATE TO authenticated
  USING (farm_id IS NOT NULL AND public.can(farm_id, 'health.write'))
  WITH CHECK (farm_id IS NOT NULL AND public.can(farm_id, 'health.write'));
CREATE POLICY "Delete farm programme items" ON public.vaccination_programme_items
  FOR DELETE TO authenticated
  USING (farm_id IS NOT NULL AND public.can(farm_id, 'health.delete'));

CREATE POLICY "Read farm vaccination schedules" ON public.flock_vaccination_schedules
  FOR SELECT TO authenticated USING (public.can(farm_id, 'health.read'));
CREATE POLICY "Create farm vaccination schedules" ON public.flock_vaccination_schedules
  FOR INSERT TO authenticated WITH CHECK (public.can(farm_id, 'health.write'));
CREATE POLICY "Update farm vaccination schedules" ON public.flock_vaccination_schedules
  FOR UPDATE TO authenticated
  USING (public.can(farm_id, 'health.write'))
  WITH CHECK (public.can(farm_id, 'health.write'));
CREATE POLICY "Delete farm vaccination schedules" ON public.flock_vaccination_schedules
  FOR DELETE TO authenticated USING (public.can(farm_id, 'health.delete'));

CREATE POLICY "Read farm vaccination records" ON public.vaccination_records
  FOR SELECT TO authenticated USING (public.can(farm_id, 'health.read'));
CREATE POLICY "Create farm vaccination records" ON public.vaccination_records
  FOR INSERT TO authenticated WITH CHECK (public.can(farm_id, 'health.write'));
CREATE POLICY "Update farm vaccination records" ON public.vaccination_records
  FOR UPDATE TO authenticated
  USING (public.can(farm_id, 'health.write'))
  WITH CHECK (public.can(farm_id, 'health.write'));
CREATE POLICY "Delete farm vaccination records" ON public.vaccination_records
  FOR DELETE TO authenticated USING (public.can(farm_id, 'health.delete'));

CREATE OR REPLACE FUNCTION public.validate_vaccination_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.batch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.layer_batches b WHERE b.id = NEW.batch_id AND b.farm_id = NEW.farm_id
  ) THEN
    RAISE EXCEPTION 'Flock does not belong to this farm';
  END IF;
  IF TG_TABLE_NAME = 'vaccination_records' AND NEW.room_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.rooms r WHERE r.id = NEW.room_id AND r.farm_id = NEW.farm_id
  ) THEN
    RAISE EXCEPTION 'Room does not belong to this farm';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_vacc_schedule_scope
  BEFORE INSERT OR UPDATE ON public.flock_vaccination_schedules
  FOR EACH ROW EXECUTE FUNCTION public.validate_vaccination_scope();
CREATE TRIGGER validate_vacc_record_scope
  BEFORE INSERT OR UPDATE ON public.vaccination_records
  FOR EACH ROW EXECUTE FUNCTION public.validate_vaccination_scope();

CREATE TRIGGER set_vacc_prog_updated_at BEFORE UPDATE ON public.vaccination_programmes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_vacc_items_updated_at BEFORE UPDATE ON public.vaccination_programme_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_vacc_sched_updated_at BEFORE UPDATE ON public.flock_vaccination_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_vacc_records_updated_at BEFORE UPDATE ON public.vaccination_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();