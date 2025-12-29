-- Add transit tracking fields to shipping_loads table
ALTER TABLE public.shipping_loads 
ADD COLUMN IF NOT EXISTS eta_cross_border date,
ADD COLUMN IF NOT EXISTS documents_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS border_crossed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_reported_city text,
ADD COLUMN IF NOT EXISTS transit_notes text;

-- Create transit_updates table for update history
CREATE TABLE public.transit_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid NOT NULL REFERENCES public.shipping_loads(id) ON DELETE CASCADE,
  updated_by uuid NOT NULL,
  eta_cross_border date,
  last_reported_city text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on transit_updates
ALTER TABLE public.transit_updates ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX idx_transit_updates_load_id ON public.transit_updates(load_id);
CREATE INDEX idx_transit_updates_created_at ON public.transit_updates(created_at DESC);

-- RLS Policies for transit_updates
-- Authenticated users can view all transit updates
CREATE POLICY "Authenticated users can view transit updates"
ON public.transit_updates
FOR SELECT
USING (true);

-- Admins can insert transit updates
CREATE POLICY "Admins can insert transit updates"
ON public.transit_updates
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update transit updates
CREATE POLICY "Admins can update transit updates"
ON public.transit_updates
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete transit updates
CREATE POLICY "Admins can delete transit updates"
ON public.transit_updates
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for transit_updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.transit_updates;