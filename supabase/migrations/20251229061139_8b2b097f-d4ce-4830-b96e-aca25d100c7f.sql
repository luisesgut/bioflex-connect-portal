-- Drop the restrictive SELECT policy and recreate as permissive
DROP POLICY IF EXISTS "Authenticated users can view inventory" ON public.inventory_pallets;

CREATE POLICY "Authenticated users can view inventory" 
ON public.inventory_pallets 
FOR SELECT 
TO authenticated
USING (true);