ALTER TABLE public.rfq_items
  ADD COLUMN IF NOT EXISTS rolls_per_floor integer,
  ADD COLUMN IF NOT EXISTS floors_per_pallet integer;