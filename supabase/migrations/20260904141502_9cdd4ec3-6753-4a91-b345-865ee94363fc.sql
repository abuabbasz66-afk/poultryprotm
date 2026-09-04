GRANT SELECT ON public.academy_categories TO anon, authenticated;
GRANT ALL ON public.academy_categories TO service_role;

GRANT SELECT ON public.academy_tutorials TO anon, authenticated;
GRANT ALL ON public.academy_tutorials TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_progress TO authenticated;
GRANT ALL ON public.academy_progress TO service_role;

GRANT SELECT, INSERT ON public.academy_events TO authenticated;
GRANT ALL ON public.academy_events TO service_role;