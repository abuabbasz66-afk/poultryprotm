
DROP FUNCTION IF EXISTS public.admin_list_farms();

CREATE OR REPLACE FUNCTION public.admin_list_farms()
RETURNS TABLE(
  farm_id UUID, farm_name TEXT, owner_name TEXT, owner_email TEXT,
  location TEXT, state TEXT, country TEXT, bird_count INTEGER,
  rooms_count BIGINT, subscription_plan TEXT, status TEXT, created_at TIMESTAMPTZ,
  last_activity TIMESTAMPTZ, last_login TIMESTAMPTZ, is_online BOOLEAN, users_count BIGINT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT
    f.id, f.name, f.owner_name, u.email::TEXT,
    f.location, f.state, f.country, f.bird_count,
    (SELECT COUNT(*) FROM public.rooms r WHERE r.farm_id = f.id),
    f.subscription_plan, f.status, f.created_at,
    (SELECT MAX(created_at) FROM public.platform_activity_log WHERE farm_id = f.id),
    u.last_sign_in_at,
    COALESCE((SELECT last_seen >= now() - INTERVAL '15 minutes' FROM public.user_presence WHERE user_id = f.owner_id), false),
    1::BIGINT
  FROM public.farms f
  LEFT JOIN auth.users u ON u.id = f.owner_id
  ORDER BY f.created_at DESC;
END $$;
