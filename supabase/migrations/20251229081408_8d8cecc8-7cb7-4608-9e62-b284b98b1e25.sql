-- Add new status values to load_status enum
ALTER TYPE public.load_status ADD VALUE IF NOT EXISTS 'in_transit';
ALTER TYPE public.load_status ADD VALUE IF NOT EXISTS 'delivered';

-- Add delivery_date column to load_pallets for tracking per-pallet delivery dates
ALTER TABLE public.load_pallets ADD COLUMN IF NOT EXISTS delivery_date date;