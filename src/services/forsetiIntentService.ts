import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  isForsetiIntent, isSpendPeriod, parseRegistration, parseSpendQuery, type ForsetiIntent, type ForsetiRegistration, type ForsetiSpendQuery,
  type SpendPeriod,
} from '../utils/forsetiIntents';
import { type MemoryDraft, parseMemory } from '../utils/forsetiMemory';

/** O que a IA entendeu: uma consulta (intent) ou um registro de gasto/recebimento (registration), nunca os dois. */
export interface ClassifiedIntent {
  intent?: ForsetiIntent;
  period?: SpendPeriod;
  registration?: ForsetiRegistration;
  /** Algo duradouro que a pessoa contou sobre si (a Forseti pergunta se pode lembrar). */
  memory?: MemoryDraft;
  /** Assunto e período de uma pergunta de gastos com detalhe (intent GASTOS_DETALHE). */
  spend?: ForsetiSpendQuery;
}

/**
 * Pede à IA (api/forseti-intent) a intenção, ou o registro de gasto/recebimento, de uma frase que as regras não entenderam.
 * Só o texto da mensagem sai do aparelho. Exige login (visitante usa só as regras).
 * Devolve null sem chave configurada, sem login, offline, lento ou sem intenção.
 */
export interface IntentContext {
  /** Assunto da resposta anterior (intenção e período) e a frase que o originou. */
  intent?: string;
  period?: string;
  previous?: string;
}

export async function classifyIntent(text: string, context?: IntentContext): Promise<ClassifiedIntent | null> {
  if (!isSupabaseConfigured) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return null;
    const res = await fetch('/api/forseti-intent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ text, context }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { intent?: string; period?: string; registration?: unknown; memory?: unknown; spend?: unknown };
    if (isForsetiIntent(data.intent)) {
      return { intent: data.intent, period: isSpendPeriod(data.period) ? data.period : undefined, ...(data.intent === 'GASTOS_DETALHE' ? { spend: parseSpendQuery(data.spend) } : {}) };
    }
    // A resposta é validada de novo aqui: o que vem da rede nunca é confiado como veio
    const registration = parseRegistration(data.registration);
    if (registration) return { registration };
    const memory = parseMemory(data.memory);
    return memory ? { memory } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
