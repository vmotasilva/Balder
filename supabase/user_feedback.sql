-- ==============================================================================
-- BALDER - FEEDBACKS DOS USUÁRIOS (conduzidos pela Forseti, lidos pela gestão)
-- ==============================================================================
-- Rode uma vez no SQL Editor do Supabase, DEPOIS do subscriptions.sql.
-- Pode ser executado de novo sem problemas.
--
--   user_feedback        → o que a pessoa enviou pela Forseti (tipo, texto, situação)
--   admin_list_feedback()→ lista para a gestão, com nome e e-mail de quem enviou
--
-- Segurança: cada pessoa insere e lê só os próprios feedbacks; só o GESTOR lê todos e
-- muda a situação. Limite de 10 envios por pessoa por dia, imposto pelo banco.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('SUGESTAO', 'PROBLEMA', 'ELOGIO', 'OUTRO')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 1000),
  status TEXT NOT NULL DEFAULT 'NOVO' CHECK (status IN ('NOVO', 'EM_ANALISE', 'IMPLEMENTADO', 'DESCARTADO')),
  source TEXT NOT NULL DEFAULT 'FORSETI',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_feedback_user_idx ON public.user_feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_feedback_status_idx ON public.user_feedback (status, created_at DESC);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own feedback" ON public.user_feedback;
CREATE POLICY "Users insert own feedback"
  ON public.user_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'NOVO');

DROP POLICY IF EXISTS "Users read own feedback" ON public.user_feedback;
CREATE POLICY "Users read own feedback"
  ON public.user_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_system_manager());

DROP POLICY IF EXISTS "Managers update feedback" ON public.user_feedback;
CREATE POLICY "Managers update feedback"
  ON public.user_feedback FOR UPDATE TO authenticated
  USING (public.is_system_manager()) WITH CHECK (public.is_system_manager());

DROP TRIGGER IF EXISTS user_feedback_touch ON public.user_feedback;
CREATE TRIGGER user_feedback_touch
  BEFORE UPDATE ON public.user_feedback
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- No máximo 10 feedbacks por pessoa por dia
CREATE OR REPLACE FUNCTION public.user_feedback_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.user_feedback
        WHERE user_id = NEW.user_id AND created_at > NOW() - INTERVAL '24 hours') >= 10 THEN
    RAISE EXCEPTION 'Limite de feedbacks por dia atingido.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_feedback_limit_trg ON public.user_feedback;
CREATE TRIGGER user_feedback_limit_trg
  BEFORE INSERT ON public.user_feedback
  FOR EACH ROW EXECUTE FUNCTION public.user_feedback_limit();

-- Lista para a gestão (só GESTOR; lê auth.users para nome e e-mail)
CREATE OR REPLACE FUNCTION public.admin_list_feedback()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  email TEXT,
  kind TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_manager() THEN
    RAISE EXCEPTION 'Acesso restrito à gestão do sistema.';
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.user_id,
    COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name')::TEXT,
    u.email::TEXT,
    f.kind,
    f.message,
    f.status,
    f.created_at
  FROM public.user_feedback f
  JOIN auth.users u ON u.id = f.user_id
  ORDER BY f.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_feedback() TO authenticated;
