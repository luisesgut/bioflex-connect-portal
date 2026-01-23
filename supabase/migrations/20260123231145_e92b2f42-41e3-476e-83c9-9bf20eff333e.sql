-- Create enum for product request status
CREATE TYPE public.product_request_status AS ENUM (
  'draft',
  'specs_submitted',
  'artwork_uploaded',
  'pc_in_review',
  'pc_approved',
  'bionet_pending',
  'bionet_registered',
  'sap_pending',
  'sap_registered',
  'completed'
);

-- Create enum for PC version status
CREATE TYPE public.pc_version_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'superseded'
);

-- Main table for product requests
CREATE TABLE public.product_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status product_request_status NOT NULL DEFAULT 'draft',
  
  -- Product specifications
  product_name TEXT NOT NULL,
  customer TEXT,
  item_description TEXT,
  item_type TEXT,
  
  -- Bag dimensions
  ancho NUMERIC,
  alto NUMERIC,
  fuelle_de_fondo NUMERIC,
  pestana_al_ancho NUMERIC,
  pestana_al_alto NUMERIC,
  
  -- Material & packaging
  material TEXT,
  estructura TEXT,
  tipo_empaque TEXT,
  tipo_embalaje TEXT,
  
  -- Packaging details
  piezas_por_paquete INTEGER,
  paquete_por_caja INTEGER,
  pieces_per_pallet INTEGER,
  
  -- Artwork files (URLs stored in storage)
  artwork_files TEXT[] DEFAULT '{}',
  
  -- Internal registration (admin only)
  bionet_code TEXT,
  bionet_registered_at TIMESTAMPTZ,
  bionet_registered_by UUID REFERENCES auth.users(id),
  sap_code TEXT,
  sap_registered_at TIMESTAMPTZ,
  sap_registered_by UUID REFERENCES auth.users(id),
  
  -- Final product reference
  product_id UUID REFERENCES products(id),
  
  notes TEXT
);

-- PC versions table
CREATE TABLE public.pc_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_request_id UUID NOT NULL REFERENCES product_requests(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status pc_version_status NOT NULL DEFAULT 'pending',
  
  -- Approval/rejection details
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_comments TEXT,
  
  -- Customer feedback
  customer_feedback TEXT,
  
  UNIQUE(product_request_id, version_number)
);

-- Enable RLS
ALTER TABLE public.product_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pc_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_requests
CREATE POLICY "Users can view their own requests"
ON public.product_requests FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Admins can view all requests"
ON public.product_requests FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create requests"
ON public.product_requests FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can create requests"
ON public.product_requests FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all requests"
ON public.product_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own draft requests"
ON public.product_requests FOR UPDATE
USING (auth.uid() = created_by AND status IN ('draft', 'specs_submitted', 'artwork_uploaded'));

CREATE POLICY "Admins can delete requests"
ON public.product_requests FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for pc_versions
CREATE POLICY "Users can view PC versions for their requests"
ON public.pc_versions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM product_requests pr
  WHERE pr.id = pc_versions.product_request_id
  AND pr.created_by = auth.uid()
));

CREATE POLICY "Admins can view all PC versions"
ON public.pc_versions FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert PC versions"
ON public.pc_versions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update PC versions"
ON public.pc_versions FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can update PC versions for feedback"
ON public.pc_versions FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM product_requests pr
  WHERE pr.id = pc_versions.product_request_id
  AND pr.created_by = auth.uid()
));

-- Triggers for updated_at
CREATE TRIGGER update_product_requests_updated_at
BEFORE UPDATE ON public.product_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for product request files
INSERT INTO storage.buckets (id, name, public) VALUES ('product-request-files', 'product-request-files', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-request-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view files"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-request-files' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can delete files"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-request-files' AND has_role(auth.uid(), 'admin'));