-- ==============================================================================
-- BALDER - SUPABASE POSTGRESQL SCHEMA WITH ROW LEVEL SECURITY (RLS)
-- ==============================================================================
-- Este script provisiona todas as tabelas, índices e políticas de segurança
-- necessárias para o ecossistema Balder (Web & Mobile).
-- Cada usuário autenticado (auth.users) gerencia estritamente seus próprios dados.
-- ==============================================================================

-- Habilita extensão pgcrypto para geração de UUID se necessário
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função utilitária para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. TABELA: movements (Movimentações Financeiras / Fluxo de Caixa)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('RECEBER', 'PAGAR', 'EMPRESTIMO', 'CARTAO')),
  amount NUMERIC(15, 2) NOT NULL,
  due_date TEXT NOT NULL, -- YYYY-MM-DD
  bank TEXT NOT NULL DEFAULT 'Geral',
  status TEXT NOT NULL DEFAULT 'PREVISTA' CHECK (status IN ('PREVISTA', 'REALIZADA')),
  category TEXT NOT NULL DEFAULT 'Geral',
  notes TEXT,
  installment_number INTEGER,
  installments_total INTEGER,
  installment_group_id TEXT,
  interest_rate_percent NUMERIC(8, 4),
  original_amount NUMERIC(15, 2),
  actual_amount NUMERIC(15, 2),
  payment_date TEXT, -- YYYY-MM-DD
  adjustment_reason TEXT,
  nature_id TEXT,
  mapping_id TEXT,
  mapping_item_id TEXT,
  invoice_breakdown JSONB DEFAULT '[]'::jsonb,
  unanalyzed_amount NUMERIC(15, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own movements"
  ON public.movements
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_movements_user_id ON public.movements(user_id);
CREATE INDEX IF NOT EXISTS idx_movements_due_date ON public.movements(due_date);
CREATE INDEX IF NOT EXISTS idx_movements_user_due ON public.movements(user_id, due_date);

CREATE OR REPLACE TRIGGER trg_movements_updated_at
  BEFORE UPDATE ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. TABELA: natures (Naturezas Orçamentárias & Mapeamentos de Despesas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.natures (
  id TEXT PRIMARY KEY, -- Permite IDs customizados (ex: 'nat_alimentacao') ou UUIDs
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT NOT NULL DEFAULT 'Tag',
  type TEXT NOT NULL DEFAULT 'FIXA' CHECK (type IN ('FIXA', 'VARIAVEL', 'ESSENCIAL')),
  initial_budget NUMERIC(15, 2) DEFAULT 0,
  description TEXT,
  mappings JSONB DEFAULT '[]'::jsonb,
  over_ceiling_justification TEXT,
  justification_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.natures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own natures"
  ON public.natures
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_natures_user_id ON public.natures(user_id);

CREATE OR REPLACE TRIGGER trg_natures_updated_at
  BEFORE UPDATE ON public.natures
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. TABELA: goals (Metas Financeiras)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  target_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  monthly_contribution NUMERIC(15, 2) NOT NULL DEFAULT 0,
  target_date TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Target',
  color TEXT NOT NULL DEFAULT '#10B981',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own goals"
  ON public.goals
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);

CREATE OR REPLACE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 4. TABELA: accounts (Contas Bancárias e Carteiras)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank TEXT,
  institution TEXT,
  type TEXT NOT NULL DEFAULT 'CORRENTE',
  balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  initial_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#06B6D4',
  icon TEXT DEFAULT 'Wallet',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own accounts"
  ON public.accounts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

CREATE OR REPLACE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 5. TABELA: salary_contracts (Contratos de Trabalho / Renda)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.salary_contracts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employer TEXT NOT NULL,
  role TEXT,
  contract_type TEXT NOT NULL DEFAULT 'CLT',
  payment_schedule TEXT NOT NULL DEFAULT 'UNICO',
  payment_day INTEGER NOT NULL DEFAULT 5,
  second_payment_day INTEGER,
  weekly_payment_day_of_week INTEGER,
  first_installment_percent NUMERIC(5, 2),
  first_installment_amount NUMERIC(15, 2),
  second_installment_amount NUMERIC(15, 2),
  weekly_installment_amount NUMERIC(15, 2),
  installment_value_mode TEXT DEFAULT 'AUTO',
  pay_in_following_month BOOLEAN NOT NULL DEFAULT FALSE,
  current_gross_amount NUMERIC(15, 2),
  current_net_amount NUMERIC(15, 2) NOT NULL,
  receiving_bank_account_id TEXT,
  receiving_bank_name TEXT,
  start_date TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.salary_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own salary contracts"
  ON public.salary_contracts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_salary_contracts_user_id ON public.salary_contracts(user_id);

CREATE OR REPLACE TRIGGER trg_salary_contracts_updated_at
  BEFORE UPDATE ON public.salary_contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 6. TABELA: checkpoints (Marcos de Partida e Dívidas de Cartão)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkpoints (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  initial_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  credit_card_debt NUMERIC(15, 2) DEFAULT 0,
  card_due_date TEXT,
  card_name TEXT,
  card_installments INTEGER DEFAULT 1,
  card_installment_amount NUMERIC(15, 2),
  card_debts JSONB DEFAULT '[]'::jsonb,
  initial_net_worth NUMERIC(15, 2),
  label TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own checkpoints"
  ON public.checkpoints
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_checkpoints_user_id ON public.checkpoints(user_id);

CREATE OR REPLACE TRIGGER trg_checkpoints_updated_at
  BEFORE UPDATE ON public.checkpoints
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 7. TABELA: payment_methods (Métodos de Pagamento)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  linked_account_id TEXT,
  linked_card_id TEXT,
  credit_limit NUMERIC(15, 2),
  closing_day INTEGER,
  due_day INTEGER,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own payment methods"
  ON public.payment_methods
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);

CREATE OR REPLACE TRIGGER trg_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- MIGRATION PATCHES (Idempotent updates for existing tables)
-- ------------------------------------------------------------------------------
ALTER TABLE public.salary_contracts ADD COLUMN IF NOT EXISTS pay_in_following_month BOOLEAN DEFAULT FALSE;

