
-- 1. Add trial + billing columns to farms
ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS trial_ends_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  ADD COLUMN IF NOT EXISTS auto_renew       BOOLEAN     NOT NULL DEFAULT true;

-- Reset every existing farm to a fresh 30-day trial starting now
UPDATE public.farms
   SET trial_started_at = now(),
       trial_ends_at    = now() + INTERVAL '30 days';

-- 2. Trigger to stamp trial window on new farms (safe if defaults already applied)
CREATE OR REPLACE FUNCTION public.set_default_trial_window()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.trial_started_at IS NULL THEN NEW.trial_started_at := now(); END IF;
  IF NEW.trial_ends_at IS NULL THEN NEW.trial_ends_at := NEW.trial_started_at + INTERVAL '30 days'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_farms_default_trial ON public.farms;
CREATE TRIGGER trg_farms_default_trial
BEFORE INSERT ON public.farms
FOR EACH ROW EXECUTE FUNCTION public.set_default_trial_window();

-- 3. Per-farm subscription status for the signed-in user's own farm
CREATE OR REPLACE FUNCTION public.farm_subscription_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _farm RECORD;
  _now TIMESTAMPTZ := now();
  _is_trial BOOLEAN;
  _effective TEXT;
  _days_remaining INT;
BEGIN
  SELECT id, subscription_plan, trial_started_at, trial_ends_at, auto_renew, plan_updated_at, status
    INTO _farm
    FROM public.farms
   WHERE owner_id = auth.uid()
   LIMIT 1;

  IF _farm.id IS NULL THEN
    RETURN jsonb_build_object('has_farm', false);
  END IF;

  _is_trial := _farm.trial_ends_at > _now;
  _effective := CASE WHEN _is_trial THEN 'premium' ELSE COALESCE(_farm.subscription_plan, 'basic') END;
  _days_remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (_farm.trial_ends_at - _now)) / 86400.0)::INT);

  RETURN jsonb_build_object(
    'has_farm', true,
    'farm_id', _farm.id,
    'plan', COALESCE(_farm.subscription_plan, 'basic'),
    'effective_plan', _effective,
    'is_trial', _is_trial,
    'trial_started_at', _farm.trial_started_at,
    'trial_ends_at', _farm.trial_ends_at,
    'days_remaining', _days_remaining,
    'auto_renew', _farm.auto_renew,
    'plan_updated_at', _farm.plan_updated_at,
    'status', _farm.status
  );
END $$;

GRANT EXECUTE ON FUNCTION public.farm_subscription_status() TO authenticated;

-- 4. Platform-wide subscription stats for Super Admin
CREATE OR REPLACE FUNCTION public.admin_subscription_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH f AS (
    SELECT
      subscription_plan,
      trial_ends_at,
      auto_renew,
      (trial_ends_at > now()) AS is_trial
    FROM public.farms
  )
  SELECT jsonb_build_object(
    'total_subscribers',   (SELECT COUNT(*) FROM f),
    'trial_users',         (SELECT COUNT(*) FROM f WHERE is_trial),
    'basic_users',         (SELECT COUNT(*) FROM f WHERE NOT is_trial AND subscription_plan = 'basic'),
    'standard_users',      (SELECT COUNT(*) FROM f WHERE NOT is_trial AND subscription_plan = 'standard'),
    'premium_users',       (SELECT COUNT(*) FROM f WHERE NOT is_trial AND subscription_plan = 'premium'),
    'expired_trials',      (SELECT COUNT(*) FROM f WHERE NOT is_trial AND subscription_plan = 'basic'),
    'renewals_due_7d',     (SELECT COUNT(*) FROM f WHERE is_trial AND trial_ends_at <= now() + INTERVAL '7 days'),
    'monthly_revenue_ngn', (
      SELECT COALESCE(SUM(CASE
        WHEN NOT is_trial AND subscription_plan = 'standard' THEN 950
        WHEN NOT is_trial AND subscription_plan = 'premium'  THEN 1950
        ELSE 0 END), 0)
      FROM f
    ),
    'annual_revenue_ngn',  (
      SELECT COALESCE(SUM(CASE
        WHEN NOT is_trial AND subscription_plan = 'standard' THEN 950
        WHEN NOT is_trial AND subscription_plan = 'premium'  THEN 1950
        ELSE 0 END), 0) * 12
      FROM f
    ),
    'failed_payments', 0
  ) INTO result;

  RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_subscription_stats() TO authenticated;

-- 5. Per-farm listing for Super Admin subscriptions table
CREATE OR REPLACE FUNCTION public.admin_list_subscriptions()
RETURNS TABLE(
  farm_id UUID,
  farm_name TEXT,
  owner_email TEXT,
  plan TEXT,
  effective_plan TEXT,
  is_trial BOOLEAN,
  trial_ends_at TIMESTAMPTZ,
  days_remaining INT,
  auto_renew BOOLEAN,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    u.email::TEXT,
    COALESCE(f.subscription_plan, 'basic'),
    CASE WHEN f.trial_ends_at > now() THEN 'premium' ELSE COALESCE(f.subscription_plan, 'basic') END,
    (f.trial_ends_at > now()),
    f.trial_ends_at,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (f.trial_ends_at - now())) / 86400.0)::INT),
    f.auto_renew,
    f.status,
    f.created_at
  FROM public.farms f
  LEFT JOIN auth.users u ON u.id = f.owner_id
  ORDER BY f.created_at DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions() TO authenticated;
