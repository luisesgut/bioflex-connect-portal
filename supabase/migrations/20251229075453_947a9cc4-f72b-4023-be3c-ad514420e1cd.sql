-- Allow customers (requesters) to update pallet release decisions for their own loads
-- load_pallets has no user_id, so we scope via release_requests.requested_by

ALTER TABLE public.load_pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_pallets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- load_pallets: customers can update pallets belonging to their own release request (pending only)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'load_pallets' AND policyname = 'Customers can update their load pallets'
  ) THEN
    CREATE POLICY "Customers can update their load pallets"
    ON public.load_pallets
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1
        FROM public.release_requests rr
        WHERE rr.load_id = load_pallets.load_id
          AND rr.requested_by = auth.uid()
          AND rr.status = 'pending'::public.release_status
      )
    );
  END IF;

  -- inventory_pallets: customers can update inventory pallet release_date for pallets included in their own release request (pending only)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'inventory_pallets' AND policyname = 'Customers can update release date for their pallets'
  ) THEN
    CREATE POLICY "Customers can update release date for their pallets"
    ON public.inventory_pallets
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1
        FROM public.load_pallets lp
        JOIN public.release_requests rr ON rr.load_id = lp.load_id
        WHERE lp.pallet_id = inventory_pallets.id
          AND rr.requested_by = auth.uid()
          AND rr.status = 'pending'::public.release_status
      )
    );
  END IF;
END $$;