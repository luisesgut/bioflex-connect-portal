-- Add is_internal column to po_comments to distinguish customer vs internal comments
ALTER TABLE public.po_comments 
ADD COLUMN is_internal boolean NOT NULL DEFAULT false;

-- Update RLS policies to restrict internal comments to admins only
-- First, drop existing policies
DROP POLICY IF EXISTS "Users can view comments on their orders" ON public.po_comments;
DROP POLICY IF EXISTS "Users can create comments on their orders" ON public.po_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.po_comments;

-- Create new policies that handle internal comments visibility
-- Admins can view all comments, customers can only view non-internal comments
CREATE POLICY "Users can view comments on their orders"
ON public.po_comments
FOR SELECT
TO authenticated
USING (
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') THEN true
    ELSE is_internal = false
  END
);

-- Admins can create any comment, customers can only create non-internal comments
CREATE POLICY "Users can create comments on their orders"
ON public.po_comments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') THEN true
    ELSE is_internal = false
  END
);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
ON public.po_comments
FOR DELETE
TO authenticated
USING (user_id = auth.uid());