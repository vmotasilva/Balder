import { type BankAccount, type BankInstitution, type CopilotAttachment, type CopilotInteractiveOption, type CopilotMessage, type CopilotPendingConfirmation, type CreditCardItem, type CriticalEvent, type CustomScenarioInput, type DataFormatCategory, type ExpenseNature, type FinancialCheckpoint, type FixedExpenseMapping, type ForsetiActivity, type FutureScenarioResult, type Goal, type GoalStatusInfo, type MappingItem, type MonthlyClosing, type Movement, type NatureDetailMode, type PaymentMethodItem, type PaymentWizardState, type ReceiptReconciliationData, type SharedScenario, type SharedSettlementItem, type SharedSplitRule, type SimulationPresetId, type SimulationScenario, type TrackingScopeMode, type ViewPreferences } from '../../types';
import { type ForecastPeriod, type ForecastWindow } from '../../utils/forecastWindow';

/** Item do mapeamento a marcar como feito; com monthKey, o pagamento também entra no "Real" da competência. */
export interface FulfilledItemInput {
  natureId: string;
  mappingId: string;
  itemId: string;
  realizedValue?: number;
  monthKey?: string;      // competência (YYYY-MM) do pagamento
  paidAt?: string;        // data do pagamento (YYYY-MM-DD)
  movementId?: string;    // movimentação de origem
  previousAmount?: number; // valor anterior da movimentação (substitui o pagamento já lançado)
}

export interface FinancialContextType {
  // Estado
  isDataReady: boolean;   // true quando dados do Supabase (ou DEMO) já foram carregados
  accounts: BankAccount[];
  cards: CreditCardItem[];
  paymentMethods: PaymentMethodItem[];
  banks: BankInstitution[];
  movements: Movement[];
  goals: Goal[];
  criticalEvents: CriticalEvent[];
  chatHistory: CopilotMessage[];
  natures: ExpenseNature[];

  // Marco de Acompanhamento Financeiro & Planejamento / Cenários
  checkpoints: FinancialCheckpoint[];
  activeCheckpoint: FinancialCheckpoint | null;
  addCheckpoint: (cp: Omit<FinancialCheckpoint, 'id' | 'createdAt' | 'isActive'>) => string;
  updateCheckpoint: (id: string, updates: Partial<FinancialCheckpoint>) => void;
  activateCheckpoint: (id: string) => void;
  archiveCheckpoint: (id: string) => void;
  unarchiveCheckpoint: (id: string) => void;
  deleteCheckpoint: (id: string) => void;
  clearAllCheckpoints: () => Promise<boolean>;
  /** Apaga definitivamente (estado, caches locais e nuvem) os grupos de dados selecionados. */
  formatUserData: (categories: DataFormatCategory[]) => Promise<boolean>;
  duplicateCheckpointAsSimulation: (id: string, newLabel?: string) => void;

  // Fechamentos Mensais de Competência
  monthlyClosings: MonthlyClosing[];
  closeMonth: (monthKey: string, closingBalance: number, projectedBalance: number, notes?: string) => void;
  reopenMonth: (monthKey: string) => void;
  getMonthlyClosing: (monthKey: string) => MonthlyClosing | undefined;


  // Métricas Calculadas
  totalNetWorth: number;
  availableBalance: number;
  /** Saldo separado por origem: em conta e em dinheiro em mãos (somam o availableBalance). */
  accountBalance: number;
  cashInHandBalance: number;
  checkpointCashInHand: Record<string, number>;
  setCheckpointCashInHand: (checkpointId: string, amount: number) => void;
  monthlyFreeCashflow: number;
  emergencyReserveMonths: number;
  emergencyReserveAmount: number;

  /** Próximos 30 dias (base do fluxo livre mensal e da reserva em meses). */
  forecast30d: ForecastWindow;
  /** Saldo previsto de hoje até o fim de cada período (semana, quinzena, mês, 30 dias), com o detalhamento. */
  forecasts: Record<ForecastPeriod, ForecastWindow>;

  nextCriticalEvent: CriticalEvent | null;

  // Gestão de Contas, Cartões, Pagamentos e Bancos
  addAccount: (account: Omit<BankAccount, 'id'>) => void;
  updateAccount: (id: string, updates: Partial<BankAccount>) => void;
  deleteAccount: (id: string) => void;

