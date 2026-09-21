-- 1. consume_feed_fifo is SECURITY DEFINER and callable by any signed-in user.
--    Without an authorization check a user could pass another farm's id and
--    mutate that farm's feed inventory and ledger. Enforce the same permission
--    the app requires for feed writes, and validate inputs.
CREATE OR REPLACE FUNCTION public.consume_feed_fifo(_farm_id uuid, _kg numeric, _entry_date date, _source_ref uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _remaining NUMERIC := _kg;
  _take NUMERIC;
  _lot RECORD;
  _balance NUMERIC;
BEGIN
  IF _farm_id IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Trigger-driven calls run with no JWT (auth.uid() IS NULL); user calls must be authorized.
  IF auth.uid() IS NOT NULL AND NOT public.can(_farm_id, 'feed.write') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF _kg IS NULL OR _kg <= 0 OR _kg > 1000000 THEN RETURN; END IF;
  IF _entry_date IS NULL OR _entry_date < DATE '2000-01-01' OR _entry_date > (CURRENT_DATE + 1) THEN
    RAISE EXCEPTION 'Invalid date' USING ERRCODE = '22007';
  END IF;

  FOR _lot IN
    SELECT id, remaining_kg FROM public.feed_inventory
    WHERE farm_id = _farm_id AND remaining_kg > 0
    ORDER BY purchase_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN _remaining <= 0;
    _take := LEAST(_lot.remaining_kg, _remaining);
    UPDATE public.feed_inventory SET remaining_kg = remaining_kg - _take WHERE id = _lot.id;
    _balance := public.farm_feed_stock_kg(_farm_id);
    INSERT INTO public.feed_ledger(farm_id, entry_date, action, quantity_kg, balance_after_kg, inventory_id, source_ref, note)
    VALUES (_farm_id, _entry_date, 'usage', -_take, _balance, _lot.id, _source_ref, 'Auto-deducted from daily feed usage');
    _remaining := _remaining - _take;
  END LOOP;

  IF _remaining > 0 THEN
    _balance := public.farm_feed_stock_kg(_farm_id);
    INSERT INTO public.feed_ledger(farm_id, entry_date, action, quantity_kg, balance_after_kg, inventory_id, source_ref, note)
    VALUES (_farm_id, _entry_date, 'usage', -_remaining, _balance, NULL, _source_ref,
            'Usage recorded with no inventory on hand — add a purchase to reconcile.');
  END IF;
END $function$;

-- farm_feed_stock_kg is a read-only definer helper; scope it to farms the caller can read.
CREATE OR REPLACE FUNCTION public.farm_feed_stock_kg(_farm_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _total NUMERIC;
BEGIN
  IF _farm_id IS NULL THEN RETURN 0; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.can(_farm_id, 'feed.read') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(SUM(remaining_kg), 0) INTO _total
    FROM public.feed_inventory WHERE farm_id = _farm_id;
  RETURN COALESCE(_total, 0);
END $function$;

-- 2. Public analytics inserts: keep anonymous tracking working, but constrain the
--    payload so the open endpoint cannot be used to store arbitrary bulk content
--    or to attribute a click to another signed-in user.
DROP POLICY IF EXISTS "anyone can log a landing visit" ON public.landing_visits;
CREATE POLICY "anyone can log a landing visit"
  ON public.landing_visits FOR INSERT TO anon, authenticated
  WITH CHECK (
    COALESCE(length(page_label), 0) <= 120
    AND COALESCE(length(session_id), 0) <= 100
  );

DROP POLICY IF EXISTS "anyone can log a whatsapp click" ON public.whatsapp_clicks;
CREATE POLICY "anyone can log a whatsapp click"
  ON public.whatsapp_clicks FOR INSERT TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND COALESCE(length(page_path), 0) <= 300
    AND COALESCE(length(page_label), 0) <= 120
    AND COALESCE(length(user_type), 0) <= 40
    AND COALESCE(length(device_type), 0) <= 40
    AND COALESCE(length(browser), 0) <= 60
    AND COALESCE(length(country), 0) <= 80
    AND COALESCE(length(city), 0) <= 80
    AND COALESCE(length(referrer), 0) <= 500
    AND COALESCE(length(referrer_source), 0) <= 80
    AND COALESCE(length(session_id), 0) <= 100
    AND COALESCE(length(user_agent), 0) <= 500
  );