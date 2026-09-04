-- 1) Ownership-scoped recent-edit window
CREATE OR REPLACE FUNCTION public.can_edit_recent(_farm uuid, _perm text, _created timestamptz, _recorded_by uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.can(_farm, _perm) AND (
    EXISTS (SELECT 1 FROM public.farms f WHERE f.id = _farm AND f.owner_id = auth.uid())
    OR (_created > now() - interval '24 hours'
        AND (_recorded_by IS NULL OR _recorded_by = auth.uid()))
  );
$function$;

DROP POLICY IF EXISTS "expenses_update" ON public.farm_expenses;
CREATE POLICY "expenses_update" ON public.farm_expenses FOR UPDATE TO authenticated
USING (public.can_edit_recent(farm_id, 'expenses.write', created_at, recorded_by))
WITH CHECK (public.can_edit_recent(farm_id, 'expenses.write', created_at, recorded_by));

DROP POLICY IF EXISTS "revenue_update" ON public.farm_revenue;
CREATE POLICY "revenue_update" ON public.farm_revenue FOR UPDATE TO authenticated
USING (public.can_edit_recent(farm_id, 'revenue.write', created_at, recorded_by))
WITH CHECK (public.can_edit_recent(farm_id, 'revenue.write', created_at, recorded_by));

DROP POLICY IF EXISTS "broiler_daily_update" ON public.broiler_daily;
CREATE POLICY "broiler_daily_update" ON public.broiler_daily FOR UPDATE TO authenticated
USING (public.can_edit_recent(farm_id, 'production.write', created_at, recorded_by))
WITH CHECK (public.can_edit_recent(farm_id, 'production.write', created_at, recorded_by));

DROP POLICY IF EXISTS "broiler_sales_update" ON public.broiler_sales;
CREATE POLICY "broiler_sales_update" ON public.broiler_sales FOR UPDATE TO authenticated
USING (public.can_edit_recent(farm_id, 'sales.write', created_at, recorded_by))
WITH CHECK (public.can_edit_recent(farm_id, 'sales.write', created_at, recorded_by));

DROP POLICY IF EXISTS "broiler_vaccinations_update" ON public.broiler_vaccinations;
CREATE POLICY "broiler_vaccinations_update" ON public.broiler_vaccinations FOR UPDATE TO authenticated
USING (public.can_edit_recent(farm_id, 'health.write', created_at, recorded_by))
WITH CHECK (public.can_edit_recent(farm_id, 'health.write', created_at, recorded_by));

DROP POLICY IF EXISTS "broiler_medications_update" ON public.broiler_medications;
CREATE POLICY "broiler_medications_update" ON public.broiler_medications FOR UPDATE TO authenticated
USING (public.can_edit_recent(farm_id, 'health.write', created_at, recorded_by))
WITH CHECK (public.can_edit_recent(farm_id, 'health.write', created_at, recorded_by));

-- 2) farm_payments: server-side (service role) writes only
REVOKE INSERT, UPDATE, DELETE ON public.farm_payments FROM authenticated;
REVOKE ALL ON public.farm_payments FROM anon;
GRANT SELECT ON public.farm_payments TO authenticated;
GRANT ALL ON public.farm_payments TO service_role;

-- 3) admin_notifications realtime: read/mark-read for super admins only
REVOKE INSERT, DELETE ON public.admin_notifications FROM authenticated;
REVOKE ALL ON public.admin_notifications FROM anon;
GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;

-- role source of truth used by is_super_admin(): no client writes at all
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
REVOKE ALL ON public.user_roles FROM anon;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;