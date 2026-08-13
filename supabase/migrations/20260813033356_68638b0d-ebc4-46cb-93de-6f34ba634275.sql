ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS age_status text NOT NULL DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS age_anchor_date date,
  ADD COLUMN IF NOT EXISTS age_recorded_at timestamptz;

-- Flocks that already have a stocking date: age is known and continues from that date.
UPDATE public.rooms
SET age_anchor_date = date_stocked,
    age_status = 'recorded'
WHERE date_stocked IS NOT NULL AND age_anchor_date IS NULL;

-- Flocks with a recorded age but no stocking date: anchor the known age to the
-- day the record was created so the age keeps counting forward. Nothing else changes.
UPDATE public.rooms
SET age_anchor_date = (created_at AT TIME ZONE 'UTC')::date - (age_weeks * 7),
    age_status = 'estimated'
WHERE age_anchor_date IS NULL AND age_weeks IS NOT NULL;

-- Everything else is explicitly incomplete; no age is assumed.
UPDATE public.rooms
SET age_status = 'missing'
WHERE age_anchor_date IS NULL;