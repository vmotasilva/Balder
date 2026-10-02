import React, { useMemo, useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { Modal } from './Modal';
import { DecimalInput } from './DecimalInput';
import { NumberInput } from './NumberInput';
import { MovementDetailModal } from './MovementDetailModal';
import {
  SalaryPartsEditor,
  SalaryRegimeDialog,
  futureSalaryMonths,
  planSalaryRegime,
  salaryBaseTitle,
  salaryOfCompetence,
  type SalaryPart,
  type SalaryRegimeResult,
} from './SalaryRegimeDialog';
import { getSalaryCompetenceKey, isSalaryMovement } from '../utils/projectionMath';
import type { Movement } from '../types';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const addMonths = (key: string, n: number) => {
  const [y, m] = key.split('-').map(Number);
  return monthKeyOf(new Date(y, m - 1 + n, 1));
};

/** Cadastro de salário: valor, formato de pagamento e quantos meses projetar. */
const SalaryRegisterModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { banks, addMultipleMovements, movements } = useFinancial();
  const [name, setName] = useState('Salário');
  const [total, setTotal] = useState(0);
  const [parts, setParts] = useState<SalaryPart[]>([{ amount: 0, day: 5 }]);
  const [weekly, setWeekly] = useState(false);
  const [startMonth, setStartMonth] = useState(monthKeyOf(new Date()));
  const [months, setMonths] = useState(12);
  const [bank, setBank] = useState(banks[0]?.name || 'Conta Corrente');

  const partsTotal = Math.round(parts.reduce((acc, p) => acc + (Number(p.amount) || 0), 0) * 100) / 100;
  const keys = Array.from({ length: months }, (_, i) => addMonths(startMonth, i));
  const base = name.trim();
  // Salário previsto com o mesmo nome nesses meses: ajusta-se pela modalidade, sem duplicar
  const conflict = movements.some(
    (m) => isSalaryMovement(m) && m.status === 'PREVISTA' && salaryBaseTitle(m.title) === base && keys.includes(getSalaryCompetenceKey(m))
  );
  const valid =
    base !== '' &&
    total > 0 &&
    !conflict &&
    parts.length > 0 &&
    parts.every((p) => p.amount > 0 && p.day >= 1 && p.day <= 31) &&
    Math.abs(partsTotal - total) < 0.015;

  const save = () => {
    if (!valid) return;
    addMultipleMovements(planSalaryRegime(movements, base, keys, parts, weekly, bank).created);
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title="Cadastrar salário" subtitle="Valor e formato de pagamento" maxWidth="480px">
      <div className="form-group">
        <label>Nome</label>
        <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Valor líquido por mês (R$)</label>
        <DecimalInput
          className="form-input"
          value={total}
          onValueChange={(v) => {
            setTotal(v);
            // Mensal: a única parte acompanha o valor
            if (parts.length === 1) setParts([{ ...parts[0], amount: v }]);
          }}
        />
      </div>

      <label className="text-xs text-muted">Formato de pagamento</label>
      <SalaryPartsEditor
        parts={parts}
        referenceTotal={total}
        onChange={(next, isWeekly) => {
          setParts(next);
          setWeekly(isWeekly);
        }}
      />
      <p className="text-xs mt-2" style={{ color: Math.abs(partsTotal - total) < 0.015 ? 'var(--text-secondary)' : '#f87171' }}>
        Soma das partes: <strong>{formatBRL(partsTotal)}</strong>
        {Math.abs(partsTotal - total) >= 0.015 && <> (precisa fechar em {formatBRL(total)})</>}
      </p>

      <div className="salary-register-row">
        <div className="form-group">
          <label>Começa em</label>
          <input type="month" className="form-input" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Meses a projetar</label>
          <NumberInput min={1} max={36} className="form-input" value={months} onValueChange={setMonths} />
        </div>
      </div>
      {conflict && (
        <p className="text-xs" style={{ color: '#f87171' }}>
          Já existe "{base}" previsto nesses meses. Use o ícone de modalidade no mês para alterá-lo.
        </p>
      )}
      <div className="form-group">
        <label>Conta de destino</label>
        <select className="form-input" value={bank} onChange={(e) => setBank(e.target.value)}>
          {(banks.length > 0 ? banks.map((b) => b.name) : ['Conta Corrente']).map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!valid} onClick={save}>
          Cadastrar
        </button>
      </div>
    </Modal>
  );
};

interface SalaryMonth {
  key: string;
  total: number;
  items: Movement[];
}

