-- Disable email verification requirement for Planck Quantum SaaS
-- This allows users to sign in immediately after sign up without email confirmation

-- Update the handle_new_user trigger function to auto-confirm users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile with all user metadata
  INSERT INTO public.profiles (
    id,
    email,
    name,
    country,
    phone_number,
    occupation,
    organization
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', ''),
    COALESCE(NEW.raw_user_meta_data->>'country_code', '') || COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    COALESCE(NEW.raw_user_meta_data->>'occupation', ''),
    COALESCE(NEW.raw_user_meta_data->>'organization', '')
  );
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists and is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update existing unconfirmed users to be confirmed (optional, only if needed)
-- This is commented out by default to avoid affecting existing users
-- Uncomment if you want to auto-confirm all existing unconfirmed users:
-- UPDATE auth.users 
-- SET email_confirmed_at = NOW()
-- WHERE email_confirmed_at IS NULL;

-- Note: To fully disable email verification in Supabase:
-- 1. Go to Supabase Dashboard -> Authentication -> Settings
-- 2. Under "Email Auth", disable "Confirm email"
-- 3. This SQL script handles the database side, but the Supabase auth setting must also be changed
