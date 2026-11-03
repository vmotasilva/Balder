import { describe, expect, it, vi } from 'vitest';
import { carryInvoiceDifference } from './invoicePayment';
import type { Movement } from '../types';

const inv = (id: string, bank: string, dueDate: string, amount: number): Movement =>
  ({ id, title: `Fatura ${bank}`, type: 'CARTAO', amount, dueDate, bank, status: 'PREVISTA', category: 'Fatura de Cartão', invoiceBreakdown: [], unanalyzedAmount: 0 }) as Movement;

describe('faturas de bancos diferentes são independentes', () => {
  it('pagar a fatura de um banco só leva a diferença para a próxima do mesmo banco', () => {
    const paid = inv('i1', 'Banco Inter', '2026-11-15', 1000);
    const movements = [paid, inv('n1', 'Nubank', '2026-12-05', 500), inv('i2', 'Inter', '2026-12-15', 800)];
    const updateMovement = vi.fn();
    carryInvoiceDifference(paid, 900, movements, { addMovement: vi.fn(), updateMovement });
    expect(updateMovement).toHaveBeenCalledTimes(1);
    expect(updateMovement.mock.calls[0][0]).toBe('i2');
  });

  it('sem próxima fatura do mesmo banco, cria uma nova em vez de usar a de outro banco', () => {
    const paid = inv('i1', 'Banco Inter', '2026-11-15', 1000);
    const movements = [paid, inv('n1', 'Nubank', '2026-12-05', 500)];
    const updateMovement = vi.fn();
    const addMovement = vi.fn();
    carryInvoiceDifference(paid, 900, movements, { addMovement, updateMovement });
    expect(updateMovement).not.toHaveBeenCalled();
    expect(addMovement).toHaveBeenCalledWith(expect.objectContaining({ bank: 'Banco Inter', amount: 100 }));
  });
});
