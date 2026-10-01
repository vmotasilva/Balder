-- ==============================================================================
-- BALDER - PERFIL DO USUÁRIO NO SISTEMA (DESENVOLVEDOR / GESTOR)
-- ==============================================================================
-- Rode este script uma vez no SQL Editor do Supabase (depois do schema.sql).
-- Pode ser executado de novo sem problemas.
--
-- Cria a tabela public.user_profiles, com uma linha por usuário (auth.users) e a
-- coluna system_role, que marca quem trabalha no sistema Balder:
--
--   USUARIO        → usuário comum (padrão)
--   DESENVOLVEDOR  → desenvolve o sistema
--   GESTOR         → gerencia o sistema
--
-- Para marcar alguém, no SQL Editor ou no Table Editor:
--   UPDATE public.user_profiles SET system_role = 'DESENVOLVEDOR' WHERE email = 'pessoa@exemplo.com';
--   UPDATE public.user_profiles SET system_role = 'GESTOR'        WHERE email = 'outra@exemplo.com';
--
-- Segurança:
--   * Cada pessoa lê só a própria linha.
--   * Ninguém altera o perfil pelo app: sem política de escrita, só quem administra
--     o projeto (SQL Editor / Table Editor / service role) muda o system_role.
--     Assim, ninguém consegue se promover.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  system_role TEXT NOT NULL DEFAULT 'USUARIO'
    CHECK (system_role IN ('USUARIO', 'DESENVOLVEDOR', 'GESTOR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(system_role)
  WHERE system_role <> 'USUARIO';

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User reads own profile" ON public.user_profiles;
CREATE POLICY "User reads own profile"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- Cria o perfil de todo usuário novo (papel padrão USUARIO)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Quem já existe ganha o perfil agora
INSERT INTO public.user_profiles (user_id, email)
SELECT id, email FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Mantém updated_at em dia
CREATE OR REPLACE FUNCTION public.touch_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_touch ON public.user_profiles;
CREATE TRIGGER user_profiles_touch
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_profile();

-- ------------------------------------------------------------------------------
-- Auxiliar para regras de segurança futuras: o usuário logado é da equipe do sistema?
--   SELECT public.is_system_staff();               -- DESENVOLVEDOR ou GESTOR
--   SELECT public.has_system_role('GESTOR');       -- papel específico
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_system_role(p_role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND system_role = p_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_system_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND system_role IN ('DESENVOLVEDOR', 'GESTOR')
  );
$$;
