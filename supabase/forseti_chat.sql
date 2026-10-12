-- ==============================================================================
-- BALDER - CONVERSA DA FORSETI NA NUVEM (a mesma conversa no app e no navegador)
-- ==============================================================================
-- Uma linha por pessoa e por planejamento aberto (scope = 'proprio' ou o id do dono
-- do planejamento compartilhado). Guarda o texto da conversa das últimas 48 horas;
-- fotos e passos em andamento (botões de confirmação) não são guardados.
-- "Nova conversa" grava a linha vazia (mensagens = []), para os outros aparelhos
-- também limparem. O app apaga o que passou de 48 horas.
-- Rodar uma vez no SQL Editor do Supabase. Enquanto a tabela não existir, a conversa
-- fica só neste aparelho, como antes.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.forseti_chat (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL,
  -- { "savedAt": 1760000000000, "messages": [...], "topic": {...} }
  chat JSONB NOT NULL,
  PRIMARY KEY (user_id, scope)
);

CREATE INDEX IF NOT EXISTS forseti_chat_saved_idx ON public.forseti_chat (user_id, saved_at DESC);

ALTER TABLE public.forseti_chat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own Forseti chat" ON public.forseti_chat;
CREATE POLICY "Users can manage their own Forseti chat"
  ON public.forseti_chat
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
