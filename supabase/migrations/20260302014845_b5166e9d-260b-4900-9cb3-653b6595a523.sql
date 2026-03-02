
-- Create enum for product types
CREATE TYPE public.rfq_product_type AS ENUM ('wicket', 'side_seal', 'pouch', 'film');

-- Create enum for RFQ status
CREATE TYPE public.rfq_status AS ENUM ('draft', 'submitted', 'quoting', 'negotiating', 'partially_accepted', 'accepted', 'closed', 'cancelled');

-- Create enum for RFQ item status
CREATE TYPE public.rfq_item_status AS ENUM ('pending', 'quoted', 'negotiating', 'accepted', 'rejected');

-- Create enum for RFQ volume status
CREATE TYPE public.rfq_volume_status AS ENUM ('pending', 'quoted', 'accepted', 'rejected');

-- =====================
-- RFQs (parent)
-- =====================
CREATE TABLE public.rfqs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_number TEXT NOT NULL,
  customer TEXT,
  customer_user_id UUID,
  response_deadline DATE,
  status public.rfq_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  reference_files TEXT[],
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage rfqs"
  ON public.rfqs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can create their own RFQs
CREATE POLICY "Users can create rfqs"
  ON public.rfqs FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Users can view their own RFQs
CREATE POLICY "Users can view their rfqs"
  ON public.rfqs FOR SELECT
  USING (auth.uid() = created_by);

-- Users can update their own draft RFQs
CREATE POLICY "Users can update their draft rfqs"
  ON public.rfqs FOR UPDATE
  USING (auth.uid() = created_by AND status = 'draft');

-- Trigger for updated_at
CREATE TRIGGER update_rfqs_updated_at
  BEFORE UPDATE ON public.rfqs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- RFQ Items
-- =====================
CREATE TABLE public.rfq_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_type public.rfq_product_type NOT NULL,
  status public.rfq_item_status NOT NULL DEFAULT 'pending',
  
  -- Common specs
  width_inches NUMERIC,
  length_inches NUMERIC,
  thickness_value NUMERIC,
  thickness_unit public.thickness_unit DEFAULT 'gauge',
  structure TEXT,
  material TEXT,
  seal_type TEXT,
  
  -- Type-specific specs
  gusset_inches NUMERIC,
  zipper_inches NUMERIC,
  lip_front_inches NUMERIC,
  lip_back_inches NUMERIC,
  flip_size_inches NUMERIC,
  wicket_hole TEXT,
  wicket_size TEXT,
  vent_size TEXT,
  vents_count INTEGER,
  bags_per_wicket INTEGER,
  bags_per_case INTEGER,
  cases_per_pallet INTEGER,
  
  -- Reference
  reference_image_url TEXT,
  reference_files TEXT[],
  item_description TEXT,
  notes TEXT,
  
  -- Link to product_request once accepted
  product_request_id UUID REFERENCES public.product_requests(id),
  
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rfq_items ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage rfq items"
  ON public.rfq_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can manage items on their own RFQs
CREATE POLICY "Users can insert rfq items"
  ON public.rfq_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rfqs WHERE id = rfq_id AND created_by = auth.uid()
  ));

CREATE POLICY "Users can view rfq items"
  ON public.rfq_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rfqs WHERE id = rfq_id AND created_by = auth.uid()
  ));

CREATE POLICY "Users can update rfq items"
  ON public.rfq_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.rfqs WHERE id = rfq_id AND created_by = auth.uid()
  ));

CREATE POLICY "Users can delete rfq items"
  ON public.rfq_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.rfqs WHERE id = rfq_id AND created_by = auth.uid() AND (SELECT status FROM public.rfqs WHERE id = rfq_id) = 'draft'
  ));

CREATE TRIGGER update_rfq_items_updated_at
  BEFORE UPDATE ON public.rfq_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- RFQ Item Volumes
-- =====================
CREATE TABLE public.rfq_item_volumes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_item_id UUID NOT NULL REFERENCES public.rfq_items(id) ON DELETE CASCADE,
  volume_quantity INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'MIL',
  quoted_price NUMERIC,
  target_price NUMERIC,
  final_price NUMERIC,
  status public.rfq_volume_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rfq_item_volumes ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage rfq volumes"
  ON public.rfq_item_volumes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can manage volumes on their own RFQ items
CREATE POLICY "Users can insert rfq volumes"
  ON public.rfq_item_volumes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rfq_items ri 
    JOIN public.rfqs r ON r.id = ri.rfq_id 
    WHERE ri.id = rfq_item_id AND r.created_by = auth.uid()
  ));

CREATE POLICY "Users can view rfq volumes"
  ON public.rfq_item_volumes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rfq_items ri 
    JOIN public.rfqs r ON r.id = ri.rfq_id 
    WHERE ri.id = rfq_item_id AND r.created_by = auth.uid()
  ));

CREATE POLICY "Users can update rfq volumes"
  ON public.rfq_item_volumes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.rfq_items ri 
    JOIN public.rfqs r ON r.id = ri.rfq_id 
    WHERE ri.id = rfq_item_id AND r.created_by = auth.uid()
  ));

CREATE POLICY "Users can delete rfq volumes"
  ON public.rfq_item_volumes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.rfq_items ri 
    JOIN public.rfqs r ON r.id = ri.rfq_id 
    WHERE ri.id = rfq_item_id AND r.created_by = auth.uid()
    AND (SELECT status FROM public.rfqs WHERE id = ri.rfq_id) = 'draft'
  ));

CREATE TRIGGER update_rfq_volumes_updated_at
  BEFORE UPDATE ON public.rfq_item_volumes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for RFQ files
INSERT INTO storage.buckets (id, name, public)
VALUES ('rfq-files', 'rfq-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for rfq-files
CREATE POLICY "Authenticated users can upload rfq files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'rfq-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view rfq files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'rfq-files' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can delete rfq files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'rfq-files' AND has_role(auth.uid(), 'admin'::app_role));
