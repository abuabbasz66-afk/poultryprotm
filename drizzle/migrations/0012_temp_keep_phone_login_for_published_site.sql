-- TEMPORARY: the published site still calls this lookup from the browser.
-- Remove after the new version (server-side phone sign-in) is published:
-- REVOKE EXECUTE ON FUNCTION public.resolve_login_email(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon;