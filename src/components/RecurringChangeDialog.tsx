import React, { useState } from 'react';
import { Modal } from './Modal';
import type { Movement } from '../types';

/** Lançamentos seguintes (ainda previstos) da mesma série de repetição mensal. */
export function futureRecurringSiblings(movement: Movement, movements: Movement[]): Movement[] {
  const group = movement.installmentGroupId;
  if (!group || !group.startsWith('rec_')) return [];
  return movements
    .filter((m) => m.installmentGroupId === group && m.id !== movement.id && m.dueDate > movement.dueDate && m.status === 'PREVISTA')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export interface RecurringChangePrompt {
  movementId: string;
  previousAmount: number;
  newAmount: number;
  futureIds: string[];
  firstFutureDate: string;
}

interface RecurringChangeDialogProps {
  prompt: RecurringChangePrompt;
  /** Só este mês, com justificativa opcional. */
  onThisMonthOnly: (reason: string) => void;
  /** Este e os meses seguintes. */
  onApplyToFuture: () => void;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Alteração de valor em um lançamento com repetição mensal: pergunta se os meses seguintes mudam também.
 * Fechar sem escolher mantém a alteração só neste mês.
 */
export const RecurringChangeDialog: React.FC<RecurringChangeDialogProps> = ({ prompt, onThisMonthOnly, onApplyToFuture }) => {
  const [reason, setReason] = useState('');
  const n = prompt.futureIds.length;

  return (
    <Modal
      isOpen
      onClose={() => onThisMonthOnly(reason)}
      title="Alterar também os próximos meses?"
      subtitle="Este lançamento se repete todo mês"
      maxWidth="460px"
    >
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
        O valor mudou de <strong>{formatBRL(prompt.previousAmount)}</strong> para <strong>{formatBRL(prompt.newAmount)}</strong>.
        Há {n} {n === 1 ? 'mês seguinte previsto' : 'meses seguintes previstos'} a partir de{' '}
        {prompt.firstFutureDate.split('-').reverse().join('/')}.
      </p>

      <div className="recurring-choice">
        <button type="button" className="btn btn-primary btn-sm" onClick={onApplyToFuture}>
          Este e os {n} {n === 1 ? 'mês seguinte' : 'meses seguintes'}
        </button>

        <div className="recurring-choice-only">
          <label htmlFor="recurring-reason" className="text-xs text-muted">
            Ou manter a alteração só neste mês. Justificativa (opcional):
          </label>
          <input
            id="recurring-reason"
            type="text"
            className="form-input form-input-sm"
            placeholder="Ex.: reajuste pontual, desconto do mês"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onThisMonthOnly(reason)}>
            Só este mês
          </button>
        </div>
      </div>
    </Modal>
  );
};
