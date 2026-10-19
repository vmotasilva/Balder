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
});
