import { describe, expect, it } from 'vitest';
import { listPaymentInstitutions } from './paymentInstitutions';
import type { BankAccount, BankInstitution, CreditCardItem } from '../types';

const bank = (name: string) => ({ id: name, name, code: '', color: '#000', icon: '🏦', status: 'MANUAL', syncedAt: '' }) as BankInstitution;

describe('listPaymentInstitutions', () => {
  it('une o mesmo banco escrito de jeitos diferentes', () => {
    const banks = [bank('Nubank S.A.'), bank('Banco Inter')];
    const accounts = [
      { id: 'a1', name: 'Inter Conta Digital', bankName: 'Banco Inter', type: 'CORRENTE', balance: 1, color: '#000', icon: '🏦' },
      { id: 'a2', name: 'Reserva', bankName: 'Inter', type: 'POUPANCA', balance: 1, color: '#000', icon: '🏦' },
    ] as BankAccount[];
    const cards = [{ id: 'c1', name: 'Nubank Mastercard', bank: 'Nubank', limitTotal: 1000, closingDay: 28, dueDay: 5, color: '#000' }] as CreditCardItem[];
    const list = listPaymentInstitutions(accounts, cards, banks);
    expect(list.map((i) => i.name)).toEqual(['Nubank S.A.', 'Banco Inter']);
    expect(list[0].card?.id).toBe('c1');
    expect(list[1].account?.id).toBe('a1');
  });
  it('sem fechamento/vencimento cadastrados, usa o vencimento da fatura em aberto do banco', () => {
    const movements = [{ type: 'CARTAO', status: 'PREVISTA', bank: 'Banco Inter', dueDate: '2026-11-15' }] as never[];
    const list = listPaymentInstitutions([], [], [bank('Banco Inter')], movements);
    expect(list[0].terms).toEqual({ closingDay: 8, dueDay: 15 });
  });

  it('o cadastro do banco tem prioridade sobre a fatura em aberto', () => {
    const b = { ...bank('Banco Inter'), closingDay: 3, dueDay: 10 } as BankInstitution;
    const movements = [{ type: 'CARTAO', status: 'PREVISTA', bank: 'Banco Inter', dueDate: '2026-11-15' }] as never[];
    expect(listPaymentInstitutions([], [], [b], movements)[0].terms).toEqual({ closingDay: 3, dueDay: 10 });
  });
});
