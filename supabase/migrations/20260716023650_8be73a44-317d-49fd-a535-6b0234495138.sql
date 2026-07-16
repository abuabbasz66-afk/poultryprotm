
-- =========================================================
-- Roles
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('user', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin'::public.app_role)
$$;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- =========================================================
-- Farms: subscription plan + status
-- =========================================================
ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

DO $$ BEGIN
  ALTER TABLE public.farms
    ADD CONSTRAINT farms_subscription_plan_check
    CHECK (subscription_plan IN ('basic','standard','premium'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.farms
    ADD CONSTRAINT farms_status_check
    CHECK (status IN ('active','suspended'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- Admin audit log
-- =========================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  affected_user_id UUID,
  affected_farm_id UUID,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read audit log" ON public.admin_audit_log;
CREATE POLICY "Super admins read audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- =========================================================
-- Admin RPCs (SECURITY DEFINER; internal role check)
-- =========================================================

-- Platform overview stats
CREATE OR REPLACE FUNCTION public.admin_platform_stats()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'total_accounts', (SELECT COUNT(*) FROM auth.users),
    'total_farms', (SELECT COUNT(*) FROM public.farms),
    'active_farms', (SELECT COUNT(*) FROM public.farms WHERE status = 'active'),
    'suspended_accounts', (SELECT COUNT(*) FROM public.farms WHERE status = 'suspended'),
    'new_farms_this_month', (SELECT COUNT(*) FROM public.farms WHERE created_at >= date_trunc('month', now())),
    'basic_plan_farms', (SELECT COUNT(*) FROM public.farms WHERE subscription_plan = 'basic'),
    'standard_plan_farms', (SELECT COUNT(*) FROM public.farms WHERE subscription_plan = 'standard'),
    'premium_plan_farms', (SELECT COUNT(*) FROM public.farms WHERE subscription_plan = 'premium'),
    'total_production_records', (SELECT COUNT(*) FROM public.egg_production),
    'total_feed_records', (SELECT COUNT(*) FROM public.feed_usage),
    'total_mortality_records', (SELECT COUNT(*) FROM public.mortality),
    'total_health_records', (SELECT COUNT(*) FROM public.health_records),
    'recent_signups_7d', (SELECT COUNT(*) FROM auth.users WHERE created_at >= now() - INTERVAL '7 days'),
    'recent_farms_7d', (SELECT COUNT(*) FROM public.farms WHERE created_at >= now() - INTERVAL '7 days')
  ) INTO result;
  RETURN result;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_platform_stats() TO authenticated;

-- List accounts (with farm info)
CREATE OR REPLACE FUNCTION public.admin_list_accounts()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  account_created TIMESTAMPTZ,
  last_sign_in TIMESTAMPTZ,
  farm_id UUID,
  farm_name TEXT,
  owner_name TEXT,
  subscription_plan TEXT,
  status TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::TEXT, u.created_at, u.last_sign_in_at,
         f.id, f.name, f.owner_name, f.subscription_plan, f.status
  FROM auth.users u
  LEFT JOIN public.farms f ON f.owner_id = u.id
  ORDER BY u.created_at DESC;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;

-- List farms with counts
CREATE OR REPLACE FUNCTION public.admin_list_farms()
RETURNS TABLE (
  farm_id UUID,
  farm_name TEXT,
  owner_name TEXT,
  owner_email TEXT,
  location TEXT,
  state TEXT,
  country TEXT,
  bird_count INTEGER,
  rooms_count BIGINT,
  subscription_plan TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT f.id, f.name, f.owner_name, u.email::TEXT,
         f.location, f.state, f.country, f.bird_count,
         (SELECT COUNT(*) FROM public.rooms r WHERE r.farm_id = f.id),
         f.subscription_plan, f.status, f.created_at
  FROM public.farms f
  LEFT JOIN auth.users u ON u.id = f.owner_id
  ORDER BY f.created_at DESC;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_list_farms() TO authenticated;

-- Farm support summary
CREATE OR REPLACE FUNCTION public.admin_farm_summary(_farm_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'farm', to_jsonb(f.*) - 'owner_id',
    'owner', jsonb_build_object('user_id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at),
    'rooms_count', (SELECT COUNT(*) FROM public.rooms WHERE farm_id = f.id),
    'production_count', (SELECT COUNT(*) FROM public.egg_production WHERE farm_id = f.id),
    'production_latest', (SELECT MAX(prod_date) FROM public.egg_production WHERE farm_id = f.id),
    'feed_count', (SELECT COUNT(*) FROM public.feed_usage WHERE farm_id = f.id),
    'feed_latest', (SELECT MAX(feed_date) FROM public.feed_usage WHERE farm_id = f.id),
    'mortality_count', (SELECT COUNT(*) FROM public.mortality WHERE farm_id = f.id),
    'mortality_latest', (SELECT MAX(death_date) FROM public.mortality WHERE farm_id = f.id),
    'health_count', (SELECT COUNT(*) FROM public.health_records WHERE farm_id = f.id),
    'health_latest', (SELECT MAX(record_date) FROM public.health_records WHERE farm_id = f.id),
    'price_count', (SELECT COUNT(*) FROM public.prices WHERE farm_id = f.id)
  ) INTO result
  FROM public.farms f
  LEFT JOIN auth.users u ON u.id = f.owner_id
  WHERE f.id = _farm_id;
  RETURN result;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_farm_summary(UUID) TO authenticated;

-- Intelligence usage summary (based on data sufficiency)
CREATE OR REPLACE FUNCTION public.admin_intelligence_summary()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'production_forecast_ready', (SELECT COUNT(DISTINCT farm_id) FROM public.egg_production GROUP BY farm_id HAVING COUNT(*) >= 7 LIMIT 1),
    'farms_with_production', (SELECT COUNT(DISTINCT farm_id) FROM public.egg_production),
    'farms_with_feed', (SELECT COUNT(DISTINCT farm_id) FROM public.feed_usage),
    'farms_with_mortality', (SELECT COUNT(DISTINCT farm_id) FROM public.mortality),
    'farms_with_health', (SELECT COUNT(DISTINCT farm_id) FROM public.health_records),
    'premium_farms', (SELECT COUNT(*) FROM public.farms WHERE subscription_plan = 'premium')
  ) INTO result;
  RETURN result;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_intelligence_summary() TO authenticated;

-- Change subscription
CREATE OR REPLACE FUNCTION public.admin_change_subscription(
  _farm_id UUID, _new_plan TEXT, _reason TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _prev TEXT; _owner UUID;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _new_plan NOT IN ('basic','standard','premium') THEN RAISE EXCEPTION 'invalid_plan'; END IF;
  SELECT subscription_plan, owner_id INTO _prev, _owner FROM public.farms WHERE id = _farm_id;
  IF _prev IS NULL THEN RAISE EXCEPTION 'farm_not_found'; END IF;
  UPDATE public.farms SET subscription_plan = _new_plan, plan_updated_at = now() WHERE id = _farm_id;
  INSERT INTO public.admin_audit_log
    (admin_user_id, action_type, affected_user_id, affected_farm_id, previous_value, new_value, reason)
  VALUES
    (auth.uid(), 'subscription_change', _owner, _farm_id,
     jsonb_build_object('plan', _prev), jsonb_build_object('plan', _new_plan), _reason);
  RETURN jsonb_build_object('ok', true, 'previous', _prev, 'new', _new_plan);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_change_subscription(UUID, TEXT, TEXT) TO authenticated;

-- Change account status
CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  _farm_id UUID, _new_status TEXT, _reason TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _prev TEXT; _owner UUID;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _new_status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  SELECT status, owner_id INTO _prev, _owner FROM public.farms WHERE id = _farm_id;
  IF _prev IS NULL THEN RAISE EXCEPTION 'farm_not_found'; END IF;
  UPDATE public.farms SET status = _new_status WHERE id = _farm_id;
  INSERT INTO public.admin_audit_log
    (admin_user_id, action_type, affected_user_id, affected_farm_id, previous_value, new_value, reason)
  VALUES
    (auth.uid(), CASE WHEN _new_status='suspended' THEN 'account_suspend' ELSE 'account_reactivate' END,
     _owner, _farm_id, jsonb_build_object('status', _prev), jsonb_build_object('status', _new_status), _reason);
  RETURN jsonb_build_object('ok', true, 'previous', _prev, 'new', _new_status);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(UUID, TEXT, TEXT) TO authenticated;

-- Audit log paginated read
CREATE OR REPLACE FUNCTION public.admin_list_audit_log(_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  id UUID, admin_user_id UUID, admin_email TEXT, action_type TEXT,
  affected_user_id UUID, affected_farm_id UUID, affected_farm_name TEXT,
  previous_value JSONB, new_value JSONB, reason TEXT, created_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT a.id, a.admin_user_id, au.email::TEXT, a.action_type,
         a.affected_user_id, a.affected_farm_id, f.name,
         a.previous_value, a.new_value, a.reason, a.created_at
  FROM public.admin_audit_log a
  LEFT JOIN auth.users au ON au.id = a.admin_user_id
  LEFT JOIN public.farms f ON f.id = a.affected_farm_id
  ORDER BY a.created_at DESC
  LIMIT COALESCE(_limit, 100);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_log(INTEGER) TO authenticated;

-- Assign a role (super admin only, or bootstrap via service_role)
CREATE OR REPLACE FUNCTION public.admin_assign_role(_target_user UUID, _role public.app_role)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target_user, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.admin_audit_log (admin_user_id, action_type, affected_user_id, new_value)
  VALUES (auth.uid(), 'role_assign', _target_user, jsonb_build_object('role', _role::TEXT));
  RETURN jsonb_build_object('ok', true);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_assign_role(UUID, public.app_role) TO authenticated;
