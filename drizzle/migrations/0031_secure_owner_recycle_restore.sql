CREATE OR REPLACE FUNCTION public.recycle_bin_restore(_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  r public.deleted_records; rec public.deleted_records; pending uuid[]; progress boolean;
  restored integer := 0; last_err text; caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Sign in to restore records'; END IF;
  SELECT d.* INTO r FROM public.deleted_records d JOIN public.farms f ON f.id = d.farm_id
    WHERE d.id = _id AND f.owner_id = caller FOR UPDATE OF d;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Record not found or you are not the farm owner'; END IF;
  SELECT array_agg(d.id) INTO pending FROM public.deleted_records d WHERE d.batch_id = r.batch_id AND d.farm_id = r.farm_id;
  LOOP
    progress := false;
    FOR rec IN SELECT d.* FROM public.deleted_records d WHERE d.id = ANY(pending) AND d.farm_id = r.farm_id ORDER BY d.deleted_at FOR UPDATE LOOP
      IF NOT EXISTS (SELECT 1 FROM public.farms f WHERE f.id = rec.farm_id AND f.owner_id = caller)
        OR (rec.data->>'farm_id') IS DISTINCT FROM rec.farm_id::text
        OR rec.row_id IS NULL OR (rec.data->>'id') IS DISTINCT FROM rec.row_id::text THEN
        RAISE EXCEPTION 'Saved record does not match the owner farm or record identity';
      END IF;
      BEGIN
        CASE rec.table_name
          WHEN 'broiler_batches' THEN INSERT INTO public.broiler_batches SELECT * FROM jsonb_populate_record(NULL::public.broiler_batches, rec.data);
          WHEN 'broiler_daily' THEN INSERT INTO public.broiler_daily SELECT * FROM jsonb_populate_record(NULL::public.broiler_daily, rec.data);
          WHEN 'broiler_medications' THEN INSERT INTO public.broiler_medications SELECT * FROM jsonb_populate_record(NULL::public.broiler_medications, rec.data);
          WHEN 'broiler_sales' THEN INSERT INTO public.broiler_sales SELECT * FROM jsonb_populate_record(NULL::public.broiler_sales, rec.data);
          WHEN 'broiler_vaccinations' THEN INSERT INTO public.broiler_vaccinations SELECT * FROM jsonb_populate_record(NULL::public.broiler_vaccinations, rec.data);
          WHEN 'egg_production' THEN INSERT INTO public.egg_production SELECT * FROM jsonb_populate_record(NULL::public.egg_production, rec.data);
          WHEN 'farm_expenses' THEN INSERT INTO public.farm_expenses SELECT * FROM jsonb_populate_record(NULL::public.farm_expenses, rec.data);
          WHEN 'farm_ingredients' THEN INSERT INTO public.farm_ingredients SELECT * FROM jsonb_populate_record(NULL::public.farm_ingredients, rec.data);
          WHEN 'farm_revenue' THEN INSERT INTO public.farm_revenue SELECT * FROM jsonb_populate_record(NULL::public.farm_revenue, rec.data);
          WHEN 'feed_formula_ingredients' THEN INSERT INTO public.feed_formula_ingredients SELECT * FROM jsonb_populate_record(NULL::public.feed_formula_ingredients, rec.data);
          WHEN 'feed_formula_versions' THEN INSERT INTO public.feed_formula_versions SELECT * FROM jsonb_populate_record(NULL::public.feed_formula_versions, rec.data);
          WHEN 'feed_formulas' THEN INSERT INTO public.feed_formulas SELECT * FROM jsonb_populate_record(NULL::public.feed_formulas, rec.data);
          WHEN 'feed_inventory' THEN INSERT INTO public.feed_inventory SELECT * FROM jsonb_populate_record(NULL::public.feed_inventory, rec.data);
          WHEN 'feed_ledger' THEN INSERT INTO public.feed_ledger SELECT * FROM jsonb_populate_record(NULL::public.feed_ledger, rec.data);
          WHEN 'feed_types' THEN INSERT INTO public.feed_types SELECT * FROM jsonb_populate_record(NULL::public.feed_types, rec.data);
          WHEN 'feed_usage' THEN INSERT INTO public.feed_usage SELECT * FROM jsonb_populate_record(NULL::public.feed_usage, rec.data);
          WHEN 'flock_vaccination_schedules' THEN INSERT INTO public.flock_vaccination_schedules SELECT * FROM jsonb_populate_record(NULL::public.flock_vaccination_schedules, rec.data);
          WHEN 'health_records' THEN INSERT INTO public.health_records SELECT * FROM jsonb_populate_record(NULL::public.health_records, rec.data);
          WHEN 'layer_batch_daily' THEN INSERT INTO public.layer_batch_daily SELECT * FROM jsonb_populate_record(NULL::public.layer_batch_daily, rec.data);
          WHEN 'layer_batch_health' THEN INSERT INTO public.layer_batch_health SELECT * FROM jsonb_populate_record(NULL::public.layer_batch_health, rec.data);
          WHEN 'layer_batch_milestones' THEN INSERT INTO public.layer_batch_milestones SELECT * FROM jsonb_populate_record(NULL::public.layer_batch_milestones, rec.data);
          WHEN 'layer_batch_weights' THEN INSERT INTO public.layer_batch_weights SELECT * FROM jsonb_populate_record(NULL::public.layer_batch_weights, rec.data);
          WHEN 'layer_batches' THEN INSERT INTO public.layer_batches SELECT * FROM jsonb_populate_record(NULL::public.layer_batches, rec.data);
          WHEN 'mortality' THEN INSERT INTO public.mortality SELECT * FROM jsonb_populate_record(NULL::public.mortality, rec.data);
          WHEN 'prices' THEN INSERT INTO public.prices SELECT * FROM jsonb_populate_record(NULL::public.prices, rec.data);
          WHEN 'rooms' THEN INSERT INTO public.rooms SELECT * FROM jsonb_populate_record(NULL::public.rooms, rec.data);
          WHEN 'vaccination_programme_items' THEN INSERT INTO public.vaccination_programme_items SELECT * FROM jsonb_populate_record(NULL::public.vaccination_programme_items, rec.data);
          WHEN 'vaccination_programmes' THEN INSERT INTO public.vaccination_programmes SELECT * FROM jsonb_populate_record(NULL::public.vaccination_programmes, rec.data);
          WHEN 'vaccination_records' THEN INSERT INTO public.vaccination_records SELECT * FROM jsonb_populate_record(NULL::public.vaccination_records, rec.data);
          ELSE RAISE EXCEPTION 'Unsupported recycle-bin record type';
        END CASE;
        DELETE FROM public.deleted_records d WHERE d.id = rec.id AND d.farm_id = r.farm_id;
        pending := array_remove(pending, rec.id);
        restored := restored + 1; progress := true;
      EXCEPTION WHEN unique_violation THEN
        last_err := 'A record for the same day or item already exists. Delete or edit it first.';
      WHEN foreign_key_violation THEN
        last_err := 'This record belongs to something that no longer exists.';
      END;
    END LOOP;
    EXIT WHEN NOT progress OR coalesce(array_length(pending, 1), 0) = 0;
  END LOOP;
  IF restored = 0 THEN RAISE EXCEPTION '%', coalesce(last_err, 'Could not restore this record'); END IF;
  RETURN restored;
END $$;
REVOKE EXECUTE ON FUNCTION public.recycle_bin_restore(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recycle_bin_restore(uuid) TO authenticated;
