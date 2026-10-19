import { describe, expect, it } from 'vitest';
import { presetPaymentWizard, registrationKind, shorthandRegistration } from './forsetiAssistant';
import type { PaymentInstitution } from './paymentInstitutions';

const inst = (name: string, terms?: { closingDay: number; dueDay: number }, noCredit = false): PaymentInstitution => ({ name, color: '#000', terms, noCredit });
const list = [inst('Nubank S.A.', { closingDay: 28, dueDay: 5 }), inst('Banco Inter'), inst('Caixa Econômica', undefined, true)];

describe('presetPaymentWizard', () => {
  it('cartão + banco com fatura conhecida vai direto ao resumo', () => {
    expect(presetPaymentWizard('no cartão de crédito Nubank 59,36', list)).toMatchObject({ step: 'SUMMARY', where: 'BANK', institution: 'Nubank S.A.', method: 'CREDITO' });
  });

  it('cartão + banco sem fechamento e vencimento pergunta só a fatura', () => {
    expect(presetPaymentWizard('cartão de crédito inter', list)).toMatchObject({ step: 'INVOICE', institution: 'Banco Inter', method: 'CREDITO' });
  });

  it('cartão sem banco pergunta só o banco (já como crédito)', () => {
    expect(presetPaymentWizard('no cartão de crédito', list)).toMatchObject({ step: 'BANK', method: 'CREDITO' });
  });

  it('só o banco pergunta débito ou crédito', () => {
    expect(presetPaymentWizard('paguei no Nubank', list)).toMatchObject({ step: 'METHOD', institution: 'Nubank S.A.' });
  });

  it('dinheiro e pix vão ao resumo', () => {
    expect(presetPaymentWizard('em dinheiro', list)).toMatchObject({ step: 'SUMMARY', where: 'CASH' });
    expect(presetPaymentWizard('pix do nubank', list)).toMatchObject({ step: 'SUMMARY', method: 'DEBITO', institution: 'Nubank S.A.' });
  });

  it('sem nada dito não define ponto de partida', () => {
    expect(presetPaymentWizard('mercado', list)).toBeNull();
  });
});

describe('shorthandRegistration com forma de pagamento', () => {
  it('"59,36 refeição cartão de crédito nubank" já é um registro', () => {
    expect(registrationKind('59,36 refeição cartão de crédito nubank')).toBeNull();
    expect(shorthandRegistration('59,36 refeição cartão de crédito nubank')).toBe('PAGAR');
  });

  it('só "cartão 3000" ou "cartão nubank 3000" seguem como dúvida', () => {
    expect(shorthandRegistration('cartão 3000')).toBeNull();
    expect(shorthandRegistration('cartão nubank 3000')).toBeNull();
  });
});

describe('titleFrom com a forma de pagamento no fim', () => {
  it('tira "cartão de crédito nubank" do título', async () => {
    const { titleFrom } = await import('./forsetiAssistant');
    expect(titleFrom('59,36 refeição cartão de crédito nubank')).toBe('Refeição');
    expect(titleFrom('120 mercado no cartão inter')).toBe('Mercado');
  });
});
