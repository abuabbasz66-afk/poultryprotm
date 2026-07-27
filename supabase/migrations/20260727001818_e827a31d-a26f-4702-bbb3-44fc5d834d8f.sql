CREATE OR REPLACE FUNCTION public.landing_platform_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH egg_price AS (
    SELECT DISTINCT ON (farm_id) farm_id, price
    FROM public.prices
    WHERE item ILIKE 'egg%' OR item ILIKE '%table egg%'
    ORDER BY farm_id, created_at DESC
  ),
  feed_price AS (
    SELECT DISTINCT ON (farm_id) farm_id, price
    FROM public.prices
    WHERE item ILIKE '%feed%'
    ORDER BY farm_id, created_at DESC
  ),
  rev AS (
    SELECT COALESCE(SUM(((ep.r2 + ep.r3 + ep.r4) * 30 + ep.extra)::numeric / 30 * ep2.price), 0)::numeric AS revenue
    FROM public.egg_production ep
    JOIN egg_price ep2 ON ep2.farm_id = ep.farm_id
  ),
  cost AS (
    SELECT COALESCE(SUM(fu.bags::numeric * fp.price), 0)::numeric AS feed_cost
    FROM public.feed_usage fu
    JOIN feed_price fp ON fp.farm_id = fu.farm_id
  )
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
    'premium_farms', (SELECT COUNT(*) FROM public.farms WHERE subscription_plan = 'premium'),
    'revenue_tracked', (SELECT revenue FROM rev),
    'profit_analysed', (SELECT rev.revenue - cost.feed_cost FROM rev, cost)
  )
$$;

GRANT EXECUTE ON FUNCTION public.landing_platform_stats() TO anon, authenticated, service_role;