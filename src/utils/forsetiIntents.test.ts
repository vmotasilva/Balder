import { describe, expect, it } from 'vitest';
import { parseRegistration } from './forsetiIntents';

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
