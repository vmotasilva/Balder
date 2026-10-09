import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isForsetiIntent, isSpendPeriod, type ForsetiIntent, type SpendPeriod } from '../utils/forsetiIntents';

export interface ClassifiedIntent {
  intent: ForsetiIntent;
  period?: SpendPeriod;
}

/**
 * Pede à IA (api/forseti-intent) a intenção de uma frase que as regras não entenderam.
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
    const data = (await res.json()) as { intent?: string; period?: string };
    if (!isForsetiIntent(data.intent)) return null;
    return { intent: data.intent, period: isSpendPeriod(data.period) ? data.period : undefined };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
