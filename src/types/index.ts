export type MovementType = 'RECEBER' | 'PAGAR' | 'EMPRESTIMO' | 'CARTAO';
export type MovementStatus = 'PREVISTA' | 'REALIZADA' | 'CANCELADA';

export interface Movement {
  id: string;
  title: string;
  type: MovementType;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  bank: string;
  status: MovementStatus;
  category: string;
  notes?: string;
  installmentNumber?: number;
  installmentsTotal?: number;
  installmentGroupId?: string;
  interestRatePercent?: number; // Taxa nominal ou efetiva mensal do contrato (ex: 2.10% ou 3.03% a.m.)
  originalAmount?: number;      // Valor nominal previsto original antes do ajuste
  actualAmount?: number;        // Valor real efetivamente pago ou recebido
  paymentDate?: string;         // Data efetiva da quitação/crédito (YYYY-MM-DD)
  adjustmentReason?: string;    // Motivo do ajuste (ex: Desconto antecipação, Juros atraso, Variação consumo, Descontos folha)
  natureId?: string;            // ID da Natureza orçamentária vinculada
  mappingId?: string;           // ID do mapeamento vinculado
  mappingItemId?: string;       // ID do item do teto cumprido
  invoiceBreakdown?: InvoiceNatureItemBreakdown[]; // Detalhamento dos itens da fatura por natureza
  unanalyzedAmount?: number;    // Saldo restante não analisado da fatura
}

export type PrepaymentPurpose = 
  | 'MAX_INTEREST_SAVING'    // Economia máxima de juros (do final para o começo)
  | 'CASHFLOW_RELIEF'        // Alívio imediato no fluxo de caixa (próximas parcelas)
  | 'EXTRA_BUDGET_AMOUNT'    // Montante avulso disponível (ex: R$ 5.000)
  | 'TOTAL_PAYOFF';          // Quitação integral de todas as parcelas futuras

export interface InstallmentPrepaymentCalc {
  movementId: string;
  installmentNumber: number;
  installmentsTotal: number;
  originalDueDate: string;
  nominalAmount: number;
  discountedAmount: number;
  discountAmount: number;
  discountPercent: number;
  daysToDueDate: number;
  selected: boolean;
}

export interface MonthlyClosing {
  id: string;
  monthKey: string;            // '2026-09'
  closedAt: string;            // ISO datetime
  closingBalance: number;      // Saldo final consolidado
  projectedBalance: number;    // Saldo projetado apurado pelo Balder
  adjustmentAmount: number;    // Diferença de conciliação (closingBalance - projectedBalance)
  status: 'FECHADO';
  notes?: string;
}

export interface MonthlyGridProjectionRow {
  monthKey: string;            // '2026-09'
  formattedCompetence: string; // '01/09/2026'
  competenceLabel: string;     // 'Set/2026'
  initialBalance: number;      // Saldo Inicial (no primeiro mês ou transferido da competência anterior)
  extrasTotal: number;         // Extras Total (+)
  salary: number;              // Salário Total (+) — soma de todas as parcelas/semanas/quinzenas
  salaryFirstInstallment?: number;  // 1ª Quinzena (se QUINZENAL)
  salarySecondInstallment?: number; // 2ª Quinzena (se QUINZENAL)
  salaryWeeklyInstallments?: number; // Nº de pagamentos semanais no mês (se SEMANAL)
  salaryWeeklyAmount?: number;       // Valor por semana (se SEMANAL)
  creditCardTotal: number;     // Cartão de Crédito (-)
  fixedCostMapped: number;     // Custo Fixo Mapeado TOTAL (-)
  fixedCostOnCard: number;     // Custo Fixo pago em Cartão de Crédito (integrado à fatura)
  fixedCostDirect: number;     // Custo Fixo pago em Conta/Boleto (desembolso direto)
  variableCost: number;        // Custos Avulsos (Variável) (-)
  loanReceived: number;        // Empréstimo (+) TOTAL (Valor Recebido)
  loanPayment: number;         // Empréstimo (-) TOTAL (Valor a pagar no mês)
  monthNet: number;            // SALDO do Mês (Receitas - Despesas)
  accumulatedBalance: number;  // SALDO ACUMULADO (Saldo Inicial + Resultado do Mês)
  isDeficit: boolean;          // Indica se o mês fechou negativo
  isClosed?: boolean;          // Se a competência foi formalmente encerrada
  closingDetails?: MonthlyClosing; // Detalhes da conciliação do fechamento
  previousMonthKey?: string;   // Competência anterior ('2026-08')
  isFirstMonth?: boolean;      // Indica se é o marco inicial da grade
}

