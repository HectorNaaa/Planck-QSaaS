-- ============================================================
-- FIX: Arreglar RLS policies para permitir signup
-- EJECUTA ESTO EN TU SUPABASE SQL EDITOR
-- ============================================================

-- 1. Ver políticas actuales en profiles
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- 2. OPCIÓN A: Agregar política para permitir signup (anon puede insert su propio profile)
-- Esta política permite que usuarios anónimos creen su propio registro
CREATE POLICY "allow_signup_insert" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (true);  -- Permite a cualquiera insertar

-- 3. OPCIÓN B: Permitir que anon lea un profile específico después de signup
-- (Esto podría estar bloqueando)
CREATE POLICY "allow_anon_read"
  ON public.profiles
  FOR SELECT
  USING (true);  -- Permite a cualquiera leer

-- 4. Si lo anterior no funciona, DESHABILITAR RLS temporalmente
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 5. Verificar que las nuevas políticas existan
SELECT policyname, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================================
-- DESPUÉS DE EJECUTAR ESTO, prueba login/signup nuevamente
-- ============================================================

-- Si aún no funciona, ejecuta ESTO para diagnóstico completo:
-- SELECT NOW();  -- Verifica que la DB responde
-- SELECT COUNT(*) FROM auth.users;  -- Verifica usuarios
-- SELECT * FROM public.profiles LIMIT 1;  -- Verifica profiles

-- ============================================================
-- SI NADA FUNCIONA, las causas pueden ser:
-- 1. Supabase services down (checa Status page)
-- 2. Connection pooling issue
-- 3. Auth service not responding
-- ============================================================
