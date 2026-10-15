import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Endpoint /api/forseti-intent: login obrigatório, limite por pessoa e resposta guardada.
// O módulo guarda limite e cache na memória: cada teste carrega uma cópia nova.

let aiCalls = 0;
let aiIntent = 'SALDO_HOJE';
let aiRegistration: unknown;
let aiSpend: unknown;
let aiMemory: unknown;
let lastAiBody = '';
// Linha de user_subscriptions devolvida pelo Supabase (vazio = sem assinatura cadastrada = liberado)
let subscriptionRows: unknown[] = [];

beforeEach(() => {
  aiCalls = 0;
  aiIntent = 'SALDO_HOJE';
  aiRegistration = undefined;
  aiSpend = undefined;
  aiMemory = undefined;
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
      return Response.json({ content: [{ type: 'tool_use', input: { intent: aiIntent, registration: aiRegistration, memory: aiMemory, spend: aiSpend } }] });
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

  it.each([
    ['plano sem a Forseti', { status: 'TESTE', expires_at: null, subscription_plans: { name: 'Teste', forseti_enabled: false } }],
    ['assinatura suspensa', { status: 'SUSPENSA', expires_at: null, subscription_plans: { name: 'Pro', forseti_enabled: true } }],
    ['assinatura vencida', { status: 'ATIVA', expires_at: '2020-01-01T00:00:00Z', subscription_plans: { name: 'Pro', forseti_enabled: true } }],
  ])('%s responde 403 e não chama a IA', async (_nome, row) => {
    subscriptionRows = [row];
    const res = await call(await load(), { text: 'qual meu saldo agora' }, 'Bearer valido');
    expect(res.status).toBe(403);
    expect(aiCalls).toBe(0);
  });

  it('plano com a Forseti liberada responde normalmente', async () => {
    subscriptionRows = [{ status: 'ATIVA', expires_at: null, subscription_plans: { name: 'Pro', forseti_enabled: true } }];
    expect((await call(await load(), { text: 'qual meu saldo agora' }, 'Bearer valido')).status).toBe(200);
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

  describe('saldo do limite por hora', () => {
    const remaining = (res: Response) => res.headers.get('X-Forseti-Ai-Remaining');

    it('informa o limite e quanto resta em cada resposta', async () => {
      const POST = await load();
      const first = await call(POST, { text: 'frase nova numero um' }, 'Bearer valido');
      expect(first.headers.get('X-Forseti-Ai-Limit')).toBe('30');
      expect(remaining(first)).toBe('29');
      expect(remaining(await call(POST, { text: 'frase nova numero dois' }, 'Bearer valido'))).toBe('28');
    });

    it('resposta guardada informa o saldo sem gastar', async () => {
      const POST = await load();
      await call(POST, { text: 'frase repetida de novo' }, 'Bearer valido');
      expect(remaining(await call(POST, { text: 'frase repetida de novo' }, 'Bearer valido'))).toBe('29');
    });

    it('no 429 o saldo é zero', async () => {
      const POST = await load();
      let last: Response | undefined;
      for (let i = 0; i < 31; i++) last = await call(POST, { text: `frase ${'b'.repeat(i + 1)}` }, 'Bearer valido');
      expect(last!.status).toBe(429);
      expect(remaining(last!)).toBe('0');
    });

    it('cada pessoa tem o seu saldo', async () => {
      const POST = await load();
      await call(POST, { text: 'frase de uma pessoa aqui' }, 'Bearer valido');
      expect(remaining(await call(POST, { text: 'frase de outra pessoa aqui' }, 'Bearer outro'))).toBe('29');
    });
  });

  describe('memória entendida pela IA', () => {
    const MEMORY = { kind: 'RESTRICAO', title: 'Evita parcelar', body: 'Evita parcelar compras' };

    it('devolve a memória quando a IA entende que a pessoa contou algo duradouro', async () => {
      aiIntent = 'DESCONHECIDO';
      aiMemory = MEMORY;
      expect(await (await call(await load(), { text: 'eu tento nunca parcelar nada' }, 'Bearer valido')).json()).toEqual({ intent: 'DESCONHECIDO', memory: MEMORY });
    });

    it('guarda a resposta com memória (a mesma frase não chama a IA de novo)', async () => {
      aiIntent = 'DESCONHECIDO';
      aiMemory = MEMORY;
      const POST = await load();
      await call(POST, { text: 'eu tento nunca parcelar nada' }, 'Bearer valido');
      expect((await (await call(POST, { text: 'eu tento nunca parcelar nada' }, 'Bearer valido')).json()).memory).toEqual(MEMORY);
      expect(aiCalls).toBe(1);
    });

    it.each([
      ['com valor em reais', { kind: 'CONTEXTO', body: 'Ganho R$ 5000 por mês' }],
      ['com número de documento', { kind: 'CONTEXTO', body: 'Meu cpf é 123.456.789-09' }],
      ['com e-mail', { kind: 'CONTEXTO', body: 'Escreva para a@b.com' }],
      ['de tipo inválido', { kind: 'SEGREDO', body: 'Algo qualquer aqui' }],
    ])('descarta memória %s', async (_nome, memory) => {
      aiIntent = 'DESCONHECIDO';
      aiMemory = memory;
      expect(await (await call(await load(), { text: 'conto algo sobre mim por aqui' }, 'Bearer valido')).json()).toEqual({ intent: 'DESCONHECIDO' });
    });

    it('memória só vale com DESCONHECIDO e sem registro', async () => {
      aiIntent = 'SALDO_HOJE';
      aiMemory = MEMORY;
      expect(await (await call(await load(), { text: 'qual meu saldo agora' }, 'Bearer valido')).json()).toEqual({ intent: 'SALDO_HOJE' });
      aiIntent = 'DESCONHECIDO';
      aiRegistration = { kind: 'PAGAR', amount: 100, title: 'Pix', future: false };
      const body = await (await call(await load(), { text: 'mandei cem de pix pro joao' }, 'Bearer valido')).json();
      expect(body.registration).toBeDefined();
      expect(body.memory).toBeUndefined();
    });
  });

  describe('pergunta de gastos com detalhe entendida pela IA', () => {
    const SPEND = { subject: 'mercado', from: '2026-09-01', to: '2026-09-30' };

    it('devolve assunto e período junto da intenção GASTOS_DETALHE', async () => {
      aiIntent = 'GASTOS_DETALHE';
      aiSpend = SPEND;
      const res = await call(await load(), { text: 'quanto foi o rancho do mês retrasado' }, 'Bearer valido');
      expect(await res.json()).toEqual({ intent: 'GASTOS_DETALHE', spend: SPEND });
    });

    it('guarda a resposta com a pergunta (a mesma frase não chama a IA de novo)', async () => {
      aiIntent = 'GASTOS_DETALHE';
      aiSpend = SPEND;
      const POST = await load();
      await call(POST, { text: 'quanto foi o rancho do mês retrasado' }, 'Bearer valido');
      const again = await call(POST, { text: 'quanto foi o rancho do mês retrasado' }, 'Bearer valido');
      expect(aiCalls).toBe(1);
      expect((await again.json()).spend).toEqual(SPEND);
    });

    it('descarta datas malformadas mas mantém o assunto', async () => {
      aiIntent = 'GASTOS_DETALHE';
      aiSpend = { subject: 'uber', from: 'setembro', to: '2026-09-30' };
      expect(await (await call(await load(), { text: 'gastos de uber em setembro de novo' }, 'Bearer valido')).json()).toEqual({ intent: 'GASTOS_DETALHE', spend: { subject: 'uber' } });
    });

    it('sem a pergunta, a intenção segue e o app lê assunto e período da frase', async () => {
      aiIntent = 'GASTOS_DETALHE';
      aiSpend = 'lixo';
      expect(await (await call(await load(), { text: 'gastos de algo qualquer por aí' }, 'Bearer valido')).json()).toEqual({ intent: 'GASTOS_DETALHE' });
    });

    it('a pergunta só vale com GASTOS_DETALHE (outra intenção nunca carrega gastos)', async () => {
      aiIntent = 'SALDO_HOJE';
      aiSpend = SPEND;
      expect(await (await call(await load(), { text: 'qual meu saldo agora de verdade' }, 'Bearer valido')).json()).toEqual({ intent: 'SALDO_HOJE' });
    });

    it('descreve a intenção e o contrato "spend" à IA', async () => {
      aiIntent = 'GASTOS_DETALHE';
      await call(await load(), { text: 'quanto gastei com pet em agosto' }, 'Bearer valido');
      expect(lastAiBody).toMatch(/GASTOS_DETALHE/);
      expect(lastAiBody).toMatch(/spend/);
    });
  });
});

