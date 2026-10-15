import { describe, expect, it } from 'vitest';
import { detectDoubt } from './forsetiAssistant';
import {
  type LearningReport, handledEverywhere, parseReport, pendingGroups, pendingSuggestions, phraseForTest, signalsOf, testCaseLine, testCaseSnippet,
  toggleHandled,
} from './forsetiLearningReview';

const row = {
  report_date: '2026-10-14',
  total_requests: 42,
  groups: [
    { phrase: 'quanto sobrou ate o fim do mes', total: 5, notUnderstood: 4, notUseful: 0, undone: 0, viaAi: 1 },
    { phrase: 'me ajuda com o pix <valor>', total: 2, notUnderstood: 0, notUseful: 1, undone: 1, viaAi: 0 },
  ],
  suggestions: [
    { phrase: 'quanto sobrou ate o fim do mes', intent: 'sobra', keywords: ['sobrou', 'fim do mes'], note: 'Quer saber a sobra prevista.' },
    { phrase: 'quero um relatorio do ano', intent: 'NOVA', keywords: ['relatorio'], note: 'Resumo anual.' },
  ],
  handled_phrases: ['me ajuda com o pix <valor>'],
};

describe('parseReport: nada vindo do banco é confiado como veio', () => {
  it('lê um relatório completo', () => {
    const r = parseReport(row)!;
    expect(r).toMatchObject({ date: '2026-10-14', totalRequests: 42, handled: ['me ajuda com o pix <valor>'] });
    expect(r.groups).toHaveLength(2);
    expect(r.suggestions[0].intent).toBe('SOBRA'); // intenção em maiúsculas
  });
  it.each([null, undefined, 'x', 42, {}, { report_date: 'ontem' }, { report_date: '2026-1-1' }])('descarta %j', (v) => expect(parseReport(v)).toBeNull());
  it('ignora grupos e sugestões malformados e corrige números ruins', () => {
    const r = parseReport({
      report_date: '2026-10-14',
      total_requests: -3,
      groups: [null, 'x', { phrase: '' }, { phrase: 'ok', total: 'muitos', notUnderstood: 2.7 }],
      suggestions: [{ phrase: 'a', intent: '' }, { phrase: 'b', intent: 'SALDO_HOJE', keywords: ['x', 3, null] }],
      handled_phrases: ['p', 5],
    })!;
    expect(r.totalRequests).toBe(0);
    expect(r.groups).toEqual([{ phrase: 'ok', total: 0, notUnderstood: 2, notUseful: 0, undone: 0, viaAi: 0 }]);
    expect(r.suggestions).toEqual([{ phrase: 'b', intent: 'SALDO_HOJE', keywords: ['x'], note: '' }]);
    expect(r.handled).toEqual(['p']);
  });
  it('relatório sem listas vira vazio', () => expect(parseReport({ report_date: '2026-10-14' })).toMatchObject({ groups: [], suggestions: [], handled: [] }));
});

describe('frases tratadas', () => {
  const a = parseReport(row)!;
  const b: LearningReport = { ...parseReport(row)!, date: '2026-10-13', handled: ['quanto sobrou ate o fim do mes'] };

  it('marcar uma vez vale para todos os dias', () => {
    const all = handledEverywhere([a, b]);
    expect(all.has('quanto sobrou ate o fim do mes')).toBe(true);
    expect(pendingSuggestions(a, all).map((s) => s.phrase)).toEqual(['quero um relatorio do ano']);
    expect(pendingGroups(a, all)).toEqual([]);
  });
  it('sem nada tratado, tudo está pendente', () => expect(pendingGroups({ ...a, handled: [] }, new Set())).toHaveLength(2));
  it('marca e desmarca sem repetir', () => {
    expect(toggleHandled([], 'x')).toEqual(['x']);
    expect(toggleHandled(['x', 'y'], 'x')).toEqual(['y']);
  });
  it('soma os sinais', () => expect(signalsOf(a.groups[0])).toBe(5));
});

describe('casos de teste', () => {
  it('a frase volta com exemplos no lugar dos marcadores', () => {
    expect(phraseForTest('paguei <valor> no mercado dia <n>')).toBe('paguei R$ 50 no mercado dia 10');
    expect(phraseForTest('abre <link>')).toBeNull();
    expect(phraseForTest('manda para <email>')).toBeNull();
  });

  it('intenção existente vira a linha do detectDoubt', () => {
    expect(testCaseLine({ phrase: 'quanto sobrou ate o fim do mes', intent: 'SOBRA', keywords: [], note: '' })).toBe("    ['quanto sobrou ate o fim do mes', 'SOBRA'],");
  });
  it('a linha gerada segue o formato dos testes (a frase é lida pelo detectDoubt)', () => {
    const line = testCaseLine({ phrase: 'qual meu saldo hoje', intent: 'SALDO_HOJE', keywords: [], note: '' })!;
    expect(line).toMatch(/^ {4}\['.*', '[A-Z_]+'\],$/);
    expect(detectDoubt('qual meu saldo hoje')).toBe('SALDO_HOJE');
  });
  it('escapa aspas e barras', () => {
    expect(testCaseLine({ phrase: "d'agua \\ luz", intent: 'VENCE', keywords: [], note: '' })).toBe("    ['d\\'agua \\\\ luz', 'VENCE'],");
  });
  it('intenção nova vira comentário com as palavras-chave', () => {
    expect(testCaseLine({ phrase: 'relatorio do ano', intent: 'NOVA', keywords: ['relatorio', 'ano'], note: 'Resumo anual.' })).toBe(
      "// NOVA intenção: 'relatorio do ano' · palavras-chave: relatorio, ano · Resumo anual."
    );
  });
  it('intenção que não existe ou frase com link não gera caso', () => {
    expect(testCaseLine({ phrase: 'oi', intent: 'INVENTADA', keywords: [], note: '' })).toBeNull();
    expect(testCaseLine({ phrase: 'abre <link>', intent: 'SOBRA', keywords: [], note: '' })).toBeNull();
  });
  it('junta os casos em linhas, pulando os que não servem', () => {
    const r = parseReport(row)!;
    const out = testCaseSnippet(r.suggestions);
    expect(out.split('\n')).toHaveLength(2);
    expect(out).toContain("['quanto sobrou ate o fim do mes', 'SOBRA'],");
    expect(testCaseSnippet([])).toBe('');
  });
});
