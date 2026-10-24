import { describe, expect, it } from 'vitest';
import type { ForsetiActivity, Movement } from '../types';
import { addCardPurchaseToInvoices, invoiceAfterRemovingItems, invoiceItemEditUpdates } from './cardPurchase';
import { createdMovementsOf, invoiceItemsOf } from './forsetiAssistant';

const invoice = (over: Partial<Movement> = {}): Movement => ({
  id: 'inv1',
  title: 'Fatura Nubank (Novembro)',
  type: 'CARTAO',
  amount: 1000,
  dueDate: '2026-11-10',
  bank: 'Nubank',
  status: 'PREVISTA',
  category: 'Não Analisada',
  invoiceBreakdown: [{ id: 'b1', natureId: 'OUTROS', natureName: 'Outros', description: 'Diversos', amount: 700, isAnalyzed: true }],
  unanalyzedAmount: 300,
  ...over,
});

const purchase = { institution: 'Nubank', title: 'Almoço', total: 50 };

/** Aplica a compra como o app faz e devolve a fatura resultante. */
function buy(movements: Movement[], amount: number, dueDate = '2026-11-10') {
  const added: Omit<Movement, 'id'>[] = [];
  const updates: Record<string, Partial<Movement>> = {};
  const items = addCardPurchaseToInvoices(purchase, [{ dueDate, amount }], movements, {
    addMovement: (m) => added.push(m),
    updateMovement: (id, u) => (updates[id] = u),
  });
  return { items, added, updates };
}

describe('desfazer compra no cartão', () => {
  it('na fatura que já existia, o total e o "não analisada" voltam ao que eram (compra que coube no que sobrava)', () => {
    const inv = invoice();
    const { items, updates } = buy([inv], 50);
    expect(items[0].grow).toBe(0);
    const after = { ...inv, ...updates.inv1 } as Movement;
    expect(after.amount).toBe(1000);
    const undone = invoiceAfterRemovingItems(after, [items[0].itemId], items[0].grow) as Partial<Movement>;
    expect(undone.amount).toBe(1000);
    expect(undone.unanalyzedAmount).toBe(300);
    expect(undone.invoiceBreakdown?.map((i) => i.id)).toEqual(['b1']);
  });

  it('quando a compra passou do que sobrava, só o excedente sai do total', () => {
    const inv = invoice({ unanalyzedAmount: 20, amount: 720 });
    const { items, updates } = buy([inv], 50);
    expect(items[0].grow).toBe(30);
    const after = { ...inv, ...updates.inv1 } as Movement;
    expect(after.amount).toBe(750);
    const undone = invoiceAfterRemovingItems(after, [items[0].itemId], items[0].grow) as Partial<Movement>;
    expect(undone.amount).toBe(720);
    expect(undone.unanalyzedAmount).toBe(20);
  });

  it('a fatura criada pela compra some junto', () => {
    const { items, added } = buy([], 50);
    expect(items[0].grow).toBe(50);
    const created = { ...invoice(), ...added[0], id: 'novo' } as Movement;
    expect(invoiceAfterRemovingItems(created, [items[0].itemId], items[0].grow)).toBe('DELETE');
  });
});

describe('itens de fatura de uma solicitação da Forseti', () => {
  const activity = (): ForsetiActivity => ({
    id: 'a1',
    at: '2026-10-11T14:00:00Z',
    kind: 'PAGAMENTO',
    request: 'almoço 50 no nubank',
    result: '',
    movements: [{ title: 'Almoço', dueDate: '2026-11-10', type: 'PAGAR', bank: 'Nubank', invoiceItemId: 'b1', invoiceGrow: 0 }],
  });

  it('acha o item na fatura e não confunde com um lançamento solto de mesmo nome', () => {
    const inv = invoice();
    const solto: Movement = { ...inv, id: 'm2', title: 'Almoço', type: 'PAGAR', invoiceBreakdown: [] };
    expect(invoiceItemsOf(activity(), [inv, solto]).map((x) => x.item.id)).toEqual(['b1']);
    expect(createdMovementsOf(activity(), [inv, solto])).toEqual([]);
  });

  it('se o item já foi tirado da fatura, não há o que desfazer nela', () => {
    expect(invoiceItemsOf(activity(), [invoice({ invoiceBreakdown: [] })])).toEqual([]);
  });
});

