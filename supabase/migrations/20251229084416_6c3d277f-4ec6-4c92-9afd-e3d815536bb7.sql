-- Add estimated_delivery_date column to shipping_loads table
ALTER TABLE public.shipping_loads
ADD COLUMN estimated_delivery_date date;