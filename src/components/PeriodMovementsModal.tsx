import { skippedValue } from '../utils/skippedMovement';
import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from './Modal';
import { MovementDetailModal } from './MovementDetailModal';
import { useFinancial } from '../context/FinancialContext';
import type { Movement } from '../types';
import type { ForecastEntry } from '../utils/forecastWindow';

type FlowFilter = 'TODAS' | 'ENTRADAS' | 'SAIDAS';
type StatusFilter = 'TODAS' | 'REALIZADA' | 'PREVISTA';
type UntilFilter = 'PERIODO' | 'HOJE';

interface PeriodMovementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  movements: Movement[];
  /** Gastos esperados das naturezas (ainda sem lançamento): entram como saídas previstas. */
  expectedEntries?: ForecastEntry[];
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

/** Entradas são recebimentos; pagamentos, parcelas de empréstimo e faturas são saídas. */
export const isMovementIncome = (m: Movement) => m.type === 'RECEBER';
/** Valor que de fato movimenta o caixa: o realizado, quando houver. */
export const movementValue = (m: Movement) => (m.status === 'REALIZADA' ? m.actualAmount ?? m.amount : m.amount);
/** Dia em que a movimentação conta: o pagamento, se já aconteceu; senão o vencimento. */
export const movementDate = (m: Movement) => (m.status === 'REALIZADA' && m.paymentDate ? m.paymentDate : m.dueDate);

/** Pop-up com as movimentações de um período, filtráveis por entrada/saída, situação e texto. */
export const PeriodMovementsModal: React.FC<PeriodMovementsModalProps> = ({ isOpen, onClose, title, subtitle, movements, expectedEntries = [] }) => {
  const [flow, setFlow] = useState<FlowFilter>('TODAS');
  const [status, setStatus] = useState<StatusFilter>('TODAS');
  const [query, setQuery] = useState('');
  // Só o que já aconteceu: do começo do período até hoje
  const [until, setUntil] = useState<UntilFilter>('PERIODO');
  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const { natures } = useFinancial();
  // Natureza e item do teto ligados à movimentação; sem ligação, cai na categoria bruta
  const movementLabel = (m: Movement) => {
    const nature = m.natureId ? natures.find((n) => n.id === m.natureId) : undefined;
    if (!nature) return m.category;
    const item = m.mappingItemId
      ? (nature.mappings || []).flatMap((map) => map.items || []).find((it) => it.id === m.mappingItemId)
      : undefined;
    return item?.description ? `${nature.name} › ${item.description}` : nature.name;
  };
  const hasFuture = movements.some((m) => movementDate(m) > todayIso) || expectedEntries.some((e) => e.date > todayIso);
  // Movimentação aberta para ajustar valor, data, parcelamento e demais dados
  const [editing, setEditing] = useState<Movement | null>(null);

  // Linha da lista: lançamento real ou gasto esperado de uma natureza
  type Row = { id: string; date: string; title: string; label: string; bank: string; income: boolean; amount: number; movement?: Movement };

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const real: Row[] = movements
      .filter((m) => (flow === 'TODAS' ? true : flow === 'ENTRADAS' ? isMovementIncome(m) : !isMovementIncome(m)))
      .filter((m) => (status === 'TODAS' ? true : m.status === status))
      .map((m) => ({ id: m.id, date: movementDate(m), title: m.title, label: movementLabel(m), bank: m.bank, income: isMovementIncome(m), amount: movementValue(m), movement: m }));
    const expected: Row[] =
      flow === 'ENTRADAS' || status === 'REALIZADA'
        ? []
        : expectedEntries
            .filter((e) => e.source === 'NATUREZA')
            .map((e) => ({ id: e.id, date: e.date, title: e.title, label: e.detail || '', bank: 'Previsto', income: false, amount: e.amount }));
    return [...real, ...expected]
      .filter((r) => until === 'PERIODO' || r.date <= todayIso)
      .filter((r) => !q || `${r.title} ${r.label} ${r.bank} ${r.movement?.category ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [movements, expectedEntries, flow, status, query, until, todayIso]);

  const income = rows.filter((r) => r.income).reduce((acc, r) => acc + r.amount, 0);
  const expense = rows.filter((r) => !r.income).reduce((acc, r) => acc + r.amount, 0);

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
          {hasFuture && chips<UntilFilter>(until, setUntil, [['PERIODO', 'Período todo'], ['HOJE', 'Até hoje']])}
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

        {rows.length === 0 ? (
          <p className="period-mov-empty">Nenhuma movimentação com esses filtros.</p>
        ) : (
          <ul className="period-mov-list">
            {rows.map((r) => {
              const m = r.movement;
              const sign = r.income ? '+' : '−';
              const skipped = m ? skippedValue(m) : 0;
              return (
                <li
                  key={r.id}
                  className={m ? 'is-clickable' : undefined}
                  onClick={m ? () => setEditing(m) : undefined}
                  onKeyDown={m ? (e) => e.key === 'Enter' && setEditing(m) : undefined}
                  tabIndex={m ? 0 : undefined}
                  role={m ? 'button' : undefined}
                  title={m ? 'Ajustar valor, data ou parcelamento' : 'Gasto esperado pela natureza'}
                >
                  <span className="period-mov-date">{shortDate(r.date)}</span>
                  <span className="period-mov-main">
                    <b>{r.title.replace(/^Despesas?:\s*/i, "")}</b>
                    <small>
                      {r.label} · {r.bank} · {skipped > 0 ? 'Desconsiderada' : m?.status === 'REALIZADA' ? 'Realizada' : 'Prevista'}
                    </small>
                  </span>
                  <strong className={`period-mov-amount ${r.income ? 'text-emerald' : 'text-rose'}`}>
                    {skipped > 0 && (
                      <s className="period-mov-struck" title="Valor que teria sido realizado">
                        {sign} {formatBRL(skipped)}
                      </s>
                    )}
                    <span>
                      {sign} {formatBRL(r.amount)}
                    </span>
                  </strong>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {editing && <MovementDetailModal isOpen movement={editing} onClose={() => setEditing(null)} />}
    </Modal>
  );
};
