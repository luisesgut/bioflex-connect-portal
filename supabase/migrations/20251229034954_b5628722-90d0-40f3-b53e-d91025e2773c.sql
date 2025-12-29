-- Add acceptance tracking fields to purchase_orders
ALTER TABLE public.purchase_orders 
ADD COLUMN sales_order_number TEXT,
ADD COLUMN accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN accepted_by UUID,
ADD COLUMN estimated_delivery_date DATE;

-- Create index for faster lookup by status
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);

-- Update RLS policies to allow admins to update orders
CREATE POLICY "Admins can update all orders" 
ON public.purchase_orders 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));