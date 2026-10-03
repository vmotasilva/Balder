-- ==============================================================================
-- BALDER - VÁRIOS PLANEJAMENTOS PRÓPRIOS (independentes) NA MESMA CONTA
-- ==============================================================================
-- Cada pessoa pode ter, além do planejamento principal, outros planejamentos totalmente
-- separados (ex.: um pequeno negócio). Cada linha das tabelas abaixo passa a ter plan_id:
--   * plan_id NULO  = planejamento principal (todos os dados que já existem continuam assim);
--   * plan_id texto = um planejamento extra.
-- A lista de planejamentos e as configurações de cada um ficam no perfil do usuário (Auth);
-- por isso não há tabela nova.
--
-- PRIVACIDADE: planejamentos extras são só do dono. A política RESTRITIVA no fim impede que
-- convidados do compartilhamento (leitores ou colaboradores) leiam ou alterem essas linhas,
-- mesmo pelas regras de compartilhamento já existentes. O compartilhamento continua valendo
-- apenas para o planejamento principal.
--
-- Seguro de rodar mais de uma vez. Rodar no SQL Editor do Supabase.
-- ==============================================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['movements', 'natures', 'goals', 'accounts', 'salary_contracts', 'checkpoints', 'payment_methods'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS plan_id TEXT', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_user_plan ON public.%I (user_id, plan_id)', t, t);

    -- Linhas de planejamentos extras: só o dono. Soma-se (AND) às demais políticas da tabela.
    EXECUTE format('DROP POLICY IF EXISTS "Extra plans are owner only" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Extra plans are owner only" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (plan_id IS NULL OR auth.uid() = user_id) '
      'WITH CHECK (plan_id IS NULL OR auth.uid() = user_id)',
      t
    );
  END LOOP;
END $$;
