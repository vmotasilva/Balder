import { useFinancial } from '../context/FinancialContext';
import { realizedMovementUpdates } from '../components/RealizationConfirmModal';
import type { Movement } from '../types';
import type { PaymentHow } from '../utils/paymentHow';
import { CASH_IN_HAND } from '../utils/cashInHand';
import { listPaymentInstitutions } from '../utils/paymentInstitutions';
import { addCardPurchaseToInvoices, firstInvoiceDueDate } from '../utils/cardPurchase';
import { installmentSchedule } from '../utils/forsetiAssistant';

export interface SettleParams {
  how: PaymentHow;
  title: string;
  amount: number;
  date: string;
  dueDate: string;
  category: string;
  /** Liga o gasto a um item da natureza (o item passa a pago). */
  link?: { natureId: string; mappingId: string; itemId: string };
  /** Liga o gasto a uma natureza/mapeamento, sem item específico. */
  nature?: { natureId: string; mappingId?: string };
  /** Conta prevista que o pagamento quita. */
  existing?: Movement;
  /** Observação gravada no lançamento. */
  notes?: string;
}

/**
 * Registra um pagamento conforme "como pagou" (mesmas escolhas da Forseti): dinheiro em mãos e débito saem do saldo
 * na data do pagamento (banco gravado no lançamento); crédito entra na fatura do banco como item (o saldo só muda
 * quando a fatura for paga).
 */
export function usePaymentSettle() {
  const { movements, natures, accounts, cards, banks, addMovement, updateMovement, markMappingItemsFulfilled } = useFinancial();

  return (params: SettleParams) => {
    const { how, title, amount, date, dueDate, category, link, nature: natureRef, existing, notes } = params;
    const natureFields = link
      ? { natureId: link.natureId, mappingId: link.mappingId, mappingItemId: link.itemId }
      : natureRef
      ? { natureId: natureRef.natureId, mappingId: natureRef.mappingId }
      : existing?.natureId
      ? { natureId: existing.natureId, mappingId: existing.mappingId, mappingItemId: existing.mappingItemId }
      : {};
    const institutions = listPaymentInstitutions(accounts, cards, banks);
    if (how.where === 'BANK' && how.method === 'CREDITO') {
      const terms = institutions.find((i) => i.name === how.institution)?.terms;
      const firstDue = firstInvoiceDueDate(date, terms?.closingDay, terms?.dueDay);
      const nature = natureFields.natureId ? natures.find((n) => n.id === natureFields.natureId) : undefined;
      addCardPurchaseToInvoices(
        {
          institution: how.institution,
          title,
          total: amount,
          natureId: natureFields.natureId,
          natureName: nature?.name,
          mappingId: natureFields.mappingId,
          mappingItemId: natureFields.mappingItemId,
          purchaseDate: date,
          notes: 'Pago no crédito ao confirmar o pagamento.',
        },
        how.installments > 1 ? installmentSchedule(amount, how.installments, firstDue, terms?.dueDay) : [{ dueDate: firstDue, amount }],
        movements,
        { addMovement, updateMovement }
      );
      // A conta prevista foi para a fatura: sai da lista de contas em aberto
      if (existing) updateMovement(existing.id, { status: 'CANCELADA', notes: `Pago no crédito (${how.institution}).` });
    } else {
      const bank =
        how.where === 'CASH' ? CASH_IN_HAND : institutions.find((i) => i.name === how.institution)?.account?.name ?? how.institution;
      if (existing) {
        updateMovement(existing.id, { ...realizedMovementUpdates(existing, amount, date), bank });
      } else {
        addMovement({ title, type: 'PAGAR', amount, dueDate, bank, status: 'REALIZADA', category, paymentDate: date, actualAmount: amount, notes, ...natureFields });
      }
    }
    // O item da natureza passa a pago com o valor e a data informados
    if (link) {
      markMappingItemsFulfilled([{ ...link, realizedValue: amount, monthKey: dueDate.slice(0, 7), paidAt: date }]);
    }
  };
}
