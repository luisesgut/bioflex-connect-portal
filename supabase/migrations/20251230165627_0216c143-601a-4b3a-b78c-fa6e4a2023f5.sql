-- Allow admins to delete any purchase order
CREATE POLICY "Admins can delete all orders"
ON public.purchase_orders
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));