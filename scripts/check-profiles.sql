-- Check if profiles exist for all auth users
SELECT 
  u.id,
  u.email,
  p.id as profile_id,
  p.name as profile_name,
  CASE WHEN p.id IS NULL THEN 'MISSING' ELSE 'OK' END as status
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.created_at DESC
LIMIT 15;
