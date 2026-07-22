
-- 1. platform_activity_log
CREATE TABLE IF NOT EXISTS public.platform_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  farm_id UUID,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_id UUID,
  device TEXT,
  browser TEXT,
  ip_address TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.platform_activity_log TO authenticated;
GRANT ALL ON public.platform_activity_log TO service_role;
ALTER TABLE public.platform_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read activity" ON public.platform_activity_log FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "users insert own activity" ON public.platform_activity_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE INDEX IF NOT EXISTS idx_pal_created ON public.platform_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pal_farm ON public.platform_activity_log(farm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pal_user ON public.platform_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pal_module ON public.platform_activity_log(module);

-- 2. user_presence
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users upsert own presence" ON public.user_presence FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins read presence" ON public.user_presence FOR SELECT TO authenticated USING (public.is_super_admin());

-- 3. support_sessions
CREATE TABLE IF NOT EXISTS public.support_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  farm_id UUID NOT NULL,
  reason TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  actions_taken JSONB DEFAULT '[]'::jsonb
);
GRANT SELECT, INSERT, UPDATE ON public.support_sessions TO authenticated;
GRANT ALL ON public.support_sessions TO service_role;
ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage support" ON public.support_sessions FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 4. platform_settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage settings" ON public.platform_settings FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 5. Activity trigger
CREATE OR REPLACE FUNCTION public.log_domain_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _module TEXT; _action TEXT; _farm UUID; _entity UUID;
BEGIN
  _module := TG_TABLE_NAME;
  _action := lower(TG_OP);
  IF TG_OP = 'DELETE' THEN
    _farm := OLD.farm_id; _entity := OLD.id;
  ELSE
    _farm := NEW.farm_id; _entity := NEW.id;
  END IF;
  INSERT INTO public.platform_activity_log(user_id, farm_id, module, action, entity_id, success)
  VALUES (auth.uid(), _farm, _module, _action, _entity, true);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_log_egg_production ON public.egg_production;
CREATE TRIGGER trg_log_egg_production AFTER INSERT OR UPDATE OR DELETE ON public.egg_production FOR EACH ROW EXECUTE FUNCTION public.log_domain_activity();
DROP TRIGGER IF EXISTS trg_log_feed_usage ON public.feed_usage;
CREATE TRIGGER trg_log_feed_usage AFTER INSERT OR UPDATE OR DELETE ON public.feed_usage FOR EACH ROW EXECUTE FUNCTION public.log_domain_activity();
DROP TRIGGER IF EXISTS trg_log_mortality ON public.mortality;
CREATE TRIGGER trg_log_mortality AFTER INSERT OR UPDATE OR DELETE ON public.mortality FOR EACH ROW EXECUTE FUNCTION public.log_domain_activity();
DROP TRIGGER IF EXISTS trg_log_health_records ON public.health_records;
CREATE TRIGGER trg_log_health_records AFTER INSERT OR UPDATE OR DELETE ON public.health_records FOR EACH ROW EXECUTE FUNCTION public.log_domain_activity();

-- 6. Backfill historical activity
INSERT INTO public.platform_activity_log(user_id, farm_id, module, action, entity_id, success, created_at)
SELECT f.owner_id, ep.farm_id, 'egg_production', 'insert', ep.id, true, ep.created_at
FROM public.egg_production ep JOIN public.farms f ON f.id = ep.farm_id
ON CONFLICT DO NOTHING;
INSERT INTO public.platform_activity_log(user_id, farm_id, module, action, entity_id, success, created_at)
SELECT f.owner_id, fu.farm_id, 'feed_usage', 'insert', fu.id, true, fu.created_at
FROM public.feed_usage fu JOIN public.farms f ON f.id = fu.farm_id
ON CONFLICT DO NOTHING;
INSERT INTO public.platform_activity_log(user_id, farm_id, module, action, entity_id, success, created_at)
SELECT f.owner_id, m.farm_id, 'mortality', 'insert', m.id, true, m.created_at
FROM public.mortality m JOIN public.farms f ON f.id = m.farm_id
ON CONFLICT DO NOTHING;
INSERT INTO public.platform_activity_log(user_id, farm_id, module, action, entity_id, success, created_at)
SELECT f.owner_id, h.farm_id, 'health_records', 'insert', h.id, true, h.created_at
FROM public.health_records h JOIN public.farms f ON f.id = h.farm_id
ON CONFLICT DO NOTHING;
INSERT INTO public.platform_activity_log(user_id, farm_id, module, action, entity_id, success, created_at)
SELECT f.owner_id, f.id, 'farms', 'insert', f.id, true, f.created_at
FROM public.farms f
ON CONFLICT DO NOTHING;

