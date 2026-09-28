-- ==============================================================================
-- BALDER - COMPARTILHAMENTO DE CONTA
-- ==============================================================================
-- Rode este script uma vez no SQL Editor do Supabase (depois do schema.sql).
-- Pode ser executado de novo sem problemas.
--
-- Modelo:
--   * O dono cria um convite (account_shares) com papel e alcance:
--       papel   COLABORADOR  → vê e registra pagamentos
--               VISUALIZADOR → só vê
--       alcance CONTA        → conta inteira
--               PLANEJAMENTO → só o planejamento compartilhado
--   * O convite vale por link (token) e, se tiver e-mail, só para aquele e-mail.
--   * Quem aceita passa a ler os dados do dono conforme o alcance.
--   * Revogar muda o status para REVOGADO e corta o acesso na hora (as regras
--     de segurança consultam o status a cada leitura/escrita).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. CONVITES / ACESSOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_name TEXT,
  owner_email TEXT,
  invite_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  invited_email TEXT,
  member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  member_name TEXT,
  member_email TEXT,
  role TEXT NOT NULL DEFAULT 'VISUALIZADOR' CHECK (role IN ('COLABORADOR', 'VISUALIZADOR')),
  scope TEXT NOT NULL DEFAULT 'CONTA' CHECK (scope IN ('CONTA', 'PLANEJAMENTO')),
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'ATIVO', 'REVOGADO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_shares_owner ON public.account_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_account_shares_member ON public.account_shares(member_id);

ALTER TABLE public.account_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own shares" ON public.account_shares;
CREATE POLICY "Owner manages own shares"
  ON public.account_shares FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- O convidado vê os acessos dele e os convites pendentes enviados para o e-mail dele
DROP POLICY IF EXISTS "Member sees own shares" ON public.account_shares;
CREATE POLICY "Member sees own shares"
  ON public.account_shares FOR SELECT TO authenticated
  USING (
    member_id = auth.uid()
    OR (status = 'PENDENTE' AND invited_email IS NOT NULL AND lower(invited_email) = lower(auth.jwt() ->> 'email'))
  );

