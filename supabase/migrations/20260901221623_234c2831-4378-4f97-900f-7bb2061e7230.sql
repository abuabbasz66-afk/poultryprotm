CREATE OR REPLACE FUNCTION public.farm_subscription_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _farm RECORD;
  _now TIMESTAMPTZ := now();
  _is_trial BOOLEAN;
  _effective TEXT;
  _days_remaining INT;
  _paid_plan TEXT;
  _plan_expired BOOLEAN := false;
BEGIN
  SELECT id, subscription_plan, trial_started_at, trial_ends_at, auto_renew, plan_updated_at, status,
         paystack_subscription_code, paystack_subscription_status, subscription_started_at,
         subscription_next_payment_at
    INTO _farm
    FROM public.farms
   WHERE owner_id = auth.uid()
   LIMIT 1;

  IF _farm.id IS NULL THEN
    RETURN jsonb_build_object('has_farm', false);
  END IF;

  _is_trial := _farm.trial_ends_at > _now;
  _paid_plan := COALESCE(_farm.subscription_plan, 'basic');

  -- One-off (transfer / bank / USSD) months do not renew: once the paid period
  -- ends the farm falls back to the free plan until it pays again.
  IF _paid_plan IN ('standard','premium')
     AND COALESCE(_farm.auto_renew, false) = false
     AND _farm.subscription_next_payment_at IS NOT NULL
     AND _farm.subscription_next_payment_at <= _now THEN
    _plan_expired := true;
  END IF;

  _effective := CASE
                  WHEN _paid_plan IN ('standard','premium') AND NOT _plan_expired THEN _paid_plan
                  WHEN _is_trial THEN 'premium'
                  ELSE 'basic'
                END;
  _days_remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (_farm.trial_ends_at - _now)) / 86400.0)::INT);

  RETURN jsonb_build_object(
    'has_farm', true,
    'farm_id', _farm.id,
    'plan', _paid_plan,
    'effective_plan', _effective,
    'plan_expired', _plan_expired,
    'is_trial', _is_trial,
    'trial_started_at', _farm.trial_started_at,
    'trial_ends_at', _farm.trial_ends_at,
    'days_remaining', _days_remaining,
    'auto_renew', COALESCE(_farm.auto_renew, false),
    'plan_updated_at', _farm.plan_updated_at,
    'status', _farm.status,
    'paystack_subscription_code', _farm.paystack_subscription_code,
    'paystack_subscription_status', _farm.paystack_subscription_status,
    'subscription_started_at', _farm.subscription_started_at,
    'subscription_next_payment_at', _farm.subscription_next_payment_at
  );
END $function$;