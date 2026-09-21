ALTER TABLE public.academy_progress
  ADD COLUMN progress_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN last_position_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN last_watched_at timestamptz;

ALTER TABLE public.academy_progress
  ADD CONSTRAINT academy_progress_percent_check CHECK (progress_percent >= 0 AND progress_percent <= 100),
  ADD CONSTRAINT academy_progress_position_check CHECK (last_position_seconds >= 0);

CREATE TABLE public.academy_video_health (
  tutorial_id uuid PRIMARY KEY REFERENCES public.academy_tutorials(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'NOT_TESTED',
  url_status text NOT NULL DEFAULT 'NOT_TESTED',
  playback_status text NOT NULL DEFAULT 'NOT_TESTED',
  detail text,
  checked_at timestamptz,
  checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academy_video_health_provider_check CHECK (provider IN ('youtube', 'vimeo', 'direct', 'storage', 'other', 'missing')),
  CONSTRAINT academy_video_health_status_check CHECK (status IN ('PASS', 'WARNING', 'FAIL', 'NOT_TESTED')),
  CONSTRAINT academy_video_health_url_check CHECK (url_status IN ('REACHABLE', 'UNREACHABLE', 'NOT_TESTED')),
  CONSTRAINT academy_video_health_playback_check CHECK (playback_status IN ('VERIFIED', 'FAILED', 'NOT_VERIFIED', 'NOT_TESTED'))
);
GRANT SELECT, INSERT, UPDATE ON public.academy_video_health TO authenticated;
GRANT ALL ON public.academy_video_health TO service_role;
ALTER TABLE public.academy_video_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read academy video health"
  ON public.academy_video_health FOR SELECT TO authenticated
  USING (public.is_super_admin());
CREATE POLICY "Super admins insert academy video health"
  ON public.academy_video_health FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() AND checked_by = auth.uid());
CREATE POLICY "Super admins update academy video health"
  ON public.academy_video_health FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin() AND checked_by = auth.uid());
CREATE TRIGGER academy_video_health_updated_at
  BEFORE UPDATE ON public.academy_video_health
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.academy_video_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id uuid NOT NULL REFERENCES public.academy_tutorials(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'Video could not be loaded',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT academy_video_reports_reason_length CHECK (char_length(reason) BETWEEN 3 AND 500)
);
CREATE INDEX academy_video_reports_tutorial_idx ON public.academy_video_reports (tutorial_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.academy_video_reports TO authenticated;
GRANT ALL ON public.academy_video_reports TO service_role;
ALTER TABLE public.academy_video_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users report academy videos"
  ON public.academy_video_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users read own academy video reports"
  ON public.academy_video_reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "Super admins resolve academy video reports"
  ON public.academy_video_reports FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

INSERT INTO public.academy_video_health (tutorial_id, provider, status, url_status, playback_status, detail)
SELECT id,
  CASE
    WHEN video_url IS NULL OR btrim(video_url) = '' THEN 'missing'
    WHEN video_url ~* '(^|//)(www\.)?(youtube\.com|youtu\.be)(/|$)' THEN 'youtube'
    WHEN video_url ~* '(^|//)(www\.)?vimeo\.com(/|$)' THEN 'vimeo'
    WHEN video_url ILIKE '%/storage/v1/object/%' THEN 'storage'
    WHEN video_url ~* '\.mp4([?#].*)?$' THEN 'direct'
    ELSE 'other'
  END,
  'NOT_TESTED',
  'NOT_TESTED',
  'NOT_TESTED',
  'Awaiting an administrator playback check.'
FROM public.academy_tutorials
ON CONFLICT (tutorial_id) DO NOTHING;