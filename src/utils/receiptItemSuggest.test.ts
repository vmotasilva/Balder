import { describe, expect, it } from 'vitest';
import type { ExpenseNature, ReceiptItemLine } from '../types';
import { applySuggestions, buildOptions, cleanItemName, itemKey, parseItemMatches } from './receiptItemSuggest';

const natures = [
  {
    id: 'nat_alim', name: 'Alimentação',
    mappings: [
      { id: 'map_mercado', name: 'Mercado do mês', items: [{ id: 'item_arroz', description: 'Arroz' }, { id: 'item_leite', description: 'Leite' }] },
      { id: 'map_feira', name: 'Feira', items: [{ id: 'item_tomate', description: 'Tomate' }] },
    ],
  },
] as unknown as ExpenseNature[];

const line = (rawName: string, over: Partial<ReceiptItemLine> = {}): ReceiptItemLine => ({
  id: rawName, rawName, detectedName: rawName, price: 10, isNewSuggestedItem: true, ...over,
});

describe('cleanItemName: só o nome da linha vai para a IA', () => {
  it.each([
    ['ARROZ TIO JOAO 5KG', 'ARROZ TIO JOAO 5KG'],
    ['7891234567890 LEITE INTEGRAL 1L', 'LEITE INTEGRAL 1L'],
    ['  TOMATE   ITALIANO  R$ 12,90 ', 'TOMATE ITALIANO'],
    ['PÃO FRANCÊS *** KG', 'PÃO FRANCÊS KG'],
  ])('%s → %s', (raw, expected) => expect(cleanItemName(raw)).toBe(expected));

  it.each(['', '12', '7891234567890', 'R$ 5,00', 'ab'])('sem nome aproveitável: "%s"', (raw) => expect(cleanItemName(raw)).toBe(''));
  it('corta nomes muito longos', () => expect(cleanItemName('a'.repeat(200)).length).toBeLessThanOrEqual(60));
});

describe('itemKey: a mesma descrição em outro cupom é a mesma chave', () => {
  it('ignora acento, caixa e espaços', () => expect(itemKey(' Pão  FRANCÊS 1kg ')).toBe(itemKey('PAO FRANCES 1KG')));
  it('descrições diferentes têm chaves diferentes', () => expect(itemKey('arroz 5kg')).not.toBe(itemKey('arroz 1kg')));
});

describe('buildOptions', () => {
  it('lista os itens do mapeamento, só com nomes', () => {
    const opts = buildOptions(natures);
    expect(opts.map((o) => o.id)).toEqual(['item_arroz', 'item_leite', 'item_tomate']);
    expect(opts[2]).toEqual({ id: 'item_tomate', label: 'Tomate', routine: 'Feira', nature: 'Alimentação' });
    expect(Object.keys(opts[0]).sort()).toEqual(['id', 'label', 'nature', 'routine']);
  });
  it('sem naturezas, lista vazia', () => expect(buildOptions([])).toEqual([]));
});

describe('parseItemMatches: a resposta da IA nunca é confiada como veio', () => {
  const valid = new Set(['item_arroz', 'item_leite']);
  it('lê as escolhas válidas e deixa o resto sem sugestão', () => {
    expect(parseItemMatches([{ index: 0, option: 'item_arroz' }, { index: 2, option: 'item_leite' }], 3, valid)).toEqual(['item_arroz', null, 'item_leite']);
  });
  it('descarta id que a pessoa não tem, índice fora da lista, repetido e malformado', () => {
    expect(
      parseItemMatches(
        [{ index: 0, option: 'item_inventado' }, { index: 9, option: 'item_leite' }, { index: 1, option: 'item_leite' }, { index: 1, option: 'item_arroz' }, { index: '0', option: 'item_arroz' }, null, 'x', { index: 1.5, option: 'item_arroz' }],
        2,
        valid
      )
    ).toEqual([null, 'item_leite']);
  });
  it.each([undefined, null, 'texto', {}, 42])('resposta que não é lista (%j): sem sugestões', (v) => expect(parseItemMatches(v, 2, valid)).toEqual([null, null]));
});

describe('applySuggestions', () => {
  const sugg = new Map<string, string | null>([[itemKey('ARROZ TIO JOAO 5KG'), 'item_arroz'], [itemKey('SABAO EM PO'), null], [itemKey('TOMATE ITAL'), 'item_inventado']]);

  it('marca a linha como sugerida, com a rotina e a natureza do item', () => {
    const [out] = applySuggestions([line('ARROZ TIO JOAO 5KG')], sugg, natures);
    expect(out).toMatchObject({ matchedMappingItemId: 'item_arroz', targetMappingId: 'map_mercado', natureId: 'nat_alim', isNewSuggestedItem: false, aiSuggested: true });
  });
  it('não mexe em quem já tem item, em quem ficou sem sugestão nem em id que não existe mais', () => {
    const already = line('ARROZ TIO JOAO 5KG', { matchedMappingItemId: 'item_leite', targetMappingId: 'map_mercado', isNewSuggestedItem: false });
    const noMatch = line('SABAO EM PO');
    const bogus = line('TOMATE ITAL');
    const out = applySuggestions([already, noMatch, bogus], sugg, natures);
    expect(out[0]).toBe(already);
    expect(out[1]).toBe(noMatch);
    expect(out[2]).toBe(bogus);
  });
});
