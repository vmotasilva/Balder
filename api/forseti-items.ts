// Função do servidor (Vercel): sugere, para as linhas de um cupom, em qual item do mapeamento da pessoa cada uma entra.
// Recebe só nomes (linhas do cupom e itens do mapeamento), nunca valores; a IA escolhe entre os itens enviados, e a resposta
// é validada de novo aqui. Precisa da variável ANTHROPIC_API_KEY na Vercel; sem ela responde 501 e o app segue só com as regras.
// Exige o login do Supabase e o plano com a Forseti, e limita o uso por pessoa (na memória da instância, como forseti-intent).
import { requireFeature } from './_access.js';
import { MAX_ITEMS_PER_CALL, MAX_OPTIONS, cleanItemName, parseItemMatches } from '../src/utils/receiptItemSuggest.js';

const MODEL = 'claude-haiku-4-5-20251001';
const LIMIT_PER_HOUR = 20;
const calls = new Map<string, number[]>();

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

const SYSTEM = `Você ajuda um app de finanças pessoais em português do Brasil.
Recebe linhas de um cupom fiscal (nomes abreviados, em maiúsculas, com marca e peso) e a lista de itens que a pessoa já cadastrou,
cada um com id, nome, rotina e natureza. Para cada linha do cupom, escolha o id do item cadastrado que ela representa
(ex.: "ARROZ TIO JOAO 5KG" → o item "Arroz"). Só escolha quando tiver boa certeza de que é o mesmo produto ou claramente da mesma
família que a pessoa agrupou nesse item. Na dúvida, deixe option vazio: é melhor não sugerir do que sugerir errado.
Use apenas ids da lista. Nunca invente ids.`;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export async function POST(request: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'sem chave' }, { status: 501 });
  const access = await requireFeature(request, 'forsetiEnabled');
  if (access instanceof Response) return access;

  let names: string[] = [];
  let options: { id: string; label: string; routine: string; nature: string }[] = [];
  try {
    const body = await request.json();
    const rawNames: unknown[] = Array.isArray(body.items) ? body.items : [];
    names = rawNames.map((n) => cleanItemName(typeof n === 'string' ? n : '')).filter(Boolean).slice(0, MAX_ITEMS_PER_CALL);
    const rawOptions: unknown[] = Array.isArray(body.options) ? body.options : [];
    options = rawOptions
      .map((o) => {
        const r = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
        return { id: str(r.id, 80), label: str(r.label, 60), routine: str(r.routine, 60), nature: str(r.nature, 60) };
      })
      .filter((o) => o.id && o.label)
      .slice(0, MAX_OPTIONS);
  } catch {
    return Response.json({ error: 'corpo inválido' }, { status: 400 });
  }
  if (names.length === 0 || options.length === 0) return Response.json({ matches: [] });
  if (!withinLimit(access.userId)) return Response.json({ error: 'limite de uso' }, { status: 429 });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      tools: [
        {
          name: 'associar',
          description: 'Item cadastrado que cada linha do cupom representa',
          input_schema: {
            type: 'object',
            properties: {
              matches: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { index: { type: 'integer' }, option: { type: 'string' } },
                  required: ['index', 'option'],
                },
              },
            },
            required: ['matches'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'associar' },
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            linhas_do_cupom: names.map((name, index) => ({ index, name })),
            itens_cadastrados: options.map((o) => ({ id: o.id, nome: o.label, rotina: o.routine, natureza: o.nature })),
          }),
        },
      ],
    }),
  });
  if (!res.ok) return Response.json({ error: 'falha na IA' }, { status: 502 });

  const data = (await res.json()) as { content?: { type: string; input?: { matches?: unknown } }[] };
  const input = data.content?.find((c) => c.type === 'tool_use')?.input;
  const picked = parseItemMatches(input?.matches, names.length, new Set(options.map((o) => o.id)));
  return Response.json({ matches: names.map((name, i) => ({ name, option: picked[i] })) }, { headers: { 'Cache-Control': 'no-store' } });
}