describe('invoiceItemEditUpdates', () => {
  const invoice = {
    id: 'inv1',
    type: 'CARTAO',
    amount: 100,
    status: 'PREVISTA',
    invoiceBreakdown: [
      { id: 'a', natureId: 'n1', natureName: 'Lazer', mappingId: 'm1', mappingItemId: 'i1', description: 'Netflix (1/3)', amount: 40, isAnalyzed: true, installments: 3, currentInstallment: 1 },
      { id: 'b', natureName: 'Não Analisada', description: 'Outro', amount: 60, isAnalyzed: false },
    ],
  } as unknown as import('../types').Movement;

  it('renomeia e troca natureza/mapeamento mantendo valor e sufixo de parcela', () => {
    const up = invoiceItemEditUpdates(invoice, 'a', { description: 'Disney+', natureId: 'n2', natureName: 'Streaming', mappingId: 'm2', mappingItemId: 'i2' });
    const a = up!.invoiceBreakdown!.find((i) => i.id === 'a')!;
    expect(a).toMatchObject({ description: 'Disney+ (1/3)', natureId: 'n2', natureName: 'Streaming', mappingId: 'm2', mappingItemId: 'i2', amount: 40, isAnalyzed: true });
    expect(up!.invoiceBreakdown!.find((i) => i.id === 'b')).toEqual(invoice.invoiceBreakdown![1]);
  });

  it('Outros e sem natureza limpam o mapeamento', () => {
    const others = invoiceItemEditUpdates(invoice, 'a', { description: 'x', natureId: 'OUTROS', natureName: '' })!.invoiceBreakdown![0];
    expect(others).toMatchObject({ natureId: undefined, natureName: 'Outros', mappingId: undefined, mappingItemId: undefined, isAnalyzed: true });
    const none = invoiceItemEditUpdates(invoice, 'a', { description: 'x', natureId: '', natureName: '' })!.invoiceBreakdown![0];
    expect(none).toMatchObject({ natureName: 'Não Analisada', isAnalyzed: false });
  });
});

describe('invoiceItemEditUpdates: valores e data', () => {
  const base = (status: 'PREVISTA' | 'REALIZADA') =>
    ({
      id: 'inv1',
      type: 'CARTAO',
      amount: 100,
      status,
      invoiceBreakdown: [
        { id: 'a', natureId: 'n1', natureName: 'Lazer', description: 'Prime', amount: 40, isAnalyzed: true, purchaseDate: '2026-10-24' },
        { id: 'b', natureId: 'OUTROS', natureName: 'Outros', description: 'Resto', amount: 60, isAnalyzed: true },
      ],
    }) as unknown as import('../types').Movement;
  const edit = { description: 'Prime', natureId: 'n1', natureName: 'Lazer' };

  it('corrigir o valor da compra muda o total da fatura em aberto pela diferença', () => {
    const up = invoiceItemEditUpdates(base('PREVISTA'), 'a', { ...edit, amount: 50, purchaseDate: '2026-10-21' })!;
    expect(up.amount).toBe(110);
    expect(up.unanalyzedAmount).toBe(0);
    expect(up.invoiceBreakdown![0]).toMatchObject({ amount: 50, purchaseDate: '2026-10-21' });
  });

  it('fatura já paga não muda de valor: a diferença fica sem detalhar', () => {
    const up = invoiceItemEditUpdates(base('REALIZADA'), 'a', { ...edit, amount: 30 })!;
    expect(up.amount).toBe(100);
    expect(up.unanalyzedAmount).toBe(10);
    expect(up.category).toBe('Não Analisada');
  });

  it('sem valor informado, o total e a data não mudam', () => {
    const up = invoiceItemEditUpdates(base('PREVISTA'), 'a', edit)!;
    expect(up.amount).toBeUndefined();
    expect(up.invoiceBreakdown![0]).toMatchObject({ amount: 40, purchaseDate: '2026-10-24' });
  });
});
