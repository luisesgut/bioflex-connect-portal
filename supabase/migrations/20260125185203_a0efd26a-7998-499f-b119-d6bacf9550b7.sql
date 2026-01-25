-- Create enum for product types/categories
CREATE TYPE public.product_line AS ENUM (
  'bag_no_wicket_zipper',
  'bag_wicket', 
  'bag_zipper',
  'film',
  'pouch'
);

-- Create enum for engineering review status
CREATE TYPE public.engineering_review_status AS ENUM (
  'pending',
  'approved',
  'changes_required',
  'customer_review'
);

-- Create enum for thickness unit
CREATE TYPE public.thickness_unit AS ENUM (
  'gauge',
  'microns'
);

-- Add new columns to product_requests table
ALTER TABLE public.product_requests
ADD COLUMN product_line product_line DEFAULT NULL,
ADD COLUMN tech_spec_pdf_url TEXT DEFAULT NULL,
ADD COLUMN tech_spec_filename TEXT DEFAULT NULL,

-- Original measurements from client (in inches)
ADD COLUMN width_inches NUMERIC DEFAULT NULL,
ADD COLUMN length_inches NUMERIC DEFAULT NULL,
ADD COLUMN gusset_inches NUMERIC DEFAULT NULL,
ADD COLUMN zipper_inches NUMERIC DEFAULT NULL,
ADD COLUMN lip_front_inches NUMERIC DEFAULT NULL,
ADD COLUMN lip_back_inches NUMERIC DEFAULT NULL,
ADD COLUMN flip_size_inches NUMERIC DEFAULT NULL,

-- Thickness can be in gauge or microns
ADD COLUMN thickness_value NUMERIC DEFAULT NULL,
ADD COLUMN thickness_unit thickness_unit DEFAULT 'gauge',

-- Converted measurements (in cm) - system managed
ADD COLUMN width_cm NUMERIC DEFAULT NULL,
ADD COLUMN length_cm NUMERIC DEFAULT NULL,
ADD COLUMN gusset_cm NUMERIC DEFAULT NULL,
ADD COLUMN zipper_cm NUMERIC DEFAULT NULL,
ADD COLUMN lip_front_cm NUMERIC DEFAULT NULL,
ADD COLUMN lip_back_cm NUMERIC DEFAULT NULL,
ADD COLUMN flip_size_cm NUMERIC DEFAULT NULL,

-- Film specifications
ADD COLUMN film_type TEXT DEFAULT NULL,
ADD COLUMN seal_type TEXT DEFAULT NULL,
ADD COLUMN extrusion_type TEXT DEFAULT NULL,
ADD COLUMN clarity_grade TEXT DEFAULT NULL,

-- Vent specifications
ADD COLUMN vents_count INTEGER DEFAULT NULL,
ADD COLUMN vent_size TEXT DEFAULT NULL,
ADD COLUMN vents_across INTEGER DEFAULT NULL,
ADD COLUMN vents_down INTEGER DEFAULT NULL,

-- Wicket specifications
ADD COLUMN wicket_size TEXT DEFAULT NULL,
ADD COLUMN wicket_hole TEXT DEFAULT NULL,
ADD COLUMN bags_per_wicket INTEGER DEFAULT NULL,

-- Packaging info
ADD COLUMN bags_per_case INTEGER DEFAULT NULL,
ADD COLUMN cases_per_pallet INTEGER DEFAULT NULL,
ADD COLUMN pallet_size TEXT DEFAULT NULL,
ADD COLUMN box_color TEXT DEFAULT NULL,

-- Print specifications
ADD COLUMN pms_colors TEXT[] DEFAULT '{}',
ADD COLUMN eye_mark TEXT DEFAULT NULL,
ADD COLUMN upc_number TEXT DEFAULT NULL,
ADD COLUMN language TEXT DEFAULT NULL,
ADD COLUMN country_of_origin TEXT DEFAULT NULL,

-- Additional extracted fields
ADD COLUMN item_id_code TEXT DEFAULT NULL,
ADD COLUMN customer_item_code TEXT DEFAULT NULL,

-- Engineering review fields
ADD COLUMN engineering_status engineering_review_status DEFAULT 'pending',
ADD COLUMN engineering_reviewed_by UUID DEFAULT NULL,
ADD COLUMN engineering_reviewed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN engineering_notes TEXT DEFAULT NULL;

-- Create table for engineering measurement proposals (alternatives)
CREATE TABLE public.engineering_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_request_id UUID NOT NULL REFERENCES public.product_requests(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  proposed_by UUID NOT NULL,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Proposed measurements in cm
  width_cm NUMERIC DEFAULT NULL,
  length_cm NUMERIC DEFAULT NULL,
  gusset_cm NUMERIC DEFAULT NULL,
  zipper_cm NUMERIC DEFAULT NULL,
  lip_front_cm NUMERIC DEFAULT NULL,
  lip_back_cm NUMERIC DEFAULT NULL,
  flip_size_cm NUMERIC DEFAULT NULL,
  
  -- Proposed thickness
  thickness_value NUMERIC DEFAULT NULL,
  thickness_unit thickness_unit DEFAULT 'microns',
  
  -- Reason for changes
  reason TEXT NOT NULL,
  
  -- Customer response
  customer_approved BOOLEAN DEFAULT NULL,
  customer_response_at TIMESTAMPTZ DEFAULT NULL,
  customer_feedback TEXT DEFAULT NULL,
  
  -- Status tracking
  is_active BOOLEAN DEFAULT TRUE
);

-- Enable RLS on engineering_proposals
ALTER TABLE public.engineering_proposals ENABLE ROW LEVEL SECURITY;

-- RLS policies for engineering_proposals
CREATE POLICY "Admins can manage engineering proposals"
ON public.engineering_proposals
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view proposals for their requests"
ON public.engineering_proposals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM product_requests pr 
    WHERE pr.id = engineering_proposals.product_request_id 
    AND pr.created_by = auth.uid()
  )
);

CREATE POLICY "Users can respond to proposals for their requests"
ON public.engineering_proposals
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM product_requests pr 
    WHERE pr.id = engineering_proposals.product_request_id 
    AND pr.created_by = auth.uid()
  )
);

-- Add index for faster lookups
CREATE INDEX idx_engineering_proposals_request_id ON public.engineering_proposals(product_request_id);

-- Add trigger to auto-increment version number
CREATE OR REPLACE FUNCTION public.set_proposal_version_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version_number := COALESCE(
    (SELECT MAX(version_number) + 1 
     FROM public.engineering_proposals 
     WHERE product_request_id = NEW.product_request_id),
    1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_proposal_version
BEFORE INSERT ON public.engineering_proposals
FOR EACH ROW
EXECUTE FUNCTION public.set_proposal_version_number();