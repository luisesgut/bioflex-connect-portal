ALTER TABLE public.rfq_items
  ADD COLUMN core_size_inches text,
  ADD COLUMN max_splices_per_roll integer,
  ADD COLUMN weight_kg_per_roll numeric,
  ADD COLUMN core_plug boolean DEFAULT false,
  ADD COLUMN prints_per_roll integer,
  ADD COLUMN meters_per_roll numeric,
  ADD COLUMN diameter_per_roll numeric;