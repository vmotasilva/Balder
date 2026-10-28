import { stripAccents } from './forsetiMoney';
import { normalizePhrase } from './forsetiLearning';

/**
 * Memória da Forseti: o que a pessoa pediu para ela lembrar (preferências, restrições, contexto, prioridades).
 * Só entra depois do "Confirmar" no chat, nunca guarda valores nem documentos e é sempre da pessoa, não do planejamento.
 */

export const MEMORY_KINDS = ['PREFERENCIA', 'RESTRICAO', 'CONTEXTO', 'PRIORIDADE'] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const MEMORY_KIND_LABEL: Record<MemoryKind, string> = {
  PREFERENCIA: 'Preferência',
  RESTRICAO: 'Restrição',
  CONTEXTO: 'Contexto',
  PRIORIDADE: 'Prioridade',
};

export const MEMORY_LIMIT = 30;
export const MEMORY_TITLE_MAX = 60;
export const MEMORY_BODY_MAX = 200;

/** O que a pessoa pediu para lembrar, ainda sem id (antes de gravar). */
export interface MemoryDraft {
  kind: MemoryKind;
  title: string;
  body: string;
}

export interface ForsetiMemory extends MemoryDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export const isMemoryKind = (v: unknown): v is MemoryKind => MEMORY_KINDS.includes(v as MemoryKind);

/** Dado que não pode virar memória: valor em reais, número longo (CPF, conta, cartão), e-mail ou link. */
const SENSITIVE = [
  /r\$\s*\d/i,
  /\b\d{1,3}(\.\d{3})+(,\d{1,2})?\b/, // 1.500 · 1.500,00
  /\d+,\d{2}\b/, // 30,50
  /\d{5,}/, // CPF, conta, cartão, telefone sem pontuação
  /\d{3}\.\d{3}\.\d{3}-\d{2}/, // CPF pontuado
  /\S+@\S+\.\S+/,
  /https?:\/\/|www\./i,
  /\b(reais|real|mil|k)\b.*\d|\d.*\b(reais|mil)\b/i, // "5 mil", "200 reais"
];

export const isSensitiveText = (text: string) => SENSITIVE.some((re) => re.test(text));

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Aceita só uma memória bem formada e sem dado sensível (a resposta da IA nunca é confiada como veio). */
export function parseMemory(value: unknown): MemoryDraft | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const r = value as Record<string, unknown>;
  if (!isMemoryKind(r.kind)) return undefined;
  const body = clean(r.body, MEMORY_BODY_MAX);
  if (body.length < 3) return undefined;
  const title = clean(r.title, MEMORY_TITLE_MAX) || titleFromBody(body);
  if (isSensitiveText(`${title} ${body}`)) return undefined;
  return { kind: r.kind, title, body };
}

