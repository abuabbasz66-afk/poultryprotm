ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS bird_type text,
  ADD COLUMN IF NOT EXISTS breed text,
  ADD COLUMN IF NOT EXISTS age_weeks integer,
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS date_stocked date,
  ADD COLUMN IF NOT EXISTS culled_on date,
  ADD COLUMN IF NOT EXISTS culled_birds_sold integer,
  ADD COLUMN IF NOT EXISTS culled_unit_price numeric,
  ADD COLUMN IF NOT EXISTS culled_revenue numeric,
  ADD COLUMN IF NOT EXISTS culled_notes text;

ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_status_check
  CHECK (status IN ('active','culled','inactive','preparing','cleaning'));

UPDATE public.rooms
   SET status = 'culled', culled_on = COALESCE(culled_on, CURRENT_DATE), current = 0
 WHERE farm_id = '88cbfb05-38d1-4451-9b2d-1e0407eacf52'
   AND name = 'ROOM 1';