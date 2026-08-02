REVOKE EXECUTE ON FUNCTION public.my_farm_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_farm_context() FROM anon;
REVOKE EXECUTE ON FUNCTION public.touch_member_login() FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_password_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.farm_activity_log(integer) FROM anon;

CREATE OR REPLACE FUNCTION public.farm_staff_list()
RETURNS TABLE(id uuid, user_id uuid, full_name text, email text, phone text,
              role_key text, role_label text, status text, must_change_password boolean,
              last_login_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _farm uuid;
BEGIN
  SELECT m.farm_id INTO _farm FROM public.farm_members m
   WHERE m.user_id = auth.uid()
   ORDER BY CASE WHEN m.role_key='owner' THEN 0 ELSE 1 END LIMIT 1;
  IF _farm IS NULL OR NOT public.can(_farm, 'staff.manage') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT m.id, m.user_id, m.full_name, m.email, m.phone, m.role_key, r.label,
         m.status, m.must_change_password, m.last_login_at, m.created_at
  FROM public.farm_members m JOIN public.farm_roles r ON r.key = m.role_key
  WHERE m.farm_id = _farm
  ORDER BY CASE WHEN m.role_key='owner' THEN 0 ELSE 1 END, m.created_at;
END $$;
REVOKE EXECUTE ON FUNCTION public.farm_staff_list() FROM anon;

CREATE OR REPLACE FUNCTION public.farm_staff_set_role(_member_id uuid, _role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m RECORD;
BEGIN
  SELECT * INTO _m FROM public.farm_members WHERE id = _member_id;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;
  IF NOT public.can(_m.farm_id, 'staff.manage') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _m.role_key = 'owner' THEN RAISE EXCEPTION 'cannot_change_owner'; END IF;
  IF _role = 'owner' THEN RAISE EXCEPTION 'cannot_assign_owner'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.farm_roles WHERE key = _role) THEN RAISE EXCEPTION 'invalid_role'; END IF;
  UPDATE public.farm_members SET role_key = _role WHERE id = _member_id;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.farm_staff_set_role(uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION public.farm_staff_set_status(_member_id uuid, _status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m RECORD;
BEGIN
  IF _status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  SELECT * INTO _m FROM public.farm_members WHERE id = _member_id;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;
  IF NOT public.can(_m.farm_id, 'staff.manage') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _m.role_key = 'owner' THEN RAISE EXCEPTION 'cannot_suspend_owner'; END IF;
  UPDATE public.farm_members SET status = _status WHERE id = _member_id;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.farm_staff_set_status(uuid, text) FROM anon;