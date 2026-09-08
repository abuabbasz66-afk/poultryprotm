DO $$
DECLARE r record; keep_auth boolean;
BEGIN
  FOR r IN
    SELECT p.oid AS oid, p.oid::regprocedure AS sig, (t.typname = 'trigger') AS is_trigger
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'public'
  LOOP
    keep_auth := (NOT r.is_trigger) AND has_function_privilege('authenticated', r.oid, 'EXECUTE');
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    IF keep_auth THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
    IF NOT r.is_trigger THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END IF;
  END LOOP;
END $$;

-- Only these are reachable before sign-in (public landing + auth screen).
GRANT EXECUTE ON FUNCTION public.landing_platform_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, text, text, text, text, text, text, jsonb) TO anon;

-- Admin audit log: read-only from the app, writes only via trusted server code.
REVOKE ALL ON public.admin_audit_log FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_log FROM authenticated;
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

-- Admin notifications: super admins may read/update via policy; no direct create/delete.
REVOKE ALL ON public.admin_notifications FROM anon;
REVOKE INSERT, DELETE ON public.admin_notifications FROM authenticated;
GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;

-- Support sessions: super-admin scoped policy already exists; remove anon reach.
REVOKE ALL ON public.support_sessions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_sessions TO authenticated;
GRANT ALL ON public.support_sessions TO service_role;