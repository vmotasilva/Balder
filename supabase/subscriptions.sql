-- ==============================================================================
-- BALDER - PLANOS E ASSINATURAS (MÓDULO DE GESTÃO DO SISTEMA)
-- ==============================================================================
-- Rode uma vez no SQL Editor do Supabase, DEPOIS do user_roles.sql (obrigatório).
-- Pode ser executado de novo sem problemas.
--
-- Cria:
--   subscription_plans  → catálogo de planos (preço mensal, benefícios, limites)
--   user_subscriptions  → a assinatura de cada usuário (plano, situação, preço
--                         negociado, vencimento, observação)
--   admin_list_users()  → lista de usuários com a assinatura, só para GESTOR
--
-- Segurança:
--   * Cada pessoa lê só a própria assinatura e os planos ativos.
--   * Só quem tem system_role = 'GESTOR' (user_profiles) altera planos e assinaturas
--     e lista os usuários. O app só esconde o módulo; quem protege é o banco.
--
-- Todo mundo começa no plano TESTE (gratuito). Quem já existe é migrado agora.
-- ==============================================================================

-- Pré-requisito: rode antes o supabase/user_roles.sql (cria user_profiles e has_system_role).
DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NULL OR to_regprocedure('public.has_system_role(text)') IS NULL THEN
    RAISE EXCEPTION 'Rode primeiro o supabase/user_roles.sql e depois este script.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (monthly_price_cents >= 0),
  yearly_price_cents INTEGER CHECK (yearly_price_cents IS NULL OR yearly_price_cents >= 0),
  benefits TEXT[] NOT NULL DEFAULT '{}',
  -- Limites do plano (NULL = sem limite). max_plannings conta o principal; max_shared_members
  -- conta convites pendentes e ativos. Aplicados pelo app e, nos convites, pelo banco.
  max_plannings INTEGER CHECK (max_plannings IS NULL OR max_plannings >= 0),
  max_shared_members INTEGER CHECK (max_shared_members IS NULL OR max_shared_members >= 0),
  forseti_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Só um plano pode ser o padrão dos novos usuários
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_default
  ON public.subscription_plans (is_default) WHERE is_default;

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES public.subscription_plans(code) ON UPDATE CASCADE,
  status TEXT NOT NULL DEFAULT 'TESTE'
    CHECK (status IN ('TESTE', 'ATIVA', 'SUSPENSA', 'CANCELADA')),
  -- Preço negociado para este usuário (NULL = vale o preço do plano)
  custom_monthly_price_cents INTEGER CHECK (custom_monthly_price_cents IS NULL OR custom_monthly_price_cents >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan ON public.user_subscriptions(plan_code);

-- ------------------------------------------------------------------------------
-- Planos iniciais (não sobrescreve ajustes já feitos)
-- ------------------------------------------------------------------------------
INSERT INTO public.subscription_plans
  (code, name, description, monthly_price_cents, yearly_price_cents, benefits, is_default, sort_order)
VALUES
  ('TESTE', 'Teste', 'Acesso de avaliação, sem cobrança.', 0, NULL,
   ARRAY['Todos os recursos liberados durante o período de teste'], TRUE, 0),
  ('PRO', 'Balder Pro', 'Planejamento completo com a Forseti.', 2990, 29900,
   ARRAY['Planejamentos ilimitados', 'Compartilhamento com parceiro(a)', 'Forseti (assistente)', 'Exportações'], FALSE, 1)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------------------------
-- Auxiliar de segurança: o usuário logado é GESTOR?
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_system_manager()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_system_role('GESTOR');
$$;

GRANT EXECUTE ON FUNCTION public.is_system_manager() TO authenticated;

-- ------------------------------------------------------------------------------
-- Segurança (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read active plans" ON public.subscription_plans;
CREATE POLICY "Read active plans"
  ON public.subscription_plans FOR SELECT TO authenticated
  USING (active OR public.is_system_manager());

DROP POLICY IF EXISTS "Manager writes plans" ON public.subscription_plans;
CREATE POLICY "Manager writes plans"
  ON public.subscription_plans FOR ALL TO authenticated
  USING (public.is_system_manager())
  WITH CHECK (public.is_system_manager());

DROP POLICY IF EXISTS "User reads own subscription" ON public.user_subscriptions;
CREATE POLICY "User reads own subscription"
  ON public.user_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_system_manager());

DROP POLICY IF EXISTS "Manager writes subscriptions" ON public.user_subscriptions;
CREATE POLICY "Manager writes subscriptions"
  ON public.user_subscriptions FOR ALL TO authenticated
  USING (public.is_system_manager())
  WITH CHECK (public.is_system_manager());

-- ------------------------------------------------------------------------------
-- Todo usuário novo começa no plano padrão (TESTE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan_code, status)
  SELECT NEW.id, code, 'TESTE' FROM public.subscription_plans WHERE is_default LIMIT 1
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Quem já existe entra no plano TESTE agora
INSERT INTO public.user_subscriptions (user_id, plan_code, status)
SELECT u.id, p.code, 'TESTE'
FROM auth.users u CROSS JOIN (SELECT code FROM public.subscription_plans WHERE is_default LIMIT 1) p
ON CONFLICT (user_id) DO NOTHING;

-- Mantém updated_at em dia
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_plans_touch ON public.subscription_plans;
CREATE TRIGGER subscription_plans_touch
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS user_subscriptions_touch ON public.user_subscriptions;
CREATE TRIGGER user_subscriptions_touch
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------------------------------
-- Lista de usuários para o módulo de gestão (só GESTOR; lê auth.users)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  name TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  system_role TEXT,
  plan_code TEXT,
  status TEXT,
  custom_monthly_price_cents INTEGER,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_manager() THEN
    RAISE EXCEPTION 'Acesso restrito à gestão do sistema.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name')::TEXT,
    u.created_at,
    u.last_sign_in_at,
    COALESCE(p.system_role, 'USUARIO')::TEXT,
    s.plan_code,
    s.status,
    s.custom_monthly_price_cents,
    s.started_at,
    s.expires_at,
    s.notes
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.user_id = u.id
  LEFT JOIN public.user_subscriptions s ON s.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- ------------------------------------------------------------------------------
