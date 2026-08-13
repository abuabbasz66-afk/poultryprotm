CREATE TABLE IF NOT EXISTS public.weather_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.weather_cache TO service_role;
ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;