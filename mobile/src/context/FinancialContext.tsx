import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { SupabaseMobileService } from '../services/supabaseService';
import {
  Movement,
  ExpenseNature,
  Goal,
  BankAccount,
  SalaryContract,
  SalaryAdjustment,
  FinancialCheckpoint,
  CreditCardItem,
  PaymentMethodItem,
  MovementStatus,
} from '../types';
import { useAuth } from './AuthContext';

interface PrepayItem {
  id: string;
  nominalAmount: number;
  discountedAmount: number;
  discountAmount: number;
}

interface FinancialContextType {
  movements: Movement[];
  natures: ExpenseNature[];
  goals: Goal[];
  accounts: BankAccount[];
  salaryContracts: SalaryContract[];
  checkpoints: FinancialCheckpoint[];
  activeCheckpoint: FinancialCheckpoint | null;
  cards: CreditCardItem[];
  paymentMethods: PaymentMethodItem[];
  isLoading: boolean;
  isDataReady: boolean;
  refreshFinancialData: () => Promise<void>;

  // Ações de Movimentações
  addMovement: (item: Omit<Movement, 'id'>) => Promise<void>;
  updateMovement: (id: string, updates: Partial<Movement>) => Promise<void>;
  deleteMovement: (id: string) => Promise<void>;
  toggleMovementStatus: (id: string) => Promise<void>;
  prepayInstallments: (
    itemsOrIds: PrepayItem[] | string[],
    discountedAmounts?: Record<string, number>,
    paymentDate?: string
  ) => Promise<void>;

  // Ações de Naturezas
  addNature: (nature: Omit<ExpenseNature, 'id' | 'mappings'>) => Promise<void>;
  updateNature: (id: string, updates: Partial<ExpenseNature>) => Promise<void>;
  deleteNature: (id: string) => Promise<void>;

  // Ações de Metas
  addGoal: (goal: Omit<Goal, 'id'>) => Promise<void>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  // Ações de Contratos de Salário
  upsertSalaryContract: (contract: SalaryContract) => Promise<void>;
  addSalaryContract: (contract: Omit<SalaryContract, 'id'>) => Promise<void>;
  updateSalaryContract: (id: string, updates: Partial<SalaryContract>) => Promise<void>;
  deleteSalaryContract: (id: string) => Promise<void>;
  addSalaryAdjustment: (contractId: string, adj: Omit<SalaryAdjustment, 'id'>) => Promise<void>;
  deleteSalaryAdjustment: (contractId: string, adjustmentId: string) => Promise<void>;

