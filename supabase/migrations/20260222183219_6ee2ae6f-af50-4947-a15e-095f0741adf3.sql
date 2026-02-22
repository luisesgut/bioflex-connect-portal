
-- Add invitation_status column to profiles
ALTER TABLE public.profiles 
ADD COLUMN invitation_status text NOT NULL DEFAULT 'created';

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.invitation_status IS 'Tracks user status: created (registered but not invited), invited (invitation sent), verified (email confirmed)';
