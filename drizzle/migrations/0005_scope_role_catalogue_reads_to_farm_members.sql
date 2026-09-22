CREATE OR REPLACE FUNCTION public.is_active_farm_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.farm_members m
    WHERE m.user_id = auth.uid()
      AND COALESCE(m.status, 'active') = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_farm_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_farm_member() TO authenticated, service_role;

DROP POLICY IF EXISTS "Roles are readable by signed-in users" ON public.farm_roles;
CREATE POLICY "Farm members can read the role catalogue"
ON public.farm_roles
FOR SELECT
TO authenticated
USING (public.is_active_farm_member() OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Role permissions are readable by signed-in users" ON public.role_permissions;
CREATE POLICY "Farm members can read role permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (public.is_active_farm_member() OR public.has_role(auth.uid(), 'super_admin'::public.app_role));