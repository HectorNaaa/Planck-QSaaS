-- Add organization field to profiles table

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS organization TEXT;

-- Update the trigger function to include organization from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    name,
    country,
    country_code,
    phone_number,
    occupation,
    organization,
    email_verified,
    phone_verified
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', INITCAP(SPLIT_PART(new.email, '@', 1))),
    COALESCE(new.raw_user_meta_data->>'country', NULL),
    COALESCE(new.raw_user_meta_data->>'country_code', NULL),
    COALESCE(new.raw_user_meta_data->>'phone_number', NULL),
    COALESCE(new.raw_user_meta_data->>'occupation', NULL),
    COALESCE(new.raw_user_meta_data->>'organization', NULL),
    false,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    country = COALESCE(EXCLUDED.country, public.profiles.country),
    country_code = COALESCE(EXCLUDED.country_code, public.profiles.country_code),
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
    occupation = COALESCE(EXCLUDED.occupation, public.profiles.occupation),
    organization = COALESCE(EXCLUDED.organization, public.profiles.organization);

  RETURN new;
END;
$$;
