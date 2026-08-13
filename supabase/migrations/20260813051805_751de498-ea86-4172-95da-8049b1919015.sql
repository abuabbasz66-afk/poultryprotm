CREATE TABLE public.user_last_location (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pathname text NOT NULL,
  search jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash text,
  farm_id uuid REFERENCES public.farms(id) ON DELETE SET NULL,
  context_kind text,
  context_id text,
  label text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_last_location TO authenticated;
GRANT ALL ON public.user_last_location TO service_role;

ALTER TABLE public.user_last_location ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own last location"
ON public.user_last_location FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users save their own last location"
ON public.user_last_location FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own last location"
ON public.user_last_location FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own last location"
ON public.user_last_location FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER user_last_location_set_updated_at
BEFORE UPDATE ON public.user_last_location
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();