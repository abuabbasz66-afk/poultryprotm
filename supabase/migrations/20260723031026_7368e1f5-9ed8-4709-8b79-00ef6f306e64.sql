
UPDATE public.prices
SET unit = '25 kg Bag'
WHERE item ~* 'feed'
  AND (unit IS NULL OR btrim(unit) IN ('', '1', 'Bag', 'bag', '1 Bag', '1 bag'));

UPDATE public.prices
SET unit = 'Crate'
WHERE item ~* 'egg'
  AND (unit IS NULL OR btrim(unit) IN ('', '1', 'Crate', 'crate', '1 Crate', '1 crate'));

ALTER TABLE public.prices ALTER COLUMN unit SET DEFAULT 'Crate';
