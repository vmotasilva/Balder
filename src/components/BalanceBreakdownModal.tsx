import React, { useMemo } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import { movementCompetenceDate } from '../utils/projectionMath';

interface BalanceBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Início do período atual (YYYY-MM-DD). */
  periodFrom: string;
  periodName: string;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * De onde vem o saldo de hoje: o saldo no início do período mais cada movimentação realizada desde então.
 * Usa a mesma conta do saldo em caixa (valor e data de competência), então fecha com ele.
 */
export const BalanceBreakdownModal: React.FC<BalanceBreakdownModalProps> = ({ isOpen, onClose, periodFrom, periodName }) => {
  const { movements, availableBalance, activeCheckpoint } = useFinancial();
  const checkpointStart = activeCheckpoint?.startDate;

  const { opening, rows, net } = useMemo(() => {
    const from = checkpointStart && checkpointStart > periodFrom ? checkpointStart : periodFrom;
    const list = movements
      .filter((m) => m.status === 'REALIZADA' && movementCompetenceDate(m) >= from)
      .map((m) => ({ m, date: movementCompetenceDate(m), signed: m.type === 'RECEBER' ? m.amount : -m.amount }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.m.title.localeCompare(b.m.title));
    const total = round2(list.reduce((acc, r) => acc + r.signed, 0));
    let running = round2(availableBalance - total);
    const withBalance = list.map((r) => {
      running = round2(running + r.signed);
      return { ...r, balance: running };
    });
    return { opening: round2(availableBalance - total), rows: withBalance, net: total };
  }, [movements, availableBalance, periodFrom, checkpointStart]);

  const openingDate = checkpointStart && checkpointStart > periodFrom ? checkpointStart : periodFrom;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Saldo hoje" subtitle={`${periodName}: de ${shortDate(openingDate)} até hoje`} maxWidth="560px">
      <div className="forecast-breakdown">
        <div className="forecast-summary">
          <div className="forecast-summary-row">
            <span>Saldo no início ({shortDate(openingDate)})</span>
            <strong>{formatBRL(opening)}</strong>
          </div>
          <div className="forecast-summary-row">
            <span>{net >= 0 ? '+' : '−'} Movimentações realizadas</span>
            <strong className={net >= 0 ? 'text-emerald' : 'text-rose'}>{formatBRL(Math.abs(net))}</strong>
          </div>
          <div className="forecast-summary-row is-total">
            <span>= Saldo hoje</span>
            <strong>{formatBRL(availableBalance)}</strong>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="forecast-empty">Nenhuma movimentação realizada neste período: o saldo é o mesmo do início.</p>
        ) : (
          <ul className="balance-breakdown-list">
            {rows.map(({ m, date, signed, balance }) => (
              <li key={m.id}>
                <span className="balance-breakdown-date">{shortDate(date)}</span>
                <span className="balance-breakdown-title">
                  {m.title}
                  <small>{m.bank}</small>
                </span>
                <span className="balance-breakdown-values">
                  <strong className={signed >= 0 ? 'text-emerald' : 'text-rose'}>
                    {signed >= 0 ? '+' : '−'}
                    {formatBRL(Math.abs(signed))}
                  </strong>
                  <small>{formatBRL(balance)}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
};
