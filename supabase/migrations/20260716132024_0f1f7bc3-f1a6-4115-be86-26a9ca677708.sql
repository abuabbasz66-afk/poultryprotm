
-- Admin notifications table
CREATE TABLE public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  related_user_id UUID,
  related_farm_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

CREATE INDEX admin_notifications_created_at_idx ON public.admin_notifications (created_at DESC);
CREATE INDEX admin_notifications_unread_idx ON public.admin_notifications (is_read, is_archived, created_at DESC);

GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Super admins update notifications"
  ON public.admin_notifications FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
ALTER TABLE public.admin_notifications REPLICA IDENTITY FULL;

-- Trigger: on new farm, create admin notification + audit log entry
CREATE OR REPLACE FUNCTION public.on_farm_created_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email TEXT;
  _meta_full_name TEXT;
  _meta_phone TEXT;
BEGIN
  SELECT u.email::TEXT,
         COALESCE(u.raw_user_meta_data->>'full_name', NEW.owner_name),
         COALESCE(u.raw_user_meta_data->>'phone', NEW.phone)
    INTO _email, _meta_full_name, _meta_phone
  FROM auth.users u
  WHERE u.id = NEW.owner_id;

  INSERT INTO public.admin_notifications (type, title, message, metadata, related_user_id, related_farm_id)
  VALUES (
    'account_created',
    'New account registered',
    COALESCE(_meta_full_name, 'A new user') || ' registered ' || NEW.name,
    jsonb_build_object(
      'full_name', _meta_full_name,
      'farm_name', NEW.name,
      'email', _email,
      'phone', _meta_phone,
      'country', NEW.country,
      'state', NEW.state,
      'subscription_plan', COALESCE(NEW.subscription_plan, 'basic'),
      'user_id', NEW.owner_id,
      'farm_id', NEW.id,
      'registered_at', NEW.created_at
    ),
    NEW.owner_id,
    NEW.id
  );

  INSERT INTO public.admin_audit_log (admin_user_id, action_type, affected_user_id, affected_farm_id, new_value, reason)
  VALUES (
    NEW.owner_id,
    'account_created',
    NEW.owner_id,
    NEW.id,
    jsonb_build_object(
      'full_name', _meta_full_name,
      'farm_name', NEW.name,
      'email', _email,
      'plan', COALESCE(NEW.subscription_plan, 'basic')
    ),
    'New account created by ' || COALESCE(_meta_full_name, COALESCE(_email, 'unknown user')) || ' (' || NEW.name || ')'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_farm_created_notify ON public.farms;
CREATE TRIGGER trg_farm_created_notify
  AFTER INSERT ON public.farms
  FOR EACH ROW EXECUTE FUNCTION public.on_farm_created_notify();

-- Notification RPCs
CREATE OR REPLACE FUNCTION public.admin_list_notifications(_include_archived BOOLEAN DEFAULT false, _limit INT DEFAULT 100)
RETURNS SETOF public.admin_notifications
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT * FROM public.admin_notifications
  WHERE (_include_archived OR is_archived = false)
  ORDER BY created_at DESC
  LIMIT COALESCE(_limit, 100);
END $$;

CREATE OR REPLACE FUNCTION public.admin_mark_notification_read(_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.admin_notifications SET is_read = true, read_at = now() WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_mark_all_notifications_read()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.admin_notifications SET is_read = true, read_at = now() WHERE is_read = false;
END $$;

CREATE OR REPLACE FUNCTION public.admin_archive_notification(_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.admin_notifications SET is_archived = true, archived_at = now(), is_read = true WHERE id = _id;
END $$;

-- List super admin emails (for backend email dispatch)
CREATE OR REPLACE FUNCTION public.get_super_admin_emails()
RETURNS TABLE(email TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.email::TEXT
  FROM auth.users u
  JOIN public.user_roles ur ON ur.user_id = u.id
  WHERE ur.role = 'super_admin'::public.app_role AND u.email IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_super_admin_emails() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_emails() TO service_role;

-- Extend platform stats with new_users_today + new_users_this_month
CREATE OR REPLACE FUNCTION public.admin_platform_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'total_accounts', (SELECT COUNT(*) FROM auth.users),
    'total_farms', (SELECT COUNT(*) FROM public.farms),
    'active_farms', (SELECT COUNT(*) FROM public.farms WHERE status = 'active'),
    'suspended_accounts', (SELECT COUNT(*) FROM public.farms WHERE status = 'suspended'),
    'new_users_today', (SELECT COUNT(*) FROM auth.users WHERE created_at >= date_trunc('day', now())),
    'new_users_this_month', (SELECT COUNT(*) FROM auth.users WHERE created_at >= date_trunc('month', now())),
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
