-- Change customer_locations.code from enum to text to allow dynamic destinations
ALTER TABLE public.customer_locations 
  ALTER COLUMN code TYPE text USING code::text;

-- Also change load_pallets.destination from enum to text (already text-compatible)
ALTER TABLE public.load_pallets 
  ALTER COLUMN destination TYPE text USING destination::text;
