import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// /api/price-check e /api/product-search: login obrigatório (401) e plano com Oportunidades (403).

let subscriptionRows: unknown[] = [];
const fetchProduct = vi.fn(async () => ({ ok: true, title: 'Produto' }));
const searchProducts = vi.fn(async () => ({ ok: true, results: [] }));

vi.mock('../src/services/priceExtraction.js', () => ({ fetchProduct: (...a: unknown[]) => (fetchProduct as any)(...a) }));
vi.mock('../src/services/productSearch.js', () => ({ searchProducts: (...a: unknown[]) => (searchProducts as any)(...a) }));

beforeEach(() => {
  subscriptionRows = [];
  fetchProduct.mockClear();
  searchProducts.mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
      if (String(url).includes('/auth/v1/user')) {
        return init.headers.authorization === 'Bearer valido' ? Response.json({ id: 'u1' }) : new Response('{}', { status: 401 });
      }
      return Response.json(subscriptionRows);
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

const plan = (opportunities: boolean, status = 'ATIVA') => [
  { status, expires_at: null, subscription_plans: { name: 'X', opportunities_enabled: opportunities } },
];
const get = (fn: (r: Request) => Promise<Response>, path: string, auth?: string) =>
  fn(new Request(`http://x${path}`, { headers: auth ? { authorization: auth } : {} }));

describe.each([
  ['/api/price-check', '/api/price-check?url=https://loja.com/p', async () => (await import('../api/price-check')).GET, fetchProduct],
  ['/api/product-search', '/api/product-search?q=fone', async () => (await import('../api/product-search')).GET, searchProducts],
])('%s', (_name, path, load, worker) => {
  it.each([[undefined], ['Bearer invalido']])('sem login válido (%s) responde 401 e não consulta a loja', async (auth) => {
    expect((await get(await load(), path, auth)).status).toBe(401);
    expect(worker).not.toHaveBeenCalled();
  });

  it.each([
    ['plano sem Oportunidades', plan(false)],
    ['assinatura suspensa', plan(true, 'SUSPENSA')],
  ])('%s responde 403 e não consulta a loja', async (_n, rows) => {
    subscriptionRows = rows;
    expect((await get(await load(), path, 'Bearer valido')).status).toBe(403);
    expect(worker).not.toHaveBeenCalled();
  });

  it('plano com Oportunidades (ou sem assinatura cadastrada) responde 200', async () => {
    subscriptionRows = plan(true);
    expect((await get(await load(), path, 'Bearer valido')).status).toBe(200);
    subscriptionRows = [];
    expect((await get(await load(), path, 'Bearer valido')).status).toBe(200);
    expect(worker).toHaveBeenCalledTimes(2);
  });
});
