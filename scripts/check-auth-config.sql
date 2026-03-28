-- Check auth configuration and user status
-- This is a diagnostic query to understand the current state

-- List recent users and their confirmation status
SELECT 
  id,
  email,
  email_confirmed_at,
  phone_confirmed_at,
  created_at,
  last_sign_in_at,
  raw_user_meta_data->>'name' as name
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;
