
-- Create table for PO comments
CREATE TABLE public.po_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.po_comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on their own orders
CREATE POLICY "Users can view comments on their orders"
ON public.po_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE purchase_orders.id = po_comments.purchase_order_id
    AND purchase_orders.user_id = auth.uid()
  )
);

-- Admins can view all comments
CREATE POLICY "Admins can view all comments"
ON public.po_comments
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Users can create comments on their own orders
CREATE POLICY "Users can create comments on their orders"
ON public.po_comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE purchase_orders.id = po_comments.purchase_order_id
    AND purchase_orders.user_id = auth.uid()
  )
);

-- Admins can create comments on any order
CREATE POLICY "Admins can create comments"
ON public.po_comments
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
ON public.po_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_po_comments_updated_at
BEFORE UPDATE ON public.po_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
