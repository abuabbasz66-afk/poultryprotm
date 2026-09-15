
-- 1) farm_expenses: prevent re-scoping of updated rows
CREATE OR REPLACE FUNCTION public.guard_expense_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.farm_id IS DISTINCT FROM OLD.farm_id THEN
    RAISE EXCEPTION 'Expense cannot be moved to another farm';
  END IF;
  IF NEW.recorded_by IS DISTINCT FROM OLD.recorded_by THEN
    RAISE EXCEPTION 'Expense recorder cannot be reassigned';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_farm_expense_update ON public.farm_expenses;
CREATE TRIGGER guard_farm_expense_update
BEFORE UPDATE ON public.farm_expenses
FOR EACH ROW EXECUTE FUNCTION public.guard_expense_update();

-- 2) farm_member_permissions: block self-grant by non-owners
DROP POLICY IF EXISTS member_permissions_insert ON public.farm_member_permissions;
CREATE POLICY member_permissions_insert ON public.farm_member_permissions
FOR INSERT TO authenticated
WITH CHECK (
  can(farm_id, 'staff.manage')
  AND (
    EXISTS (SELECT 1 FROM public.farms f WHERE f.id = farm_id AND f.owner_id = auth.uid())
    OR NOT EXISTS (
      SELECT 1 FROM public.farm_members m
      WHERE m.id = farm_member_permissions.member_id AND m.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS member_permissions_update ON public.farm_member_permissions;
CREATE POLICY member_permissions_update ON public.farm_member_permissions
FOR UPDATE TO authenticated
USING (
  can(farm_id, 'staff.manage')
  AND (
    EXISTS (SELECT 1 FROM public.farms f WHERE f.id = farm_id AND f.owner_id = auth.uid())
    OR NOT EXISTS (
      SELECT 1 FROM public.farm_members m
      WHERE m.id = farm_member_permissions.member_id AND m.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  can(farm_id, 'staff.manage')
  AND (
    EXISTS (SELECT 1 FROM public.farms f WHERE f.id = farm_id AND f.owner_id = auth.uid())
    OR NOT EXISTS (
      SELECT 1 FROM public.farm_members m
      WHERE m.id = farm_member_permissions.member_id AND m.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS member_permissions_delete ON public.farm_member_permissions;
CREATE POLICY member_permissions_delete ON public.farm_member_permissions
FOR DELETE TO authenticated
USING (
  can(farm_id, 'staff.manage')
  AND (
    EXISTS (SELECT 1 FROM public.farms f WHERE f.id = farm_id AND f.owner_id = auth.uid())
    OR NOT EXISTS (
      SELECT 1 FROM public.farm_members m
      WHERE m.id = farm_member_permissions.member_id AND m.user_id = auth.uid()
    )
  )
);

-- 3) vaccination scope: programme must belong to the same farm (or be the shared baseline)
CREATE OR REPLACE FUNCTION public.validate_vaccination_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.batch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.layer_batches b WHERE b.id = NEW.batch_id AND b.farm_id = NEW.farm_id
  ) THEN
    RAISE EXCEPTION 'Flock does not belong to this farm';
  END IF;

  IF NEW.programme_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vaccination_programmes p
    WHERE p.id = NEW.programme_id AND (p.farm_id IS NULL OR p.farm_id = NEW.farm_id)
  ) THEN
    RAISE EXCEPTION 'Vaccination programme does not belong to this farm';
  END IF;

  IF TG_TABLE_NAME = 'vaccination_records' AND NEW.room_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.rooms r WHERE r.id = NEW.room_id AND r.farm_id = NEW.farm_id
  ) THEN
    RAISE EXCEPTION 'Room does not belong to this farm';
  END IF;

  RETURN NEW;
END;
$$;

-- 4) SECURITY DEFINER functions: remove implicit PUBLIC execute, grant explicitly
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- public (unauthenticated) surface: landing page, demo and login helpers only
GRANT EXECUTE ON FUNCTION public.demo_greenfield_data() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_platform_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, text, text, text, text, text, text, jsonb) TO anon, authenticated;

-- signed-in app surface (each function performs its own authorization checks)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN (
        'admin_active_support_session','admin_archive_notification','admin_change_subscription',
        'admin_delete_account','admin_end_support','admin_farm_intelligence','admin_farm_summary',
        'admin_get_settings','admin_intelligence_summary','admin_list_accounts','admin_list_activity',
        'admin_list_audit_log','admin_list_farms','admin_list_notifications','admin_list_subscriptions',
        'admin_mark_all_notifications_read','admin_mark_notification_read','admin_platform_stats',
        'admin_platform_timeseries','admin_set_account_status','admin_set_setting','admin_start_support',
        'admin_subscription_stats','admin_whatsapp_export','admin_whatsapp_recent','admin_whatsapp_stats',
        'can','can_edit_recent','complete_password_change','consume_feed_fifo','current_farm_id',
        'farm_activity_log','farm_feed_stock_kg','farm_security_events','farm_staff_get_permissions',
        'farm_staff_list','farm_staff_set_permissions','farm_staff_set_role','farm_staff_set_status',
        'farm_subscription_status','get_super_admin_emails','is_super_admin','member_effective_permissions',
        'my_farm_context','my_farm_ids','touch_member_login','farm_feed_stock_kg'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;
