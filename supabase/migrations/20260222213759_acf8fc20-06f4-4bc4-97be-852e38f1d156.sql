-- Add column to track who released or put on hold each pallet
ALTER TABLE public.load_pallets ADD COLUMN actioned_by uuid DEFAULT NULL;

-- Add column to track when the action happened
ALTER TABLE public.load_pallets ADD COLUMN actioned_at timestamp with time zone DEFAULT NULL;