import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { SupabaseService } from '../services/supabaseService';
import { useAuth } from './AuthContext';
import type {
  Movement,
  MovementStatus,
  CriticalEvent,
  Goal,
  SimulationScenario,
  BankAccount,
  CopilotMessage,
  CopilotInteractiveOption,
  CopilotPendingConfirmation,
  SimulationPresetId,
  SimulationVerdict,
  CustomScenarioInput,
  FutureScenarioResult,
  MonthlyProjectionPoint,
  ExpenseNature,
  FixedExpenseMapping,
  MappingItem,
  CeilingJustificationRecord,
  ReceiptReconciliationData,
  CreditCardItem,
  PaymentMethodItem,
  BankInstitution,
  SalaryContract,
  SalaryAdjustment,
  FinancialCheckpoint,
  MonthlyClosing,
  TrackingScopeMode,
  SharedScenario,
  SharedSettlementItem,
} from '../types';
import { recognizeImageOCR } from '../services/ocrService';
import { learnReceiptItemAssociation } from '../services/receiptMemoryService';
import {
  DEMO_ACCOUNTS,
  DEMO_MOVEMENTS,
  DEMO_GOALS,
  DEMO_NATURES,
  DEMO_CARDS,
  DEMO_PAYMENT_METHODS,
  DEMO_BANKS,
  DEMO_SALARY_CONTRACTS,
} from '../utils/demoData';

interface FinancialContextType {
  // Estado
  isDataReady: boolean;   // true quando dados do Supabase (ou DEMO) já foram carregados
  accounts: BankAccount[];
  cards: CreditCardItem[];
  paymentMethods: PaymentMethodItem[];
  banks: BankInstitution[];
  salaryContracts: SalaryContract[];
  movements: Movement[];
  goals: Goal[];
  criticalEvents: CriticalEvent[];
  chatHistory: CopilotMessage[];
  natures: ExpenseNature[];

  // Marco de Acompanhamento Financeiro
  checkpoints: FinancialCheckpoint[];
  activeCheckpoint: FinancialCheckpoint | null;
  addCheckpoint: (cp: Omit<FinancialCheckpoint, 'id' | 'createdAt' | 'isActive'>) => void;
  activateCheckpoint: (id: string) => void;
  deleteCheckpoint: (id: string) => void;

  // Fechamentos Mensais de Competência
  monthlyClosings: MonthlyClosing[];
  closeMonth: (monthKey: string, closingBalance: number, projectedBalance: number, notes?: string) => void;
  reopenMonth: (monthKey: string) => void;
  getMonthlyClosing: (monthKey: string) => MonthlyClosing | undefined;


  // Métricas Calculadas
  totalNetWorth: number;
  availableBalance: number;
  monthlyFreeCashflow: number;
  emergencyReserveMonths: number;
  emergencyReserveAmount: number;

  forecast30d: {
    income: number;
    expenses: number;
    net: number;
    projectedBalance: number;
  };

  nextCriticalEvent: CriticalEvent | null;

  // Gestão de Contas, Cartões, Pagamentos e Bancos
  addAccount: (account: Omit<BankAccount, 'id'>) => void;
  updateAccount: (id: string, updates: Partial<BankAccount>) => void;
  deleteAccount: (id: string) => void;

  addCard: (card: Omit<CreditCardItem, 'id'>) => void;
  updateCard: (id: string, updates: Partial<CreditCardItem>) => void;
  deleteCard: (id: string) => void;

  addPaymentMethod: (method: Omit<PaymentMethodItem, 'id'>) => void;
  updatePaymentMethod: (id: string, updates: Partial<PaymentMethodItem>) => void;
  deletePaymentMethod: (id: string) => void;

  addBank: (bank: Omit<BankInstitution, 'id'>) => void;
  updateBank: (id: string, updates: Partial<BankInstitution>) => void;
  deleteBank: (id: string) => void;

  // Gestão de Salários & Evolução Salarial
  addSalaryContract: (contract: Omit<SalaryContract, 'id' | 'history'> & { initialAdjustment?: Omit<SalaryAdjustment, 'id'> }) => void;
  updateSalaryContract: (id: string, updates: Partial<SalaryContract>) => void;
  deleteSalaryContract: (id: string) => void;
  addSalaryAdjustment: (contractId: string, adjustment: Omit<SalaryAdjustment, 'id'>) => void;
  updateSalaryAdjustment: (contractId: string, adjustmentId: string, updates: Partial<SalaryAdjustment>) => void;
  deleteSalaryAdjustment: (contractId: string, adjustmentId: string) => void;
  getSalaryForCompetence: (monthKey: string) => number;

