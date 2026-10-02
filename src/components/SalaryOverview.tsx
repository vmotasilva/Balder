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

/** Acompanhamento do salário mês a mês: quanto cai em cada competência, em quantas partes, e atalhos para cadastrar e ajustar. */
export const SalaryOverview: React.FC = () => {
  const { movements, banks, addMultipleMovements, deleteMovement } = useFinancial();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regimeBase, setRegimeBase] = useState<{ base: string; monthKey: string } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const thisMonth = monthKeyOf(new Date());
  const fromKey = addMonths(thisMonth, -1);

  const bases = useMemo(() => {
    const map = new Map<string, Map<string, Movement[]>>();
    movements.forEach((m) => {
      if (!isSalaryMovement(m)) return;
      const base = salaryBaseTitle(m.title);
      const key = getSalaryCompetenceKey(m);
      if (key < fromKey) return;
      const months = map.get(base) ?? new Map<string, Movement[]>();
      months.set(key, [...(months.get(key) ?? []), m]);
      map.set(base, months);
    });
    return [...map.entries()].map(([base, months]) => ({
      base,
      months: [...months.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, items]): SalaryMonth => ({
          key,
          items: items.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
          total: items.reduce((acc, m) => acc + m.amount, 0),
        })),
    }));
  }, [movements, fromKey]);

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
        bases.map(({ base, months }) => {
          const visible = showAll ? months : months.slice(0, 6);
          return (
            <div key={base} className="salary-block">
              <strong className="salary-block-title">{base}</strong>
              <ul className="salary-month-list">
                {visible.map((month, idx) => {
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
                          onClick={() => setRegimeBase({ base, monthKey: month.key })}
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
              {months.length > 6 && (
                <button type="button" className="link-button" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Mostrar menos' : `Ver todos (${months.length} meses)`}
                </button>
              )}
            </div>
          );
        })
      )}

      {registerOpen && <SalaryRegisterModal onClose={() => setRegisterOpen(false)} />}
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
