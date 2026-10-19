CREATE OR REPLACE FUNCTION public.landing_all_farm_egg_value()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH current_prices AS (
 SELECT DISTINCT ON (farm_id) farm_id, price::numeric, effective_from
 FROM public.prices WHERE item ~* 'egg' AND price > 0
 ORDER BY farm_id, created_at, id
), history AS (
 SELECT farm_id, new_price AS price, effective_from
 FROM public.price_history WHERE item ~* 'egg' AND new_price > 0
 AND new_price::text NOT IN ('NaN','Infinity','-Infinity')
), points AS (
 SELECT farm_id, price, effective_from FROM history
 UNION ALL
 SELECT c.farm_id, c.price, COALESCE(c.effective_from, '0001-01-01 UTC'::timestamptz)
 FROM current_prices c
 WHERE c.price IS DISTINCT FROM (SELECT h.price FROM history h WHERE h.farm_id=c.farm_id ORDER BY h.effective_from DESC LIMIT 1)
), records AS (
 SELECT e.farm_id, e.date, f.country,
 greatest(0, (e.r2::numeric+e.r3+e.r4)*30+e.extra
 -COALESCE(e.broken_r2,0)-COALESCE(e.broken_r3,0)-COALESCE(e.broken_r4,0)-COALESCE(e.broken_extra,0)) AS eggs,
 (e.r2 IS NOT NULL AND e.r3 IS NOT NULL AND e.r4 IS NOT NULL AND e.extra IS NOT NULL
 AND e.r2>=0 AND e.r3>=0 AND e.r4>=0 AND e.extra>=0
 AND COALESCE(e.broken_r2,0)>=0 AND COALESCE(e.broken_r3,0)>=0 AND COALESCE(e.broken_r4,0)>=0 AND COALESCE(e.broken_extra,0)>=0) AS valid
 FROM public.egg_production e JOIN public.farms f ON f.id=e.farm_id
 WHERE e.date ~ '^\d{4}-\d{2}-\d{2}$'
 AND e.date <= to_char(now() AT TIME ZONE 'Africa/Lagos','YYYY-MM-DD')
), valued AS (
 SELECT r.*, COALESCE(
 (SELECT p.price FROM points p WHERE p.farm_id=r.farm_id
 AND to_char(p.effective_from AT TIME ZONE 'Africa/Lagos','YYYY-MM-DD')<=r.date ORDER BY p.effective_from DESC LIMIT 1),
 (SELECT p.price FROM points p WHERE p.farm_id=r.farm_id ORDER BY p.effective_from LIMIT 1)) AS price
 FROM records r
), totals AS (
 SELECT farm_id, round(sum(eggs/30*price)) AS value
 FROM valued WHERE valid AND lower(trim(country))='nigeria' AND price>0 GROUP BY farm_id
)
SELECT jsonb_build_object(
 'egg_value', (SELECT sum(value) FROM totals), 'currency','NGN',
 'excluded_records', (SELECT count(*) FROM valued WHERE NOT valid OR price IS NULL OR lower(trim(COALESCE(country,'')))<>'nigeria')
)
$function$;
REVOKE ALL ON FUNCTION public.landing_all_farm_egg_value() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.landing_all_farm_egg_value() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.landing_all_farm_egg_value() IS 'Aggregate only, no farm identifiers: recorded usable egg production valued at farm historical crate prices, earliest price fallback like dashboard. Nigerian farms only because foreign denomination is unverified; excludes future records and unpriced/invalid rows. Not payment verification; no Finance ledger added.';