-- Add release_number and release_pdf_url columns to load_pallets table
-- These allow customers to provide per-pallet release information
ALTER TABLE public.load_pallets 
ADD COLUMN release_number text,
ADD COLUMN release_pdf_url text;