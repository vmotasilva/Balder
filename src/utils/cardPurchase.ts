import type { InvoiceNatureItemBreakdown, Movement } from '../types';

/** Hoje no formato AAAA-MM-DD (horário local). */
export const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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

/**
 * Data em que o item da fatura gerou despesa: a data da compra, quando conhecida e à vista; parcelas e itens
 * sem data seguem a competência da fatura (pagamento ou vencimento).
 */
export const invoiceItemCompetenceDate = (invoice: Movement, item: InvoiceNatureItemBreakdown): string => {
  if (item.purchaseDate && (item.installments ?? 1) < 2) return item.purchaseDate;
  return invoice.status === 'REALIZADA' && invoice.paymentDate ? invoice.paymentDate : invoice.dueDate;
};

/**
 * Atualização da fatura ao abater IOF estornado de um item: `refund` vira o estorno total do item (limitado ao que
 * ele ainda vale) e item e fatura diminuem pela diferença. Fatura já paga não muda de valor; a diferença fica em
 * "Não Analisada". Devolve null quando não há mudança.
 */
/** Itens classificados em "Outros" não têm IOF a abater (a menos que já tenham um abate registrado, para poder desfazê-lo). */
export const canRefundIof = (item: InvoiceNatureItemBreakdown): boolean =>
  !!item.iofRefund || (item.natureId || '').toUpperCase() !== 'OUTROS';

export interface InvoiceItemEdit {
  description: string;
  /** id da natureza, 'OUTROS' ou vazio (sem natureza) */
  natureId: string;
  natureName: string;
  mappingId?: string;
  mappingItemId?: string;
  /** Data da compra (AAAA-MM-DD); omitida, não muda. */
  purchaseDate?: string;
  /** Valor do item nesta fatura; omitido, não muda. Fatura em aberto sobe/desce pela diferença. */
  amount?: number;
  /** Valor final da compra (parcelada); omitido, não muda. */
  finalAmount?: number;
}

/**
 * Edita um item da fatura: nome, natureza/mapeamento, data da compra e valores.
 * Em compra parcelada o sufixo "(n/total)" da descrição é mantido. Mudar o valor do item muda o total da fatura em
 * aberto pela diferença; fatura já paga não muda de valor e a diferença fica em "Não Analisada".
 */
export const invoiceItemEditUpdates = (invoice: Movement, itemId: string, edit: InvoiceItemEdit): Partial<Movement> | null => {
  const breakdown = invoice.invoiceBreakdown || [];
  const target = breakdown.find((i) => i.id === itemId);
  if (!target) return null;
  const round = (v: number) => Math.round(v * 100) / 100;
  const suffix = (target.description.match(/\s*\(\d+\/\d+\)$/) || [''])[0];
  const clean = edit.description.trim().replace(/\s*\(\d+\/\d+\)$/, '');
  const description = (clean || target.description.replace(/\s*\(\d+\/\d+\)$/, '')) + suffix;
  const isOthers = edit.natureId === 'OUTROS';
  const updated = breakdown.map((i) =>
    i.id === itemId
      ? {
          ...i,
          description,
          natureId: edit.natureId && !isOthers ? edit.natureId : undefined,
          natureName: isOthers ? 'Outros' : edit.natureId ? edit.natureName : 'Não Analisada',
          mappingId: edit.natureId && !isOthers ? edit.mappingId : undefined,
          mappingItemId: edit.natureId && !isOthers ? edit.mappingItemId : undefined,
          isAnalyzed: !!edit.natureId,
          purchaseDate: edit.purchaseDate || i.purchaseDate,
          amount: edit.amount !== undefined ? round(edit.amount) : i.amount,
          finalAmount: edit.finalAmount !== undefined ? round(edit.finalAmount) : i.finalAmount,
        }
      : i
  );
  const delta = edit.amount !== undefined ? round(edit.amount - target.amount) : 0;
  if (delta === 0) return { invoiceBreakdown: updated };
  const amount = invoice.status === 'REALIZADA' ? invoice.amount : Math.max(0, round(invoice.amount + delta));
  const unanalyzed = Math.max(0, round(amount - updated.reduce((acc, i) => acc + i.amount, 0)));
  return {
    amount,
    invoiceBreakdown: updated,
    unanalyzedAmount: unanalyzed,
    category: unanalyzed > 0.01 ? 'Não Analisada' : 'Fatura de Cartão',
  };
};

