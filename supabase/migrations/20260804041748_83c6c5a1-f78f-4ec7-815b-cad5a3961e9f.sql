-- 1. Manager permissions: operations only
DELETE FROM public.role_permissions
 WHERE role_key = 'manager' AND permission IN ('prices.read','reports.read');

-- 2. 24-hour edit window for non-owner roles
CREATE OR REPLACE FUNCTION public.can_edit_recent(_farm uuid, _perm text, _created timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can(_farm, _perm) AND (
    EXISTS (SELECT 1 FROM public.farms f WHERE f.id = _farm AND f.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.farm_members m
      JOIN public.role_permissions rp ON rp.role_key = m.role_key
      WHERE m.farm_id = _farm AND m.user_id = auth.uid() AND m.status = 'active' AND rp.permission = '*'
    )
    OR _created > now() - interval '24 hours'
  );
$$;

DROP POLICY IF EXISTS "Update production" ON public.egg_production;
CREATE POLICY "Update production" ON public.egg_production FOR UPDATE
  USING (public.can_edit_recent(farm_id, 'production.write', created_at))
  WITH CHECK (public.can(farm_id, 'production.write'));

DROP POLICY IF EXISTS "Update feed usage" ON public.feed_usage;
CREATE POLICY "Update feed usage" ON public.feed_usage FOR UPDATE
  USING (public.can_edit_recent(farm_id, 'feed.write', created_at))
  WITH CHECK (public.can(farm_id, 'feed.write'));

DROP POLICY IF EXISTS "Update mortality" ON public.mortality;
CREATE POLICY "Update mortality" ON public.mortality FOR UPDATE
  USING (public.can_edit_recent(farm_id, 'mortality.write', created_at))
  WITH CHECK (public.can(farm_id, 'mortality.write'));

DROP POLICY IF EXISTS "Update health" ON public.health_records;
CREATE POLICY "Update health" ON public.health_records FOR UPDATE
  USING (public.can_edit_recent(farm_id, 'health.write', created_at))
  WITH CHECK (public.can(farm_id, 'health.write'));

-- 3. Security / staff activity events
CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  actor_email text,
  actor_role text,
  event_type text NOT NULL,
  detail text,
  device text,
  browser text,
  os text,
  ip_address text,
  location text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX security_events_farm_created_idx ON public.security_events (farm_id, created_at DESC);

GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads security events" ON public.security_events FOR SELECT
  TO authenticated
  USING (farm_id IS NOT NULL AND public.can(farm_id, 'audit.read'));

-- 4. Recording helper (usable before a session exists, e.g. failed logins)
CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _identifier text DEFAULT NULL,
  _detail text DEFAULT NULL,
  _device text DEFAULT NULL,
  _browser text DEFAULT NULL,
  _os text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _location text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _m RECORD;
BEGIN
  IF _uid IS NOT NULL THEN
    SELECT m.farm_id, m.full_name, m.email, m.role_key
      INTO _m
      FROM public.farm_members m
     WHERE m.user_id = _uid AND m.status = 'active'
     ORDER BY CASE WHEN m.role_key = 'owner' THEN 0 ELSE 1 END
     LIMIT 1;
  ELSIF _identifier IS NOT NULL THEN
    SELECT m.farm_id, m.full_name, m.email, m.role_key
      INTO _m
      FROM public.farm_members m
     WHERE lower(m.email) = lower(_identifier) OR m.phone = _identifier
     LIMIT 1;
  END IF;

  IF _m.farm_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.security_events
    (farm_id, user_id, actor_name, actor_email, actor_role, event_type, detail,
     device, browser, os, ip_address, location, metadata)
  VALUES
    (_m.farm_id, _uid, _m.full_name, COALESCE(_m.email, _identifier), _m.role_key, _event_type, _detail,
     _device, _browser, _os, _ip, _location, COALESCE(_metadata, '{}'::jsonb));
END $$;

GRANT EXECUTE ON FUNCTION public.log_security_event(text,text,text,text,text,text,text,text,jsonb) TO anon, authenticated;

-- 5. Owner-only reader with filters
CREATE OR REPLACE FUNCTION public.farm_security_events(
  _event_type text DEFAULT NULL,
  _role text DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _limit integer DEFAULT 200
) RETURNS SETOF public.security_events
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _farm uuid;
BEGIN
  SELECT m.farm_id INTO _farm FROM public.farm_members m
   WHERE m.user_id = auth.uid() AND m.status = 'active'
   ORDER BY CASE WHEN m.role_key = 'owner' THEN 0 ELSE 1 END LIMIT 1;
  IF _farm IS NULL OR NOT public.can(_farm, 'audit.read') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT * FROM public.security_events e
   WHERE e.farm_id = _farm
     AND (_event_type IS NULL OR e.event_type = _event_type)
     AND (_role IS NULL OR e.actor_role = _role)
     AND (_user_id IS NULL OR e.user_id = _user_id)
     AND (_from IS NULL OR e.created_at >= _from)
     AND (_to IS NULL OR e.created_at <= _to)
   ORDER BY e.created_at DESC
   LIMIT COALESCE(_limit, 200);
END $$;
