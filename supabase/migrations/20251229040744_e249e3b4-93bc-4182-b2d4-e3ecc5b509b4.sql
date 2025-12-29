-- Create enum for change request type
CREATE TYPE public.change_request_type AS ENUM ('volume_change', 'cancellation');

-- Create enum for change request status
CREATE TYPE public.change_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create change requests table
CREATE TABLE public.order_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  request_type change_request_type NOT NULL,
  current_quantity INTEGER NOT NULL,
  requested_quantity INTEGER,
  reason TEXT NOT NULL,
  status change_request_status NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.order_change_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own change requests
CREATE POLICY "Users can view their own change requests"
ON public.order_change_requests
FOR SELECT
USING (auth.uid() = requested_by);

-- Admins can view all change requests
CREATE POLICY "Admins can view all change requests"
ON public.order_change_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can create change requests for their own orders
CREATE POLICY "Users can create change requests"
ON public.order_change_requests
FOR INSERT
WITH CHECK (
  auth.uid() = requested_by AND
  EXISTS (
    SELECT 1 FROM public.purchase_orders 
    WHERE id = purchase_order_id AND user_id = auth.uid()
  )
);

-- Admins can update change requests (for approval/rejection)
CREATE POLICY "Admins can update change requests"
ON public.order_change_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_order_change_requests_updated_at
BEFORE UPDATE ON public.order_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_order_change_requests_status ON public.order_change_requests(status);
CREATE INDEX idx_order_change_requests_po ON public.order_change_requests(purchase_order_id);