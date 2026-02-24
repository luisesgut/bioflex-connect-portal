-- Add virtual pallet support to inventory_pallets
ALTER TABLE public.inventory_pallets
  ADD COLUMN IF NOT EXISTS is_virtual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_real_pallet_id uuid REFERENCES public.inventory_pallets(id) ON DELETE SET NULL;

-- Index for quick lookup of unlinked virtuals
CREATE INDEX IF NOT EXISTS idx_inventory_pallets_virtual ON public.inventory_pallets (is_virtual) WHERE is_virtual = true;