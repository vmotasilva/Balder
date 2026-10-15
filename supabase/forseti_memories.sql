-- ==============================================================================
-- BALDER - MEMÓRIA DA FORSETI (o que a pessoa pediu para a Forseti lembrar)
-- ==============================================================================
-- Preferências, restrições, contexto e prioridades ditas pela própria pessoa
-- ("evito parcelar", "divido o aluguel com a esposa"). Só entra aqui depois que ela
-- confirma no chat. Nunca guarda valores em reais, documentos nem dados de conta.
--
-- Acesso: a memória é de quem a criou (não do planejamento aberto, nem de quem
-- compartilha). A própria pessoa lê, cria, edita e apaga pelo app.
-- Rodar uma vez no SQL Editor do Supabase. Enquanto a tabela não existir, a memória
-- fica só neste aparelho.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.forseti_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('PREFERENCIA', 'RESTRICAO', 'CONTEXTO', 'PRIORIDADE')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS forseti_memories_user_idx ON public.forseti_memories (user_id, created_at DESC);

-- No máximo 30 memórias por pessoa
CREATE OR REPLACE FUNCTION public.forseti_memories_limit() RETURNS trigger AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.forseti_memories WHERE user_id = NEW.user_id) >= 30 THEN
    RAISE EXCEPTION 'Limite de 30 memórias da Forseti atingido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS forseti_memories_limit_trg ON public.forseti_memories;
CREATE TRIGGER forseti_memories_limit_trg
  BEFORE INSERT ON public.forseti_memories
  FOR EACH ROW EXECUTE FUNCTION public.forseti_memories_limit();

ALTER TABLE public.forseti_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own Forseti memories" ON public.forseti_memories;
CREATE POLICY "Users read own Forseti memories" ON public.forseti_memories
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users add own Forseti memories" ON public.forseti_memories;
CREATE POLICY "Users add own Forseti memories" ON public.forseti_memories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users edit own Forseti memories" ON public.forseti_memories;
CREATE POLICY "Users edit own Forseti memories" ON public.forseti_memories
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own Forseti memories" ON public.forseti_memories;
CREATE POLICY "Users delete own Forseti memories" ON public.forseti_memories
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
