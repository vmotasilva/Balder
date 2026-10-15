import { describe, expect, it } from 'vitest';
import type { ExpenseNature, MappingItem, Movement } from '../types';
import { findMappingSpendCandidates } from './mappingSpendCandidates';
import { registerMappingPayment, resolveMappingMonth, waiveMappingPeriod } from './mappingItemState';

const item = (id: string, price: number): MappingItem =>
  ({ id, description: id, quantity: 1, price, totalValue: price * 4, multiplierWeeks: 4, frequency: 'SEMANAL', dayOfWeek: 'Sábado' } as unknown as MappingItem);

const nature = (): ExpenseNature =>
  ({
    id: 'nat1',
    name: 'Alimentação & Supermercado',
    mappings: [{ id: 'map1', name: 'Mercado', natureId: 'nat1', items: [item('i1', 100)], keywords: ['atacadao'] }],
  } as unknown as ExpenseNature);

const mov = (over: Partial<Movement>): Movement =>
  ({
    id: 'm1',
    title: 'Compra',
    type: 'PAGAR',
    amount: 80,
    dueDate: '2026-10-02',
    paymentDate: '2026-10-02',
    bank: '',
    status: 'REALIZADA',
    category: 'Alimentação & Supermercado',
    ...over,
  } as Movement);

const range = { from: '2026-09-28', to: '2026-10-04' };
const find = (movements: Movement[], natures = [nature()]) =>
  findMappingSpendCandidates({ movements, natures, natureId: 'nat1', mappingId: 'map1', range });

describe('findMappingSpendCandidates', () => {
  it('acha gasto realizado da natureza dentro da semana', () => {
    expect(find([mov({})]).map((m) => m.id)).toEqual(['m1']);
  });

  it('ignora fora da semana, previstos, já ligados a item e de outro mapeamento', () => {
    expect(
      find([
        mov({ id: 'a', paymentDate: '2026-10-06' }),
        mov({ id: 'b', status: 'PREVISTA' }),
        mov({ id: 'c', mappingItemId: 'i1' }),
        mov({ id: 'd', mappingId: 'outro' }),
        mov({ id: 'e', category: 'Lazer' }),
      ])
    ).toEqual([]);
  });

  it('ignora gasto já associado a um lançamento do mapeamento e põe quem cita o mapeamento primeiro', () => {
    const n = nature();
    const [payment] = registerMappingPayment(n.mappings[0], '2026-10', { paidAt: '2026-10-02', amount: 80, movementId: 'm1' });
    n.mappings[0].items[0] = { ...n.mappings[0].items[0], ...payment.patch };
    expect(find([mov({})], [n])).toEqual([]);
    const ranked = find([mov({ id: 'x', paymentDate: '2026-09-29' }), mov({ id: 'y', title: 'Atacadão' })]);
    expect(ranked.map((m) => m.id)).toEqual(['y', 'x']);
  });
});

describe('desconsiderar previsto', () => {
  it('tira o previsto da semana sem contar pagamento', () => {
    const mapping = nature().mappings[0];
    const before = resolveMappingMonth(mapping, '2026-10');
    const { waived, changes } = waiveMappingPeriod(mapping, '2026-10', { from: '2026-10-05', to: '2026-10-11' });
    expect(waived).toBeGreaterThan(0);
    const after = resolveMappingMonth(
      { items: mapping.items.map((it) => ({ ...it, ...(changes.find((c) => c.itemId === it.id)?.patch || {}) })) },
      '2026-10'
    );
    expect(after.paid).toBe(0);
    expect(after.pending).toBeCloseTo(before.pending - waived, 2);
  });

  it('sem a semana: acha gasto do mês inteiro e põe o mais próximo da data prevista primeiro', () => {
    const month = { from: '2026-10-01', to: '2026-10-31' };
    const found = findMappingSpendCandidates({
      movements: [
        mov({ id: 'far', paymentDate: '2026-10-28' }),
        mov({ id: 'near', paymentDate: '2026-10-06' }),
        mov({ id: 'out', paymentDate: '2026-11-02' }),
      ],
      natures: [nature()],
      natureId: 'nat1',
      mappingId: 'map1',
      range: month,
      near: '2026-10-04',
    });
    expect(found.map((m) => m.id)).toEqual(['near', 'far']);
  });
});
