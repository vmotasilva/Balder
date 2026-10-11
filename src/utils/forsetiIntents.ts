/**
 * Intenções que a Forseti sabe responder com os dados do planejamento. A lista é fechada: a IA de linguagem
 * (api/forseti-intent) só escolhe uma delas para a frase; quem calcula e escreve a resposta é o Balder.
 */
export const FORSETI_INTENTS = [
  'SALDO_HOJE',
  'PROXIMO_RECEB',
  'SOBRA',
  'VENCE',
  'GASTEI',
  'CAIU',
  'RESERVA',
  'METAS',
  'COMPRA',
  'QUITAR',
  'COMO_FUNCIONA',
  'GLOSSARIO',
  'ULTIMAS',
  'GASTOS_PERIODO',
  'PREVISTO_REAL',
  'SEM_NATUREZA',
  'GASTOS_DETALHE',
] as const;

export type ForsetiIntent = (typeof FORSETI_INTENTS)[number];

export const SPEND_PERIODS = ['HOJE', 'SEMANA', 'QUINZENA', 'MES'] as const;
export type SpendPeriod = (typeof SPEND_PERIODS)[number];

export const isForsetiIntent = (v: unknown): v is ForsetiIntent => FORSETI_INTENTS.includes(v as ForsetiIntent);
export const isSpendPeriod = (v: unknown): v is SpendPeriod => SPEND_PERIODS.includes(v as SpendPeriod);

/** Trechos que identificam as respostas em que a Forseti não entendeu a frase (resposta padrão ou pergunta A/B/C). */
export const NOT_UNDERSTOOD_MARKERS = ['Não entendi bem', 'Toque na opção ou escreva de outro jeito'] as const;

/** Registro que a IA entendeu na frase ("cem reais de pix pra minha sogra"). Quem grava é o fluxo guiado, com confirmação. */
export interface ForsetiRegistration {
  kind: 'PAGAR' | 'RECEBER';
  amount: number;
  /** O que foi ou para quem (sem valor nem forma de pagamento), curto. */
  title: string;
  /** Ainda vai acontecer (agendado, "vou receber"). */
  future: boolean;
  /** AAAA-MM-DD, quando a frase diz o dia. */
  date?: string;
}

const MAX_REGISTRATION_AMOUNT = 10_000_000;

/** Aceita só um registro bem formado (a resposta da IA nunca é confiada como veio). */
export function parseRegistration(value: unknown): ForsetiRegistration | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const r = value as Record<string, unknown>;
  if (r.kind !== 'PAGAR' && r.kind !== 'RECEBER') return undefined;
  const amount = Number(r.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_REGISTRATION_AMOUNT) return undefined;
  // Sem números no título: o valor já está em "amount" e um número a mais seria lido como outro valor
  const title = typeof r.title === 'string' ? r.title.replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) : '';
  const date = typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && !Number.isNaN(Date.parse(r.date)) ? r.date : undefined;
  return { kind: r.kind, amount: Math.round(amount * 100) / 100, title, future: r.future === true, ...(date ? { date } : {}) };
}

/** Pergunta de gastos com detalhe entendida pela IA: o assunto e, se a frase disser, o período. Os números são calculados no app. */
export interface ForsetiSpendQuery {
  /** Só o assunto ("mercado", "uber"); vazio = todos os gastos. */
  subject: string;
  from?: string;
  to?: string;
}

/** Aceita só uma pergunta bem formada: período precisa vir completo (as duas datas, em ordem) ou é descartado. */
export function parseSpendQuery(value: unknown): ForsetiSpendQuery | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const r = value as Record<string, unknown>;
  const subject = typeof r.subject === 'string' ? r.subject.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  const iso = (x: unknown) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x)) ? x : undefined);
  const a = iso(r.from);
  const b = iso(r.to);
  // Uma data só não diz o período: melhor ignorar do que adivinhar
  const range = a && b ? (a <= b ? { from: a, to: b } : { from: b, to: a }) : {};
  return { subject, ...range };
}
