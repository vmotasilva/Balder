import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import { useForecastEntryActions } from '../hooks/useForecastEntryActions';
import { ddmm, formatBRL } from './ForecastBreakdownModal';
import type { ForecastEntry } from '../utils/forecastWindow';
import { findMappingSpendCandidates, spendAmount } from '../utils/mappingSpendCandidates';

interface OverdueBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: 'FATURAS' | 'NATUREZAS') => void;
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const sum = (list: ForecastEntry[]) => list.reduce((acc, e) => acc + e.amount, 0);

/**
 * Contas em aberto da Central: o que venceu sem ser marcado como pago/recebido e o que vence nos próximos
 * 3 dias, cada uma com a saída para dizer como foi tratada (paga, recebida, outra situação, desconsiderada).
 */
export const OverdueBillsModal: React.FC<OverdueBillsModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const { forecasts, natures, movements } = useFinancial();
  const { renderAction, renderSecondary, modals } = useForecastEntryActions(onNavigate);

  const entries = forecasts.DIAS_30?.entries || [];
  const in3Days = isoOf(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
  const todayIso = isoOf(new Date());
  const byDate = (a: ForecastEntry, b: ForecastEntry) => a.date.localeCompare(b.date);
  const overdueOut = entries.filter((e) => e.overdue && e.kind === 'SAIDA').sort(byDate);
  const overdueIn = entries.filter((e) => e.overdue && e.kind === 'ENTRADA').sort(byDate);
  const dueSoon = entries.filter((e) => !e.overdue && e.kind === 'SAIDA' && e.date >= todayIso && e.date <= in3Days).sort(byDate);

  // Compra de mapeamento em Resumo: gastos do mês ainda sem ligação ao previsto podem ser ela, mesmo em outra data
  const spendHint = (e: ForecastEntry) => {
    if (!e.mappingSummary || !e.natureId || !e.mappingId) return null;
    const monthKey = e.date.slice(0, 7);
    const [y, m] = monthKey.split('-').map(Number);
    const found = findMappingSpendCandidates({
      movements,
      natures,
      natureId: e.natureId,
      mappingId: e.mappingId,
      range: { from: `${monthKey}-01`, to: `${monthKey}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` },
      near: e.date,
    });
    if (found.length === 0) return null;
    const total = found.reduce((acc, mv) => acc + spendAmount(mv), 0);
    return (
      <p className="open-bill-hint">
        Já há {found.length === 1 ? 'um gasto' : `${found.length} gastos`} de {e.title} neste mês ({formatBRL(total)}) sem ligação com o
        previsto. Se algum for esta compra, toque em Lançar e escolha "Já foi este".
      </p>
    );
  };

  const renderRow = (e: ForecastEntry) => (
    <li key={e.id} className="open-bill-row">
      <div className="open-bill-main">
        <span className="open-bill-date">{ddmm(e.date)}</span>
        <span className="open-bill-title">
          <strong>{e.title}</strong>
          {e.detail && <small>{e.detail}</small>}
        </span>
        <span className={`open-bill-amount ${e.kind === 'ENTRADA' ? 'is-in' : 'is-out'}`}>{formatBRL(e.amount)}</span>
      </div>
      {spendHint(e)}
      <div className="open-bill-actions">
        {renderAction(e)}
        {renderSecondary(e)}
      </div>
    </li>
  );

  const section = (title: string, hint: string, list: ForecastEntry[], overdue: boolean) =>
    list.length > 0 && (
      <section className={`forecast-section ${overdue ? 'forecast-section--overdue' : ''}`}>
        <h4>
          {overdue && <AlertTriangle size={14} />} {title} ({formatBRL(sum(list))})
        </h4>
        <p className="forecast-section-hint">{hint}</p>
        <ul className="forecast-rows">{list.map(renderRow)}</ul>
      </section>
    );

  const empty = overdueOut.length + overdueIn.length + dueSoon.length === 0;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Contas em aberto" subtitle="Diga o que já foi resolvido para o saldo ficar certo" maxWidth="640px">
        <div className="forecast-breakdown">
          {empty && (
            <p className="home-empty">
              <CheckCircle2 size={16} className="text-emerald" /> Nada em aberto. Tudo em dia.
            </p>
          )}
          {section('Em atraso', 'Venceram e ainda não foram marcadas como pagas. Continuam descontadas do saldo até você confirmar.', overdueOut, true)}
          {section('Recebimentos a confirmar', 'Era para ter entrado até hoje. Se já caiu, confirme.', overdueIn, true)}
          {section(`Vencem até ${ddmm(in3Days)}`, 'Se já pagou antes do vencimento, confirme aqui.', dueSoon, false)}
        </div>
      </Modal>
      {modals}
    </>
  );
};
