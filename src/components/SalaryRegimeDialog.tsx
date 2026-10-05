import React, { useState } from 'react';
import { Modal } from './Modal';
import { DecimalInput } from './DecimalInput';
import { isSalaryMovement, getSalaryCompetenceKey } from '../utils/projectionMath';
import type { Movement } from '../types';

export interface SalaryPart {
  amount: number;
  day: number;
  /** Cai no último dia de cada mês (28, 29, 30 ou 31); `day` é ignorado. */
  lastDay?: boolean;
}

/** Partes de pagamento a partir dos lançamentos do mês, reconhecendo o último dia do mês. */
export function salaryPartsFromMovements(movements: Pick<Movement, 'amount' | 'dueDate'>[]): SalaryPart[] {
  return movements.map((m) => {
    const [y, mo, d] = m.dueDate.split('-').map(Number);
    return { amount: m.amount, day: d || 5, lastDay: !!d && d === new Date(y, mo, 0).getDate() };
  });
}

/** Título sem o sufixo da parte ("(adiantamento)", "(2ª parte)", "(2/3)", "(3ª semana)"). */
export function salaryBaseTitle(title: string): string {
  return title
    .replace(/\s*\((adiantamento|\d+ª parte|\d+\/\d+|\d+ª semana)\)\s*$/i, '')
    .trim();
}

/** Título de cada parte conforme a quantidade de partes; 2 partes mantém o padrão do cadastro guiado. */
export function salaryPartTitle(base: string, index: number, total: number, weekly: boolean): string {
  if (total === 1) return base;
  if (total === 2) return index === 0 ? `${base} (adiantamento)` : `${base} (2ª parte)`;
  return weekly ? `${base} (${index + 1}ª semana)` : `${base} (${index + 1}/${total})`;
}

/** Recebimentos previstos e já realizados da competência que pertencem a este salário. */
export function salaryOfCompetence(movements: Movement[], base: string, monthKey: string): Movement[] {
  return movements.filter(
    (m) => isSalaryMovement(m) && getSalaryCompetenceKey(m) === monthKey && salaryBaseTitle(m.title) === base
  );
}

