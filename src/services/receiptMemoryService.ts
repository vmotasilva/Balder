export interface LearnedItemRecord {
  keyword: string;
  mappingItemId: string;
  targetMappingId: string;
  natureId: string;
}

const DEFAULT_DICTIONARY: LearnedItemRecord[] = [
  // Feira Livre - Frutas
  { keyword: 'banana', mappingItemId: 'item_f1', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'maca', mappingItemId: 'item_f1', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'maçã', mappingItemId: 'item_f1', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'melancia', mappingItemId: 'item_f1', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'ameixa', mappingItemId: 'item_f1', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'uva', mappingItemId: 'item_f1', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'laranja', mappingItemId: 'item_f1', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'mamao', mappingItemId: 'item_f1', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'mamão', mappingItemId: 'item_f1', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'abacaxi', mappingItemId: 'item_f1', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'morango', mappingItemId: 'item_f1', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },

  // Feira Livre - Verduras, Legumes e Temperos
  { keyword: 'cenoura', mappingItemId: 'item_f2', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'tomate', mappingItemId: 'item_f2', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'quiabo', mappingItemId: 'item_f2', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'coentro', mappingItemId: 'item_f2', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'alface', mappingItemId: 'item_f2', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'batata', mappingItemId: 'item_f2', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'cebola', mappingItemId: 'item_f2', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'alho', mappingItemId: 'item_f2', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'cheiro verde', mappingItemId: 'item_f2', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'couve', mappingItemId: 'item_f2', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'mandioca', mappingItemId: 'item_f2', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'aipim', mappingItemId: 'item_f2', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },

  // Feira Livre - Ovos
  { keyword: 'ovo', mappingItemId: 'item_f3', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },
  { keyword: 'ovos', mappingItemId: 'item_f3', targetMappingId: 'map_feira_semanal', natureId: 'nat_alimentacao' },

  // Açougue & Carnes
  { keyword: 'carne', mappingItemId: 'item_p2', targetMappingId: 'map_acougue_proteinas', natureId: 'nat_alimentacao' },
  { keyword: 'acem', mappingItemId: 'item_p2', targetMappingId: 'map_acougue_proteinas', natureId: 'nat_alimentacao' },
  { keyword: 'acém', mappingItemId: 'item_p2', targetMappingId: 'map_acougue_proteinas', natureId: 'nat_alimentacao' },
  { keyword: 'alcatra', mappingItemId: 'item_p2', targetMappingId: 'map_acougue_proteinas', natureId: 'nat_alimentacao' },
  { keyword: 'patinho', mappingItemId: 'item_p2', targetMappingId: 'map_acougue_proteinas', natureId: 'nat_alimentacao' },
  { keyword: 'frango', mappingItemId: 'item_p1', targetMappingId: 'map_acougue_proteinas', natureId: 'nat_alimentacao' },
  { keyword: 'peixe', mappingItemId: 'item_p3', targetMappingId: 'map_acougue_proteinas', natureId: 'nat_alimentacao' },

  // Supermercado Base Mensal
  { keyword: 'arroz', mappingItemId: 'item_m1', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'feijao', mappingItemId: 'item_m2', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'feijão', mappingItemId: 'item_m2', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'azeite', mappingItemId: 'item_m3', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'cafe', mappingItemId: 'item_m4', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'café', mappingItemId: 'item_m4', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'queijo', mappingItemId: 'item_m5', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'manteiga', mappingItemId: 'item_m5', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'leite', mappingItemId: 'item_m5', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'nescau', mappingItemId: 'item_m5', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'chandelle', mappingItemId: 'item_m5', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'comfort', mappingItemId: 'item_m6', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'amaciante', mappingItemId: 'item_m6', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'sabao', mappingItemId: 'item_m6', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'sabão', mappingItemId: 'item_m6', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
  { keyword: 'detergente', mappingItemId: 'item_m6', targetMappingId: 'map_mercado_mensal', natureId: 'nat_alimentacao' },
];

const STORAGE_KEY = 'balder_receipt_item_memory';

export function getLearnedDictionary(): LearnedItemRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DICTIONARY;
    const custom = JSON.parse(raw);
    return Array.isArray(custom) ? [...DEFAULT_DICTIONARY, ...custom] : DEFAULT_DICTIONARY;
  } catch {
    return DEFAULT_DICTIONARY;
  }
}

export function learnReceiptItemAssociation(keyword: string, mappingItemId: string, targetMappingId: string, natureId = 'nat_alimentacao') {
  if (!keyword || !mappingItemId) return;
  try {
    const cleanKey = keyword.toLowerCase().trim();
    const raw = localStorage.getItem(STORAGE_KEY);
    const custom: LearnedItemRecord[] = raw ? JSON.parse(raw) : [];

    // Substituir ou adicionar
    const existingIdx = custom.findIndex((r) => r.keyword === cleanKey);
    const newRecord: LearnedItemRecord = {
      keyword: cleanKey,
      mappingItemId,
      targetMappingId,
      natureId,
    };

    if (existingIdx >= 0) {
      custom[existingIdx] = newRecord;
    } else {
      custom.push(newRecord);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  } catch (err) {
    console.warn('Falha ao salvar aprendizado de item de cupom:', err);
  }
}

export function matchItemToLearnedRecord(itemName: string): LearnedItemRecord | null {
  const lower = itemName.toLowerCase().trim();
  const dict = getLearnedDictionary();

  // 1. Busca por palavra-chave exata ou inclusão
  for (const record of dict) {
    if (lower.includes(record.keyword) || record.keyword.includes(lower)) {
      return record;
    }
  }

  return null;
}
