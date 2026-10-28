import { describe, expect, it } from 'vitest';
import {
  type ForsetiMemory, detectMemoryStatement, findDuplicateMemory, focusFromMemories, isSensitiveText, memoriesText, memoryNote, parseMemory,
  titleFromBody,
} from './forsetiMemory';

const mem = (over: Partial<ForsetiMemory>): ForsetiMemory => ({
  id: over.body || 'm', kind: 'CONTEXTO', title: 'T', body: 'Algo', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', ...over,
});

describe('isSensitiveText: o que nunca vira memória', () => {
  it.each([
    'ganho R$ 5000 por mês', 'salário de 5.000', 'pago 1.500,00 de aluguel', 'a conta é 12345-6', 'meu cpf 123.456.789-09',
    'escreve para a@b.com', 'veja https://site.com', 'quero juntar 50 mil', 'gasto 30,50 por dia',
  ])('sensível: %s', (t) => expect(isSensitiveText(t)).toBe(true));

  it.each(['evito parcelar compras', 'quero quitar o empréstimo até 2027', 'divido o aluguel com a esposa', 'pago em 3 parcelas'])(
    'normal: %s',
    (t) => expect(isSensitiveText(t)).toBe(false)
  );
});

describe('parseMemory: aceita só memória bem formada', () => {
  it('aceita e limpa os textos', () => {
    expect(parseMemory({ kind: 'RESTRICAO', title: '  Evita   parcelar ', body: 'Evita parcelar compras' })).toEqual({
      kind: 'RESTRICAO', title: 'Evita parcelar', body: 'Evita parcelar compras',
    });
  });
  it('cria o título quando falta', () => {
    expect(parseMemory({ kind: 'CONTEXTO', body: 'Divide o aluguel com a esposa' })?.title).toBe('Divide o aluguel com a esposa');
  });
  it.each([
    null, 'texto', {}, { kind: 'OUTRO', body: 'algo aqui' }, { kind: 'CONTEXTO', body: 'ab' }, { kind: 'CONTEXTO', body: 'ganho R$ 3000' },
    { kind: 'CONTEXTO', body: 'meu email é a@b.com' },
  ])('rejeita %j', (v) => expect(parseMemory(v)).toBeUndefined());
  it('corta o que passa do limite', () => {
    const r = parseMemory({ kind: 'CONTEXTO', body: 'a'.repeat(500) });
    expect(r?.body.length).toBe(200);
    expect(r?.title.length).toBeLessThanOrEqual(60);
  });
});

describe('titleFromBody', () => {
  it('usa a primeira frase', () => expect(titleFromBody('evito parcelar. Prefiro à vista')).toBe('Evito parcelar'));
  it('corta em palavra inteira com reticências', () => {
    const t = titleFromBody('palavra '.repeat(20));
    expect(t.endsWith('…')).toBe(true);
    expect(t.length).toBeLessThanOrEqual(60);
  });
});

describe('detectMemoryStatement: frases em que a pessoa conta algo sobre si', () => {
  it.each<[string, string, string]>([
    ['evito parcelar compras', 'RESTRICAO', 'Evito parcelar compras'],
    ['eu odeio parcelar compras', 'RESTRICAO', 'Eu odeio parcelar compras'],
    ['eu não gosto de dívida no cartão', 'RESTRICAO', 'Eu não gosto de dívida no cartão'],
    ['prefiro pagar à vista', 'PREFERENCIA', 'Prefiro pagar à vista'],
    ['lembra que eu divido o aluguel com a esposa', 'CONTEXTO', 'Eu divido o aluguel com a esposa'],
    ['lembra que eu evito parcelar', 'RESTRICAO', 'Eu evito parcelar'],
    ['por favor, anota que minha filha começa a faculdade em 2027', 'CONTEXTO', 'Minha filha começa a faculdade em 2027'],
    ['minha prioridade é quitar o empréstimo', 'PRIORIDADE', 'Quitar o empréstimo'],
    ['minha prioridade agora: montar a reserva de emergência.', 'PRIORIDADE', 'Montar a reserva de emergência'],
    ['quero priorizar a viagem de dezembro', 'PRIORIDADE', 'A viagem de dezembro'],
    ['meu foco esse ano é quitar o empréstimo antes de investir', 'PRIORIDADE', 'Quitar o empréstimo antes de investir'],
    ['meu foco agora: montar a reserva', 'PRIORIDADE', 'Montar a reserva'],
  ])('%s → %s', (text, kind, body) => {
    const r = detectMemoryStatement(text);
    expect(r?.kind).toBe(kind);
    expect(r?.body).toBe(body);
  });

  it.each([
    'quanto gastei este mês?', 'paguei 50 na farmácia', 'bom dia', 'prefiro?', 'lembra que ganho R$ 5000', 'evito', 'lembra que meu cpf é 123.456.789-09',
    'meu foco é quitar o empréstimo, quanto falta?', 'odeio?',
  ])('não é memória: %s', (text) => expect(detectMemoryStatement(text)).toBeNull());
});

describe('uso da memória', () => {
  const list = [
    mem({ kind: 'RESTRICAO', body: 'Evito parcelar compras', updatedAt: '2025-03-01T00:00:00Z' }),
    mem({ kind: 'CONTEXTO', body: 'Divido o aluguel com a esposa', updatedAt: '2025-02-01T00:00:00Z' }),
    mem({ kind: 'PRIORIDADE', body: 'Quitar o empréstimo antes de investir', createdAt: '2025-01-01T00:00:00Z' }),
  ];

  it('acrescenta o que se aplica à compra', () => {
    const note = memoryNote(list, 'COMPRA');
    expect(note).toContain('Evito parcelar compras');
    expect(note).not.toContain('aluguel');
  });
  it('acrescenta o que se aplica à quitação', () => expect(memoryNote(list, 'QUITAR')).toContain('Quitar o empréstimo'));
  it('sem memória relevante, não acrescenta nada', () => {
    expect(memoryNote([], 'COMPRA')).toBe('');
    expect(memoryNote(undefined, 'QUITAR')).toBe('');
    expect(memoryNote([mem({ body: 'Moro em Salvador' })], 'COMPRA')).toBe('');
  });

  it('foco do dia usa prioridades; sem elas, restrições; sem nada, null', () => {
    expect(focusFromMemories(list, new Date(2025, 5, 1))).toBe('Seu foco: Quitar o empréstimo antes de investir');
    expect(focusFromMemories([list[0]], new Date(2025, 5, 1))).toBe('Lembrete seu: Evito parcelar compras');
    expect(focusFromMemories([list[1]], new Date(2025, 5, 1))).toBeNull();
    expect(focusFromMemories(undefined, new Date())).toBeNull();
  });
  it('o foco troca de um dia para o outro quando há mais de uma prioridade', () => {
    const two = [mem({ kind: 'PRIORIDADE', body: 'A', createdAt: '2025-01-01T00:00:00Z' }), mem({ kind: 'PRIORIDADE', body: 'B', createdAt: '2025-01-02T00:00:00Z' })];
    expect(focusFromMemories(two, new Date(2025, 5, 1))).not.toBe(focusFromMemories(two, new Date(2025, 5, 2)));
  });

  it('acha duplicada pelo texto', () => {
    expect(findDuplicateMemory(list, { body: 'evito  parcelar compras!' })).toBeDefined();
    expect(findDuplicateMemory(list, { body: 'Outra coisa' })).toBeUndefined();
  });

  it('lista na conversa', () => {
    expect(memoriesText([])).toContain('Ainda não guardei nada');
    expect(memoriesText(list)).toContain('**Restrição:** Evito parcelar compras');
  });
});
