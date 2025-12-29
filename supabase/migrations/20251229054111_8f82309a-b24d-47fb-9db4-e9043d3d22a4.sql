-- Create customer locations enum
CREATE TYPE public.customer_location AS ENUM ('salinas', 'bakersfield', 'coachella', 'yuma');

-- Create inventory status enum
CREATE TYPE public.inventory_status AS ENUM ('available', 'assigned', 'shipped');

-- Create release request status enum
CREATE TYPE public.release_status AS ENUM ('pending', 'approved', 'on_hold', 'shipped');

-- Create load status enum
CREATE TYPE public.load_status AS ENUM ('assembling', 'pending_release', 'approved', 'on_hold', 'shipped');

-- Inventory pallets table (daily inventory uploads)
CREATE TABLE public.inventory_pallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  pt_code TEXT NOT NULL,
  description TEXT NOT NULL,
  stock NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'MIL',
  gross_weight NUMERIC,
  net_weight NUMERIC,
  traceability TEXT NOT NULL,
  bfx_order TEXT,
  customer_lot TEXT,
  pieces INTEGER,
  pallet_type TEXT DEFAULT 'CASES',
  status public.inventory_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Shipping loads table
CREATE TABLE public.shipping_loads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  load_number TEXT NOT NULL UNIQUE,
  shipping_date DATE NOT NULL,
  status public.load_status NOT NULL DEFAULT 'assembling',
  total_pallets INTEGER NOT NULL DEFAULT 0,
  release_number TEXT,
  release_pdf_url TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Load pallets junction table (links pallets to loads with destination)
CREATE TABLE public.load_pallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  load_id UUID NOT NULL REFERENCES public.shipping_loads(id) ON DELETE CASCADE,
  pallet_id UUID NOT NULL REFERENCES public.inventory_pallets(id) ON DELETE CASCADE,
  destination public.customer_location,
  quantity NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(load_id, pallet_id)
);

-- Release requests table
CREATE TABLE public.release_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  load_id UUID NOT NULL REFERENCES public.shipping_loads(id) ON DELETE CASCADE,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  requested_by UUID NOT NULL,
  status public.release_status NOT NULL DEFAULT 'pending',
  response_at TIMESTAMP WITH TIME ZONE,
  responded_by UUID,
  release_number TEXT,
  release_pdf_url TEXT,
  customer_notes TEXT,
  admin_notes TEXT,
  is_hot_order BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Customer locations reference table (for destinations with addresses)
CREATE TABLE public.customer_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code public.customer_location NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default customer locations
INSERT INTO public.customer_locations (name, code, city, state) VALUES
  ('Salinas', 'salinas', 'Salinas', 'CA'),
  ('Bakersfield', 'bakersfield', 'Bakersfield', 'CA'),
  ('Coachella', 'coachella', 'Coachella', 'CA'),
  ('Yuma', 'yuma', 'Yuma', 'AZ');

-- Enable RLS on all tables
ALTER TABLE public.inventory_pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.load_pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_pallets
CREATE POLICY "Authenticated users can view inventory" 
  ON public.inventory_pallets FOR SELECT 
  USING (true);

CREATE POLICY "Admins can insert inventory" 
  ON public.inventory_pallets FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update inventory" 
  ON public.inventory_pallets FOR UPDATE 
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete inventory" 
  ON public.inventory_pallets FOR DELETE 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for shipping_loads
CREATE POLICY "Authenticated users can view loads" 
  ON public.shipping_loads FOR SELECT 
  USING (true);

CREATE POLICY "Admins can insert loads" 
  ON public.shipping_loads FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update loads" 
  ON public.shipping_loads FOR UPDATE 
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete loads" 
  ON public.shipping_loads FOR DELETE 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for load_pallets
CREATE POLICY "Authenticated users can view load pallets" 
  ON public.load_pallets FOR SELECT 
  USING (true);

CREATE POLICY "Admins can manage load pallets" 
  ON public.load_pallets FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for release_requests
CREATE POLICY "Authenticated users can view release requests" 
  ON public.release_requests FOR SELECT 
  USING (true);

CREATE POLICY "Admins can insert release requests" 
  ON public.release_requests FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins and customers can update release requests" 
  ON public.release_requests FOR UPDATE 
  USING (true);

-- RLS Policies for customer_locations
CREATE POLICY "Everyone can view customer locations" 
  ON public.customer_locations FOR SELECT 
  USING (true);

CREATE POLICY "Admins can manage customer locations" 
  ON public.customer_locations FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create triggers for updated_at
CREATE TRIGGER update_inventory_pallets_updated_at
  BEFORE UPDATE ON public.inventory_pallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipping_loads_updated_at
  BEFORE UPDATE ON public.shipping_loads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_release_requests_updated_at
  BEFORE UPDATE ON public.release_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for release PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('release-documents', 'release-documents', true);

-- Storage policies for release documents
CREATE POLICY "Anyone can view release documents" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'release-documents');

CREATE POLICY "Authenticated users can upload release documents" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'release-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update release documents" 
  ON storage.objects FOR UPDATE 
  USING (bucket_id = 'release-documents' AND auth.uid() IS NOT NULL);