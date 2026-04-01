-- ============================================================
-- DIAGNÓSTICO CRÍTICO DE SUPABASE
-- Ejecuta esto en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Verificar que la base de datos está activa
SELECT NOW() as database_time;

-- 2. Contar usuarios en auth.users
SELECT COUNT(*) as total_users FROM auth.users;

-- 3. Ver primeros 5 usuarios
SELECT id, email, created_at, last_sign_in_at, email_confirmed_at
FROM auth.users
LIMIT 5;

-- 4. Ver tabla profiles
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- 5. Ver primeros registros de profiles
SELECT id, email, first_name, last_name, created_at
FROM public.profiles
LIMIT 5;

-- 6. Verificar si RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 7. Ver todas las políticas RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 8. Verificar conexión a auth schema
SELECT 1 FROM auth.users LIMIT 1;

-- 9. Check if email authentication is enabled
SELECT 
  EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'users' AND schemaname = 'auth') 
  as auth_users_exists;

-- 10. Ver si hay triggers activos
SELECT * FROM information_schema.triggers 
WHERE trigger_schema = 'public'
LIMIT 10;

-- 11. Verificar columnas de profiles
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ============================================================
-- Si ves errores de "permission denied", RLS está bloqueando reads
-- Si NOT todos estos queries funcionan, hay un problema grave
-- ============================================================
