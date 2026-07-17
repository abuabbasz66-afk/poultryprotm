
CREATE OR REPLACE FUNCTION public.demo_greenfield_data()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _farm_id UUID := '88cbfb05-38d1-4451-9b2d-1e0407eacf52';
  _egg_price NUMERIC;
  _feed_price NUMERIC;
  _min_date DATE;
  _max_date DATE;
  _days INT;
  result JSONB;
BEGIN
  SELECT price INTO _egg_price FROM public.prices
    WHERE farm_id = _farm_id AND item ILIKE 'egg%'
    ORDER BY created_at DESC LIMIT 1;
  _egg_price := COALESCE(_egg_price, 4900);

  SELECT price INTO _feed_price FROM public.prices
    WHERE farm_id = _farm_id AND item ILIKE 'feed%'
    ORDER BY created_at DESC LIMIT 1;
  _feed_price := COALESCE(_feed_price, 11950);

  SELECT MIN(date::date), MAX(date::date) INTO _min_date, _max_date
    FROM public.egg_production WHERE farm_id = _farm_id;
  _days := GREATEST(1, COALESCE((_max_date - _min_date), 1));

  SELECT jsonb_build_object(
    'farm_name', 'Greenfield Demonstration Farm',
    'location', 'Commercial layer operation · Real historical dataset',
    'period_start', _min_date,
    'period_end', _max_date,
    'days_covered', _days,
    'egg_price', _egg_price,
    'feed_price', _feed_price,

    'rooms', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', name, 'current', current, 'initial', initial,
        'mortality_pct', ROUND(((initial - current)::NUMERIC / NULLIF(initial,0)) * 100, 2)
      ) ORDER BY name)
      FROM public.rooms WHERE farm_id = _farm_id
    ), '[]'::jsonb),

    'birds', COALESCE((SELECT SUM(current) FROM public.rooms WHERE farm_id = _farm_id), 0),
    'initial_birds', COALESCE((SELECT SUM(initial) FROM public.rooms WHERE farm_id = _farm_id), 0),
    'houses', COALESCE((SELECT COUNT(*) FROM public.rooms WHERE farm_id = _farm_id), 0),

    'total_eggs', COALESCE((SELECT SUM((r2+r3+r4)*30 + extra) FROM public.egg_production WHERE farm_id = _farm_id), 0),
    'total_crates', COALESCE((SELECT SUM((r2+r3+r4)*30 + extra) / 30 FROM public.egg_production WHERE farm_id = _farm_id), 0),
    'total_feed_bags', COALESCE((SELECT SUM(bags) FROM public.feed_usage WHERE farm_id = _farm_id), 0),
    'total_mortality', COALESCE((SELECT SUM(loss) FROM public.mortality WHERE farm_id = _farm_id), 0),
    'health_records_count', COALESCE((SELECT COUNT(*) FROM public.health_records WHERE farm_id = _farm_id), 0),
    'production_records_count', COALESCE((SELECT COUNT(*) FROM public.egg_production WHERE farm_id = _farm_id), 0),
    'feed_records_count', COALESCE((SELECT COUNT(*) FROM public.feed_usage WHERE farm_id = _farm_id), 0),
    'mortality_records_count', COALESCE((SELECT COUNT(*) FROM public.mortality WHERE farm_id = _farm_id), 0),

    'today_crates', COALESCE((
      SELECT ((r2+r3+r4)*30 + extra) / 30
      FROM public.egg_production
      WHERE farm_id = _farm_id AND date::date = _max_date
      LIMIT 1
    ), 0),

    -- 180-day daily production trend (crates)
    'production_180', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('d', d, 'v', v) ORDER BY d) FROM (
        SELECT gs::date AS d,
          COALESCE((
            SELECT ((r2+r3+r4)*30 + extra) / 30
            FROM public.egg_production
            WHERE farm_id = _farm_id AND date::date = gs::date
            LIMIT 1
          ), 0)::int AS v
        FROM generate_series(_max_date - 179, _max_date, interval '1 day') gs
      ) s
    ), '[]'::jsonb),

    -- 180-day feed usage (bags)
    'feed_180', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('d', d, 'v', v) ORDER BY d) FROM (
        SELECT gs::date AS d,
          COALESCE((
            SELECT SUM(bags) FROM public.feed_usage
            WHERE farm_id = _farm_id AND date::date = gs::date
          ), 0)::numeric AS v
        FROM generate_series(_max_date - 179, _max_date, interval '1 day') gs
      ) s
    ), '[]'::jsonb),

    -- 180-day mortality (birds)
    'mortality_180', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('d', d, 'v', v) ORDER BY d) FROM (
        SELECT gs::date AS d,
          COALESCE((
            SELECT SUM(loss) FROM public.mortality
            WHERE farm_id = _farm_id AND date::date = gs::date
          ), 0)::int AS v
        FROM generate_series(_max_date - 179, _max_date, interval '1 day') gs
      ) s
    ), '[]'::jsonb),

    -- 180-day revenue (NGN, actual)
    'revenue_180', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('d', d, 'v', v) ORDER BY d) FROM (
        SELECT gs::date AS d,
          ROUND(COALESCE((
            SELECT (((r2+r3+r4)*30 + extra)::numeric / 30) * _egg_price
            FROM public.egg_production
            WHERE farm_id = _farm_id AND date::date = gs::date
            LIMIT 1
          ), 0), 2) AS v
        FROM generate_series(_max_date - 179, _max_date, interval '1 day') gs
      ) s
    ), '[]'::jsonb),

    -- Recent 20 production records
    'recent_production', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT date, label, r2, r3, r4, extra, ((r2+r3+r4)*30 + extra) AS eggs
        FROM public.egg_production WHERE farm_id = _farm_id
        ORDER BY date DESC LIMIT 20
      ) t
    ), '[]'::jsonb),

    'recent_feed', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT date, room, bags
        FROM public.feed_usage WHERE farm_id = _farm_id
        ORDER BY date DESC, created_at DESC LIMIT 20
      ) t
    ), '[]'::jsonb),

    'recent_mortality', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT date, room, cause, loss
        FROM public.mortality WHERE farm_id = _farm_id
        ORDER BY date DESC, created_at DESC LIMIT 20
      ) t
    ), '[]'::jsonb),

    'recent_health', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT date, name, scope, type
        FROM public.health_records WHERE farm_id = _farm_id
        ORDER BY date DESC, created_at DESC LIMIT 20
      ) t
    ), '[]'::jsonb),

    -- Monthly summary
    'monthly', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY month) FROM (
        SELECT to_char(date::date, 'YYYY-MM') AS month,
               SUM((r2+r3+r4)*30 + extra) AS eggs,
               SUM((r2+r3+r4)*30 + extra) / 30 AS crates,
               ROUND(SUM(((r2+r3+r4)*30 + extra)::numeric / 30 * _egg_price), 0) AS revenue
        FROM public.egg_production WHERE farm_id = _farm_id
        GROUP BY 1 ORDER BY 1
      ) t
    ), '[]'::jsonb)
  ) INTO result;

  -- Financials & derived metrics
  DECLARE
    _total_revenue NUMERIC;
    _total_feed_cost NUMERIC;
    _total_eggs BIGINT;
    _total_feed_bags NUMERIC;
    _total_mortality INT;
    _initial_birds INT;
  BEGIN
    _total_eggs := (result->>'total_eggs')::BIGINT;
    _total_feed_bags := (result->>'total_feed_bags')::NUMERIC;
    _total_mortality := (result->>'total_mortality')::INT;
    _initial_birds := (result->>'initial_birds')::INT;
    _total_revenue := ROUND((_total_eggs::NUMERIC / 30) * _egg_price, 2);
    _total_feed_cost := ROUND(_total_feed_bags * _feed_price, 2);

    result := result || jsonb_build_object(
      'total_revenue', _total_revenue,
      'total_feed_cost', _total_feed_cost,
      'gross_profit', _total_revenue - _total_feed_cost,
      'avg_daily_crates', ROUND((_total_eggs::NUMERIC / 30) / _days, 1),
      'avg_daily_feed_bags', ROUND(_total_feed_bags / _days, 2),
      'mortality_pct', ROUND(_total_mortality::NUMERIC / NULLIF(_initial_birds,0) * 100, 3),
      'feed_conversion_ratio', ROUND((_total_feed_bags * 25) / NULLIF(_total_eggs * 0.06, 0), 2),
      'annual_revenue', ROUND((_total_revenue / _days) * 365, 0)
    );
  END;

  RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION public.demo_greenfield_data() TO anon, authenticated;