  // Ações Principais
  addMovement: (movement: Omit<Movement, 'id'>) => void;
  addMultipleMovements: (items: Omit<Movement, 'id'>[]) => void;
  updateMovement: (id: string, updates: Partial<Movement>) => void;
  deleteMovement: (id: string) => void;
  toggleMovementStatus: (id: string) => void;
  prepayInstallments: (movementIds: string[], discountedAmounts: Record<string, number>, paymentDate: string) => void;
  addGoal: (goal: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  runSimulation: (preset: SimulationPresetId) => SimulationScenario;
  simulateCustomFutureScenario: (input: CustomScenarioInput) => FutureScenarioResult;
  applyScenarioToBudget: (result: FutureScenarioResult) => void;
  sendMessageToCopilot: (query: string, attachment?: { url: string; name: string; size?: string; revoke?: () => void }) => void;
  respondToCopilotOption: (messageId: string, option: CopilotInteractiveOption) => void;
  reconcileReceiptData: (messageId: string, data: ReceiptReconciliationData) => void;
  exportToCSV: () => void;

  // Gestão de Naturezas & Mapeamentos de Gastos Fixos
  addNature: (nature: Omit<ExpenseNature, 'id' | 'mappings'> & { mappings?: FixedExpenseMapping[] }) => string;
  updateNature: (id: string, updates: Partial<ExpenseNature>) => void;
  deleteNature: (id: string) => void;
  addMappingToNature: (natureId: string, name: string, applicableMonths?: number[], dayOfMonth?: number, icon?: string) => string;
  updateMapping: (natureId: string, mappingId: string, updates: Partial<FixedExpenseMapping>) => void;
  deleteMapping: (natureId: string, mappingId: string) => void;
  addItemToMapping: (natureId: string, mappingId: string, item: Omit<MappingItem, 'id' | 'totalValue'>, customId?: string) => string;
  updateMappingItem: (natureId: string, mappingId: string, itemId: string, updates: Partial<MappingItem>) => void;
  deleteMappingItem: (natureId: string, mappingId: string, itemId: string) => void;
  toggleItemFulfilled: (natureId: string, mappingId: string, itemId: string) => void;
  markMappingItemsFulfilled: (itemsToFulfill: Array<{ natureId: string; mappingId: string; itemId: string; realizedValue?: number }>) => void;
  saveCeilingJustification: (natureId: string, reason: string) => void;
  loadSuggestedMappingsForNature: (natureId: string) => void;
  getNatureCeiling: (nature: ExpenseNature) => number;
  getNatureSpent: (nature: ExpenseNature) => number;
  getNatureMissingItems: (nature: ExpenseNature) => Array<{ item: MappingItem; mappingName: string; missingAmount: number }>;

  // Acompanhamento Mútuo & Planejamento Compartilhado
  activeTrackingScope: TrackingScopeMode;
  defaultTrackingScope: TrackingScopeMode;
  setActiveTrackingScope: (scope: TrackingScopeMode) => void;
  setDefaultTrackingScope: (scope: TrackingScopeMode) => void;
  sharedScenario: SharedScenario | null;
  updateSharedScenario: (updates: Partial<SharedScenario>) => void;
  sharedSettlements: SharedSettlementItem[];
  addSharedSettlement: (item: Omit<SharedSettlementItem, 'id'>) => void;
  toggleSharedSettlementStatus: (id: string) => void;
  settleAllSharedDebts: () => void;
}


// Função Geradora de Mapeamentos Sugeridos para uma Natureza (Alimentação, Moradia, Transporte, etc)
export const buildSuggestedMappingsForNature = (
  natureId: string,
  natureName: string,
  icon?: string
): FixedExpenseMapping[] => {
  const natName = (natureName || '').toLowerCase();
  const isAlimentacao =
    natName.includes('aliment') ||
    natName.includes('mercado') ||
    natName.includes('padaria') ||
    natName.includes('feira') ||
    natName.includes('refeiç');

  const isMoradia =
    natName.includes('moradia') ||
    natName.includes('casa') ||
    natName.includes('habit') ||
    natName.includes('imóvel') ||
    natName.includes('imovel');

  const isTransporte =
    natName.includes('transporte') ||
    natName.includes('veículo') ||
    natName.includes('veiculo') ||
    natName.includes('carro') ||
    natName.includes('moto');

  const timestamp = Date.now();

  if (isAlimentacao) {
    return [
      {
        id: `map_${timestamp}_mercado`,
        name: 'Supermercado Base Mensal (Estoque Seco & Limpeza)',
        natureId,
        icon: '🛒',
        applicableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        frequency: 'MENSAL',
        dayOfMonth: 7,
        items: [
          { id: `item_${timestamp}_1`, description: 'Arroz Nobre Tipo 1 (5kg)', quantity: 2, price: 34.0, multiplierWeeks: 1, totalValue: 68.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_2`, description: 'Feijão Carioca (1kg)', quantity: 4, price: 8.5, multiplierWeeks: 1, totalValue: 34.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_3`, description: 'Azeite de Oliva Extra Virgem 500ml', quantity: 2, price: 46.0, multiplierWeeks: 1, totalValue: 92.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_4`, description: 'Café Especial Torrado em Grãos (500g)', quantity: 3, price: 28.0, multiplierWeeks: 1, totalValue: 84.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_5`, description: 'Laticínios, Queijos & Manteiga', quantity: 1, price: 160.0, multiplierWeeks: 1, totalValue: 160.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_6`, description: 'Produtos de Limpeza & Higiene Pessoal', quantity: 1, price: 210.0, multiplierWeeks: 1, totalValue: 210.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
        ],
      },
      {
        id: `map_${timestamp}_feira`,
        name: 'Feira Livre & Hortifrúti (Rotina Semanal)',
        natureId,
        icon: '🥦',
        applicableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        frequency: 'SEMANAL',
        dayOfWeek: 'Sábado',
        items: [
          { id: `item_${timestamp}_7`, description: 'Frutas da Estação (Maçã, Banana, Uva, Mamão)', quantity: 1, price: 65.0, multiplierWeeks: 4, totalValue: 260.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'PIX' },
          { id: `item_${timestamp}_8`, description: 'Verduras & Legumes Orgânicos da Semana', quantity: 1, price: 45.0, multiplierWeeks: 4, totalValue: 180.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'PIX' },
          { id: `item_${timestamp}_9`, description: 'Ovos Caipiras Orgânicos (Cartela 30 un)', quantity: 1, price: 28.0, multiplierWeeks: 2, totalValue: 56.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'PIX' },
        ],
      },
      {
        id: `map_${timestamp}_proteinas`,
        name: 'Açougue & Proteínas Nobres',
        natureId,
        icon: '🥩',
        applicableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        frequency: 'QUINZENAL',
        dayOfWeek: 'Sábado',
        items: [
          { id: `item_${timestamp}_10`, description: 'Peito de Frango & Filé de Coxa (kg)', quantity: 4, price: 26.0, multiplierWeeks: 4, totalValue: 416.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_11`, description: 'Carnes Vermelhas de Primeira (Alcatra/Patinho)', quantity: 3, price: 54.0, multiplierWeeks: 2, totalValue: 324.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_12`, description: 'Peixes & Frutos do Mar', quantity: 2, price: 65.0, multiplierWeeks: 1, totalValue: 130.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
        ],
      },
    ];
  }

  if (isMoradia) {
    return [
      {
        id: `map_${timestamp}_moradia`,
        name: 'Contas Fixas & Concessionárias',
        natureId,
        icon: '💡',
        applicableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        frequency: 'MENSAL',
        dayOfMonth: 10,
        items: [
          { id: `item_${timestamp}_1`, description: 'Energia Elétrica (Coelba / Enel)', quantity: 1, price: 250.0, multiplierWeeks: 1, totalValue: 250.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'BOLETO' },
          { id: `item_${timestamp}_2`, description: 'Água & Saneamento Básico', quantity: 1, price: 90.0, multiplierWeeks: 1, totalValue: 90.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'BOLETO' },
          { id: `item_${timestamp}_3`, description: 'Internet Residencial Fibra Óptica', quantity: 1, price: 120.0, multiplierWeeks: 1, totalValue: 120.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'BOLETO' },
        ],
      },
    ];
  }

  if (isTransporte) {
    return [
      {
        id: `map_${timestamp}_transporte`,
        name: 'Combustível & Manutenção',
        natureId,
        icon: '⛽',
        applicableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        frequency: 'MENSAL',
        dayOfMonth: 15,
        items: [
          { id: `item_${timestamp}_1`, description: 'Combustível Mensal (Gasolina/Etanol)', quantity: 4, price: 120.0, multiplierWeeks: 1, totalValue: 480.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_2`, description: 'Reserva para Manutenção & Troca de Óleo', quantity: 1, price: 150.0, multiplierWeeks: 1, totalValue: 150.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CONTA' },
        ],
      },
    ];
  }

  return [
    {
      id: `map_${timestamp}_base`,
      name: `Despesas Previstas de ${natureName}`,
      natureId,
      icon: icon || '📋',
      applicableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      frequency: 'MENSAL',
      dayOfMonth: 10,
      items: [
        { id: `item_${timestamp}_1`, description: `Item Base de ${natureName}`, quantity: 1, price: 100.0, multiplierWeeks: 1, totalValue: 100.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'PIX' },
      ],
    },
  ];
};

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Se o usuário está autenticado na nuvem via Supabase, a fonte de verdade é a sua conta real
  const isCloudUser = !!user && !user.isGuest;

  // Flag que indica se os dados já foram carregados da nuvem.
  // Enquanto false, o dashboard não deve renderizar valores (evita flash de DEMO).
  const [isDataReady, setIsDataReady] = useState(!isCloudUser); // guest = já pronto

  // Contas Bancárias (armazenadas por usuário)
  const [accounts, setAccounts] = useState<BankAccount[]>(() => {
    if (isCloudUser && user) {
      try {
        const saved = localStorage.getItem(`balder_accounts_${user.$id}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return DEMO_ACCOUNTS;
  });

  // Cartões de Crédito (armazenados por usuário)
  const [cards, setCards] = useState<CreditCardItem[]>(() => {
    if (isCloudUser && user) {
      try {
        const saved = localStorage.getItem(`balder_cards_${user.$id}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return DEMO_CARDS;
  });

  // Formas de Pagamento (armazenadas por usuário)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>(() => {
    if (isCloudUser && user) {
      try {
        const saved = localStorage.getItem(`balder_payment_methods_${user.$id}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return DEMO_PAYMENT_METHODS;
  });

  // Bancos / Instituições (armazenados por usuário)
  const [banks, setBanks] = useState<BankInstitution[]>(() => {
    if (isCloudUser && user) {
      try {
        const saved = localStorage.getItem(`balder_banks_${user.$id}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return DEMO_BANKS;
  });

  // Contratos de Salário / Fontes de Renda (armazenados por usuário)
  const [salaryContracts, setSalaryContracts] = useState<SalaryContract[]>(() => {
    if (isCloudUser && user) {
      try {
        const saved = localStorage.getItem(`balder_salaries_${user.$id}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return DEMO_SALARY_CONTRACTS;
  });

  // Marcos de Acompanhamento Financeiro
  const [checkpoints, setCheckpoints] = useState<FinancialCheckpoint[]>(() => {
    try {
      const savedUser = user ? localStorage.getItem(`balder_checkpoints_${user.$id}`) : null;
      if (savedUser) return JSON.parse(savedUser);
      const savedGuest = localStorage.getItem('balder_checkpoints_guest');
      if (savedGuest) return JSON.parse(savedGuest);
    } catch {}
    return [];
  });

  // Checkpoint ativo (o único com isActive = true, ou null se ainda não configurado)
  const activeCheckpoint = useMemo(
    () => checkpoints.find((cp) => cp.isActive) ?? null,
    [checkpoints]
  );

  // Persistência dos checkpoints (apenas salva quando houver checkpoints definidos, evitando sobrescrita por array vazio)
  useEffect(() => {
    if (user && !user.isGuest && checkpoints.length > 0) {
      localStorage.setItem(`balder_checkpoints_${user.$id}`, JSON.stringify(checkpoints));
    }
  }, [checkpoints, user]);

  // Adicionar novo checkpoint (desativa todos os anteriores)
  const addCheckpoint = (cp: Omit<FinancialCheckpoint, 'id' | 'createdAt' | 'isActive'>) => {
    const newCp: FinancialCheckpoint = {
      ...cp,
      id: `cp_${Date.now()}`,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    setCheckpoints((prev) => {
      const next = [...prev.map((c) => ({ ...c, isActive: false })), newCp];
      const storageKey = user && !user.isGuest ? `balder_checkpoints_${user.$id}` : 'balder_checkpoints_guest';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Erro ao salvar checkpoint:', e);
      }
      return next;
    });

    if (user && !user.isGuest) {
      SupabaseService.upsertCheckpoint(newCp).catch(console.error);
    }
  };

  // Ativar um checkpoint existente pelo ID
  const activateCheckpoint = (id: string) => {
    setCheckpoints((prev) => {
      const next = prev.map((c) => ({ ...c, isActive: c.id === id }));
      const storageKey = user && !user.isGuest ? `balder_checkpoints_${user.$id}` : 'balder_checkpoints_guest';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Erro ao ativar checkpoint:', e);
      }
      if (user && !user.isGuest) {
        next.forEach((c) => {
          SupabaseService.upsertCheckpoint(c).catch(console.error);
        });
      }
      return next;
    });
  };

  // Excluir um checkpoint existente pelo ID
  const deleteCheckpoint = (id: string) => {
    setCheckpoints((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (!next.some((c) => c.isActive) && next.length > 0) {
        next[next.length - 1].isActive = true;
      }
      const storageKey = user && !user.isGuest ? `balder_checkpoints_${user.$id}` : 'balder_checkpoints_guest';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Erro ao excluir checkpoint:', e);
      }
      if (user && !user.isGuest) {
        SupabaseService.deleteCheckpoint(id).catch(console.error);
        const activeOne = next.find((c) => c.isActive);
        if (activeOne) {
          SupabaseService.upsertCheckpoint(activeOne).catch(console.error);
        }
      }
      return next;
    });
  };

  // Fechamentos Mensais de Competência (Reconciliação e carryover de saldo)
  const [monthlyClosings, setMonthlyClosings] = useState<MonthlyClosing[]>(() => {
    try {
      const savedUser = user ? localStorage.getItem(`balder_monthly_closings_${user.$id}`) : null;
      if (savedUser) return JSON.parse(savedUser);
      const savedGuest = localStorage.getItem('balder_monthly_closings_guest');
      if (savedGuest) return JSON.parse(savedGuest);
    } catch {}
    return [];
  });

  // Persistência de fechamentos mensais
  useEffect(() => {
    if (user && !user.isGuest && monthlyClosings.length > 0) {
      localStorage.setItem(`balder_monthly_closings_${user.$id}`, JSON.stringify(monthlyClosings));
    }
  }, [monthlyClosings, user]);

  const closeMonth = (
    monthKey: string,
    closingBalance: number,
    projectedBalance: number,
    notes?: string
  ) => {
    const newClosing: MonthlyClosing = {
      id: `closing_${monthKey}_${Date.now()}`,
      monthKey,
      closedAt: new Date().toISOString(),
      closingBalance,
      projectedBalance,
      adjustmentAmount: Math.round((closingBalance - projectedBalance) * 100) / 100,
      status: 'FECHADO',
      notes,
    };
    setMonthlyClosings((prev) => {
      const filtered = prev.filter((c) => c.monthKey !== monthKey);
      const next = [...filtered, newClosing];
      const storageKey =
        user && !user.isGuest ? `balder_monthly_closings_${user.$id}` : 'balder_monthly_closings_guest';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Erro ao salvar fechamento mensal:', e);
      }
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ monthlyClosings: next }).catch(console.error);
      }
      return next;
    });
  };

  const reopenMonth = (monthKey: string) => {
    setMonthlyClosings((prev) => {
      const next = prev.filter((c) => c.monthKey !== monthKey);
      const storageKey =
        user && !user.isGuest ? `balder_monthly_closings_${user.$id}` : 'balder_monthly_closings_guest';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Erro ao reabrir competência:', e);
      }
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ monthlyClosings: next }).catch(console.error);
      }
      return next;
    });
  };

  const getMonthlyClosing = (monthKey: string): MonthlyClosing | undefined => {
    return monthlyClosings.find((c) => c.monthKey === monthKey);
  };

  // -------------------------------------------------------------
  // Acompanhamento Mútuo & Planejamento Compartilhado
  // -------------------------------------------------------------
  // Preferência do Acompanhamento Principal (INDIVIDUAL ou COMPARTILHADO)
  const [defaultTrackingScope, setDefaultTrackingScopeState] = useState<TrackingScopeMode>(() => {
    try {
      const storageKey = user && !user.isGuest ? `balder_default_scope_${user.$id}` : 'balder_default_scope';
      const saved = localStorage.getItem(storageKey);
      if (saved === 'COMPARTILHADO' || saved === 'INDIVIDUAL') return saved;
    } catch {}
    return 'INDIVIDUAL';
  });

  // Escopo de Acompanhamento Ativo no Momento
  const [activeTrackingScope, setActiveTrackingScope] = useState<TrackingScopeMode>(() => defaultTrackingScope);

  const setDefaultTrackingScope = (scope: TrackingScopeMode) => {
    setDefaultTrackingScopeState(scope);
    const storageKey = user && !user.isGuest ? `balder_default_scope_${user.$id}` : 'balder_default_scope';
    try {
      localStorage.setItem(storageKey, scope);
    } catch {}
    if (user && !user.isGuest) {
      SupabaseService.saveUserProfileSettings({ defaultTrackingScope: scope }).catch(console.error);
    }
  };

  // Cenário de Planejamento Compartilhado
  const [sharedScenario, setSharedScenario] = useState<SharedScenario | null>(() => {
    try {
      const storageKey = user && !user.isGuest ? `balder_shared_scenario_${user.$id}` : 'balder_shared_scenario';
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}

    // Cenário padrão inicial inteligente
    return {
      id: 'shared_default',
      name: 'Planejamento Familiar & Casal',
      createdAt: new Date().toISOString(),
      inviteCode: 'BALDER-CASAL-7829',
      status: 'ACTIVE',
      members: [
        {
          id: user?.$id || 'user_owner',
          name: user?.name || 'Vinicius Mota Silva',
          email: user?.email || 'vinicius@balder.app',
          role: 'OWNER',
          status: 'ACTIVE',
          monthlyIncome: 8500,
          color: '#06b6d4',
          joinedAt: new Date().toISOString(),
        },
        {
          id: 'partner_1',
          name: 'Camila Silva',
          email: 'camila@email.com',
          role: 'PARTNER',
          status: 'ACTIVE',
          monthlyIncome: 5200,
          color: '#ec4899',
          joinedAt: new Date().toISOString(),
        },
      ],
      splitMode: 'PROPORTIONAL_INCOME',
      userSharePercent: 62,
      partnerSharePercent: 38,
      notes: 'Rateio proporcional calculado com base na renda líquida mensal de cada parceiro.',
    };
  });

  // Lista de Despesas e Acertos Mútuos Compartilhados
  const [sharedSettlements, setSharedSettlements] = useState<SharedSettlementItem[]>(() => {
    try {
      const storageKey = user && !user.isGuest ? `balder_shared_settlements_${user.$id}` : 'balder_shared_settlements';
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}

    const todayYm = new Date().toISOString().substring(0, 7);
    return [
      {
        id: 'settle_1',
        title: 'Supermercado Mensal (Compras Grandes)',
        category: 'Alimentação',
        totalAmount: 1450,
        paidBy: 'USER',
        splitMode: 'PROPORTIONAL_INCOME',
        userOwes: 899,
        partnerOwes: 551,
        date: `${todayYm}-05`,
        status: 'PENDENTE',
      },
      {
        id: 'settle_2',
        title: 'Energia Elétrica & Gás',
        category: 'Moradia',
        totalAmount: 380,
        paidBy: 'PARTNER',
        splitMode: 'PROPORTIONAL_INCOME',
        userOwes: 235.60,
        partnerOwes: 144.40,
        date: `${todayYm}-10`,
        status: 'PENDENTE',
      },
      {
        id: 'settle_3',
        title: 'Condomínio Residencial',
        category: 'Moradia',
        totalAmount: 650,
        paidBy: 'USER',
        splitMode: 'PROPORTIONAL_INCOME',
        userOwes: 403,
        partnerOwes: 247,
        date: `${todayYm}-15`,
        status: 'PENDENTE',
      },
      {
        id: 'settle_4',
        title: 'Internet Fibra 600MB',
        category: 'Moradia',
        totalAmount: 140,
        paidBy: 'PARTNER',
        splitMode: 'PROPORTIONAL_INCOME',
        userOwes: 86.80,
        partnerOwes: 53.20,
        date: `${todayYm}-20`,
        status: 'PENDENTE',
      },
    ];
  });

  const updateSharedScenario = (updates: Partial<SharedScenario>) => {
    setSharedScenario((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      const storageKey = user && !user.isGuest ? `balder_shared_scenario_${user.$id}` : 'balder_shared_scenario';
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ sharedScenario: updated }).catch(console.error);
      }
      return updated;
    });
  };

  const addSharedSettlement = (item: Omit<SharedSettlementItem, 'id'>) => {
    const newItem: SharedSettlementItem = {
      ...item,
      id: `settle_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    };
    setSharedSettlements((prev) => {
      const next = [newItem, ...prev];
      const storageKey = user && !user.isGuest ? `balder_shared_settlements_${user.$id}` : 'balder_shared_settlements';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ sharedSettlements: next }).catch(console.error);
      }
      return next;
    });
  };

  const toggleSharedSettlementStatus = (id: string) => {
    setSharedSettlements((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, status: (s.status === 'PENDENTE' ? 'ACERTADO' : 'PENDENTE') as 'PENDENTE' | 'ACERTADO' } : s));
      const storageKey = user && !user.isGuest ? `balder_shared_settlements_${user.$id}` : 'balder_shared_settlements';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ sharedSettlements: next }).catch(console.error);
      }
      return next;
    });
  };

  const settleAllSharedDebts = () => {
    setSharedSettlements((prev) => {
      const next = prev.map((s) => ({ ...s, status: 'ACERTADO' as const }));
      const storageKey = user && !user.isGuest ? `balder_shared_settlements_${user.$id}` : 'balder_shared_settlements';
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      if (user && !user.isGuest) {
        SupabaseService.saveUserProfileSettings({ sharedSettlements: next }).catch(console.error);
      }
      return next;
    });
  };

  // Movimentações Financeiras
  const [movements, setMovements] = useState<Movement[]>(() => (isCloudUser ? [] : DEMO_MOVEMENTS));

  // Metas Financeiras
  const [goals, setGoals] = useState<Goal[]>(() => (isCloudUser ? [] : DEMO_GOALS));

  // Naturezas Orçamentárias
  const [natures, setNatures] = useState<ExpenseNature[]>(() => {
    if (!isCloudUser) {
      try {
        const guestNatures = localStorage.getItem('balder_natures_guest');
        if (guestNatures) return JSON.parse(guestNatures);
      } catch {}
      return DEMO_NATURES;
    }
    if (user && !user.isGuest) {
      try {
        const userNatures = localStorage.getItem(`balder_natures_${user.$id}`);
        if (userNatures) return JSON.parse(userNatures);
      } catch {}
    }
    return [];
  });

  // Gestão de Contas Bancárias
  const addAccount = (accountData: Omit<BankAccount, 'id'>) => {
    const newAcc: BankAccount = {
      ...accountData,
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    };
    setAccounts((prev) => {
      const next = [...prev, newAcc];
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_accounts_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest) {
      SupabaseService.upsertAccount(newAcc).catch(console.error);
    }
  };

  const updateAccount = (id: string, updates: Partial<BankAccount>) => {
    let updatedAcc: BankAccount | null = null;
    setAccounts((prev) => {
      const next = prev.map((a) => {
        if (a.id === id) {
          updatedAcc = { ...a, ...updates };
          return updatedAcc;
        }
        return a;
      });
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_accounts_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest && updatedAcc) {
      SupabaseService.upsertAccount(updatedAcc).catch(console.error);
    }
  };

  const deleteAccount = (id: string) => {
    setAccounts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_accounts_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest) {
      SupabaseService.deleteAccount(id).catch(console.error);
    }
  };

  // Gestão de Cartões de Crédito
  const addCard = (cardData: Omit<CreditCardItem, 'id'>) => {
    const newCard: CreditCardItem = {
      ...cardData,
      id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    };
    setCards((prev) => {
      const next = [...prev, newCard];
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_cards_${user.$id}`, JSON.stringify(next));
        SupabaseService.saveUserProfileSettings({ cards: next }).catch(console.error);
      }
      return next;
    });
  };

  const updateCard = (id: string, updates: Partial<CreditCardItem>) => {
    setCards((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_cards_${user.$id}`, JSON.stringify(next));
        SupabaseService.saveUserProfileSettings({ cards: next }).catch(console.error);
      }
      return next;
    });
  };

  const deleteCard = (id: string) => {
    setCards((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_cards_${user.$id}`, JSON.stringify(next));
        SupabaseService.saveUserProfileSettings({ cards: next }).catch(console.error);
      }
      return next;
    });
  };

  // Gestão de Formas de Pagamento
  const addPaymentMethod = (methodData: Omit<PaymentMethodItem, 'id'>) => {
    const newMethod: PaymentMethodItem = {
      ...methodData,
      id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    };
    setPaymentMethods((prev) => {
      const next = [...prev, newMethod];
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_payment_methods_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest) {
      SupabaseService.upsertPaymentMethod(newMethod).catch(console.error);
    }
  };

  const updatePaymentMethod = (id: string, updates: Partial<PaymentMethodItem>) => {
    let updatedPm: PaymentMethodItem | null = null;
    setPaymentMethods((prev) => {
      const next = prev.map((pm) => {
        if (pm.id === id) {
          updatedPm = { ...pm, ...updates };
          return updatedPm;
        }
        return pm;
      });
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_payment_methods_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest && updatedPm) {
      SupabaseService.upsertPaymentMethod(updatedPm).catch(console.error);
    }
  };

  const deletePaymentMethod = (id: string) => {
    setPaymentMethods((prev) => {
      const next = prev.filter((pm) => pm.id !== id);
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_payment_methods_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest) {
      SupabaseService.deletePaymentMethod(id).catch(console.error);
    }
  };

  // Gestão de Bancos / Instituições
  const addBank = (bankData: Omit<BankInstitution, 'id'>) => {
    const newBank: BankInstitution = {
      ...bankData,
      id: `bank_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      syncedAt: bankData.syncedAt || 'Recém-adicionado',
    };
    setBanks((prev) => {
      const next = [...prev, newBank];
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_banks_${user.$id}`, JSON.stringify(next));
        SupabaseService.saveUserProfileSettings({ banks: next }).catch(console.error);
      }
      return next;
    });
  };

  const updateBank = (id: string, updates: Partial<BankInstitution>) => {
    setBanks((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, ...updates } : b));
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_banks_${user.$id}`, JSON.stringify(next));
        SupabaseService.saveUserProfileSettings({ banks: next }).catch(console.error);
      }
      return next;
    });
  };

  const deleteBank = (id: string) => {
    setBanks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_banks_${user.$id}`, JSON.stringify(next));
        SupabaseService.saveUserProfileSettings({ banks: next }).catch(console.error);
      }
      return next;
    });
  };

  // Gestão de Salários & Evolução Salarial
  const addSalaryContract = (data: Omit<SalaryContract, 'id' | 'history'> & { initialAdjustment?: Omit<SalaryAdjustment, 'id'> }) => {
    const contractId = `sal_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const history: SalaryAdjustment[] = [];

    if (data.initialAdjustment) {
      history.push({
        ...data.initialAdjustment,
        id: `adj_${Date.now()}_init`,
        percentageIncrease: 0,
      });
    } else {
      history.push({
        id: `adj_${Date.now()}_init`,
        effectiveDate: data.startDate.slice(0, 7),
        grossAmount: data.currentGrossAmount,
        netAmount: data.currentNetAmount,
        percentageIncrease: 0,
        reason: 'OUTRO',
        title: 'Admissão / Início do Contrato',
      });
    }

    const newContract: SalaryContract = {
      ...data,
      id: contractId,
      history,
    };

    setSalaryContracts((prev) => {
      const next = [...prev, newContract];
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_salaries_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest) {
      SupabaseService.upsertSalaryContract(newContract).catch(console.error);
    }
  };

  const updateSalaryContract = (id: string, updates: Partial<SalaryContract>) => {
    let updatedSc: SalaryContract | null = null;
    setSalaryContracts((prev) => {
      const next = prev.map((sc) => {
        if (sc.id === id) {
          updatedSc = { ...sc, ...updates };
          return updatedSc;
        }
        return sc;
      });
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_salaries_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest && updatedSc) {
      SupabaseService.upsertSalaryContract(updatedSc).catch(console.error);
    }
  };

  const deleteSalaryContract = (id: string) => {
    setSalaryContracts((prev) => {
      const next = prev.filter((sc) => sc.id !== id);
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_salaries_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest) {
      SupabaseService.deleteSalaryContract(id).catch(console.error);
    }
  };

  const addSalaryAdjustment = (contractId: string, adjustmentData: Omit<SalaryAdjustment, 'id'>) => {
    let targetContract: SalaryContract | null = null;
    setSalaryContracts((prev) => {
      const next = prev.map((sc) => {
        if (sc.id !== contractId) return sc;

        const sortedHistory = [...sc.history].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
        const previousAdj = sortedHistory.filter((a) => a.effectiveDate <= adjustmentData.effectiveDate).pop() || sortedHistory[sortedHistory.length - 1];

        let pct = adjustmentData.percentageIncrease;
        if (pct === undefined && previousAdj && previousAdj.netAmount > 0) {
          pct = Math.round(((adjustmentData.netAmount - previousAdj.netAmount) / previousAdj.netAmount) * 10000) / 100;
        }

        const newAdj: SalaryAdjustment = {
          ...adjustmentData,
          id: `adj_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          percentageIncrease: pct || 0,
        };

        const updatedHistory = [...sc.history, newAdj].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
        const latestAdj = updatedHistory[updatedHistory.length - 1];

        const updated = {
          ...sc,
          currentGrossAmount: latestAdj.grossAmount,
          currentNetAmount: latestAdj.netAmount,
          history: updatedHistory,
        };
        targetContract = updated;
        return updated;
      });

      if (user && !user.isGuest) {
        localStorage.setItem(`balder_salaries_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest && targetContract) {
      SupabaseService.upsertSalaryContract(targetContract).catch(console.error);
    }
  };

  const updateSalaryAdjustment = (contractId: string, adjustmentId: string, updates: Partial<SalaryAdjustment>) => {
    let targetContract: SalaryContract | null = null;
    setSalaryContracts((prev) => {
      const next = prev.map((sc) => {
        if (sc.id !== contractId) return sc;
        const updatedHistory = sc.history.map((a) => (a.id === adjustmentId ? { ...a, ...updates } : a))
          .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
        const latestAdj = updatedHistory[updatedHistory.length - 1];

        const updated = {
          ...sc,
          currentGrossAmount: latestAdj ? latestAdj.grossAmount : sc.currentGrossAmount,
          currentNetAmount: latestAdj ? latestAdj.netAmount : sc.currentNetAmount,
          history: updatedHistory,
        };
        targetContract = updated;
        return updated;
      });

      if (user && !user.isGuest) {
        localStorage.setItem(`balder_salaries_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest && targetContract) {
      SupabaseService.upsertSalaryContract(targetContract).catch(console.error);
    }
  };

  const deleteSalaryAdjustment = (contractId: string, adjustmentId: string) => {
    let targetContract: SalaryContract | null = null;
    setSalaryContracts((prev) => {
      const next = prev.map((sc) => {
        if (sc.id !== contractId) return sc;
        const updatedHistory = sc.history.filter((a) => a.id !== adjustmentId);
        const latestAdj = updatedHistory[updatedHistory.length - 1];

        const updated = {
          ...sc,
          currentGrossAmount: latestAdj ? latestAdj.grossAmount : sc.currentGrossAmount,
          currentNetAmount: latestAdj ? latestAdj.netAmount : sc.currentNetAmount,
          history: updatedHistory,
        };
        targetContract = updated;
        return updated;
      });

      if (user && !user.isGuest) {
        localStorage.setItem(`balder_salaries_${user.$id}`, JSON.stringify(next));
      }
      return next;
    });
    if (user && !user.isGuest && targetContract) {
      SupabaseService.upsertSalaryContract(targetContract).catch(console.error);
    }
  };

  // Retorna a remuneração líquida vigente em determinado mês de competência (YYYY-MM)
  const getSalaryForCompetence = (monthKey: string): number => {
    return salaryContracts
      .filter((sc) => sc.isActive)
      .reduce((total, sc) => {
        if (!sc.history || sc.history.length === 0) {
          return total + sc.currentNetAmount;
        }

        const sorted = [...sc.history].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
        // Buscar o reajuste vigente na data (último cujo effectiveDate <= monthKey)
        const applicable = sorted.filter((a) => a.effectiveDate <= monthKey).pop();

        if (applicable) {
          return total + applicable.netAmount;
        }

        return total + sorted[0].netAmount;
      }, 0);
  };

  // Eventos Críticos Sentinela dinâmicos com base nas movimentações reais
  const criticalEvents = useMemo<CriticalEvent[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return movements
      .filter((m) => m.status === 'PREVISTA' && (m.type === 'PAGAR' || m.type === 'CARTAO' || m.type === 'EMPRESTIMO'))
      .map((m) => {
        const due = new Date(m.dueDate + 'T00:00:00');
        const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: `crit_${m.id}`,
          title: `${m.title} (${m.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`,
          type: m.type === 'EMPRESTIMO' ? 'PARCELA' : 'CONTA',
          amount: m.amount,
          daysRemaining: diffDays,
          recommendedAction: diffDays <= 3
            ? 'Garantir saldo em conta corrente para pagamento.'
            : 'Previsão de vencimento programada.',
          severity: diffDays <= 3 ? 'CRITICAL' : 'WARNING',
          relatedEntity: m.bank,
        } as CriticalEvent;
      })
      .filter((ev) => ev.daysRemaining >= -30 && ev.daysRemaining <= 15)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [movements]);

  // Próximo evento crítico mais próximo
  const nextCriticalEvent = useMemo(() => {
    return criticalEvents.length > 0 ? criticalEvents[0] : null;
  }, [criticalEvents]);


  // Métricas Calculadas — respeitam o activeCheckpoint quando configurado
  const availableBalance = useMemo(() => {
    if (activeCheckpoint) {
      // Saldo = saldo inicial do marco + entradas realizadas - saídas realizadas (após startDate)
      const startDate = activeCheckpoint.startDate;
      const realized = movements.filter((m) => m.dueDate >= startDate && m.status === 'REALIZADA');
      const income  = realized.filter((m) => m.type === 'RECEBER').reduce((s, m) => s + m.amount, 0);
      const expense = realized.filter((m) => m.type !== 'RECEBER').reduce((s, m) => s + m.amount, 0);
      return Math.round((activeCheckpoint.initialBalance + income - expense) * 100) / 100;
    }
    // Fallback legado: soma de contas correntes/carteira
    return accounts
      .filter((a) => a.type === 'CORRENTE' || a.type === 'CARTEIRA')
      .reduce((acc, cur) => acc + cur.balance, 0);
  }, [activeCheckpoint, movements, accounts]);

  const totalNetWorth = useMemo(() => {
    if (activeCheckpoint) {
      if (activeCheckpoint.initialNetWorth !== undefined) {
        return activeCheckpoint.initialNetWorth;
      }
      const debt = activeCheckpoint.creditCardDebt || 0;
      return availableBalance - debt;
    }
    return accounts.reduce((acc, cur) => acc + cur.balance, 0);
  }, [activeCheckpoint, availableBalance, accounts]);

  const emergencyReserveAmount = useMemo(() => {
    const res = accounts.filter((a) => a.id === 'acc_reserva' || a.type === 'POUPANCA');
    return res.reduce((acc, cur) => acc + cur.balance, 0);
  }, [accounts]);

  // Projeção dos Próximos 30 Dias (filtra por startDate quando há checkpoint)
  const forecast30d = useMemo(() => {
    const startDate = activeCheckpoint?.startDate ?? '0000-01-01';
    const plannedIncome = movements
      .filter((m) => m.type === 'RECEBER' && m.status === 'PREVISTA' && m.dueDate >= startDate)
      .reduce((acc, cur) => acc + cur.amount, 0);

    const plannedExpenses = movements
      .filter((m) => (m.type === 'PAGAR' || m.type === 'EMPRESTIMO' || m.type === 'CARTAO') && m.status === 'PREVISTA' && m.dueDate >= startDate)
      .reduce((acc, cur) => acc + cur.amount, 0);

    const net = plannedIncome - plannedExpenses;
    const projectedBalance = availableBalance + net;

    return { income: plannedIncome, expenses: plannedExpenses, net, projectedBalance };
  }, [movements, availableBalance, activeCheckpoint]);

  const monthlyFreeCashflow = forecast30d.net;
  const emergencyReserveMonths = useMemo(() => {
    const monthlyBurn = forecast30d.expenses;
    if (monthlyBurn <= 0) {
      return emergencyReserveAmount > 0 ? 12 : 0;
    }
    return Number((emergencyReserveAmount / monthlyBurn).toFixed(1));
  }, [emergencyReserveAmount, forecast30d.expenses]);



  // Histórico Conversacional do Forseti (IA)
  const [chatHistory, setChatHistory] = useState<CopilotMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content: 'Olá! Sou o Forseti do BALDER. Na mitologia nórdica, Forseti é o patrono da conciliação e da justiça — e aqui, atuo como seu assistente operacional e auditor financeiro inteligente em tempo real.\n\nVocê pode registrar entradas e saídas em linguagem natural, **anexar imagens de comprovantes e notas para leitura OCR automática**, auditar números ou simular decisões.',
      timestamp: 'Agora',
      suggestedFollowUps: [
        '📸 Anexar comprovante / cupom fiscal',
        'Receberei R$ 8.500 dia 5.',
        'Paguei R$ 320 no mercado.',
        'Por que meu saldo projetado caiu?',
        'Posso comprar um carro?',
      ],
    },
  ]);

  // Sincronização inicial com Supabase
  useEffect(() => {
    if (!user || user.isGuest) {
      setAccounts(DEMO_ACCOUNTS);
      setCards(DEMO_CARDS);
      setPaymentMethods(DEMO_PAYMENT_METHODS);
      setBanks(DEMO_BANKS);
      setSalaryContracts(DEMO_SALARY_CONTRACTS);
      setMovements(DEMO_MOVEMENTS);
      setGoals(DEMO_GOALS);
      setNatures(DEMO_NATURES);
      setIsDataReady(true);
      return;
    }

    let isMounted = true;
    async function loadCloudData() {
      try {
        const [
          cloudMovements,
          cloudNatures,
          cloudGoals,
          cloudAccounts,
          cloudSalaries,
          cloudCheckpoints,
          cloudPaymentMethods,
          cloudProfileSettings,
        ] = await Promise.all([
          SupabaseService.getMovements(),
          SupabaseService.getNatures(),
          SupabaseService.getGoals(),
          SupabaseService.getAccounts(),
          SupabaseService.getSalaryContracts(),
          SupabaseService.getCheckpoints(),
          SupabaseService.getPaymentMethods(),
          SupabaseService.getUserProfileSettings(),
        ]);

        if (isMounted) {
          // 1. Naturezas: mescla com cache local e sobe para nuvem se necessário
          let finalNatures = cloudNatures || [];
          try {
            const cacheKey = user ? `balder_natures_${user.$id}` : 'balder_natures_guest';
            const savedNaturesStr = localStorage.getItem(cacheKey);
            if (savedNaturesStr) {
              const localNatures: ExpenseNature[] = JSON.parse(savedNaturesStr);
              if (finalNatures.length === 0 && localNatures.length > 0) {
                finalNatures = localNatures;
                if (user && !user.isGuest) {
                  localNatures.forEach((nat) => {
                    SupabaseService.addNature(nat).catch(console.error);
                  });
                }
              } else if (localNatures.length > 0) {
                finalNatures = finalNatures.map((cNat) => {
                  const localNat = localNatures.find(
                    (l) => l.id === cNat.id || l.name.trim().toLowerCase() === cNat.name.trim().toLowerCase()
                  );
                  if (
                    localNat &&
                    (!cNat.mappings || cNat.mappings.length === 0) &&
                    localNat.mappings &&
                    localNat.mappings.length > 0
                  ) {
                    if (user && !user.isGuest) {
                      SupabaseService.updateNature(cNat.id, { mappings: localNat.mappings }).catch(console.error);
                    }
                    return { ...cNat, mappings: localNat.mappings };
                  }
                  return cNat;
                });
              }
            }
          } catch (e) {
            console.warn('Erro ao mesclar cache local de naturezas:', e);
          }
          setNatures(finalNatures);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_natures_${user.$id}`, JSON.stringify(finalNatures));
          }

          // 2. Metas Financeiras
          setGoals(cloudGoals || []);

          // 3. Contas Bancárias (Nuvem prioritária com migração de cache local)
          let finalAccounts = cloudAccounts || [];
          if (finalAccounts.length === 0 && user) {
            const savedAccStr = localStorage.getItem(`balder_accounts_${user.$id}`) || localStorage.getItem('balder_accounts_guest');
            if (savedAccStr) {
              try {
                const parsed = JSON.parse(savedAccStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalAccounts = parsed;
                  if (!user.isGuest) {
                    parsed.forEach((acc) => SupabaseService.upsertAccount(acc).catch(console.error));
                  }
                }
              } catch {}
            }
          }
          setAccounts(finalAccounts);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_accounts_${user.$id}`, JSON.stringify(finalAccounts));
          }

          // 4. Métodos de Pagamento
          let finalMethods = cloudPaymentMethods || [];
          if (finalMethods.length === 0 && user) {
            const savedPmStr = localStorage.getItem(`balder_payment_methods_${user.$id}`) || localStorage.getItem('balder_payment_methods_guest');
            if (savedPmStr) {
              try {
                const parsed = JSON.parse(savedPmStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalMethods = parsed;
                  if (!user.isGuest) {
                    parsed.forEach((pm) => SupabaseService.upsertPaymentMethod(pm).catch(console.error));
                  }
                }
              } catch {}
            }
          }
          setPaymentMethods(finalMethods);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_payment_methods_${user.$id}`, JSON.stringify(finalMethods));
          }

          // 5. Contratos de Salário / Remuneração
          let finalSalaries = cloudSalaries || [];
          if (finalSalaries.length === 0 && user) {
            const savedSalStr = localStorage.getItem(`balder_salaries_${user.$id}`) || localStorage.getItem('balder_salaries_guest');
            if (savedSalStr) {
              try {
                const parsed = JSON.parse(savedSalStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalSalaries = parsed;
                  if (!user.isGuest) {
                    parsed.forEach((sc) => SupabaseService.upsertSalaryContract(sc).catch(console.error));
                  }
                }
              } catch {}
            }
          }
          setSalaryContracts(finalSalaries);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_salaries_${user.$id}`, JSON.stringify(finalSalaries));
          }

          // 6. Checkpoints de Partida (Crucial para saldo e métricas)
          let finalCheckpoints = cloudCheckpoints || [];
          if (finalCheckpoints.length === 0 && user) {
            const savedCpStr = localStorage.getItem(`balder_checkpoints_${user.$id}`) || localStorage.getItem('balder_checkpoints_guest');
            if (savedCpStr) {
              try {
                const parsed = JSON.parse(savedCpStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalCheckpoints = parsed;
                  if (!user.isGuest) {
                    parsed.forEach((cp) => SupabaseService.upsertCheckpoint(cp).catch(console.error));
                  }
                }
              } catch {}
            }
          }
          setCheckpoints(finalCheckpoints);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_checkpoints_${user.$id}`, JSON.stringify(finalCheckpoints));
          }

          // 7. Cartões de Crédito (via Perfil Nuvem ou Cache)
          let finalCards = cloudProfileSettings?.cards || [];
          if (finalCards.length === 0 && user) {
            const savedCardsStr = localStorage.getItem(`balder_cards_${user.$id}`) || localStorage.getItem('balder_cards_guest');
            if (savedCardsStr) {
              try {
                const parsed = JSON.parse(savedCardsStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalCards = parsed;
                }
              } catch {}
            }
          }
          setCards(finalCards);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_cards_${user.$id}`, JSON.stringify(finalCards));
          }

          // 8. Bancos / Instituições
          let finalBanks = cloudProfileSettings?.banks || [];
          if (finalBanks.length === 0 && user) {
            const savedBanksStr = localStorage.getItem(`balder_banks_${user.$id}`) || localStorage.getItem('balder_banks_guest');
            if (savedBanksStr) {
              try {
                const parsed = JSON.parse(savedBanksStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalBanks = parsed;
                }
              } catch {}
            }
          }
          setBanks(finalBanks);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_banks_${user.$id}`, JSON.stringify(finalBanks));
          }

          // 9. Fechamentos Mensais de Competência
          let finalClosings = cloudProfileSettings?.monthlyClosings || [];
          if (finalClosings.length === 0 && user) {
            const savedClosingsStr = localStorage.getItem(`balder_monthly_closings_${user.$id}`) || localStorage.getItem('balder_monthly_closings_guest');
            if (savedClosingsStr) {
              try {
                const parsed = JSON.parse(savedClosingsStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalClosings = parsed;
                }
              } catch {}
            }
          }
          setMonthlyClosings(finalClosings);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_monthly_closings_${user.$id}`, JSON.stringify(finalClosings));
          }

          // 10. Planejamento Compartilhado & Acertos Mútuos
          if (cloudProfileSettings?.sharedScenario) {
            setSharedScenario(cloudProfileSettings.sharedScenario);
            if (user) {
              localStorage.setItem(`balder_shared_scenario_${user.$id}`, JSON.stringify(cloudProfileSettings.sharedScenario));
            }
          }
          if (cloudProfileSettings?.sharedSettlements) {
            setSharedSettlements(cloudProfileSettings.sharedSettlements);
            if (user) {
              localStorage.setItem(`balder_shared_settlements_${user.$id}`, JSON.stringify(cloudProfileSettings.sharedSettlements));
            }
          }
          if (cloudProfileSettings?.defaultTrackingScope) {
            setDefaultTrackingScopeState(cloudProfileSettings.defaultTrackingScope);
            if (user) {
              localStorage.setItem(`balder_default_scope_${user.$id}`, cloudProfileSettings.defaultTrackingScope);
            }
          }
          if (cloudProfileSettings?.onboardingCompleted) {
            if (user) {
              localStorage.setItem(`balder_onboarding_completed_${user.$id}`, 'true');
            }
          }

          // Se tivermos itens locais que ainda não estavam no perfil da nuvem, salva no Supabase
          if (user && !user.isGuest && (!cloudProfileSettings || Object.keys(cloudProfileSettings).length === 0)) {
            SupabaseService.saveUserProfileSettings({
              cards: finalCards,
              banks: finalBanks,
              monthlyClosings: finalClosings,
              onboardingCompleted: localStorage.getItem(`balder_onboarding_completed_${user.$id}`) === 'true',
            }).catch(console.error);
          }

          // 11. Movimentações Financeiras (com migração de itens locais/guest para a nuvem)
          let finalMovements = cloudMovements || [];
          if (user) {
            const savedMovStr = localStorage.getItem(`balder_movements_${user.$id}`) || localStorage.getItem('balder_movements_guest');
            if (savedMovStr) {
              try {
                const localMovs: Movement[] = JSON.parse(savedMovStr);
                if (finalMovements.length === 0 && localMovs.length > 0) {
                  finalMovements = localMovs;
                  if (!user.isGuest) {
                    localMovs.forEach((m) => {
                      const { id, ...rest } = m;
                      SupabaseService.addMovement(rest).catch(console.error);
                    });
                  }
                } else if (localMovs.length > 0 && !user.isGuest) {
                  // Sobe movimentações geradas localmente que ainda não foram persistidas
                  const unsynced = localMovs.filter(
                    (lm) =>
                      lm.id.startsWith('mov_') &&
                      !finalMovements.some(
                        (fm) => fm.title === lm.title && fm.dueDate === lm.dueDate && fm.amount === lm.amount
                      )
                  );
                  if (unsynced.length > 0) {
                    unsynced.forEach((m) => {
                      const { id, ...rest } = m;
                      SupabaseService.addMovement(rest).then((created) => {
                        if (created) {
                          setMovements((prev) => prev.map((item) => (item.id === m.id ? created : item)));
                        }
                      }).catch(console.error);
                    });
                    finalMovements = [...unsynced, ...finalMovements];
                  }
                }
              } catch {}
            }
          }
          setMovements(finalMovements);
          if (user && !user.isGuest) {
            localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(finalMovements));
          }

          setIsDataReady(true);
        }
      } catch (err) {
        console.error('Erro ao sincronizar com Supabase:', err);
        // Mesmo em erro, libera o render para não travar a tela
        if (isMounted) setIsDataReady(true);
      }
    }
    loadCloudData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Adicionar Movimentação
  const addMovement = (item: Omit<Movement, 'id'>) => {
    const tempId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newMovement: Movement = {
      ...item,
      id: tempId,
    };
    setMovements((prev) => {
      const next = [newMovement, ...prev];
      if (user && !user.isGuest) {
        try {
          localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(next));
        } catch {}
      } else {
        try {
          localStorage.setItem('balder_movements_guest', JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (user && !user.isGuest) {
      SupabaseService.addMovement(item)
        .then((created) => {
          if (created) {
            setMovements((prev) => {
              const updated = prev.map((m) => (m.id === tempId ? { ...m, id: created.id } : m));
              try {
                localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        })
        .catch((err) => console.error('Erro ao persistir no Supabase:', err));
    }
  };

  // Adicionar Múltiplas Movimentações (ex: Parcelamentos)
  const addMultipleMovements = (items: Omit<Movement, 'id'>[]) => {
    const baseTime = Date.now();
    const newItems: Movement[] = items.map((item, idx) => ({
      ...item,
      id: `mov_${baseTime}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
    }));
    setMovements((prev) => {
      const next = [...newItems, ...prev];
      if (user && !user.isGuest) {
        try {
          localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(next));
        } catch {}
      } else {
        try {
          localStorage.setItem('balder_movements_guest', JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (user && !user.isGuest) {
      items.forEach((item) => {
        SupabaseService.addMovement(item).catch((err) =>
          console.error('Erro ao salvar item parcelado no Supabase:', err)
        );
      });
    }
  };

  // Atualizar Movimentação (Ajuste de valor real, vencimento, status, observações)
  const updateMovement = (id: string, updates: Partial<Movement>) => {
    setMovements((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, ...updates } : m));
      if (user && !user.isGuest) {
        try {
          localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(next));
        } catch {}
      } else {
        try {
          localStorage.setItem('balder_movements_guest', JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (user && !user.isGuest && !id.startsWith('rec_') && !id.startsWith('pay_') && !id.startsWith('lia_') && !id.startsWith('cc_') && !id.startsWith('mov_')) {
      SupabaseService.updateMovement(id, updates).catch((err) =>
        console.error('Erro ao atualizar movimentação no Supabase:', err)
      );
    }
  };

  // Excluir Movimentação
  const deleteMovement = (id: string) => {
    setMovements((prev) => {
      const next = prev.filter((m) => m.id !== id);
      if (user && !user.isGuest) {
        try {
          localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(next));
        } catch {}
      } else {
        try {
          localStorage.setItem('balder_movements_guest', JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (user && !user.isGuest && !id.startsWith('rec_') && !id.startsWith('pay_') && !id.startsWith('lia_') && !id.startsWith('cc_') && !id.startsWith('mov_')) {
      SupabaseService.deleteMovement(id).catch((err) =>
        console.error('Erro ao excluir no Supabase:', err)
      );
    }
  };

  // Alternar Status Prevista / Realizada
  const toggleMovementStatus = (id: string) => {
    let nextStatus: MovementStatus = 'REALIZADA';
    setMovements((prev) => {
      const next = prev.map((m) => {
        if (m.id === id) {
          nextStatus = m.status === 'PREVISTA' ? 'REALIZADA' : 'PREVISTA';
          return {
            ...m,
            status: nextStatus,
          };
        }
        return m;
      });
      if (user && !user.isGuest) {
        try {
          localStorage.setItem(`balder_movements_${user.$id}`, JSON.stringify(next));
        } catch {}
      } else {
        try {
          localStorage.setItem('balder_movements_guest', JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (user && !user.isGuest && !id.startsWith('rec_') && !id.startsWith('pay_') && !id.startsWith('lia_') && !id.startsWith('cc_') && !id.startsWith('mov_')) {
      SupabaseService.updateMovement(id, { status: nextStatus }).catch((err) =>
        console.error('Erro ao atualizar status no Supabase:', err)
      );
    }
  };

  // Liquidar / Antecipar Parcelas de Empréstimo com Desconto a Valor Presente
  const prepayInstallments = (
    movementIds: string[],
    discountedAmounts: Record<string, number>,
    paymentDate: string
  ) => {
    setMovements((prev) =>
      prev.map((m) => {
        if (movementIds.includes(m.id)) {
          const actualPaid = discountedAmounts[m.id] !== undefined ? discountedAmounts[m.id] : m.amount;
          const originalAmount = m.amount;
          const economy = Math.max(0, originalAmount - actualPaid);
          return {
            ...m,
            status: 'REALIZADA' as const,
            amount: actualPaid,
            dueDate: paymentDate,
            notes: `${m.notes ? m.notes + ' • ' : ''}Liquidado antecipadamente em ${paymentDate} com deságio de juros de ${economy.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          };
        }
        return m;
      })
    );
  };

  // Metas
  const addGoal = (item: Omit<Goal, 'id'>) => {
    const tempId = `goal_${Date.now()}`;
    setGoals((prev) => [...prev, { ...item, id: tempId }]);
    if (user && !user.isGuest) {
      SupabaseService.addGoal(item)
        .then((created) => {
          if (created) {
            setGoals((prev) => prev.map((g) => (g.id === tempId ? { ...g, id: created.id } : g)));
          }
        })
        .catch((err) => console.error('Erro ao adicionar meta no Supabase:', err));
    }
  };

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
    if (user && !user.isGuest) {
      SupabaseService.updateGoal(id, updates).catch((err) =>
        console.error('Erro ao atualizar meta no Supabase:', err)
      );
    }
  };

  // Motor de Simulações
  const runSimulation = (preset: SimulationPresetId): SimulationScenario => {
    switch (preset) {
      case 'CARRO':
        return {
          id: 'sim_carro',
          title: 'Simulação: Compra de Carro Novo',
          description: 'Entrada de R$ 25.000 + 36 parcelas de R$ 1.850,00',
          initialOutflow: 25000,
          monthlyCost: 1850,
          runwayBeforeMonths: 6.8,
          runwayAfterMonths: 4.8,
          verdict: 'COM_RESTRICAO',
          explanation: 'A compra reduz sua reserva de emergência em 2 meses e absorve 43% do seu fluxo livre mensal (+R$ 4.250). É viável, mas reduzirá o ritmo do seu aporte de independência financeira.',
          actionRecommendations: [
            'Aumentar a entrada para R$ 35.000 visando reduzir a parcela mensal para R$ 1.300.',
            'Preservar integralmente os R$ 85.000 da reserva antes de assumir o financiamento.',
          ],
        };

      case 'QUITAR_DIVIDA':
        return {
          id: 'sim_quitar',
          title: 'Simulação: Quitação Antecipada de Empréstimo',
          description: 'Liquidação de R$ 17.367 a valor presente (economia imediata de juros)',
          initialOutflow: 17367,
          monthlyCost: -1458.51,
          runwayBeforeMonths: 6.8,
          runwayAfterMonths: 5.6,
          verdict: 'RECOMENDADO',
          explanation: 'Altamente benéfico! Você economiza R$ 4.886 em juros bancários futuros e libera instantaneamente +R$ 1.458,51 no seu fluxo de caixa mensal.',
          actionRecommendations: [
            'Utilizar parte do saldo disponível em conta corrente sem tocar no fundo de emergência.',
            'Redirecionar a parcela economizada (+R$ 1.458) diretamente para investimentos.',
          ],
        };

      case 'NOVO_EMPRESTIMO':
        return {
          id: 'sim_novo_emprestimo',
          title: 'Simulação: Tomada de Novo Empréstimo',
          description: 'Captação de R$ 30.000 em 24x de R$ 1.680,00 (CET estimado: 2,1% a.m.)',
          initialOutflow: -30000,
          monthlyCost: 1680,
          runwayBeforeMonths: 6.8,
          runwayAfterMonths: 5.1,
          verdict: 'COM_RESTRICAO',
          explanation: 'O crédito injeta +R$ 30.000 imediatos em caixa (elevando saldo para R$ 54.800). No entanto, a nova parcela de R$ 1.680 consome 39,5% do seu fluxo livre mensal (+R$ 4.250). O custo total de juros acumulados será de R$ 10.320 em 24 meses.',
          actionRecommendations: [
            'Verificar se a taxa contratual (2,1% a.m.) é menor que o retorno gerado pela destinação dos recursos.',
            'Pesquisar linhas com garantia de imóvel ou investimento para tentar reduzir os juros para menos de 1,4% a.m.',
            'Não utilizar o recurso emprestado para cobrir despesas fixas recorrentes.',
          ],
        };

      case 'FINANCIAMENTO':
        return {
          id: 'sim_financiamento',
          title: 'Simulação: Novo Financiamento Empresarial/Pessoal',
          description: 'Aporte de capital de R$ 50.000 com parcelas de R$ 2.400/mês',
          initialOutflow: 0,
          monthlyCost: 2400,
          runwayBeforeMonths: 6.8,
          runwayAfterMonths: 4.2,
          verdict: 'COM_RESTRICAO',
          explanation: 'A parcela de R$ 2.400 consome 56% do seu fluxo livre atual. Recomenda-se apenas se o retorno do capital investido superar a taxa de juros do contrato.',
          actionRecommendations: [
            'Garantir carência inicial mínima de 60 dias para estabilização de caixa.',
            'Comparar a CET (Custo Efetivo Total) entre 3 instituições bancárias.',
          ],
        };

      case 'IMOVEL':
        return {
          id: 'sim_imovel',
          title: 'Simulação: Aquisição de Imóvel Residencial',
          description: 'Entrada de R$ 120.000 + parcelas decrescentes de R$ 4.200 (SAC)',
          initialOutflow: 120000,
          monthlyCost: 4200,
          runwayBeforeMonths: 6.8,
          runwayAfterMonths: 3.1,
          verdict: 'NAO_RECOMENDADO',
          explanation: 'A entrada de R$ 120.000 compromete severamente a liquidez total e a parcela de R$ 4.200 zera seu fluxo livre (+R$ 4.250), deixando o orçamento sem margem de segurança.',
          actionRecommendations: [
            'Aguardar acúmulo de patrimônio líquido até R$ 1.000.000 para não desproteger a reserva.',
            'Simular consórcio imobiliário como alternativa com custo efetivo menor.',
          ],
        };
    }
  };

  // Motor Avançado de Cenários Futuros (Crédito, Direcionamento e Comportamento)
  const simulateCustomFutureScenario = (input: CustomScenarioInput): FutureScenarioResult => {
    const i = (input.monthlyInterestRate || 0) / 100;
    const n = Math.max(input.installmentsCount || 1, 1);
    const pv = Math.max(input.principalAmount || 0, 0);

    // Amortização Price
    const computedMonthlyPayment = i > 0 && n > 0
      ? (pv * i) / (1 - Math.pow(1 + i, -n))
      : pv / n;

    const totalRepayment = computedMonthlyPayment * n;
    const totalInterestPaid = Math.max(totalRepayment - pv, 0);

    // Renda estimada média do perfil
    const estimatedMonthlyIncome = 18000;
    const debtToIncomeRatio = Math.round((computedMonthlyPayment / estimatedMonthlyIncome) * 1000) / 10;

    // Efeitos comportamentais
    const baseVariableExpenses = 3800;
    const variableExpensesCut = baseVariableExpenses * ((input.behavior.cutVariableExpensesPercent || 0) / 100);
    const incomeBoost = input.behavior.expectedMonthlyIncomeBoost || 0;
    const pausedGoalsRelief = input.behavior.pauseGoalContributions ? 2500 : 0;
    const previousDebtRelief = input.destination === 'QUITAR_DIVIDAS_CARAS' ? 1458.51 : 0;

    const netMonthlyImpact = incomeBoost + variableExpensesCut + pausedGoalsRelief + previousDebtRelief - computedMonthlyPayment;

    // Runway
    const runwayBeforeMonths = emergencyReserveMonths;
    let runwayAfterMonths = runwayBeforeMonths;
    if (input.destination === 'INVESTIMENTO_RESERVA') {
      runwayAfterMonths = Math.min(Math.round((runwayBeforeMonths + (pv / 12500)) * 10) / 10, 18);
    } else if (input.destination === 'CAPITAL_GIRO_CAIXA') {
      runwayAfterMonths = Math.min(Math.round((runwayBeforeMonths + (pv / 16000)) * 10) / 10, 15);
    } else {
      const degradation = netMonthlyImpact < 0 ? Math.min(Math.abs(netMonthlyImpact) / 2500, 2.5) : 0;
      runwayAfterMonths = Math.max(Math.round((runwayBeforeMonths - degradation) * 10) / 10, 1.5);
    }

    // Projeção mês a mês nos próximos 12 meses
    const monthNames = ['Mês 1', 'Mês 2', 'Mês 3', 'Mês 4', 'Mês 5', 'Mês 6', 'Mês 7', 'Mês 8', 'Mês 9', 'Mês 10', 'Mês 11', 'Mês 12'];
    let runningBaseline = availableBalance;
    let runningSimulated = availableBalance;

    if (input.destination === 'CAPITAL_GIRO_CAIXA' || input.destination === 'INVESTIMENTO_RESERVA') {
      runningSimulated += pv;
    }

    const projection12Months: MonthlyProjectionPoint[] = [];

    for (let m = 1; m <= 12; m++) {
      runningBaseline += monthlyFreeCashflow;

      const isGracePeriod = m <= (input.gracePeriodMonths || 0);
      const effectivePayment = isGracePeriod ? (pv * i) : computedMonthlyPayment;

      const monthlyDelta = incomeBoost + variableExpensesCut + pausedGoalsRelief + previousDebtRelief - effectivePayment;

      let extraAmort = 0;
      if (input.behavior.extraAmortizationMonth === m && input.behavior.extraAmortizationAmount) {
        extraAmort = input.behavior.extraAmortizationAmount;
      }

      runningSimulated += (monthlyFreeCashflow + monthlyDelta - extraAmort);
      const isStressed = runningSimulated < 15000 || (monthlyFreeCashflow + monthlyDelta) < 0;

      projection12Months.push({
        monthIndex: m,
        monthLabel: monthNames[m - 1],
        baselineBalance: Math.round(runningBaseline),
        simulatedBalance: Math.round(runningSimulated),
        cashflowImpact: Math.round(monthlyDelta),
        isStressed,
      });
    }

    let verdict: SimulationVerdict = 'RECOMENDADO';
    let verdictReason = '';
    const recommendations: string[] = [];
    const minSimulated = Math.min(...projection12Months.map((p) => p.simulatedBalance));

    if (minSimulated < 10000 || debtToIncomeRatio > 32 || netMonthlyImpact < -2000) {
      verdict = 'NAO_RECOMENDADO';
      verdictReason = `A operação coloca sua liquidez em risco alto. O comprometimento de renda (${debtToIncomeRatio}%) ou a queda de caixa reduzem perigosamente sua margem de segurança.`;
      recommendations.push('Aumentar o prazo em parcelas para diluir o valor mensal.');
      recommendations.push('Intensificar o corte de despesas supérfluas para pelo menos 20% antes de contratar.');
      recommendations.push('Buscar taxa de juros com garantia inferior a 1,4% a.m.');
    } else if (debtToIncomeRatio > 18 || netMonthlyImpact < -500 || input.destination === 'AQUISICAO_BEM') {
      verdict = 'COM_RESTRICAO';
      verdictReason = `Cenário viável mediante disciplina. A parcela de R$ ${Math.round(computedMonthlyPayment).toLocaleString('pt-BR')} compromete ${debtToIncomeRatio}% da renda estimada, mas suas medidas comportamentais atenuam o impacto.`;
      recommendations.push(`Manter rigoroso o corte de ${input.behavior.cutVariableExpensesPercent}% nos gastos variáveis.`);
      if (input.behavior.expectedMonthlyIncomeBoost > 0) {
        recommendations.push(`Certificar-se de que a renda extra de R$ ${input.behavior.expectedMonthlyIncomeBoost.toLocaleString('pt-BR')} se concretize nos primeiros 60 dias.`);
      }
      recommendations.push('Aproveitar receitas sazonais (13º/bônus) para amortizar parcelas antecipadas.');
    } else {
      verdict = 'RECOMENDADO';
      verdictReason = `Excelente estruturação estratégica! O direcionamento do dinheiro ${input.destination === 'QUITAR_DIVIDAS_CARAS' ? 'elimina dívidas caras' : 'fortalece seu caixa'} e as contrapartidas comportamentais mantêm seu fluxo positivo (+R$ ${Math.round(netMonthlyImpact).toLocaleString('pt-BR')}/mês).`;
      recommendations.push('Seguir rigorosamente o cronograma de pagamentos para não incidir encargos moratórios.');
      recommendations.push('Manter os recursos aportados em ativos com liquidez imediata (100% CDI).');
      recommendations.push('Reavaliar o cenário trimestralmente no Balder.');
    }

    return {
      input,
      computedMonthlyPayment: Math.round(computedMonthlyPayment * 100) / 100,
      totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
      totalRepayment: Math.round(totalRepayment * 100) / 100,
      debtToIncomeRatio,
      netMonthlyImpact: Math.round(netMonthlyImpact * 100) / 100,
      runwayBeforeMonths,
      runwayAfterMonths,
      verdict,
      verdictReason,
      tacticalRecommendations: recommendations,
      projection12Months,
    };
  };

  const applyScenarioToBudget = (result: FutureScenarioResult) => {
    const today = new Date().toISOString().split('T')[0];

    // 1. Injeção do crédito se for para caixa ou reserva
    if (result.input.destination === 'CAPITAL_GIRO_CAIXA' || result.input.destination === 'INVESTIMENTO_RESERVA') {
      addMovement({
        title: `Captação: ${result.input.operationType.replace(/_/g, ' ')}`,
        type: 'RECEBER',
        amount: result.input.principalAmount,
        dueDate: today,
        bank: 'Nubank',
        status: 'REALIZADA',
        category: 'Empréstimos / Crédito',
        notes: `Cenário simulado no Balder: ${result.input.installmentsCount}x de R$ ${result.computedMonthlyPayment.toFixed(2)}`,
      });
    }

    // 2. Programação da 1ª Parcela Futura
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1 + (result.input.gracePeriodMonths || 0));
    const nextMonthStr = nextMonth.toISOString().split('T')[0];

    addMovement({
      title: `Parcela 1/${result.input.installmentsCount} - ${result.input.operationType.replace(/_/g, ' ')}`,
      type: 'EMPRESTIMO',
      amount: result.computedMonthlyPayment,
      dueDate: nextMonthStr,
      bank: 'Nubank',
      status: 'PREVISTA',
      category: 'Empréstimos & Financiamentos',
      notes: `Programado via Simulador de Cenários Futuros. Taxa: ${result.input.monthlyInterestRate}% a.m.`,
    });

    if (result.input.destination === 'QUITAR_DIVIDAS_CARAS') {
      addMovement({
        title: `Quitação Consolidada de Passivo Anterior`,
        type: 'PAGAR',
        amount: result.input.principalAmount,
        dueDate: today,
        bank: 'Nubank',
        status: 'REALIZADA',
        category: 'Quitação de Dívida',
        notes: `Liquidação viabilizada pela troca de dívida no Simulador.`,
      });
    }

    alert(`Cenário Efetivado no Balder!\n\nForam gerados os registros correspondentes no seu fluxo de caixa:\n• Injeção de R$ ${result.input.principalAmount.toLocaleString('pt-BR')}\n• Programação da parcela de R$ ${result.computedMonthlyPayment.toLocaleString('pt-BR')}/mês a partir de ${nextMonthStr}.`);
  };

  // Motor Conversacional Inteligente do Forseti (IA) com Retenção Efêmera / Temporária
  const sendMessageToCopilot = (query: string, attachment?: { url: string; name: string; size?: string; revoke?: () => void }) => {
    const trimmed = query.trim();
    if (!trimmed && !attachment) return;

    const userMessage: CopilotMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: trimmed || (attachment ? `Comprovante anexado: ${attachment.name}` : ''),
      timestamp: 'Agora',
      attachmentUrl: attachment?.url,
      attachmentName: attachment?.name,
      attachmentSize: attachment?.size,
      isEphemeralPurged: false,
    };

    // 0. Processamento de Imagem Anexada (Visão Computacional / OCR com Forseti em Espaço Temporário)
    if (attachment) {
      const loadingId = `ast_loading_${Date.now()}`;
      const loadingMessage: CopilotMessage = {
        id: loadingId,
        role: 'assistant',
        content: '🔍 **Forseti OCR em execução...** Processando pixels da imagem em buffer temporário, identificando estabelecimento e decodificando valores fiscais...',
        timestamp: 'Agora',
        actionBadge: 'VISÃO COMPUTACIONAL OCR',
      };

      setChatHistory((prev) => [...prev, userMessage, loadingMessage]);

      // Execução do pipeline de OCR e visão determinística
      recognizeImageOCR(attachment.url, trimmed).then((ocrResult) => {
        // Imediatamente libera o arquivo do espaço temporário (memória / blob)
        if (attachment.revoke) {
          attachment.revoke();
        } else if (attachment.url.startsWith('blob:')) {
          URL.revokeObjectURL(attachment.url);
        }

        // Atualiza a mensagem do usuário no histórico para remover a imagem pesada da memória
        setChatHistory((prev) =>
          prev.map((msg) =>
            msg.id === userMessage.id
              ? { ...msg, attachmentUrl: undefined, isEphemeralPurged: true }
              : msg
          )
        );

        const ocrItemsText = ocrResult.detectedItems && ocrResult.detectedItems.length > 0
          ? `\n• **Itens / Produtos Reconhecidos:** ${ocrResult.detectedItems.join(', ')}`
          : '';

        const paymentMethodDetails = ocrResult.cashPaid !== undefined
          ? `\n• **Forma de Pagamento no Cupom:** Dinheiro em Espécie (Pago: R$ ${ocrResult.cashPaid.toFixed(2).replace('.', ',')} • Troco: R$ ${(ocrResult.changeAmount || 0).toFixed(2).replace('.', ',')})`
          : (ocrResult.suggestedPaymentMethod === 'DINHEIRO' ? '\n• **Forma de Pagamento no Cupom:** Dinheiro em Espécie' : '');

        const dynamicOptions: CopilotInteractiveOption[] = ocrResult.suggestedPaymentMethod === 'DINHEIRO'
          ? [
              {
                id: 'opt_ocr_cash',
                label: 'Dinheiro em Espécie',
                icon: '💵',
                badge: 'Identificado no Cupom (Recomendado)',
                description: `Registrar saída de ${ocrResult.detectedAmountFormatted} do caixa em dinheiro`,
                payload: { bank: 'Dinheiro', type: 'PAGAR', category: ocrResult.detectedCategory },
              },
              {
                id: 'opt_ocr_inter',
                label: 'Conta Inter (Débito / PIX)',
                icon: '🟠',
                badge: 'Conta Corrente',
                description: 'Debitar da conta caso tenha pago via PIX/Débito',
                payload: { bank: 'Inter', type: 'PAGAR', category: ocrResult.detectedCategory },
              },
              {
                id: 'opt_ocr_nubank',
                label: 'Cartão Nubank Black',
                icon: '💳',
                badge: 'Fatura de Cartão',
                description: 'Lançar na fatura aberta com vencimento dia 06/10',
                payload: { bank: 'Nubank', type: 'CARTAO', category: ocrResult.detectedCategory },
              },
              {
                id: 'opt_ocr_adjust',
                label: 'Ajustar Valor / Categoria',
                icon: '✏️',
                badge: 'Personalizar',
                description: 'Informar outro valor ou alterar favorecido',
                payload: { action: 'ADJUST_AMOUNT', category: ocrResult.detectedCategory },
              },
            ]
          : [
              {
                id: 'opt_ocr_inter',
                label: 'Conta Inter (Débito / PIX)',
                icon: '🟠',
                badge: 'PIX / Débito',
                description: 'Debitar imediatamente do saldo em caixa',
                payload: { bank: 'Inter', type: 'PAGAR', category: ocrResult.detectedCategory },
              },
              {
                id: 'opt_ocr_nubank',
                label: 'Cartão Nubank Black',
                icon: '💳',
                badge: 'Fatura de Cartão',
                description: 'Lançar na fatura aberta com vencimento dia 06/10',
                payload: { bank: 'Nubank', type: 'CARTAO', category: ocrResult.detectedCategory },
              },
              {
                id: 'opt_ocr_cash',
                label: 'Dinheiro / Caixa Físico',
                icon: '💵',
                badge: 'Espécie',
                description: 'Registrar como saída avulsa em dinheiro',
                payload: { bank: 'Dinheiro', type: 'PAGAR', category: ocrResult.detectedCategory },
              },
              {
                id: 'opt_ocr_adjust',
                label: 'Ajustar Valor / Categoria',
                icon: '✏️',
                badge: 'Personalizar',
                description: 'Informar outro valor ou alterar favorecido',
                payload: { action: 'ADJUST_AMOUNT', category: ocrResult.detectedCategory },
              },
            ];

        const pendingConfirmation: CopilotPendingConfirmation = {
          step: 'PAYMENT_METHOD',
          pendingData: {
            rawTitle: `${ocrResult.detectedStore}`,
            amount: ocrResult.detectedAmount,
            dueDate: ocrResult.detectedDate,
            type: 'PAGAR',
            category: ocrResult.detectedCategory,
            notes: ocrResult.notes || `Lançamento extraído via Forseti OCR (${attachment.name}).`,
          },
          question: 'Em qual conta ou forma de pagamento você deseja conciliar esta despesa?',
          options: dynamicOptions,
        };

        const ocrText = `📄 **Interpretação de Imagem / Comprovante (Forseti OCR):**\n\nAnalisei o anexo **"${attachment.name}"** através da visão determinística do Balder:\n\n• **Tipo de Registro:** Cupom Fiscal / NFC-e\n• **Favorecido / Estabelecimento:** **${ocrResult.detectedStore}**\n• **Data do Documento:** ${ocrResult.detectedDate.split('-').reverse().join('/')} (Competência Atual)\n• **Valor Reconhecido:** **${ocrResult.detectedAmountFormatted}**${ocrResult.isEstimatedAmount ? ' *(estimado)*' : ''}${paymentMethodDetails}\n• **Natureza Orçamentária Sugerida:** **${ocrResult.detectedCategory}** (${ocrResult.detectedSubcategory || 'Geral'})${ocrItemsText}\n• **Status Orçamentário:** Despesa compatível com o teto previsto para a semana.\n• 🔒 **Espaço Temporário Liberado:** O arquivo da imagem foi processado em buffer temporário e **descartado imediatamente** da memória (0 bytes retidos no armazenamento).\n\nComo você deseja lançar ou conciliar essa despesa no seu fluxo de caixa?`;

        const receiptReconciliation: ReceiptReconciliationData = {
          id: `rec_${Date.now()}`,
          store: ocrResult.detectedStore,
          date: ocrResult.detectedDate,
          totalAmount: ocrResult.detectedAmount,
          paymentMethod: ocrResult.suggestedPaymentMethod,
          cashPaid: ocrResult.cashPaid,
          changeAmount: ocrResult.changeAmount,
          items: ocrResult.receiptItemLines,
          isReconciled: false,
        };

        const assistantMessage: CopilotMessage = {
          id: `ast_${Date.now()}`,
          role: 'assistant',
          content: ocrText,
          timestamp: 'Agora',
          actionBadge: 'VISÃO COMPUTACIONAL OCR',
          suggestedFollowUps: ['Confirmar no Dinheiro', 'Debitar da Conta Inter', 'Confirmar no Cartão Nubank', 'Anexar outro comprovante'],
          pendingConfirmation,
          receiptReconciliation,
        };

        setChatHistory((prev) => prev.filter((m) => m.id !== loadingId).concat(assistantMessage));
      });

      return;
    }

    setChatHistory((prev) => [...prev, userMessage]);

    // Análise Cognitiva da Pergunta / Comando
    setTimeout(() => {
      let responseText = '';
      let actionBadge = '';
      let suggestedFollowUps: string[] = [];
      const lower = trimmed.toLowerCase();

      // 1. Cadastros em Linguagem Natural
      if (lower.includes('receberei') || lower.includes('vou receber') || lower.includes('ganhei') || lower.includes('recebi')) {
        const matchAmount = trimmed.match(/(?:R\$\s*)?([\d.,]+)/i);
        const amountFound = matchAmount ? parseFloat(matchAmount[1].replace('.', '').replace(',', '.')) : 5000;
        const validAmount = isNaN(amountFound) ? 5000 : amountFound;

        const pendingConfirmation: CopilotPendingConfirmation = {
          step: 'ACCOUNT',
          pendingData: {
            rawTitle: trimmed.replace(/(?:R\$\s*)?[\d.,]+/i, '').trim() || 'Recebimento Programado',
            amount: validAmount,
            dueDate: '2026-10-05',
            type: 'RECEBER',
            category: 'Receita Operacional',
          },
          question: 'Em qual conta bancária você deseja receber esse valor?',
          options: [
            {
              id: 'opt_rec_inter',
              label: 'Banco Inter',
              icon: '🟠',
              badge: 'Conta Corrente',
              description: 'Destinar para o fluxo operacional do Inter',
              payload: { bank: 'Inter', type: 'RECEBER' },
            },
            {
              id: 'opt_rec_nubank',
              label: 'Nubank',
              icon: '🟣',
              badge: 'Conta Corrente',
              description: 'Destinar para saldo disponível Nubank',
              payload: { bank: 'Nubank', type: 'RECEBER' },
            },
            {
              id: 'opt_rec_xp',
              label: 'XP Investimentos',
              icon: '⚪',
              badge: 'Investimentos',
              description: 'Aporte direto para carteira de ativos',
              payload: { bank: 'XP', type: 'RECEBER' },
            },
            {
              id: 'opt_rec_reserva',
              label: 'Tesouro Selic',
              icon: '🟢',
              badge: 'Reserva de Emergência',
              description: 'Fortalecer o runway de liquidez',
              payload: { bank: 'Tesouro Selic', type: 'RECEBER' },
            },
          ],
        };

        responseText = `Identifiquei uma receita de **${validAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}**.\n\nPara agendar no seu fluxo de caixa na conta correta, **onde esse valor será depositado?**`;
        actionBadge = 'SELEÇÃO DE CONTA';
        
        const assistantMessage: CopilotMessage = {
          id: `ast_${Date.now()}`,
          role: 'assistant',
          content: responseText,
          timestamp: 'Agora',
          actionBadge,
          suggestedFollowUps: [],
          pendingConfirmation,
        };

        setChatHistory((prev) => [...prev, assistantMessage]);
        return;
      } else if (lower.includes('paguei') || lower.includes('gastei') || lower.includes('comprei') || lower.includes('pago')) {
        const matchAmount = trimmed.match(/(?:R\$\s*)?([\d.,]+)/i);
        const amountFound = matchAmount ? parseFloat(matchAmount[1].replace('.', '').replace(',', '.')) : 320;
        const validAmount = isNaN(amountFound) ? 320 : amountFound;

        let cleanTitle = trimmed
          .replace(/^(?:eu\s+)?(?:paguei|gastei|comprei)\s+/i, '')
          .replace(/(?:de\s+)?(?:R\$\s*)?[\d.,]+/i, '')
          .trim();
        if (!cleanTitle || cleanTitle.length < 2) cleanTitle = 'Despesa Avulsa';

        let inferredCategory = 'Alimentação / Mercado';
        if (lower.includes('feira') || lower.includes('hortifruti') || lower.includes('quitanda') || lower.includes('sacolao') || lower.includes('pastel') || lower.includes('legume') || lower.includes('verdura')) {
          inferredCategory = 'Alimentação & Mercado (Feira Livre & Hortifrúti)';
        } else if (lower.includes('uber') || lower.includes('combustivel') || lower.includes('gasolina') || lower.includes('transporte')) {
          inferredCategory = 'Transporte';
        } else if (lower.includes('farmacia') || lower.includes('remedio') || lower.includes('saude')) {
          inferredCategory = 'Saúde';
        } else if (lower.includes('energia') || lower.includes('luz') || lower.includes('agua') || lower.includes('aluguel') || lower.includes('internet')) {
          inferredCategory = 'Utilidades / Moradia';
        }

        const pendingConfirmation: CopilotPendingConfirmation = {
          step: 'PAYMENT_METHOD',
          pendingData: {
            rawTitle: cleanTitle,
            amount: validAmount,
            dueDate: new Date().toISOString().split('T')[0],
            type: 'PAGAR',
            category: inferredCategory,
          },
          question: 'De que forma esse pagamento ocorreu?',
          options: [
            {
              id: 'opt_pay_nubank_debito',
              label: 'Nubank (Conta / Pix)',
              icon: '🟣',
              badge: 'Débito Imediato',
              description: 'Debitar agora do saldo em conta corrente',
              payload: { bank: 'Nubank', type: 'PAGAR', category: inferredCategory },
            },
            {
              id: 'opt_pay_inter_debito',
              label: 'Inter (Conta / Pix)',
              icon: '🟠',
              badge: 'Débito Imediato',
              description: 'Debitar agora do saldo em conta corrente',
              payload: { bank: 'Inter', type: 'PAGAR', category: inferredCategory },
            },
            {
              id: 'opt_pay_nubank_credito',
              label: 'Cartão Nubank Mastercard Black',
              icon: '💳',
              badge: 'Cartão de Crédito',
              description: 'Lançar na fatura aberta (a pagar)',
              payload: { bank: 'Nubank', type: 'CARTAO', category: inferredCategory },
            },
            {
              id: 'opt_pay_xp_credito',
              label: 'Cartão XP Visa Infinite',
              icon: '💳',
              badge: 'Cartão de Crédito',
              description: 'Lançar na fatura aberta (a pagar)',
              payload: { bank: 'XP', type: 'CARTAO', category: inferredCategory },
            },
            {
              id: 'opt_pay_dinheiro',
              label: 'Dinheiro em Espécie',
              icon: '💵',
              badge: 'Carteira Física',
              description: 'Não debita contas bancárias cadastradas',
              payload: { bank: 'Dinheiro', type: 'PAGAR', category: inferredCategory },
            },
          ],
        };

        responseText = `Identifiquei uma despesa de **${validAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}** (${cleanTitle}).\n\nPara garantir a exatidão das suas contas e faturas, **de que forma esse pagamento ocorreu?**`;
        actionBadge = 'CONFIRMAR FORMA DE PAGAMENTO';
        
        const assistantMessage: CopilotMessage = {
          id: `ast_${Date.now()}`,
          role: 'assistant',
          content: responseText,
          timestamp: 'Agora',
          actionBadge,
          suggestedFollowUps: [],
          pendingConfirmation,
        };

        setChatHistory((prev) => [...prev, assistantMessage]);
        return;
      } else if (lower.includes('por que') && (lower.includes('caiu') || lower.includes('saldo') || lower.includes('diminuiu'))) {
        responseText = `Auditoria Concluída: Seu saldo projetado teve redução devido a 2 compromissos de alto impacto concentrados nos próximos 8 dias:\n\n1. Fatura Nubank Black: R$ 3.850,00 (Vencimento em 4 dias)\n2. Parcela de Empréstimo Consignado: R$ 1.458,51 (Vencimento em 8 dias)\n\nJuntos, esses dois eventos somam R$ 5.308,51. Nenhum erro contábil ou cobrança indevida foi detectada.`;
        actionBadge = 'AUDITORIA FINANCEIRA';
        suggestedFollowUps = ['Como posso otimizar essas despesas?', 'Simular quitação do empréstimo'];
      } else if (lower.includes('carro') || lower.includes('posso comprar')) {
        const sim = runSimulation('CARRO');
        responseText = `Análise de Viabilidade: ${sim.verdict === 'COM_RESTRICAO' ? '⚠️ Viável com Restrições' : 'Simulação Executada'}.\n\n${sim.explanation}\n\nRecomendações:\n• ${sim.actionRecommendations.join('\n• ')}`;
        actionBadge = 'DECISÃO FINANCEIRA';
        suggestedFollowUps = ['Simular quitar o empréstimo', 'Ver impacto nas minhas metas'];
      } else if (lower.includes('novo empréstimo') || lower.includes('novo emprestimo') || lower.includes('pegar empréstimo') || lower.includes('pegar emprestimo') || lower.includes('tomar emprestimo')) {
        const sim = runSimulation('NOVO_EMPRESTIMO');
        responseText = `Simulação de Novo Empréstimo: ${sim.verdict === 'COM_RESTRICAO' ? '⚠️ Viável com Restrições' : 'Simulação Concluída'}.\n\n${sim.explanation}\n\nRecomendações:\n• ${sim.actionRecommendations.join('\n• ')}`;
        actionBadge = 'SIMULAÇÃO DE CRÉDITO';
      } else if (lower.includes('analis') || lower.includes('auditar') || lower.includes('diagnostico') || lower.includes('diagnóstico') || lower.includes('esta tela') || lower.includes('tela de')) {
        let screenAnalysis = '';
        if (lower.includes('fatura') || lower.includes('cartao') || lower.includes('cartão')) {
          screenAnalysis = `💳 **Auditoria da Tela de Faturas & Cartões:**\n\n• **Cartão Nubank Mastercard Black:** Fatura aberta de R$ 3.850,00 com vencimento em 06/10.\n• **Uso de Limite:** 32% utilizado (nível seguro < 40%).\n• **Recomendação:** Seu fluxo previsto no dia 05 cobrirá integralmente a fatura sem necessidade de crédito rotativo.`;
        } else if (lower.includes('emprestimo') || lower.includes('empréstimo') || lower.includes('divida') || lower.includes('dívida')) {
          screenAnalysis = `🏛️ **Auditoria da Tela de Empréstimos & Dívidas (PRICE):**\n\n• **Contrato Ativo:** Consignado Operacional com parcela de R$ 1.458,51/mês.\n• **Direito BACEN nº 3.516:** Você tem direito à amortização com deságio integral dos juros futuros.\n• **Recomendação:** Aportar parte do fluxo livre mensal reduzirá em até 8 meses o término da dívida.`;
        } else if (lower.includes('natureza') || lower.includes('teto') || lower.includes('orcamento') || lower.includes('orçamento')) {
          screenAnalysis = `🏷️ **Auditoria da Tela de Naturezas & Tetos:**\n\n• **Status Global:** ${natures.length} naturezas orçamentárias monitoradas.\n• **Consumo Médio:** 68% do teto mensal consumido até o momento.\n• **Atenção:** Mantenha atenção nas rotinas semanais de alimentação para evitar estouro na última semana do mês.`;
        } else if (lower.includes('meta')) {
          screenAnalysis = `🎯 **Auditoria da Tela de Metas Financeiras:**\n\n• **Metas Ativas:** ${goals.length} cadastradas.\n• **Viabilidade:** Com seu fluxo livre atual (+R$ ${monthlyFreeCashflow.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês), todas as metas projetadas estão com ritmo de aceleração positivo.`;
        } else if (lower.includes('moviment') || lower.includes('lancamento') || lower.includes('lançamento')) {
          screenAnalysis = `📝 **Auditoria da Tela de Lançamentos & Movimentações:**\n\n• **Volume de Registros:** Movimentações operacionais registradas e conciliadas.\n• **Fluxo do Ciclo:** Saldo operacional positivo em conta corrente.\n• **Dica:** Utilize o OCR com comprovantes fiscais para automatizar lançamentos recorrentes.`;
        } else {
          // Dashboard / Visão Geral
          screenAnalysis = `📊 **Auditoria da Tela Aberta (Meu Dinheiro / Dashboard):**\n\n• **Saldo Disponível em Caixa:** R$ ${availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n• **Previsão 30 Dias:** Receitas de +R$ ${forecast30d.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vs Despesas de -R$ ${forecast30d.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n• **Resultado Projetado:** ${forecast30d.net >= 0 ? '+' : ''}R$ ${forecast30d.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} gerando saldo final de R$ ${forecast30d.projectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n• **Reserva de Emergência:** ${emergencyReserveMonths} meses de runway seguro.\n• **Diagnóstico:** ${nextCriticalEvent ? `Atenção ao evento crítico '${nextCriticalEvent.title}' em ${nextCriticalEvent.daysRemaining} dias.` : 'Fluxo de caixa perfeitamente equilibrado e sem riscos imediatos.'}`;
        }
        responseText = screenAnalysis;
        actionBadge = 'AUDITORIA DE TELA EM TEMPO REAL';
        suggestedFollowUps = ['Por que meu saldo projetado caiu?', 'Simular quitação do empréstimo', 'Anexar Comprovante / Cupom'];
      } else {
        responseText = `Entendido perfeitamente. Seus dados financeiros indicam que você tem R$ ${availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em saldo disponível e um fluxo líquido mensal positivo de R$ ${monthlyFreeCashflow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Posso agendar uma movimentação, simular uma decisão ou auditar qualquer valor para você.`;
        actionBadge = 'ASSISTENTE OPERACIONAL';
        suggestedFollowUps = ['Receberei R$ 8.500 dia 5.', 'Simular novo empréstimo', 'Por que meu saldo projetado caiu?'];
      }

      const assistantMessage: CopilotMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: 'Agora',
        actionBadge,
        suggestedFollowUps,
      };

      setChatHistory((prev) => [...prev, assistantMessage]);
    }, 400);
  };

  // Responder a uma opção interativa do Copilot
  const respondToCopilotOption = (messageId: string, option: CopilotInteractiveOption) => {
    const targetMsg = chatHistory.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.pendingConfirmation) return;

    const pending = targetMsg.pendingConfirmation.pendingData;

    // Caso o usuário queira ajustar o valor / favorecido
    if (option.payload.action === 'ADJUST_AMOUNT') {
      const userAdjustMsg: CopilotMessage = {
        id: `usr_${Date.now()}`,
        role: 'user',
        content: '✏️ Gostaria de ajustar os dados deste lançamento.',
        timestamp: 'Agora',
      };

      const assistantAdjustReply: CopilotMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: `Sem problemas! Como você prefere ajustar?\n\nVocê pode digitar diretamente na barra de texto abaixo (ex: *"Gastei R$ 42 na feira via Pix Inter"* ou *"Paguei 55 reais no dinheiro"*), e eu registrarei a movimentação com a conciliação determinística exata.`,
        timestamp: 'Agora',
        actionBadge: 'AJUSTE DE LANÇAMENTO',
        suggestedFollowUps: ['Paguei R$ 40 na feira no Pix', 'Paguei R$ 50 no cartão', 'Paguei R$ 35 em dinheiro'],
      };

      setChatHistory((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, pendingConfirmation: undefined } : m)).concat(userAdjustMsg, assistantAdjustReply)
      );
      return;
    }

    const userConfirmMsg: CopilotMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: `Paguei via ${option.label} (${option.badge})`,
      timestamp: 'Agora',
    };

    setChatHistory((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, pendingConfirmation: undefined } : m)).concat(userConfirmMsg)
    );

    const isCredit = option.payload.type === 'CARTAO';
    const isIncome = option.payload.type === 'RECEBER';
    const finalBank = option.payload.bank || pending.bank || 'Nubank';
    const finalType = option.payload.type || pending.type;
    const finalCategory = option.payload.category || pending.category || 'Geral';

    addMovement({
      title: `${isIncome ? 'Recebimento' : 'Despesa'}: ${pending.rawTitle}`,
      type: finalType,
      amount: pending.amount,
      dueDate: isCredit ? '2026-10-06' : pending.dueDate,
      bank: finalBank,
      status: isCredit || isIncome ? 'PREVISTA' : 'REALIZADA',
      category: finalCategory,
      notes: `Confirmado via Forseti: ${option.label} (${option.badge}).`,
    });

    setTimeout(() => {
      let confirmationText = '';
      if (isCredit) {
        confirmationText = `✓ **Lançamento Registrado no Cartão com Sucesso!**\n\nAdicionei a despesa de **${pending.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}** na fatura do **${option.label}**.\n\n• **Categoria:** ${finalCategory}\n• **Status:** Prevista para a próxima fatura\n• **Impacto:** O valor não afetou seu saldo líquido imediato em conta.`;
      } else if (isIncome) {
        confirmationText = `✓ **Receita Programada com Sucesso!**\n\nAgendei o recebimento de **${pending.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}** na conta **${option.label}** para o dia 05.\n\n• **Categoria:** ${finalCategory}\n• **Impacto:** Saldo projetado para 30 dias foi recalculado.`;
      } else {
        confirmationText = `✓ **Pagamento Confirmado e Concluído!**\n\nRegistrei a saída de **${pending.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}** como realizada via **${option.label}**.\n\n• **Categoria:** ${finalCategory}\n• **Impacto:** Saldo disponível da conta ajustado instantaneamente.`;
      }

      const botConfirmMsg: CopilotMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: confirmationText,
        timestamp: 'Agora',
        actionBadge: 'LANÇAMENTO DETERMINÍSTICO',
        suggestedFollowUps: ['Quanto sobrou para gastar no mês?', 'Ver minhas movimentações', 'Registrar outro pagamento'],
      };

      setChatHistory((prev) => [...prev, botConfirmMsg]);
    }, 300);
  };

  // Conciliar Cupom / Nota Fiscal com Mapeamento de Gastos Fixos e Aprendizado Contínuo
  const reconcileReceiptData = (messageId: string, data: ReceiptReconciliationData) => {
    // 1. Registrar a movimentação determinística no fluxo de caixa
    const isCredit = data.paymentMethod === 'CARTAO';
    const finalBank = data.paymentMethod === 'DINHEIRO' ? 'Dinheiro' : (data.paymentMethod === 'CARTAO' ? 'Nubank' : 'Inter');

    addMovement({
      title: `${data.store}`,
      type: isCredit ? 'CARTAO' : 'PAGAR',
      amount: data.totalAmount,
      dueDate: isCredit ? '2026-10-06' : data.date,
      bank: finalBank,
      status: isCredit ? 'PREVISTA' : 'REALIZADA',
      category: 'Alimentação & Mercado',
      notes: `Conciliação de cupom fiscal com ${data.items.length} itens do ${data.store}.`,
    });

    // 2. Atualizar os itens de mapeamento em ExpenseNature e adicionar novos itens com quantidade 0
    let newlyMappedCount = 0;
    const allocatedByRoutine: Record<string, number> = {};

    setNatures((prevNatures) => {
      let modifiedNatId: string | undefined;
      let updatedMappingsToSave: FixedExpenseMapping[] = [];

      const next = prevNatures.map((nat) => {
        const isAlimentacao =
          nat.id === 'nat_alimentacao' ||
          nat.name.toLowerCase().includes('aliment') ||
          nat.name.toLowerCase().includes('mercado');

        if (!isAlimentacao) return nat;

        modifiedNatId = nat.id;
        const updatedMappings = nat.mappings.map((mapping) => {
          const updatedItems = mapping.items.map((mItem) => {
            const matchedReceiptItems = data.items.filter((rItem) => rItem.matchedMappingItemId === mItem.id);
            if (matchedReceiptItems.length > 0) {
              const addedSum = matchedReceiptItems.reduce((acc, curr) => acc + curr.price, 0);
              allocatedByRoutine[mapping.name] = (allocatedByRoutine[mapping.name] || 0) + addedSum;

              // Memorizar associação para os próximos cupons
              matchedReceiptItems.forEach((rItem) => {
                learnReceiptItemAssociation(rItem.rawName, mItem.id, mapping.id, nat.id);
              });

              const lastPrice = matchedReceiptItems[matchedReceiptItems.length - 1].price;
              return {
                ...mItem,
                realizedValue: (mItem.realizedValue || 0) + addedSum,
                price: lastPrice, // Reflete o preço mais recente praticado na compra
              };
            }
            return mItem;
          });

          // Adicionar novos itens sugeridos com quantidade 0 (conforme solicitado pelo usuário!)
          const itemsToAddToThisMapping = data.items.filter(
            (rItem) => rItem.isNewSuggestedItem && (rItem.targetMappingId === mapping.id || (!rItem.targetMappingId && (mapping.id === 'map_mercado_mensal' || mapping.id.includes('mercado'))))
          );

          if (itemsToAddToThisMapping.length > 0) {
            itemsToAddToThisMapping.forEach((rItem) => {
              newlyMappedCount++;
              allocatedByRoutine[mapping.name] = (allocatedByRoutine[mapping.name] || 0) + rItem.price;
              const newItemId = `item_new_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

              learnReceiptItemAssociation(rItem.rawName, newItemId, mapping.id, nat.id);

              updatedItems.push({
                id: newItemId,
                description: rItem.detectedName,
                quantity: 0, // Solicitado: mapear no sistema com quantidade 0
                price: rItem.price,
                multiplierWeeks: 1,
                totalValue: 0,
                realizedValue: rItem.price,
                isFulfilled: true,
                paymentMethod: isCredit ? 'CARTAO' : 'PIX',
              });
            });
          }

          return { ...mapping, items: updatedItems };
        });

        updatedMappingsToSave = updatedMappings;
        return { ...nat, mappings: updatedMappings };
      });

      if (modifiedNatId) {
        saveNaturesData(next, modifiedNatId, { mappings: updatedMappingsToSave });
      } else {
        saveNaturesData(next);
      }
      return next;
    });

    // 3. Atualizar o histórico do chat com confirmação e aprendizado
    const userFeedbackMsg: CopilotMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: `✓ Conciliei a compra do ${data.store} (${data.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`,
      timestamp: 'Agora',
    };

    const routineBreakdown = Object.entries(allocatedByRoutine)
      .map(([rName, rVal]) => `• **${rName}:** +${rVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
      .join('\n');

    const assistantConfirmMsg: CopilotMessage = {
      id: `ast_${Date.now()}`,
      role: 'assistant',
      content: `✓ **Cupom Conciliado & Aprendizado Registrado!**\n\nLancei o pagamento de **${data.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}** no seu fluxo de caixa via **${data.paymentMethod === 'DINHEIRO' ? 'Dinheiro em Espécie' : data.paymentMethod}**.\n\n📊 **Distribuição nos Gastos Fixos:**\n${routineBreakdown || '• Registrado na categoria Alimentação & Mercado'}\n\n🧠 **Memória do Forseti Atualizada:**\n${newlyMappedCount > 0 ? `• ${newlyMappedCount} novos itens foram adicionados ao seu mapeamento com **quantidade 0** (disponíveis para fácil associação futura).\n` : ''}• Todas as associações e variações de preço deste cupom foram memorizadas no Balder. Da próxima vez que esse cupom ou itens semelhantes forem enviados, a identificação será 100% automática!`,
      timestamp: 'Agora',
      actionBadge: 'CONCILIAÇÃO E APRENDIZADO IA',
      suggestedFollowUps: ['Ver minhas movimentações', 'Ver grid de naturezas e gastos fixos', 'Anexar outro comprovante'],
    };

    setChatHistory((prev) =>
      prev
        .map((m) =>
          m.id === messageId
            ? {
                ...m,
                pendingConfirmation: undefined,
                receiptReconciliation: { ...data, isReconciled: true },
              }
            : m
        )
        .concat(userFeedbackMsg, assistantConfirmMsg)
    );
  };

  // Exportar dados para CSV estruturado
  const exportToCSV = () => {
    const headers = ['ID', 'Titulo', 'Tipo', 'Valor', 'Vencimento', 'Banco', 'Status', 'Categoria', 'Notas'];
    const rows = movements.map((m) => [
      m.id,
      `"${m.title}"`,
      m.type,
      m.amount.toFixed(2),
      m.dueDate,
      m.bank,
      m.status,
      `"${m.category}"`,
      `"${m.notes || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BALDER_MOVIMENTACOES_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // NATUREZAS & MAPEAMENTOS DE GASTOS FIXOS
  // ==========================================

  // Sincronização centralizada de Naturezas (Supabase Cloud + localStorage)
  const saveNaturesData = (
    updatedNatures: ExpenseNature[],
    modifiedNatureId?: string,
    fieldsToSync?: Partial<ExpenseNature>
  ) => {
    try {
      const storageKey = user && !user.isGuest ? `balder_natures_${user.$id}` : 'balder_natures_guest';
      localStorage.setItem(storageKey, JSON.stringify(updatedNatures));
    } catch (e) {
      console.warn('Erro ao salvar naturezas no localStorage:', e);
    }

    if (user && !user.isGuest && modifiedNatureId) {
      const targetNat = updatedNatures.find((n) => n.id === modifiedNatureId);
      if (targetNat) {
        const payload: Partial<ExpenseNature> = fieldsToSync || {
          mappings: targetNat.mappings,
          overCeilingJustification: targetNat.overCeilingJustification,
          justificationHistory: targetNat.justificationHistory,
        };
        SupabaseService.updateNature(targetNat.id, payload).catch((err) =>
          console.error(`Erro ao sincronizar natureza ${targetNat.id} no Supabase:`, err)
        );
      }
    }
  };

  // Adicionar Nova Natureza
  const addNature = (natureData: Omit<ExpenseNature, 'id' | 'mappings'> & { mappings?: FixedExpenseMapping[] }): string => {
    const tempId = `nat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newNature: ExpenseNature = {
      name: natureData.name,
      color: natureData.color,
      icon: natureData.icon,
      type: natureData.type,
      description: natureData.description,
      id: tempId,
      mappings: natureData.mappings || [],
      overCeilingJustification: '',
      justificationHistory: [],
    };
    setNatures((prev) => {
      const next = [...prev, newNature];
      saveNaturesData(next);
      return next;
    });

    if (user && !user.isGuest) {
      SupabaseService.addNature(newNature)
        .then((created) => {
          if (created) {
            setNatures((prev) => {
              const next = prev.map((nat) => {
                if (nat.id === tempId) {
                  const updated = { ...nat, id: created.id };
                  if (updated.mappings && updated.mappings.length > 0) {
                    SupabaseService.updateNature(created.id, { mappings: updated.mappings }).catch(console.error);
                  }
                  return updated;
                }
                return nat;
              });
              saveNaturesData(next);
              return next;
            });
          }
        })
        .catch((err) => console.error('Erro ao criar natureza no Supabase:', err));
    }
    return tempId;
  };

  // Atualizar Natureza
  const updateNature = (id: string, updates: Partial<ExpenseNature>) => {
    setNatures((prev) => {
      const oldNat = prev.find((n) => n.id === id);
      const next = prev.map((nat) => (nat.id === id ? { ...nat, ...updates } : nat));
      saveNaturesData(next, id, updates);

      if (oldNat && updates.name && updates.name !== oldNat.name) {
        setMovements((prevMovs) =>
          prevMovs.map((m) => (m.category === oldNat.name ? { ...m, category: updates.name! } : m))
        );
      }

      return next;
    });
  };

  // Excluir Natureza
  const deleteNature = (id: string) => {
    setNatures((prev) => {
      const next = prev.filter((nat) => nat.id !== id);
      saveNaturesData(next);
      return next;
    });
    if (user && !user.isGuest) {
      SupabaseService.deleteNature(id).catch((err) =>
        console.error('Erro ao excluir natureza no Supabase:', err)
      );
    }
  };

  // Adicionar Mapeamento a uma Natureza
  const addMappingToNature = (
    natureId: string,
    name: string,
    applicableMonths?: number[],
    dayOfMonth?: number,
    icon?: string
  ): string => {
    const newMappingId = `map_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newMapping: FixedExpenseMapping = {
      id: newMappingId,
      natureId,
      name,
      icon: icon || '📋',
      applicableMonths: applicableMonths || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      items: [],
      dayOfMonth: dayOfMonth ? Math.min(31, Math.max(1, dayOfMonth)) : undefined,
    };

    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = [...nat.mappings, newMapping];
          return {
            ...nat,
            mappings: updatedMappings,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });

    return newMappingId;
  };

  // Atualizar Mapeamento
  const updateMapping = (
    natureId: string,
    mappingId: string,
    updates: Partial<FixedExpenseMapping>
  ) => {
    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = nat.mappings.map((m) => {
            if (m.id === mappingId) {
              return { ...m, ...updates };
            }
            return m;
          });
          return {
            ...nat,
            mappings: updatedMappings,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });
  };

  // Excluir Mapeamento
  const deleteMapping = (natureId: string, mappingId: string) => {
    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = nat.mappings.filter((m) => m.id !== mappingId);
          return {
            ...nat,
            mappings: updatedMappings,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });
  };

  // Adicionar Item ao Mapeamento
  const addItemToMapping = (
    natureId: string,
    mappingId: string,
    itemData: Omit<MappingItem, 'id' | 'totalValue'>,
    customId?: string
  ): string => {
    const mult = itemData.multiplierWeeks > 0 ? itemData.multiplierWeeks : 1;
    const rawQty = Math.round((Number(itemData.quantity) || 0) * 1000) / 1000;
    const rawPrice = Math.round((Number(itemData.price) || 0) * 1000) / 1000;
    const totalValue = Math.round(rawQty * rawPrice * mult * 1000) / 1000;

    const newItemId = customId || `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newItem: MappingItem = {
      ...itemData,
      quantity: rawQty,
      price: rawPrice,
      id: newItemId,
      multiplierWeeks: mult,
      totalValue,
      realizedValue: itemData.realizedValue || 0,
      isFulfilled: itemData.isFulfilled || false,
    };

    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = nat.mappings.map((m) => {
            if (m.id === mappingId) {
              return {
                ...m,
                items: [...m.items, newItem],
              };
            }
            return m;
          });
          return {
            ...nat,
            mappings: updatedMappings,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });

    return newItemId;
  };

  // Atualizar Item de Mapeamento
  const updateMappingItem = (
    natureId: string,
    mappingId: string,
    itemId: string,
    updates: Partial<MappingItem>
  ) => {
    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = nat.mappings.map((m) => {
            if (m.id === mappingId) {
              return {
                ...m,
                items: m.items.map((item) => {
                  if (item.id === itemId) {
                    const updated = { ...item, ...updates };
                    const mult = updated.multiplierWeeks > 0 ? updated.multiplierWeeks : 1;
                    const rawQty = Math.round((Number(updated.quantity) || 0) * 1000) / 1000;
                    const rawPrice = Math.round((Number(updated.price) || 0) * 1000) / 1000;
                    updated.quantity = rawQty;
                    updated.price = rawPrice;
                    updated.multiplierWeeks = mult;
                    updated.totalValue = Math.round(rawQty * rawPrice * mult * 1000) / 1000;
                    return updated;
                  }
                  return item;
                }),
              };
            }
            return m;
          });
          return {
            ...nat,
            mappings: updatedMappings,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });
  };

  // Excluir Item de Mapeamento
  const deleteMappingItem = (natureId: string, mappingId: string, itemId: string) => {
    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = nat.mappings.map((m) => {
            if (m.id === mappingId) {
              return {
                ...m,
                items: m.items.filter((item) => item.id !== itemId),
              };
            }
            return m;
          });
          return {
            ...nat,
            mappings: updatedMappings,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });
  };

  // Alternar realização de item (marcar como cumprido no mês)
  const toggleItemFulfilled = (natureId: string, mappingId: string, itemId: string) => {
    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = nat.mappings.map((m) => {
            if (m.id === mappingId) {
              return {
                ...m,
                items: m.items.map((item) => {
                  if (item.id === itemId) {
                    const willBeFulfilled = !item.isFulfilled;
                    return {
                      ...item,
                      isFulfilled: willBeFulfilled,
                      realizedValue: willBeFulfilled ? item.totalValue : 0,
                    };
                  }
                  return item;
                }),
              };
            }
            return m;
          });
          return {
            ...nat,
            mappings: updatedMappings,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });
  };

  // Marcar múltiplos itens de mapeamento como realizados em lote (ex: conciliação de fatura aberta)
  const markMappingItemsFulfilled = (
    itemsToFulfill: Array<{ natureId: string; mappingId: string; itemId: string; realizedValue?: number }>
  ) => {
    if (!itemsToFulfill || itemsToFulfill.length === 0) return;
    setNatures((prev) => {
      const next = prev.map((nat) => {
        const matchingForNat = itemsToFulfill.filter((it) => it.natureId === nat.id);
        if (matchingForNat.length === 0) return nat;

        const updatedMappings = nat.mappings.map((m) => {
          const matchingForMap = matchingForNat.filter((it) => it.mappingId === m.id);
          if (matchingForMap.length === 0) return m;

          return {
            ...m,
            items: m.items.map((item) => {
              const matched = matchingForMap.find((it) => it.itemId === item.id);
              if (matched) {
                return {
                  ...item,
                  isFulfilled: true,
                  realizedValue: matched.realizedValue !== undefined ? matched.realizedValue : item.totalValue,
                };
              }
              return item;
            }),
          };
        });

        return {
          ...nat,
          mappings: updatedMappings,
        };
      });

      if (isCloudUser && user) {
        try {
          localStorage.setItem(`balder_natures_${user.$id}`, JSON.stringify(next));
        } catch {}
      } else {
        localStorage.setItem('balder_natures', JSON.stringify(next));
      }

      return next;
    });
  };

  // Registrar Justificativa Contábil de Estouro de Teto
  const saveCeilingJustification = (natureId: string, reason: string) => {
    const targetNature = natures.find((n) => n.id === natureId);
    if (!targetNature) return;

    const ceiling = getNatureCeiling(targetNature);
    const spent = getNatureSpent(targetNature);

    const newRecord: CeilingJustificationRecord = {
      id: `just_${Date.now()}`,
      date: new Date().toLocaleDateString('pt-BR'),
      month: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      ceilingAmount: ceiling,
      spentAmount: spent,
      reason,
    };

    setNatures((prev) => {
      let updatedJustHistory: CeilingJustificationRecord[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedJustHistory = [newRecord, ...(nat.justificationHistory || [])];
          return {
            ...nat,
            overCeilingJustification: reason,
            justificationHistory: updatedJustHistory,
          };
        }
        return nat;
      });
      saveNaturesData(next, natureId, {
        overCeilingJustification: reason,
        justificationHistory: updatedJustHistory,
      });
      return next;
    });
  };

  // Carregar Mapeamentos Sugeridos para uma Natureza (ex: modelos de Mercado/Feira para Alimentação)
  const loadSuggestedMappingsForNature = (natureId: string) => {
    const targetNat = natures.find((n) => n.id === natureId);
    if (!targetNat) return;

    const suggestedMappings = buildSuggestedMappingsForNature(natureId, targetNat.name, targetNat.icon);

    setNatures((prev) => {
      let updatedMappings: FixedExpenseMapping[] = [];
      const next = prev.map((nat) => {
        if (nat.id === natureId) {
          updatedMappings = [...nat.mappings, ...suggestedMappings];
          return { ...nat, mappings: updatedMappings };
        }
        return nat;
      });
      saveNaturesData(next, natureId, { mappings: updatedMappings });
      return next;
    });
  };

  // Cálculo Matemático Rigoroso do Teto da Natureza (Soma de todos os itens de todos os mapeamentos)
  const getNatureCeiling = (nature: ExpenseNature): number => {
    if (!nature || !nature.mappings) return 0;
    const total = nature.mappings.reduce((accMap, map) => {
      const mapTotal = (map.items || []).reduce((accItem, it) => accItem + (it.totalValue || 0), 0);
      return accMap + mapTotal;
    }, 0);
    return Math.round(total * 1000) / 1000;
  };

  // Cálculo de Gasto Real da Natureza no Mês Atual
  const getNatureSpent = (nature: ExpenseNature): number => {
    if (!nature) return 0;

    // 1. Soma dos itens marcados com realizedValue dentro dos mapeamentos
    const itemRealizedSum = (nature.mappings || []).reduce((accMap, map) => {
      return accMap + (map.items || []).reduce((accItem, it) => accItem + (it.realizedValue || 0), 0);
    }, 0);

    // 2. Soma das movimentações registradas vinculadas a esta categoria/natureza
    const normalizedNatureName = nature.name.toLowerCase();
    const movementsSum = movements
      .filter((m) => {
        if (m.type !== 'PAGAR' && m.type !== 'CARTAO') return false;
        const normCat = (m.category || '').toLowerCase();
        return (
          normCat.includes(normalizedNatureName) ||
          normalizedNatureName.includes(normCat) ||
          (normCat.includes('alimentação') && normalizedNatureName.includes('alimentação')) ||
          (normCat.includes('moradia') && normalizedNatureName.includes('moradia')) ||
          (normCat.includes('educação') && normalizedNatureName.includes('educação')) ||
          (normCat.includes('saúde') && normalizedNatureName.includes('saúde'))
        );
      })
      .reduce((acc, cur) => acc + cur.amount, 0);

    return Math.max(itemRealizedSum, movementsSum);
  };

  // Apuração de Itens em Falta (para responder com precisão qual item falta quando estiver longe do teto)
  const getNatureMissingItems = (
    nature: ExpenseNature
  ): Array<{ item: MappingItem; mappingName: string; missingAmount: number }> => {
    if (!nature || !nature.mappings) return [];

    const missingList: Array<{ item: MappingItem; mappingName: string; missingAmount: number }> = [];

    nature.mappings.forEach((mapping) => {
      (mapping.items || []).forEach((item) => {
        const realized = item.realizedValue || 0;
        const missing = item.totalValue - realized;
        if (!item.isFulfilled && missing > 0) {
          missingList.push({
            item,
            mappingName: mapping.name,
            missingAmount: Math.round(missing * 100) / 100,
          });
        }
      });
    });

    // Ordenar pelos que mais faltam em valor
    return missingList.sort((a, b) => b.missingAmount - a.missingAmount);
  };

  return (
    <FinancialContext.Provider
      value={{
        isDataReady,
        accounts,
        cards,
        paymentMethods,
        banks,
        salaryContracts,
        movements,
        goals,
        criticalEvents,
        chatHistory,
        natures,
        checkpoints,
        activeCheckpoint,
        addCheckpoint,
        activateCheckpoint,
        deleteCheckpoint,
        monthlyClosings,
        closeMonth,
        reopenMonth,
        getMonthlyClosing,
        totalNetWorth,

        availableBalance,

        monthlyFreeCashflow,
        emergencyReserveMonths,
        emergencyReserveAmount,
        forecast30d,
        nextCriticalEvent,
        addAccount,
        updateAccount,
        deleteAccount,
        addCard,
        updateCard,
        deleteCard,
        addPaymentMethod,
        updatePaymentMethod,
        deletePaymentMethod,
        addBank,
        updateBank,
        deleteBank,
        addSalaryContract,
        updateSalaryContract,
        deleteSalaryContract,
        addSalaryAdjustment,
        updateSalaryAdjustment,
        deleteSalaryAdjustment,
        getSalaryForCompetence,
        addMovement,
        addMultipleMovements,
        updateMovement,
        deleteMovement,
        toggleMovementStatus,
        prepayInstallments,
        addGoal,
        updateGoal,
        runSimulation,
        simulateCustomFutureScenario,
        applyScenarioToBudget,
        sendMessageToCopilot,
        respondToCopilotOption,
        exportToCSV,
        addNature,
        updateNature,
        deleteNature,
        addMappingToNature,
        updateMapping,
        deleteMapping,
        addItemToMapping,
        updateMappingItem,
        deleteMappingItem,
        toggleItemFulfilled,
        markMappingItemsFulfilled,
        saveCeilingJustification,
        getNatureCeiling,
        getNatureSpent,
        getNatureMissingItems,
        reconcileReceiptData,
        loadSuggestedMappingsForNature,
        activeTrackingScope,
        defaultTrackingScope,
        setActiveTrackingScope,
        setDefaultTrackingScope,
        sharedScenario,
        updateSharedScenario,
        sharedSettlements,
        addSharedSettlement,
        toggleSharedSettlementStatus,
        settleAllSharedDebts,
      }}
    >
      {children}
    </FinancialContext.Provider>
  );
};

export const useFinancial = () => {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error('useFinancial deve ser utilizado dentro de um FinancialProvider');
  }
  return context;
};

