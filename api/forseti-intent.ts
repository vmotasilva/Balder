// Função do servidor (Vercel): entende a frase da pessoa e devolve só a INTENÇÃO (uma da lista fechada).
// Não recebe nem devolve dados financeiros: a resposta com números é montada no aplicativo.
// Precisa da variável ANTHROPIC_API_KEY na Vercel; sem ela responde 501 e a Forseti segue só com as regras.
// Exige o login do Supabase (cabeçalho Authorization), limita o uso por pessoa e guarda respostas repetidas.
// Limite e cache ficam na memória da instância: bastam para barrar abuso, sem criar tabela.
import { normalizePhrase } from '../src/utils/forsetiLearning.js';
import { FORSETI_INTENTS, SPEND_PERIODS, type ForsetiRegistration, type ForsetiSpendQuery, isForsetiIntent, isSpendPeriod, parseRegistration, parseSpendQuery } from '../src/utils/forsetiIntents.js';

const MODEL = 'claude-haiku-4-5-20251001';

// Mesmos valores (públicos) usados pelo aplicativo em src/lib/supabase.ts
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zlwghcqisnejjqugsxvp.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_dTZJs1GDyT9jOIc3JA3yRQ_0q3NpIzY';

const LIMIT_PER_HOUR = 30;
const CACHE_MAX = 500;
const calls = new Map<string, number[]>();
const cache = new Map<string, { intent: string; period?: string; registration?: ForsetiRegistration; spend?: ForsetiSpendQuery }>();

/** Hoje no Brasil (AAAA-MM-DD): a IA precisa dele para entender "amanhã" e "dia 12". */
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/** Confere o login no Supabase e devolve o id da pessoa (null se o token não vale). */
async function userIdFrom(request: Request): Promise<string | null> {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, authorization: auth } });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return user.id || null;
  } catch {
    return null;
  }
}

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

const SYSTEM = `Você classifica mensagens de um app de finanças pessoais em português do Brasil.
Escolha a intenção que melhor representa o que a pessoa quer VER ou SABER. Intenções:
- SALDO_HOJE: saldo atual / quanto tem agora
- PROXIMO_RECEB: quando entra o próximo dinheiro/salário
- SOBRA: quanto ainda pode gastar / o que vai sobrar
- VENCE: contas a vencer, atrasadas, próximos vencimentos
- GASTEI: quanto já gastou no mês
- CAIU: por que o saldo previsto está baixo/caiu
- RESERVA: reserva de emergência
- METAS: metas financeiras
- COMPRA: se dá para comprar/financiar algo
- QUITAR: quitar ou antecipar empréstimo/parcelas
- COMO_FUNCIONA: o que a assistente faz / ajuda
- GLOSSARIO: significado de um termo (natureza, mapeamento, competência...)
- ULTIMAS: últimas compras/gastos/saídas feitas
- GASTOS_PERIODO: gastos de um período (informe period: HOJE, SEMANA, QUINZENA ou MES)
- GASTOS_DETALHE: gastos com um assunto específico (natureza, loja, pessoa, produto) e/ou de um período específico (mês pelo nome,
  mês passado, semana passada, últimos N dias, ano). Preencha "spend": subject = só o assunto, sem datas (vazio se for o total);
  from e to = AAAA-MM-DD do período, quando a frase disser (use "hoje" do contexto); sem período, omita from e to.
- PREVISTO_REAL: o que estava previsto e não foi registrado/pago, ou foi pago a menos que o previsto
- SEM_NATUREZA: o que há dentro de "Outros" / gastos sem natureza
- DESCONHECIDO: qualquer outra coisa ou conversa fora do tema.
REGISTRO: quando a pessoa CONTA um gasto, pagamento, transferência/Pix ou recebimento com valor (não pergunta), responda intent DESCONHECIDO e
preencha "registration":
- kind: PAGAR (saiu dinheiro: gasto, compra, conta paga, Pix/transferência para alguém) ou RECEBER (entrou dinheiro; "me pagou", "me mandou" também).
- amount: valor em reais como número ("cem reais" → 100, "1,5 mil" → 1500, "R$ 30" → 30).
- title: o que foi ou para quem, curto e sem valor nem forma de pagamento ("Mercado", "Pix para minha sogra", "Freela"). Vazio se não disser.
- future: true se ainda vai acontecer (agendado, "vou pagar", "vou receber"); false se já aconteceu.
- date: AAAA-MM-DD só se a frase disser o dia (use "hoje" do contexto para "amanhã", "dia 12"…).
Pergunta ("quanto gastei…?") nunca é registro. Sem valor na frase, não é registro.
Se vier "contexto" (assunto da resposta anterior), frases curtas ou incompletas, SEM assunto próprio, continuam esse assunto
(ex.: contexto GASTOS_PERIODO e a frase "me mostre os dessa semana" → GASTOS_PERIODO com period SEMANA).
Se a frase trouxer um assunto novo (salário, metas, fatura, empréstimo, registrar algo…), IGNORE o contexto e classifique só a frase.
Na dúvida entre continuar e mudar de assunto, responda DESCONHECIDO: é melhor perguntar do que adivinhar.
Nunca responda à pessoa; apenas classifique.`;

