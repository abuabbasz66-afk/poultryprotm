ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS bird_type text,
  ADD COLUMN IF NOT EXISTS rooms_count integer;