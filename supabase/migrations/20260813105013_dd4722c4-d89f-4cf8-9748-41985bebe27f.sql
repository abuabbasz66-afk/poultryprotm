ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS geocoded_place text,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;