  addCard: (card: Omit<CreditCardItem, 'id'>) => void;
  updateCard: (id: string, updates: Partial<CreditCardItem>) => void;
  deleteCard: (id: string) => void;
  mergeAndCleanDuplicateCards: () => void;

  addPaymentMethod: (method: Omit<PaymentMethodItem, 'id'>) => void;
  updatePaymentMethod: (id: string, updates: Partial<PaymentMethodItem>) => void;
  deletePaymentMethod: (id: string) => void;

  addBank: (bank: Omit<BankInstitution, 'id'>) => void;
  updateBank: (id: string, updates: Partial<BankInstitution>) => void;
  /** Fechamento e vencimento da fatura do banco (cria o banco na lista se ainda não estiver nela). */
  setBankInvoiceTerms: (bankName: string, terms: { closingDay?: number; dueDay?: number }) => void;
  /** Marca se o cartão de crédito do banco é usado (cria o banco na lista se ainda não estiver nela). */
  setBankCreditUsed: (bankName: string, used: boolean) => void;
  /** Move o vencimento das faturas em aberto do banco para o dia informado; devolve quantas mudaram. */
  applyBankDueDayToOpenInvoices: (bankName: string, dueDay: number) => number;
  /** Passa para o banco as faturas gravadas com o nome do cartão, unindo as do mesmo mês; devolve quantas ajustou. */
  consolidateCardNamedInvoices: () => number;
  deleteBank: (id: string) => void;

