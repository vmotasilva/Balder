import type { InvoiceNatureItemBreakdown, Movement } from '../types';
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

const cents = (v: number) => Math.round(v * 100);

/** Itens da fatura que podem ter caído na próxima: com valor, mais recentes primeiro (compras perto do fechamento). */
export const carryCandidateItems = (invoice: Movement): InvoiceNatureItemBreakdown[] =>
  [...(invoice.invoiceBreakdown || [])]
    .filter((i) => i.amount > 0)
    .sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));

/**
 * Sugere quais itens foram para a próxima fatura: procura, entre os mais recentes, o conjunto que soma exatamente a
 * diferença (`diff` = quanto a fatura paga ficou abaixo do registrado). Sem soma exata, leva os mais recentes
 * enquanto couberem na diferença. Devolve os ids e se a soma bate exatamente.
 */
export function suggestNextInvoiceItems(invoice: Movement, diff: number): { ids: string[]; exact: boolean } {
  const target = cents(diff);
  if (target <= 0) return { ids: [], exact: false };
  const items = carryCandidateItems(invoice).slice(0, 24);
  const values = items.map((i) => cents(i.amount));
  let nodes = 0;
  const pick: number[] = [];
  const dfs = (idx: number, left: number): boolean => {
    if (left === 0) return true;
    if (idx >= items.length || ++nodes > 200000) return false;
    if (values[idx] <= left) {
      pick.push(idx);
      if (dfs(idx + 1, left - values[idx])) return true;
      pick.pop();
    }
    return dfs(idx + 1, left);
  };
  if (dfs(0, target)) return { ids: pick.map((i) => items[i].id), exact: true };
  const ids: string[] = [];
  let left = target;
  items.forEach((it, i) => {
    if (values[i] <= left) {
      ids.push(it.id);
      left -= values[i];
    }
  });
  return { ids, exact: false };
}

/** Próxima fatura prevista do mesmo banco (a que recebe o que passa para frente). */
export const nextOpenInvoice = (invoice: Movement, movements: Movement[]): Movement | undefined => {
  const bank = (invoice.bank || invoice.title).trim().toLowerCase();
  return movements
    .filter((m) => m.type === 'CARTAO' && m.status === 'PREVISTA' && m.id !== invoice.id && (m.bank || m.title).trim().toLowerCase() === bank && m.dueDate > invoice.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
};

export interface CarryItemsPlan {
  /** Campos a aplicar na fatura paga (itens que ficaram e o que sobrou sem detalhar). */
  invoiceUpdates: Partial<Movement>;
  nextUpdate?: { id: string; updates: Partial<Movement> };
  nextAdd?: Omit<Movement, 'id'>;
}

/**
 * Passa itens escolhidos da fatura paga para a próxima do mesmo banco. A próxima sobe pela diferença paga a menos
 * (no mínimo a soma dos itens): os itens entram detalhados e o que sobra da diferença fica "sem detalhar".
 */
export function planCarryWithItems(invoice: Movement, paid: number, movements: Movement[], itemIds: string[]): CarryItemsPlan {
  const moved = (invoice.invoiceBreakdown || []).filter((i) => itemIds.includes(i.id));
  const kept = (invoice.invoiceBreakdown || []).filter((i) => !itemIds.includes(i.id));
  const movedSum = round(moved.reduce((acc, i) => acc + i.amount, 0));
  const delta = Math.max(round(invoice.amount - paid), movedSum);
  const residual = round(delta - movedSum);
  const keptSum = kept.reduce((acc, i) => acc + i.amount, 0);
  const invoiceUpdates: Partial<Movement> = {
    invoiceBreakdown: kept,
    unanalyzedAmount: Math.max(0, round(paid - keptSum)),
  };
  const next = nextOpenInvoice(invoice, movements);
  if (next) {
    const free = round((next.unanalyzedAmount ?? 0) + residual);
    return {
      invoiceUpdates,
      nextUpdate: {
        id: next.id,
        updates: {
          amount: round(next.amount + delta),
          invoiceBreakdown: [...(next.invoiceBreakdown || []), ...moved],
          unanalyzedAmount: free,
          category: free > 0.01 ? 'Não Analisada' : 'Fatura de Cartão',
        },
      },
    };
  }
  const [y, mo, d] = invoice.dueDate.split('-').map((n) => parseInt(n, 10));
  const dueDate = monthDateKeepingDay(y, mo, d);
  const monthName = new Date(`${dueDate}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long' });
  return {
    invoiceUpdates,
    nextAdd: {
      title: `Fatura ${invoice.bank || invoice.title} (${monthName.charAt(0).toUpperCase()}${monthName.slice(1)})`,
      type: 'CARTAO',
      amount: delta,
      dueDate,
      bank: invoice.bank,
      status: 'PREVISTA',
      category: residual > 0.01 ? 'Não Analisada' : 'Fatura de Cartão',
      invoiceBreakdown: moved,
      unanalyzedAmount: residual,
    },
  };
}
