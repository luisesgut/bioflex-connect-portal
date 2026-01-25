-- Create enum for team roles
CREATE TYPE public.team_role AS ENUM (
  'sales_rep',
  'engineering_leader',
  'engineer',
  'design_leader',
  'designer',
  'customer_service'
);

-- Create team_members table to track internal team assignments
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  team_role team_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, team_role)
);

-- Create table for client contacts (approvers and notification recipients)
CREATE TABLE public.product_request_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_request_id UUID REFERENCES public.product_requests(id) ON DELETE CASCADE NOT NULL,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('client_approver', 'internal_notify')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for engineering/design assignments
CREATE TABLE public.product_request_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_request_id UUID REFERENCES public.product_requests(id) ON DELETE CASCADE NOT NULL,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('engineering', 'design')),
  assigned_by UUID REFERENCES auth.users(id) NOT NULL,
  assigned_to UUID REFERENCES auth.users(id) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Add additional fields to product_requests for the enhanced workflow
ALTER TABLE public.product_requests 
ADD COLUMN IF NOT EXISTS assigned_engineer UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS assigned_designer UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS design_status TEXT DEFAULT 'pending' CHECK (design_status IN ('pending', 'in_progress', 'customer_review', 'approved', 'changes_required')),
ADD COLUMN IF NOT EXISTS design_reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS design_reviewed_by UUID REFERENCES auth.users(id);

-- Enable RLS on new tables
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_request_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_request_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for team_members
CREATE POLICY "Admins can manage team members"
  ON public.team_members FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view team members"
  ON public.team_members FOR SELECT
  USING (true);

-- RLS policies for product_request_contacts
CREATE POLICY "Admins can manage contacts"
  ON public.product_request_contacts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view contacts for their requests"
  ON public.product_request_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.product_requests pr
      WHERE pr.id = product_request_contacts.product_request_id
      AND pr.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can add contacts to their requests"
  ON public.product_request_contacts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_requests pr
      WHERE pr.id = product_request_contacts.product_request_id
      AND pr.created_by = auth.uid()
    )
  );

-- RLS policies for product_request_assignments
CREATE POLICY "Admins can manage assignments"
  ON public.product_request_assignments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Assigned users can view their assignments"
  ON public.product_request_assignments FOR SELECT
  USING (assigned_to = auth.uid());

CREATE POLICY "Users can view assignments for their requests"
  ON public.product_request_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.product_requests pr
      WHERE pr.id = product_request_assignments.product_request_id
      AND pr.created_by = auth.uid()
    )
  );

-- Trigger for updated_at on team_members
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();