import type { InvoiceNatureItemBreakdown, Movement } from '../types';

/** Vencimento (AAAA-MM-DD) da fatura que recebe uma compra feita em `purchaseDate`. */
export const firstInvoiceDueDate = (purchaseDate: string, closingDay?: number, dueDay?: number): string => {
  const [y, m, d] = purchaseDate.split('-').map((n) => parseInt(n, 10));
  const due = dueDay || 10;
  // Sem cartão cadastrado, assume fechamento 7 dias antes do vencimento
  const closing = closingDay || Math.max(1, due - 7);
  // Compra no dia do fechamento ou depois cai na fatura seguinte
  const closeMonthOffset = d >= closing ? 1 : 0;
  // Se o vencimento é depois do fechamento, vence no mesmo mês do fechamento; senão, no seguinte
  const dueMonthOffset = closeMonthOffset + (due > closing ? 0 : 1);
  return monthDateKeepingDay(y, m - 1 + dueMonthOffset, due);
};

/** Data do mês indicado (índice pode extrapolar), limitando o dia ao fim do mês. */
export const monthDateKeepingDay = (year: number, monthIndex: number, day: number): string => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const date = new Date(year, monthIndex, Math.min(day, lastDay));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Vencimentos das N faturas consecutivas a partir da primeira. */
export const invoiceDueDates = (firstDue: string, count: number): string[] => {
  const [y, m, d] = firstDue.split('-').map((n) => parseInt(n, 10));
  return Array.from({ length: count }, (_, i) => monthDateKeepingDay(y, m - 1 + i, d));
};

export interface CardPurchaseInfo {
  institution: string;
  title: string;
  total: number;
  natureId?: string;
  natureName?: string;
  mappingId?: string;
  mappingItemId?: string;
  notes?: string;
}

/**
 * Compra no cartão: cada parcela entra como item da fatura do banco (a do mês do vencimento).
 * Se a fatura já existe, o item usa o que ela ainda tem sem detalhar e só o excedente aumenta o total;
 * senão, a fatura é criada já com o item. Nunca vira um lançamento solto.
 */
export function addCardPurchaseToInvoices(
  purchase: CardPurchaseInfo,
  parts: { dueDate: string; amount: number }[],
  movements: Movement[],
  ops: { addMovement: (m: Omit<Movement, 'id'>) => void; updateMovement: (id: string, u: Partial<Movement>) => void }
): void {
  const n = parts.length;
  const groupId = `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const round = (v: number) => Math.round(v * 100) / 100;
  parts.forEach(({ dueDate, amount }, idx) => {
    const item: InvoiceNatureItemBreakdown = {
      id: `${groupId}_${idx + 1}`,
      natureId: purchase.natureId || 'OUTROS',
      natureName: purchase.natureName || 'Outros',
      mappingId: purchase.mappingId,
      mappingItemId: purchase.mappingItemId,
      description: n > 1 ? `${purchase.title} (${idx + 1}/${n})` : purchase.title,
      amount,
      isAnalyzed: true,
      installments: n,
      currentInstallment: idx + 1,
      finalAmount: purchase.total,
    };
    const target = movements.find(
      (inv) =>
        inv.type === 'CARTAO' &&
        inv.status === 'PREVISTA' &&
        (inv.bank || '').trim().toLowerCase() === purchase.institution.trim().toLowerCase() &&
        inv.dueDate.startsWith(dueDate.substring(0, 7))
    );
    if (target) {
      const free = target.unanalyzedAmount ?? 0;
      ops.updateMovement(target.id, {
        amount: round(target.amount + Math.max(0, round(amount - free))),
        invoiceBreakdown: [...(target.invoiceBreakdown || []), item],
        unanalyzedAmount: Math.max(0, round(free - amount)),
      });
    } else {
      const monthName = new Date(`${dueDate}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long' });
      ops.addMovement({
        title: `Fatura ${purchase.institution} (${monthName.charAt(0).toUpperCase()}${monthName.slice(1)})`,
        type: 'CARTAO',
        amount,
        dueDate,
        bank: purchase.institution,
        status: 'PREVISTA',
        category: 'Fatura de Cartão',
        notes: purchase.notes,
        invoiceBreakdown: [item],
        unanalyzedAmount: 0,
      });
    }
  });
}
