import { describe, expect, it } from 'vitest';
import type { ForsetiActivity, Movement } from '../types';
import { addCardPurchaseToInvoices, findPurchaseParts, invoiceAfterRemovingItems, invoiceItemEditUpdates, purchaseRebuildBlock, rebuildCardPurchase } from './cardPurchase';
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

describe('refazer a compra no cartão (forma de pagamento)', () => {
  type M = import('../types').Movement;
  type It = import('../types').InvoiceNatureItemBreakdown;
  const row = (id: string, amount: number, over: Partial<It> = {}): It =>
    ({ id, natureId: 'n1', natureName: 'Lazer', description: 'Prime', amount, isAnalyzed: true, installments: 1, currentInstallment: 1, finalAmount: amount, purchaseDate: '2026-10-24', ...over }) as It;
  const inv = (id: string, dueDate: string, amount: number, items: It[], over: Partial<M> = {}): M =>
    ({ id, type: 'CARTAO', bank: 'Nubank', title: 'Fatura', status: 'PREVISTA', dueDate, amount, invoiceBreakdown: items, unanalyzedAmount: Math.max(0, amount - items.reduce((a, i) => a + i.amount, 0)), ...over }) as M;
  const same = (b?: string) => (b || '').toLowerCase() === 'nubank';
  const details = { title: 'Prime', natureId: 'n1', natureName: 'Lazer', purchaseDate: '2026-10-24', total: 150 };
  const card = (parts: { dueDate: string; amount: number }[]) => ({ kind: 'CARD' as const, institution: 'Nubank', parts, sameInstitution: same });
  const apply = (movements: M[], r: ReturnType<typeof rebuildCardPurchase>) =>
    movements
      .filter((m) => !r.deletes.includes(m.id))
      .map((m) => ({ ...m, ...(r.updates.find((u) => u.id === m.id)?.updates || {}) }));

  it('acha as parcelas pelo prefixo do id nas outras faturas', () => {
    const a = inv('i1', '2026-11-10', 100, [row('purchase_1_ab_1', 50, { installments: 3, currentInstallment: 1 })]);
    const b = inv('i2', '2026-12-10', 50, [row('purchase_1_ab_2', 50, { installments: 3, currentInstallment: 2 })]);
    const other = inv('i3', '2026-12-10', 20, [row('purchase_9_zz_1', 20)], { bank: 'Inter' });
    expect(findPurchaseParts([a, b, other], 'i1', 'purchase_1_ab_1').map((p) => p.item.id)).toEqual(['purchase_1_ab_1', 'purchase_1_ab_2']);
  });

  it('sem prefixo nos ids, agrupa pelas mesmas características e, sozinha, devolve só o item', () => {
    const a = inv('i1', '2026-11-10', 50, [row('x1', 50, { description: 'Tênis (1/2)', installments: 2, currentInstallment: 1, finalAmount: 100 })]);
    const b = inv('i2', '2026-12-10', 50, [row('x2', 50, { description: 'Tênis (2/2)', installments: 2, currentInstallment: 2, finalAmount: 100 })]);
    expect(findPurchaseParts([a, b], 'i2', 'x2')).toHaveLength(2);
    expect(findPurchaseParts([a], 'i1', 'x1')).toHaveLength(1);
  });

  it('fatura paga bloqueia refazer', () => {
    const paid = inv('i1', '2026-10-10', 50, [row('a', 50)], { status: 'REALIZADA' });
    expect(purchaseRebuildBlock(findPurchaseParts([paid], 'i1', 'a'))).toMatch(/fatura já paga/);
    expect(purchaseRebuildBlock(findPurchaseParts([inv('i1', '2026-11-10', 50, [row('a', 50)])], 'i1', 'a'))).toBeNull();
  });

  it('à vista para o mesmo banco e mesma fatura não muda o total', () => {
    const a = inv('i1', '2026-11-10', 300, [row('purchase_1_ab_1', 100)]);
    const r = rebuildCardPurchase([a], findPurchaseParts([a], 'i1', 'purchase_1_ab_1'), { ...details, total: 100 }, card([{ dueDate: '2026-11-10', amount: 100 }]));
    const [after] = apply([a], r);
    expect(after.amount).toBe(300);
    expect(after.unanalyzedAmount).toBe(200);
    expect(after.invoiceBreakdown).toHaveLength(1);
    expect(r.adds).toEqual([]);
  });

  it('à vista para 3x: sai da fatura e entra uma parcela em cada fatura (cria a que não existe)', () => {
    const a = inv('i1', '2026-11-10', 300, [row('purchase_1_ab_1', 100)]);
    const b = inv('i2', '2026-12-10', 80, []);
    const parts = findPurchaseParts([a, b], 'i1', 'purchase_1_ab_1');
    const r = rebuildCardPurchase([a, b], parts, details, card([
      { dueDate: '2026-11-10', amount: 50 },
      { dueDate: '2026-12-10', amount: 50 },
      { dueDate: '2027-01-10', amount: 50 },
    ]));
    const [na, nb] = apply([a, b], r);
    expect(na.amount).toBe(250);
    expect(nb.amount).toBe(130);
    expect(r.adds).toHaveLength(1);
    expect(r.adds[0]).toMatchObject({ type: 'CARTAO', dueDate: '2027-01-10', amount: 50, bank: 'Nubank' });
    expect(na.invoiceBreakdown![0]).toMatchObject({ description: 'Prime (1/3)', installments: 3, finalAmount: 150, currentInstallment: 1 });
  });

  it('crédito para débito: tira da fatura, cria o pagamento realizado e marca o item da natureza', () => {
    const a = inv('i1', '2026-11-10', 100, [row('purchase_1_ab_1', 100)]);
    const r = rebuildCardPurchase([a], findPurchaseParts([a], 'i1', 'purchase_1_ab_1'), { ...details, total: 100, mappingId: 'm1', mappingItemId: 'it1' }, { kind: 'PAID', bank: 'Conta Nubank' });
    expect(r.deletes).toEqual(['i1']);
    expect(r.adds[0]).toMatchObject({ type: 'PAGAR', status: 'REALIZADA', amount: 100, bank: 'Conta Nubank', paymentDate: '2026-10-24', natureId: 'n1', mappingItemId: 'it1' });
    expect(r.fulfill).toMatchObject({ natureId: 'n1', mappingId: 'm1', itemId: 'it1', realizedValue: 100, monthKey: '2026-10' });
  });

  it('fatura com outros itens só diminui do valor da compra', () => {
    const a = inv('i1', '2026-11-10', 300, [row('purchase_1_ab_1', 100), row('o', 200, { description: 'Outro' })]);
    const r = rebuildCardPurchase([a], findPurchaseParts([a], 'i1', 'purchase_1_ab_1'), { ...details, total: 100 }, { kind: 'PAID', bank: 'Dinheiro em mãos' });
    expect(r.deletes).toEqual([]);
    expect(apply([a], r)[0]).toMatchObject({ amount: 200, unanalyzedAmount: 0, category: 'Fatura de Cartão' });
  });
});