CREATE OR REPLACE TRIGGER trg_account_shares_updated_at
  BEFORE UPDATE ON public.account_shares
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. FUNÇÕES DE PERMISSÃO (usadas pelas regras de segurança)
-- ------------------------------------------------------------------------------
-- Conta inteira: dono ou convidado ativo com alcance CONTA
CREATE OR REPLACE FUNCTION public.can_read_account(p_owner UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_owner = auth.uid() OR EXISTS (
    SELECT 1 FROM public.account_shares s
    WHERE s.owner_id = p_owner AND s.member_id = auth.uid() AND s.status = 'ATIVO' AND s.scope = 'CONTA'
  );
$$;

-- Registrar pagamentos na conta: colaborador ativo com alcance CONTA
CREATE OR REPLACE FUNCTION public.can_register_payments(p_owner UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_shares s
    WHERE s.owner_id = p_owner AND s.member_id = auth.uid() AND s.status = 'ATIVO'
      AND s.scope = 'CONTA' AND s.role = 'COLABORADOR'
  );
$$;

-- Planejamento compartilhado: dono ou qualquer convidado ativo (qualquer alcance)
CREATE OR REPLACE FUNCTION public.can_read_planning(p_owner UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_owner = auth.uid() OR EXISTS (
    SELECT 1 FROM public.account_shares s
    WHERE s.owner_id = p_owner AND s.member_id = auth.uid() AND s.status = 'ATIVO'
  );
$$;

-- Registrar pagamentos no planejamento: colaborador ativo (qualquer alcance)
CREATE OR REPLACE FUNCTION public.can_register_planning_payments(p_owner UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_shares s
    WHERE s.owner_id = p_owner AND s.member_id = auth.uid() AND s.status = 'ATIVO' AND s.role = 'COLABORADOR'
  );
$$;

-- ------------------------------------------------------------------------------
-- 3. CONVITE POR LINK: pré-visualizar, aceitar e sair
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_account_invite(p_token TEXT)
RETURNS TABLE (owner_name TEXT, owner_email TEXT, role TEXT, scope TEXT, status TEXT, invited_email TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.owner_name, s.owner_email, s.role, s.scope, s.status, s.invited_email
  FROM public.account_shares s WHERE s.invite_token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.accept_account_invite(p_token TEXT)
RETURNS public.account_shares
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.account_shares;
  v_email TEXT := auth.jwt() ->> 'email';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.';
  END IF;

  SELECT * INTO s FROM public.account_shares WHERE invite_token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;
  IF s.status = 'REVOGADO' THEN
    RAISE EXCEPTION 'Este convite foi cancelado por quem compartilhou.';
  END IF;
  IF s.owner_id = auth.uid() THEN
    RAISE EXCEPTION 'Este convite é da sua própria conta.';
  END IF;
  IF s.status = 'ATIVO' AND s.member_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Este convite já foi usado por outra pessoa.';
  END IF;
  IF s.invited_email IS NOT NULL AND lower(s.invited_email) <> lower(coalesce(v_email, '')) THEN
    RAISE EXCEPTION 'Este convite foi enviado para outro e-mail (%).', s.invited_email;
  END IF;

  UPDATE public.account_shares
  SET member_id = auth.uid(),
      member_email = v_email,
      member_name = coalesce(
        auth.jwt() -> 'user_metadata' ->> 'full_name',
        auth.jwt() -> 'user_metadata' ->> 'name',
        v_email
      ),
      status = 'ATIVO',
      accepted_at = NOW()
  WHERE id = s.id
  RETURNING * INTO s;

  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_account_share(p_share_id UUID)
RETURNS VOID LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.account_shares
  SET status = 'REVOGADO', revoked_at = NOW()
  WHERE id = p_share_id AND member_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_account_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_account_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_account_share(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. LEITURA DOS DADOS DA CONTA PELOS CONVIDADOS (alcance CONTA)
-- ------------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['movements', 'natures', 'goals', 'accounts', 'checkpoints', 'payment_methods'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Shared members can read" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Shared members can read" ON public.%I FOR SELECT TO authenticated USING (public.can_read_account(user_id))',
      t
    );
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 5. COLABORADOR: SÓ REGISTRA PAGAMENTOS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Collaborators can register payments" ON public.movements;
CREATE POLICY "Collaborators can register payments"
  ON public.movements FOR UPDATE TO authenticated
  USING (public.can_register_payments(user_id))
  WITH CHECK (public.can_register_payments(user_id));

DROP POLICY IF EXISTS "Collaborators can register payments" ON public.natures;
CREATE POLICY "Collaborators can register payments"
  ON public.natures FOR UPDATE TO authenticated
  USING (public.can_register_payments(user_id))
  WITH CHECK (public.can_register_payments(user_id));

-- Em lançamentos de outra pessoa, só mudam os campos de pagamento
CREATE OR REPLACE FUNCTION public.guard_collaborator_movement_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM OLD.user_id THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.type IS DISTINCT FROM OLD.type
      OR NEW.due_date IS DISTINCT FROM OLD.due_date
      OR NEW.bank IS DISTINCT FROM OLD.bank
      OR NEW.category IS DISTINCT FROM OLD.category
      OR NEW.installment_number IS DISTINCT FROM OLD.installment_number
      OR NEW.installments_total IS DISTINCT FROM OLD.installments_total
      OR NEW.installment_group_id IS DISTINCT FROM OLD.installment_group_id
      OR NEW.interest_rate_percent IS DISTINCT FROM OLD.interest_rate_percent
      OR NEW.nature_id IS DISTINCT FROM OLD.nature_id
      OR NEW.mapping_id IS DISTINCT FROM OLD.mapping_id
      OR NEW.mapping_item_id IS DISTINCT FROM OLD.mapping_item_id
      OR NEW.invoice_breakdown IS DISTINCT FROM OLD.invoice_breakdown
    THEN
      RAISE EXCEPTION 'Colaboradores só podem registrar pagamentos.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_collaborator_movement ON public.movements;
CREATE TRIGGER trg_guard_collaborator_movement
  BEFORE UPDATE ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.guard_collaborator_movement_update();

-- Em naturezas de outra pessoa, só mudam os mapeamentos (onde ficam os pagamentos dos itens)
CREATE OR REPLACE FUNCTION public.guard_collaborator_nature_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM OLD.user_id THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.name IS DISTINCT FROM OLD.name
      OR NEW.color IS DISTINCT FROM OLD.color
      OR NEW.icon IS DISTINCT FROM OLD.icon
      OR NEW.type IS DISTINCT FROM OLD.type
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.keywords IS DISTINCT FROM OLD.keywords
    THEN
      RAISE EXCEPTION 'Colaboradores só podem registrar pagamentos.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_collaborator_nature ON public.natures;
CREATE TRIGGER trg_guard_collaborator_nature
  BEFORE UPDATE ON public.natures
  FOR EACH ROW EXECUTE FUNCTION public.guard_collaborator_nature_update();

-- ------------------------------------------------------------------------------
-- 6. ESPELHOS DAS CONFIGURAÇÕES DO PERFIL
-- ------------------------------------------------------------------------------
-- Cartões, fechamentos, marcos etc. ficam no perfil de login (só o dono lê).
-- O app do dono mantém estes espelhos atualizados para os convidados.

-- Configurações da conta (alcance CONTA)
CREATE TABLE IF NOT EXISTS public.account_settings (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.account_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages account settings" ON public.account_settings;
CREATE POLICY "Owner manages account settings"
  ON public.account_settings FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Members read account settings" ON public.account_settings;
CREATE POLICY "Members read account settings"
  ON public.account_settings FOR SELECT TO authenticated
  USING (public.can_read_account(owner_id));

-- Planejamento compartilhado (qualquer alcance); o colaborador pode registrar acertos e despesas pagas
CREATE TABLE IF NOT EXISTS public.shared_planning (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario JSONB,
  settlements JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shared_planning ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages shared planning" ON public.shared_planning;
CREATE POLICY "Owner manages shared planning"
  ON public.shared_planning FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Members read shared planning" ON public.shared_planning;
CREATE POLICY "Members read shared planning"
  ON public.shared_planning FOR SELECT TO authenticated
  USING (public.can_read_planning(owner_id));

DROP POLICY IF EXISTS "Collaborators update shared planning" ON public.shared_planning;
CREATE POLICY "Collaborators update shared planning"
  ON public.shared_planning FOR UPDATE TO authenticated
  USING (public.can_register_planning_payments(owner_id))
  WITH CHECK (public.can_register_planning_payments(owner_id));

-- Colaborador no planejamento não altera o cenário (membros, divisão), só os acertos
CREATE OR REPLACE FUNCTION public.guard_collaborator_planning_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM OLD.owner_id AND NEW.scenario IS DISTINCT FROM OLD.scenario THEN
    RAISE EXCEPTION 'Colaboradores só podem registrar pagamentos.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_collaborator_planning ON public.shared_planning;
CREATE TRIGGER trg_guard_collaborator_planning
  BEFORE UPDATE ON public.shared_planning
  FOR EACH ROW EXECUTE FUNCTION public.guard_collaborator_planning_update();

-- ------------------------------------------------------------------------------
-- 7. CONTA COMPARTILHADA COMO PRINCIPAL
-- ------------------------------------------------------------------------------
-- O convidado pede para abrir o Balder direto na conta compartilhada; o dono autoriza
-- ou recusa. Cada pessoa tem no máximo uma conta principal (pedida ou autorizada).
-- Ao encerrar o compartilhamento, o pedido some e a pessoa volta à conta individual.
ALTER TABLE public.account_shares
  ADD COLUMN IF NOT EXISTS primary_status TEXT NOT NULL DEFAULT 'NENHUM';

ALTER TABLE public.account_shares DROP CONSTRAINT IF EXISTS account_shares_primary_status_check;
ALTER TABLE public.account_shares
  ADD CONSTRAINT account_shares_primary_status_check CHECK (primary_status IN ('NENHUM', 'SOLICITADO', 'APROVADO'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_shares_one_primary
  ON public.account_shares(member_id) WHERE primary_status <> 'NENHUM';

-- Só o convidado pede; só o dono autoriza (e só o que foi pedido); qualquer um dos dois desfaz
CREATE OR REPLACE FUNCTION public.guard_share_primary_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'ATIVO' THEN
    NEW.primary_status := 'NENHUM';
    RETURN NEW;
  END IF;
  IF NEW.primary_status IS DISTINCT FROM OLD.primary_status THEN
    IF NEW.primary_status = 'SOLICITADO' AND auth.uid() IS DISTINCT FROM NEW.member_id THEN
      RAISE EXCEPTION 'Só quem recebeu o compartilhamento pode pedir para usá-lo como conta principal.';
    END IF;
    IF NEW.primary_status = 'APROVADO'
      AND (auth.uid() IS DISTINCT FROM NEW.owner_id OR OLD.primary_status <> 'SOLICITADO') THEN
      RAISE EXCEPTION 'Só quem compartilhou pode autorizar, e apenas um pedido feito.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_share_primary ON public.account_shares;
CREATE TRIGGER trg_guard_share_primary
  BEFORE UPDATE ON public.account_shares
  FOR EACH ROW EXECUTE FUNCTION public.guard_share_primary_status();

-- Convidado pede (e desfaz qualquer outra conta principal que tivesse)
CREATE OR REPLACE FUNCTION public.request_primary_account(p_share_id UUID)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.account_shares
    WHERE id = p_share_id AND member_id = auth.uid() AND status = 'ATIVO'
  ) THEN
    RAISE EXCEPTION 'Compartilhamento não encontrado ou encerrado.';
  END IF;

  UPDATE public.account_shares SET primary_status = 'NENHUM'
  WHERE member_id = auth.uid() AND id <> p_share_id AND primary_status <> 'NENHUM';

  UPDATE public.account_shares SET primary_status = 'SOLICITADO'
  WHERE id = p_share_id AND primary_status = 'NENHUM';
END;
$$;

-- Convidado cancela o pedido ou deixa de usar como principal
CREATE OR REPLACE FUNCTION public.clear_primary_account(p_share_id UUID)
RETURNS VOID LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.account_shares SET primary_status = 'NENHUM'
  WHERE id = p_share_id AND member_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.request_primary_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_primary_account(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. TEMPO REAL
-- ------------------------------------------------------------------------------
-- Quem compartilhou e quem foi convidado recebem na hora as mudanças um do outro
-- (lançamentos, pagamentos dos itens das naturezas, saldos, configurações e acertos).
DO $$
DECLARE t TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  FOREACH t IN ARRAY ARRAY['movements', 'natures', 'checkpoints', 'accounts', 'account_settings', 'shared_planning'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
