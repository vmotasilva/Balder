import React, { useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { DecimalInput } from './DecimalInput';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import { movementCompetenceDate } from '../utils/projectionMath';

interface BalanceBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
const round2 = (v: number) => Math.round(v * 100) / 100;
const monthName = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/**
 * De onde vem o saldo de hoje: o saldo no início do período mais cada movimentação realizada desde então.
 * Usa a mesma conta do saldo em caixa (valor e data de competência), então fecha com ele.
 */
export const BalanceBreakdownModal: React.FC<BalanceBreakdownModalProps> = ({ isOpen, onClose }) => {
  const { movements, availableBalance, activeCheckpoint, monthlyClosings, updateCheckpoint } = useFinancial();
  const checkpointStart = activeCheckpoint?.startDate;

  // Competência em aberto: o mês de hoje ou, se já foi fechado, o primeiro seguinte sem fechamento
  const competenceKey = useMemo(() => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    const closed = new Set((monthlyClosings || []).filter((c) => c.status === 'FECHADO').map((c) => c.monthKey));
    for (let i = 0; i < 24; i++) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (!closed.has(key)) return key;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [monthlyClosings]);
  const periodFrom = `${competenceKey}-01`;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(0);

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
    <Modal isOpen={isOpen} onClose={onClose} title="Saldo hoje" subtitle={`Competência de ${monthName(competenceKey)}`} maxWidth="560px">
      <div className="forecast-breakdown">
        <div className="forecast-summary">
          {editing ? (
            <div className="forecast-summary-row balance-opening-edit">
              <span>Saldo no início ({shortDate(openingDate)})</span>
              <DecimalInput className="form-input form-input-sm" value={draft} onValueChange={setDraft} />
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={() => {
                  // O saldo é o do marco + o realizado: mexer no início desloca o marco, e o saldo de hoje acompanha
                  if (activeCheckpoint) {
                    updateCheckpoint(activeCheckpoint.id, { initialBalance: round2(activeCheckpoint.initialBalance + (draft - opening)) });
                  }
                  setEditing(false);
                }}
              >
                Salvar
              </button>
              <button type="button" className="btn btn-outline btn-xs" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="forecast-summary-row balance-opening-btn"
              disabled={!activeCheckpoint}
              title={activeCheckpoint ? 'Ajustar o saldo inicial' : 'Crie um marco de acompanhamento para ajustar o saldo inicial'}
              onClick={() => {
                setDraft(opening);
                setEditing(true);
              }}
            >
              <span>Saldo no início ({shortDate(openingDate)})</span>
              <strong>
                {formatBRL(opening)} {activeCheckpoint && <Pencil size={12} aria-hidden="true" />}
              </strong>
            </button>
          )}
          {editing && (
            <p className="text-xs text-muted" style={{ padding: '4px 12px' }}>
              O saldo de hoje muda junto: ele é este saldo inicial mais o que foi realizado depois.
            </p>
          )}
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
