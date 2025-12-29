-- Add is_on_hold column to load_pallets for per-pallet hold status
ALTER TABLE public.load_pallets 
ADD COLUMN is_on_hold boolean NOT NULL DEFAULT false;