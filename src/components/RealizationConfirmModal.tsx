import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal';
import { DecimalInput } from './DecimalInput';
import type { Movement } from '../types';

/** O que está sendo confirmado como pago ou recebido. */
export interface RealizationTarget {
  kind: 'ENTRADA' | 'SAIDA';
  title: string;
  /** Valor previsto: vem preenchido e pode ser corrigido. */
  expectedAmount: number;
  /** Vencimento previsto (YYYY-MM-DD). */
  dueDate: string;
  onConfirm: (amount: number, date: string) => void;
}

interface RealizationConfirmModalProps {
  target: RealizationTarget | null;
  onClose: () => void;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (iso: string) => iso.split('-').reverse().join('/');
const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

/** Campos de uma movimentação confirmada com o valor e a data informados (o previsto fica em originalAmount). */
export const realizedMovementUpdates = (m: Movement, amount: number, date: string): Partial<Movement> => {
  const changed = Math.abs(amount - m.amount) >= 0.005;
  return {
    status: 'REALIZADA',
    paymentDate: date,
    actualAmount: amount,
    ...(changed ? { amount, originalAmount: m.originalAmount ?? m.amount } : {}),
  };
};

/** Desfazer a confirmação: volta a ficar em aberto e, se o valor foi corrigido ao confirmar, volta ao previsto. */
export const reopenedMovementUpdates = (m: Movement): Partial<Movement> => ({
  status: 'PREVISTA',
  ...(m.originalAmount !== undefined && Math.abs(m.originalAmount - m.amount) >= 0.005 ? { amount: m.originalAmount } : {}),
});

/** Pedido de confirmação para desfazer (vai no ConfirmDialog antes de reabrir a movimentação). */
export const reopenConfirmOptions = (m: Movement, onConfirm: () => void) => {
  const isIncome = m.type === 'RECEBER';
  const restores = m.originalAmount !== undefined && Math.abs(m.originalAmount - m.amount) >= 0.005;
  const done = `${formatBRL(m.actualAmount ?? m.amount)}${m.paymentDate ? ` em ${formatDate(m.paymentDate)}` : ''}`;
  return {
    title: isIncome ? 'Desfazer recebimento' : 'Desfazer pagamento',
    message: `${m.title}: o ${isIncome ? 'recebimento' : 'pagamento'} de ${done} será desfeito e volta a ficar em aberto${
      restores ? `, com o valor previsto de ${formatBRL(m.originalAmount!)}` : ''
    }.`,
    confirmLabel: 'Desfazer',
    variant: 'warning' as const,
    onConfirm,
  };
};

/**
 * Confirmação de um pagamento ou recebimento: antes de dar baixa, a pessoa confere (e corrige, se preciso)
 * o valor e a data em que o dinheiro de fato saiu ou entrou.
 */
export const RealizationConfirmModal: React.FC<RealizationConfirmModalProps> = ({ target, onClose }) => {
  if (!target) return null;
  return <RealizationConfirmForm key={`${target.title}_${target.dueDate}_${target.expectedAmount}`} target={target} onClose={onClose} />;
};

const RealizationConfirmForm: React.FC<{ target: RealizationTarget; onClose: () => void }> = ({ target, onClose }) => {
  const today = todayIso();
  const isIncome = target.kind === 'ENTRADA';
  const [amount, setAmount] = useState(target.expectedAmount);
  // Vencimento que já passou: o mais comum é ter pago no dia e só confirmar agora
  const [date, setDate] = useState(target.dueDate < today ? target.dueDate : today);

  const diff = Math.round((amount - target.expectedAmount) * 100) / 100;
  const futureDate = date > today;
  const valid = amount > 0 && !!date && !futureDate;

  const confirm = () => {
    if (!valid) return;
    target.onConfirm(Math.round(amount * 100) / 100, date);
    onClose();
  };

  const dateChips = [
    { label: 'Hoje', value: today },
    ...(target.dueDate !== today && target.dueDate < today ? [{ label: `No vencimento (${formatDate(target.dueDate)})`, value: target.dueDate }] : []),
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isIncome ? 'Confirmar recebimento' : 'Confirmar pagamento'}
      subtitle={target.title}
      maxWidth="440px"
    >
      <form
        className="mapping-pay"
        onSubmit={(e) => {
          e.preventDefault();
          confirm();
        }}
      >
        <div className="mapping-pay-summary">
          <span>
            Previsto <strong>{formatBRL(target.expectedAmount)}</strong>
          </span>
          <span>
            Vencimento <strong>{formatDate(target.dueDate)}</strong>
          </span>
        </div>

        <div className="mapping-pay-fields">
          <label>
            <span>{isIncome ? 'Valor recebido' : 'Valor pago'}</span>
            <DecimalInput
              className="form-input"
              value={amount}
              onValueChange={setAmount}
              emptyWhenZero
              autoFocus
              aria-label={isIncome ? 'Valor recebido' : 'Valor pago'}
            />
          </label>
          <label>
            <span>{isIncome ? 'Data do recebimento' : 'Data do pagamento'}</span>
            <input type="date" className="form-input" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <div className="realization-chips">
          {dateChips.map((c) => (
            <button key={c.label} type="button" className={`realization-chip ${date === c.value ? 'is-active' : ''}`} onClick={() => setDate(c.value)}>
              {c.label}
            </button>
          ))}
          {Math.abs(diff) >= 0.01 && (
            <button type="button" className="realization-chip" onClick={() => setAmount(target.expectedAmount)}>
              Voltar ao previsto
            </button>
          )}
        </div>

        {Math.abs(diff) >= 0.01 && amount > 0 && (
          <p className="mapping-pay-feedback">
            {isIncome ? 'Entrou' : 'Saiu'}{' '}
            <strong className={(diff > 0) === isIncome ? 'text-emerald' : 'text-rose'}>
              {formatBRL(Math.abs(diff))} {diff > 0 ? 'a mais' : 'a menos'}
            </strong>{' '}
            que o previsto.
          </p>
        )}
        {futureDate && <p className="mapping-pay-feedback text-rose">A data não pode ser depois de hoje.</p>}

        <div className="mapping-pay-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            <CheckCircle2 size={16} />
            <span>
              {isIncome ? 'Confirmar recebimento' : 'Confirmar pagamento'}
              {amount > 0 ? ` de ${formatBRL(amount)}` : ''}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
