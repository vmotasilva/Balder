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
] as const;

export type ForsetiIntent = (typeof FORSETI_INTENTS)[number];

export const SPEND_PERIODS = ['HOJE', 'SEMANA', 'QUINZENA', 'MES'] as const;
export type SpendPeriod = (typeof SPEND_PERIODS)[number];

export const isForsetiIntent = (v: unknown): v is ForsetiIntent => FORSETI_INTENTS.includes(v as ForsetiIntent);
export const isSpendPeriod = (v: unknown): v is SpendPeriod => SPEND_PERIODS.includes(v as SpendPeriod);