export interface LoanSpreadsheetRow {
  month: number;               // 0, 1, 2... n
  dueDate: string;             // '15/10/2026'
  installmentValue: number;    // R$ 3.598,88
  interestValue: number;       // R$ 1.485,31
  amortizationValue: number;   // R$ 2.113,57
  balanceRemaining: number;    // R$ 39.007,94
  payoffTodayValue: number;    // R$ 3.547,62
  savingsAtAdvance: number;    // R$ 51,26
  simDate?: string;            // '03/09/2026'
  monthsDiff?: number;         // N meses
  discountedPayoff?: number;   // R$ 3.473,42
  isPaid?: boolean;            // Para empréstimos contratados no Balder
  movementId?: string;         // ID da parcela real no fluxo de caixa
}

export interface LoanSpreadsheetSummary {
  principalAmount: number;     // R$ 42.000,00
  monthlyInterestRate: number; // 0.03612 (3,612% a.m.)
  termMonths: number;          // 15
  contractDate: string;        // '2026-10-03'
  firstDueDate: string;        // '2026-10-15'
  simulationDate: string;      // '2026-09-03'
  installmentValue: number;    // R$ 3.598,88
  totalCost: number;           // R$ 53.983,16
  totalInterest: number;       // R$ 11.983,16
  totalPayoffToday: number;    // R$ 42.000,00
  totalSavingsPotential: number;// R$ 11.983,16
}

export interface CriticalEvent {
  id: string;
  title: string;
  type: 'CONTA' | 'PARCELA' | 'RISCO' | 'OPORTUNIDADE';
  amount: number;
  daysRemaining: number;
  recommendedAction: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  relatedEntity?: string;
}

export interface Goal {
  id: string;
  title: string;
  category: string;
  currentAmount: number;
  targetAmount: number;
  monthlyContribution: number;
  targetDate: string;
  icon: string;
  color: string;
}

export type SimulationVerdict = 'RECOMENDADO' | 'COM_RESTRICAO' | 'NAO_RECOMENDADO';
export type SimulationPresetId = 'CARRO' | 'QUITAR_DIVIDA' | 'NOVO_EMPRESTIMO' | 'FINANCIAMENTO' | 'IMOVEL';

export interface SimulationScenario {
  id: string;
  title: string;
  description: string;
  initialOutflow: number;
  monthlyCost: number;
  runwayBeforeMonths: number;
  runwayAfterMonths: number;
  verdict: SimulationVerdict;
  explanation: string;
  actionRecommendations: string[];
}

export type CreditOperationType = 
  | 'EMPRESTIMO_PESSOAL' 
  | 'EMPRESTIMO_CONSIGNADO' 
  | 'FINANCIAMENTO_IMOVEL' 
  | 'FINANCIAMENTO_AUTO' 
  | 'CAPITAL_GIRO';

export type FundsDestination = 
  | 'QUITAR_DIVIDAS_CARAS' 
  | 'INVESTIMENTO_RESERVA' 
  | 'AQUISICAO_BEM' 
  | 'CAPITAL_GIRO_CAIXA';

export interface BehavioralAdjustment {
  cutVariableExpensesPercent: number; // 0 to 30 (%)
  expectedMonthlyIncomeBoost: number; // ex: R$ 800/mês
  pauseGoalContributions: boolean;   // pausar aportes de metas
  extraAmortizationMonth?: number;   // mês da amortização extra (ex: 12)
  extraAmortizationAmount?: number;  // valor da amortização extra (ex: R$ 5.000)
}

