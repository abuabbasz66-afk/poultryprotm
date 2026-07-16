
DO $$
DECLARE fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_platform_stats()',
    'public.admin_list_accounts()',
    'public.admin_list_farms()',
    'public.admin_farm_summary(uuid)',
    'public.admin_intelligence_summary()',
    'public.admin_change_subscription(uuid, text, text)',
    'public.admin_set_account_status(uuid, text, text)',
    'public.admin_list_audit_log(integer)',
    'public.admin_assign_role(uuid, public.app_role)',
    'public.has_role(uuid, public.app_role)',
    'public.is_super_admin()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
