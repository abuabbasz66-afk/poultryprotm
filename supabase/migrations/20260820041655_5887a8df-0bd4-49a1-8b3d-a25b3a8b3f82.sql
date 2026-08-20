ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS paystack_customer_code text,
  ADD COLUMN IF NOT EXISTS paystack_subscription_code text,
  ADD COLUMN IF NOT EXISTS paystack_email_token text,
  ADD COLUMN IF NOT EXISTS paystack_plan_code text,
  ADD COLUMN IF NOT EXISTS paystack_subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_next_payment_at timestamptz;

CREATE INDEX IF NOT EXISTS farms_paystack_sub_code_idx ON public.farms (paystack_subscription_code);
CREATE INDEX IF NOT EXISTS farms_paystack_customer_code_idx ON public.farms (paystack_customer_code);

CREATE TABLE IF NOT EXISTS public.farm_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  plan text NOT NULL,
  amount_ngn numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  paystack_customer_code text,
  paystack_subscription_code text,
  paystack_plan_code text,
  gateway_response text,
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS farm_payments_farm_idx ON public.farm_payments (farm_id, created_at DESC);

GRANT SELECT ON public.farm_payments TO authenticated;
GRANT ALL ON public.farm_payments TO service_role;

ALTER TABLE public.farm_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Billing managers read own farm payments" ON public.farm_payments;
CREATE POLICY "Billing managers read own farm payments"
ON public.farm_payments FOR SELECT TO authenticated
USING (public.can(farm_id, 'subscription.manage'));

DROP TRIGGER IF EXISTS farm_payments_set_updated_at ON public.farm_payments;
CREATE TRIGGER farm_payments_set_updated_at
BEFORE UPDATE ON public.farm_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
  _effective := CASE
                  WHEN COALESCE(_farm.subscription_plan, 'basic') IN ('standard','premium') THEN _farm.subscription_plan
                  WHEN _is_trial THEN 'premium'
                  ELSE 'basic'
                END;
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
    'status', _farm.status,
    'paystack_subscription_code', _farm.paystack_subscription_code,
    'paystack_subscription_status', _farm.paystack_subscription_status,
    'subscription_started_at', _farm.subscription_started_at,
    'subscription_next_payment_at', _farm.subscription_next_payment_at
  );
END $function$;