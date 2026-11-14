INSERT INTO public.platform_settings (key, value, updated_at)
VALUES ('whatsapp_community', '{"enabled":false,"url":null}'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_whatsapp_community()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN value->>'enabled' = 'true'
      AND value->>'url' ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]+/?(?:\?.*)?$'
    THEN jsonb_build_object('enabled', true, 'url', value->>'url')
    ELSE '{"enabled":false,"url":null}'::jsonb
  END
  FROM public.platform_settings
  WHERE key = 'whatsapp_community'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_community() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_community() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_whatsapp_community(_enabled boolean, _url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned text := nullif(trim(coalesce(_url, '')), '');
  saved jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _enabled AND cleaned IS NULL THEN
    RAISE EXCEPTION 'Add the official WhatsApp invitation link before enabling it.';
  END IF;
  IF cleaned IS NOT NULL AND cleaned !~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]+/?(?:\?.*)?$' THEN
    RAISE EXCEPTION 'Use a valid https://chat.whatsapp.com invitation link.';
  END IF;

  saved := jsonb_build_object('enabled', _enabled AND cleaned IS NOT NULL, 'url', cleaned);
  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('whatsapp_community', saved, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  INSERT INTO public.admin_audit_log (admin_user_id, action_type, new_value)
  VALUES (auth.uid(), 'whatsapp_community_updated', jsonb_build_object('enabled', _enabled AND cleaned IS NOT NULL));

  RETURN saved;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_whatsapp_community(boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_whatsapp_community(boolean, text) TO authenticated, service_role;