export interface CustomScenarioInput {
  operationType: CreditOperationType;
  principalAmount: number;     // Valor captado (ex: R$ 40.000)
  installmentsCount: number;   // Prazo em meses (ex: 36)
  monthlyInterestRate: number; // Taxa % a.m. (ex: 1.85)
  gracePeriodMonths: number;   // Carência em meses (ex: 2)
  destination: FundsDestination;
  destinationNotes?: string;
  behavior: BehavioralAdjustment;
}

export interface MonthlyProjectionPoint {
  monthIndex: number;
  monthLabel: string;
  baselineBalance: number;
  simulatedBalance: number;
  cashflowImpact: number;
  isStressed: boolean;
}

export interface FutureScenarioResult {
  input: CustomScenarioInput;
  computedMonthlyPayment: number;
  totalInterestPaid: number;
  totalRepayment: number;
  debtToIncomeRatio: number;
  netMonthlyImpact: number;
  runwayBeforeMonths: number;
  runwayAfterMonths: number;
  verdict: SimulationVerdict;
  verdictReason: string;
  tacticalRecommendations: string[];
  projection12Months: MonthlyProjectionPoint[];
}

export interface CopilotInteractiveOption {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
  description?: string;
  payload: {
    bank?: string;
    type?: MovementType;
    category?: string;
    action?: string;
    [key: string]: any;
  };
}

export interface CopilotPendingConfirmation {
  step: 'PAYMENT_METHOD' | 'ACCOUNT' | 'CATEGORY' | 'CONFIRM';
  pendingData: {
    rawTitle: string;
    amount: number;
    dueDate: string;
    type: MovementType;
    category?: string;
    bank?: string;
    notes?: string;
  };
  question: string;
  options: CopilotInteractiveOption[];
}

export interface ReceiptItemLine {
  id: string;
  rawName: string;
  detectedName: string;
  price: number;
  quantity?: number;
  unit?: string;
  matchedMappingItemId?: string; // id do item no mapeamento (ex: 'item_f1', 'item_f2', etc.)
  targetMappingId?: string;       // id da rotina (ex: 'map_feira_semanal', 'map_mercado_mensal')
  natureId?: string;              // id da natureza (ex: 'nat_alimentacao')
  isNewSuggestedItem?: boolean;   // Adicionar ao mapeamento com quantidade 0
  newCategoryName?: string;
}

export interface ReceiptReconciliationData {
  id: string;
  store: string;
  date: string;
  totalAmount: number;
  paymentMethod: 'DINHEIRO' | 'DEBITO' | 'CARTAO' | 'PIX';
  cashPaid?: number;
  changeAmount?: number;
  items: ReceiptItemLine[];
  isReconciled?: boolean;
}

export interface CopilotAttachment {
  url: string;
  name: string;
  size?: string;
  revoke?: () => void;
  isEphemeralPurged?: boolean;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: string;
  attachments?: CopilotAttachment[];
  isEphemeralPurged?: boolean;
  actionBadge?: string;
  suggestedFollowUps?: string[];
  parsedEntry?: Partial<Movement>;
  pendingConfirmation?: CopilotPendingConfirmation;
  receiptReconciliation?: ReceiptReconciliationData;
}

export type BankAccountType = 'CORRENTE' | 'INVESTIMENTO' | 'POUPANCA' | 'CARTEIRA' | 'OUTRO';

export interface BankAccount {
  id: string;
  name: string;
  bankName?: string;
  type: BankAccountType;
  balance: number;
  color: string;
  icon: string;
}

export type CardBrand = 'MASTERCARD' | 'VISA' | 'ELO' | 'AMEX' | 'HIPERCARD' | 'OUTRA';

export interface CreditCardItem {
  id: string;
  name: string;
  bank: string;
  brand: CardBrand;
  limitTotal: number;
  limitUsed?: number;
  closingDay: number; // 1-31
  dueDay: number;     // 1-31
  color: string;
}

export type PaymentMethodType =
  | 'PIX'
  | 'BOLETO'
  | 'CARTAO_CREDITO'
  | 'CARTAO_DEBITO'
  | 'DINHEIRO'
  | 'TRANSFERENCIA'
  | 'OUTRO';

