-- Create a table for configurable dropdown options
CREATE TABLE public.dropdown_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL, -- 'final_customer', 'item_type', 'tipo_empaque'
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate labels per category
CREATE UNIQUE INDEX idx_dropdown_options_unique ON public.dropdown_options (category, label);

-- Index for fast lookups
CREATE INDEX idx_dropdown_options_category ON public.dropdown_options (category, is_active, sort_order);

-- Enable RLS
ALTER TABLE public.dropdown_options ENABLE ROW LEVEL SECURITY;

-- Everyone can view options
CREATE POLICY "Authenticated users can view dropdown options"
ON public.dropdown_options FOR SELECT
USING (true);

-- Only admins can manage
CREATE POLICY "Admins can insert dropdown options"
ON public.dropdown_options FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update dropdown options"
ON public.dropdown_options FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete dropdown options"
ON public.dropdown_options FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_dropdown_options_updated_at
BEFORE UPDATE ON public.dropdown_options
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();