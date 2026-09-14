-- 1. ai_model_versions: restrict reads to super admins
DROP POLICY IF EXISTS ai_model_select ON public.ai_model_versions;
CREATE POLICY ai_model_select ON public.ai_model_versions
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- 2. health_records update policy scoped to authenticated
DROP POLICY IF EXISTS "Update health" ON public.health_records;
CREATE POLICY "Update health" ON public.health_records
  FOR UPDATE TO authenticated
  USING (public.can_edit_recent(farm_id, 'health.write'::text, created_at))
  WITH CHECK (public.can(farm_id, 'health.write'::text));

-- 3. Revoke execute on SECURITY DEFINER helpers not called by the app
REVOKE EXECUTE ON FUNCTION public.academy_admin_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_assign_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_farm_benchmarks(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_recommendation_performance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.member_effective_permissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.platform_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.presentation_demo_data() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;