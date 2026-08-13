
-- 1. Fixed search_path
CREATE OR REPLACE FUNCTION public.price_key(_item text, _category text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN coalesce(_category,'') = 'eggs' OR coalesce(_item,'') ~* 'egg'  THEN 'eggs'
    WHEN coalesce(_category,'') = 'feed' OR coalesce(_item,'') ~* 'feed' THEN 'feed'
    ELSE lower(btrim(regexp_replace(coalesce(_item,''), '\s+', ' ', 'g')))
  END
$function$;

-- 2. Remove wildcard bypass of the 24h edit window (owners only)
CREATE OR REPLACE FUNCTION public.can_edit_recent(_farm uuid, _perm text, _created timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.can(_farm, _perm) AND (
    EXISTS (SELECT 1 FROM public.farms f WHERE f.id = _farm AND f.owner_id = auth.uid())
    OR _created > now() - interval '24 hours'
  );
$function$;

-- 3. Explicit write policies on farm_member_permissions
DROP POLICY IF EXISTS member_permissions_insert ON public.farm_member_permissions;
DROP POLICY IF EXISTS member_permissions_update ON public.farm_member_permissions;
DROP POLICY IF EXISTS member_permissions_delete ON public.farm_member_permissions;

CREATE POLICY member_permissions_insert ON public.farm_member_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.can(farm_id, 'staff.manage'));

CREATE POLICY member_permissions_update ON public.farm_member_permissions
  FOR UPDATE TO authenticated
  USING (public.can(farm_id, 'staff.manage'))
  WITH CHECK (public.can(farm_id, 'staff.manage'));

CREATE POLICY member_permissions_delete ON public.farm_member_permissions
  FOR DELETE TO authenticated
  USING (public.can(farm_id, 'staff.manage'));

-- 4. Receipts bucket: explicit ownership-checked UPDATE/DELETE
DROP POLICY IF EXISTS receipts_update ON storage.objects;
DROP POLICY IF EXISTS receipts_delete ON storage.objects;

CREATE POLICY receipts_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND public.can((NULLIF((storage.foldername(name))[1], ''))::uuid, 'expenses.write'))
  WITH CHECK (bucket_id = 'receipts' AND public.can((NULLIF((storage.foldername(name))[1], ''))::uuid, 'expenses.write'));

CREATE POLICY receipts_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND public.can((NULLIF((storage.foldername(name))[1], ''))::uuid, 'expenses.write'));
