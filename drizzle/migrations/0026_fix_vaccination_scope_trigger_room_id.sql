CREATE OR REPLACE FUNCTION public.validate_vaccination_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.batch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.layer_batches b WHERE b.id = NEW.batch_id AND b.farm_id = NEW.farm_id
  ) THEN
    RAISE EXCEPTION 'Flock does not belong to this farm';
  END IF;

  IF NEW.programme_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vaccination_programmes p
    WHERE p.id = NEW.programme_id AND (p.farm_id IS NULL OR p.farm_id = NEW.farm_id)
  ) THEN
    RAISE EXCEPTION 'Vaccination programme does not belong to this farm';
  END IF;

  IF TG_TABLE_NAME = 'vaccination_records' THEN
    IF NEW.room_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.rooms r WHERE r.id = NEW.room_id AND r.farm_id = NEW.farm_id
    ) THEN
      RAISE EXCEPTION 'Room does not belong to this farm';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;