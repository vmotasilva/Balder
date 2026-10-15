import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// classifyIntent: o limite por hora vira um aviso (e não só "não entendi"), e o saldo é guardado.

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
}));

let status = 200;
let body: unknown = { intent: 'SALDO_HOJE' };
let respHeaders: Record<string, string> = {};

beforeEach(() => {
  status = 200;
  body = { intent: 'SALDO_HOJE' };
  respHeaders = {};
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: respHeaders })));
});
afterEach(async () => {
  vi.unstubAllGlobals();
  (await import('./forsetiAiQuota')).setAiQuota(null);
});

const run = async (text = 'frase qualquer aqui') => (await import('./forsetiIntentService')).classifyIntent(text);

describe('classifyIntent', () => {
  it('devolve a intenção e guarda quanto resta do limite', async () => {
    respHeaders = { 'X-Forseti-Ai-Remaining': '4', 'X-Forseti-Ai-Limit': '30' };
    expect(await run()).toMatchObject({ intent: 'SALDO_HOJE' });
    expect((await import('./forsetiAiQuota')).currentAiQuota()).toMatchObject({ remaining: 4, limit: 30 });
  });

  it('limite atingido (429) vira limited, com saldo zero guardado', async () => {
    status = 429;
    body = { error: 'limite de uso' };
    respHeaders = { 'X-Forseti-Ai-Remaining': '0', 'X-Forseti-Ai-Limit': '30' };
    expect(await run()).toEqual({ limited: true });
    expect((await import('./forsetiAiQuota')).currentAiQuota()?.remaining).toBe(0);
  });

  it.each([500, 502, 501, 401])('outras falhas (%s) seguem como "sem resposta da IA"', async (s) => {
    status = s;
    body = { error: 'x' };
    expect(await run()).toBeNull();
  });

  it('sem os cabeçalhos, não inventa saldo', async () => {
    await run();
    expect((await import('./forsetiAiQuota')).currentAiQuota()).toBeNull();
  });
});
