
-- Add reception hours and warehouse manager to customer_locations
ALTER TABLE public.customer_locations 
ADD COLUMN reception_hours text,
ADD COLUMN warehouse_manager_id uuid REFERENCES public.dp_contacts(id) ON DELETE SET NULL;

-- Create index for the FK
CREATE INDEX idx_customer_locations_warehouse_manager ON public.customer_locations(warehouse_manager_id);
