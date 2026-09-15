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
