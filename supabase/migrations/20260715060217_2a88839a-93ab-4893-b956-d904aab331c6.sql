
ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Nigeria',
  ADD COLUMN IF NOT EXISTS farm_type text,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS bird_count integer;

-- Preserve and rename the existing ABZ farm (identified by the record-rich farm_id)
UPDATE public.farms
   SET name = 'ABZ GLOBAL RESOURCE',
       state = COALESCE(state, 'Katsina State'),
       country = COALESCE(country, 'Nigeria')
 WHERE id = '88cbfb05-38d1-4451-9b2d-1e0407eacf52';

-- Replace the new-user trigger so future signups get a blank slate; onboarding creates the farm.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;
