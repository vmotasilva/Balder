-- ==============================================================================
-- BALDER - REVISÃO DO APRENDIZADO DA FORSETI PELO APP (gestores)
-- ==============================================================================
-- Deixa quem tem system_role = 'GESTOR' (user_profiles) ler os relatórios diários de
-- forseti_learning_reports pelo app (Perfil › Gestão › Aprendizado da Forseti) e marcar
-- as frases já tratadas. Os relatórios só trazem frases sem números, e-mails nem links.
--
-- Segurança:
--   * Só GESTOR lê. Ninguém mais enxerga os relatórios (continua sem política para os demais).
--   * Só a coluna handled_phrases pode ser alterada pelo app; o resto é gravado pela rotina diária.
--   * Ninguém insere nem apaga relatórios pelo app.
-- Rodar uma vez no SQL Editor do Supabase (depois de user_roles.sql e forseti_learning_reports.sql).
-- Pode ser executado de novo sem problemas.
-- ==============================================================================

ALTER TABLE public.forseti_learning_reports
  ADD COLUMN IF NOT EXISTS handled_phrases TEXT[] NOT NULL DEFAULT '{}';

DROP POLICY IF EXISTS "Managers read Forseti learning reports" ON public.forseti_learning_reports;
CREATE POLICY "Managers read Forseti learning reports"
  ON public.forseti_learning_reports FOR SELECT TO authenticated
  USING (public.has_system_role('GESTOR'));

DROP POLICY IF EXISTS "Managers mark Forseti learning phrases" ON public.forseti_learning_reports;
CREATE POLICY "Managers mark Forseti learning phrases"
  ON public.forseti_learning_reports FOR UPDATE TO authenticated
  USING (public.has_system_role('GESTOR'))
  WITH CHECK (public.has_system_role('GESTOR'));

-- Pelo app, só a lista de frases tratadas pode mudar
REVOKE UPDATE ON public.forseti_learning_reports FROM authenticated;
GRANT UPDATE (handled_phrases) ON public.forseti_learning_reports TO authenticated;
