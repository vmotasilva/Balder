import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Endpoint /api/forseti-intent: login obrigatório, limite por pessoa e resposta guardada.
// O módulo guarda limite e cache na memória: cada teste carrega uma cópia nova.

let aiCalls = 0;
let aiIntent = 'SALDO_HOJE';
let aiRegistration: unknown;
let lastAiBody = '';

beforeEach(() => {
  aiCalls = 0;
  aiIntent = 'SALDO_HOJE';
  aiRegistration = undefined;
  lastAiBody = '';
  vi.resetModules();
  vi.stubEnv('ANTHROPIC_API_KEY', 'chave-de-teste');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { headers: Record<string, string>; body?: string }) => {
      if (String(url).includes('/auth/v1/user')) {
        const auth = init.headers.authorization;
        return auth === 'Bearer valido' ? Response.json({ id: 'u1' }) : auth === 'Bearer outro' ? Response.json({ id: 'u2' }) : new Response('{}', { status: 401 });
      }
      aiCalls += 1;
      lastAiBody = String(init.body);
      return Response.json({ content: [{ type: 'tool_use', input: { intent: aiIntent, registration: aiRegistration } }] });
    })
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const load = async () => (await import('../api/forseti-intent')).POST;
const call = (POST: Awaited<ReturnType<typeof load>>, body: unknown, auth?: string) =>
  POST(new Request('http://x/api/forseti-intent', { method: 'POST', headers: auth ? { authorization: auth } : {}, body: JSON.stringify(body) }));

describe('/api/forseti-intent', () => {
  it('sem chave da Anthropic responde 501 (a Forseti segue só com as regras)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect((await call(await load(), { text: 'qual meu saldo' }, 'Bearer valido')).status).toBe(501);
  });

  it.each([[undefined], ['Bearer invalido'], ['Basic abc']])('sem login válido (%s) responde 401 e não chama a IA', async (auth) => {
    const res = await call(await load(), { text: 'qual meu saldo agora' }, auth);
    expect(res.status).toBe(401);
    expect(aiCalls).toBe(0);
  });

  it('com login devolve só a intenção', async () => {
    const res = await call(await load(), { text: 'qual meu saldo agora' }, 'Bearer valido');
    expect(await res.json()).toEqual({ intent: 'SALDO_HOJE' });
  });

  it('corpo inválido responde 400; texto vazio vira DESCONHECIDO sem chamar a IA', async () => {
    const POST = await load();
    const bad = await POST(new Request('http://x', { method: 'POST', headers: { authorization: 'Bearer valido' }, body: 'não é json' }));
    expect(bad.status).toBe(400);
    expect(await (await call(POST, { text: '   ' }, 'Bearer valido')).json()).toEqual({ intent: 'DESCONHECIDO' });
    expect(aiCalls).toBe(0);
  });

  it('intenção fora da lista fechada vira DESCONHECIDO', async () => {
    aiIntent = 'APAGAR_TUDO';
    expect(await (await call(await load(), { text: 'faça algo estranho' }, 'Bearer valido')).json()).toEqual({ intent: 'DESCONHECIDO' });
  });

  it('guarda a resposta: a mesma frase (mesmo com outra pontuação ou maiúsculas) chama a IA uma vez só', async () => {
    const POST = await load();
    await call(POST, { text: 'qual meu saldo agora' }, 'Bearer valido');
    await call(POST, { text: 'Qual meu saldo agora?' }, 'Bearer valido');
    expect(aiCalls).toBe(1);
  });

  it('não guarda DESCONHECIDO (um "não sei" passageiro não pode ficar preso)', async () => {
    aiIntent = 'DESCONHECIDO';
    const POST = await load();
    await call(POST, { text: 'frase confusa aqui' }, 'Bearer valido');
    await call(POST, { text: 'frase confusa aqui' }, 'Bearer valido');
    expect(aiCalls).toBe(2);
  });

  it('o assunto anterior muda a resposta guardada (a mesma frase em outro contexto é outra pergunta)', async () => {
    const POST = await load();
    await call(POST, { text: 'e dessa semana', context: { intent: 'GASTOS_PERIODO', previous: 'gastos' } }, 'Bearer valido');
    await call(POST, { text: 'e dessa semana' }, 'Bearer valido');
    expect(aiCalls).toBe(2);
  });

  it('limita a 30 chamadas novas por hora por pessoa, sem punir outra pessoa nem as respostas guardadas', async () => {
    const POST = await load();
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) statuses.push((await call(POST, { text: `frase ${'a'.repeat(i + 1)}` }, 'Bearer valido')).status);
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
    expect(aiCalls).toBe(30);
    // resposta já guardada continua saindo, sem gastar a IA
    expect((await call(POST, { text: `frase ${'a'.repeat(1)}` }, 'Bearer valido')).status).toBe(200);
    // outra pessoa tem o próprio limite
    expect((await call(POST, { text: 'frase de outra pessoa' }, 'Bearer outro')).status).toBe(200);
  });

  describe('registro de gasto/recebimento entendido pela IA', () => {
    const PIX = { kind: 'PAGAR', amount: 100, title: 'Pix para minha sogra', future: false };

    it('devolve o registro quando a IA entende a frase como gasto ou recebimento', async () => {
      aiIntent = 'DESCONHECIDO';
      aiRegistration = PIX;
      const res = await call(await load(), { text: 'manda cem reais de pix pra minha sogra' }, 'Bearer valido');
      expect(await res.json()).toEqual({ intent: 'DESCONHECIDO', registration: PIX });
    });

    it('guarda a resposta com registro (a mesma frase não chama a IA de novo)', async () => {
      aiIntent = 'DESCONHECIDO';
      aiRegistration = PIX;
      const POST = await load();
      await call(POST, { text: 'manda cem reais de pix pra minha sogra' }, 'Bearer valido');
      const again = await call(POST, { text: 'manda cem reais de pix pra minha sogra' }, 'Bearer valido');
      expect(aiCalls).toBe(1);
      expect((await again.json()).registration).toEqual(PIX);
    });

    it('descarta registro malformado e o devolve como simples DESCONHECIDO', async () => {
      aiIntent = 'DESCONHECIDO';
      aiRegistration = { kind: 'APAGAR', amount: -5 };
      expect(await (await call(await load(), { text: 'faz algo com meu dinheiro' }, 'Bearer valido')).json()).toEqual({ intent: 'DESCONHECIDO' });
    });

    it('registro só vale com DESCONHECIDO: uma consulta nunca vira registro', async () => {
      aiIntent = 'SALDO_HOJE';
      aiRegistration = PIX;
      expect(await (await call(await load(), { text: 'qual meu saldo agora' }, 'Bearer valido')).json()).toEqual({ intent: 'SALDO_HOJE' });
    });

    it('manda "hoje" para a IA entender "amanhã" e "dia 12", e o título e valor ficam no contrato da ferramenta', async () => {
      aiIntent = 'DESCONHECIDO';
      await call(await load(), { text: 'agenda 200 de luz pra amanhã' }, 'Bearer valido');
      expect(lastAiBody).toMatch(/hoje: \d{4}-\d{2}-\d{2}/);
      expect(lastAiBody).toMatch(/registration/);
    });
  });
});

