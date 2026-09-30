import React, { useMemo, useState } from 'react';
import { CheckCircle2, Trash2, Wallet } from 'lucide-react';
import { Modal } from './Modal';
import { DecimalInput } from './DecimalInput';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { useFinancial } from '../context/FinancialContext';
import { registerMappingPayment, removeMappingPayment, resolveMappingMonth } from '../utils/mappingItemState';

/** Mapeamento em modo Resumo na competência (a linha de cobrança da natureza). */
export interface MappingPaymentTarget {
  natureId: string;
  mappingId: string;
  /** Itens que compõem a linha (um mapeamento misto tem uma linha para cartão e outra para os demais). */
  itemIds: string[];
  monthKey: string; // YYYY-MM
  title: string;
}

interface MappingPaymentModalProps {
  target: MappingPaymentTarget | null;
  onClose: () => void;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (iso: string) => iso.split('-').reverse().join('/');
const monthLabel = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
const defaultPaidAt = (monthKey: string) => {
  const n = new Date();
  const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  return today.startsWith(monthKey) ? today : `${monthKey}-01`;
};

/**
 * Lançamento do mapeamento em modo Resumo: só valor e data. Os itens servem apenas para compor o previsto;
 * cada pagamento abate do previsto do mapeamento (pode ser em partes, ex.: uma compra por semana).
 */
export const MappingPaymentModal: React.FC<MappingPaymentModalProps> = ({ target, onClose }) => {
  if (!target) return null;
  return <MappingPaymentForm key={`${target.mappingId}_${target.monthKey}_${target.itemIds.join('.')}`} target={target} onClose={onClose} />;
};

const MappingPaymentForm: React.FC<{ target: MappingPaymentTarget; onClose: () => void }> = ({ target, onClose }) => {
  const { natures, updateMappingItemState } = useFinancial();
  const { confirm, dialogProps } = useConfirmDialog();
  const { monthKey } = target;

  const scope = useMemo(() => {
    const mapping = natures.find((n) => n.id === target.natureId)?.mappings.find((m) => m.id === target.mappingId);
    return { items: (mapping?.items || []).filter((it) => target.itemIds.includes(it.id)) };
  }, [natures, target]);
  const month = resolveMappingMonth(scope, monthKey);

  const [amount, setAmount] = useState<number | null>(null);
  const paidAmount = amount ?? month.pending;
  const [paidAt, setPaidAt] = useState(() => defaultPaidAt(monthKey));
  const [feedback, setFeedback] = useState<string | null>(null);

  const apply = (changes: { itemId: string; patch: Parameters<typeof updateMappingItemState>[3] }[]) =>
    changes.forEach((c) => updateMappingItemState(target.natureId, target.mappingId, c.itemId, c.patch));

  const register = () => {
    if (paidAmount <= 0) return;
    apply(registerMappingPayment(scope, monthKey, { paidAt, amount: paidAmount }));
    const left = Math.max(0, Math.round((month.pending - paidAmount) * 100) / 100);
    setFeedback(
      left > 0.005
        ? `${formatBRL(paidAmount)} lançado em ${formatDate(paidAt)}. Ainda faltam ${formatBRL(left)} no mês.`
        : `${formatBRL(paidAmount)} lançado em ${formatDate(paidAt)}. ${target.title} está quitado no mês.`
    );
    setAmount(null);
  };

  return (
    <Modal isOpen onClose={onClose} title={`Lançar pagamento: ${target.title}`} subtitle={`Competência de ${monthLabel(monthKey)}`} maxWidth="460px">
      <div className="mapping-pay">
        <div className="mapping-pay-summary">
          <span>
            Previsto <strong>{formatBRL(month.planned)}</strong>
          </span>
          <span>
            Pago <strong className="text-emerald">{formatBRL(month.paid)}</strong>
          </span>
          <span>
            Falta <strong className="text-amber">{formatBRL(month.pending)}</strong>
          </span>
        </div>

        {feedback && (
          <p className="mapping-pay-feedback">
            <CheckCircle2 size={15} className="text-emerald" /> {feedback}
          </p>
        )}

        <div className="mapping-pay-fields">
          <label>
            <span>Valor pago</span>
            <DecimalInput className="form-input" value={paidAmount} onValueChange={(v) => setAmount(v)} emptyWhenZero aria-label="Valor pago" />
          </label>
          <label>
            <span>Data do pagamento</span>
            <input type="date" className="form-input" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </label>
        </div>

        {month.payments.length > 0 && (
          <div className="mapping-pay-history">
            <span className="mapping-pay-history-title">Pagamentos deste mês</span>
            <ul>
              {month.payments.map((p) => (
                <li key={p.id}>
                  <span>{formatDate(p.paidAt)}</span>
                  <strong>{formatBRL(p.amount)}</strong>
                  <button
                    type="button"
                    className="mapping-pay-undo"
                    title="Desfazer este pagamento"
                    aria-label="Desfazer este pagamento"
                    onClick={() =>
                      confirm({
                        title: 'Desfazer pagamento',
                        message: `O pagamento de ${formatBRL(p.amount)} em ${formatDate(p.paidAt)} volta a ficar em aberto no previsto.`,
                        confirmLabel: 'Desfazer',
                        onConfirm: () => {
                          apply(removeMappingPayment(scope, monthKey, p.id));
                          setFeedback(null);
                        },
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mapping-pay-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {feedback ? 'Fechar' : 'Cancelar'}
          </button>
          <button type="button" className="btn btn-primary" onClick={register} disabled={paidAmount <= 0}>
            <Wallet size={16} />
            <span>Registrar {paidAmount > 0 ? formatBRL(paidAmount) : ''}</span>
          </button>
        </div>
      </div>
      <ConfirmDialog {...dialogProps} />
    </Modal>
  );
};
