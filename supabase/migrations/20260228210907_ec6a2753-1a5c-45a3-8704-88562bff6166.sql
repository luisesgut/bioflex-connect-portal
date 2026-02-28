
-- Add validated_data JSONB column to store the editable customs breakdown
ALTER TABLE public.load_billing_validations
ADD COLUMN validated_data jsonb DEFAULT NULL;

-- Update RLS policy for billing team to also allow INSERT (so they can create validations too)
-- Drop and recreate billing policies as PERMISSIVE instead of RESTRICTIVE
DROP POLICY IF EXISTS "Admins can manage billing validations" ON public.load_billing_validations;
DROP POLICY IF EXISTS "Billing team can update validations" ON public.load_billing_validations;
DROP POLICY IF EXISTS "Billing team can view validations" ON public.load_billing_validations;

-- Recreate as PERMISSIVE
CREATE POLICY "Admins can manage billing validations"
ON public.load_billing_validations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Billing team can view validations"
ON public.load_billing_validations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM team_members
  WHERE team_members.user_id = auth.uid()
    AND team_members.team_role = 'billing'
    AND team_members.is_active = true
));

CREATE POLICY "Billing team can update validations"
ON public.load_billing_validations
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM team_members
  WHERE team_members.user_id = auth.uid()
    AND team_members.team_role = 'billing'
    AND team_members.is_active = true
));
