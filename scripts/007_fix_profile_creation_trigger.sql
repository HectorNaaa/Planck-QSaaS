-- Update the trigger function to handle all user metadata from sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Extract metadata from the user's raw_user_meta_data
  INSERT INTO public.profiles (
    id,
    email,
    name,
    country,
    country_code,
    phone_number,
    occupation,
    organization,
    theme_preference,
    stay_logged_in,
    email_verified,
    phone_verified
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', ''),
    COALESCE(NEW.raw_user_meta_data->>'country_code', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    COALESCE(NEW.raw_user_meta_data->>'occupation', ''),
    COALESCE(NEW.raw_user_meta_data->>'organization', ''),
    'light', -- Default theme
    false, -- Default stay_logged_in
    false, -- Email verification status
    false -- Phone verification status
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, profiles.name),
    country = COALESCE(EXCLUDED.country, profiles.country),
    country_code = COALESCE(EXCLUDED.country_code, profiles.country_code),
    phone_number = COALESCE(EXCLUDED.phone_number, profiles.phone_number),
    occupation = COALESCE(EXCLUDED.occupation, profiles.occupation),
    organization = COALESCE(EXCLUDED.organization, profiles.organization),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
