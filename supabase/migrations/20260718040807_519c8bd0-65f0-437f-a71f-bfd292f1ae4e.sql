
-- =========================================================
-- WhatsApp click tracking
-- =========================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  page_path TEXT,
  page_label TEXT,
  user_type TEXT NOT NULL DEFAULT 'guest',
  user_id UUID,
  device_type TEXT,
  browser TEXT,
  country TEXT,
  city TEXT,
  referrer TEXT,
  referrer_source TEXT,
  session_id TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS whatsapp_clicks_created_at_idx ON public.whatsapp_clicks (created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_clicks_page_label_idx ON public.whatsapp_clicks (page_label);
CREATE INDEX IF NOT EXISTS whatsapp_clicks_referrer_source_idx ON public.whatsapp_clicks (referrer_source);

GRANT INSERT ON public.whatsapp_clicks TO anon, authenticated;
GRANT ALL    ON public.whatsapp_clicks TO service_role;

ALTER TABLE public.whatsapp_clicks ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can insert their own click.
CREATE POLICY "anyone can log a whatsapp click"
  ON public.whatsapp_clicks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only super admins may read.
CREATE POLICY "super admins can read whatsapp clicks"
  ON public.whatsapp_clicks
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- =========================================================
-- Landing visit counter (denominator for conversion rate)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.landing_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  page_label TEXT,
  session_id TEXT
);

CREATE INDEX IF NOT EXISTS landing_visits_created_at_idx ON public.landing_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS landing_visits_session_idx ON public.landing_visits (session_id);

GRANT INSERT ON public.landing_visits TO anon, authenticated;
GRANT ALL    ON public.landing_visits TO service_role;

ALTER TABLE public.landing_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can log a landing visit"
  ON public.landing_visits FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "super admins can read landing visits"
  ON public.landing_visits FOR SELECT TO authenticated USING (public.is_super_admin());

-- =========================================================
-- Admin analytics functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_whatsapp_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  total_clicks BIGINT;
  today_clicks BIGINT;
  week_clicks BIGINT;
  month_clicks BIGINT;
  total_visits BIGINT;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COUNT(*) INTO total_clicks FROM public.whatsapp_clicks;
  SELECT COUNT(*) INTO today_clicks FROM public.whatsapp_clicks WHERE created_at >= date_trunc('day', now());
  SELECT COUNT(*) INTO week_clicks  FROM public.whatsapp_clicks WHERE created_at >= now() - INTERVAL '7 days';
  SELECT COUNT(*) INTO month_clicks FROM public.whatsapp_clicks WHERE created_at >= now() - INTERVAL '30 days';
  SELECT COUNT(*) INTO total_visits FROM public.landing_visits;

  SELECT jsonb_build_object(
    'total', total_clicks,
    'today', today_clicks,
    'last_7_days', week_clicks,
    'last_30_days', month_clicks,
    'total_visits', total_visits,
    'conversion_rate', CASE WHEN total_visits > 0 THEN ROUND((total_clicks::NUMERIC / total_visits) * 100, 2) ELSE 0 END,
    'top_pages', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT COALESCE(page_label, 'Unknown') AS page, COUNT(*) AS clicks
        FROM public.whatsapp_clicks
        GROUP BY 1 ORDER BY clicks DESC LIMIT 10
      ) t
    ), '[]'::jsonb),
    'devices', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT COALESCE(device_type, 'Unknown') AS device, COUNT(*) AS clicks
        FROM public.whatsapp_clicks
        GROUP BY 1 ORDER BY clicks DESC
      ) t
    ), '[]'::jsonb),
    'sources', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT COALESCE(referrer_source, 'Direct') AS source, COUNT(*) AS clicks
        FROM public.whatsapp_clicks
        GROUP BY 1 ORDER BY clicks DESC LIMIT 10
      ) t
    ), '[]'::jsonb),
    'user_types', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT COALESCE(user_type, 'guest') AS user_type, COUNT(*) AS clicks
        FROM public.whatsapp_clicks
        GROUP BY 1 ORDER BY clicks DESC
      ) t
    ), '[]'::jsonb),
    'browsers', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT COALESCE(browser, 'Unknown') AS browser, COUNT(*) AS clicks
        FROM public.whatsapp_clicks
        GROUP BY 1 ORDER BY clicks DESC LIMIT 8
      ) t
    ), '[]'::jsonb),
    'countries', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT COALESCE(country, 'Unknown') AS country, COUNT(*) AS clicks
        FROM public.whatsapp_clicks
        GROUP BY 1 ORDER BY clicks DESC LIMIT 10
      ) t
    ), '[]'::jsonb),
    'daily_trend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('date', d, 'clicks', v) ORDER BY d) FROM (
        SELECT gs::date AS d,
          COALESCE((
            SELECT COUNT(*) FROM public.whatsapp_clicks
            WHERE created_at::date = gs::date
          ), 0)::int AS v
        FROM generate_series((now() - INTERVAL '29 days')::date, now()::date, interval '1 day') gs
      ) s
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_whatsapp_recent(_limit INT DEFAULT 50)
RETURNS SETOF public.whatsapp_clicks
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT * FROM public.whatsapp_clicks
  ORDER BY created_at DESC
  LIMIT COALESCE(_limit, 50);
END $$;

CREATE OR REPLACE FUNCTION public.admin_whatsapp_export()
RETURNS SETOF public.whatsapp_clicks
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT * FROM public.whatsapp_clicks
  ORDER BY created_at DESC
  LIMIT 10000;
END $$;

-- =========================================================
-- Notify admin dashboard on every WhatsApp click
-- =========================================================
CREATE OR REPLACE FUNCTION public.on_whatsapp_click_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, metadata)
  VALUES (
    'whatsapp_enquiry',
    'New WhatsApp enquiry',
    'A ' || COALESCE(NEW.user_type, 'guest') || ' opened WhatsApp chat from ' || COALESCE(NEW.page_label, 'the site'),
    jsonb_build_object(
      'page', NEW.page_label,
      'page_path', NEW.page_path,
      'user_type', NEW.user_type,
      'device', NEW.device_type,
      'browser', NEW.browser,
      'country', NEW.country,
      'city', NEW.city,
      'referrer', NEW.referrer,
      'source', NEW.referrer_source,
      'session_id', NEW.session_id
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS whatsapp_click_notify ON public.whatsapp_clicks;
CREATE TRIGGER whatsapp_click_notify
AFTER INSERT ON public.whatsapp_clicks
FOR EACH ROW EXECUTE FUNCTION public.on_whatsapp_click_notify();
