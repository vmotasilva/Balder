import React, { useState } from 'react';
import { Modal } from './Modal';
import { DecimalInput } from './DecimalInput';
import { calculatePresentValue } from '../utils/loanMath';
import type { Movement } from '../types';

interface InstallmentPaymentModalProps {
  installment: Movement;
  /** Taxa mensal do banco (%), usada no desconto por antecipação. */
  monthlyRatePercent: number;
  onClose: () => void;
  onConfirm: (paymentDate: string, amount: number) => void;
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (iso: string) => iso.split('-').reverse().join('/');
const monthLabel = (iso: string) => {
  const [y, m] = iso.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

interface InstallmentPaymentFormProps extends InstallmentPaymentModalProps {
  submitLabel?: string;
}

/**
 * Pagamento de parcela: a data define a competência em que o pagamento aparece. O valor sugerido segue a
 * regra de antecipação da planilha (taxa do banco); o usuário pode ajustar para o valor efetivamente pago.
 */
export const InstallmentPaymentForm: React.FC<InstallmentPaymentFormProps> = ({
  installment,
  monthlyRatePercent,
  onClose,
  onConfirm,
  submitLabel = 'Confirmar pagamento',
}) => {
  const expected = installment.originalAmount ?? installment.amount;
  const [paymentDate, setPaymentDate] = useState(installment.dueDate || todayIso());
  const [typedAmount, setTypedAmount] = useState<number | null>(null);

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(paymentDate);
  const pv = validDate ? calculatePresentValue(expected, installment.dueDate, paymentDate, monthlyRatePercent) : null;
  const suggested = pv ? pv.discountedAmount : expected;
  const amount = typedAmount ?? suggested;

  const sameMonthAsDue = validDate && paymentDate.slice(0, 7) === installment.dueDate.slice(0, 7);
  const diff = Math.round((amount - expected) * 100) / 100;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!validDate || amount <= 0) return;
        onConfirm(paymentDate, Math.round(amount * 100) / 100);
      }}
    >
      <p className="text-xs text-muted mb-3">
        Vencimento em <strong>{formatDate(installment.dueDate)}</strong> · valor da parcela <strong>{formatBRL(expected)}</strong>
        {monthlyRatePercent > 0 && (
          <> · taxa {monthlyRatePercent.toLocaleString('pt-BR', { maximumFractionDigits: 5 })}% a.m.</>
        )}
      </p>

      <div className="installment-pay-grid mb-3">
        <div className="form-group">
          <label htmlFor="inst-pay-date">Data do pagamento</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
            <input
              id="inst-pay-date"
              type="date"
              className="form-input"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setPaymentDate(todayIso())}
              disabled={paymentDate === todayIso()}
            >
              Hoje
            </button>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="inst-pay-amount">Valor pago (R$)</label>
          <DecimalInput id="inst-pay-amount" className="form-input" value={amount} onValueChange={setTypedAmount} />
        </div>
      </div>

      {validDate && (
        <div className="installment-pay-info mb-3">
          <span>
            Vai aparecer em <strong>{monthLabel(paymentDate)}</strong>
            {!sameMonthAsDue && <> (o vencimento é em {monthLabel(installment.dueDate).toLowerCase()})</>}.
          </span>
          {pv && pv.discountAmount > 0 && (
            <span>
              Pagando {pv.daysToDueDate} dia(s) antes do vencimento, a parcela sai por{' '}
              <strong>{formatBRL(pv.discountedAmount)}</strong> (desconto de {formatBRL(pv.discountAmount)}).
            </span>
          )}
          {typedAmount !== null && Math.abs(typedAmount - suggested) > 0.005 && (
            <button type="button" className="btn btn-outline btn-xs installment-pay-reset" onClick={() => setTypedAmount(null)}>
              Usar o valor calculado ({formatBRL(suggested)})
            </button>
          )}
          {diff !== 0 && amount > 0 && (
            <span className={diff > 0 ? 'text-rose' : 'text-emerald'}>
              {formatBRL(Math.abs(diff))} {diff > 0 ? 'a mais' : 'a menos'} que a parcela
              {diff > 0 ? ' (juros ou multa)' : ' (desconto)'}.
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!validDate || amount <= 0}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
};

export const InstallmentPaymentModal: React.FC<InstallmentPaymentModalProps> = (props) => {
  const { installment, onClose } = props;
  const label = installment.installmentNumber
    ? `Parcela ${installment.installmentNumber}${installment.installmentsTotal ? `/${installment.installmentsTotal}` : ''}`
    : installment.title;

  return (
    <Modal isOpen onClose={onClose} title={`Pagar ${label}`} subtitle={installment.title} maxWidth="460px">
      <InstallmentPaymentForm {...props} />
    </Modal>
  );
};
