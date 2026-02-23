
CREATE TABLE public.sap_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_code text,
  description text,
  stock numeric,
  unit text,
  gross_weight numeric,
  net_weight numeric,
  traceability text,
  bfx_order text,
  pieces numeric,
  pallet_type text DEFAULT 'CASES',
  status text DEFAULT 'available',
  fecha date,
  raw_data jsonb,
  synced_at timestamptz DEFAULT now()
);

ALTER TABLE public.sap_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sap inventory"
  ON public.sap_inventory FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage sap inventory"
  ON public.sap_inventory FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