export const iofRefundUpdates = (invoice: Movement, itemId: string, refund: number): Partial<Movement> | null => {
  const breakdown = invoice.invoiceBreakdown || [];
  const target = breakdown.find((i) => i.id === itemId);
  if (!target || !canRefundIof(target)) return null;
  const round = (v: number) => Math.round(v * 100) / 100;
  const previous = target.iofRefund || 0;
  const next = Math.min(Math.max(0, round(refund)), round(target.amount + previous));
  const delta = round(next - previous);
  if (delta === 0) return null;
  const updated = breakdown.map((i) =>
    i.id === itemId ? { ...i, amount: round(i.amount - delta), iofRefund: next > 0 ? next : undefined } : i
  );
  const allocated = updated.reduce((acc, i) => acc + i.amount, 0);
  const amount = invoice.status === 'REALIZADA' ? invoice.amount : Math.max(0, round(invoice.amount - delta));
  const unanalyzed = Math.max(0, round(amount - allocated));
  return {
    amount,
    invoiceBreakdown: updated,
    unanalyzedAmount: unanalyzed,
    category: unanalyzed > 0.01 ? 'Não Analisada' : 'Fatura de Cartão',
  };
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
  purchaseDate?: string; // YYYY-MM-DD; padrão: hoje
}

/**
 * Compra no cartão: cada parcela entra como item da fatura do banco (a do mês do vencimento).
 * Se a fatura já existe, o item usa o que ela ainda tem sem detalhar e só o excedente aumenta o total;
 * senão, a fatura é criada já com o item. Nunca vira um lançamento solto.
 * Devolve, por parcela, o item criado e quanto o total da fatura subiu (para poder desfazer).
 */
