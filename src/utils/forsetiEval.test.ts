import { describe, expect, it } from 'vitest';
import { detectDoubt } from './forsetiAssistant';
import { DOUBT_CASES, KNOWN_GAPS, REPORT_CASES } from './forsetiEvalCases';

describe('avaliação das regras: detectDoubt', () => {
  it.each([...DOUBT_CASES.map((c) => [c.text, c.expected] as const), ...REPORT_CASES])('%s → %s', (text, expected) => expect(detectDoubt(text)).toBe(expected));

  it('não repete frase no conjunto', () => {
    const texts = [...DOUBT_CASES.map((c) => c.text), ...REPORT_CASES.map(([t]) => t), ...KNOWN_GAPS.map((c) => c.text)];
    expect(texts.filter((t, i) => texts.indexOf(t) !== i)).toEqual([]);
  });
});

describe.skipIf(KNOWN_GAPS.length === 0)('avaliação das regras: lacunas conhecidas (devem seguir erradas até alguém corrigir)', () => {
  it.each(KNOWN_GAPS.map((c) => [c.text, c.expected] as const))('%s → %s', (text, expected) => {
    // Se isto falhar, a regra passou a acertar: mova a frase de KNOWN_GAPS para DOUBT_CASES
    expect(detectDoubt(text)).not.toBe(expected);
  });
});
