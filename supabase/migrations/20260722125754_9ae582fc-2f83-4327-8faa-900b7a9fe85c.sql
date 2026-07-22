CREATE OR REPLACE FUNCTION public.admin_farm_summary(_farm_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'farm', to_jsonb(f.*) - 'owner_id',
    'owner', jsonb_build_object('user_id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at),
    'rooms_count', (SELECT COUNT(*) FROM public.rooms WHERE farm_id = f.id),
    'production_count', (SELECT COUNT(*) FROM public.egg_production WHERE farm_id = f.id),
    'production_latest', (SELECT MAX(date::date) FROM public.egg_production WHERE farm_id = f.id),
    'feed_count', (SELECT COUNT(*) FROM public.feed_usage WHERE farm_id = f.id),
    'feed_latest', (SELECT MAX(date::date) FROM public.feed_usage WHERE farm_id = f.id),
    'mortality_count', (SELECT COUNT(*) FROM public.mortality WHERE farm_id = f.id),
    'mortality_latest', (SELECT MAX(date::date) FROM public.mortality WHERE farm_id = f.id),
    'health_count', (SELECT COUNT(*) FROM public.health_records WHERE farm_id = f.id),
    'health_latest', (SELECT MAX(date::date) FROM public.health_records WHERE farm_id = f.id),
    'price_count', (SELECT COUNT(*) FROM public.prices WHERE farm_id = f.id)
  ) INTO result
  FROM public.farms f
  LEFT JOIN auth.users u ON u.id = f.owner_id
  WHERE f.id = _farm_id;
  RETURN result;
END $function$;