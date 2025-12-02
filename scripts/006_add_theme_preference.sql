-- Add theme_preference column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'light';

-- Update the trigger function to include theme_preference
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, country, phone, occupation, organization, theme_preference)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', ''),
    COALESCE(new.raw_user_meta_data->>'country', ''),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    COALESCE(new.raw_user_meta_data->>'occupation', ''),
    COALESCE(new.raw_user_meta_data->>'organization', ''),
    'light'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