  // Ações de Contas Bancárias e Cartões
  upsertAccount: (account: BankAccount) => Promise<void>;
  addAccount: (account: Omit<BankAccount, 'id'>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addCard: (card: Omit<CreditCardItem, 'id'>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;

  // Ações de Checkpoints
  upsertCheckpoint: (checkpoint: FinancialCheckpoint) => Promise<void>;
  activateCheckpoint: (id: string) => Promise<void>;
  addCheckpoint: (checkpoint: Omit<FinancialCheckpoint, 'id'>) => Promise<void>;
  deleteCheckpoint: (id: string) => Promise<void>;

  // Métricas
  totals: {
    receitas: number;
    despesas: number;
    saldoPrevisto: number;
    totalEmprestimos: number;
    totalFaturas: number;
  };
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

// Dados de demonstração completos para modo convidado e fallback
const DEMO_MOVEMENTS: Movement[] = [
  {
    id: 'demo-1',
    title: 'Salário Mensal CLT',
    type: 'RECEITA',
    amount: 14500,
    dueDate: '2026-09-05',
    bank: 'Itaú',
    status: 'REALIZADA',
    category: 'Salário',
    nature: 'Renda',
  },
  {
    id: 'demo-2',
    title: 'Fatura XP Visa Infinite',
    type: 'DESPESA',
    amount: 4320.5,
    dueDate: '2026-09-10',
    bank: 'XP Investimentos',
    status: 'REALIZADA',
    category: 'Cartão de Crédito',
    nature: 'Consumo',
    installmentNumber: 1,
    installmentsTotal: 1,
    invoiceBreakdown: [
      { id: 'inv-1', natureName: 'Alimentação', description: 'Supermercado Mensal', amount: 1850, isAnalyzed: true },
      { id: 'inv-2', natureName: 'Lazer', description: 'Restaurantes & Delivery', amount: 920.5, isAnalyzed: true },
      { id: 'inv-3', natureName: 'Transporte', description: 'Combustível Posto Shell', amount: 550, isAnalyzed: true },
      { id: 'inv-4', natureName: 'Outros', description: 'Assinaturas Streaming', amount: 1000, isAnalyzed: true },
    ],
  },
  {
    id: 'demo-3',
    title: 'Financiamento Imobiliário (24/360)',
    type: 'EMPRESTIMO',
    amount: 3280,
    dueDate: '2026-09-15',
    bank: 'Caixa Econômica',
    status: 'REALIZADA',
    category: 'Habitação',
    nature: 'Dívidas & Empréstimos',
    installmentNumber: 24,
    installmentsTotal: 360,
    interestRatePercent: 0.78,
  },
  {
    id: 'demo-4',
    title: 'Condomínio Residencial',
    type: 'DESPESA',
    amount: 850,
    dueDate: '2026-09-10',
    bank: 'Itaú',
    status: 'REALIZADA',
    category: 'Moradia',
    nature: 'Fixas',
  },
  {
    id: 'demo-5',
    title: 'Plano de Saúde Familiar',
    type: 'DESPESA',
    amount: 1420,
    dueDate: '2026-09-15',
    bank: 'Itaú',
    status: 'REALIZADA',
    category: 'Saúde',
    nature: 'Fixas',
  },
  {
    id: 'demo-6',
    title: 'Supermercado Pão de Açúcar',
    type: 'DESPESA',
    amount: 1250,
    dueDate: '2026-09-18',
    bank: 'Nubank',
    status: 'PREVISTA',
    category: 'Alimentação',
    nature: 'Consumo',
  },
  {
    id: 'demo-7',
    title: 'Prestação Carro (18/36)',
    type: 'EMPRESTIMO',
    amount: 1650,
    dueDate: '2026-09-22',
    bank: 'Santander',
    status: 'PREVISTA',
    category: 'Transporte',
    nature: 'Dívidas & Empréstimos',
    installmentNumber: 18,
    installmentsTotal: 36,
    interestRatePercent: 2.2,
  },
  {
    id: 'demo-8',
    title: 'Freelance Consultoria Tech',
    type: 'RECEITA',
    amount: 6000,
    dueDate: '2026-09-25',
    bank: 'Inter',
    status: 'PREVISTA',
    category: 'Renda Extra',
    nature: 'Renda',
  },
  {
    id: 'demo-9',
    title: 'Fatura Nubank Mastercard Black',
    type: 'DESPESA',
    amount: 3890,
    dueDate: '2026-09-28',
    bank: 'Nubank',
    status: 'PREVISTA',
    category: 'Cartão de Crédito',
    nature: 'Consumo',
    invoiceBreakdown: [
      { id: 'inv-5', natureName: 'Consumo', description: 'Eletrônicos & Compras', amount: 2200, isAnalyzed: true },
      { id: 'inv-6', natureName: 'Lazer', description: 'Cinema & Bares', amount: 1690, isAnalyzed: true },
    ],
  },
  {
    id: 'demo-10',
    title: 'Energia Elétrica Enel',
    type: 'DESPESA',
    amount: 380,
    dueDate: '2026-09-29',
    bank: 'Itaú',
    status: 'PREVISTA',
    category: 'Utilidades',
    nature: 'Fixas',
  },
];

const DEMO_NATURES: ExpenseNature[] = [
  {
    id: 'nat-1',
    name: 'Consumo',
    color: '#06B6D4',
    icon: 'ShoppingCart',
    type: 'VARIAVEL',
    initialBudget: 5000,
    monthlyCeiling: 5000,
    description: 'Gastos rotineiros, mercado, farmácia e delivery',
    mappings: [
      {
        id: 'map-1',
        name: 'Supermercado Semanal',
        natureId: 'nat-1',
        frequency: 'SEMANAL',
        items: [
          { id: 'it-1', description: 'Hortifruti & Carnes', quantity: 1, price: 350, multiplierWeeks: 4, totalValue: 1400 },
          { id: 'it-2', description: 'Itens de Limpeza & Dispensa', quantity: 1, price: 250, multiplierWeeks: 4, totalValue: 1000 },
        ],
      },
    ],
  },
  {
    id: 'nat-2',
    name: 'Fixas',
    color: '#F43F5E',
    icon: 'Home',
    type: 'FIXA',
    initialBudget: 4500,
    monthlyCeiling: 4500,
    description: 'Compromissos mensais fixos essenciais',
    mappings: [],
  },
  {
    id: 'nat-3',
    name: 'Dívidas & Empréstimos',
    color: '#F59E0B',
    icon: 'Landmark',
    type: 'FIXA',
    initialBudget: 6000,
    monthlyCeiling: 6000,
    description: 'Contratos vigentes amortizados pela Tabela PRICE',
    mappings: [],
  },
  {
    id: 'nat-4',
    name: 'Lazer & Experiências',
    color: '#A855F7',
    icon: 'Sparkles',
    type: 'VARIAVEL',
    initialBudget: 2500,
    monthlyCeiling: 2500,
    description: 'Viagens, jantares e entretenimento',
    mappings: [],
  },
];

const DEMO_GOALS: Goal[] = [
  {
    id: 'goal-1',
    title: 'Reserva de Emergência (6 Meses)',
    category: 'Segurança',
    currentAmount: 48500,
    targetAmount: 60000,
    monthlyContribution: 2000,
    targetDate: '2026-12-31',
    deadline: '2026-12-31',
    icon: 'Shield',
    color: '#10B981',
  },
  {
    id: 'goal-2',
    title: 'Aporte Carteira de Dividendos',
    category: 'Investimentos',
    currentAmount: 28000,
    targetAmount: 50000,
    monthlyContribution: 2500,
    targetDate: '2027-06-30',
    deadline: '2027-06-30',
    icon: 'TrendingUp',
    color: '#06B6D4',
  },
  {
    id: 'goal-3',
    title: 'Quitação Antecipada Empréstimo',
    category: 'Dívidas',
    currentAmount: 12000,
    targetAmount: 25000,
    monthlyContribution: 1500,
    targetDate: '2027-02-28',
    deadline: '2027-02-28',
    icon: 'Zap',
    color: '#F59E0B',
  },
];

const DEMO_ACCOUNTS: BankAccount[] = [
  { id: 'acc-1', name: 'Conta Principal', bank: 'Itaú Unibanco', bankName: 'Itaú', type: 'CHECKING', balance: 18450.8, initialBalance: 18450.8, color: '#F97316', icon: 'Building' },
  { id: 'acc-2', name: 'Conta Diária', bank: 'Nubank', bankName: 'Nubank', type: 'CHECKING', balance: 4120.3, initialBalance: 4120.3, color: '#8B5CF6', icon: 'Wallet' },
  { id: 'acc-3', name: 'Investimentos & Tesouro', bank: 'XP Investimentos', bankName: 'XP', type: 'INVESTMENT', balance: 85200.0, initialBalance: 85200.0, color: '#06B6D4', icon: 'TrendingUp' },
];

const DEMO_CARDS: CreditCardItem[] = [
  { id: 'card-1', name: 'XP Visa Infinite', bank: 'XP Investimentos', brand: 'VISA', limit: 30000, limitTotal: 30000, limitUsed: 4320.5, closingDay: 28, dueDay: 10, color: '#0B0F17' },
  { id: 'card-2', name: 'Nubank Mastercard Black', bank: 'Nubank', brand: 'MASTERCARD', limit: 18000, limitTotal: 18000, limitUsed: 3890.0, closingDay: 20, dueDay: 5, color: '#8B5CF6' },
];

const DEMO_SALARY_CONTRACTS: SalaryContract[] = [
  {
    id: 'sal-1',
    employer: 'Fintech Solutions S.A.',
    companyName: 'Fintech Solutions S.A.',
    role: 'Engenheiro de Software Sênior',
    roleTitle: 'Engenheiro de Software Sênior',
    contractType: 'CLT',
    paymentSchedule: 'QUINZENAL',
    paymentDay: 5,
    firstPaymentDay: 20,
    firstPaymentPercent: 40,
    secondPaymentDay: 5,
    secondPaymentPercent: 60,
    currentGrossAmount: 19500,
    currentNetAmount: 14500,
    baseAmount: 14500,
    startDate: '2023-04-01',
    isActive: true,
    active: true,
    history: [
      { id: 'adj-1', effectiveDate: '2026-04-01', newAmount: 14500, grossAmount: 19500, netAmount: 14500, reason: 'Promoção', title: 'Promoção Sênior II' },
    ],
    adjustments: [
      { id: 'adj-1', effectiveDate: '2026-04-01', newAmount: 14500, grossAmount: 19500, netAmount: 14500, reason: 'Promoção', title: 'Promoção Sênior II' },
    ],
  },
];

const DEMO_CHECKPOINTS: FinancialCheckpoint[] = [
  {
    id: 'cp-1',
    title: 'Marco Inicial de Fechamento',
    label: 'Marco Inicial de Fechamento',
    createdAt: '2026-09-01T00:00:00Z',
    startDate: '2026-09-01',
    date: '2026-09-01',
    initialBalance: 107771.1,
    creditCardDebt: 8210.5,
    totalAssets: 107771.1,
    totalLiabilities: 8210.5,
    netWorth: 99560.6,
    initialNetWorth: 99560.6,
    isActive: true,
  },
];

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [movements, setMovements] = useState<Movement[]>(DEMO_MOVEMENTS);
  const [natures, setNatures] = useState<ExpenseNature[]>(DEMO_NATURES);
  const [goals, setGoals] = useState<Goal[]>(DEMO_GOALS);
  const [accounts, setAccounts] = useState<BankAccount[]>(DEMO_ACCOUNTS);
  const [salaryContracts, setSalaryContracts] = useState<SalaryContract[]>(DEMO_SALARY_CONTRACTS);
  const [checkpoints, setCheckpoints] = useState<FinancialCheckpoint[]>(DEMO_CHECKPOINTS);
  const [cards, setCards] = useState<CreditCardItem[]>(DEMO_CARDS);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDataReady, setIsDataReady] = useState<boolean>(true);

  const activeCheckpoint = useMemo(() => {
    return checkpoints.find((c) => c.isActive) || checkpoints[0] || null;
  }, [checkpoints]);

  const refreshFinancialData = useCallback(async () => {
    if (!user || user.isGuest || !isSupabaseConfigured) {
      return;
    }

    try {
      setIsLoading(true);
      const [
        remoteMovements,
        remoteNatures,
        remoteGoals,
        remoteAccounts,
        remoteSalaries,
        remoteCheckpoints,
        remoteMethods,
      ] = await Promise.all([
        SupabaseMobileService.getMovements(),
        SupabaseMobileService.getNatures(),
        SupabaseMobileService.getGoals(),
        SupabaseMobileService.getAccounts(),
        SupabaseMobileService.getSalaryContracts(),
        SupabaseMobileService.getCheckpoints(),
        SupabaseMobileService.getPaymentMethods(),
      ]);

      if (remoteMovements && remoteMovements.length > 0) setMovements(remoteMovements);
      if (remoteNatures && remoteNatures.length > 0) setNatures(remoteNatures);
      if (remoteGoals && remoteGoals.length > 0) setGoals(remoteGoals);
      if (remoteAccounts && remoteAccounts.length > 0) setAccounts(remoteAccounts);
      if (remoteSalaries && remoteSalaries.length > 0) setSalaryContracts(remoteSalaries);
      if (remoteCheckpoints && remoteCheckpoints.length > 0) setCheckpoints(remoteCheckpoints);
      if (remoteMethods && remoteMethods.length > 0) setPaymentMethods(remoteMethods);
    } catch (err) {
      console.warn('Erro ao atualizar dados financeiros do Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshFinancialData();
  }, [refreshFinancialData]);

  // ==========================================
  // Ações de Movimentações
  // ==========================================
  const addMovement = async (item: Omit<Movement, 'id'>) => {
    const tempId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newMovement: Movement = { ...item, id: tempId };
    setMovements((prev) => [newMovement, ...prev]);

    if (user && !user.isGuest && isSupabaseConfigured) {
      const created = await SupabaseMobileService.addMovement(item);
      if (created) {
        setMovements((prev) => prev.map((m) => (m.id === tempId ? { ...m, id: created.id } : m)));
      }
    }
  };

  const updateMovement = async (id: string, updates: Partial<Movement>) => {
    setMovements((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
    if (user && !user.isGuest && isSupabaseConfigured && !id.startsWith('demo-')) {
      await SupabaseMobileService.updateMovement(id, updates);
    }
  };

  const deleteMovement = async (id: string) => {
    setMovements((prev) => prev.filter((m) => m.id !== id));
    if (user && !user.isGuest && isSupabaseConfigured && !id.startsWith('demo-')) {
      await SupabaseMobileService.deleteMovement(id);
    }
  };

  const toggleMovementStatus = async (id: string) => {
    let nextStatus: MovementStatus = 'REALIZADA';
    setMovements((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          nextStatus = m.status === 'PREVISTA' ? 'REALIZADA' : 'PREVISTA';
          return { ...m, status: nextStatus };
        }
        return m;
      })
    );
    if (user && !user.isGuest && isSupabaseConfigured && !id.startsWith('demo-')) {
      await SupabaseMobileService.updateMovement(id, { status: nextStatus });
    }
  };

  const prepayInstallments = async (
    itemsOrIds: PrepayItem[] | string[],
    discountedAmounts?: Record<string, number>,
    paymentDate?: string
  ) => {
    const payDate = paymentDate || new Date().toISOString().split('T')[0];

    if (Array.isArray(itemsOrIds) && itemsOrIds.length > 0 && typeof itemsOrIds[0] === 'object') {
      const prepayItems = itemsOrIds as PrepayItem[];
      setMovements((prev) =>
        prev.map((m) => {
          const matched = prepayItems.find((p) => p.id === m.id);
          if (matched) {
            const updated: Movement = {
              ...m,
              status: 'REALIZADA',
              amount: matched.discountedAmount,
              dueDate: payDate,
              notes: `${m.notes ? m.notes + ' • ' : ''}Liquidado com economia de R$ ${matched.discountAmount.toFixed(2)}`,
            };
            if (user && !user.isGuest && isSupabaseConfigured && !m.id.startsWith('demo-')) {
              SupabaseMobileService.updateMovement(m.id, {
                status: 'REALIZADA',
                amount: matched.discountedAmount,
                dueDate: payDate,
                notes: updated.notes,
              });
            }
            return updated;
          }
          return m;
        })
      );
    } else {
      const ids = itemsOrIds as string[];
      setMovements((prev) =>
        prev.map((m) => {
          if (ids.includes(m.id)) {
            const actualPaid = discountedAmounts && discountedAmounts[m.id] !== undefined ? discountedAmounts[m.id] : m.amount;
            const economy = Math.max(0, m.amount - actualPaid);
            const updated: Movement = {
              ...m,
              status: 'REALIZADA',
              amount: actualPaid,
              dueDate: payDate,
              notes: `${m.notes ? m.notes + ' • ' : ''}Liquidado com desconto de R$ ${economy.toFixed(2)}`,
            };
            if (user && !user.isGuest && isSupabaseConfigured && !m.id.startsWith('demo-')) {
              SupabaseMobileService.updateMovement(m.id, {
                status: 'REALIZADA',
                amount: actualPaid,
                dueDate: payDate,
                notes: updated.notes,
              });
            }
            return updated;
          }
          return m;
        })
      );
    }
  };

  // ==========================================
  // Ações de Naturezas
  // ==========================================
  const addNature = async (natureData: Omit<ExpenseNature, 'id' | 'mappings'>) => {
    const tempId = `nat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newNature: ExpenseNature = {
      ...natureData,
      id: tempId,
      mappings: [],
      overCeilingJustification: '',
      justificationHistory: [],
    };
    setNatures((prev) => [...prev, newNature]);

    if (user && !user.isGuest && isSupabaseConfigured) {
      const created = await SupabaseMobileService.addNature(newNature);
      if (created) {
        setNatures((prev) => prev.map((n) => (n.id === tempId ? { ...n, id: created.id } : n)));
      }
    }
  };

  const updateNature = async (id: string, updates: Partial<ExpenseNature>) => {
    setNatures((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
    if (user && !user.isGuest && isSupabaseConfigured && !id.startsWith('nat-')) {
      await SupabaseMobileService.updateNature(id, updates);
    }
  };

  const deleteNature = async (id: string) => {
    setNatures((prev) => prev.filter((n) => n.id !== id));
    if (user && !user.isGuest && isSupabaseConfigured && !id.startsWith('nat-')) {
      await SupabaseMobileService.deleteNature(id);
    }
  };

  // ==========================================
  // Ações de Metas
  // ==========================================
  const addGoal = async (goalData: Omit<Goal, 'id'>) => {
    const tempId = `goal_${Date.now()}`;
    const newGoal: Goal = { ...goalData, id: tempId };
    setGoals((prev) => [...prev, newGoal]);

    if (user && !user.isGuest && isSupabaseConfigured) {
      const created = await SupabaseMobileService.addGoal(goalData);
      if (created) {
        setGoals((prev) => prev.map((g) => (g.id === tempId ? { ...g, id: created.id } : g)));
      }
    }
  };

  const updateGoal = async (id: string, updates: Partial<Goal>) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
    if (user && !user.isGuest && isSupabaseConfigured && !id.startsWith('goal-')) {
      await SupabaseMobileService.updateGoal(id, updates);
    }
  };

  const deleteGoal = async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (user && !user.isGuest && isSupabaseConfigured && !id.startsWith('goal-')) {
      await SupabaseMobileService.deleteGoal(id);
    }
  };

  // ==========================================
  // Ações de Contratos de Salário
  // ==========================================
  const upsertSalaryContract = async (contract: SalaryContract) => {
    setSalaryContracts((prev) => {
      const exists = prev.some((c) => c.id === contract.id);
      return exists ? prev.map((c) => (c.id === contract.id ? contract : c)) : [contract, ...prev];
    });
    if (user && !user.isGuest && isSupabaseConfigured) {
      await SupabaseMobileService.upsertSalaryContract(contract);
    }
  };

  const addSalaryContract = async (contract: Omit<SalaryContract, 'id'>) => {
    const tempId = `sal_${Date.now()}`;
    const newContract: SalaryContract = { ...contract, id: tempId, isActive: true, active: true };
    await upsertSalaryContract(newContract);
  };

  const updateSalaryContract = async (id: string, updates: Partial<SalaryContract>) => {
    const target = salaryContracts.find((c) => c.id === id);
    if (target) {
      await upsertSalaryContract({ ...target, ...updates });
    }
  };

  const deleteSalaryContract = async (id: string) => {
    setSalaryContracts((prev) => prev.filter((c) => c.id !== id));
    if (user && !user.isGuest && isSupabaseConfigured && !id.startsWith('sal-')) {
      await SupabaseMobileService.deleteSalaryContract(id);
    }
  };

  const addSalaryAdjustment = async (contractId: string, adj: Omit<SalaryAdjustment, 'id'>) => {
    const target = salaryContracts.find((c) => c.id === contractId);
    if (!target) return;
    const newAdj: SalaryAdjustment = { ...adj, id: `adj_${Date.now()}` };
    const history = target.history ? [newAdj, ...target.history] : [newAdj];
    const adjustments = target.adjustments ? [newAdj, ...target.adjustments] : [newAdj];
    await upsertSalaryContract({
      ...target,
      currentNetAmount: adj.newAmount || target.currentNetAmount,
      baseAmount: adj.newAmount || target.baseAmount,
      history,
      adjustments,
    });
  };

  const deleteSalaryAdjustment = async (contractId: string, adjustmentId: string) => {
    const target = salaryContracts.find((c) => c.id === contractId);
    if (!target) return;
    const history = (target.history || []).filter((a) => a.id !== adjustmentId);
    const adjustments = (target.adjustments || []).filter((a) => a.id !== adjustmentId);
    await upsertSalaryContract({ ...target, history, adjustments });
  };

  // ==========================================
  // Ações de Contas Bancárias e Cartões
  // ==========================================
  const upsertAccount = async (account: BankAccount) => {
    setAccounts((prev) => {
      const exists = prev.some((a) => a.id === account.id);
      return exists ? prev.map((a) => (a.id === account.id ? account : a)) : [account, ...prev];
    });
    if (user && !user.isGuest && isSupabaseConfigured) {
      await SupabaseMobileService.upsertAccount(account);
    }
  };

  const addAccount = async (account: Omit<BankAccount, 'id'>) => {
    const tempId = `acc_${Date.now()}`;
    const newAcc: BankAccount = { ...account, id: tempId };
    await upsertAccount(newAcc);
  };

  const deleteAccount = async (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    if (user && !user.isGuest && isSupabaseConfigured && !id.startsWith('acc-')) {
      await SupabaseMobileService.deleteAccount(id);
    }
  };

  const addCard = async (card: Omit<CreditCardItem, 'id'>) => {
    const tempId = `card_${Date.now()}`;
    const newCard: CreditCardItem = { ...card, id: tempId };
    setCards((prev) => [newCard, ...prev]);
  };

  const deleteCard = async (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  // ==========================================
  // Ações de Checkpoints
  // ==========================================
  const upsertCheckpoint = async (cp: FinancialCheckpoint) => {
    setCheckpoints((prev) => {
      const exists = prev.some((c) => c.id === cp.id);
      return exists ? prev.map((c) => (c.id === cp.id ? cp : c)) : [cp, ...prev];
    });
    if (user && !user.isGuest && isSupabaseConfigured) {
      await SupabaseMobileService.upsertCheckpoint(cp);
    }
  };

  const activateCheckpoint = async (id: string) => {
    setCheckpoints((prev) =>
      prev.map((c) => ({
        ...c,
        isActive: c.id === id,
      }))
    );
    const target = checkpoints.find((c) => c.id === id);
    if (target && user && !user.isGuest && isSupabaseConfigured) {
      await SupabaseMobileService.upsertCheckpoint({ ...target, isActive: true });
    }
  };

  const addCheckpoint = async (cp: Omit<FinancialCheckpoint, 'id'>) => {
    const tempId = `cp_${Date.now()}`;
    const newCp: FinancialCheckpoint = { ...cp, id: tempId, isActive: true };
    setCheckpoints((prev) => [newCp, ...prev.map((c) => ({ ...c, isActive: false }))]);
    if (user && !user.isGuest && isSupabaseConfigured) {
      await SupabaseMobileService.upsertCheckpoint(newCp);
    }
  };

  const deleteCheckpoint = async (id: string) => {
    setCheckpoints((prev) => prev.filter((c) => c.id !== id));
    if (user && !user.isGuest && isSupabaseConfigured && !id.startsWith('cp-')) {
      await SupabaseMobileService.deleteCheckpoint(id);
    }
  };

  // ==========================================
  // Métricas Calculadas
  // ==========================================
  const totals = useMemo(() => {
    return movements.reduce(
      (acc, cur) => {
        if (cur.type === 'RECEBER' || cur.type === 'RECEITA') {
          acc.receitas += cur.amount;
        } else if (cur.type === 'PAGAR' || cur.type === 'DESPESA') {
          acc.despesas += cur.amount;
        } else if (cur.type === 'EMPRESTIMO') {
          acc.totalEmprestimos += cur.amount;
          acc.despesas += cur.amount;
        } else if (cur.type === 'CARTAO') {
          acc.totalFaturas += cur.amount;
          acc.despesas += cur.amount;
        }
        return acc;
      },
      { receitas: 0, despesas: 0, saldoPrevisto: 0, totalEmprestimos: 0, totalFaturas: 0 }
    );
  }, [movements]);

  totals.saldoPrevisto = totals.receitas - totals.despesas;

  return (
    <FinancialContext.Provider
      value={{
        movements,
        natures,
        goals,
        accounts,
        salaryContracts,
        checkpoints,
        activeCheckpoint,
        cards,
        paymentMethods,
        isLoading,
        isDataReady,
        refreshFinancialData,

        addMovement,
        updateMovement,
        deleteMovement,
        toggleMovementStatus,
        prepayInstallments,

        addNature,
        updateNature,
        deleteNature,

        addGoal,
        updateGoal,
        deleteGoal,

        upsertSalaryContract,
        addSalaryContract,
        updateSalaryContract,
        deleteSalaryContract,
        addSalaryAdjustment,
        deleteSalaryAdjustment,

        upsertAccount,
        addAccount,
        deleteAccount,
        addCard,
        deleteCard,

        upsertCheckpoint,
        activateCheckpoint,
        addCheckpoint,
        deleteCheckpoint,

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
