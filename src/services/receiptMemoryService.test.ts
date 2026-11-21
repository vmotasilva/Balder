import { describe, expect, it, vi } from 'vitest';
import type { ExpenseNature } from '../types';
import { autoAssociateReceiptTextToMappingKeywords, matchItemToLearnedRecord } from './receiptMemoryService';

// A associação do cupom tem como destino o MAPEAMENTO; itens e palavras-chave só ajudam a achá-lo.

const natures = [
  {
    id: 'nat',
    name: 'Alimentação',
    mappings: [
      {
        id: 'map_mercado',
        name: 'Mercado',
        keywords: ['atacadao'],
        items: [
          { id: 'i_arroz', description: 'Arroz', keywords: ['tio joao'] },
          { id: 'i_feijao', description: 'Feijão' },
          { id: 'i_cafe', description: 'Café' },
        ],
      },
      { id: 'map_padaria', name: 'Padaria', items: [{ id: 'i_pao', description: 'Pão' }] },
    ],
  },
] as unknown as ExpenseNature[];

describe('matchItemToLearnedRecord (mapeamento primeiro)', () => {
  it('devolve o mapeamento; o item que casou vem só como pista', () => {
    expect(matchItemToLearnedRecord('ARROZ TIO JOAO 5KG', natures)).toMatchObject({ targetMappingId: 'map_mercado', natureId: 'nat', mappingItemId: 'i_arroz' });
  });

  it('casa pelo nome e pelas palavras-chave do próprio mapeamento, sem precisar de item', () => {
    expect(matchItemToLearnedRecord('COMPRA ATACADAO FILIAL 12', natures)).toMatchObject({ targetMappingId: 'map_mercado' });
    const r = matchItemToLearnedRecord('PADARIA SAO JOSE', natures);
    expect(r?.targetMappingId).toBe('map_padaria');
    expect(r?.mappingItemId).toBeUndefined();
  });

  it('vence o mapeamento com mais evidência, não o primeiro que casa', () => {
    const two = [
      { id: 'nat', name: 'A', mappings: [
        { id: 'm1', name: 'Feira', items: [{ id: 'a', description: 'Pão' }] },
        { id: 'm2', name: 'Mercado', items: [{ id: 'b', description: 'Pão de forma', keywords: ['pao'] }, { id: 'c', description: 'Pão integral' }] },
      ] },
    ] as unknown as ExpenseNature[];
    expect(matchItemToLearnedRecord('PAO DE FORMA PULLMAN', two)?.targetMappingId).toBe('m2');
  });

  it('sem pista nenhuma, não inventa mapeamento', () => {
    expect(matchItemToLearnedRecord('XYZQWK', natures)).toBeNull();
  });
});

describe('autoAssociateReceiptTextToMappingKeywords', () => {
  it('grava o texto como palavra-chave do mapeamento, sem duplicar', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    const updateMapping = vi.fn();
    autoAssociateReceiptTextToMappingKeywords('Sabão OMO 1kg', 'nat', 'map_mercado', updateMapping, natures);
    expect(updateMapping).toHaveBeenCalledWith('nat', 'map_mercado', { keywords: ['atacadao', 'sabão omo 1kg'] });

    const withKw = [{ ...natures[0], mappings: [{ ...natures[0].mappings[0], keywords: ['sabão omo 1kg'] }] }] as unknown as ExpenseNature[];
    updateMapping.mockClear();
    autoAssociateReceiptTextToMappingKeywords('Sabão OMO 1kg', 'nat', 'map_mercado', updateMapping, withKw);
    expect(updateMapping).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
