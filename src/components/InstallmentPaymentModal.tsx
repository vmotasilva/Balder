import React, { useState } from 'react';
import { Modal } from './Modal';
import { DecimalInput } from './DecimalInput';
import type { Movement } from '../types';

interface InstallmentPaymentModalProps {
  installment: Movement;
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

/** Pagamento de parcela: a data define a competência em que o pagamento aparece; o valor pode diferir do previsto. */
export const InstallmentPaymentModal: React.FC<InstallmentPaymentModalProps> = ({ installment, onClose, onConfirm }) => {
  const expected = installment.originalAmount ?? installment.amount;
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [amount, setAmount] = useState(expected);

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(paymentDate);
  const sameMonthAsDue = validDate && paymentDate.slice(0, 7) === installment.dueDate.slice(0, 7);
  const diff = Math.round((amount - expected) * 100) / 100;
  const label = installment.installmentNumber
    ? `Parcela ${installment.installmentNumber}${installment.installmentsTotal ? `/${installment.installmentsTotal}` : ''}`
    : installment.title;

  return (
    <Modal isOpen onClose={onClose} title={`Pagar ${label}`} subtitle={installment.title} maxWidth="440px">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!validDate || amount <= 0) return;
          onConfirm(paymentDate, Math.round(amount * 100) / 100);
        }}
      >
        <p className="text-xs text-muted mb-3">
          Vencimento em <strong>{formatDate(installment.dueDate)}</strong> · valor previsto <strong>{formatBRL(expected)}</strong>
        </p>

        <div className="installment-pay-grid mb-3">
          <div className="form-group">
            <label htmlFor="inst-pay-date">Data do pagamento</label>
            <input
              id="inst-pay-date"
              type="date"
              className="form-input"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="inst-pay-amount">Valor pago (R$)</label>
            <DecimalInput id="inst-pay-amount" className="form-input" value={amount} onValueChange={setAmount} />
          </div>
        </div>

        {validDate && (
          <div className="installment-pay-info mb-3">
            <span>
              Vai aparecer em <strong>{monthLabel(paymentDate)}</strong>
              {!sameMonthAsDue && <> (o vencimento é em {monthLabel(installment.dueDate).toLowerCase()})</>}.
            </span>
            {diff !== 0 && amount > 0 && (
              <span className={diff > 0 ? 'text-rose' : 'text-emerald'}>
                {formatBRL(Math.abs(diff))} {diff > 0 ? 'a mais' : 'a menos'} que o previsto
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
            Confirmar pagamento
          </button>
        </div>
      </form>
    </Modal>
  );
};
