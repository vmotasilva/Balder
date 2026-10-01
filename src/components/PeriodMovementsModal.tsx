import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from './Modal';
import type { Movement } from '../types';

type FlowFilter = 'TODAS' | 'ENTRADAS' | 'SAIDAS';
type StatusFilter = 'TODAS' | 'REALIZADA' | 'PREVISTA';

interface PeriodMovementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  movements: Movement[];
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

/** Entradas são recebimentos; pagamentos, parcelas de empréstimo e faturas são saídas. */
export const isMovementIncome = (m: Movement) => m.type === 'RECEBER';
/** Valor que de fato movimenta o caixa: o realizado, quando houver. */
export const movementValue = (m: Movement) => (m.status === 'REALIZADA' ? m.actualAmount ?? m.amount : m.amount);
/** Dia em que a movimentação conta: o pagamento, se já aconteceu; senão o vencimento. */
export const movementDate = (m: Movement) => (m.status === 'REALIZADA' && m.paymentDate ? m.paymentDate : m.dueDate);

const sumBy = (list: Movement[], income: boolean) =>
  list.filter((m) => isMovementIncome(m) === income).reduce((acc, m) => acc + movementValue(m), 0);

/** Pop-up com as movimentações de um período, filtráveis por entrada/saída, situação e texto. */
export const PeriodMovementsModal: React.FC<PeriodMovementsModalProps> = ({ isOpen, onClose, title, subtitle, movements }) => {
  const [flow, setFlow] = useState<FlowFilter>('TODAS');
  const [status, setStatus] = useState<StatusFilter>('TODAS');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movements
      .filter((m) => (flow === 'TODAS' ? true : flow === 'ENTRADAS' ? isMovementIncome(m) : !isMovementIncome(m)))
      .filter((m) => (status === 'TODAS' ? true : m.status === status))
      .filter((m) => !q || `${m.title} ${m.category} ${m.bank}`.toLowerCase().includes(q))
      .sort((a, b) => movementDate(a).localeCompare(movementDate(b)));
  }, [movements, flow, status, query]);

  const income = sumBy(filtered, true);
  const expense = sumBy(filtered, false);

  const chips = <T extends string>(value: T, set: (v: T) => void, options: [T, string][]) => (
    <div className="period-mov-chips" role="group">
      {options.map(([id, label]) => (
        <button key={id} type="button" className={value === id ? 'is-active' : ''} onClick={() => set(id)}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle} maxWidth="720px">
      <div className="period-mov">
        <div className="period-mov-filters">
          {chips<FlowFilter>(flow, setFlow, [['TODAS', 'Todas'], ['ENTRADAS', 'Entradas'], ['SAIDAS', 'Saídas']])}
          {chips<StatusFilter>(status, setStatus, [['TODAS', 'Todas as situações'], ['REALIZADA', 'Realizadas'], ['PREVISTA', 'Previstas']])}
          <label className="period-mov-search">
            <Search size={14} aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título, natureza ou banco" aria-label="Buscar movimentações" />
          </label>
        </div>

        <div className="period-mov-totals">
          <span>Entradas <strong className="text-emerald">{formatBRL(income)}</strong></span>
          <span>Saídas <strong className="text-rose">{formatBRL(expense)}</strong></span>
          <span>Saldo <strong className={income - expense < 0 ? 'text-rose' : 'text-emerald'}>{formatBRL(income - expense)}</strong></span>
        </div>

        {filtered.length === 0 ? (
          <p className="period-mov-empty">Nenhuma movimentação com esses filtros.</p>
        ) : (
          <ul className="period-mov-list">
            {filtered.map((m) => {
              const isIncome = isMovementIncome(m);
              return (
                <li key={m.id}>
                  <span className="period-mov-date">{shortDate(movementDate(m))}</span>
                  <span className="period-mov-main">
                    <b>{m.title}</b>
                    <small>
                      {m.category} · {m.bank} · {m.status === 'REALIZADA' ? 'Realizada' : 'Prevista'}
                    </small>
                  </span>
                  <strong className={isIncome ? 'text-emerald' : 'text-rose'}>
                    {isIncome ? '+' : '−'} {formatBRL(movementValue(m))}
                  </strong>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
};
