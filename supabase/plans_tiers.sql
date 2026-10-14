-- ==============================================================================
-- BALDER - PLANOS DE CONTRATAÇÃO (Teste, Essencial, Pro)
-- ==============================================================================
-- Rode uma vez no SQL Editor do Supabase, DEPOIS do subscriptions.sql.
-- Pode ser executado de novo sem problemas: não sobrescreve o que você já ajustou
-- na tela de Planos (os planos existentes só ganham as colunas novas).
--
-- Novos diferenciais (por plano):
--   consolidated_enabled   → visão consolidada (somar planejamentos)
--   opportunities_enabled  → Oportunidades de compra e comparação de preços
--
--   TESTE       R$ 0,00      tudo liberado, sem limites (avaliação; o gestor define o vencimento)
--   ESSENCIAL   R$ 14,90     2 planejamentos (com o principal), 1 convite, sem Forseti,
--                            sem consolidado, sem oportunidades
--   PRO         R$ 29,90     planejamentos ilimitados (até o teto do app), 5 convites,
--                            Forseti, consolidado e oportunidades
-- ==============================================================================

DO $$
BEGIN
  IF to_regclass('public.subscription_plans') IS NULL THEN
    RAISE EXCEPTION 'Rode primeiro o supabase/subscriptions.sql e depois este script.';
  END IF;
END $$;

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS consolidated_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS opportunities_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Plano Essencial (criado só se ainda não existir)
INSERT INTO public.subscription_plans
  (code, name, description, monthly_price_cents, yearly_price_cents, benefits,
   max_plannings, max_shared_members, forseti_enabled, consolidated_enabled, opportunities_enabled, sort_order)
VALUES
  ('ESSENCIAL', 'Essencial', 'O básico para organizar o seu dinheiro.', 1490, 14900,
   ARRAY['Planejamento principal + 1 extra', '1 pessoa para planejar junto', 'Movimentações, faturas, naturezas, contratos e metas', 'Exportações'],
   2, 1, FALSE, FALSE, FALSE, 1)
ON CONFLICT (code) DO NOTHING;

-- Pro: sem limite de planejamentos, até 5 convites e todos os recursos
-- (só ajusta se ainda estiver com os valores de fábrica)
UPDATE public.subscription_plans
SET max_shared_members = 5,
    benefits = ARRAY['Planejamentos ilimitados', 'Até 5 pessoas para planejar junto', 'Forseti (assistente com IA)',
                     'Visão consolidada', 'Oportunidades e comparação de preços', 'Exportações'],
    sort_order = 2
WHERE code = 'PRO'
  AND max_shared_members IS NULL
  AND benefits = ARRAY['Planejamentos ilimitados', 'Compartilhamento com parceiro(a)', 'Forseti (assistente)', 'Exportações'];
