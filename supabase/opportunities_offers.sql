-- ==============================================================================
-- BALDER - OPORTUNIDADES: várias lojas por produto
-- ==============================================================================
-- Cada produto acompanhado passa a guardar a lista de lojas (ofertas) com o preço,
-- a situação do link e o histórico de cada uma.
-- Rodar uma vez no SQL Editor do Supabase (depois de supabase/opportunities.sql).
-- Enquanto a coluna não existir, as lojas ficam só neste aparelho.
-- ==============================================================================

ALTER TABLE public.price_watches ADD COLUMN IF NOT EXISTS offers JSONB NOT NULL DEFAULT '[]'::jsonb;
