-- =====================================================================
-- PoultryPro Academy
-- =====================================================================

CREATE TABLE public.academy_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.academy_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_categories TO authenticated;
GRANT ALL ON public.academy_categories TO service_role;

ALTER TABLE public.academy_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active academy categories"
  ON public.academy_categories FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_super_admin());

CREATE POLICY "Admins manage academy categories"
  ON public.academy_categories FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TABLE public.academy_tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.academy_categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  video_url text,
  thumbnail_url text,
  duration_seconds integer,
  difficulty text NOT NULL DEFAULT 'Beginner',
  keywords text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academy_tutorials_difficulty_check
    CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced'))
);

CREATE INDEX academy_tutorials_category_idx ON public.academy_tutorials (category_id, sort_order);
CREATE INDEX academy_tutorials_published_idx ON public.academy_tutorials (is_published, is_archived);

GRANT SELECT ON public.academy_tutorials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_tutorials TO authenticated;
GRANT ALL ON public.academy_tutorials TO service_role;

ALTER TABLE public.academy_tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published tutorials"
  ON public.academy_tutorials FOR SELECT
  TO anon, authenticated
  USING ((is_published = true AND is_archived = false) OR public.is_super_admin());

CREATE POLICY "Admins manage tutorials"
  ON public.academy_tutorials FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TABLE public.academy_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutorial_id uuid NOT NULL REFERENCES public.academy_tutorials(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tutorial_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_progress TO authenticated;
GRANT ALL ON public.academy_progress TO service_role;

ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own academy progress"
  ON public.academy_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own academy progress"
  ON public.academy_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own academy progress"
  ON public.academy_progress FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own academy progress"
  ON public.academy_progress FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.academy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutorial_id uuid NOT NULL REFERENCES public.academy_tutorials(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academy_events_type_check CHECK (event_type IN ('view', 'complete'))
);

CREATE INDEX academy_events_tutorial_idx ON public.academy_events (tutorial_id, event_type);

GRANT SELECT, INSERT ON public.academy_events TO authenticated;
GRANT ALL ON public.academy_events TO service_role;

ALTER TABLE public.academy_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own academy events"
  ON public.academy_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own academy events"
  ON public.academy_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

-- updated_at triggers (reuse existing helper)
CREATE TRIGGER academy_categories_updated_at
  BEFORE UPDATE ON public.academy_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER academy_tutorials_updated_at
  BEFORE UPDATE ON public.academy_tutorials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER academy_progress_updated_at
  BEFORE UPDATE ON public.academy_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Analytics for admins: aggregate learning metrics without exposing users
CREATE OR REPLACE FUNCTION public.academy_admin_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN NOT public.is_super_admin() THEN '{}'::jsonb ELSE jsonb_build_object(
    'tutorials', (SELECT count(*) FROM public.academy_tutorials WHERE is_archived = false),
    'published', (SELECT count(*) FROM public.academy_tutorials WHERE is_published AND NOT is_archived),
    'views', (SELECT count(*) FROM public.academy_events WHERE event_type = 'view'),
    'completions', (SELECT count(*) FROM public.academy_events WHERE event_type = 'complete'),
    'top', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT tut.title,
               count(*) FILTER (WHERE e.event_type = 'view') AS views,
               count(*) FILTER (WHERE e.event_type = 'complete') AS completions
        FROM public.academy_events e
        JOIN public.academy_tutorials tut ON tut.id = e.tutorial_id
        GROUP BY tut.title
        ORDER BY count(*) FILTER (WHERE e.event_type = 'view') DESC
        LIMIT 10
      ) t
    )
  ) END
$$;