export interface PaymentMethodItem {
  id: string;
  name: string;
  type: PaymentMethodType;
  linkedAccountId?: string;
  linkedCardId?: string;
  icon?: string;
  color?: string;
}

export interface BankInstitution {
  id: string;
  name: string;
  code?: string;
  color: string;
  icon: string;
  status?: 'CONECTADO' | 'MANUAL';
  syncedAt?: string;
}

export interface MappingItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
  unit?: string;           // ex: 'un', 'kg', 'pct', 'lt'
  multiplierWeeks: number; // Multiplicador (ex: 4 para 4 semanas, 1 para compra única mensal, 2 para quinzenal)
  totalValue: number;      // Calculado: quantity * price * multiplierWeeks
  realizedValue?: number;  // Valor já gasto / liquidado no mês atual
  isFulfilled?: boolean;   // Se o item já foi integralmente adquirido no mês
  paymentMethod?: 'CONTA' | 'CARTAO' | 'BOLETO' | 'PIX'; // Forma de liquidação do gasto fixo
  cardName?: string;       // ex: 'Nubank Mastercard Black', 'XP Visa Infinite'

  // Período e dia específico de manifestação do item dentro do mapeamento:
  recurrenceType?: 'SEMANAL' | 'QUINZENAL' | 'MENSAL';
  dayOfWeek?: 'DOMINGO' | 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA' | 'SABADO';
  dayOfFortnight?: number; // 1 a 15 (dia específico da quinzena)
  dayOfMonth?: number;     // 1 a 31 (com ajuste automático para o último dia do mês quando o mês tiver < 31 dias)
}

export interface FixedExpenseMapping {
  id: string;
  name: string;                // ex: "Supermercado Base Mensal", "Feira Livre Semanal", "Açougue Quinzenal"
  natureId: string;
  icon?: string;               // Emoji próprio do mapeamento (ex: '🥩', '🥦', '💡', '⛽', '🛒')
  applicableMonths?: number[]; // [1..12] ou vazio para todos os meses
  items: MappingItem[];
  frequency?: 'SEMANAL' | 'QUINZENAL' | 'MENSAL' | 'PONTUAL'; // Periodicidade da rotina
  dayOfWeek?: string;          // ex: 'Sábado', 'Domingo', 'Segunda'
  dayOfMonth?: number;         // ex: 5, 7, 10
  keywords?: string[];         // Palavras-chave para a IA associar itens/transações diretamente a este mapeamento
}

export interface CeilingJustificationRecord {
  id: string;
  date: string;
  month: string;
  ceilingAmount: number;
  spentAmount: number;
  reason: string;
}

export interface ExpenseNature {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: 'FIXA' | 'VARIAVEL' | 'ESSENCIAL';
  description?: string;
  mappings: FixedExpenseMapping[];
  overCeilingJustification?: string;
  justificationHistory?: CeilingJustificationRecord[];
  keywords?: string[];         // Palavras-chave cadastradas pelo usuário para a IA associar itens a esta natureza
}

export type SalaryContractType = 'CLT' | 'PJ' | 'PRO_LABORE' | 'ESTAGIO' | 'CONCURSO' | 'AUTONOMO' | 'OUTRO';

export type SalaryAdjustmentReason =
  | 'DISSÍDIO_CONVENÇÃO'
  | 'MÉRITO'
  | 'PROMOÇÃO'
  | 'MUDANÇA_EMPREGO'
  | 'INFLAÇÃO_CORREÇÃO'
  | 'OUTRO';

export type SalaryPaymentSchedule = 'UNICO' | 'QUINZENAL' | 'SEMANAL';

