CREATE OR REPLACE FUNCTION public.farm_feed_stock_kg(_farm_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _total NUMERIC;
BEGIN
  IF _farm_id IS NULL THEN RETURN 0; END IF;
  IF auth.uid() IS NOT NULL
     AND NOT (public.can(_farm_id, 'feed.read') OR public.can(_farm_id, 'feed.write')) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(SUM(remaining_kg), 0) INTO _total
    FROM public.feed_inventory WHERE farm_id = _farm_id;
  RETURN COALESCE(_total, 0);
END $function$;