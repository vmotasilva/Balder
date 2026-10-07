import type { ForsetiIntent, SpendPeriod } from './forsetiIntents';

/**
 * Exemplos de frases reais (já normalizadas: sem números, acentos e maiúsculas) e a intenção correta.
 * São acrescentados ao prompt de api/forseti-intent para a IA classificar melhor frases parecidas.
 * Este arquivo é atualizado toda semana pelo PR automático (scripts/forseti-weekly-improve.ts):
 * revise o PR antes de aprovar.
 */
export interface ForsetiExample {
  phrase: string;
  intent: ForsetiIntent | 'DESCONHECIDO';
  period?: SpendPeriod;
}

export const FORSETI_EXAMPLES: ForsetiExample[] = [];

/** Quantos exemplos o prompt carrega no máximo (os mais recentes ficam no fim da lista). */
export const MAX_FORSETI_EXAMPLES = 60;
