// Função do servidor (Vercel): entende a frase da pessoa e devolve só a INTENÇÃO (uma da lista fechada).
// Não recebe nem devolve dados financeiros: a resposta com números é montada no aplicativo.
// Precisa da variável ANTHROPIC_API_KEY na Vercel; sem ela responde 501 e a Forseti segue só com as regras.
// Exige o login do Supabase (cabeçalho Authorization), limita o uso por pessoa e guarda respostas repetidas.
// Limite e cache ficam na memória da instância: bastam para barrar abuso, sem criar tabela.
import { planAllows, userIdFrom } from './_access.js';
import { normalizePhrase } from '../src/utils/forsetiLearning.js';
import { isForsetiIntent, isSpendPeriod } from '../src/utils/forsetiIntents.js';
import { classify, type IntentAnswer } from './_forsetiIntentAi.js';

const LIMIT_PER_HOUR = 30;
const CACHE_MAX = 500;
const calls = new Map<string, number[]>();
const cache = new Map<string, IntentAnswer>();

/** Hoje no Brasil (AAAA-MM-DD): a IA precisa dele para entender "amanhã" e "dia 12". */
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/** Quantas chamadas novas ainda cabem na última hora (não gasta nenhuma: as respostas guardadas também informam o saldo). */
const remainingFor = (userId: string) => {
  const since = Date.now() - 3600_000;
  return Math.max(0, LIMIT_PER_HOUR - (calls.get(userId) || []).filter((t) => t > since).length);
};

/** Cabeçalhos que dizem ao aplicativo quanto resta do limite por hora (para avisar a pessoa antes de acabar). */
const quotaHeaders = (userId: string): Record<string, string> => ({
  'X-Forseti-Ai-Limit': String(LIMIT_PER_HOUR),
  'X-Forseti-Ai-Remaining': String(remainingFor(userId)),
});

/** Registra a chamada e diz se ainda cabe no limite da última hora. */
function withinLimit(userId: string): boolean {
  const since = Date.now() - 3600_000;
  const recent = (calls.get(userId) || []).filter((t) => t > since);
  if (recent.length >= LIMIT_PER_HOUR) {
    calls.set(userId, recent);
    return false;
  }
  recent.push(Date.now());
  calls.set(userId, recent);
  return true;
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'sem chave' }, { status: 501 });
  const userId = await userIdFrom(request);
  if (!userId) return Response.json({ error: 'não autorizado' }, { status: 401 });
  if (!(await planAllows(request, userId, 'forsetiEnabled'))) return Response.json({ error: 'plano sem Forseti' }, { status: 403 });

  let text = '';
  let context = '';
  try {
    const body = await request.json();
    text = String(body.text || '').slice(0, 300).trim();
    const c = body.context;
    // Só o assunto anterior (intenção, período e a frase que o originou): nenhum dado financeiro
    if (c && typeof c === 'object' && isForsetiIntent(c.intent)) {
      context = JSON.stringify({ intent: c.intent, period: isSpendPeriod(c.period) ? c.period : undefined, previous: String(c.previous || '').slice(0, 200) });
    }
  } catch {
    return Response.json({ error: 'corpo inválido' }, { status: 400 });
  }
  if (!text) return Response.json({ intent: 'DESCONHECIDO' }, { headers: quotaHeaders(userId) });

  // A data entra na chave: "amanhã" guardado ontem apontaria para o dia errado
  const day = today();
  const cacheKey = `${day}|${context}|${normalizePhrase(text)}`;
  const cached = cache.get(cacheKey);
  if (cached) return Response.json(cached, { headers: { 'Cache-Control': 'no-store', ...quotaHeaders(userId) } });
  if (!withinLimit(userId)) return Response.json({ error: 'limite de uso' }, { status: 429, headers: quotaHeaders(userId) });

  const result = await classify({ key, text, context, day });
  if (!result.ok) return Response.json({ error: 'falha na IA' }, { status: 502 });
  const answer = result.answer;
  // Só guarda respostas com algo útil: um erro ou um "não sei" passageiro não pode ficar preso
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  if (answer.intent !== 'DESCONHECIDO' || answer.registration || answer.memory) cache.set(cacheKey, answer);
  return Response.json(answer, { headers: { 'Cache-Control': 'no-store', ...quotaHeaders(userId) } });
}
