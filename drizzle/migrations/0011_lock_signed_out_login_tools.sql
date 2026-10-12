-- Throttle table for sign-in lookups and failed-login logging. Server-only.
-- Rollback: GRANT EXECUTE ON FUNCTION public.resolve_login_email(text), public.log_security_event(text,text,text,text,text,text,text,text,jsonb) TO anon;
CREATE TABLE public.auth_rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket text NOT NULL,
  key_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_rate_limits_lookup ON public.auth_rate_limits (bucket, key_hash, created_at DESC);
GRANT ALL ON public.auth_rate_limits TO service_role;
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.auth_rate_limits IS 'Server-only throttle for sign-in lookups; no client access.';

-- Phone-to-email lookup is now only reachable from the server sign-in function.
REVOKE EXECUTE ON FUNCTION public.resolve_login_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO service_role;

-- Signed-out callers can no longer write security events; failed logins are logged by the server.
REVOKE EXECUTE ON FUNCTION public.log_security_event(text,text,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(text,text,text,text,text,text,text,text,jsonb) TO authenticated, service_role;