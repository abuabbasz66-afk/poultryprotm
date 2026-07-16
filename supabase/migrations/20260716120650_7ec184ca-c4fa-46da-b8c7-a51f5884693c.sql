
CREATE OR REPLACE FUNCTION public.landing_platform_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'registered_farms', (SELECT COUNT(*) FROM public.farms),
    'registered_users', (SELECT COUNT(*) FROM auth.users),
    'total_birds', (SELECT COALESCE(SUM(current), 0) FROM public.rooms),
    'production_records', (SELECT COUNT(*) FROM public.egg_production),
    'feed_records', (SELECT COUNT(*) FROM public.feed_usage),
    'mortality_records', (SELECT COUNT(*) FROM public.mortality),
    'health_records', (SELECT COUNT(*) FROM public.health_records),
    'rooms', (SELECT COUNT(*) FROM public.rooms),
    'eggs', (SELECT COALESCE(SUM((r2 + r3 + r4) * 30 + extra), 0) FROM public.egg_production),
    'premium_farms', (SELECT COUNT(*) FROM public.farms WHERE subscription_plan = 'premium')
  )
$$;

GRANT EXECUTE ON FUNCTION public.landing_platform_stats() TO anon, authenticated;
