-- Add release_date column to inventory_pallets for hold scheduling
ALTER TABLE public.inventory_pallets 
ADD COLUMN release_date date;