export function addCardPurchaseToInvoices(
  purchase: CardPurchaseInfo,
  parts: { dueDate: string; amount: number }[],
  movements: Movement[],
  ops: { addMovement: (m: Omit<Movement, 'id'>) => void; updateMovement: (id: string, u: Partial<Movement>) => void }
): { itemId: string; grow: number }[] {
  const n = parts.length;
  const groupId = `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const round = (v: number) => Math.round(v * 100) / 100;
  return parts.map(({ dueDate, amount }, idx) => {
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
      purchaseDate: purchase.purchaseDate || todayIso(),
    };
    const target = movements.find(
      (inv) =>
        inv.type === 'CARTAO' &&
        inv.status === 'PREVISTA' &&
        (inv.bank || '').trim().toLowerCase() === purchase.institution.trim().toLowerCase() &&
        inv.dueDate.startsWith(dueDate.substring(0, 7))
    );
    let grow = amount;
    if (target) {
      const free = target.unanalyzedAmount ?? 0;
      grow = Math.max(0, round(amount - free));
      ops.updateMovement(target.id, {
        amount: round(target.amount + grow),
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
    return { itemId: item.id, grow };
  });
}

/**
 * O que muda na fatura quando os itens de uma compra saem dela (desfazer): o total volta ao que era antes
 * (menos o que subiu na entrada) e o que sobra sem detalhar é recalculado. Sem itens e sem valor, a fatura some.
 */
export function invoiceAfterRemovingItems(invoice: Movement, itemIds: string[], grow: number): Partial<Movement> | 'DELETE' {
  const round = (v: number) => Math.round(v * 100) / 100;
  const breakdown = (invoice.invoiceBreakdown || []).filter((i) => !itemIds.includes(i.id));
  const amount = Math.max(0, round(invoice.amount - grow));
  if (breakdown.length === 0 && amount <= 0.01) return 'DELETE';
  const unanalyzed = Math.max(0, round(amount - breakdown.reduce((acc, i) => acc + i.amount, 0)));
  return {
    amount,
    invoiceBreakdown: breakdown,
    unanalyzedAmount: unanalyzed,
    category: unanalyzed > 0.01 ? 'Não Analisada' : 'Fatura de Cartão',
  };
}

const roundMoney = (v: number) => Math.round(v * 100) / 100;
const stripInstallmentSuffix = (text: string) => text.replace(/\s*\(\d+\/\d+\)$/, '');

export interface PurchasePart {
  invoice: Movement;
  item: InvoiceNatureItemBreakdown;
}

/**
 * Todas as parcelas de uma compra no cartão (a do item informado e as das outras faturas). A compra criada pelo
 * Balder leva o mesmo prefixo nos ids das parcelas; sem ele, parcelas do mesmo banco com mesma descrição, mesmo
 * número de parcelas e mesmo valor final são tratadas como a mesma compra.
 */
export function findPurchaseParts(invoices: Movement[], invoiceId: string, itemId: string): PurchasePart[] {
  const cards = invoices.filter((m) => m.type === 'CARTAO');
  const invoice = cards.find((m) => m.id === invoiceId);
  const item = invoice?.invoiceBreakdown?.find((i) => i.id === itemId);
  if (!invoice || !item) return [];
  const all = cards.flatMap((inv) => (inv.invoiceBreakdown || []).map((it) => ({ invoice: inv, item: it })));
  const groupOf = (id: string): string | null => {
    const purchase = id.match(/^(purchase_.+)_\d+$/);
    if (purchase) return purchase[1];
    const future = id.match(/^breakdown_(breakdown_\d+)_inst_\d+$/);
    if (future) return future[1];
    return /^breakdown_\d+$/.test(id) ? id : null;
  };
  const group = groupOf(item.id);
  const byId = group ? all.filter((p) => groupOf(p.item.id) === group) : [];
  if (byId.length > 1 || (item.installments || 1) < 2) return byId.length > 0 ? byId : [{ invoice, item }];
  const base = stripInstallmentSuffix(item.description);
  const bank = (invoice.bank || invoice.title).trim().toLowerCase();
  const similar = all.filter(
    (p) =>
      (p.invoice.bank || p.invoice.title).trim().toLowerCase() === bank &&
      stripInstallmentSuffix(p.item.description) === base &&
      p.item.installments === item.installments &&
      p.item.finalAmount === item.finalAmount
  );
  const seen = new Set<number>();
  const unique = similar.filter((p) => {
    const n = p.item.currentInstallment || 1;
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });
  return unique.some((p) => p.item.id === item.id) ? unique : [{ invoice, item }];
}

/** Motivo de não dar para refazer a compra (parcela em fatura já paga), ou null quando dá. */
export const purchaseRebuildBlock = (parts: PurchasePart[]): string | null =>
  parts.some((p) => p.invoice.status === 'REALIZADA')
    ? 'Parte desta compra está em fatura já paga: dá para corrigir nome, natureza, data e valores, mas não a forma de pagamento.'
    : null;

export interface PurchaseDetails {
  title: string;
  natureId?: string;
  natureName?: string;
  mappingId?: string;
  mappingItemId?: string;
  purchaseDate: string;
  total: number;
}

/** Para onde a compra vai: parcelas em faturas do banco, ou paga na hora (débito, Pix ou dinheiro em mãos). */
export type PurchaseDestination =
  | { kind: 'CARD'; institution: string; parts: { dueDate: string; amount: number }[]; sameInstitution: (bank?: string) => boolean }
  | { kind: 'PAID'; bank: string };

export interface PurchaseRebuildResult {
  updates: { id: string; updates: Partial<Movement> }[];
  deletes: string[];
  adds: Omit<Movement, 'id'>[];
  /** Quando a compra segue para o saldo (débito/dinheiro), o item da natureza a marcar como pago. */
  fulfill?: { natureId: string; mappingId: string; itemId: string; realizedValue: number; monthKey: string; paidAt: string };
}

/**
 * Refaz uma compra no cartão com outra forma de pagamento: tira todas as parcelas das faturas em aberto onde estão
 * (cada fatura diminui do que o item valia) e recoloca no destino: parcelas nas faturas do banco (a fatura sobe do que
 * o item vale; sem fatura do mês, cria) ou um pagamento realizado no saldo. Tirar e recolocar na mesma fatura é neutro.
 * Fatura que fica sem itens e sem valor some.
 */
export function rebuildCardPurchase(
  movements: Movement[],
  parts: PurchasePart[],
  purchase: PurchaseDetails,
  dest: PurchaseDestination
): PurchaseRebuildResult {
  const work = new Map<string, Movement>();
  movements
    .filter((m) => m.type === 'CARTAO')
    .forEach((m) => work.set(m.id, { ...m, invoiceBreakdown: [...(m.invoiceBreakdown || [])] }));
  const touched = new Set<string>();
  const adds: Omit<Movement, 'id'>[] = [];

  parts.forEach(({ invoice, item }) => {
    const inv = work.get(invoice.id);
    if (!inv) return;
    inv.invoiceBreakdown = (inv.invoiceBreakdown || []).filter((i) => i.id !== item.id);
    if (inv.status === 'PREVISTA') inv.amount = Math.max(0, roundMoney(inv.amount - item.amount));
    touched.add(inv.id);
  });

  let fulfill: PurchaseRebuildResult['fulfill'];
  if (dest.kind === 'PAID') {
    const nature = purchase.natureId ? { natureId: purchase.natureId, mappingId: purchase.mappingId, mappingItemId: purchase.mappingItemId } : {};
    adds.push({
      title: purchase.title,
      type: 'PAGAR',
      amount: purchase.total,
      dueDate: purchase.purchaseDate,
      bank: dest.bank,
      status: 'REALIZADA',
      category: purchase.natureName || 'Outros',
      paymentDate: purchase.purchaseDate,
      actualAmount: purchase.total,
      ...nature,
    });
    if (purchase.natureId && purchase.mappingId && purchase.mappingItemId) {
      fulfill = {
        natureId: purchase.natureId,
        mappingId: purchase.mappingId,
        itemId: purchase.mappingItemId,
        realizedValue: purchase.total,
        monthKey: purchase.purchaseDate.slice(0, 7),
        paidAt: purchase.purchaseDate,
      };
    }
  } else {
    const groupId = `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const n = dest.parts.length;
    dest.parts.forEach(({ dueDate, amount }, idx) => {
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
        purchaseDate: purchase.purchaseDate,
      };
      const target = [...work.values()].find(
        (inv) => inv.status === 'PREVISTA' && dest.sameInstitution(inv.bank) && inv.dueDate.startsWith(dueDate.substring(0, 7))
      );
      if (target) {
        target.invoiceBreakdown = [...(target.invoiceBreakdown || []), item];
        target.amount = roundMoney(target.amount + amount);
        touched.add(target.id);
      } else {
        const monthName = new Date(`${dueDate}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long' });
        adds.push({
          title: `Fatura ${dest.institution} (${monthName.charAt(0).toUpperCase()}${monthName.slice(1)})`,
          type: 'CARTAO',
          amount,
          dueDate,
          bank: dest.institution,
          status: 'PREVISTA',
          category: 'Fatura de Cartão',
          invoiceBreakdown: [item],
          unanalyzedAmount: 0,
        });
      }
    });
  }

  const updates: PurchaseRebuildResult['updates'] = [];
  const deletes: string[] = [];
  touched.forEach((id) => {
    const inv = work.get(id)!;
    const breakdown = inv.invoiceBreakdown || [];
    if (breakdown.length === 0 && inv.amount <= 0.01 && inv.status === 'PREVISTA') {
      deletes.push(id);
      return;
    }
    const unanalyzed = Math.max(0, roundMoney(inv.amount - breakdown.reduce((acc, i) => acc + i.amount, 0)));
    updates.push({
      id,
      updates: {
        amount: inv.amount,
        invoiceBreakdown: breakdown,
        unanalyzedAmount: unanalyzed,
        category: unanalyzed > 0.01 ? 'Não Analisada' : 'Fatura de Cartão',
      },
    });
  });
  return { updates, deletes, adds, fulfill };
}
