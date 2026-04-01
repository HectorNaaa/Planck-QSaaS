-- ============================================================
-- SCRIPT DE DIAGNÓSTICO PARA SUPABASE AUTH
-- Ejecuta esto en tu SQL Editor de Supabase
-- ============================================================

-- 1. Ver cuántos usuarios existen en auth.users
SELECT COUNT(*) as total_auth_users FROM auth.users;

-- 2. Ver los primeros 5 usuarios (sin mostrar password)
SELECT id, email, email_confirmed_at, created_at, last_sign_in_at
FROM auth.users
LIMIT 5;

-- 3. Ver la tabla profiles y contar rows
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- 4. Ver los primeros 5 registros de profiles
SELECT id, email, first_name, last_name, created_at
FROM public.profiles
LIMIT 5;

-- 5. Verificar RLS policies en la tabla profiles
SELECT 
  schemata.schema_name,
  tables.table_name,
  policies.policy_name,
  policies.permissive,
  policies.roles,
  policies.qual,
  policies.with_check
FROM pg_catalog.pg_namespace schemata
JOIN pg_catalog.pg_class tables ON schemata.oid = tables.relnamespace
JOIN pg_catalog.pg_policy policies ON tables.oid = policies.relid
WHERE schemata.schema_name = 'public' 
  AND tables.relname = 'profiles'
ORDER BY policies.policy_name;

-- 6. Ver si RLS está habilitado en la tabla profiles
SELECT 
  relname,
  relrowsecurity,
  relforcerowsecurity
FROM pg_catalog.pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname = 'profiles';

-- 7. Contar en auth.identities
SELECT COUNT(*) as total_identities FROM auth.identities;

-- 8. Ver métodos auth habilitados
SELECT * FROM auth.identities LIMIT 5;

-- ============================================================
-- NOTAS:
-- - Si hay 0 usuarios en auth.users, no existe ningún usuario registrado
-- - Si RLS está habilitado pero no hay políticas, eso causa el error
-- - La email auth debe estar habilitada en Authentication → Providers
-- ============================================================
