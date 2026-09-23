import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured, TABLES } from '../lib/supabase';
import { Movement, AccountDoc, Checkpoint } from '../types';
import { useAuth } from './AuthContext';

interface FinancialContextType {
  movements: Movement[];
  accounts: AccountDoc[];
  checkpoints: Checkpoint[];
  isLoading: boolean;
  refreshFinancialData: () => Promise<void>;
  totals: {
    receitas: number;
    despesas: number;
    saldoPrevisto: number;
  };
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

// Dados de fallback para demonstração caso banco esteja vazio ou em modo visitante
const DEMO_MOVEMENTS: Movement[] = [
  {
    id: 'demo-1',
    title: 'Salário Mensal',
    type: 'RECEBER',
    amount: 14500,
    dueDate: '2026-09-05',
    bank: 'Itaú',
    status: 'REALIZADA',
    category: 'Receita Fixa',
  },
  {
    id: 'demo-2',
    title: 'Fatura Cartão Black',
    type: 'CARTAO',
    amount: 4320.5,
    dueDate: '2026-09-10',
    bank: 'XP Investimentos',
    status: 'REALIZADA',
    category: 'Cartão de Crédito',
    installmentNumber: 1,
    installmentsTotal: 1,
  },
  {
    id: 'demo-3',
    title: 'Financiamento Imobiliário',
    type: 'EMPRESTIMO',
    amount: 3280,
    dueDate: '2026-09-15',
    bank: 'Caixa',
    status: 'REALIZADA',
    category: 'Habitação',
    installmentNumber: 24,
    installmentsTotal: 360,
  },
  {
    id: 'demo-4',
    title: 'Condomínio Residencial',
    type: 'PAGAR',
    amount: 850,
    dueDate: '2026-09-20',
    bank: 'Itaú',
    status: 'PREVISTA',
    category: 'Moradia',
  },
  {
    id: 'demo-5',
    title: 'Consultoria Externa',
    type: 'RECEBER',
    amount: 3500,
    dueDate: '2026-09-25',
    bank: 'Nubank',
    status: 'PREVISTA',
    category: 'Renda Extra',
  },
];

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [accounts, setAccounts] = useState<AccountDoc[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshFinancialData = useCallback(async () => {
    if (!user) {
      setMovements([]);
      setAccounts([]);
      setCheckpoints([]);
      return;
    }

    if (user.isGuest || !isSupabaseConfigured) {
      setMovements(DEMO_MOVEMENTS);
      setAccounts([
        { id: 'acc-1', name: 'Conta Corrente', bank: 'Itaú', initialBalance: 12500, color: '#06B6D4' },
        { id: 'acc-2', name: 'Reserva Emergência', bank: 'Nubank', initialBalance: 35000, color: '#10B981' },
      ]);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Busca Movimentações ordenadas por vencimento
      const { data: movementsData, error: movErr } = await supabase
        .from(TABLES.MOVEMENTS)
        .select('*')
        .order('due_date', { ascending: false })
        .limit(100);

      if (movErr) throw movErr;

      const parsedMovements: Movement[] = (movementsData || []).map((doc: any) => ({
        id: String(doc.id),
        title: doc.title,
        type: doc.type,
        amount: Number(doc.amount) || 0,
        dueDate: doc.due_date,
        bank: doc.bank || 'Geral',
        status: doc.status || 'PREVISTA',
        category: doc.category || 'Geral',
        notes: doc.notes || undefined,
        installmentNumber: doc.installment_number ?? undefined,
        installmentsTotal: doc.installments_total ?? undefined,
        installmentGroupId: doc.installment_group_id || undefined,
        interestRatePercent: doc.interest_rate_percent ? Number(doc.interest_rate_percent) : undefined,
        originalAmount: doc.original_amount ? Number(doc.original_amount) : undefined,
        actualAmount: doc.actual_amount ? Number(doc.actual_amount) : undefined,
        paymentDate: doc.payment_date || undefined,
        adjustmentReason: doc.adjustment_reason || undefined,
        natureId: doc.nature_id || undefined,
        unanalyzedAmount: doc.unanalyzed_amount ? Number(doc.unanalyzed_amount) : undefined,
      }));

      setMovements(parsedMovements.length > 0 ? parsedMovements : DEMO_MOVEMENTS);

      // 2. Busca Contas
      try {
        const { data: accountsData, error: accErr } = await supabase
          .from(TABLES.ACCOUNTS)
          .select('*')
          .limit(20);

        if (!accErr && accountsData) {
          const parsedAccounts: AccountDoc[] = accountsData.map((doc: any) => ({
            id: String(doc.id),
            name: doc.name,
            bank: doc.bank || doc.name,
            initialBalance: Number(doc.initial_balance) || 0,
            type: doc.type || 'CHECKING',
            color: doc.color || '#06B6D4',
          }));
          setAccounts(parsedAccounts);
        }
      } catch (accErr) {
        console.warn('[FinancialContext Mobile] Contas não encontradas ou tabela vazia:', accErr);
      }

      // 3. Busca Checkpoints
      try {
        const { data: checkpointsData, error: checkErr } = await supabase
          .from(TABLES.CHECKPOINTS)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (!checkErr && checkpointsData) {
          const parsedCheckpoints: Checkpoint[] = checkpointsData.map((doc: any) => ({
            id: String(doc.id),
            date: doc.start_date || new Date().toISOString(),
            balance: Number(doc.initial_balance) || 0,
            notes: doc.notes || undefined,
          }));
          setCheckpoints(parsedCheckpoints);
        }
      } catch (checkErr) {
        console.warn('[FinancialContext Mobile] Checkpoints vazios:', checkErr);
      }
    } catch (error: any) {
      console.error('[FinancialContext Mobile] Erro ao sincronizar Supabase:', error);
      // Fallback seguro em caso de timeout/rede
      setMovements(DEMO_MOVEMENTS);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshFinancialData();
  }, [refreshFinancialData]);

  // Totais rápidos para cabeçalhos e painéis
  const totals = movements.reduce(
    (acc, cur) => {
      if (cur.type === 'RECEBER') {
        acc.receitas += cur.amount;
      } else {
        acc.despesas += cur.amount;
      }
      return acc;
    },
    { receitas: 0, despesas: 0, saldoPrevisto: 0 }
  );
  totals.saldoPrevisto = totals.receitas - totals.despesas;

  return (
    <FinancialContext.Provider
      value={{
        movements,
        accounts,
        checkpoints,
        isLoading,
        refreshFinancialData,
        totals,
      }}
    >
      {children}
    </FinancialContext.Provider>
  );
};

export const useFinancial = (): FinancialContextType => {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error('useFinancial deve ser utilizado dentro de um FinancialProvider');
  }
  return context;
};
