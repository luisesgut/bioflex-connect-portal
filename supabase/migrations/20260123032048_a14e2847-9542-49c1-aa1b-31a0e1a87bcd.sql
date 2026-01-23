-- Add production tracking dates to purchase_orders
ALTER TABLE public.purchase_orders
ADD COLUMN printing_date date,
ADD COLUMN conversion_date date;