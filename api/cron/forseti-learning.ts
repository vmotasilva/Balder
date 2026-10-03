// Rotina diária (Vercel Cron, ver vercel.json): estuda as solicitações das últimas 24 horas e grava um relatório
// com o que a Forseti atendeu mal, para melhorar as regras. Não altera nada sozinha: só gera o relatório.
//
// Variáveis na Vercel:
//   CRON_SECRET                 (a Vercel envia no cabeçalho Authorization das chamadas agendadas)
//   SUPABASE_URL ou VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   ANTHROPIC_API_KEY           (opcional: acrescenta sugestões de regra ao relatório)
import { buildPhraseGroups, type ConversationRow, type PhraseGroup } from '../../src/utils/forsetiLearning.js';
import { FORSETI_INTENTS } from '../../src/utils/forsetiIntents.js';

const MODEL = 'claude-haiku-4-5-20251001';

interface Suggestion {
  phrase: string;
  intent: string; // uma intenção existente ou NOVA
  keywords: string[];
  note: string;
}

async function suggestRules(groups: PhraseGroup[], key: string): Promise<Suggestion[]> {
  if (groups.length === 0) return [];
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: `Você ajuda a melhorar uma assistente de finanças pessoais em português do Brasil.
Recebe frases (já sem números e acentos) que a assistente não entendeu ou respondeu mal.
Para cada uma, diga qual das intenções existentes deveria atendê-la (${FORSETI_INTENTS.join(', ')}) ou NOVA se nenhuma serve,
e liste palavras-chave curtas que a identificam. Em "note", explique em uma frase o que a pessoa quer.`,
      tools: [
        {
          name: 'sugerir',
          description: 'Sugestões de regra por frase',
          input_schema: {
            type: 'object',
            properties: {
              suggestions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    phrase: { type: 'string' },
                    intent: { type: 'string' },
                    keywords: { type: 'array', items: { type: 'string' } },
                    note: { type: 'string' },
                  },
                  required: ['phrase', 'intent', 'keywords', 'note'],
                },
              },
            },
            required: ['suggestions'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'sugerir' },
      messages: [{ role: 'user', content: JSON.stringify(groups.slice(0, 15).map((g) => g.phrase)) }],
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { content?: { type: string; input?: { suggestions?: Suggestion[] } }[] };
  return data.content?.find((c) => c.type === 'tool_use')?.input?.suggestions ?? [];
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'não autorizado' }, { status: 401 });
  }
  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey) return Response.json({ error: 'Supabase não configurado' }, { status: 501 });

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const select = 'activity_id,kind,request,result,rating,undone_at,event_at';
  const res = await fetch(
    `${base}/rest/v1/forseti_conversations?select=${select}&event_at=gte.${encodeURIComponent(since)}&limit=5000`,
    { headers }
  );
  if (!res.ok) return Response.json({ error: 'falha ao ler as conversas' }, { status: 502 });
  const rows = (await res.json()) as ConversationRow[];

  const { total, groups } = buildPhraseGroups(rows);
  const key = process.env.ANTHROPIC_API_KEY;
  const suggestions = key ? await suggestRules(groups, key).catch(() => []) : [];

  const report = {
    report_date: new Date().toISOString().slice(0, 10),
    total_requests: total,
    groups,
    suggestions,
  };
  const save = await fetch(`${base}/rest/v1/forseti_learning_reports?on_conflict=report_date`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(report),
  });
  return Response.json({ ...report, saved: save.ok }, { headers: { 'Cache-Control': 'no-store' } });
}
