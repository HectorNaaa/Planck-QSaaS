-- Clean up API keys and update to v0.9 format
-- Migration: 011_cleanup_api_keys_v09.sql
-- This script removes all existing API keys and prepares for new alphanumeric format

-- Drop existing API keys (users will need to regenerate)
UPDATE profiles
SET 
  api_key = NULL,
  api_key_created_at = NULL
WHERE api_key IS NOT NULL;

-- Drop old function if exists
DROP FUNCTION IF EXISTS generate_api_key();

-- Create new function to generate pure alphanumeric API keys (v0.9 format)
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
DECLARE
    api_key TEXT;
    key_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a random 64-character hexadecimal API key (pure alphanumeric)
        api_key := encode(gen_random_bytes(32), 'hex');
        
        -- Check if key already exists
        SELECT EXISTS(SELECT 1 FROM profiles WHERE profiles.api_key = generate_api_key.api_key) INTO key_exists;
        
        -- Exit loop if key is unique
        EXIT WHEN NOT key_exists;
    END LOOP;
    
    RETURN api_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION generate_api_key() IS 'Generates a unique 64-char alphanumeric API key (v0.9 format)';

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION generate_api_key() TO authenticated;

-- Create type for API key responses (for better debugging)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'api_key_info') THEN
        CREATE TYPE api_key_info AS (
            key TEXT,
            created_at TIMESTAMPTZ,
            format_version TEXT,
            is_valid BOOLEAN
        );
    END IF;
END $$;

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'API Keys cleaned up and updated to v0.9 format (pure alphanumeric)';
    RAISE NOTICE 'All users will need to regenerate their API keys';
    RAISE NOTICE 'New format: 64-character hexadecimal string';
END $$;