export interface SalaryAdjustment {
  id: string;
  effectiveDate: string;        // YYYY-MM (Mês de início da vigência do reajuste, ex: '2026-05')
  grossAmount: number;          // Salário Bruto reajustado
  netAmount: number;            // Salário Líquido que entra no fluxo de caixa
  percentageIncrease?: number;  // Ganho percentual em relação ao salário imediatamente anterior (ex: 8.5 para +8.5%)
  reason: SalaryAdjustmentReason;
  title?: string;               // Título descritivo (ex: 'Acordo Coletivo 2026', 'Promoção para Tech Lead')
  notes?: string;               // Detalhes, observações sobre novos benefícios, etc.
  firstInstallmentAmount?: number;  // Valor da 1ª quinzena (se quinzenal e FIXED)
  secondInstallmentAmount?: number; // Valor da 2ª quinzena (se quinzenal e FIXED)
  weeklyInstallmentAmount?: number; // Valor líquido por semana (se semanal e FIXED)
  installmentValueMode?: 'FIXED' | 'AUTO'; // Como o valor por período é determinado
  payInFollowingMonth?: boolean; // Se true, o pagamento referente à competência é creditado no mês seguinte (M+1)
}

export interface SalaryContract {
  id: string;
  employer: string;             // Nome da Empresa / Empregador (ex: 'Tech Inovação S.A.')
  role: string;                 // Cargo ou Função (ex: 'Especialista de Sistemas')
  contractType: SalaryContractType;
  paymentSchedule?: SalaryPaymentSchedule; // 'UNICO', 'QUINZENAL' ou 'SEMANAL'
  paymentDay: number;           // Dia do mês do pagamento principal / 2ª quinzena (ex: 1 ou 5)
  secondPaymentDay?: number;    // Dia do mês da 1ª quinzena / adiantamento (ex: 15 ou 20)
  weeklyPaymentDayOfWeek?: number;   // Dia da semana do pagamento semanal (0=Dom … 6=Sáb, padrão 5=Sex)
  firstInstallmentPercent?: number;  // % da 1ª quinzena (ex: 40 ou 50) — usado no modo AUTO
  firstInstallmentAmount?: number;   // Valor em R$ da 1ª quinzena — usado no modo FIXED
  secondInstallmentAmount?: number;  // Valor em R$ da 2ª quinzena — usado no modo FIXED
  weeklyInstallmentAmount?: number;  // Valor líquido por semana — usado no modo FIXED
  installmentValueMode?: 'FIXED' | 'AUTO'; // FIXED = valores fixos cadastrados; AUTO = calcula a partir do líquido
  payInFollowingMonth?: boolean; // Se true, o pagamento referente à competência é creditado no mês seguinte (M+1)
  currentGrossAmount: number;   // Salário Bruto Atual
  currentNetAmount: number;     // Salário Líquido Atual vigente
  receivingBankAccountId?: string; // ID da Conta Bancária cadastrada
  receivingBankName?: string;   // Nome do Banco (ex: 'Banco Inter', 'Nubank')
  startDate: string;            // Data de início / admissão (YYYY-MM-DD ou YYYY-MM)
  isActive: boolean;
  history: SalaryAdjustment[];  // Histórico cronológico de reajustes
}

export interface InvoiceNatureItemBreakdown {
  id: string;
  natureId?: string;       // id da natureza (ou 'outros' ou undefined se não analisada)
  natureName: string;      // Nome da natureza, "Outros", ou "Não Analisada"
  mappingId?: string;      // ID do mapeamento se houver
  mappingItemId?: string;  // ID do item do mapeamento vinculado se houver
  description: string;     // Descrição do gasto (ex: "Supermercado Semanal", "Farmácia")
  amount: number;          // Valor da parcela nesta fatura em R$
  isAnalyzed: boolean;     // true se classificado em natureza ou 'Outros'; false se pendente
  installments?: number;   // Quantidade total de parcelas (ex: 2x, 3x)
  currentInstallment?: number; // Parcela atual nesta fatura (ex: 1)
  finalAmount?: number;    // Valor final total da compra parcelada (ex: R$ 500 para 2x de R$ 250)
}

export interface CheckpointCardInvoice {
  monthIndex: number; // 0 = atual, 1 = próxima (futura 1), 2 = futura 2, etc.
  monthLabel: string; // Ex: "Outubro 2026 (Atual)", "Novembro 2026 (Futura)"
  dueDate: string;    // YYYY-MM-DD
  amount: number;     // Valor em R$
  breakdown?: InvoiceNatureItemBreakdown[]; // Detalhamento por naturezas
  unanalyzedAmount?: number;                // Diferença restante não analisada (R$)
}

