import { describe, expect, it } from 'vitest';
import { planCarryWithItems, suggestNextInvoiceItems } from './invoicePayment';
import type { InvoiceNatureItemBreakdown, Movement } from '../types';

const item = (id: string, amount: number, purchaseDate?: string): InvoiceNatureItemBreakdown => ({
  id, natureName: 'x', description: id, amount, isAnalyzed: true, purchaseDate,
});
const invoice = (over: Partial<Movement> = {}): Movement => ({
  id: 'inv', title: 'Fatura Inter', type: 'CARTAO', amount: 1000, dueDate: '2026-10-10', bank: 'Inter',
  status: 'PREVISTA', category: 'Fatura de Cartão',
  invoiceBreakdown: [item('a', 600, '2026-09-10'), item('b', 150, '2026-10-01'), item('c', 100, '2026-10-02'), item('d', 150, '2026-10-02')],
  unanalyzedAmount: 0,
  ...over,
});
const next = (over: Partial<Movement> = {}): Movement =>
  invoice({ id: 'next', dueDate: '2026-11-10', amount: 500, invoiceBreakdown: [item('n', 500, '2026-10-20')], ...over });

describe('suggestNextInvoiceItems', () => {
  it('acha o conjunto de compras recentes que soma a diferença', () => {
    const r = suggestNextInvoiceItems(invoice(), 250);
    expect(r.exact).toBe(true);
    const sum = r.ids.reduce((acc, id) => acc + invoice().invoiceBreakdown!.find((i) => i.id === id)!.amount, 0);
    expect(sum).toBe(250);
    expect(r.ids).not.toContain('a');
  });

  it('sem soma exata, leva as mais recentes que couberem', () => {
    const r = suggestNextInvoiceItems(invoice(), 260);
    expect(r.exact).toBe(false);
    expect(r.ids.length).toBeGreaterThan(0);
  });

  it('sem diferença, não sugere nada', () => {
    expect(suggestNextInvoiceItems(invoice(), 0)).toEqual({ ids: [], exact: false });
  });
});

describe('planCarryWithItems', () => {
  it('move os itens para a próxima fatura e ela sobe pela diferença', () => {
    const plan = planCarryWithItems(invoice(), 750, [invoice(), next()], ['b', 'c']);
    expect(plan.invoiceUpdates.invoiceBreakdown?.map((i) => i.id)).toEqual(['a', 'd']);
    expect(plan.invoiceUpdates.unanalyzedAmount).toBe(0);
    expect(plan.nextUpdate?.id).toBe('next');
    expect(plan.nextUpdate?.updates.amount).toBe(750);
    expect(plan.nextUpdate?.updates.invoiceBreakdown?.map((i) => i.id)).toEqual(['n', 'b', 'c']);
    expect(plan.nextUpdate?.updates.unanalyzedAmount).toBe(0);
  });

  it('o que sobra da diferença vai como "sem detalhar" na próxima', () => {
    const plan = planCarryWithItems(invoice(), 700, [invoice(), next()], ['b']);
    expect(plan.nextUpdate?.updates.amount).toBe(800);
    expect(plan.nextUpdate?.updates.unanalyzedAmount).toBe(150);
  });

  it('sem próxima fatura, cria uma no mês seguinte com os itens', () => {
    const plan = planCarryWithItems(invoice(), 750, [invoice()], ['b', 'c']);
    expect(plan.nextUpdate).toBeUndefined();
    expect(plan.nextAdd).toMatchObject({ dueDate: '2026-11-10', amount: 250, status: 'PREVISTA' });
    expect(plan.nextAdd?.invoiceBreakdown).toHaveLength(2);
  });
});
