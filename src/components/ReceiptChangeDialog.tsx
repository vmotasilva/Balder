import React, { useState } from 'react';
import { Modal } from './Modal';
import { isSalaryMovement } from '../utils/projectionMath';
import { futureRecurringSiblings } from './RecurringChangeDialog';
import type { Movement } from '../types';

/**
 * Lançamentos seguintes (ainda previstos) a que a mudança de valor pode se estender: a série de repetição
 * mensal ou, no caso de salário, os próximos meses com o mesmo título.
 */
export function futureReceiptSiblings(movement: Movement, movements: Movement[]): Movement[] {
  const series = futureRecurringSiblings(movement, movements);
  if (series.length > 0 || !isSalaryMovement(movement)) return series;
  return movements
    .filter(
      (m) =>
        m.id !== movement.id &&
        m.title === movement.title &&
        m.dueDate > movement.dueDate &&
        m.status === 'PREVISTA' &&
        isSalaryMovement(m)
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export type ReceiptChangeKind = 'RAISE' | 'CORRECTION' | 'ONE_OFF';

export interface ReceiptChangeResult {
  kind: ReceiptChangeKind;
  /** Texto já pronto para gravar como justificativa. */
  reason: string;
  applyToFuture: boolean;
}

interface ReceiptChangeDialogProps {
  previousAmount: number;
  newAmount: number;
  futureCount: number;
  firstFutureDate?: string;
  onConfirm: (result: ReceiptChangeResult) => void;
  /** Fechar sem responder mantém só a alteração deste mês. */
  onSkip: () => void;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const KINDS: { id: ReceiptChangeKind; label: string; hint: string; reason: string }[] = [
  { id: 'RAISE', label: 'Aumento salarial', hint: 'O valor de referência passa a ser o novo.', reason: 'Aumento salarial' },
  {
    id: 'CORRECTION',
    label: 'Informação registrada errada',
    hint: 'Eu tinha lançado o valor errado.',
    reason: 'Correção de valor registrado',
  },
  {
    id: 'ONE_OFF',
    label: 'Só deste mês',
    hint: 'Desconto, bônus ou ajuste pontual; a referência não muda.',
    reason: '',
  },
];

/**
 * Ao mudar o valor de um recebimento, pergunta o motivo (isso define se a referência do contrato muda)
 * e se os meses seguintes acompanham.
 */
export const ReceiptChangeDialog: React.FC<ReceiptChangeDialogProps> = ({
  previousAmount,
  newAmount,
  futureCount,
  firstFutureDate,
  onConfirm,
  onSkip,
}) => {
  const [kind, setKind] = useState<ReceiptChangeKind | null>(null);
  const [applyToFuture, setApplyToFuture] = useState(true);
  const [detail, setDetail] = useState('');

  const choose = (id: ReceiptChangeKind) => {
    setKind(id);
    // Aumento e correção valem daqui para frente; ajuste pontual, não
    setApplyToFuture(id !== 'ONE_OFF');
  };

  const confirm = () => {
    if (!kind) return;
    const base = KINDS.find((k) => k.id === kind)?.reason ?? '';
    const reason = [base, detail.trim()].filter(Boolean).join(' — ');
    onConfirm({ kind, reason, applyToFuture: futureCount > 0 && applyToFuture });
  };

  return (
    <Modal isOpen onClose={onSkip} title="Por que o valor mudou?" subtitle={`${formatBRL(previousAmount)} → ${formatBRL(newAmount)}`} maxWidth="460px">
      <div className="receipt-change-kinds">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            className={`receipt-change-kind ${kind === k.id ? 'is-active' : ''}`}
            onClick={() => choose(k.id)}
          >
            <strong>{k.label}</strong>
            <span>{k.hint}</span>
          </button>
        ))}
      </div>

      {kind && (
        <input
          type="text"
          className="form-input form-input-sm mt-3"
          placeholder="Detalhe (opcional)"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
        />
      )}

      {kind && futureCount > 0 && (
        <label className="receipt-change-future">
          <input type="checkbox" checked={applyToFuture} onChange={(e) => setApplyToFuture(e.target.checked)} />
          <span>
            Ajustar também {futureCount === 1 ? 'o mês seguinte' : `os ${futureCount} meses seguintes`}
            {firstFutureDate && <> (a partir de {firstFutureDate.split('-').reverse().join('/')})</>}
          </span>
        </label>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={onSkip}>
          Pular
        </button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!kind} onClick={confirm}>
          Confirmar
        </button>
      </div>
    </Modal>
  );
};
