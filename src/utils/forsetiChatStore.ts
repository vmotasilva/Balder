import type { CopilotMessage } from '../types';
import type { ForsetiTopic } from './forsetiAssistant';
import { isSpendPeriod } from './forsetiIntents';

/**
 * Histórico da conversa com a Forseti, guardado neste aparelho para sobreviver a recarregar a página.
 * Fica 48 horas (como o histórico de solicitações) e nunca sai do aparelho. Só se guarda o que ainda faz sentido
 * depois de recarregar: o texto da conversa. O que depende de um passo em andamento (botões de confirmação,
 * registro em etapas) e as fotos não voltam; no lugar, a mensagem avisa que a etapa ficou em aberto.
 */

export const CHAT_TTL_HOURS = 48;
export const CHAT_MAX_MESSAGES = 60;
/** Teto do que se grava (caracteres): acima disso saem as mensagens mais antigas. */
const MAX_CHARS = 250_000;

const PREFIX = 'balder_forseti_chat_';

/** Uma chave por pessoa e por planejamento aberto: a conversa de um planejamento não aparece em outro. */
export const chatStorageKey = (userId: string, planOwnerId?: string) => `${PREFIX}${userId}_${planOwnerId || 'proprio'}`;

/** Mensagem como fica guardada: a hora real (`at`) no lugar do "Agora". */
export type StoredMessage = Omit<CopilotMessage, 'timestamp'> & { at: number; interrupted?: boolean };

export interface StoredChat {
  savedAt: number;
  messages: StoredMessage[];
  /** Assunto da última resposta: "e no mês passado?" continua dele (vale 15 min, como na conversa). */
  topic?: ForsetiTopic;
}

const OPEN_STEP_NOTE = '\n\n_Esta etapa ficou em aberto quando a página foi recarregada. Se ainda quiser, é só me pedir de novo._';

/** "14:05" se foi hoje; "10/10 14:05" nos outros dias. */
export function chatTimeLabel(at: number, now: number = Date.now()): string {
  const d = new Date(at);
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const n = new Date(now);
  const sameDay = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  return sameDay ? t : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${t}`;
}

/** A mensagem tinha algo que só funciona com o passo em andamento (confirmação pendente, cupom ainda não conciliado)? */
const hadOpenStep = (m: CopilotMessage) =>
  !!m.pendingConfirmation || !!m.pendingAction || (!!m.receiptReconciliation && !m.receiptReconciliation.isReconciled);

/**
 * Prepara a conversa para guardar. `seen` guarda a hora em que cada mensagem apareceu (o "Agora" da tela não diz
 * a hora): mensagens novas ganham a hora de agora e as já vistas mantêm a sua.
 */
export function serializeChat(messages: CopilotMessage[], seen: Record<string, number>, now: number = Date.now(), topic?: ForsetiTopic | null): StoredChat {
  const stored = messages.slice(-CHAT_MAX_MESSAGES).map((m): StoredMessage => {
    if (seen[m.id] === undefined) seen[m.id] = now;
    // Fora o que só funciona com o passo em andamento e as fotos (blob do navegador, não valem depois de recarregar)
    const base: Partial<CopilotMessage> = { ...m };
    (['timestamp', 'pendingConfirmation', 'pendingAction', 'attachmentUrl', 'attachments'] as const).forEach((k) => delete base[k]);
    // Cupom já conciliado fica como resumo; o que ainda esperava confirmação sai
    if (!m.receiptReconciliation?.isReconciled) delete base.receiptReconciliation;
    const hadPhotos = !!m.attachmentUrl || (m.attachments?.length || 0) > 0 || !!m.isEphemeralPurged;
    return {
      ...(base as Omit<CopilotMessage, 'timestamp'>),
      ...(hadPhotos ? { isEphemeralPurged: true } : {}),
      ...(hadOpenStep(m) ? { interrupted: true } : {}),
      at: seen[m.id],
    };
  });
  // Cabe no teto: sai o mais antigo primeiro
  let out = stored;
  while (out.length > 1 && JSON.stringify(out).length > MAX_CHARS) out = out.slice(1);
  return { savedAt: now, messages: out, ...(topic ? { topic } : {}) };
}

const isStr = (v: unknown): v is string => typeof v === 'string';

/** Assunto guardado, só se vier bem formado (o que vem do disco nunca é confiado como veio). */
function parseTopic(v: unknown): ForsetiTopic | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const t = v as Record<string, unknown>;
  if (!isStr(t.intent) || !isStr(t.text) || typeof t.at !== 'number') return undefined;
  const q = t.query as Record<string, unknown> | undefined;
  const r = q?.range as Record<string, unknown> | undefined;
  const query = q && isStr(q.subject) && r && isStr(r.from) && isStr(r.to) && isStr(r.label)
    ? { subject: q.subject, ...(isStr(q.shown) ? { shown: q.shown } : {}), range: { from: r.from, to: r.to, label: r.label } }
    : undefined;
  return { intent: t.intent as ForsetiTopic['intent'], text: t.text, at: t.at, ...(isSpendPeriod(t.period) ? { period: t.period } : {}), ...(query ? { query } : {}) };
}

const isRole = (v: unknown): v is CopilotMessage['role'] => v === 'user' || v === 'assistant';

/**
 * Lê o que está guardado (texto do disco: nunca confiado como veio). Devolve null se não há conversa válida ou
 * se passou do prazo. Mensagens malformadas são ignoradas; as boas voltam com a hora real.
 */
export function restoreChat(raw: string | null, now: number = Date.now()): { messages: CopilotMessage[]; seen: Record<string, number>; topic?: ForsetiTopic } | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const chat = data as Partial<StoredChat> | null;
  if (!chat || typeof chat.savedAt !== 'number' || !Array.isArray(chat.messages)) return null;
  if (now - chat.savedAt > CHAT_TTL_HOURS * 3600_000) return null;

  const seen: Record<string, number> = {};
  const messages: CopilotMessage[] = [];
  chat.messages.forEach((m) => {
    if (!m || typeof m !== 'object' || typeof m.id !== 'string' || typeof m.content !== 'string' || !isRole(m.role) || typeof m.at !== 'number') return;
    const { at, interrupted, ...rest } = m;
    seen[m.id] = at;
    messages.push({
      ...(rest as Omit<CopilotMessage, 'timestamp'>),
      content: interrupted ? `${m.content}${OPEN_STEP_NOTE}` : m.content,
      timestamp: chatTimeLabel(at, now),
    });
  });
  const topic = parseTopic(chat.topic);
  return messages.length > 0 ? { messages, seen, ...(topic ? { topic } : {}) } : null;
}

export const readChat = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeChat = (key: string, chat: StoredChat) => {
  try {
    localStorage.setItem(key, JSON.stringify(chat));
  } catch {
    // sem armazenamento (modo privado, cheio): a conversa vale só nesta sessão
  }
};

export const removeChat = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // sem armazenamento
  }
};

/** Apaga todas as conversas guardadas (ao sair da conta, para não ficarem no aparelho). */
export const clearAllChats = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // sem armazenamento
  }
};
