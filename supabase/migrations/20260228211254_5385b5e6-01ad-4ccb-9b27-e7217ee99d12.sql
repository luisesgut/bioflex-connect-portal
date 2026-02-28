
-- Allow billing team to delete billing validations (for undo feature)
CREATE POLICY "Billing team can delete validations"
ON public.load_billing_validations
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM team_members
  WHERE team_members.user_id = auth.uid()
    AND team_members.team_role = 'billing'
    AND team_members.is_active = true
));
