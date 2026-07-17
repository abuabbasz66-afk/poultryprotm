
CREATE OR REPLACE FUNCTION public.presentation_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  today date := (now() at time zone 'UTC')::date;
  avg_egg_price numeric;
  today_crates bigint;
  prod_series jsonb;
  rev_series jsonb;
  feed_series jsonb;
  mort_series jsonb;
BEGIN
  SELECT COALESCE(AVG(price), 0) INTO avg_egg_price
  FROM public.prices WHERE item ILIKE 'egg%';

  SELECT COALESCE(SUM((r2+r3+r4)*30 + extra), 0)/30 INTO today_crates
  FROM public.egg_production
  WHERE prod_date = today;

  -- 7-day production trend (crates/day)
  SELECT jsonb_agg(v ORDER BY d) INTO prod_series FROM (
    SELECT d::date AS d,
      COALESCE((
        SELECT SUM((r2+r3+r4)*30 + extra)/30
        FROM public.egg_production WHERE prod_date = d::date
      ), 0)::bigint AS v
    FROM generate_series(today - 6, today, interval '1 day') d
  ) s;

  -- 7-day revenue trend (₦ M/day)
  SELECT jsonb_agg(v ORDER BY d) INTO rev_series FROM (
    SELECT d::date AS d,
      ROUND(COALESCE((
        SELECT SUM(((r2+r3+r4)*30 + extra)::numeric / 30 * avg_egg_price)
        FROM public.egg_production WHERE prod_date = d::date
      ), 0) / 1000000.0, 2) AS v
    FROM generate_series(today - 6, today, interval '1 day') d
  ) s;

  -- 7-day feed usage (bags/day)
  SELECT jsonb_agg(v ORDER BY d) INTO feed_series FROM (
    SELECT d::date AS d,
      COALESCE((
        SELECT SUM(bags) FROM public.feed_usage WHERE feed_date = d::date
      ), 0)::numeric AS v
    FROM generate_series(today - 6, today, interval '1 day') d
  ) s;

  -- 7-day mortality (birds/day)
  SELECT jsonb_agg(v ORDER BY d) INTO mort_series FROM (
    SELECT d::date AS d,
      COALESCE((
        SELECT SUM(loss) FROM public.mortality WHERE death_date = d::date
      ), 0)::bigint AS v
    FROM generate_series(today - 6, today, interval '1 day') d
  ) s;

  SELECT jsonb_build_object(
    'farm_name', 'PoultryPro Live Platform',
    'location', 'Aggregated across all farms',
    'birds', (SELECT COALESCE(SUM(current), 0) FROM public.rooms),
    'houses', (SELECT COUNT(*) FROM public.rooms),
    'today_crates', today_crates,
    'active_alerts', (SELECT COUNT(*) FROM public.admin_notifications WHERE is_read = false AND is_archived = false),
    'annual_revenue', (
      SELECT COALESCE(SUM(((r2+r3+r4)*30 + extra)::numeric / 30 * avg_egg_price), 0)
      FROM public.egg_production
      WHERE prod_date >= (today - interval '365 days')
    ),
    'feed_stock_pct', 74,
    'records_analysed', (
      (SELECT COUNT(*) FROM public.egg_production) +
      (SELECT COUNT(*) FROM public.feed_usage) +
      (SELECT COUNT(*) FROM public.mortality) +
      (SELECT COUNT(*) FROM public.health_records)
    ),
    'total_eggs', (SELECT COALESCE(SUM((r2+r3+r4)*30 + extra),0) FROM public.egg_production),
    'production_trend', COALESCE(prod_series, '[]'::jsonb),
    'revenue_trend', COALESCE(rev_series, '[]'::jsonb),
    'feed_trend', COALESCE(feed_series, '[]'::jsonb),
    'mortality_trend', COALESCE(mort_series, '[]'::jsonb)
  ) INTO result;

  RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION public.presentation_demo_data() TO anon, authenticated;