/** Título curto a partir do texto: primeira frase, cortada em uma palavra inteira. */
export function titleFromBody(body: string): string {
  const first = body.split(/[.;!?]/)[0].trim();
  if (first.length <= MEMORY_TITLE_MAX) return first.charAt(0).toUpperCase() + first.slice(1);
  const cut = first.slice(0, MEMORY_TITLE_MAX - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 20 ? cut.lastIndexOf(' ') : cut.length)}…`;
}

const sameText = (a: string, b: string) => normalizePhrase(a) === normalizePhrase(b);

/** Já existe uma memória com o mesmo texto? (evita guardar a mesma coisa duas vezes) */
export const findDuplicateMemory = (list: ForsetiMemory[], draft: Pick<MemoryDraft, 'body'>) =>
  list.find((m) => sameText(m.body, draft.body));

// ── Captação por regras (sem IA): frases em que a pessoa pede para lembrar ou conta uma preferência ──────────

const REMEMBER = /^(?:por favor[, ]+)?(?:forseti[, ]+)?(?:lembra|lembre|lembrar|anota|anote|guarda|guarde|memoriza|memorize)(?: isso)?(?: que|:)?\s+(.{3,})$/;
const AVOID = /^(?:eu\s+)?(evito|nao gosto de|nao quero|nunca|nao costumo|detesto|odeio)\s+(.{3,})$/;
const PREFER = /^(?:eu\s+)?(prefiro|gosto de|costumo|sempre)\s+(.{3,})$/;
const PRIORITY = /^(?:(?:a\s+)?minha prioridade(?: agora| no momento)?\s*(?:e|eh|:)|minha meta principal\s*(?:e|eh|:)|meu foco(?: principal)?(?: esse ano| este ano| agora| no momento)?\s*(?:e|eh|:)|(?:eu\s+)?(?:quero|preciso)\s+priorizar)\s*(.{3,})$/;

/** Frase em que a pessoa conta algo duradouro sobre si. Devolve null se não é isso, é pergunta ou traz dado sensível. */
export function detectMemoryStatement(text: string): MemoryDraft | null {
  const original = text.replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '');
  if (original.length < 8 || original.includes('?')) return null;
  const t = stripAccents(original);
  // O texto guardado mantém as palavras da pessoa (com acento): só o começo é reconhecido pela versão sem acento,
  // e o trecho final reconhecido é recortado do original pela mesma posição
  const tail = (m: RegExpMatchArray) => original.slice(original.length - m[m.length - 1].length);

  let kind: MemoryKind | null = null;
  let body = original;
  let m: RegExpMatchArray | null;

  if ((m = t.match(PRIORITY))) {
    kind = 'PRIORIDADE';
    body = tail(m);
  } else if ((m = t.match(REMEMBER))) {
    body = tail(m);
    kind = detectMemoryStatement(body)?.kind ?? 'CONTEXTO';
  } else if (AVOID.test(t)) {
    kind = 'RESTRICAO';
  } else if (PREFER.test(t)) {
    kind = 'PREFERENCIA';
  }
  if (!kind) return null;

  body = body.charAt(0).toUpperCase() + body.slice(1);
  return parseMemory({ kind, title: titleFromBody(body), body }) ?? null;
}

// ── Uso da memória nas respostas ─────────────────────────────────────────────────────────────────────────

export type MemoryTopic = 'COMPRA' | 'QUITAR';

const TOPIC_WORDS: Record<MemoryTopic, RegExp> = {
  COMPRA: /parcel|financi|cartao|credito|a vista|compra|divida|juros|consorcio|emprestimo/,
  QUITAR: /divida|emprestimo|quit|juros|invest|reserva|parcela|financi|prioridade/,
};

/** Memórias que falam do assunto da pergunta (por palavras-chave), as mais recentes primeiro. */
export function relevantMemories(list: ForsetiMemory[], topic: MemoryTopic, max = 2): ForsetiMemory[] {
  return [...list]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter((m) => TOPIC_WORDS[topic].test(stripAccents(`${m.title} ${m.body}`)))
    .slice(0, max);
}

/** Linha para acrescentar a uma resposta calculada ("Você me disse que…"), ou vazio se nada se aplica. */
export function memoryNote(list: ForsetiMemory[] | undefined, topic: MemoryTopic): string {
  const found = list ? relevantMemories(list, topic) : [];
  if (found.length === 0) return '';
  return `\n\n🧠 **Lembrando do que você me contou:** ${found.map((m) => `*${m.body}*`).join(' · ')}`;
}

const dayOfYear = (d: Date) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);

/** Frase de foco do dia: uma prioridade (ou restrição) da pessoa, trocando de um dia para o outro. */
export function focusFromMemories(list: ForsetiMemory[] | undefined, today: Date): string | null {
  const pool = (list ?? []).filter((m) => m.kind === 'PRIORIDADE');
  const fallback = (list ?? []).filter((m) => m.kind === 'RESTRICAO');
  const source = pool.length > 0 ? pool : fallback;
  if (source.length === 0) return null;
  const ordered = [...source].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const picked = ordered[dayOfYear(today) % ordered.length];
  return pool.length > 0 ? `Seu foco: ${picked.body}` : `Lembrete seu: ${picked.body}`;
}

/** Texto da resposta "o que você sabe sobre mim". */
export function memoriesText(list: ForsetiMemory[] | undefined): string {
  if (!list || list.length === 0) {
    return 'Ainda não guardei nada sobre você. 🧠\n\nPara eu lembrar de algo, é só dizer, por exemplo: *"lembra que eu evito parcelar"* ou *"minha prioridade é quitar o empréstimo"*. Eu sempre peço a sua confirmação antes de guardar.';
  }
  const lines = list.map((m) => `• **${MEMORY_KIND_LABEL[m.kind]}:** ${m.body}`);
  return `🧠 Isto é o que você me pediu para lembrar:\n\n${lines.join('\n')}\n\nVocê edita ou apaga tudo no botão 🧠 do Início. Nunca guardo valores nem dados de conta.`;
}
