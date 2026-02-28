
-- Create billing validation table for loads
CREATE TABLE public.load_billing_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid NOT NULL REFERENCES public.shipping_loads(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  reviewer_notes text,
  customs_document_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(load_id)
);

-- Enable RLS
ALTER TABLE public.load_billing_validations ENABLE ROW LEVEL SECURITY;

-- Admins can manage billing validations
CREATE POLICY "Admins can manage billing validations"
ON public.load_billing_validations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Billing team members can view validations
CREATE POLICY "Billing team can view validations"
ON public.load_billing_validations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_members.user_id = auth.uid()
    AND team_members.team_role = 'billing'
    AND team_members.is_active = true
  )
);

-- Billing team members can update validations
CREATE POLICY "Billing team can update validations"
ON public.load_billing_validations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_members.user_id = auth.uid()
    AND team_members.team_role = 'billing'
    AND team_members.is_active = true
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_load_billing_validations_updated_at
BEFORE UPDATE ON public.load_billing_validations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
