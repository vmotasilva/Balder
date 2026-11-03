import { describe, expect, it } from 'vitest';
import { buildMonthClosingChecks, dayBefore, invoiceWithExtra } from './monthClosingChecks';
import type { BankInstitution, Movement } from '../types';

const bank: BankInstitution = { id: 'b1', name: 'Nubank', color: '#800', icon: 'x', closingDay: 3, dueDay: 10 };
const invoice = (over: Partial<Movement>): Movement => ({
  id: 'i1', title: 'Fatura', type: 'CARTAO', amount: 1000, dueDate: '2026-11-10', bank: 'Nubank',
  status: 'PREVISTA', category: 'Fatura de Cartão', ...over,
});

describe('dayBefore', () => {
  it('volta um dia, inclusive na virada de mês', () => {
    expect(dayBefore('2026-11-03')).toBe('2026-11-02');
    expect(dayBefore('2026-11-01')).toBe('2026-10-31');
  });
});

describe('buildMonthClosingChecks', () => {
  it('acha a fatura aberta que ainda não fechou e o último dia de compras', () => {
    const [c] = buildMonthClosingChecks('2026-10', [invoice({ dueDate: '2026-11-10' })], [], [], [bank], '2026-10-31');
    expect(c.open?.closingDate).toBe('2026-11-03');
    expect(c.open?.lastPurchaseDate).toBe('2026-11-02');
    expect(c.open?.daysToClosing).toBe(3);
    expect(c.closingMissing).toBe(false);
  });

  it('soma compras do mês feitas a partir do fechamento', () => {
    const inv = invoice({
      invoiceBreakdown: [
        { id: 'a', natureName: 'x', description: 'a', amount: 100, isAnalyzed: true, purchaseDate: '2026-10-05' },
        { id: 'b', natureName: 'x', description: 'b', amount: 50, isAnalyzed: true, purchaseDate: '2026-10-02' },
      ],
    });
    const [c] = buildMonthClosingChecks('2026-10', [inv], [], [], [bank], '2026-10-31');
    expect(c.afterClosing).toEqual({ count: 1, total: 100 });
  });

  it('lista faturas não pagas que vencem no mês fechado', () => {
    const [c] = buildMonthClosingChecks('2026-10', [invoice({ dueDate: '2026-10-10' })], [], [], [bank], '2026-10-31');
    expect(c.unpaidDueInMonth).toHaveLength(1);
  });

  it('avisa quando o fechamento não está cadastrado', () => {
    const [c] = buildMonthClosingChecks('2026-10', [invoice({})], [], [], [{ ...bank, closingDay: undefined }], '2026-10-31');
    expect(c.closingMissing).toBe(true);
  });
});

describe('invoiceWithExtra', () => {
  it('soma ao total e à parte sem detalhar', () => {
    expect(invoiceWithExtra(invoice({ unanalyzedAmount: 20 }), 300)).toMatchObject({ amount: 1300, unanalyzedAmount: 320 });
  });
});
