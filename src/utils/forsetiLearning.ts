import { NOT_UNDERSTOOD_MARKERS } from './forsetiIntents';

/** Evento de uma solicitação, como gravado em forseti_conversations. */
export interface ConversationRow {
  activity_id: string;
  kind: string;
  request: string;
  result: string;
  rating?: string | null;
  undone_at?: string | null;
  event_at?: string;
}

export interface PhraseGroup {
  phrase: string; // frase normalizada (sem números, acentos e maiúsculas)
  total: number;
  notUnderstood: number;
  notUseful: number;
  undone: number;
}

/** Frase sem acentos, em minúsculas, com números, links e e-mails trocados por marcadores: agrupa pedidos parecidos. */
export function normalizePhrase(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/https?:\/\/\S+|www\.\S+/g, '<link>')
    .replace(/\S+@\S+\.\S+/g, '<email>')
    .replace(/r\$\s*\d[\d.,]*/g, '<valor>')
    .replace(/\d+([.,/:-]\d+)*/g, '<n>')
    .replace(/[^a-z<>\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

const isNotUnderstood = (result: string) => NOT_UNDERSTOOD_MARKERS.some((m) => result.includes(m));

/** Fica com o evento mais recente de cada solicitação (avaliar ou desfazer entram como novos eventos). */
export function latestPerActivity(rows: ConversationRow[]): ConversationRow[] {
  const latest = new Map<string, ConversationRow>();
  rows.forEach((r) => {
    const prev = latest.get(r.activity_id);
    if (!prev || (r.event_at || '') >= (prev.event_at || '')) latest.set(r.activity_id, r);
  });
  return [...latest.values()];
}

/**
 * Agrupa as solicitações por frase e conta os sinais de que a Forseti atendeu mal:
 * não entendeu, resposta avaliada como não útil, ação desfeita. Devolve só os grupos com sinal, do mais frequente.
 */
export function buildPhraseGroups(rows: ConversationRow[], limit = 30): { total: number; groups: PhraseGroup[] } {
  const requests = latestPerActivity(rows).filter((r) => r.request?.trim());
  const groups = new Map<string, PhraseGroup>();
  requests.forEach((r) => {
    const phrase = normalizePhrase(r.request);
    if (!phrase) return;
    const g = groups.get(phrase) || { phrase, total: 0, notUnderstood: 0, notUseful: 0, undone: 0 };
    g.total += 1;
    if (isNotUnderstood(r.result || '')) g.notUnderstood += 1;
    if (r.rating === 'NAO_UTIL') g.notUseful += 1;
    if (r.undone_at) g.undone += 1;
    groups.set(phrase, g);
  });
  const weak = [...groups.values()]
    .filter((g) => g.notUnderstood + g.notUseful + g.undone > 0)
    .sort((a, b) => b.notUnderstood + b.notUseful + b.undone - (a.notUnderstood + a.notUseful + a.undone) || b.total - a.total);
  return { total: requests.length, groups: weak.slice(0, limit) };
}
