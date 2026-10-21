import { describe, expect, it } from 'vitest';
import type { MappingItem } from '../types';
import {
  applyMappingItemState,
  confirmOthersPayment,
  needsOthersConfirmation,
  resolveMappingExcluded,
  resolveMappingItemMonth,
  resolveMappingItemState,
} from './mappingItemState';

const nowKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const item = (extra: Partial<MappingItem> = {}): MappingItem => ({
  id: 'i1',
  description: 'Escola',
  quantity: 1,
  price: 850,
  multiplierWeeks: 1,
  totalValue: 850,
  recurrenceType: 'MENSAL',
  dayOfMonth: 10,
  ...extra,
});

describe('pago por outra pessoa: fora da projeção, com confirmação mensal', () => {
  const start = shiftMonth(nowKey(), -2);
  const withRule = (): MappingItem => {
    const base = item();
    return { ...base, ...applyMappingItemState(base, start, { paidByOthers: true, paidBy: 'Avó' }, true) };
  };

  it('mantém o valor visível mas fora da projeção', () => {
    const it = withRule();
    const s = resolveMappingItemMonth(it, nowKey());
    expect(s.value).toBe(0);
    expect(s.base).toBe(850);
    expect(resolveMappingExcluded([it], nowKey())).toMatchObject({ amount: 850, count: 1 });
  });

  it('pede confirmação nos meses seguintes ao da regra, não no mês em que ela nasceu', () => {
    const it = withRule();
    expect(needsOthersConfirmation(it, start)).toBe(false);
    expect(needsOthersConfirmation(it, nowKey())).toBe(true);
    expect(resolveMappingExcluded([it], nowKey()).toConfirm).toBe(1);
  });

  it('não pede confirmação de meses que ainda não começaram', () => {
    expect(needsOthersConfirmation(withRule(), shiftMonth(nowKey(), 1))).toBe(false);
  });

  it('confirmar grava o mês como pago por terceiros e mantém o nome de quem pagou', () => {
    const it = withRule();
    const confirmed = { ...it, ...confirmOthersPayment(it, nowKey(), true) };
    expect(needsOthersConfirmation(confirmed, nowKey())).toBe(false);
    expect(resolveMappingItemState(confirmed, nowKey())).toMatchObject({ paidByOthers: true, paidBy: 'Avó' });
    expect(resolveMappingItemMonth(confirmed, nowKey()).value).toBe(0);
  });

  it('negar ("eu paguei") devolve o item à projeção só naquele mês', () => {
    const it = withRule();
    const denied = { ...it, ...confirmOthersPayment(it, nowKey(), false) };
    expect(resolveMappingItemMonth(denied, nowKey()).value).toBe(850);
    expect(resolveMappingItemState(denied, shiftMonth(nowKey(), 1)).paidByOthers).toBe(true);
  });

  it('ajuste pontual (sem regra) nunca pede confirmação', () => {
    const base = item();
    const it = { ...base, ...applyMappingItemState(base, nowKey(), { paidByOthers: true }, false) };
    expect(needsOthersConfirmation(it, nowKey())).toBe(false);
  });
});
