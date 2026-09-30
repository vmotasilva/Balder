-- ==============================================================================
-- BALDER - HISTÓRICO DA FORSETI (últimas solicitações, avaliação e desfazer)
-- ==============================================================================
-- Cada linha é uma solicitação feita à Forseti: o que a pessoa pediu, o que foi
-- feito, os lançamentos criados (para poder desfazer) e a avaliação.
-- O app guarda só as últimas 48 horas e apaga o que é mais antigo.
-- Rodar uma vez no SQL Editor do Supabase. Enquanto a tabela não existir, o app
-- guarda o histórico só neste navegador.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.forseti_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind TEXT NOT NULL,
  request TEXT NOT NULL,
  result TEXT NOT NULL,
  -- Planejamento em que a ação foi feita (dono dos dados; nulo = o próprio)
  plan_owner_id UUID,
  plan_owner_name TEXT,
  -- [{ "title": "Despesa: TV (1/6)", "dueDate": "2026-10-10", "type": "CARTAO", "bank": "Inter" }]
  movements JSONB NOT NULL DEFAULT '[]'::jsonb,
  card_name TEXT,
  rating TEXT,
  undone_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS forseti_activity_user_idx ON public.forseti_activity (user_id, created_at DESC);

ALTER TABLE public.forseti_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own Forseti activity" ON public.forseti_activity;
CREATE POLICY "Users can manage their own Forseti activity"
  ON public.forseti_activity
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
