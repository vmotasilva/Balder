-- ==============================================================================
-- BALDER - RELATÓRIO DIÁRIO DE APRENDIZADO DA FORSETI
-- ==============================================================================
-- Uma linha por dia, gerada pela rotina api/cron/forseti-learning (Vercel Cron) a partir
-- de forseti_conversations: frases que a Forseti não entendeu, respostas avaliadas como
-- "não útil" e ações desfeitas, agrupadas, com sugestões de regra (se houver chave da IA).
--
-- Acesso: ninguém lê ou grava pelo app (RLS ligado, sem políticas). A rotina grava com a
-- chave de serviço e quem administra lê pelo painel do Supabase.
-- Rodar uma vez no SQL Editor do Supabase.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.forseti_learning_reports (
  report_date DATE PRIMARY KEY,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_requests INTEGER NOT NULL DEFAULT 0,
  groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.forseti_learning_reports ENABLE ROW LEVEL SECURITY;
