ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS bag_weight_kg numeric NOT NULL DEFAULT 25
    CHECK (bag_weight_kg > 0);