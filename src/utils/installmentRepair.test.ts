import { describe, expect, it } from 'vitest';
import { planInstallmentRepair } from './installmentRepair';
import type { InvoiceNatureItemBreakdown, Movement } from '../types';

const item = (id: string, cur: number, desc = 'Regenesis'): InvoiceNatureItemBreakdown => ({
  id, natureName: 'Saúde', description: `${desc} (${cur}/3)`, amount: 50, isAnalyzed: true, installments: 3, currentInstallment: cur, finalAmount: 150,
});
const inv = (id: string, dueDate: string, items: InvoiceNatureItemBreakdown[], status: Movement['status'] = 'PREVISTA'): Movement =>
  ({ id, title: `Fatura ${dueDate}`, type: 'CARTAO', amount: 500, dueDate, bank: 'Nubank', status, category: 'x', invoiceBreakdown: items }) as Movement;

describe('planInstallmentRepair', () => {
  it('não mexe em parcelas consistentes', () => {
    const plan = planInstallmentRepair([
      inv('a', '2026-11-10', [item('1', 1)]), inv('b', '2026-12-10', [item('2', 2)]), inv('c', '2027-01-10', [item('3', 3)]),
    ]);
    expect(plan.invoices).toHaveLength(0);
  });

  it('renumera a parcela resetada e remove as repetidas/deslocadas', () => {
    const plan = planInstallmentRepair([
      inv('a', '2026-11-10', [item('1', 1)], 'REALIZADA'),
      inv('b', '2026-12-10', [item('2', 1)], 'REALIZADA'), // resetada para 1
      inv('c', '2027-01-10', [item('3', 3), item('4', 2)]), // 3 correta, 2 deslocada
      inv('d', '2027-02-10', [item('5', 3)]), // além da última
    ]);
    const byId = Object.fromEntries(plan.invoices.map((p) => [p.movement.id, p]));
    expect(byId.b.items[0].currentInstallment).toBe(2);
    expect(byId.b.items[0].description).toBe('Regenesis (2/3)');
    expect(byId.c.items.map((i) => i.id)).toEqual(['3']);
    expect(byId.d.items).toHaveLength(0);
    expect(byId.d.remove).toBe(true);
    expect(byId.a).toBeUndefined();
  });
});
