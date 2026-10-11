import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  isForsetiIntent, isSpendPeriod, parseRegistration, type ForsetiIntent, type ForsetiRegistration, type SpendPeriod,
} from '../utils/forsetiIntents';

/** O que a IA entendeu: uma consulta (intent) ou um registro de gasto/recebimento (registration), nunca os dois. */
export interface ClassifiedIntent {
  intent?: ForsetiIntent;
  period?: SpendPeriod;
  registration?: ForsetiRegistration;
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
    const data = (await res.json()) as { intent?: string; period?: string; registration?: unknown };
    if (isForsetiIntent(data.intent)) return { intent: data.intent, period: isSpendPeriod(data.period) ? data.period : undefined };
    // A resposta é validada de novo aqui: o que vem da rede nunca é confiado como veio
    const registration = parseRegistration(data.registration);
    return registration ? { registration } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