-- 7. RPCs
CREATE OR REPLACE FUNCTION public.admin_list_activity(
  _farm_id UUID DEFAULT NULL, _user_id UUID DEFAULT NULL,
  _module TEXT DEFAULT NULL, _action TEXT DEFAULT NULL,
  _from TIMESTAMPTZ DEFAULT NULL, _to TIMESTAMPTZ DEFAULT NULL,
  _limit INT DEFAULT 100, _offset INT DEFAULT 0
) RETURNS TABLE(
  id UUID, user_id UUID, user_email TEXT, farm_id UUID, farm_name TEXT,
  module TEXT, action TEXT, entity_id UUID, device TEXT, browser TEXT,
  ip_address TEXT, success BOOLEAN, metadata JSONB, created_at TIMESTAMPTZ,
  total_count BIGINT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _total BIGINT;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COUNT(*) INTO _total FROM public.platform_activity_log a
  WHERE (_farm_id IS NULL OR a.farm_id = _farm_id)
    AND (_user_id IS NULL OR a.user_id = _user_id)
    AND (_module IS NULL OR a.module = _module)
    AND (_action IS NULL OR a.action = _action)
    AND (_from IS NULL OR a.created_at >= _from)
    AND (_to IS NULL OR a.created_at <= _to);
  RETURN QUERY
  SELECT a.id, a.user_id, u.email::TEXT, a.farm_id, f.name,
         a.module, a.action, a.entity_id, a.device, a.browser,
         a.ip_address, a.success, a.metadata, a.created_at, _total
  FROM public.platform_activity_log a
  LEFT JOIN auth.users u ON u.id = a.user_id
  LEFT JOIN public.farms f ON f.id = a.farm_id
  WHERE (_farm_id IS NULL OR a.farm_id = _farm_id)
    AND (_user_id IS NULL OR a.user_id = _user_id)
    AND (_module IS NULL OR a.module = _module)
    AND (_action IS NULL OR a.action = _action)
    AND (_from IS NULL OR a.created_at >= _from)
    AND (_to IS NULL OR a.created_at <= _to)
  ORDER BY a.created_at DESC
  LIMIT COALESCE(_limit, 100) OFFSET COALESCE(_offset, 0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_platform_timeseries(_days INT DEFAULT 90)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _start DATE := (now() - make_interval(days => _days))::date; result JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'farm_growth', COALESCE((SELECT jsonb_agg(jsonb_build_object('d', d, 'v', v) ORDER BY d) FROM (
      SELECT gs::date AS d, (SELECT COUNT(*) FROM public.farms WHERE created_at::date <= gs::date)::int AS v
      FROM generate_series(_start, now()::date, interval '1 day') gs
    ) s), '[]'::jsonb),
    'user_growth', COALESCE((SELECT jsonb_agg(jsonb_build_object('d', d, 'v', v) ORDER BY d) FROM (
      SELECT gs::date AS d, (SELECT COUNT(*) FROM auth.users WHERE created_at::date <= gs::date)::int AS v
      FROM generate_series(_start, now()::date, interval '1 day') gs
    ) s), '[]'::jsonb),
    'dau', COALESCE((SELECT jsonb_agg(jsonb_build_object('d', d, 'v', v) ORDER BY d) FROM (
      SELECT gs::date AS d, (SELECT COUNT(DISTINCT user_id) FROM public.platform_activity_log WHERE created_at::date = gs::date)::int AS v
      FROM generate_series(_start, now()::date, interval '1 day') gs
    ) s), '[]'::jsonb),
    'eggs', COALESCE((SELECT jsonb_agg(jsonb_build_object('d', d, 'v', v) ORDER BY d) FROM (
      SELECT gs::date AS d, COALESCE((SELECT SUM((r2+r3+r4)*30 + extra) FROM public.egg_production WHERE date::date = gs::date), 0)::int AS v
      FROM generate_series(_start, now()::date, interval '1 day') gs
    ) s), '[]'::jsonb),
    'feed', COALESCE((SELECT jsonb_agg(jsonb_build_object('d', d, 'v', v) ORDER BY d) FROM (
      SELECT gs::date AS d, COALESCE((SELECT SUM(bags) FROM public.feed_usage WHERE date::date = gs::date), 0)::numeric AS v
      FROM generate_series(_start, now()::date, interval '1 day') gs
    ) s), '[]'::jsonb),
    'mortality', COALESCE((SELECT jsonb_agg(jsonb_build_object('d', d, 'v', v) ORDER BY d) FROM (
      SELECT gs::date AS d, COALESCE((SELECT SUM(loss) FROM public.mortality WHERE date::date = gs::date), 0)::int AS v
      FROM generate_series(_start, now()::date, interval '1 day') gs
    ) s), '[]'::jsonb),
    'top_farms_production', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (
      SELECT f.name AS farm_name, COALESCE(SUM((ep.r2+ep.r3+ep.r4)*30 + ep.extra), 0)::bigint AS eggs
      FROM public.farms f LEFT JOIN public.egg_production ep ON ep.farm_id = f.id
      GROUP BY f.id, f.name ORDER BY eggs DESC LIMIT 10
    ) t), '[]'::jsonb),
    'most_active_farms', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (
      SELECT f.name AS farm_name, COUNT(a.id)::bigint AS events
      FROM public.farms f LEFT JOIN public.platform_activity_log a ON a.farm_id = f.id
      WHERE a.created_at >= _start
      GROUP BY f.id, f.name ORDER BY events DESC LIMIT 10
    ) t), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_farm_intelligence(_farm_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB; _today DATE := now()::date;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'farm', (SELECT to_jsonb(f.*) - 'owner_id' FROM public.farms f WHERE id = _farm_id),
    'owner', (SELECT jsonb_build_object('email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at)
              FROM public.farms f JOIN auth.users u ON u.id = f.owner_id WHERE f.id = _farm_id),
    'rooms', COALESCE((SELECT jsonb_agg(to_jsonb(r.*)) FROM public.rooms r WHERE r.farm_id = _farm_id), '[]'::jsonb),
    'totals', jsonb_build_object(
      'birds', COALESCE((SELECT SUM(current) FROM public.rooms WHERE farm_id = _farm_id), 0),
      'eggs', COALESCE((SELECT SUM((r2+r3+r4)*30 + extra) FROM public.egg_production WHERE farm_id = _farm_id), 0),
      'crates', COALESCE((SELECT SUM((r2+r3+r4)*30 + extra)/30 FROM public.egg_production WHERE farm_id = _farm_id), 0),
      'feed_bags', COALESCE((SELECT SUM(bags) FROM public.feed_usage WHERE farm_id = _farm_id), 0),
      'mortality', COALESCE((SELECT SUM(loss) FROM public.mortality WHERE farm_id = _farm_id), 0),
      'health_records', COALESCE((SELECT COUNT(*) FROM public.health_records WHERE farm_id = _farm_id), 0)
    ),
    'production_90', COALESCE((SELECT jsonb_agg(jsonb_build_object('d', d, 'v', v) ORDER BY d) FROM (
      SELECT gs::date AS d, COALESCE((SELECT SUM((r2+r3+r4)*30 + extra)/30 FROM public.egg_production WHERE farm_id = _farm_id AND date::date = gs::date), 0)::int AS v
      FROM generate_series(_today - 89, _today, interval '1 day') gs
    ) s), '[]'::jsonb),
    'feed_90', COALESCE((SELECT jsonb_agg(jsonb_build_object('d', d, 'v', v) ORDER BY d) FROM (
      SELECT gs::date AS d, COALESCE((SELECT SUM(bags) FROM public.feed_usage WHERE farm_id = _farm_id AND date::date = gs::date), 0)::numeric AS v
      FROM generate_series(_today - 89, _today, interval '1 day') gs
    ) s), '[]'::jsonb),
    'mortality_90', COALESCE((SELECT jsonb_agg(jsonb_build_object('d', d, 'v', v) ORDER BY d) FROM (
      SELECT gs::date AS d, COALESCE((SELECT SUM(loss) FROM public.mortality WHERE farm_id = _farm_id AND date::date = gs::date), 0)::int AS v
      FROM generate_series(_today - 89, _today, interval '1 day') gs
    ) s), '[]'::jsonb),
    'recent_production', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM public.egg_production WHERE farm_id = _farm_id ORDER BY created_at DESC LIMIT 20) t), '[]'::jsonb),
    'recent_feed', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM public.feed_usage WHERE farm_id = _farm_id ORDER BY created_at DESC LIMIT 20) t), '[]'::jsonb),
    'recent_mortality', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM public.mortality WHERE farm_id = _farm_id ORDER BY created_at DESC LIMIT 20) t), '[]'::jsonb),
    'recent_health', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM public.health_records WHERE farm_id = _farm_id ORDER BY created_at DESC LIMIT 20) t), '[]'::jsonb),
    'prices', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM public.prices WHERE farm_id = _farm_id ORDER BY created_at DESC LIMIT 20) t), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_active_support_session(_farm_id UUID)
RETURNS SETOF public.support_sessions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT * FROM public.support_sessions WHERE farm_id = _farm_id AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1;
END $$;

CREATE OR REPLACE FUNCTION public.admin_start_support(_farm_id UUID, _reason TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.support_sessions(admin_user_id, farm_id, reason) VALUES (auth.uid(), _farm_id, _reason) RETURNING id INTO _id;
  INSERT INTO public.admin_audit_log(admin_user_id, action_type, affected_farm_id, reason) VALUES (auth.uid(), 'support_start', _farm_id, _reason);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_end_support(_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.support_sessions SET ended_at = now() WHERE id = _session_id AND ended_at IS NULL;
  INSERT INTO public.admin_audit_log(admin_user_id, action_type, reason) VALUES (auth.uid(), 'support_end', _session_id::TEXT);
END $$;

CREATE OR REPLACE FUNCTION public.admin_get_settings()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) INTO result FROM public.platform_settings;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_setting(_key TEXT, _value JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.platform_settings(key, value, updated_at) VALUES (_key, _value, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END $$;
