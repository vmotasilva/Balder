import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Endpoint /api/forseti-items: login e plano, limite por pessoa, só nomes para a IA e resposta validada.

let aiCalls = 0;
let aiMatches: unknown;
let lastAiBody = '';
let subscriptionRows: unknown[] = [];

beforeEach(() => {
  aiCalls = 0;
  aiMatches = [];
  lastAiBody = '';
  subscriptionRows = [];
  vi.resetModules();
  vi.stubEnv('ANTHROPIC_API_KEY', 'chave-de-teste');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { headers: Record<string, string>; body?: string }) => {
      if (String(url).includes('/auth/v1/user')) {
        const auth = init.headers.authorization;
        return auth === 'Bearer valido' ? Response.json({ id: 'u1' }) : auth === 'Bearer outro' ? Response.json({ id: 'u2' }) : new Response('{}', { status: 401 });
      }
      if (String(url).includes('/rest/v1/user_subscriptions')) return Response.json(subscriptionRows);
      aiCalls += 1;
      lastAiBody = String(init.body);
      return Response.json({ content: [{ type: 'tool_use', input: { matches: aiMatches } }] });
    })
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const load = async () => (await import('../api/forseti-items')).POST;
const call = (POST: Awaited<ReturnType<typeof load>>, body: unknown, auth?: string) =>
  POST(new Request('http://x/api/forseti-items', { method: 'POST', headers: auth ? { authorization: auth } : {}, body: JSON.stringify(body) }));

const OPTIONS = [
  { id: 'item_arroz', label: 'Arroz', routine: 'Mercado', nature: 'Alimentação' },
  { id: 'item_leite', label: 'Leite', routine: 'Mercado', nature: 'Alimentação' },
];

describe('/api/forseti-items', () => {
  it('sem chave da Anthropic responde 501', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect((await call(await load(), { items: ['ARROZ'], options: OPTIONS }, 'Bearer valido')).status).toBe(501);
  });

  it.each([[undefined], ['Bearer invalido']])('sem login válido (%s) responde 401 e não chama a IA', async (auth) => {
    expect((await call(await load(), { items: ['ARROZ'], options: OPTIONS }, auth)).status).toBe(401);
    expect(aiCalls).toBe(0);
  });

  it('plano sem a Forseti responde 403', async () => {
    subscriptionRows = [{ status: 'TESTE', expires_at: null, subscription_plans: { name: 'Teste', forseti_enabled: false } }];
    expect((await call(await load(), { items: ['ARROZ'], options: OPTIONS }, 'Bearer valido')).status).toBe(403);
    expect(aiCalls).toBe(0);
  });

  it('sem linhas ou sem itens cadastrados, não chama a IA', async () => {
    const POST = await load();
    expect(await (await call(POST, { items: [], options: OPTIONS }, 'Bearer valido')).json()).toEqual({ matches: [] });
    expect(await (await call(POST, { items: ['ARROZ TIO JOAO'], options: [] }, 'Bearer valido')).json()).toEqual({ matches: [] });
    expect(aiCalls).toBe(0);
  });

  it('devolve o item escolhido para cada linha, com uma única chamada', async () => {
    aiMatches = [{ index: 0, option: 'item_arroz' }, { index: 1, option: '' }];
    const res = await call(await load(), { items: ['ARROZ TIO JOAO 5KG', 'SABAO EM PO OMO'], options: OPTIONS }, 'Bearer valido');
    expect(await res.json()).toEqual({
      matches: [{ name: 'ARROZ TIO JOAO 5KG', option: 'item_arroz' }, { name: 'SABAO EM PO OMO', option: null }],
    });
    expect(aiCalls).toBe(1);
  });

  it('descarta ids que a pessoa não tem', async () => {
    aiMatches = [{ index: 0, option: 'item_inventado' }];
    const body = await (await call(await load(), { items: ['ARROZ TIO JOAO'], options: OPTIONS }, 'Bearer valido')).json();
    expect(body.matches).toEqual([{ name: 'ARROZ TIO JOAO', option: null }]);
  });

  it('só manda nomes para a IA: valores e códigos de barras ficam de fora', async () => {
    await call(await load(), { items: ['7891234567890 ARROZ TIO JOAO R$ 29,90'], options: OPTIONS, price: 29.9, total: 100 }, 'Bearer valido');
    expect(lastAiBody).toContain('ARROZ TIO JOAO');
    expect(lastAiBody).not.toMatch(/7891234567890|29,90|29\.9|R\$|total|price/);
  });

  it('corpo inválido responde 400', async () => {
    const POST = await load();
    const res = await POST(new Request('http://x', { method: 'POST', headers: { authorization: 'Bearer valido' }, body: 'não é json' }));
    expect(res.status).toBe(400);
  });

  it('limita a 20 chamadas por hora por pessoa, sem punir outra pessoa', async () => {
    const POST = await load();
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await call(POST, { items: [`ARROZ MARCA ${'A'.repeat(i + 1)}`], options: OPTIONS }, 'Bearer valido')).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
    expect((await call(POST, { items: ['ARROZ OUTRA PESSOA'], options: OPTIONS }, 'Bearer outro')).status).toBe(200);
  });
});
