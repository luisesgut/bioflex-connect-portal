
-- Allow internal users with shipping_loads edit permission to manage loads
CREATE POLICY "Internal users with edit permission can insert loads"
ON public.shipping_loads
FOR INSERT
TO authenticated
WITH CHECK (
  is_internal_user(auth.uid()) AND
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN profile_permissions pp ON pp.profile_id = p.access_profile_id
    WHERE p.user_id = auth.uid()
      AND pp.module = 'shipping_loads'
      AND pp.can_edit = true
  )
);

CREATE POLICY "Internal users with edit permission can update loads"
ON public.shipping_loads
FOR UPDATE
TO authenticated
USING (
  is_internal_user(auth.uid()) AND
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN profile_permissions pp ON pp.profile_id = p.access_profile_id
    WHERE p.user_id = auth.uid()
      AND pp.module = 'shipping_loads'
      AND pp.can_edit = true
  )
);
