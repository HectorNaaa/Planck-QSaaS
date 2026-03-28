-- Add stay_logged_in column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stay_logged_in BOOLEAN DEFAULT true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stay_logged_in ON profiles(stay_logged_in);
