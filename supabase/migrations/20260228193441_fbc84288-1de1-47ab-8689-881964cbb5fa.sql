
-- Add 'billing' role to team_role enum
ALTER TYPE public.team_role ADD VALUE IF NOT EXISTS 'billing';
