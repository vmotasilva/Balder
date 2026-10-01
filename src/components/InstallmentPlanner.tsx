import React, { useMemo, useState } from 'react';
import { Split, Undo2 } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { installmentSchedule, nextCardDueDate } from '../utils/forsetiAssistant';
import type { Movement } from '../types';

interface InstallmentPlannerProps {
  movement: Movement;
  /** Valor atual do campo "valor real" do pop-up (a compra inteira, antes de parcelar) */
  amount: number;
  onDone: () => void;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ddmmyyyy = (iso: string) => iso.split('-').reverse().join('/');
const stripInstallmentTitle = (t: string) => t.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
const stripInstallmentNotes = (n?: string) => {
  const cleaned = (n || '').replace(/\s*•?\s*Parcela \d+\/\d+ • Total: .*$/, '').trim();
  return cleaned || undefined;
};

/** Parcelar uma compra (já associando cada parcela à fatura certa do cartão) ou desfazer um parcelamento. */
export const InstallmentPlanner: React.FC<InstallmentPlannerProps> = ({ movement, amount, onDone }) => {
  const { movements, cards, accounts, updateMovement, addMultipleMovements, deleteMovement } = useFinancial();
  const { confirm, dialogProps } = useConfirmDialog();

  const groupId = movement.installmentGroupId;
  const isInstallment = (movement.installmentsTotal || 0) >= 2;
  const siblings = useMemo(
    () =>
      isInstallment && groupId
        ? movements
            .filter((m) => m.installmentGroupId === groupId)
            .sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0) || a.dueDate.localeCompare(b.dueDate))
        : [],
    [movements, groupId, isInstallment]
  );

  // ── Desfazer ──
  const undo = () => {
    const list = siblings.length > 0 ? siblings : [movement];
    const keeper = list[0];
    const total = Math.round(list.reduce((acc, m) => acc + (m.status === 'REALIZADA' ? m.actualAmount ?? m.amount : m.amount), 0) * 100) / 100;
    const allPaid = list.every((m) => m.status === 'REALIZADA');
    const paidCount = list.filter((m) => m.status === 'REALIZADA').length;
    confirm({
      title: 'Desfazer parcelamento',
      message:
        list.length > 1
          ? `As ${list.length} parcelas viram uma única compra de ${brl(total)}, no vencimento de ${ddmmyyyy(keeper.dueDate)}.${
              paidCount > 0 && !allPaid ? ` ${paidCount} parcela(s) já paga(s): a compra volta como prevista até você confirmá-la.` : ''
            } Isso muda o saldo e as projeções.`
          : 'Remove a marcação de parcela desta compra.',
      confirmLabel: 'Desfazer parcelamento',
      variant: 'warning',
      onConfirm: () => {
        list.slice(1).forEach((m) => deleteMovement(m.id));
        updateMovement(keeper.id, {
          title: stripInstallmentTitle(keeper.title),
          amount: total,
          actualAmount: allPaid ? total : undefined,
          originalAmount: undefined,
          status: allPaid ? 'REALIZADA' : 'PREVISTA',
          paymentDate: allPaid ? keeper.paymentDate : undefined,
          notes: stripInstallmentNotes(keeper.notes),
          installmentNumber: undefined,
          installmentsTotal: undefined,
          installmentGroupId: undefined,
        });
        onDone();
      },
    });
  };

  // ── Parcelar ──
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(3);
  const [valueIsTotal, setValueIsTotal] = useState(true);
  const [source, setSource] = useState<string>(() => {
    const card = cards.find((c) => c.name === movement.bank || c.bank === movement.bank);
    return card ? `card:${card.id}` : `bank:${movement.bank}`;
  });

  const sourceCard = source.startsWith('card:') ? cards.find((c) => `card:${c.id}` === source) : undefined;
  const sourceBank = source.startsWith('bank:') ? source.slice(5) : sourceCard?.name || movement.bank;
  const total = valueIsTotal ? amount : Math.round(amount * count * 100) / 100;

  const purchaseDate = movement.paymentDate || movement.dueDate;
  const schedule = useMemo(() => {
    if (!(amount > 0) || count < 2) return [];
    if (sourceCard) {
      // Já está numa fatura deste cartão: a 1ª parcela continua nela. Vindo de outra forma de pagamento, cai na fatura aberta na data da compra.
      const alreadyThere = movement.type === 'CARTAO' && (movement.bank === sourceCard.name || movement.bank === sourceCard.bank);
      const first = alreadyThere ? movement.dueDate : nextCardDueDate(sourceCard.closingDay, sourceCard.dueDay, new Date(purchaseDate + 'T12:00:00'));
      return installmentSchedule(total, count, first, sourceCard.dueDay);
    }
    return installmentSchedule(total, count, movement.dueDate);
  }, [amount, count, total, sourceCard, movement.type, movement.bank, movement.dueDate, purchaseDate]);

  const apply = () => {
    if (schedule.length < 2) return;
    const base = stripInstallmentTitle(movement.title);
    const newGroupId = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const type = sourceCard ? 'CARTAO' : 'PAGAR';
    const firstStatus = sourceCard ? 'PREVISTA' : movement.status;
    const noteFor = (idx: number) =>
      `${stripInstallmentNotes(movement.notes) ? `${stripInstallmentNotes(movement.notes)} • ` : ''}Parcela ${idx + 1}/${count} • Total: ${brl(total)}`;

    updateMovement(movement.id, {
      title: `${base} (1/${count})`,
      type,
      bank: sourceBank,
      amount: schedule[0].amount,
      actualAmount: firstStatus === 'REALIZADA' ? schedule[0].amount : undefined,
      originalAmount: undefined,
      dueDate: schedule[0].dueDate,
      status: firstStatus,
      paymentDate: firstStatus === 'REALIZADA' ? movement.paymentDate : undefined,
      notes: noteFor(0),
      installmentNumber: 1,
      installmentsTotal: count,
      installmentGroupId: newGroupId,
    });
    addMultipleMovements(
      schedule.slice(1).map((p, i) => ({
        title: `${base} (${i + 2}/${count})`,
        type,
        amount: p.amount,
        dueDate: p.dueDate,
        bank: sourceBank,
        status: 'PREVISTA' as const,
        category: movement.category,
        natureId: movement.natureId,
        notes: noteFor(i + 1),
        installmentNumber: i + 2,
        installmentsTotal: count,
        installmentGroupId: newGroupId,
      }))
    );
    onDone();
  };

  const accountNames = accounts.filter((a) => a.type === 'CORRENTE' || a.type === 'CARTEIRA' || a.type === 'OUTRO').map((a) => a.name);
  if (movement.bank && !sourceCard && !accountNames.includes(movement.bank)) accountNames.unshift(movement.bank);

  return (
    <div className="installment-planner">
      {isInstallment ? (
        <>
          <div className="installment-planner-head">
            <Split size={16} className="text-cyan" />
            <strong>
              Parcela {movement.installmentNumber || '?'} de {movement.installmentsTotal}
            </strong>
            <button type="button" className="btn btn-outline btn-sm" onClick={undo}>
              <Undo2 size={14} />
              <span>Desfazer parcelamento</span>
            </button>
          </div>
          {siblings.length > 1 && (
            <ul className="installment-planner-list">
              {siblings.map((m) => (
                <li key={m.id} className={m.id === movement.id ? 'is-current' : ''}>
                  <span>{m.installmentNumber}/{m.installmentsTotal}</span>
                  <span>{ddmmyyyy(m.dueDate)}</span>
                  <span>{m.bank}</span>
                  <span>{m.status === 'REALIZADA' ? 'Paga' : 'Prevista'}</span>
                  <strong>{brl(m.status === 'REALIZADA' ? m.actualAmount ?? m.amount : m.amount)}</strong>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : !open ? (
        <div className="installment-planner-head">
          <Split size={16} className="text-cyan" />
          <strong>Compra à vista</strong>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>
            <span>Parcelar esta compra</span>
          </button>
        </div>
      ) : (
        <div className="installment-planner-form">
          <div className="installment-planner-head">
            <Split size={16} className="text-cyan" />
            <strong>Parcelar esta compra</strong>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
          <div className="installment-planner-fields">
            <label>
              <span>Parcelas</span>
              <select className="form-select" value={count} onChange={(e) => setCount(parseInt(e.target.value, 10))}>
                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 24, 36, 48].map((n) => (
                  <option key={n} value={n}>{n}x</option>
                ))}
              </select>
            </label>
            <label>
              <span>O valor informado é</span>
              <select className="form-select" value={valueIsTotal ? 'TOTAL' : 'PARCELA'} onChange={(e) => setValueIsTotal(e.target.value === 'TOTAL')}>
                <option value="TOTAL">O total da compra</option>
                <option value="PARCELA">O valor de cada parcela</option>
              </select>
            </label>
            <label>
              <span>Pago com</span>
              <select className="form-select" value={source} onChange={(e) => setSource(e.target.value)}>
                {cards.map((c) => (
                  <option key={c.id} value={`card:${c.id}`}>💳 {c.name} (fecha dia {c.closingDay})</option>
                ))}
                {accountNames.map((n) => (
                  <option key={n} value={`bank:${n}`}>🏦 {n}</option>
                ))}
              </select>
            </label>
          </div>

          {amount > 0 ? (
            <>
              <p className="installment-planner-hint">
                {count}x de {brl(schedule[0]?.amount || 0)} · total {brl(total)}
                {sourceCard
                  ? ' · cada parcela entra em uma fatura do cartão e o saldo só muda quando a fatura for paga.'
                  : ' · a 1ª fica como está e as outras vencem todo mês no mesmo dia.'}
              </p>
              <ul className="installment-planner-list">
                {schedule.map((p, i) => (
                  <li key={i}>
                    <span>{i + 1}/{count}</span>
                    <span>{sourceCard ? 'fatura de ' : ''}{ddmmyyyy(p.dueDate)}</span>
                    <strong>{brl(p.amount)}</strong>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn btn-primary btn-sm" onClick={apply}>
                Aplicar parcelamento
              </button>
            </>
          ) : (
            <p className="installment-planner-hint">Informe o valor da compra acima para ver as parcelas.</p>
          )}
        </div>
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};
