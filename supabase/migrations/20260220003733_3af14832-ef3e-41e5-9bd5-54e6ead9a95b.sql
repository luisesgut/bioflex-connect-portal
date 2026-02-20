
-- Table for weekly production capacity per item_type
CREATE TABLE public.production_capacity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_type TEXT NOT NULL UNIQUE,
  weekly_capacity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.production_capacity ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view
CREATE POLICY "Authenticated users can view production capacity"
  ON public.production_capacity FOR SELECT
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins can insert production capacity"
  ON public.production_capacity FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update production capacity"
  ON public.production_capacity FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete production capacity"
  ON public.production_capacity FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_production_capacity_updated_at
  BEFORE UPDATE ON public.production_capacity
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
