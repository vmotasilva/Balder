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
