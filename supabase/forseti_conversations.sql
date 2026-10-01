-- ==============================================================================
-- BALDER - CONVERSAS DA FORSETI PARA ESTUDO (melhorar a associação de palavras-chave)
-- ==============================================================================
-- Cada solicitação à Forseti (o que a pessoa escreveu, o que a Forseti respondeu, o
-- desfecho e a avaliação) é guardada aqui, SEM prazo de 48 horas.
--
-- Acesso:
--   * Os usuários só conseguem GRAVAR (insert). Não existe política de leitura: ninguém
--     vê conversas, nem as próprias, pelo app.
--   * Quem administra o projeto lê pelo painel do Supabase (Table Editor / SQL Editor),
--     que ignora o RLS. Use a view `forseti_conversations_latest` para ver o estado atual.
--
-- Cada alteração (avaliação, desfazer) entra como um novo evento da mesma solicitação
-- (activity_id); a view devolve o mais recente.
-- Rodar uma vez no SQL Editor do Supabase. Enquanto a tabela não existir, o app ignora.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.forseti_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL,
  conversation_id UUID,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind TEXT NOT NULL,
  request TEXT NOT NULL,
  result TEXT NOT NULL,
  rating TEXT,
  undone_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS forseti_conversations_activity_idx ON public.forseti_conversations (activity_id, event_at DESC);
CREATE INDEX IF NOT EXISTS forseti_conversations_conv_idx ON public.forseti_conversations (conversation_id, created_at);

ALTER TABLE public.forseti_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only add Forseti conversations" ON public.forseti_conversations;
CREATE POLICY "Users can only add Forseti conversations"
  ON public.forseti_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Estado atual de cada solicitação (último evento), para estudar pedidos x desfechos
CREATE OR REPLACE VIEW public.forseti_conversations_latest AS
SELECT DISTINCT ON (activity_id) *
FROM public.forseti_conversations
ORDER BY activity_id, event_at DESC;
