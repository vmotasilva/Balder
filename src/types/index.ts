export type MovementType = 'RECEBER' | 'PAGAR' | 'EMPRESTIMO' | 'CARTAO';
export type MovementStatus = 'PREVISTA' | 'REALIZADA';

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

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actionBadge?: string;
  suggestedFollowUps?: string[];
  parsedEntry?: Partial<Movement>;
}

export interface BankAccount {
  id: string;
  name: string;
  type: 'CORRENTE' | 'INVESTIMENTO' | 'POUPANCA';
  balance: number;
  color: string;
  icon: string;
}
