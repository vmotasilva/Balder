import type { BankAccount, ExpenseNature, FinancialCheckpoint, Movement } from '../types';
import { isCashInHand } from './cashInHand';
import { buildForecastWindow, FORECAST_PERIODS, type ForecastPeriod, type ForecastWindow } from './forecastWindow';
import { movementCompetenceDate } from './projectionMath';

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Saldo em caixa hoje. Com marco ativo: saldo inicial + entradas realizadas − saídas realizadas desde o início dele.
 * Sem marco: soma das contas correntes e carteiras.
 */
export function computeAvailableBalance(params: {
  movements: Movement[];
  accounts: BankAccount[];
  activeCheckpoint: FinancialCheckpoint | null;
}): number {
  const { movements, accounts, activeCheckpoint } = params;
  if (activeCheckpoint) {
    const startDate = activeCheckpoint.startDate;
    const realized = movements.filter((m) => movementCompetenceDate(m) >= startDate && m.status === 'REALIZADA');
    const income = realized.filter((m) => m.type === 'RECEBER').reduce((s, m) => s + m.amount, 0);
    const expense = realized.filter((m) => m.type !== 'RECEBER').reduce((s, m) => s + m.amount, 0);
    return round2(activeCheckpoint.initialBalance + income - expense);
  }
  return accounts.filter((a) => a.type === 'CORRENTE' || a.type === 'CARTEIRA').reduce((acc, cur) => acc + cur.balance, 0);
}

/** Dinheiro em mãos: o que havia no marco + entradas − saídas realizadas em dinheiro desde então. */
export function computeCashInHand(params: {
  movements: Movement[];
  accounts: BankAccount[];
  activeCheckpoint: FinancialCheckpoint | null;
  checkpointCashInHand: Record<string, number>;
}): number {
  const { movements, accounts, activeCheckpoint, checkpointCashInHand } = params;
  if (activeCheckpoint) {
    const startDate = activeCheckpoint.startDate;
    const flows = movements
      .filter((m) => m.status === 'REALIZADA' && isCashInHand(m.bank) && movementCompetenceDate(m) >= startDate)
      .reduce((acc, m) => acc + (m.type === 'RECEBER' ? m.amount : -m.amount), 0);
    return round2((checkpointCashInHand[activeCheckpoint.id] || 0) + flows);
  }
  return accounts.filter((a) => a.type === 'CARTEIRA').reduce((acc, cur) => acc + cur.balance, 0);
}

/** Dados de um planejamento, como vêm do servidor, para resumir sem abri-lo. */
export interface PlanData {
  movements: Movement[];
  natures: ExpenseNature[];
  accounts: BankAccount[];
  checkpoints: FinancialCheckpoint[];
  natureDetailModes: Record<string, 'ITENS' | 'MAPEAMENTOS'>;
  checkpointCashInHand: Record<string, number>;
}

export interface PlanSummary {
  /** Saldo em caixa hoje (conta + dinheiro em mãos). */
  balance: number;
  cashInHand: number;
  hasCheckpoint: boolean;
  forecasts: Record<ForecastPeriod, ForecastWindow>;
  /** Saídas previstas já vencidas e não pagas. */
  overdueExpenses: number;
  overdueCount: number;
}

/** Resumo de um planejamento com a mesma lógica do Início: saldo de hoje e projeção por período. */
export function summarizePlan(data: PlanData, today: Date = new Date()): PlanSummary {
  const activeCheckpoint = data.checkpoints.find((cp) => cp.isActive) ?? null;
  const balance = computeAvailableBalance({ movements: data.movements, accounts: data.accounts, activeCheckpoint });
  const cashInHand = computeCashInHand({
    movements: data.movements,
    accounts: data.accounts,
    activeCheckpoint,
    checkpointCashInHand: data.checkpointCashInHand,
  });
  const startDate = activeCheckpoint?.startDate ?? '0000-01-01';
  const forecasts = Object.fromEntries(
    FORECAST_PERIODS.map(({ id }) => [
      id,
      buildForecastWindow({
        movements: data.movements,
        natures: data.natures,
        startingBalance: balance,
        startDate,
        today,
        period: id,
        natureDetailModes: data.natureDetailModes,
      }),
    ])
  ) as Record<ForecastPeriod, ForecastWindow>;
  const overdue = forecasts.MES.entries.filter((e) => e.overdue && e.kind === 'SAIDA');
  return {
    balance,
    cashInHand,
    hasCheckpoint: !!activeCheckpoint,
    forecasts,
    overdueExpenses: round2(overdue.reduce((acc, e) => acc + e.amount, 0)),
    overdueCount: overdue.length,
  };
}

/** Soma de resumos: o resultado do todo. */
export function sumSummaries(list: PlanSummary[], period: ForecastPeriod) {
  const sum = (pick: (s: PlanSummary) => number) => round2(list.reduce((acc, s) => acc + pick(s), 0));
  return {
    balance: sum((s) => s.balance),
    cashInHand: sum((s) => s.cashInHand),
    income: sum((s) => s.forecasts[period].income),
    expenses: sum((s) => s.forecasts[period].expenses),
    net: sum((s) => s.forecasts[period].net),
    projectedBalance: sum((s) => s.forecasts[period].projectedBalance),
    overdueExpenses: sum((s) => s.overdueExpenses),
    overdueCount: list.reduce((acc, s) => acc + s.overdueCount, 0),
  };
}
