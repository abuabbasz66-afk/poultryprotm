
CREATE OR REPLACE FUNCTION public.platform_stats()
RETURNS TABLE(birds bigint, eggs bigint, crates bigint, revenue numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
    b AS (SELECT COALESCE(SUM(current), 0)::bigint AS birds FROM public.rooms),
    e AS (
      SELECT
        COALESCE(SUM((r2 + r3 + r4) * 30 + extra), 0)::bigint AS eggs,
        COALESCE(SUM(r2 + r3 + r4 + (extra / 30)), 0)::bigint AS crates
      FROM public.egg_production
    ),
    farm_price AS (
      SELECT DISTINCT ON (farm_id) farm_id, price
      FROM public.prices
      WHERE item ILIKE 'egg%'
      ORDER BY farm_id, created_at DESC
    ),
    rev AS (
      SELECT COALESCE(SUM(((ep.r2 + ep.r3 + ep.r4) * 30 + ep.extra)::numeric / 30 * fp.price), 0)::numeric AS revenue
      FROM public.egg_production ep
      JOIN farm_price fp ON fp.farm_id = ep.farm_id
    )
  SELECT b.birds, e.eggs, e.crates, rev.revenue FROM b, e, rev;
$$;

REVOKE ALL ON FUNCTION public.platform_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_stats() TO anon, authenticated;
