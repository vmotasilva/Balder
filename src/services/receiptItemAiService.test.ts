import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExpenseNature, ReceiptItemLine } from '../types';

// Cache e proteções do serviço que pede à IA a associação das linhas do cupom.

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
}));

const natures = [
  { id: 'nat', name: 'Alimentação', mappings: [{ id: 'map', name: 'Mercado', items: [{ id: 'item_arroz', description: 'Arroz' }] }] },
] as unknown as ExpenseNature[];
const line = (rawName: string, over: Partial<ReceiptItemLine> = {}): ReceiptItemLine => ({ id: rawName, rawName, detectedName: rawName, price: 9, isNewSuggestedItem: true, ...over });

let apiCalls = 0;
let apiAnswer: { name: string; option: string | null }[] = [];
let apiStatus = 200;
const store = new Map<string, string>();

beforeEach(() => {
  apiCalls = 0;
  apiAnswer = [];
  apiStatus = 200;
  store.clear();
  vi.resetModules();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  vi.stubGlobal('fetch', vi.fn(async () => {
    apiCalls += 1;
    return new Response(JSON.stringify({ matches: apiAnswer }), { status: apiStatus });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const run = async (items: ReceiptItemLine[]) => (await import('./receiptItemAiService')).suggestReceiptItems(items, natures);

describe('suggestReceiptItems', () => {
  it('sugere o item e marca a linha como sugestão da Forseti', async () => {
    apiAnswer = [{ name: 'ARROZ TIO JOAO 5KG', option: 'item_arroz' }];
    const [out] = await run([line('ARROZ TIO JOAO 5KG')]);
    expect(out).toMatchObject({ matchedMappingItemId: 'item_arroz', targetMappingId: 'map', natureId: 'nat', aiSuggested: true });
    expect(apiCalls).toBe(1);
  });

  it('a mesma descrição em outro cupom não volta à IA', async () => {
    apiAnswer = [{ name: 'ARROZ TIO JOAO 5KG', option: 'item_arroz' }];
    await run([line('ARROZ TIO JOAO 5KG')]);
    const [again] = await run([line('arroz tio joão 5kg')]);
    expect(apiCalls).toBe(1);
    expect(again.matchedMappingItemId).toBe('item_arroz');
  });

  it('guarda também o "sem sugestão", para não perguntar de novo', async () => {
    apiAnswer = [{ name: 'SABAO EM PO OMO', option: null }];
    await run([line('SABAO EM PO OMO')]);
    const [again] = await run([line('SABAO EM PO OMO')]);
    expect(apiCalls).toBe(1);
    expect(again.matchedMappingItemId).toBeUndefined();
  });

  it('só pergunta pelas linhas que as regras não associaram', async () => {
    const mapped = line('LEITE', { matchedMappingItemId: 'item_arroz', isNewSuggestedItem: false });
    expect(await run([mapped])).toEqual([mapped]);
    expect(apiCalls).toBe(0);
  });

  it('com a IA fora do ar, devolve o cupom como veio e não guarda nada', async () => {
    apiStatus = 502;
    const items = [line('ARROZ TIO JOAO 5KG')];
    expect(await run(items)).toEqual(items);
    apiStatus = 200;
    apiAnswer = [{ name: 'ARROZ TIO JOAO 5KG', option: 'item_arroz' }];
    expect((await run(items))[0].matchedMappingItemId).toBe('item_arroz');
    expect(apiCalls).toBe(2);
  });

  it('sem itens cadastrados no mapeamento, nem chama a IA', async () => {
    const { suggestReceiptItems } = await import('./receiptItemAiService');
    const items = [line('ARROZ')];
    expect(await suggestReceiptItems(items, [])).toEqual(items);
    expect(apiCalls).toBe(0);
  });
});
