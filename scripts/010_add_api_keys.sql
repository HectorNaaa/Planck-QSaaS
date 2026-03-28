-- Add API key field to profiles table for SDK authentication
-- Migration: 010_add_api_keys.sql

-- Add api_key column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;

-- Add created_at for api_key if not exists
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS api_key_created_at TIMESTAMPTZ;

-- Add index for faster API key lookups
CREATE INDEX IF NOT EXISTS idx_profiles_api_key ON profiles(api_key);

-- Create function to generate API keys
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
DECLARE
    api_key TEXT;
    key_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a random API key with format: pk_live_[32 random chars]
        api_key := 'pk_live_' || encode(gen_random_bytes(24), 'hex');
        
        -- Check if key already exists
        SELECT EXISTS(SELECT 1 FROM profiles WHERE profiles.api_key = generate_api_key.api_key) INTO key_exists;
        
        -- Exit loop if key is unique
        EXIT WHEN NOT key_exists;
    END LOOP;
    
    RETURN api_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON COLUMN profiles.api_key IS 'API key for programmatic access via SDK';
COMMENT ON COLUMN profiles.api_key_created_at IS 'Timestamp when API key was generated';
COMMENT ON FUNCTION generate_api_key() IS 'Generates a unique API key for a user';

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION generate_api_key() TO authenticated;
