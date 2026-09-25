GRANT SELECT, INSERT, UPDATE ON public.communication_preferences TO authenticated;
GRANT SELECT ON public.engagement_messages TO authenticated;
GRANT SELECT, INSERT ON public.engagement_call_requests TO authenticated;
GRANT ALL ON public.communication_preferences, public.engagement_messages, public.engagement_call_requests TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;