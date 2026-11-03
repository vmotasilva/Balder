import React, { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal';
import { DecimalInput } from './DecimalInput';
import { useFinancial } from '../context/FinancialContext';
import { listPaymentInstitutions } from '../utils/paymentInstitutions';
import { INSTALLMENT_CHOICES, type PaymentHow } from '../utils/paymentHow';
import type { Movement } from '../types';
import {
  carryCandidateItems,
  carryInvoiceDifference,
  invoiceDifferenceReasons,
  nextOpenInvoice,
  planCarryWithItems,
  suggestNextInvoiceItems,
  type DifferenceReason,
} from '../utils/invoicePayment';

/** O que está sendo confirmado como pago ou recebido. */
export interface RealizationTarget {
  kind: 'ENTRADA' | 'SAIDA';
  title: string;
  /** Valor previsto: vem preenchido e pode ser corrigido. */
  expectedAmount: number;
  /** Vencimento previsto (YYYY-MM-DD). */
  dueDate: string;
  /** Pagamento: pergunta também como foi pago (dinheiro, débito ou crédito); `how` vem vazio se a pessoa não informar. */
  askHow?: boolean;
  /** Fatura de cartão: se o valor pago difere do registrado, pergunta o motivo (`reason`) para acertar as faturas futuras. */
  askDifferenceReason?: boolean;
  /** Fatura paga a menos: dá para indicar quais itens dela caíram na próxima (com a próxima fatura de referência). */
  carryContext?: { invoice: Movement; next?: Movement };
  onConfirm: (amount: number, date: string, how?: PaymentHow, reason?: DifferenceReason, carryItemIds?: string[]) => void;
  /** Já foi pago por fora (ou não vale mais): tira do em aberto sem lançar pagamento nem mexer no saldo. */
  onDismiss?: () => void;
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

/**
 * Desfazer a confirmação: volta a ficar em aberto, sem valor real nem data de pagamento, e, se o valor foi
 * corrigido ao confirmar, volta ao previsto.
 */
export const reopenedMovementUpdates = (m: Movement): Partial<Movement> => ({
  status: 'PREVISTA',
  paymentDate: undefined,
  actualAmount: undefined,
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
  const { accounts, cards, banks } = useFinancial();
  const askHow = !!target.askHow && !isIncome;
  const [how, setHow] = useState<'CASH' | 'DEBITO' | 'CREDITO' | null>(null);
  const [institution, setInstitution] = useState('');
  const [installments, setInstallments] = useState(1);
  const institutions = listPaymentInstitutions(accounts, cards, banks);
  const bankChoices = how === 'CREDITO' ? institutions.filter((i) => !i.noCredit) : institutions;
  const chosenInstitution = bankChoices.some((i) => i.name === institution) ? institution : bankChoices[0]?.name || '';
  const howResult: PaymentHow | undefined =
    !askHow || !how
      ? undefined
      : how === 'CASH'
      ? { where: 'CASH' }
      : chosenInstitution
      ? { where: 'BANK', institution: chosenInstitution, method: how, installments: how === 'CREDITO' ? installments : 1 }
      : undefined;

  const diff = Math.round((amount - target.expectedAmount) * 100) / 100;
  const futureDate = date > today;
  const reasons = target.askDifferenceReason && Math.abs(diff) >= 0.01 ? invoiceDifferenceReasons(diff) : [];
  const [reasonId, setReasonId] = useState<string | null>(null);
  const reason = reasons.find((r) => r.id === reasonId);
  // Compras do fim do ciclo que caíram na próxima fatura: o sistema sugere os itens pela diferença de valor
  const ctx = target.carryContext;
  const pickItems = !!ctx && reason?.id === 'NEXT_PURCHASES' && diff < 0;
  const candidates = useMemo(() => (ctx ? carryCandidateItems(ctx.invoice) : []), [ctx]);
  const suggestion = useMemo(() => (ctx ? suggestNextInvoiceItems(ctx.invoice, Math.abs(diff)) : { ids: [], exact: false }), [ctx, diff]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const selectedIds = picked ?? suggestion.ids;
  const selectedSum = Math.round(candidates.filter((i) => selectedIds.includes(i.id)).reduce((acc, i) => acc + i.amount, 0) * 100) / 100;
  const [carryConfirmed, setCarryConfirmed] = useState(false);
  const toggleItem = (id: string) => {
    setCarryConfirmed(false);
    setPicked(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };
  const needsCarryConfirm = pickItems && selectedIds.length > 0;
  const nextAfter = ctx?.next ? Math.round((ctx.next.amount + Math.max(Math.abs(diff), selectedSum)) * 100) / 100 : undefined;

  const valid = amount > 0 && !!date && !futureDate && (reasons.length === 0 || !!reason) && (!needsCarryConfirm || carryConfirmed);

  const confirm = () => {
    if (!valid) return;
    target.onConfirm(Math.round(amount * 100) / 100, date, howResult, reason, pickItems ? selectedIds : undefined);
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

        {askHow && (
          <div className="mapping-pay-fields" style={{ display: 'block' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Como você pagou?</span>
            <div className="realization-chips" style={{ marginTop: '6px' }}>
              {([['CASH', '💵 Dinheiro em mãos'], ['DEBITO', '🏦 Débito / Pix'], ['CREDITO', '💳 Crédito']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`realization-chip ${how === key ? 'is-active' : ''}`}
                  onClick={() => setHow(how === key ? null : key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {(how === 'DEBITO' || how === 'CREDITO') && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                <select className="form-input" style={{ flex: 1, minWidth: '140px' }} value={chosenInstitution} onChange={(e) => setInstitution(e.target.value)} aria-label="Banco">
                  {bankChoices.map((i) => (
                    <option key={i.name} value={i.name}>
                      {i.name}
                    </option>
                  ))}
                </select>
                {how === 'CREDITO' && (
                  <select className="form-input" style={{ width: '110px' }} value={installments} onChange={(e) => setInstallments(Number(e.target.value))} aria-label="Parcelas">
                    {INSTALLMENT_CHOICES.map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? 'À vista' : `${n}x`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {how === 'CREDITO' && <p className="mapping-pay-feedback">Entra na fatura do banco; o saldo só muda quando a fatura for paga.</p>}
          </div>
        )}

        {Math.abs(diff) >= 0.01 && amount > 0 && (
          <p className="mapping-pay-feedback">
            {isIncome ? 'Entrou' : 'Saiu'}{' '}
            <strong className={(diff > 0) === isIncome ? 'text-emerald' : 'text-rose'}>
              {formatBRL(Math.abs(diff))} {diff > 0 ? 'a mais' : 'a menos'}
            </strong>{' '}
            que o previsto.
          </p>
        )}
        {reasons.length > 0 && (
          <div className="mapping-pay-fields" style={{ display: 'block' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Por que o valor é diferente da fatura registrada?</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
              {reasons.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`realization-chip ${reasonId === r.id ? 'is-active' : ''}`}
                  style={{ textAlign: 'left', whiteSpace: 'normal' }}
                  onClick={() => setReasonId(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {reason?.carry && (
              <p className="mapping-pay-feedback">
                {formatBRL(Math.abs(diff))} {diff < 0 ? 'passam para' : 'saem d'}a próxima fatura, para as contas baterem.
              </p>
            )}
          </div>
        )}
        {pickItems && candidates.length > 0 && (
          <div className="mapping-pay-fields" style={{ display: 'block' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Quais itens devem constar na próxima fatura?{' '}
              {suggestion.exact && picked === null ? '(sugeridos pela diferença de valor)' : ''}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', maxHeight: '180px', overflowY: 'auto' }}>
              {candidates.map((it) => (
                <label key={it.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' }}>
                  <input type="checkbox" checked={selectedIds.includes(it.id)} onChange={() => toggleItem(it.id)} />
                  <span style={{ flex: 1 }}>
                    {it.description}
                    {it.purchaseDate ? ` · ${formatDate(it.purchaseDate)}` : ''}
                  </span>
                  <strong>{formatBRL(it.amount)}</strong>
                </label>
              ))}
            </div>
            <p className="mapping-pay-feedback">
              Selecionado <strong>{formatBRL(selectedSum)}</strong> de <strong>{formatBRL(Math.abs(diff))}</strong> de diferença
              {Math.abs(selectedSum - Math.abs(diff)) >= 0.01
                ? selectedSum < Math.abs(diff)
                  ? `: ${formatBRL(Math.abs(diff) - selectedSum)} ficam na próxima fatura sem detalhar.`
                  : '.'
                : ': bate certinho.'}
            </p>
            {ctx?.next && nextAfter !== undefined && (
              <p className="mapping-pay-feedback">
                Próxima fatura (vence {formatDate(ctx.next.dueDate)}): {formatBRL(ctx.next.amount)} → <strong>{formatBRL(nextAfter)}</strong> com esses itens.
              </p>
            )}
            {needsCarryConfirm && (
              <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', marginTop: '8px' }}>
                <input type="checkbox" checked={carryConfirmed} onChange={(e) => setCarryConfirmed(e.target.checked)} />
                <span>
                  Confirmo que {selectedIds.length} {selectedIds.length === 1 ? 'item' : 'itens'} ({formatBRL(selectedSum)}) saem desta fatura e passam para a fatura seguinte.
                </span>
              </label>
            )}
          </div>
        )}
        {futureDate && <p className="mapping-pay-feedback text-rose">A data não pode ser depois de hoje.</p>}

        {target.onDismiss && (
          <p className="mapping-pay-feedback">
            Já estava pago e o saldo já reflete isso?{' '}
            <button
              type="button"
              className="realization-chip"
              onClick={() => {
                target.onDismiss?.();
                onClose();
              }}
            >
              Desconsiderar, já foi pago
            </button>
          </p>
        )}

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

/** Pedido de confirmação do pagamento de uma fatura: se o valor pago difere, pergunta o motivo e acerta a próxima fatura. */
export const invoiceRealizationTarget = (
  invoice: Movement,
  movements: Movement[],
  ops: { addMovement: (m: Omit<Movement, 'id'>) => void; updateMovement: (id: string, u: Partial<Movement>) => void },
  title: string = invoice.title
): RealizationTarget => ({
  kind: 'SAIDA',
  title,
  expectedAmount: invoice.amount,
  dueDate: invoice.dueDate,
  askDifferenceReason: true,
  carryContext: { invoice, next: nextOpenInvoice(invoice, movements) },
  onConfirm: (amount, date, _how, reason, carryItemIds) => {
    if (reason?.id === 'NEXT_PURCHASES' && carryItemIds && carryItemIds.length > 0) {
      const plan = planCarryWithItems(invoice, amount, movements, carryItemIds);
      ops.updateMovement(invoice.id, { ...realizedMovementUpdates(invoice, amount, date), ...plan.invoiceUpdates });
      if (plan.nextUpdate) ops.updateMovement(plan.nextUpdate.id, plan.nextUpdate.updates);
      if (plan.nextAdd) ops.addMovement(plan.nextAdd);
      return;
    }
    ops.updateMovement(invoice.id, realizedMovementUpdates(invoice, amount, date));
    if (reason?.carry) carryInvoiceDifference(invoice, amount, movements, ops);
  },
});
