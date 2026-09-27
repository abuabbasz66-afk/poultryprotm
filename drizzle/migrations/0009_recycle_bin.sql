CREATE TABLE public.deleted_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL,
  table_name text NOT NULL,
  row_id uuid,
  data jsonb NOT NULL,
  batch_id bigint NOT NULL,
  deleted_by uuid,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deleted_records_farm_idx ON public.deleted_records(farm_id, deleted_at DESC);
GRANT SELECT ON public.deleted_records TO authenticated;
GRANT ALL ON public.deleted_records TO service_role;
ALTER TABLE public.deleted_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Farm owners view their recycle bin" ON public.deleted_records FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.farms f WHERE f.id = farm_id AND f.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.capture_deleted_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.farm_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.farms WHERE id = OLD.farm_id) THEN
    INSERT INTO public.deleted_records(farm_id, table_name, row_id, data, batch_id, deleted_by)
    VALUES (OLD.farm_id, TG_TABLE_NAME, OLD.id, to_jsonb(OLD), txid_current(), auth.uid());
  END IF;
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.capture_deleted_record() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['broiler_batches','broiler_daily','broiler_medications','broiler_sales','broiler_vaccinations','egg_production','farm_expenses','farm_ingredients','farm_revenue','feed_formula_ingredients','feed_formula_versions','feed_formulas','feed_inventory','feed_ledger','feed_types','feed_usage','flock_vaccination_schedules','health_records','layer_batch_daily','layer_batch_health','layer_batch_milestones','layer_batch_weights','layer_batches','mortality','prices','rooms','vaccination_programme_items','vaccination_programmes','vaccination_records'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS zz_recycle_bin ON public.%I', t);
    EXECUTE format('CREATE TRIGGER zz_recycle_bin AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_deleted_record()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.recycle_bin_list(_farm_id uuid)
RETURNS SETOF public.deleted_records LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM farms WHERE id = _farm_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the farm owner can open the recycle bin';
  END IF;
  DELETE FROM deleted_records WHERE farm_id = _farm_id AND deleted_at < now() - interval '30 days';
  RETURN QUERY SELECT * FROM deleted_records WHERE farm_id = _farm_id ORDER BY deleted_at DESC LIMIT 500;
END $$;

CREATE OR REPLACE FUNCTION public.recycle_bin_restore(_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r deleted_records; b bigint; f uuid; pending uuid[]; progress boolean; restored int := 0; rec deleted_records; last_err text;
BEGIN
  SELECT * INTO r FROM deleted_records WHERE id = _id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Record not found in recycle bin'; END IF;
  IF NOT EXISTS (SELECT 1 FROM farms WHERE id = r.farm_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the farm owner can restore records';
  END IF;
  b := r.batch_id; f := r.farm_id;
  SELECT array_agg(id) INTO pending FROM deleted_records WHERE batch_id = b AND farm_id = f;
  LOOP
    progress := false;
    FOR rec IN SELECT * FROM deleted_records WHERE id = ANY(pending) ORDER BY deleted_at LOOP
      BEGIN
        EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)', rec.table_name, rec.table_name) USING rec.data;
        DELETE FROM deleted_records WHERE id = rec.id;
        pending := array_remove(pending, rec.id);
        restored := restored + 1; progress := true;
      EXCEPTION WHEN unique_violation THEN
        last_err := 'A record for the same day or item already exists. Delete or edit it first.';
      WHEN foreign_key_violation THEN
        last_err := 'This record belongs to something that no longer exists.';
      END;
    END LOOP;
    EXIT WHEN NOT progress OR coalesce(array_length(pending,1),0) = 0;
  END LOOP;
  IF restored = 0 THEN RAISE EXCEPTION '%', coalesce(last_err, 'Could not restore this record'); END IF;
  RETURN restored;
END $$;

CREATE OR REPLACE FUNCTION public.recycle_bin_purge(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM deleted_records d USING farms f WHERE d.id = _id AND f.id = d.farm_id AND f.owner_id = auth.uid();
END $$;

REVOKE EXECUTE ON FUNCTION public.recycle_bin_list(uuid), public.recycle_bin_restore(uuid), public.recycle_bin_purge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recycle_bin_list(uuid), public.recycle_bin_restore(uuid), public.recycle_bin_purge(uuid) TO authenticated;