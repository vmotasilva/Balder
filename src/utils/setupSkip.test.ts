import { describe, expect, it } from 'vitest';
import { marksAfterBack, skippedTopicSummary, withSkipNote } from './setupSkip';

describe('withSkipNote', () => {
  it('sem perguntas puladas, o resumo não muda', () => expect(withSkipNote('Ponto de partida criado.', 0)).toBe('Ponto de partida criado.'));
  it('uma pergunta pulada', () =>
    expect(withSkipNote('Ponto de partida criado.', 1)).toBe('Ponto de partida criado. Pulei 1 pergunta e usei o padrão: dá para ajustar depois.'));
  it('várias perguntas puladas', () =>
    expect(withSkipNote('3 contas organizadas.', 3)).toBe('3 contas organizadas. Pulei 3 perguntas e usei os padrões: dá para ajustar depois.'));
});

describe('marksAfterBack: voltar desfaz o pulo da pergunta a que se volta', () => {
  const marks = [{ question: 'a', depth: 1 }, { question: 'b', depth: 2 }, { question: 'c', depth: 3 }];
  it('voltar para a pergunta 3 tira a marca dela', () => expect(marksAfterBack(marks, 3).map((m) => m.question)).toEqual(['a', 'b']));
  it('voltar para a pergunta 1 tira todas', () => expect(marksAfterBack(marks, 1)).toEqual([]));
  it('sem marcas, nada muda', () => expect(marksAfterBack([], 2)).toEqual([]));
});

describe('skippedTopicSummary', () => {
  it('diz que nada foi alterado', () =>
    expect(skippedTopicSummary('Cartões de crédito')).toBe('Pulei cartões de crédito: nada foi alterado, e dá para voltar a esse assunto quando quiser.'));
});