/** Uma referência de valor do salário: mesmo valor e mesmo dia em meses seguidos. */
interface SalaryReference {
  base: string;
  /** Dia do pagamento; 'ULTIMO' quando cai no último dia do mês. */
  day: number | 'ULTIMO';
  amount: number;
  startKey: string;
  endKey: string;
  /** Meses lançados nesta referência. */
  count: number;
  status: 'ATUAL' | 'FUTURA' | 'ENCERRADA';
}

const isLastDayOfMonth = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return d === new Date(y, m, 0).getDate();
};
const shortMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${label}/${String(y).slice(2)}`;
};
const dayLabel = (day: SalaryReference['day']) => (day === 'ULTIMO' ? 'último dia do mês' : `dia ${day}`);

/** Agrupa os lançamentos de salário de uma parte em referências: valor e dia iguais em meses seguidos formam uma só linha. */
function buildReferences(base: string, byMonth: Map<string, Movement[]>, thisMonth: string): SalaryReference[] {
  const keys = [...byMonth.keys()].sort();
  const runs: SalaryReference[] = [];
  keys.forEach((key) => {
    const items = byMonth.get(key) ?? [];
    const amount = Math.round(items.reduce((acc, m) => acc + m.amount, 0) * 100) / 100;
    const first = [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const day: SalaryReference['day'] = isLastDayOfMonth(first.dueDate) ? 'ULTIMO' : Number(first.dueDate.slice(8, 10));
    const last = runs[runs.length - 1];
    if (last && last.amount === amount && last.day === day && addMonths(last.endKey, 1) === key) {
      last.endKey = key;
      last.count += 1;
    } else {
      runs.push({ base, day, amount, startKey: key, endKey: key, count: 1, status: 'ATUAL' });
    }
  });
  runs.forEach((run) => {
    run.status = run.endKey < thisMonth ? 'ENCERRADA' : run.startKey > thisMonth ? 'FUTURA' : 'ATUAL';
  });
  return runs;
}

interface ReferenceDraft {
  base: string;
  day: number | 'ULTIMO';
  amount: number;
  startKey: string;
  endKey: string;
}

/** Nova referência de valor: encerra a anterior no mês anterior ao início e abre uma nova daí em diante. */
const SalaryReferenceDialog: React.FC<{
  initial: ReferenceDraft;
  previousStartKey?: string;
  onSave: (draft: ReferenceDraft) => void;
  onClose: () => void;
}> = ({ initial, previousStartKey, onSave, onClose }) => {
  const [amount, setAmount] = useState(initial.amount);
  const [lastDay, setLastDay] = useState(initial.day === 'ULTIMO');
  const [day, setDay] = useState(initial.day === 'ULTIMO' ? 30 : initial.day);
  const [startKey, setStartKey] = useState(initial.startKey);
  const [endKey, setEndKey] = useState(initial.endKey);
  const valid = amount > 0 && endKey >= startKey && (lastDay || (day >= 1 && day <= 31));

  return (
    <Modal isOpen onClose={onClose} title="Novo valor de salário" subtitle={initial.base} maxWidth="440px">
      <p className="text-xs text-muted mb-3">
        A referência atual é encerrada no mês anterior ao início e esta passa a valer a partir dele.
      </p>
      <div className="form-group">
        <label>Valor (R$)</label>
        <DecimalInput className="form-input" value={amount} onValueChange={setAmount} />
      </div>
      <div className="salary-register-row">
        <div className="form-group">
          <label>Dia do pagamento</label>
          <input
            type="number"
            min={1}
            max={31}
            className="form-input"
            value={day}
            disabled={lastDay}
            onChange={(e) => setDay(Number(e.target.value))}
          />
        </div>
        <label className="receipt-change-future" style={{ alignSelf: 'end' }}>
          <input type="checkbox" checked={lastDay} onChange={(e) => setLastDay(e.target.checked)} />
          <span>Último dia do mês</span>
        </label>
      </div>
      <div className="salary-register-row">
        <div className="form-group">
          <label>Início</label>
          <input type="month" className="form-input" value={startKey} onChange={(e) => setStartKey(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Repetir até</label>
          <input type="month" className="form-input" value={endKey} onChange={(e) => setEndKey(e.target.value)} />
        </div>
      </div>
      {previousStartKey && startKey > previousStartKey && (
        <p className="text-xs text-muted">
          A referência anterior passa a terminar em <strong>{shortMonth(addMonths(startKey, -1))}</strong>.
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!valid}
          onClick={() => onSave({ base: initial.base, amount, day: lastDay ? 'ULTIMO' : day, startKey, endKey })}
        >
          Salvar
        </button>
      </div>
    </Modal>
  );
};

/** Salário por referência de valor (dia, valor, início e encerramento), com o detalhe mês a mês logo abaixo. */
export const SalaryOverview: React.FC = () => {
  const { movements, banks, addMultipleMovements, deleteMovement } = useFinancial();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regimeBase, setRegimeBase] = useState<{ base: string; monthKey: string } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [showMonths, setShowMonths] = useState<string | null>(null);
  const [referenceDraft, setReferenceDraft] = useState<{ draft: ReferenceDraft; previousStartKey?: string } | null>(null);

  const thisMonth = monthKeyOf(new Date());

  const bases = useMemo(() => {
    const map = new Map<string, Map<string, Movement[]>>();
    movements.forEach((m) => {
      if (!isSalaryMovement(m)) return;
      const base = m.title;
      const key = getSalaryCompetenceKey(m);
      const months = map.get(base) ?? new Map<string, Movement[]>();
      months.set(key, [...(months.get(key) ?? []), m]);
      map.set(base, months);
    });
    return [...map.entries()]
      .map(([base, months]) => ({
        base,
        references: buildReferences(base, months, thisMonth),
        months: [...months.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, items]): SalaryMonth => ({
            key,
            items: items.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
            total: items.reduce((acc, m) => acc + m.amount, 0),
          })),
      }))
      .sort((a, b) => a.base.localeCompare(b.base));
  }, [movements, thisMonth]);

  const regime = useMemo(() => {
    if (!regimeBase) return null;
    const current = salaryOfCompetence(movements, regimeBase.base, regimeBase.monthKey).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return {
      ...regimeBase,
      current,
      futureMonths: futureSalaryMonths(movements, regimeBase.base, regimeBase.monthKey),
      hasRealized: current.some((m) => m.status === 'REALIZADA'),
    };
  }, [regimeBase, movements]);

  const applyRegime = (result: SalaryRegimeResult) => {
    if (!regime) return;
    const keys = [...(regime.hasRealized ? [] : [regime.monthKey]), ...(result.applyToFuture ? regime.futureMonths : [])];
    const { deleteIds, created } = planSalaryRegime(
      movements,
      regime.base,
      keys,
      result.parts,
      result.weekly,
      regime.current[0]?.bank || banks[0]?.name || 'Conta Corrente'
    );
    deleteIds.forEach((id) => deleteMovement(id));
    if (created.length > 0) addMultipleMovements(created);
    setRegimeBase(null);
  };

  // Nova referência: troca os previstos da parte do mês de início em diante e lança de novo até o fim escolhido
  const saveReference = (draft: ReferenceDraft) => {
    const own = movements.filter((m) => isSalaryMovement(m) && m.title === draft.base);
    const fromStart = own.filter((m) => getSalaryCompetenceKey(m) >= draft.startKey);
    fromStart.filter((m) => m.status === 'PREVISTA').forEach((m) => deleteMovement(m.id));
    const realizedKeys = new Set(fromStart.filter((m) => m.status !== 'PREVISTA').map((m) => getSalaryCompetenceKey(m)));
    const template = [...own].sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
    const group = own.find((m) => m.installmentGroupId?.startsWith('rec_'))?.installmentGroupId || `rec_${Date.now()}`;
    const created: Omit<Movement, 'id'>[] = [];
    for (let key = draft.startKey; key <= draft.endKey; key = addMonths(key, 1)) {
      if (realizedKeys.has(key)) continue;
      const [year, month] = key.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const day = draft.day === 'ULTIMO' ? daysInMonth : Math.min(draft.day, daysInMonth);
      created.push({
        title: draft.base,
        type: 'RECEBER',
        amount: draft.amount,
        originalAmount: draft.amount,
        dueDate: `${key}-${String(day).padStart(2, '0')}`,
        bank: template?.bank || banks[0]?.name || 'Conta Corrente',
        status: 'PREVISTA',
        category: 'Salário',
        installmentGroupId: group,
      });
    }
    if (created.length > 0) addMultipleMovements(created);
    setReferenceDraft(null);
  };

  return (
    <div className="salary-overview">
      <div className="home-card-head">
        <h2>Salário</h2>
        <button type="button" className="btn btn-primary btn-xs" onClick={() => setRegisterOpen(true)}>
          <Plus size={14} /> Cadastrar
        </button>
      </div>

      {bases.length === 0 ? (
        <p className="home-empty">Nenhum salário cadastrado. Cadastre o valor e como ele cai na conta para acompanhar mês a mês.</p>
      ) : (
        bases.map(({ base, references, months }) => {
          const current = references.find((r) => r.status === 'ATUAL') ?? references[references.length - 1];
          const last = references[references.length - 1];
          const monthsVisible = showMonths === base;
          return (
            <div key={base} className="salary-block">
              <div className="salary-block-head">
                <strong className="salary-block-title">{base}</strong>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() =>
                    setReferenceDraft({
                      draft: {
                        base,
                        day: current.day,
                        amount: current.amount,
                        startKey: thisMonth > current.startKey ? thisMonth : current.startKey,
                        endKey: last.endKey,
                      },
                      previousStartKey: current.startKey,
                    })
                  }
                >
                  Novo valor
                </button>
              </div>

              <table className="salary-ref-table">
                <thead>
                  <tr>
                    <th>Pagamento</th>
                    <th>Valor</th>
                    <th>Início</th>
                    <th>Encerramento</th>
                  </tr>
                </thead>
                <tbody>
                  {references.map((ref) => (
                    <tr key={`${ref.startKey}-${ref.amount}-${String(ref.day)}`} className={ref.status === 'ATUAL' ? 'is-current' : ''}>
                      <td>
                        {dayLabel(ref.day)}
                        {ref.status === 'ATUAL' && <small className="salary-ref-badge">atual</small>}
                        {ref.status === 'FUTURA' && <small className="salary-ref-badge is-future">futuro</small>}
                      </td>
                      <td>{formatBRL(ref.amount)}</td>
                      <td>{shortMonth(ref.startKey)}</td>
                      <td>{ref === last ? '—' : shortMonth(ref.endKey)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button type="button" className="link-button" onClick={() => setShowMonths(monthsVisible ? null : base)}>
                {monthsVisible ? 'Ocultar meses' : `Ver mês a mês (${months.length})`}
              </button>

              {monthsVisible && (
                <ul className="salary-month-list">
                  {months.map((month, idx) => {
                    const prev = idx > 0 ? months[idx - 1] : undefined;
                    const delta = prev ? Math.round((month.total - prev.total) * 100) / 100 : 0;
                    return (
                      <li key={month.key} className={month.key === thisMonth ? 'is-current' : ''}>
                        <div className="salary-month-head">
                          <span className="salary-month-name">{monthLabel(month.key)}</span>
                          <strong>{formatBRL(month.total)}</strong>
                          {delta !== 0 && (
                            <small className={delta > 0 ? 'text-emerald' : 'text-rose'}>
                              {delta > 0 ? '+' : '−'}
                              {formatBRL(Math.abs(delta))}
                            </small>
                          )}
                          <button
                            type="button"
                            className="info-btn"
                            title="Modalidade de recebimento"
                            aria-label="Modalidade de recebimento"
                            onClick={() => setRegimeBase({ base: salaryBaseTitle(base), monthKey: month.key })}
                          >
                            <Settings2 size={14} />
                          </button>
                        </div>
                        <div className="salary-month-parts">
                          {month.items.map((m) => (
                            <button key={m.id} type="button" className="salary-part-chip" onClick={() => setEditId(m.id)} title="Ajustar este recebimento">
                              <span>dia {Number(m.dueDate.slice(8, 10))}</span>
                              <strong>{formatBRL(m.amount)}</strong>
                              {m.status === 'REALIZADA' && <small className="text-emerald">✓</small>}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })
      )}

      {registerOpen && <SalaryRegisterModal onClose={() => setRegisterOpen(false)} />}
      {referenceDraft && (
        <SalaryReferenceDialog
          initial={referenceDraft.draft}
          previousStartKey={referenceDraft.previousStartKey}
          onSave={saveReference}
          onClose={() => setReferenceDraft(null)}
        />
      )}
      {regime && (
        <SalaryRegimeDialog
          baseName={regime.base}
          currentTotal={regime.current.reduce((acc, m) => acc + m.amount, 0)}
          currentParts={regime.current.map((m) => ({ amount: m.amount, day: Number(m.dueDate.slice(8, 10)) || 5 }))}
          hasRealizedThisMonth={regime.hasRealized}
          futureCount={regime.futureMonths.length}
          onApply={applyRegime}
          onClose={() => setRegimeBase(null)}
        />
      )}
      {editId && (
        <MovementDetailModal isOpen movement={movements.find((m) => m.id === editId) || null} onClose={() => setEditId(null)} />
      )}
    </div>
  );
};
