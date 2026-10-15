import type { ExpenseNature, ReceiptItemLine } from '../types';
import { stripAccents } from './forsetiMoney';

/**
 * Sugestão, em lote, de em qual item do mapeamento cada linha de um cupom entra. A IA só escolhe entre os itens que a
 * pessoa já tem (nunca inventa) e nunca recebe valores: só o nome da linha e os nomes dos itens do mapeamento.
 */

export const MAX_ITEMS_PER_CALL = 40;
export const MAX_OPTIONS = 200;
const NAME_MAX = 60;

/** Um item do mapeamento da pessoa, como a IA o enxerga (sem preços). */
export interface MappingOption {
  id: string;
  label: string;
  routine: string;
  nature: string;
}

/** Nome da linha pronto para a IA: sem códigos de barras, valores, símbolos e espaços sobrando. Vazio se não sobrou nome. */
export function cleanItemName(raw: string): string {
  const name = raw
    .replace(/r\$\s*[\d.,]+/gi, ' ')
    .replace(/\d{5,}/g, ' ') // código de barras, código do produto
    .replace(/[^A-Za-zÀ-ÿ0-9\/.\- ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
  return (name.match(/[A-Za-zÀ-ÿ]/g) || []).length >= 3 ? name : '';
}

/** Chave para reconhecer a mesma descrição em outro cupom (sem acento, caixa ou espaços). */
export const itemKey = (name: string) => stripAccents(cleanItemName(name)).replace(/\s+/g, ' ');

/** Itens do mapeamento da pessoa, até o limite da chamada. */
export function buildOptions(natures: ExpenseNature[]): MappingOption[] {
  const out: MappingOption[] = [];
  for (const nat of natures) {
    for (const map of nat.mappings || []) {
      for (const item of map.items || []) {
        if (item.id && item.description) out.push({ id: item.id, label: item.description.slice(0, NAME_MAX), routine: map.name.slice(0, NAME_MAX), nature: nat.name.slice(0, NAME_MAX) });
      }
    }
  }
  return out.slice(0, MAX_OPTIONS);
}

/**
 * Lê a resposta da IA: uma lista {index, option}. Só vale o índice que existe e a opção que a pessoa realmente tem
 * (ids fora da lista, repetidos ou malformados são descartados). Devolve uma posição por nome: o id escolhido ou null.
 */
export function parseItemMatches(value: unknown, count: number, validIds: Set<string>): (string | null)[] {
  const result: (string | null)[] = Array.from({ length: count }, () => null);
  if (!Array.isArray(value)) return result;
  const seen = new Set<number>();
  for (const m of value) {
    if (!m || typeof m !== 'object') continue;
    const { index, option } = m as { index?: unknown; option?: unknown };
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= count || seen.has(index)) continue;
    seen.add(index);
    if (typeof option === 'string' && validIds.has(option)) result[index] = option;
  }
  return result;
}

/** Aplica as sugestões às linhas ainda sem item: marca como sugestão da Forseti para a pessoa conferir. */
export function applySuggestions(
  items: ReceiptItemLine[],
  suggestionByKey: Map<string, string | null>,
  natures: ExpenseNature[]
): ReceiptItemLine[] {
  const where = new Map<string, { mappingId: string; natureId: string }>();
  for (const nat of natures) {
    for (const map of nat.mappings || []) {
      for (const item of map.items || []) where.set(item.id, { mappingId: map.id, natureId: nat.id });
    }
  }
  return items.map((it) => {
    if (it.matchedMappingItemId) return it;
    const id = suggestionByKey.get(itemKey(it.rawName || it.detectedName));
    const at = id ? where.get(id) : undefined;
    if (!id || !at) return it;
    return { ...it, matchedMappingItemId: id, targetMappingId: at.mappingId, natureId: at.natureId, isNewSuggestedItem: false, aiSuggested: true };
  });
}
