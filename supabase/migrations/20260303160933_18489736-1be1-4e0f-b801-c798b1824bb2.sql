
CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND user_type = 'internal'
  )
$$;

CREATE POLICY "Internal users can view all orders"
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (public.is_internal_user(auth.uid()));
