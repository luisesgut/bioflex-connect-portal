-- Create shipped_pallets table to permanently track shipped products
CREATE TABLE public.shipped_pallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_pallet_id UUID,
  load_pallet_id UUID,
  load_id UUID NOT NULL,
  pt_code TEXT NOT NULL,
  description TEXT NOT NULL,
  customer_lot TEXT,
  bfx_order TEXT,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'MIL',
  traceability TEXT,
  fecha DATE,
  destination TEXT,
  shipped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivery_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shipped_pallets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view shipped pallets"
ON public.shipped_pallets
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert shipped pallets"
ON public.shipped_pallets
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update shipped pallets"
ON public.shipped_pallets
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete shipped pallets"
ON public.shipped_pallets
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster PO lookups
CREATE INDEX idx_shipped_pallets_customer_lot ON public.shipped_pallets(customer_lot);
CREATE INDEX idx_shipped_pallets_load_id ON public.shipped_pallets(load_id);