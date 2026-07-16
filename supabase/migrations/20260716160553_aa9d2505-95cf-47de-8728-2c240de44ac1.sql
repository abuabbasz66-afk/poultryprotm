
-- Super admin: permanently delete an account and all associated farm data.
-- SECURITY DEFINER; re-verifies is_super_admin() at the top so RPC callers
-- who are not super admins are rejected at the database.
CREATE OR REPLACE FUNCTION public.admin_delete_account(_user_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email TEXT;
  _farm RECORD;
  _farm_names TEXT[] := ARRAY[]::TEXT[];
  _farm_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_delete_self'; END IF;

  SELECT email::TEXT INTO _email FROM auth.users WHERE id = _user_id;
  IF _email IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

  -- Collect farms owned by this user, then cascade-delete their records.
  FOR _farm IN SELECT id, name FROM public.farms WHERE owner_id = _user_id LOOP
    _farm_ids := _farm_ids || _farm.id;
    _farm_names := _farm_names || _farm.name;
    DELETE FROM public.egg_production WHERE farm_id = _farm.id;
    DELETE FROM public.feed_usage      WHERE farm_id = _farm.id;
    DELETE FROM public.mortality       WHERE farm_id = _farm.id;
    DELETE FROM public.health_records  WHERE farm_id = _farm.id;
    DELETE FROM public.prices          WHERE farm_id = _farm.id;
    DELETE FROM public.rooms           WHERE farm_id = _farm.id;
  END LOOP;

  DELETE FROM public.admin_notifications WHERE related_user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;

  -- Audit BEFORE removing the auth user, so admin_user_id remains valid.
  INSERT INTO public.admin_audit_log
    (admin_user_id, action_type, affected_user_id, affected_farm_id,
     previous_value, new_value, reason)
  VALUES
    (auth.uid(), 'account_delete', _user_id,
     CASE WHEN array_length(_farm_ids, 1) > 0 THEN _farm_ids[1] ELSE NULL END,
     jsonb_build_object('email', _email, 'farms', _farm_names),
     jsonb_build_object('deleted', true),
     _reason);

  -- Cascades to public.farms via farms_owner_id_fkey ON DELETE CASCADE.
  DELETE FROM auth.users WHERE id = _user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', _user_id,
    'email', _email,
    'farms_deleted', COALESCE(array_length(_farm_ids, 1), 0)
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_delete_account(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_account(uuid, text) TO authenticated;
