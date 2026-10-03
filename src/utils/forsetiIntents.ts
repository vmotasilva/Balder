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
] as const;

export type ForsetiIntent = (typeof FORSETI_INTENTS)[number];

export const SPEND_PERIODS = ['HOJE', 'SEMANA', 'QUINZENA', 'MES'] as const;
export type SpendPeriod = (typeof SPEND_PERIODS)[number];

export const isForsetiIntent = (v: unknown): v is ForsetiIntent => FORSETI_INTENTS.includes(v as ForsetiIntent);
export const isSpendPeriod = (v: unknown): v is SpendPeriod => SPEND_PERIODS.includes(v as SpendPeriod);

/** Trechos que identificam as respostas em que a Forseti não entendeu a frase (resposta padrão ou pergunta A/B/C). */
export const NOT_UNDERSTOOD_MARKERS = ['Não entendi bem', 'Toque na opção ou escreva de outro jeito'] as const;