export async function POST(request: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'sem chave' }, { status: 501 });
  const userId = await userIdFrom(request);
  if (!userId) return Response.json({ error: 'não autorizado' }, { status: 401 });

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
  if (!text) return Response.json({ intent: 'DESCONHECIDO' });

  // A data entra na chave: "amanhã" guardado ontem apontaria para o dia errado
  const day = today();
  const cacheKey = `${day}|${context}|${normalizePhrase(text)}`;
  const cached = cache.get(cacheKey);
  if (cached) return Response.json(cached, { headers: { 'Cache-Control': 'no-store' } });
  if (!withinLimit(userId)) return Response.json({ error: 'limite de uso' }, { status: 429 });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 250,
      system: SYSTEM,
      tools: [
        {
          name: 'classificar',
          description: 'Registra a intenção da mensagem',
          input_schema: {
            type: 'object',
            properties: {
              intent: { type: 'string', enum: [...FORSETI_INTENTS, 'DESCONHECIDO'] },
              period: { type: 'string', enum: [...SPEND_PERIODS] },
              spend: {
                type: 'object',
                properties: { subject: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } },
                required: ['subject'],
              },
              registration: {
                type: 'object',
                properties: {
                  kind: { type: 'string', enum: ['PAGAR', 'RECEBER'] },
                  amount: { type: 'number' },
                  title: { type: 'string' },
                  future: { type: 'boolean' },
                  date: { type: 'string' },
                },
                required: ['kind', 'amount'],
              },
            },
            required: ['intent'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'classificar' },
      messages: [{ role: 'user', content: `hoje: ${day}\n${context ? `contexto: ${context}\n` : ''}frase: ${text}` }],
    }),
  });
  if (!res.ok) return Response.json({ error: 'falha na IA' }, { status: 502 });

  const data = (await res.json()) as { content?: { type: string; input?: { intent?: string; period?: string; registration?: unknown; spend?: unknown } }[] };
  const input = data.content?.find((c) => c.type === 'tool_use')?.input;
  const intent = isForsetiIntent(input?.intent) ? input!.intent : 'DESCONHECIDO';
  const period = isSpendPeriod(input?.period) ? input!.period : undefined;
  // Registro só vale com "DESCONHECIDO": uma frase não é consulta e registro ao mesmo tempo
  const registration = intent === 'DESCONHECIDO' ? parseRegistration(input?.registration) : undefined;
  const spend = intent === 'GASTOS_DETALHE' ? parseSpendQuery(input?.spend) : undefined;
  const answer = { intent, period, ...(registration ? { registration } : {}), ...(spend ? { spend } : {}) };
  // Só guarda respostas com algo útil: um erro ou um "não sei" passageiro não pode ficar preso
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  if (intent !== 'DESCONHECIDO' || registration) cache.set(cacheKey, answer);
  return Response.json(answer, { headers: { 'Cache-Control': 'no-store' } });
}
