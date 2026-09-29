-- ==============================================================================
-- BALDER - OPORTUNIDADES (monitoramento de preços de produtos em lojas)
-- ==============================================================================
-- Cada linha é um produto que o usuário acompanha, com o histórico de preços.
-- Rodar uma vez no SQL Editor do Supabase. Enquanto a tabela não existir, o app
-- guarda a lista só neste navegador.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.price_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  store TEXT,
  image_url TEXT,
  currency TEXT NOT NULL DEFAULT 'BRL',
  target_price NUMERIC(15, 2),
  current_price NUMERIC(15, 2),
  available BOOLEAN NOT NULL DEFAULT TRUE,
  -- [{ "at": "2026-09-29T20:00:00Z", "price": 1499.90, "source": "AUTO" | "MANUAL" }]
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS price_watches_user_idx ON public.price_watches (user_id);

ALTER TABLE public.price_watches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own price watches" ON public.price_watches;
CREATE POLICY "Users can manage their own price watches"
  ON public.price_watches
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS price_watches_updated_at ON public.price_watches;
CREATE TRIGGER price_watches_updated_at
  BEFORE UPDATE ON public.price_watches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
