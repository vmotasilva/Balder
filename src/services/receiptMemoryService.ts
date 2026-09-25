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

import type { ExpenseNature, MappingItem } from '../types';

export function getActiveNaturesFromStorage(): ExpenseNature[] {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('balder_natures_') || key === 'balder_natures')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    }
  } catch {}
  return [];
}

export function matchItemToLearnedRecord(itemName: string, natures?: ExpenseNature[]): LearnedItemRecord | null {
  if (!itemName) return null;
  const lower = itemName.toLowerCase().trim();
  const lowerNorm = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tokens = lowerNorm.split(/[\s,.\-\/]+/).filter((t) => t.length >= 3);

  // 1. Prioridade Máxima: Pesquisa direta nos itens e palavras-chave dos Mapeamentos do Usuário
  const activeNatures = (natures && natures.length > 0) ? natures : getActiveNaturesFromStorage();
  if (activeNatures && activeNatures.length > 0) {
    for (const nat of activeNatures) {
      for (const map of (nat.mappings || [])) {
        for (const item of (map.items || [])) {
          const itemDescNorm = item.description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

          // A) Correspondência exata ou inclusão da descrição do item
          if (lowerNorm.includes(itemDescNorm) || itemDescNorm.includes(lowerNorm)) {
            return {
              keyword: itemDescNorm,
              mappingItemId: item.id,
              targetMappingId: map.id,
              natureId: nat.id,
            };
          }

          // B) Correspondência com palavras-chave cadastradas no item
          if (item.keywords && item.keywords.length > 0) {
            for (const kw of item.keywords) {
              const kwNorm = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
              if (
                kwNorm &&
                (lowerNorm.includes(kwNorm) ||
                  kwNorm.includes(lowerNorm) ||
                  tokens.some((tok) => kwNorm.includes(tok) || tok.includes(kwNorm)))
              ) {
                return {
                  keyword: kwNorm,
                  mappingItemId: item.id,
                  targetMappingId: map.id,
                  natureId: nat.id,
                };
              }
            }
          }
        }
      }
    }
  }

  // 2. Busca no dicionário aprendido / padrão global
  const dict = getLearnedDictionary();
  for (const record of dict) {
    const recKw = record.keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lowerNorm.includes(recKw) || recKw.includes(lowerNorm)) {
      return record;
    }
  }

  return null;
}

/**
 * Associa automaticamente o texto detectado na nota fiscal/comprovante
 * como palavra-chave do item mapeado no Balder, além de memorizar na IA.
 */
export function autoAssociateReceiptTextToItemKeywords(
  receiptText: string,
  mappingItemId: string,
  natureId: string,
  mappingId: string,
  updateMappingItem?: (natureId: string, mappingId: string, itemId: string, updates: Partial<MappingItem>) => void,
  natures?: ExpenseNature[]
) {
  if (!receiptText || !mappingItemId) return;
  const cleanKeyword = receiptText.toLowerCase().trim().replace(/[^\w\sÀ-ÿ]/g, '');
  if (!cleanKeyword || cleanKeyword.length < 2) return;

  // 1. Aprende no dicionário efêmero e permanente de IA
  learnReceiptItemAssociation(cleanKeyword, mappingItemId, mappingId, natureId);

  // 2. Adiciona como palavra-chave do item no cadastro do usuário se updateMappingItem estiver disponível
  if (updateMappingItem && natures) {
    const targetNat = natures.find((n) => n.id === natureId);
    const targetMap = targetNat?.mappings.find((m) => m.id === mappingId);
    const targetItem = targetMap?.items.find((i) => i.id === mappingItemId);
    if (targetItem) {
      const currentKeywords = targetItem.keywords || [];
      if (!currentKeywords.some((k) => k.toLowerCase().trim() === cleanKeyword)) {
        const nextKeywords = [...currentKeywords, cleanKeyword];
        updateMappingItem(natureId, mappingId, mappingItemId, { keywords: nextKeywords });
      }
    }
  }
}

