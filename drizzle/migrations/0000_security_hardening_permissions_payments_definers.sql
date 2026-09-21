-- 1. farm_member_permissions: only the farm owner may create/modify/delete
-- permission rows. This removes any path where a staff member holding
-- 'staff.manage' could grant elevated permissions through another record.
DROP POLICY IF EXISTS member_permissions_insert ON public.farm_member_permissions;
DROP POLICY IF EXISTS member_permissions_update ON public.farm_member_permissions;
DROP POLICY IF EXISTS member_permissions_delete ON public.farm_member_permissions;

CREATE POLICY member_permissions_insert
  ON public.farm_member_permissions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.farms f
            WHERE f.id = farm_member_permissions.farm_id AND f.owner_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.farm_members m
            WHERE m.id = farm_member_permissions.member_id
              AND m.farm_id = farm_member_permissions.farm_id
              AND m.user_id IS DISTINCT FROM auth.uid())
  );

CREATE POLICY member_permissions_update
  ON public.farm_member_permissions FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.farms f
            WHERE f.id = farm_member_permissions.farm_id AND f.owner_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.farm_members m
            WHERE m.id = farm_member_permissions.member_id AND m.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.farms f
            WHERE f.id = farm_member_permissions.farm_id AND f.owner_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.farm_members m
            WHERE m.id = farm_member_permissions.member_id
              AND m.farm_id = farm_member_permissions.farm_id
              AND m.user_id IS DISTINCT FROM auth.uid())
  );

CREATE POLICY member_permissions_delete
  ON public.farm_member_permissions FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.farms f
            WHERE f.id = farm_member_permissions.farm_id AND f.owner_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.farm_members m
            WHERE m.id = farm_member_permissions.member_id AND m.user_id = auth.uid())
  );

-- 2. farm_payments: billing rows are written only by trusted server billing
-- code. Make that coverage explicit instead of relying on default-deny, and
-- make sure no client role can write.
REVOKE INSERT, UPDATE, DELETE ON public.farm_payments FROM authenticated, anon;
GRANT SELECT ON public.farm_payments TO authenticated;
GRANT ALL ON public.farm_payments TO service_role;

DROP POLICY IF EXISTS "Service role writes payments" ON public.farm_payments;
CREATE POLICY "Service role writes payments"
  ON public.farm_payments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. SECURITY DEFINER helpers that no client should call directly.
REVOKE EXECUTE ON FUNCTION public.get_super_admin_emails() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.member_effective_permissions(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_super_admin_emails() TO service_role;
GRANT EXECUTE ON FUNCTION public.member_effective_permissions(uuid) TO service_role;
