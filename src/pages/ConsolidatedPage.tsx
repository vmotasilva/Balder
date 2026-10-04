import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftCircle, Layers, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MAIN_PLAN_KEY, usePlans } from '../context/PlanScopeContext';
import { PlanningSwitcher } from '../components/PlanningSwitcher';
import { PlansService } from '../services/supabaseService';
import { summarizePlan, sumSummaries, type PlanSummary } from '../utils/planSummary';
import { TRACKING_PERIOD_LABELS } from '../utils/periodSpending';
import type { TrackingPeriod } from '../utils/periodSpending';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PERIODS: TrackingPeriod[] = ['SEMANA', 'QUINZENA', 'MES'];
const tone = (v: number) => (v < 0 ? 'text-rose' : 'text-emerald');

type Loaded = { summary: PlanSummary } | { error: true };

/**
 * Visão consolidada: soma o resultado dos planejamentos marcados no seletor, cada um com o seu
 * acompanhamento (saldo, entradas e saídas previstas). Somente leitura: lançar e editar é dentro de cada planejamento.
 */
export const ConsolidatedPage: React.FC = () => {
  const { user } = useAuth();
  const { plans, compareIds, setConsolidated } = usePlans();
  const [period, setPeriod] = useState<TrackingPeriod>('SEMANA');
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [loading, setLoading] = useState(true);

  const keys = compareIds.join('|');
  const nameOf = useCallback(
    (key: string) => (key === MAIN_PLAN_KEY ? 'Meu planejamento' : plans.find((p) => p.id === key)?.name || 'Planejamento'),
    [plans]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const entries = await Promise.all(
      keys.split('|').filter(Boolean).map(async (key): Promise<[string, Loaded]> => {
        try {
          const data = await PlansService.loadData(key === MAIN_PLAN_KEY ? null : key);
          return [key, { summary: summarizePlan(data) }];
        } catch {
          return [key, { error: true }];
        }
      })
    );
    setLoaded(Object.fromEntries(entries));
    setLoading(false);
  }, [keys]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => compareIds.map((key) => ({ key, name: nameOf(key), result: loaded[key] })),
    [compareIds, loaded, nameOf]
  );
  const summaries = rows.flatMap((r) => (r.result && 'summary' in r.result ? [r.result.summary] : []));
  const failed = rows.filter((r) => r.result && 'error' in r.result).length;
  const total = useMemo(() => sumSummaries(summaries, period), [summaries, period]);
  const labels = TRACKING_PERIOD_LABELS[period];
  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="home-hub consol">
      <header className="home-hub-header has-switch">
        <div>
          <h1>
            <Layers size={22} aria-hidden="true" /> Visão consolidada
          </h1>
          <p>
            {rows.map((r) => r.name).join(' + ')}
            {firstName ? ` · ${firstName}` : ''}
          </p>
        </div>
        <PlanningSwitcher />
      </header>

      <div className="consol-notice" role="status">
        <span>Somente leitura: aqui o resultado dos planejamentos marcados é somado. Para lançar ou editar, abra um deles.</span>
        <button type="button" className="btn btn-outline btn-xs" onClick={() => setConsolidated(false)}>
          <ArrowLeftCircle size={13} />
          <span>Sair da visão consolidada</span>
        </button>
      </div>

      <div className="home-period-bar">
        <div className="home-period-switch" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button key={p} type="button" className={p === period ? 'is-active' : ''} onClick={() => setPeriod(p)}>
              {TRACKING_PERIOD_LABELS[p].name}
            </button>
          ))}
        </div>
        <button type="button" className="home-period-icon" onClick={() => void load()} aria-label="Atualizar" title="Atualizar" disabled={loading}>
          <RefreshCw size={16} style={loading ? { opacity: 0.5 } : undefined} />
        </button>
      </div>

      {failed > 0 && (
        <p className="text-xs text-rose" role="alert">
          Não consegui ler {failed === 1 ? 'um dos planejamentos' : `${failed} planejamentos`}; a soma abaixo não o inclui.
        </p>
      )}

      <div className="home-stats">
        <div className="home-stat">
          <span>Saldo hoje (todos)</span>
          <strong className={tone(total.balance)}>{loading && !summaries.length ? '…' : formatBRL(total.balance)}</strong>
          {total.cashInHand !== 0 && <small>{formatBRL(total.cashInHand)} em dinheiro</small>}
        </div>
        <div className="home-stat">
          <span>Previsto {labels.end}</span>
          <strong className={tone(total.projectedBalance)}>{loading && !summaries.length ? '…' : formatBRL(total.projectedBalance)}</strong>
        </div>
        <div className="home-stat">
          <span>Movimentações {labels.this}</span>
          <strong className={tone(total.net)}>{formatBRL(total.net)}</strong>
          <small>
            {formatBRL(total.income)} entra · {formatBRL(total.expenses)} sai
          </small>
        </div>
        <div className="home-stat">
          <span>Em atraso</span>
          <strong className={total.overdueCount > 0 ? 'text-rose' : undefined}>{formatBRL(total.overdueExpenses)}</strong>
          <small>{total.overdueCount} {total.overdueCount === 1 ? 'conta vencida' : 'contas vencidas'}</small>
        </div>
      </div>

      <section className="home-card consol-table-card" aria-label="Resultado por planejamento">
        <div className="home-card-head">
          <h2>Por planejamento</h2>
          <span>{labels.this}</span>
        </div>
        <div className="consol-table-scroll">
          <table className="consol-table">
            <thead>
              <tr>
                <th>Planejamento</th>
                <th>Saldo hoje</th>
                <th>Entra</th>
                <th>Sai</th>
                <th>Previsto {labels.end}</th>
                <th>Em atraso</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = r.result && 'summary' in r.result ? r.result.summary : null;
                const w = s?.forecasts[period];
                return (
                  <tr key={r.key}>
                    <th scope="row">{r.name}</th>
                    {s && w ? (
                      <>
                        <td>{formatBRL(s.balance)}</td>
                        <td className="text-emerald">{formatBRL(w.income)}</td>
                        <td>{formatBRL(w.expenses)}</td>
                        <td className={tone(w.projectedBalance)}>{formatBRL(w.projectedBalance)}</td>
                        <td className={s.overdueCount > 0 ? 'text-rose' : undefined}>{formatBRL(s.overdueExpenses)}</td>
                      </>
                    ) : (
                      <td colSpan={5} className="consol-table-empty">
                        {r.result ? 'Não foi possível carregar.' : 'Carregando…'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {summaries.length > 1 && (
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td>{formatBRL(total.balance)}</td>
                  <td className="text-emerald">{formatBRL(total.income)}</td>
                  <td>{formatBRL(total.expenses)}</td>
                  <td className={tone(total.projectedBalance)}>{formatBRL(total.projectedBalance)}</td>
                  <td className={total.overdueCount > 0 ? 'text-rose' : undefined}>{formatBRL(total.overdueExpenses)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
};