/** Competências seguintes (YYYY-MM) em que o salário ainda tem lançamentos previstos. */
export function futureSalaryMonths(movements: Movement[], base: string, monthKey: string): string[] {
  const keys = new Set<string>();
  movements.forEach((m) => {
    if (!isSalaryMovement(m) || m.status !== 'PREVISTA' || salaryBaseTitle(m.title) !== base) return;
    const key = getSalaryCompetenceKey(m);
    if (key > monthKey) keys.add(key);
  });
  return [...keys].sort();
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Preset {
  id: string;
  label: string;
  weekly?: boolean;
  /** Divide o total em partes (a última leva o arredondamento). */
  build: (total: number) => SalaryPart[];
}

const splitEqual = (total: number, days: number[]): SalaryPart[] => {
  const each = Math.floor((total / days.length) * 100) / 100;
  return days.map((day, i) => ({
    day,
    lastDay: day === 30,
    amount: i === days.length - 1 ? Math.round((total - each * (days.length - 1)) * 100) / 100 : each,
  }));
};

const PRESETS: Preset[] = [
  { id: 'MONTHLY', label: 'Mensal', build: (t) => [{ amount: t, day: 5 }] },
  {
    id: 'BIWEEKLY',
    label: 'Quinzenal (2 partes)',
    build: (t) => {
      const advance = Math.round(t * 0.4 * 100) / 100;
      return [
        { amount: advance, day: 15 },
        { amount: Math.round((t - advance) * 100) / 100, day: 30, lastDay: true },
      ];
    },
  },
  { id: 'THREE', label: '3 partes', build: (t) => splitEqual(t, [10, 20, 30]) },
  { id: 'WEEKLY', label: 'Semanal (4 semanas)', weekly: true, build: (t) => splitEqual(t, [7, 14, 21, 28]) },
];

interface SalaryPaymentFieldsProps {
  amount: number;
  day: number;
  lastDay: boolean;
  onChange: (patch: { amount?: number; day?: number; lastDay?: boolean }) => void;
}

/** Valor, dia do pagamento e "Último dia do mês": o mesmo formulário no valor de salário e na modalidade de recebimento. */
export const SalaryPaymentFields: React.FC<SalaryPaymentFieldsProps> = ({ amount, day, lastDay, onChange }) => (
  <div className="salary-payment-fields">
    <div className="form-group">
      <label>Valor (R$)</label>
      <DecimalInput className="form-input" value={amount} onValueChange={(v) => onChange({ amount: v })} />
    </div>
    <div className="salary-register-row">
      <div className="form-group">
        <label>Dia do pagamento</label>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          className="form-input"
          value={lastDay ? '' : day}
          placeholder={lastDay ? 'fim' : undefined}
          disabled={lastDay}
          onChange={(e) => onChange({ day: Number(e.target.value) })}
        />
      </div>
      <label className="receipt-change-future" style={{ alignSelf: 'end' }}>
        <input type="checkbox" checked={lastDay} onChange={(e) => onChange({ lastDay: e.target.checked })} />
        <span>Último dia do mês</span>
      </label>
    </div>
  </div>
);

interface SalaryPartsEditorProps {
  parts: SalaryPart[];
  /** Total que os atalhos (quinzenal, semanal…) dividem. */
  referenceTotal: number;
  onChange: (parts: SalaryPart[], weekly: boolean) => void;
}

/** Atalhos de modalidade e edição de valor e dia de cada parte do pagamento. */
export const SalaryPartsEditor: React.FC<SalaryPartsEditorProps> = ({ parts, referenceTotal, onChange }) => {
  const setPart = (index: number, patch: Partial<SalaryPart>) =>
    onChange(parts.map((p, i) => (i === index ? { ...p, ...patch } : p)), false);

  const addPart = () => {
    const last = parts[parts.length - 1];
    onChange([...parts, { amount: 0, day: Math.min(30, (last?.day ?? 0) + 5), lastDay: false }], false);
  };

  return (
    <>
      <div className="salary-regime-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="btn btn-outline btn-xs"
            onClick={() => {
              onChange(preset.build(referenceTotal), !!preset.weekly);
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="salary-regime-parts">
        {parts.map((part, i) => (
          <div key={i} className="salary-regime-part">
            <div className="salary-regime-part-head">
                <span className="salary-regime-part-label">
                  {parts.length === 1 ? 'Pagamento' : `${i + 1}ª parte`}
                </span>
                {parts.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    aria-label="Remover parte"
                    onClick={() => onChange(parts.filter((_, idx) => idx !== i), false)}
                  >
                    ✕
                  </button>
                )}
              </div>
            <SalaryPaymentFields
              amount={part.amount}
              day={part.day}
              lastDay={!!part.lastDay}
              onChange={(patch) => setPart(i, patch)}
            />
          </div>
        ))}
        <button type="button" className="btn btn-outline btn-xs" onClick={addPart}>
          + Adicionar parte
        </button>
      </div>

    </>
  );
};

/** Lançamentos a apagar e a criar para aplicar uma modalidade nas competências indicadas (só os previstos são trocados). */
export function planSalaryRegime(
  movements: Movement[],
  base: string,
  monthKeys: string[],
  parts: SalaryPart[],
  weekly: boolean,
  fallbackBank: string
): { deleteIds: string[]; created: Omit<Movement, 'id'>[] } {
  const stamp = Date.now();
  const deleteIds: string[] = [];
  const created: Omit<Movement, 'id'>[] = [];
  monthKeys.forEach((monthKey) => {
    const existing = salaryOfCompetence(movements, base, monthKey).filter((m) => m.status === 'PREVISTA');
    existing.forEach((m) => deleteIds.push(m.id));
    const bank = existing[0]?.bank || fallbackBank;
    const [year, month] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    parts.forEach((part, i) => {
      created.push({
        title: salaryPartTitle(base, i, parts.length, weekly),
        type: 'RECEBER',
        amount: part.amount,
        originalAmount: part.amount,
        dueDate: `${monthKey}-${String(part.lastDay ? daysInMonth : Math.min(part.day, daysInMonth)).padStart(2, '0')}`,
        bank,
        status: 'PREVISTA',
        category: 'Salário',
        installmentGroupId: `rec_${stamp}_${i}`,
      });
    });
  });
  return { deleteIds, created };
}

export interface SalaryRegimeResult {
  parts: SalaryPart[];
  weekly: boolean;
  applyToFuture: boolean;
}

interface SalaryRegimeDialogProps {
  baseName: string;
  /** Soma do que o salário rende na competência hoje. */
  currentTotal: number;
  currentParts: SalaryPart[];
  /** Já existe recebimento realizado nesta competência: a mudança só vale para os meses seguintes. */
  hasRealizedThisMonth: boolean;
  futureCount: number;
  onApply: (result: SalaryRegimeResult) => void;
  onClose: () => void;
}

/**
 * Modalidade de recebimento do salário: mensal, em partes (quinzenal, semanal ou personalizada) e o caminho de volta.
 * Pergunta se a mudança vale também para os meses seguintes.
 */
export const SalaryRegimeDialog: React.FC<SalaryRegimeDialogProps> = ({
  baseName,
  currentTotal,
  currentParts,
  hasRealizedThisMonth,
  futureCount,
  onApply,
  onClose,
}) => {
  const [parts, setParts] = useState<SalaryPart[]>(currentParts.length > 0 ? currentParts : [{ amount: currentTotal, day: 5 }]);
  const [weekly, setWeekly] = useState(false);
  const [applyToFuture, setApplyToFuture] = useState(true);

  const total = Math.round(parts.reduce((acc, p) => acc + (Number(p.amount) || 0), 0) * 100) / 100;
  const valid = parts.length > 0 && parts.every((p) => p.amount > 0 && (p.lastDay || (p.day >= 1 && p.day <= 31)));
  const mustUseFuture = hasRealizedThisMonth;
  const willApplyFuture = futureCount > 0 && (mustUseFuture || applyToFuture);
  const nothingToDo = mustUseFuture && futureCount === 0;

  return (
    <Modal isOpen onClose={onClose} title="Modalidade de recebimento" subtitle={baseName} maxWidth="480px">
      <p className="text-xs text-muted mb-3">
        Escolha como o salário cai na conta. Para voltar a receber de uma vez, use <strong>Mensal</strong>.
      </p>

      <SalaryPartsEditor
        parts={parts}
        referenceTotal={currentTotal > 0 ? currentTotal : total}
        onChange={(next, isWeekly) => {
          setParts(next);
          setWeekly(isWeekly);
        }}
      />

      <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
        Total do mês: <strong>{formatBRL(total)}</strong>
        {Math.abs(total - currentTotal) > 0.005 && <> (hoje: {formatBRL(currentTotal)})</>}
      </p>

      {hasRealizedThisMonth && (
        <p className="text-xs mt-2" style={{ color: '#fbbf24' }}>
          Este mês já tem recebimento realizado, então a mudança vale a partir do mês seguinte.
        </p>
      )}

      {futureCount > 0 && !mustUseFuture && (
        <label className="receipt-change-future">
          <input type="checkbox" checked={applyToFuture} onChange={(e) => setApplyToFuture(e.target.checked)} />
          <span>Aplicar também {futureCount === 1 ? 'ao mês seguinte' : `aos ${futureCount} meses seguintes`}</span>
        </label>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!valid || nothingToDo}
          onClick={() => onApply({ parts, weekly, applyToFuture: willApplyFuture })}
        >
          Aplicar
        </button>
      </div>
    </Modal>
  );
};
