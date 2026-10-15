import { describe, expect, it } from 'vitest';
import type { MappingItem } from '../types';
import { getItemOccurrences, registerItemPayment, rescheduleOccurrence } from './mappingItemState';

const monthly = (over: Partial<MappingItem> = {}): MappingItem =>
  ({ id: 'i1', description: 'Gemini', quantity: 1, price: 25, multiplierWeeks: 1, totalValue: 25, recurrenceType: 'MENSAL', dayOfMonth: 10, ...over } as MappingItem);

const dates = (item: MappingItem, monthKey: string) => getItemOccurrences(item, monthKey).map((o) => o.date);

describe('rescheduleOccurrence', () => {
  it('só esta ocorrência: muda a data do mês e os outros meses seguem no dia original', () => {
    const item = monthly();
    const next = { ...item, ...rescheduleOccurrence(item, '2026-10', '2026-10-10', '2026-10-20', 'ONE') };
    expect(dates(next, '2026-10')).toEqual(['2026-10-20']);
    expect(dates(next, '2026-11')).toEqual(['2026-11-10']);
  });

  it('daqui em diante: o dia previsto vale desta competência em diante, sem mexer nos meses anteriores', () => {
    const item = monthly();
    const next = { ...item, ...rescheduleOccurrence(item, '2026-10', '2026-10-10', '2026-10-20', 'FUTURE') };
    expect(dates(next, '2026-09')).toEqual(['2026-09-10']);
    expect(dates(next, '2026-10')).toEqual(['2026-10-20']);
    expect(dates(next, '2026-12')).toEqual(['2026-12-20']);
  });

  it('mover de novo ou voltar ao dia original desfaz a mudança pontual', () => {
    const item = monthly();
    const moved = { ...item, ...rescheduleOccurrence(item, '2026-10', '2026-10-10', '2026-10-20', 'ONE') };
    const again = { ...moved, ...rescheduleOccurrence(moved, '2026-10', '2026-10-20', '2026-10-25', 'ONE') };
    expect(dates(again, '2026-10')).toEqual(['2026-10-25']);
    const back = { ...again, ...rescheduleOccurrence(again, '2026-10', '2026-10-25', '2026-10-10', 'ONE') };
    expect(dates(back, '2026-10')).toEqual(['2026-10-10']);
    expect(back.dateMoves).toEqual({});
  });

  it('quinzenal: o dia da quinzena muda para as duas datas do mês', () => {
    const item = monthly({ recurrenceType: 'QUINZENAL', dayOfFortnight: 5, dayOfMonth: undefined });
    expect(dates(item, '2026-10')).toEqual(['2026-10-05', '2026-10-20']);
    const next = { ...item, ...rescheduleOccurrence(item, '2026-10', '2026-10-20', '2026-10-23', 'FUTURE') };
    expect(dates(next, '2026-10')).toEqual(['2026-10-08', '2026-10-23']);
  });

  it('semanal: o dia da semana passa a ser o da nova data', () => {
    const item = monthly({ recurrenceType: 'SEMANAL', dayOfWeek: 'SABADO', dayOfMonth: undefined });
    const next = { ...item, ...rescheduleOccurrence(item, '2026-10', '2026-10-10', '2026-10-09', 'FUTURE') };
    expect(dates(next, '2026-10')).toEqual(['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30']);
  });

  it('competência com pagamento: a regra começa no mês seguinte e a data paga não é solta', () => {
    const item = monthly({ recurrenceType: 'QUINZENAL', dayOfFortnight: 5, dayOfMonth: undefined });
    const paid = { ...item, ...registerItemPayment(item, '2026-10', { paidAt: '2026-10-05', amount: 25, coveredDates: ['2026-10-05'] }) };
    const next = { ...paid, ...rescheduleOccurrence(paid, '2026-10', '2026-10-20', '2026-10-23', 'FUTURE') };
    expect(dates(next, '2026-10')).toEqual(['2026-10-05', '2026-10-23']);
    expect(dates(next, '2026-11')).toEqual(['2026-11-08', '2026-11-23']);
  });

  it('não mexe em data já paga, em data repetida nem fora da competência', () => {
    const item = monthly();
    const paid = { ...item, ...registerItemPayment(item, '2026-10', { paidAt: '2026-10-10', amount: 25, coveredDates: ['2026-10-10'] }) };
    expect(rescheduleOccurrence(paid, '2026-10', '2026-10-10', '2026-10-20', 'ONE')).toEqual({});
    expect(rescheduleOccurrence(item, '2026-10', '2026-10-10', '2026-11-02', 'ONE')).toEqual({});
    expect(rescheduleOccurrence(item, '2026-10', '2026-10-10', '2026-10-10', 'ONE')).toEqual({});
  });

  it('guarda a forma de pagamento no pagamento', () => {
    const item = monthly();
    const patch = registerItemPayment(item, '2026-10', { paidAt: '2026-10-10', amount: 25, coveredDates: ['2026-10-10'], paymentMethod: 'PIX' });
    expect(patch.payments?.['2026-10'][0].paymentMethod).toBe('PIX');
  });
});
