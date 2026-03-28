-- Update profiles table to include name, org, phone fields for settings page

-- Add name, org, phone fields if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS org TEXT,
ADD COLUMN IF NOT EXISTS country_code TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Update existing profiles to populate name from email
UPDATE public.profiles
SET name = COALESCE(
  name, 
  INITCAP(SPLIT_PART(email, '@', 1))
)
WHERE name IS NULL AND email IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- Ensure RLS policies are still in place
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Recreate policies if needed (idempotent)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- Update the trigger function to include new fields from user metadata
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
    false,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    country = COALESCE(EXCLUDED.country, public.profiles.country),
    country_code = COALESCE(EXCLUDED.country_code, public.profiles.country_code),
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
    occupation = COALESCE(EXCLUDED.occupation, public.profiles.occupation);

  RETURN new;
END;
$$;
