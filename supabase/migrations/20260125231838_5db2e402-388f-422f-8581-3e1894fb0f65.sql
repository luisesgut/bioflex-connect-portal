-- Remove the foreign key constraint on team_members.user_id
-- Team members may not have auth accounts, so we allow any UUID as identifier
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_user_id_fkey;