export interface CheckpointBankDebt {
  id: string;
  cardId?: string;     // Se vinculado a um cartão cadastrado no Balder
  bankName: string;    // Ex: "Nubank", "Itaú", "Inter"
  cardName: string;    // Ex: "Nubank Mastercard", "Itaú Click"
  dueDay: number;      // Dia do vencimento (1-31)
  invoices: CheckpointCardInvoice[]; // Faturas atual e futuras deste banco
  totalDebt: number;   // Soma de todas as faturas deste banco
}

/**
 * Marco de início de acompanhamento financeiro.
 * Define a data e o saldo inicial a partir dos quais o sistema contabiliza métricas.
 * O usuário pode criar novos checkpoints para "recomeçar" o acompanhamento.
 */
export interface FinancialCheckpoint {
  id: string;
  createdAt: string;       // ISO datetime de quando o marco foi criado
  startDate: string;       // YYYY-MM-DD — data a partir da qual monitorar
  initialBalance: number;  // Saldo em caixa nessa data (R$)
  creditCardDebt?: number; // Dívida / Fatura acumulada total de cartão de crédito no ponto de partida (R$)
  cardDueDate?: string;    // Data de vencimento da fatura inicial (YYYY-MM-DD)
  cardName?: string;       // Nome do cartão ou resumo de bancos
  cardInstallments?: number; // Quantidade de meses / parcelas em que a dívida se divide (padrão: 1)
  cardInstallmentAmount?: number; // Valor da parcela mensal correspondente (se parcelado)
  cardDebts?: CheckpointBankDebt[]; // Detalhamento de faturas atuais e futuras por banco
  initialNetWorth?: number; // Patrimônio líquido estimado nessa data (opcional)
  label?: string;          // Rótulo livre, ex: "Início 2025", "Reset pós-crise"
  notes?: string;          // Observações sobre o marco
  isActive: boolean;       // true = checkpoint vigente (apenas um por vez)
}

/**
 * Escopo de acompanhamento ativo no sistema:
 * - INDIVIDUAL: acompanhamento financeiro próprio/pessoal
 * - COMPARTILHADO: acompanhamento mútuo/conjunto (casal, família, sócios)
 */
export type TrackingScopeMode = 'INDIVIDUAL' | 'COMPARTILHADO';

/**
 * Regra de rateio de despesas compartilhadas:
 * - EQUAL_50_50: divisão 50% / 50%
 * - PROPORTIONAL_INCOME: divisão proporcional à renda líquida de cada participante
 * - CUSTOM: percentual personalizado fixo
 */
export type ExpenseSplitMode = 'EQUAL_50_50' | 'PROPORTIONAL_INCOME' | 'CUSTOM';

export interface SharedMember {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'PARTNER';
  monthlyIncome?: number;
  avatarUrl?: string;
  color?: string;
  status: 'ACTIVE' | 'PENDING';
  joinedAt?: string;
}

export interface SharedScenario {
  id: string;
  name: string;
  createdAt: string;
  inviteCode: string;
  status: 'ACTIVE' | 'PENDING';
  members: SharedMember[];
  splitMode: ExpenseSplitMode;
  userSharePercent: number; // ex: 50% ou 60%
  partnerSharePercent: number; // ex: 50% ou 40%
  notes?: string;
}

export interface SharedSettlementItem {
  id: string;
  title: string;
  category: string;
  totalAmount: number;
  paidBy: 'USER' | 'PARTNER';
  splitMode: ExpenseSplitMode;
  userOwes: number;
  partnerOwes: number;
  date: string;
  status: 'PENDENTE' | 'ACERTADO';
}

export interface UserProfileSettings {
  cards?: CreditCardItem[];
  banks?: BankInstitution[];
  monthlyClosings?: MonthlyClosing[];
  sharedScenario?: SharedScenario | null;
  sharedSettlements?: SharedSettlementItem[];
  defaultTrackingScope?: TrackingScopeMode;
  onboardingCompleted?: boolean;
  salaryContracts?: SalaryContract[];
  checkpoints?: FinancialCheckpoint[];
}


