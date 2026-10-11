import { describe, expect, it } from 'vitest';
import { isForsetiIntent, parseRegistration, parseSpendQuery } from './forsetiIntents';

// A resposta da IA nunca é confiada como veio: só passa um registro bem formado.
describe('parseRegistration', () => {
  it('aceita um registro completo', () => {
    expect(parseRegistration({ kind: 'PAGAR', amount: 100, title: 'Pix para minha sogra', future: false, date: '2026-10-12' })).toEqual({
      kind: 'PAGAR', amount: 100, title: 'Pix para minha sogra', future: false, date: '2026-10-12',
    });
  });

  it('só exige tipo e valor; o resto assume o mais seguro', () => {
    expect(parseRegistration({ kind: 'RECEBER', amount: '1500.5' })).toEqual({ kind: 'RECEBER', amount: 1500.5, title: '', future: false });
  });

  it('arredonda o valor em centavos', () => expect(parseRegistration({ kind: 'PAGAR', amount: 10.999 })?.amount).toBe(11));

  it('tira números do título (o valor já está em amount)', () => {
    expect(parseRegistration({ kind: 'PAGAR', amount: 50, title: 'Parcela 3 da TV' })?.title).toBe('Parcela da TV');
  });

  it('corta títulos longos em 60 caracteres', () => {
    expect(parseRegistration({ kind: 'PAGAR', amount: 5, title: 'a'.repeat(200) })?.title).toHaveLength(60);
  });

  it.each([
    [null], [undefined], ['PAGAR'], [42], [[]],
    [{ amount: 10 }], // sem tipo
    [{ kind: 'TRANSFERIR', amount: 10 }], // tipo fora da lista
    [{ kind: 'PAGAR' }], // sem valor
    [{ kind: 'PAGAR', amount: 0 }],
    [{ kind: 'PAGAR', amount: -50 }],
    [{ kind: 'PAGAR', amount: 'muito' }],
    [{ kind: 'PAGAR', amount: Number.POSITIVE_INFINITY }],
    [{ kind: 'PAGAR', amount: 1e12 }], // acima do teto
  ])('rejeita %j', (value) => expect(parseRegistration(value)).toBeUndefined());

  it.each(['amanhã', '12/10/2026', '2026-13-45', '2026-10-1', 20261012])('ignora data inválida (%s) em vez de rejeitar o registro', (date) => {
    const r = parseRegistration({ kind: 'PAGAR', amount: 10, date });
    expect(r).toBeDefined();
    expect(r).not.toHaveProperty('date');
  });

  it('"future" só vale com true de verdade', () => {
    expect(parseRegistration({ kind: 'PAGAR', amount: 10, future: 'true' })?.future).toBe(false);
    expect(parseRegistration({ kind: 'PAGAR', amount: 10, future: true })?.future).toBe(true);
  });
});

describe('parseSpendQuery (pergunta de gastos com detalhe entendida pela IA)', () => {
  it('aceita assunto e período completos', () => {
    expect(parseSpendQuery({ subject: 'mercado', from: '2026-09-01', to: '2026-09-30' })).toEqual({ subject: 'mercado', from: '2026-09-01', to: '2026-09-30' });
  });
  it('assunto sozinho vale (o período é o mês atual)', () => expect(parseSpendQuery({ subject: 'uber' })).toEqual({ subject: 'uber' }));
  it('período sozinho vale (todos os gastos do período)', () => {
    expect(parseSpendQuery({ subject: '', from: '2026-09-01', to: '2026-09-30' })).toEqual({ subject: '', from: '2026-09-01', to: '2026-09-30' });
  });
  it('datas fora de ordem são colocadas em ordem', () => {
    expect(parseSpendQuery({ subject: 'x', from: '2026-09-30', to: '2026-09-01' })).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
  });
  it('uma data só não diz o período: é ignorada, não adivinhada', () => {
    expect(parseSpendQuery({ subject: 'mercado', from: '2026-09-01' })).toEqual({ subject: 'mercado' });
  });
  it.each(['setembro', '01/09/2026', '2026-13-45', 20260901])('data inválida (%s) é ignorada junto com o par', (bad) => {
    expect(parseSpendQuery({ subject: 'mercado', from: bad, to: '2026-09-30' })).toEqual({ subject: 'mercado' });
  });
  it('limpa espaços e corta o assunto em 40 caracteres', () => {
    expect(parseSpendQuery({ subject: '  mercado   do   bairro  ' })?.subject).toBe('mercado do bairro');
    expect(parseSpendQuery({ subject: 'a'.repeat(100) })?.subject).toHaveLength(40);
  });
  it.each([[null], [undefined], ['mercado'], [42]])('rejeita %j', (v) => expect(parseSpendQuery(v)).toBeUndefined());
  it('GASTOS_DETALHE está na lista fechada de intenções', () => expect(isForsetiIntent('GASTOS_DETALHE')).toBe(true));
});