-- Gestão do sistema: por ora, o ÚNICO gestor é vmotasilva@gmail.com.
-- O nível de acesso é o campo user_profiles.system_role ('GESTOR').
-- Aqui ele é concedido a esse e-mail e retirado de qualquer outro.
-- Para liberar mais alguém no futuro:
--   UPDATE public.user_profiles SET system_role = 'GESTOR' WHERE email = 'pessoa@exemplo.com';
-- ------------------------------------------------------------------------------
UPDATE public.user_profiles SET system_role = 'USUARIO'
WHERE system_role = 'GESTOR' AND lower(email) <> 'vmotasilva@gmail.com';

UPDATE public.user_profiles SET system_role = 'GESTOR'
WHERE lower(email) = 'vmotasilva@gmail.com';

-- ------------------------------------------------------------------------------
-- Limite de convites de compartilhamento (max_shared_members) imposto pelo banco.
-- Conta convites PENDENTE e ATIVO do dono. Assinatura suspensa, cancelada ou vencida: 0.
-- Sem assinatura cadastrada: sem limite. Chamadas sem usuário (service role) passam.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_share_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status TEXT;
  v_expires TIMESTAMPTZ;
  v_limit INTEGER;
  v_found BOOLEAN;
  v_used INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.status, s.expires_at, p.max_shared_members, TRUE
    INTO v_status, v_expires, v_limit, v_found
  FROM public.user_subscriptions s
  JOIN public.subscription_plans p ON p.code = s.plan_code
  WHERE s.user_id = NEW.owner_id;

  IF NOT COALESCE(v_found, FALSE) THEN
    RETURN NEW;
  END IF;

  IF v_status IN ('SUSPENSA', 'CANCELADA') OR (v_expires IS NOT NULL AND v_expires < NOW()) THEN
    v_limit := 0;
  END IF;

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_used FROM public.account_shares
  WHERE owner_id = NEW.owner_id AND status IN ('PENDENTE', 'ATIVO');

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'O plano atual permite % convite(s) de compartilhamento.', v_limit;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_share_limit ON public.account_shares;
CREATE TRIGGER trg_enforce_share_limit
  BEFORE INSERT ON public.account_shares
  FOR EACH ROW EXECUTE FUNCTION public.enforce_share_limit();
