CREATE OR REPLACE FUNCTION public.demo_greenfield_data()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _farm_id uuid := '88cbfb05-38d1-4451-9b2d-1e0407eacf52';
  _egg_price numeric;
  _feed_price numeric;
  _bag_weight numeric;
  _min_date date;
  _max_date date;
  _days integer;
  _birds numeric;
  _initial_birds numeric;
  _total_eggs numeric;
  _total_feed_bags numeric;
  _total_mortality numeric;
  _total_revenue numeric;
  _total_feed_cost numeric;
  _other_expenses numeric;
  _stock_kg numeric;
  result jsonb;
BEGIN
  SELECT p.price INTO _egg_price FROM public.prices p
  WHERE p.farm_id = _farm_id AND p.item ILIKE '%egg%'
  ORDER BY p.created_at DESC LIMIT 1;

  SELECT p.price INTO _feed_price FROM public.prices p
  WHERE p.farm_id = _farm_id AND p.item ILIKE '%feed%'
  ORDER BY p.created_at DESC LIMIT 1;

  SELECT COALESCE(f.bag_weight_kg, 25) INTO _bag_weight
  FROM public.farms f WHERE f.id = _farm_id;

  SELECT MIN(d), MAX(d) INTO _min_date, _max_date FROM (
    SELECT e.date::date d FROM public.egg_production e WHERE e.farm_id = _farm_id
    UNION ALL SELECT x.date::date FROM public.feed_usage x WHERE x.farm_id = _farm_id
    UNION ALL SELECT m.date::date FROM public.mortality m WHERE m.farm_id = _farm_id
    UNION ALL SELECT h.date::date FROM public.health_records h WHERE h.farm_id = _farm_id
    UNION ALL SELECT e.entry_date FROM public.farm_expenses e WHERE e.farm_id = _farm_id
  ) dates;
  _days := GREATEST(1, COALESCE(_max_date - _min_date + 1, 1));

  SELECT COALESCE(SUM(r.current), 0), COALESCE(SUM(r.initial), 0)
  INTO _birds, _initial_birds FROM public.rooms r WHERE r.farm_id = _farm_id;
  SELECT COALESCE(SUM((e.r2 + e.r3 + e.r4) * 30 + e.extra), 0)
  INTO _total_eggs FROM public.egg_production e WHERE e.farm_id = _farm_id;
  SELECT COALESCE(SUM(f.bags), 0) INTO _total_feed_bags
  FROM public.feed_usage f WHERE f.farm_id = _farm_id;
  SELECT COALESCE(SUM(m.loss), 0) INTO _total_mortality
  FROM public.mortality m WHERE m.farm_id = _farm_id;
  SELECT COALESCE(SUM(e.amount), 0) INTO _other_expenses
  FROM public.farm_expenses e WHERE e.farm_id = _farm_id;
  SELECT COALESCE(SUM(i.remaining_kg), 0) INTO _stock_kg
  FROM public.feed_inventory i WHERE i.farm_id = _farm_id;

  _total_revenue := CASE WHEN _egg_price IS NULL THEN NULL ELSE ROUND((_total_eggs / 30) * _egg_price, 2) END;
  _total_feed_cost := CASE WHEN _feed_price IS NULL THEN NULL ELSE ROUND(_total_feed_bags * _feed_price, 2) END;

  SELECT jsonb_build_object(
    'farm_name', 'ABZ Global Resources',
    'farm_type', COALESCE((SELECT f.farm_type FROM public.farms f WHERE f.id = _farm_id), 'Layer Farm'),
    'location', 'Historical demonstration records',
    'period_start', _min_date,
    'period_end', _max_date,
    'days_covered', _days,
    'egg_price', _egg_price,
    'feed_price', _feed_price,
    'bag_weight_kg', _bag_weight,
    'birds', _birds,
    'initial_birds', _initial_birds,
    'houses', (SELECT COUNT(*) FROM public.rooms r WHERE r.farm_id = _farm_id),
    'total_eggs', _total_eggs,
    'total_crates', FLOOR(_total_eggs / 30),
    'total_feed_bags', _total_feed_bags,
    'total_feed_kg', _total_feed_bags * _bag_weight,
    'total_mortality', _total_mortality,
    'health_records_count', (SELECT COUNT(*) FROM public.health_records h WHERE h.farm_id = _farm_id),
    'vaccination_records_count', (SELECT COUNT(*) FROM public.vaccination_records v WHERE v.farm_id = _farm_id AND v.deleted_at IS NULL),
    'production_records_count', (SELECT COUNT(*) FROM public.egg_production e WHERE e.farm_id = _farm_id),
    'feed_records_count', (SELECT COUNT(*) FROM public.feed_usage f WHERE f.farm_id = _farm_id),
    'mortality_records_count', (SELECT COUNT(*) FROM public.mortality m WHERE m.farm_id = _farm_id),
    'total_revenue', _total_revenue,
    'total_feed_cost', _total_feed_cost,
    'other_expenses', _other_expenses,
    'gross_profit', CASE WHEN _total_revenue IS NULL OR _total_feed_cost IS NULL THEN NULL ELSE _total_revenue - _total_feed_cost - _other_expenses END,
    'avg_daily_feed_bags', CASE WHEN _days > 0 THEN ROUND(_total_feed_bags / _days, 2) ELSE NULL END,
    'mortality_pct', CASE WHEN _initial_birds > 0 THEN ROUND(_total_mortality / _initial_birds * 100, 3) ELSE NULL END,
    'stock_kg', _stock_kg,
    'stock_days_remaining', CASE WHEN _stock_kg > 0 AND _total_feed_bags > 0 THEN ROUND(_stock_kg / ((_total_feed_bags * _bag_weight) / _days), 1) ELSE NULL END,
    'rooms', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',r.name,'current',r.current,'initial',r.initial,'mortality_pct',CASE WHEN r.initial > 0 THEN ROUND(((r.initial-r.current)::numeric/r.initial)*100,2) END) ORDER BY r.name) FROM public.rooms r WHERE r.farm_id=_farm_id),'[]'::jsonb),
    'production_daily', COALESCE((SELECT jsonb_agg(row_to_json(t) ORDER BY t.d) FROM (SELECT e.date::date d, SUM((e.r2+e.r3+e.r4)*30+e.extra)::numeric eggs, SUM((e.r2+e.r3+e.r4)*30+e.extra)::numeric/30 crates FROM public.egg_production e WHERE e.farm_id=_farm_id GROUP BY e.date::date) t),'[]'::jsonb),
    'room_production', COALESCE((SELECT jsonb_agg(row_to_json(t) ORDER BY t.d,t.room) FROM (SELECT e.date::date d, r.room, SUM(r.crates)::numeric crates FROM public.egg_production e CROSS JOIN LATERAL (VALUES ('Room 2',e.r2),('Room 3',e.r3),('Room 4',e.r4)) r(room,crates) WHERE e.farm_id=_farm_id GROUP BY e.date::date,r.room) t),'[]'::jsonb),
    'feed_daily', COALESCE((SELECT jsonb_agg(row_to_json(t) ORDER BY t.d) FROM (SELECT f.date::date d,SUM(f.bags)::numeric bags,SUM(f.bags)*_bag_weight kg FROM public.feed_usage f WHERE f.farm_id=_farm_id GROUP BY f.date::date) t),'[]'::jsonb),
    'mortality_daily', COALESCE((SELECT jsonb_agg(row_to_json(t) ORDER BY t.d) FROM (SELECT m.date::date d,SUM(m.loss)::numeric loss FROM public.mortality m WHERE m.farm_id=_farm_id GROUP BY m.date::date) t),'[]'::jsonb),
    'recent_health', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (SELECT h.date,h.name,h.scope,h.type FROM public.health_records h WHERE h.farm_id=_farm_id ORDER BY h.date DESC,h.created_at DESC LIMIT 12) t),'[]'::jsonb),
    'expense_breakdown', COALESCE((SELECT jsonb_agg(row_to_json(t) ORDER BY t.amount DESC) FROM (SELECT e.subcategory label,SUM(e.amount)::numeric amount FROM public.farm_expenses e WHERE e.farm_id=_farm_id GROUP BY e.subcategory) t),'[]'::jsonb),
    'finance_daily', COALESCE((SELECT jsonb_agg(row_to_json(t) ORDER BY t.d) FROM (SELECT dates.d,CASE WHEN _egg_price IS NULL THEN NULL ELSE ROUND(COALESCE(p.eggs,0)/30*_egg_price,2) END revenue,CASE WHEN _feed_price IS NULL THEN NULL ELSE ROUND(COALESCE(fd.bags,0)*_feed_price,2) END feed_cost,COALESCE(ex.amount,0)::numeric other_expenses FROM (SELECT e.date::date d FROM public.egg_production e WHERE e.farm_id=_farm_id UNION SELECT f.date::date FROM public.feed_usage f WHERE f.farm_id=_farm_id UNION SELECT x.entry_date FROM public.farm_expenses x WHERE x.farm_id=_farm_id) dates LEFT JOIN (SELECT e.date::date d,SUM((e.r2+e.r3+e.r4)*30+e.extra)::numeric eggs FROM public.egg_production e WHERE e.farm_id=_farm_id GROUP BY e.date::date) p USING(d) LEFT JOIN (SELECT f.date::date d,SUM(f.bags)::numeric bags FROM public.feed_usage f WHERE f.farm_id=_farm_id GROUP BY f.date::date) fd USING(d) LEFT JOIN (SELECT x.entry_date d,SUM(x.amount)::numeric amount FROM public.farm_expenses x WHERE x.farm_id=_farm_id GROUP BY x.entry_date) ex USING(d)) t),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.demo_greenfield_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.demo_greenfield_data() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_greenfield_data() TO service_role;