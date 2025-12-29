-- Add do_not_delay column to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN do_not_delay boolean NOT NULL DEFAULT false;