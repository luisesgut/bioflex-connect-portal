
CREATE POLICY "Internal users with edit permission can insert load pallets"
ON public.load_pallets
FOR INSERT
TO authenticated
WITH CHECK (
  is_internal_user(auth.uid()) AND (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN profile_permissions pp ON pp.profile_id = p.access_profile_id
      WHERE p.user_id = auth.uid()
        AND pp.module = 'shipping_loads'
        AND pp.can_edit = true
    )
  )
);

CREATE POLICY "Internal users with edit permission can update load pallets"
ON public.load_pallets
FOR UPDATE
TO authenticated
USING (
  is_internal_user(auth.uid()) AND (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN profile_permissions pp ON pp.profile_id = p.access_profile_id
      WHERE p.user_id = auth.uid()
        AND pp.module = 'shipping_loads'
        AND pp.can_edit = true
    )
  )
);

CREATE POLICY "Internal users with edit permission can delete load pallets"
ON public.load_pallets
FOR DELETE
TO authenticated
USING (
  is_internal_user(auth.uid()) AND (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN profile_permissions pp ON pp.profile_id = p.access_profile_id
      WHERE p.user_id = auth.uid()
        AND pp.module = 'shipping_loads'
        AND pp.can_edit = true
    )
  )
);
