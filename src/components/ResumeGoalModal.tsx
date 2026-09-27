import React, { useState } from 'react';
import { Modal } from './Modal';
import { DecimalInput } from './DecimalInput';
import { useFinancial } from '../context/FinancialContext';
import type { Goal } from '../types';

interface ResumeGoalModalProps {
  goal: Goal;
  pausedAt?: string;
  onClose: () => void;
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** "Dezembro de 2028" → "2028-12" (formato em que o prazo das metas é guardado). */
export function parseGoalTargetDate(label: string): string | null {
  const m = label.toLowerCase().match(/([a-zç]+)\s+de\s+(\d{4})/);
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1]);
  return idx >= 0 ? `${m[2]}-${String(idx + 1).padStart(2, '0')}` : null;
}

const formatTargetDate = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const addMonths = (monthKey: string, n: number) => {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthsUntil = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number);
  const now = new Date();
  return (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1));
};

/**
 * Retomar uma meta pausada: mostra quanto tempo ficou parada e propõe manter o prazo (aumentando o aporte)
 * ou adiar o prazo pelos meses de pausa (mantendo o aporte). Tudo pode ser ajustado antes de retomar.
 */
export const ResumeGoalModal: React.FC<ResumeGoalModalProps> = ({ goal, pausedAt, onClose }) => {
  const { updateGoal, setGoalStatus } = useFinancial();

  const pausedMonths = pausedAt
    ? Math.max(0, Math.round((Date.now() - new Date(pausedAt).getTime()) / (30.44 * 86400000)))
    : 0;
  const originalTarget = parseGoalTargetDate(goal.targetDate) || addMonths(new Date().toISOString().slice(0, 7), 12);

  const [current, setCurrent] = useState(goal.currentAmount);
  const [targetMonth, setTargetMonth] = useState(originalTarget);
  const [contribution, setContribution] = useState(goal.monthlyContribution);
  const [plan, setPlan] = useState<'MANTER_PRAZO' | 'ADIAR' | 'LIVRE'>('LIVRE');

  const missing = Math.max(0, goal.targetAmount - current);
  const keepDeadlineContribution = (() => {
    const months = monthsUntil(originalTarget);
    return months > 0 ? Math.ceil((missing / months) * 100) / 100 : missing;
  })();
  const postponedTarget = addMonths(originalTarget, Math.max(1, pausedMonths));
  const monthsLeft = monthsUntil(targetMonth);
  const neededForChosen = monthsLeft > 0 ? Math.ceil((missing / monthsLeft) * 100) / 100 : missing;

  const choose = (next: 'MANTER_PRAZO' | 'ADIAR') => {
    setPlan(next);
    if (next === 'MANTER_PRAZO') {
      setTargetMonth(originalTarget);
      setContribution(keepDeadlineContribution);
    } else {
      setTargetMonth(postponedTarget);
      setContribution(goal.monthlyContribution);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Retomar meta" subtitle={goal.title} maxWidth="500px">
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
        {pausedAt
          ? `Pausada em ${new Date(pausedAt).toLocaleDateString('pt-BR')} (${pausedMonths} ${pausedMonths === 1 ? 'mês' : 'meses'}).`
          : 'Meta pausada.'}{' '}
        Faltam <strong>{formatBRL(missing)}</strong> para {formatBRL(goal.targetAmount)}.
      </p>

      <div className="resume-options mb-3">
        <button type="button" className={`resume-option ${plan === 'MANTER_PRAZO' ? 'is-active' : ''}`} onClick={() => choose('MANTER_PRAZO')}>
          <strong>Manter o prazo ({formatTargetDate(originalTarget)})</strong>
          <span>Aporte passa a {formatBRL(keepDeadlineContribution)}/mês</span>
        </button>
        <button type="button" className={`resume-option ${plan === 'ADIAR' ? 'is-active' : ''}`} onClick={() => choose('ADIAR')}>
          <strong>Adiar para {formatTargetDate(postponedTarget)}</strong>
          <span>Mantém {formatBRL(goal.monthlyContribution)}/mês ({Math.max(1, pausedMonths)} mês(es) a mais)</span>
        </button>
      </div>

      <div className="resume-fields mb-3">
        <label className="form-group">
          <span>Já guardado (R$)</span>
          <DecimalInput className="form-input" value={current} onValueChange={(v) => { setCurrent(v); setPlan('LIVRE'); }} />
        </label>
        <label className="form-group">
          <span>Prazo</span>
          <input type="month" className="form-input" value={targetMonth} onChange={(e) => { setTargetMonth(e.target.value); setPlan('LIVRE'); }} />
        </label>
        <label className="form-group">
          <span>Aporte mensal (R$)</span>
          <DecimalInput className="form-input" value={contribution} onValueChange={(v) => { setContribution(v); setPlan('LIVRE'); }} />
        </label>
      </div>

      {monthsLeft > 0 && Math.abs(neededForChosen - contribution) > 0.01 && (
        <p className="text-xs mb-3" style={{ color: contribution < neededForChosen ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
          Para chegar em {formatTargetDate(targetMonth).toLowerCase()} são necessários {formatBRL(neededForChosen)}/mês.{' '}
          <button type="button" className="link-button" onClick={() => setContribution(neededForChosen)}>
            usar este valor
          </button>
        </p>
      )}
      {monthsLeft <= 0 && <p className="text-xs text-rose mb-3">Escolha um prazo a partir do próximo mês.</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
          Continuar pausada
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={monthsLeft <= 0}
          onClick={() => {
            updateGoal(goal.id, {
              currentAmount: current,
              targetDate: formatTargetDate(targetMonth),
              monthlyContribution: contribution,
            });
            setGoalStatus(goal.id, null);
            onClose();
          }}
        >
          Retomar meta
        </button>
      </div>
    </Modal>
  );
};
