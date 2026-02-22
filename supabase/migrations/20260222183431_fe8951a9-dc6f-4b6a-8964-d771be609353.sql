
-- Create a function to update invitation_status when user confirms email
CREATE OR REPLACE FUNCTION public.update_profile_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When email_confirmed_at changes from NULL to a value, mark as verified
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
    SET invitation_status = 'verified'
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users (this is allowed via security definer function)
CREATE TRIGGER on_user_verified
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_verification();
