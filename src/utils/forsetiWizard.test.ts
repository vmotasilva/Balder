import { describe, expect, it } from 'vitest';
import type { BankAccount, BankInstitution, CreditCardItem } from '../types';
import { CASH_IN_HAND } from './cashInHand';
import { paymentOptions, OPTION_OTHER_PAYMENT, OPTION_REGISTER_CARD } from './forsetiAssistant';
import { wizardForPaymentOption } from './forsetiWizard';
import { listPaymentInstitutions } from './paymentInstitutions';

const accounts = [{ id: 'a1', name: 'Nubank', bankName: 'Nubank', type: 'CORRENTE', balance: 1000, color: '#820ad1', icon: '🏦' }] as unknown as BankAccount[];
const cards = [{ id: 'c1', name: 'Itaú Visa', bank: 'Itaú', brand: 'VISA', limitTotal: 5000, closingDay: 3, dueDay: 10, color: '#ff7a00' }] as unknown as CreditCardItem[];
const banks = [] as BankInstitution[];
const institutions = listPaymentInstitutions(accounts, cards, banks);
const options = paymentOptions(accounts, cards, 'Moradia');
const optionOf = (id: string) => options.find((o) => o.id === id)!;

// Um agendamento não é gravado só pelo toque numa forma de pagamento: antes aparece o resumo "Confira o agendamento".
describe('wizardForPaymentOption: opção de pagamento tocada → passo "resumo"', () => {
  it('dinheiro em mãos', () => {
    expect(wizardForPaymentOption(optionOf('opt_pay_cash'), institutions)).toEqual({ step: 'SUMMARY', where: 'CASH', installments: 1 });
  });

  it('cartão: crédito, no nome que o resumo usa para achar o cartão', () => {
    const w = wizardForPaymentOption(optionOf('opt_pay_card_c1'), institutions)!;
    expect(w).toMatchObject({ step: 'SUMMARY', where: 'BANK', method: 'CREDITO', installments: 1 });
    expect(institutions.some((i) => i.name === w.institution && i.card)).toBe(true);
  });

  it('cartão parcelado leva o número de parcelas; nunca menos que 1', () => {
    expect(wizardForPaymentOption(optionOf('opt_pay_card_c1'), institutions, 6)!.installments).toBe(6);
    expect(wizardForPaymentOption(optionOf('opt_pay_card_c1'), institutions, 0)!.installments).toBe(1);
  });

  it('conta / Pix: débito, sempre à vista', () => {
    const w = wizardForPaymentOption(optionOf('opt_pay_a1'), institutions, 6)!;
    expect(w).toMatchObject({ step: 'SUMMARY', where: 'BANK', method: 'DEBITO', installments: 1 });
    expect(institutions.some((i) => i.name === w.institution && i.account)).toBe(true);
  });

  it('cartão recém-cadastrado (a opção tem outro identificador) é achado pelo nome do banco, sem acento nem maiúscula', () => {
    const fresh = paymentOptions([], [{ ...cards[0], id: 'novo_123', bank: 'ITAU' }], 'Moradia').find((o) => o.payload.type === 'CARTAO')!;
    expect(fresh.id).toBe('opt_pay_card_novo_123');
    const w = wizardForPaymentOption(fresh, institutions)!;
    expect(w.method).toBe('CREDITO');
    expect(institutions.some((i) => i.name === w.institution && i.card)).toBe(true);
  });

  it('sem conta cadastrada: "Conta bancária" genérica vira débito nela', () => {
    const geral = paymentOptions([], [], 'Moradia').find((o) => o.id === 'opt_pay_geral')!;
    expect(wizardForPaymentOption(geral, [])).toMatchObject({ step: 'SUMMARY', method: 'DEBITO', institution: 'Geral' });
  });

  it('toda opção da lista real vira um resumo (nenhuma forma de pagamento fica sem passar por ele)', () => {
    const all = paymentOptions(accounts, cards, 'Moradia');
    expect(all.length).toBeGreaterThanOrEqual(3);
    all.forEach((o) => expect(wizardForPaymentOption(o, institutions), o.id).toMatchObject({ step: 'SUMMARY' }));
  });

  it.each([
    ['opt_pay_other', { action: OPTION_OTHER_PAYMENT }], // "outra forma de pagamento" tem o próprio caminho
    ['opt_card_new', { action: OPTION_REGISTER_CARD, cardName: 'Renner' }], // cadastrar cartão também
    ['opt_wizard', { bank: 'Nubank', type: 'PAGAR' }], // o "Confirmar" do resumo grava, não volta ao resumo
    ['opt_wizard_card', { bank: 'Itaú', type: 'CARTAO' }],
    ['opt_rec_a1', { bank: 'Nubank', type: 'RECEBER' }], // recebimento não usa esta lista
  ])('não é forma de pagamento da lista: %s', (id, payload) => {
    expect(wizardForPaymentOption({ id, payload } as never, institutions)).toBeUndefined();
  });

  it('o dinheiro em mãos não depende do nome da instituição', () => {
    expect(wizardForPaymentOption({ id: 'opt_pay_cash', payload: { bank: CASH_IN_HAND, type: 'PAGAR' } } as never, [])!.where).toBe('CASH');
  });
});
