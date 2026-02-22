
-- Create table to track ETA and actual delivery dates per destination per load
CREATE TABLE public.load_destination_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  load_id UUID NOT NULL REFERENCES public.shipping_loads(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  estimated_date DATE,
  actual_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(load_id, destination)
);

-- Enable RLS
ALTER TABLE public.load_destination_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view load destination dates"
ON public.load_destination_dates FOR SELECT USING (true);

CREATE POLICY "Admins can manage load destination dates"
ON public.load_destination_dates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Also add cross_border_actual_date to shipping_loads for tracking actual border crossing date
ALTER TABLE public.shipping_loads ADD COLUMN cross_border_actual_date DATE;
