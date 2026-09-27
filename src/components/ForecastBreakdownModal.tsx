import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import {
  FORECAST_PERIODS,
  type ForecastEntry,
  type ForecastEntrySource,
  type ForecastPeriod,
} from '../utils/forecastWindow';

const PERIOD_STORAGE_KEY = 'balder_forecast_period';

const SOURCE_LABEL: Record<ForecastEntrySource, string> = {
  SALARIO: 'Salários',
  RECEITA: 'Outras receitas',
  EMPRESTIMO_RECEBIDO: 'Empréstimos recebidos',
  PARCELA: 'Parcelas de empréstimo',
  FATURA: 'Faturas de cartão',
  CONTA: 'Contas a pagar',
  NATUREZA: 'Naturezas (itens ainda não pagos)',
};
const SOURCE_ORDER: ForecastEntrySource[] = ['SALARIO', 'RECEITA', 'EMPRESTIMO_RECEBIDO', 'FATURA', 'PARCELA', 'CONTA', 'NATUREZA'];

export const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const forecastPeriodLabel = (period: ForecastPeriod) => FORECAST_PERIODS.find((p) => p.id === period)?.label || '';

/** Período escolhido (lembrado neste navegador; o Dashboard e a Central compartilham a escolha). */
export function useForecastPeriod(fallback: ForecastPeriod = 'MES') {
  const [period, setPeriodState] = useState<ForecastPeriod>(() => {
    try {
      const saved = localStorage.getItem(PERIOD_STORAGE_KEY) as ForecastPeriod | null;
      if (saved && FORECAST_PERIODS.some((p) => p.id === saved)) return saved;
    } catch {
      // armazenamento indisponível
    }
    return fallback;
  });
  const setPeriod = (next: ForecastPeriod) => {
    setPeriodState(next);
    try {
      localStorage.setItem(PERIOD_STORAGE_KEY, next);
    } catch {
      // armazenamento indisponível
    }
  };
  return [period, setPeriod] as const;
}

export const ForecastPeriodPills: React.FC<{ value: ForecastPeriod; onChange: (p: ForecastPeriod) => void }> = ({ value, onChange }) => (
  <div className="pill-selector forecast-period-pills" role="tablist" aria-label="Período">
    {FORECAST_PERIODS.map((p) => (
      <button
        key={p.id}
        type="button"
        role="tab"
        aria-selected={value === p.id}
        className={`pill-btn ${value === p.id ? 'active' : ''}`}
        onClick={() => onChange(p.id)}
      >
        {p.label}
      </button>
    ))}
  </div>
);

const EntryRow: React.FC<{ entry: ForecastEntry }> = ({ entry }) => (
  <li className="forecast-row">
    <span className="forecast-row-date">{ddmm(entry.date)}</span>
    <span className="forecast-row-title">
      <strong>{entry.title}</strong>
      {entry.detail && <small>{entry.detail}</small>}
    </span>
    <span className={`forecast-row-amount ${entry.kind === 'ENTRADA' ? 'is-in' : 'is-out'}`}>
      {entry.kind === 'ENTRADA' ? '+' : '−'}
      {formatBRL(entry.amount)}
    </span>
  </li>
);

const EntryGroups: React.FC<{ entries: ForecastEntry[] }> = ({ entries }) => (
  <>
    {SOURCE_ORDER.map((source) => {
      const list = entries.filter((e) => e.source === source);
      if (list.length === 0) return null;
      const total = list.reduce((acc, e) => acc + e.amount, 0);
      return (
        <div key={source} className="forecast-group">
          <div className="forecast-group-header">
            <span>
              {SOURCE_LABEL[source]} <small>({list.length})</small>
            </span>
            <strong>{formatBRL(total)}</strong>
          </div>
          <ul className="forecast-rows">
            {list.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </ul>
        </div>
      );
    })}
  </>
);

interface ForecastBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: ForecastPeriod;
  onPeriodChange: (p: ForecastPeriod) => void;
}

/** O que compõe o saldo previsto do período: saldo em caixa + entradas − saídas, item a item. */
export const ForecastBreakdownModal: React.FC<ForecastBreakdownModalProps> = ({ isOpen, onClose, period, onPeriodChange }) => {
  const { forecasts } = useFinancial();
  const w = forecasts[period];
  const overdue = w.entries.filter((e) => e.overdue);
  const upcoming = w.entries.filter((e) => !e.overdue);
  const incoming = upcoming.filter((e) => e.kind === 'ENTRADA');
  const outgoing = upcoming.filter((e) => e.kind === 'SAIDA');
  const overdueNet = overdue.reduce((acc, e) => acc + (e.kind === 'ENTRADA' ? e.amount : -e.amount), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${forecastPeriodLabel(period)}: saldo previsto`}
      subtitle={`De hoje (${ddmm(w.fromDate)}) até ${ddmm(w.toDate)}`}
      maxWidth="640px"
    >
      <div className="forecast-breakdown">
        <ForecastPeriodPills value={period} onChange={onPeriodChange} />

        <div className="forecast-summary">
          <div className="forecast-summary-row">
            <span>Saldo em caixa hoje</span>
            <strong>{formatBRL(w.startingBalance)}</strong>
          </div>
          <div className="forecast-summary-row">
            <span>+ Entradas previstas</span>
            <strong className="text-emerald">{formatBRL(w.income)}</strong>
          </div>
          <div className="forecast-summary-row">
            <span>− Saídas previstas</span>
            <strong className="text-rose">{formatBRL(w.expenses)}</strong>
          </div>
          <div className="forecast-summary-row is-total">
            <span>= Saldo previsto em {ddmm(w.toDate)}</span>
            <strong className={w.projectedBalance < 0 ? 'text-rose' : 'text-emerald'}>{formatBRL(w.projectedBalance)}</strong>
          </div>
        </div>

        {w.entries.length === 0 && (
          <p className="forecast-empty">Nada previsto até {ddmm(w.toDate)}. O saldo previsto é o saldo em caixa de hoje.</p>
        )}

        {overdue.length > 0 && (
          <section className="forecast-section forecast-section--overdue">
            <h4>
              <AlertTriangle size={14} /> Em atraso ({formatBRL(Math.abs(overdueNet))})
            </h4>
            <p className="forecast-section-hint">Venceram e ainda não foram marcados como pagos/recebidos, por isso continuam na conta.</p>
            <EntryGroups entries={overdue} />
          </section>
        )}

        {incoming.length > 0 && (
          <section className="forecast-section">
            <h4>Entradas até {ddmm(w.toDate)}</h4>
            <EntryGroups entries={incoming} />
          </section>
        )}

        {outgoing.length > 0 && (
          <section className="forecast-section">
            <h4>Saídas até {ddmm(w.toDate)}</h4>
            <EntryGroups entries={outgoing} />
          </section>
        )}

        <p className="forecast-footnote">
          Considera o saldo em caixa, os lançamentos previstos e os itens das naturezas ainda não pagos no período, com a
          mesma regra da grade mensal. Itens pagos no cartão entram pela fatura.
        </p>
      </div>
    </Modal>
  );
};
