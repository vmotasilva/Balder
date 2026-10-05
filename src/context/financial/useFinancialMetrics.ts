import {
  FORECAST_PERIODS, type ForecastPeriod, type ForecastWindow, buildForecastWindow,
} from '../../utils/forecastWindow';
import { computeAvailableBalance, computeCashInHand } from '../../utils/planSummary';
import { type CriticalEvent } from '../../types';
import { useMemo } from 'react';
import type { useCoreData } from './useCoreData';
import type { useCheckpoints } from './useCheckpoints';
import type { usePreferences } from './usePreferences';

type Deps =
  Pick<ReturnType<typeof useCoreData>,
    'accounts' | 'movements' | 'natures'
  > &
  Pick<ReturnType<typeof useCheckpoints>,
    'activeCheckpoint'
  > &
  Pick<ReturnType<typeof usePreferences>,
    'checkpointCashInHand' | 'natureDetailModes'
  >;

/** Saldos, previsões, reserva de emergência e próximos eventos críticos (tudo derivado). */
export function useFinancialMetrics({
  accounts, activeCheckpoint, checkpointCashInHand, movements, natureDetailModes, natures,
}: Deps) {
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
      .sort((a: any, b: any) => a.daysRemaining - b.daysRemaining);
  }, [movements]);

  // Próximo evento crítico mais próximo

  const nextCriticalEvent = useMemo(() => {
    return criticalEvents.length > 0 ? criticalEvents[0] : null;
  }, [criticalEvents]);

  // Métricas Calculadas — respeitam o activeCheckpoint quando configurado

  const availableBalance = useMemo(
    () => computeAvailableBalance({ movements, accounts, activeCheckpoint }),
    [activeCheckpoint, movements, accounts]
  );

  // Dinheiro em mãos: o que havia no marco + entradas − saídas realizadas em dinheiro desde então.
  // Sem marco: contas do tipo carteira. O restante do saldo em caixa está em conta.

  const cashInHandBalance = useMemo(
    () => computeCashInHand({ movements, accounts, activeCheckpoint, checkpointCashInHand }),
    [activeCheckpoint, movements, checkpointCashInHand, accounts]
  );

  const accountBalance = Math.round((availableBalance - cashInHandBalance) * 100) / 100;

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
    const res = accounts.filter((a: any) => a.id === 'acc_reserva' || a.type === 'POUPANCA');
    return res.reduce((acc, cur) => acc + cur.balance, 0);
  }, [accounts]);

  // Saldo previsto por período (semana, quinzena, mês, 30 dias): movimentos previstos + itens das
  // naturezas ainda não pagos até o fim do período (filtra por startDate quando há checkpoint)

  const forecasts = useMemo(() => {
    const startDate = activeCheckpoint?.startDate ?? '0000-01-01';
    const today = new Date();
    return Object.fromEntries(
      FORECAST_PERIODS.map(({ id }) => [
        id,
        buildForecastWindow({ movements, natures, startingBalance: availableBalance, startDate, today, period: id, natureDetailModes }),
      ])
    ) as Record<ForecastPeriod, ForecastWindow>;
  }, [movements, natures, availableBalance, activeCheckpoint, natureDetailModes]);

  const forecast30d = forecasts.DIAS_30;

  const monthlyFreeCashflow = forecast30d.net;

  const emergencyReserveMonths = useMemo(() => {
    const monthlyBurn = forecast30d.expenses;
    if (monthlyBurn <= 0) {
      return emergencyReserveAmount > 0 ? 12 : 0;
    }
    return Number((emergencyReserveAmount / monthlyBurn).toFixed(1));
  }, [emergencyReserveAmount, forecast30d.expenses]);

  // Histórico Conversacional do Forseti (IA)

  return {
    criticalEvents, nextCriticalEvent, availableBalance, cashInHandBalance, accountBalance,
    totalNetWorth, emergencyReserveAmount, forecasts, forecast30d, monthlyFreeCashflow,
    emergencyReserveMonths,
  };
}
