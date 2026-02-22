
-- Drop old FK pointing to dp_contacts
ALTER TABLE public.customer_locations
  DROP CONSTRAINT customer_locations_warehouse_manager_id_fkey;

-- Add new FK pointing to profiles.user_id
ALTER TABLE public.customer_locations
  ADD CONSTRAINT customer_locations_warehouse_manager_id_fkey
  FOREIGN KEY (warehouse_manager_id) REFERENCES public.profiles(user_id);
