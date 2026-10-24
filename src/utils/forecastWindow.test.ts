import { describe, expect, it } from 'vitest';
import type { ExpenseNature, MappingItem, Movement } from '../types';
import { buildForecastWindow } from './forecastWindow';

const item = (id: string, price: number): MappingItem =>
  ({ id, description: id, quantity: 1, price, totalValue: price, multiplierWeeks: 1, frequency: 'MENSAL', dayOfMonth: 30 } as unknown as MappingItem);
const natures = [
  { id: 'n1', name: 'Lazer', mappings: [{ id: 'm1', name: 'Streaming', natureId: 'n1', items: [item('netflix', 20.9), item('spotify', 40.9)] }] },
] as unknown as ExpenseNature[];
const invoice = (breakdown: unknown[]): Movement =>
  ({ id: 'inv', type: 'CARTAO', status: 'PREVISTA', title: 'Fatura', amount: 100, dueDate: '2026-11-10', invoiceBreakdown: breakdown } as unknown as Movement);
const open = (movements: Movement[]) =>
  buildForecastWindow({ movements, natures, startingBalance: 0, today: new Date(2026, 9, 21) }).entries.filter((e) => e.source === 'NATUREZA').map((e) => e.title);

describe('compra no cartão abate o previsto da natureza', () => {
  it('sem fatura, os dois itens ficam em aberto', () => {
    expect(open([]).sort()).toEqual(['netflix', 'spotify']);
  });
  it('ligada ao item', () => {
    expect(open([invoice([{ id: 'a', natureName: 'Lazer', natureId: 'n1', mappingId: 'm1', mappingItemId: 'netflix', description: 'Netflix', amount: 20.9, isAnalyzed: true }])])).toEqual(['spotify']);
  });
  it('ligada só ao mapeamento (sem item) abate os itens dele', () => {
    expect(open([invoice([{ id: 'a', natureName: 'Lazer', natureId: 'n1', mappingId: 'm1', description: 'Assinaturas', amount: 61.8, isAnalyzed: true }])])).toEqual([]);
  });
});

describe('gasto lançado na semana baixa o vencimento do resumo', () => {
  const weekly = (price: number): MappingItem =>
    ({ id: 'w', description: 'Feira', quantity: 1, price, totalValue: price * 5, multiplierWeeks: 5, frequency: 'SEMANAL', dayOfWeek: 'Sábado' } as unknown as MappingItem);
  const summary = [
    { id: 'n2', name: 'Alimentação', mappings: [{ id: 'mk', name: 'Mercado', natureId: 'n2', detailMode: 'MAPEAMENTOS', items: [weekly(100)] }] },
  ] as unknown as ExpenseNature[];
  const spend = (over: Partial<Movement>): Movement =>
    ({ id: 's', title: 'Mercado', type: 'PAGAR', status: 'REALIZADA', amount: 100, dueDate: '2026-10-20', paymentDate: '2026-10-20', bank: '', category: 'Alimentação', ...over } as Movement);
  const weeks = (movements: Movement[]) =>
    buildForecastWindow({ movements, natures: summary, startingBalance: 0, today: new Date(2026, 9, 21), period: 'MES' })
      .entries.filter((e) => e.source === 'NATUREZA')
      .map((e) => `${e.date}:${e.amount}`);

  it('sem gasto, todas as semanas ficam em aberto', () => {
    expect(weeks([]).length).toBeGreaterThan(1);
  });
  it('gasto na semana (antes do sábado) tira só aquela semana', () => {
    const before = weeks([]);
    const after = weeks([spend({})]);
    expect(after.length).toBe(before.length - 1);
    expect(after).not.toContain('2026-10-25:100');
  });
  it('gasto de outro mapeamento da natureza não baixa', () => {
    expect(weeks([spend({ title: 'Restaurante' })])).toEqual(weeks([]));
  });
});
