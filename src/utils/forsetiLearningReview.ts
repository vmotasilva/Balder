import { FORSETI_INTENTS } from './forsetiIntents';

/**
 * Revisão do relatório diário de aprendizado da Forseti (gerado por api/cron/forseti-learning): lê o que veio do banco
 * com cuidado, esconde o que já foi tratado e transforma cada sugestão num caso de teste para forsetiEvalCases.ts.
 */

export interface ReviewGroup {
  phrase: string;
  total: number;
  notUnderstood: number;
  notUseful: number;
  undone: number;
  viaAi: number;
}

export interface ReviewSuggestion {
  phrase: string;
  /** Uma intenção existente ou NOVA. */
  intent: string;
  keywords: string[];
  note: string;
}

export interface LearningReport {
  date: string;
  totalRequests: number;
  groups: ReviewGroup[];
  suggestions: ReviewSuggestion[];
  /** Frases que o gestor já tratou. */
  handled: string[];
}

export const NEW_INTENT = 'NOVA';

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** Lê uma linha de forseti_learning_reports; devolve null se não for um relatório (nada vindo do banco é confiado como veio). */
export function parseReport(row: unknown): LearningReport | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (typeof r.report_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.report_date)) return null;
  const groups: ReviewGroup[] = (Array.isArray(r.groups) ? r.groups : []).flatMap((g): ReviewGroup[] => {
    if (!g || typeof g !== 'object') return [];
    const x = g as Record<string, unknown>;
    const phrase = text(x.phrase, 120).trim();
    return phrase
      ? [{ phrase, total: count(x.total), notUnderstood: count(x.notUnderstood), notUseful: count(x.notUseful), undone: count(x.undone), viaAi: count(x.viaAi) }]
      : [];
  });
  const suggestions: ReviewSuggestion[] = (Array.isArray(r.suggestions) ? r.suggestions : []).flatMap((s): ReviewSuggestion[] => {
    if (!s || typeof s !== 'object') return [];
    const x = s as Record<string, unknown>;
    const phrase = text(x.phrase, 120).trim();
    const intent = text(x.intent, 40).trim().toUpperCase();
    if (!phrase || !intent) return [];
    const keywords = (Array.isArray(x.keywords) ? x.keywords : []).filter((k): k is string => typeof k === 'string').map((k) => k.slice(0, 40)).slice(0, 12);
    return [{ phrase, intent, keywords, note: text(x.note, 300) }];
  });
  const handled = (Array.isArray(r.handled_phrases) ? r.handled_phrases : []).filter((p): p is string => typeof p === 'string');
  return { date: r.report_date, totalRequests: count(r.total_requests), groups, suggestions, handled };
}

/** Todas as frases já tratadas em qualquer relatório: marcar uma vez vale para os outros dias. */
export const handledEverywhere = (reports: LearningReport[]): Set<string> => new Set(reports.flatMap((r) => r.handled));

/** Frases de um relatório que ainda esperam revisão. */
export const pendingGroups = (report: LearningReport, handled: Set<string>) => report.groups.filter((g) => !handled.has(g.phrase));
export const pendingSuggestions = (report: LearningReport, handled: Set<string>) => report.suggestions.filter((s) => !handled.has(s.phrase));

/** Total de sinais de que a Forseti atendeu mal a frase. */
export const signalsOf = (g: ReviewGroup) => g.notUnderstood + g.notUseful + g.undone + g.viaAi;

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** A frase do relatório vem sem números: volta com exemplos para o teste. Null se tinha link ou e-mail (não dá para exemplificar). */
export function phraseForTest(phrase: string): string | null {
  if (/<link>|<email>/.test(phrase)) return null;
  return phrase.replace(/<valor>/g, 'R$ 50').replace(/<n>/g, '10');
}

/**
 * Linha para REPORT_CASES em src/utils/forsetiEvalCases.ts (`['frase', 'INTENCAO'],`), ou um comentário
 * quando a sugestão é uma intenção NOVA, que ainda precisa ser criada. Null se a sugestão não serve de teste.
 */
export function testCaseLine(s: ReviewSuggestion): string | null {
  const phrase = phraseForTest(s.phrase);
  if (!phrase) return null;
  if (s.intent === NEW_INTENT) {
    return `// NOVA intenção: ${quote(phrase)}${s.keywords.length > 0 ? ` · palavras-chave: ${s.keywords.join(', ')}` : ''}${s.note ? ` · ${s.note.replace(/\s+/g, ' ')}` : ''}`;
  }
  if (!(FORSETI_INTENTS as readonly string[]).includes(s.intent)) return null;
  return `    [${quote(phrase)}, '${s.intent}'],`;
}

/** Todos os casos pendentes de um relatório, um por linha, prontos para colar. Vazio se não há nenhum. */
export function testCaseSnippet(suggestions: ReviewSuggestion[]): string {
  return suggestions.map(testCaseLine).filter((l): l is string => !!l).join('\n');
}

/** Lista de frases tratadas depois de marcar ou desmarcar uma, sem repetir. */
export function toggleHandled(handled: string[], phrase: string): string[] {
  return handled.includes(phrase) ? handled.filter((p) => p !== phrase) : [...handled, phrase];
}
