import type { Movement } from '../types';
import { monthDateKeepingDay } from './cardPurchase';
import { sameBank } from './paymentInstitutions';

const round = (v: number) => Math.round(v * 100) / 100;

/** Motivo da diferença entre o valor pago e o registrado da fatura; `carry` = o que sobrou/faltou vai para a próxima fatura. */
export interface DifferenceReason {
  id: string;
  label: string;
  carry: boolean;
}

/** `diff` = valor pago − valor registrado. Menor: a fatura fechou abaixo do previsto. */
export const invoiceDifferenceReasons = (diff: number): DifferenceReason[] =>
  diff < 0
    ? [
        { id: 'NEXT_PURCHASES', label: 'Compras que registrei aqui caíram na próxima fatura (depois do fechamento)', carry: true },
        { id: 'PARTIAL', label: 'Paguei parte: o resto fica para a próxima fatura', carry: true },
        { id: 'DISCOUNT', label: 'Desconto, estorno ou cashback', carry: false },
        { id: 'WRONG', label: 'Tinha registrado a mais (erro de lançamento)', carry: false },
      ]
    : [
        { id: 'MISSING', label: 'Compras que faltavam registrar nesta fatura', carry: false },
        { id: 'INTEREST', label: 'Juros, multa ou encargos', carry: false },
        { id: 'PREPAID', label: 'Incluí compras que pertencem à próxima fatura', carry: true },
      ];

/**
 * Leva a diferença de uma fatura paga para a próxima do mesmo banco, para as contas baterem:
 * pagou a menos → a próxima sobe (entra como "sem detalhar"); pagou a mais por compras da próxima → ela desce.
 * Sem próxima fatura e com valor a somar, cria uma no mês seguinte.
 */
export function carryInvoiceDifference(
  invoice: Movement,
  paid: number,
  movements: Movement[],
  ops: { addMovement: (m: Omit<Movement, 'id'>) => void; updateMovement: (id: string, u: Partial<Movement>) => void }
): void {
  const shift = round(invoice.amount - paid); // > 0: a próxima recebe mais
  if (Math.abs(shift) < 0.01) return;
  const bank = invoice.bank || invoice.title;
  const next = movements
    .filter((m) => m.type === 'CARTAO' && m.status === 'PREVISTA' && m.id !== invoice.id && sameBank(m.bank || m.title, bank) && m.dueDate > invoice.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (next) {
    const free = next.unanalyzedAmount ?? 0;
    // Reduzir só tira do que está sem detalhar: itens já detalhados não são mexidos
    const delta = shift > 0 ? shift : -Math.min(-shift, free);
    if (Math.abs(delta) < 0.01) return;
    const unanalyzed = round(free + delta);
    ops.updateMovement(next.id, { amount: round(next.amount + delta), unanalyzedAmount: unanalyzed, category: unanalyzed > 0.01 ? 'Não Analisada' : 'Fatura de Cartão' });
    return;
  }
  if (shift <= 0) return;
  const [y, mo, d] = invoice.dueDate.split('-').map((n) => parseInt(n, 10));
  const dueDate = monthDateKeepingDay(y, mo, d);
  const monthName = new Date(`${dueDate}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long' });
  ops.addMovement({
    title: `Fatura ${invoice.bank || invoice.title} (${monthName.charAt(0).toUpperCase()}${monthName.slice(1)})`,
    type: 'CARTAO',
    amount: shift,
    dueDate,
    bank: invoice.bank,
    status: 'PREVISTA',
    category: 'Não Analisada',
    invoiceBreakdown: [],
    unanalyzedAmount: shift,
  });
}
