-- Create table to track PO status changes
CREATE TABLE public.po_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.po_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage status history" 
ON public.po_status_history 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view status history for their orders" 
ON public.po_status_history 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders 
    WHERE purchase_orders.id = po_status_history.purchase_order_id 
    AND purchase_orders.user_id = auth.uid()
  )
);

-- Create trigger function to auto-log status changes
CREATE OR REPLACE FUNCTION public.log_po_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.po_status_history (purchase_order_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_po_status_change
  AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_po_status_change();