  // Ações Principais
  addMovement: (movement: Omit<Movement, 'id'>) => void;
  addMultipleMovements: (items: Omit<Movement, 'id'>[]) => void;
  updateMovement: (id: string, updates: Partial<Movement>) => void;
  deleteMovement: (id: string) => void;
  toggleMovementStatus: (id: string) => void;
  prepayInstallments: (movementIds: string[], discountedAmounts: Record<string, number>, paymentDate: string) => void;
  addGoal: (goal: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  /** Arquivadas/canceladas por id (sem registro = ativa). */
  goalStatuses: Record<string, GoalStatusInfo>;
  setGoalStatus: (goalId: string, info: GoalStatusInfo | null) => void;
  runSimulation: (preset: SimulationPresetId) => SimulationScenario;
  simulateCustomFutureScenario: (input: CustomScenarioInput) => FutureScenarioResult;
  applyScenarioToBudget: (result: FutureScenarioResult) => void;
  sendMessageToCopilot: (
    query: string,
    attachment?:
      | CopilotAttachment
      | CopilotAttachment[]
      | { url: string; name: string; size?: string; revoke?: () => void }
  ) => void;
  associateReceiptItemsToInvoice: (
    invoiceMovementId: string,
    items: Array<{
      id?: string;
      detectedName?: string;
      rawName?: string;
      description?: string;
      price?: number;
      amount?: number;
      natureId?: string;
      natureName?: string;
      quantity?: number;
      unit?: string;
    }>
  ) => {
    success: boolean;
    allocatedAmount: number;
    newUnanalyzed: number;
    itemsCount: number;
    invoiceTitle: string;
  };
  respondToCopilotOption: (messageId: string, option: CopilotInteractiveOption) => void;
  /** Confirma (ou cancela) a ação que a Forseti propôs no chat: abrir tela, criar natureza ou mapeamento. */
  confirmForsetiAction: (messageId: string, accept: boolean) => void;
  /** O app registra aqui como trocar de tela (a Forseti abre telas a pedido, depois da confirmação). */
  registerForsetiNavigator: (navigate: ((tab: string) => void) | null) => void;
  /** Registro de pagamento/recebimento em etapas: avança a etapa e/ou corrige os dados do lançamento. */
  updatePaymentWizard: (
    messageId: string,
    wizard?: Partial<PaymentWizardState>,
    data?: Partial<CopilotPendingConfirmation['pendingData']>
  ) => void;
  confirmPaymentWizard: (messageId: string) => void;
  cancelPaymentWizard: (messageId: string) => void;
  /** Últimas solicitações à Forseti (48 horas), com avaliação e desfazer. */
  forsetiActivity: ForsetiActivity[];
  rateForsetiActivity: (id: string, rating: ForsetiActivity['rating']) => void;
  undoForsetiActivity: (id: string) => { ok: boolean; message: string };
  reconcileReceiptData: (messageId: string, data: ReceiptReconciliationData) => void;
  exportToCSV: () => void;

  // Gestão de Naturezas & Mapeamentos de Gastos Fixos
  addNature: (nature: Omit<ExpenseNature, 'id' | 'mappings'> & { mappings?: FixedExpenseMapping[] }) => string;
  updateNature: (id: string, updates: Partial<ExpenseNature>) => void;
  deleteNature: (id: string) => void;
  addMappingToNature: (
    natureId: string,
    name: string,
    applicableMonths?: number[],
    dayOfMonth?: number,
    icon?: string,
    keywords?: string[]
  ) => string;
  updateMapping: (natureId: string, mappingId: string, updates: Partial<FixedExpenseMapping>) => void;
  deleteMapping: (natureId: string, mappingId: string) => void;
  addItemToMapping: (natureId: string, mappingId: string, item: Omit<MappingItem, 'id' | 'totalValue'>, customId?: string) => string;
  updateMappingItem: (natureId: string, mappingId: string, itemId: string, updates: Partial<MappingItem>) => void;
  updateMappingItemState: (
    natureId: string,
    mappingId: string,
    itemId: string,
    state: Partial<MappingItem>
  ) => void;
  deleteMappingItem: (natureId: string, mappingId: string, itemId: string) => void;
  moveMappingItem: (fromNatureId: string, fromMappingId: string, toNatureId: string, toMappingId: string, itemId: string) => boolean;
  moveMappingOrder: (natureId: string, mappingId: string, direction: 'UP' | 'DOWN') => void;
  reorderMappings: (natureId: string, newMappings: FixedExpenseMapping[]) => void;
  toggleItemFulfilled: (natureId: string, mappingId: string, itemId: string) => void;
  markMappingItemsFulfilled: (itemsToFulfill: FulfilledItemInput[]) => void;
  saveCeilingJustification: (natureId: string, reason: string) => void;
  loadSuggestedMappingsForNature: (natureId: string) => void;
  getNatureCeiling: (nature: ExpenseNature, month?: number | string) => number;
  getNatureSpent: (nature: ExpenseNature) => number;
  getNatureMissingItems: (nature: ExpenseNature) => Array<{ item: MappingItem; mappingName: string; missingAmount: number }>;

  // Acompanhamento Mútuo & Planejamento Compartilhado
  activeTrackingScope: TrackingScopeMode;
  defaultTrackingScope: TrackingScopeMode;
  setActiveTrackingScope: (scope: TrackingScopeMode) => void;
  setDefaultTrackingScope: (scope: TrackingScopeMode) => void;
  sharedScenario: SharedScenario | null;
  updateSharedScenario: (updates: Partial<SharedScenario>) => void;
  /** Histórico de divisão/contribuição por competência; recalcula os pendentes a partir de fromCompetence. */
  setSharedSplitRules: (rules: SharedSplitRule[], fromCompetence: string) => void;
  sharedSettlements: SharedSettlementItem[];

  // Exibição das naturezas no detalhamento da grade (itens ou só mapeamentos)
  natureDetailModes: Record<string, NatureDetailMode>;
  setNatureDetailMode: (natureId: string, mode: NatureDetailMode) => void;

  // Contratos de empréstimo: arquivar (some da lista) e excluir (apaga parcelas e captação)
  archivedLoanGroups: string[];
  setLoanGroupArchived: (groupId: string, archived: boolean) => void;
  // Até onde a projeção mês a mês enxerga (meses a partir do mês atual)
  projectionHorizonMonths: number;
  setProjectionHorizonMonths: (months: number) => void;
  // Tela inicial, modo (guiado/manual) e período de acompanhamento de quem está usando
  viewPreferences: ViewPreferences;
  setViewPreferences: (updates: Partial<ViewPreferences>) => void;
  deleteLoanContract: (groupId: string, movementIds: string[]) => void;
  addSharedSettlement: (item: Omit<SharedSettlementItem, 'id'>) => void;
  toggleSharedSettlementStatus: (id: string) => void;
  settleAllSharedDebts: () => void;
}
