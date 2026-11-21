import type { ExpenseNature, ReceiptItemLine } from '../types';
import { stripAccents } from './forsetiMoney';

/**
 * Sugestão, em lote, de em qual MAPEAMENTO cada linha de um cupom entra. A IA só escolhe entre os mapeamentos que a
 * pessoa já tem (nunca inventa) e nunca recebe valores: só o nome da linha, os nomes dos mapeamentos e, como pistas,
 * os nomes dos itens da memória de cálculo de cada um.
 */

export const MAX_ITEMS_PER_CALL = 40;
export const MAX_OPTIONS = 200;
const NAME_MAX = 60;

/** Um mapeamento da pessoa, como a IA o enxerga (sem preços). `hints` = itens/palavras-chave que ajudam a reconhecê-lo. */
export interface MappingOption {
  id: string;
  label: string;
  nature: string;
  hints: string[];
}

export const MAX_HINTS = 12;

/** Nome da linha pronto para a IA: sem códigos de barras, valores, símbolos e espaços sobrando. Vazio se não sobrou nome. */
export function cleanItemName(raw: string): string {
  const name = raw
    .replace(/r\$\s*[\d.,]+/gi, ' ')
    .replace(/\d{5,}/g, ' ') // código de barras, código do produto
    .replace(/[^A-Za-zÀ-ÿ0-9/.\- ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
  return (name.match(/[A-Za-zÀ-ÿ]/g) || []).length >= 3 ? name : '';
}

/** Chave para reconhecer a mesma descrição em outro cupom (sem acento, caixa ou espaços). */
export const itemKey = (name: string) => stripAccents(cleanItemName(name)).replace(/\s+/g, ' ');

/** Mapeamentos da pessoa, até o limite da chamada. Itens e palavras-chave entram só como pistas. */
export function buildOptions(natures: ExpenseNature[]): MappingOption[] {
  const out: MappingOption[] = [];
  for (const nat of natures) {
    for (const map of nat.mappings || []) {
      if (!map.id || !map.name) continue;
      const hints = [...(map.keywords || []), ...(map.items || []).flatMap((it) => [it.description, ...(it.keywords || [])])]
        .map((h) => (h || '').slice(0, NAME_MAX).trim())
        .filter(Boolean);
      out.push({ id: map.id, label: map.name.slice(0, NAME_MAX), nature: nat.name.slice(0, NAME_MAX), hints: [...new Set(hints)].slice(0, MAX_HINTS) });
    }
  }
  return out.slice(0, MAX_OPTIONS);
}

/**
 * Lê a resposta da IA: uma lista {index, option}. Só vale o índice que existe e o mapeamento que a pessoa realmente tem
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

/** Aplica as sugestões às linhas ainda sem mapeamento: marca como sugestão da Forseti para a pessoa conferir. */
export function applySuggestions(
  items: ReceiptItemLine[],
  suggestionByKey: Map<string, string | null>,
  natures: ExpenseNature[]
): ReceiptItemLine[] {
  const where = new Map<string, string>(); // id do mapeamento → natureza
  for (const nat of natures) {
    for (const map of nat.mappings || []) where.set(map.id, nat.id);
  }
  return items.map((it) => {
    if (it.targetMappingId) return it;
    const id = suggestionByKey.get(itemKey(it.rawName || it.detectedName));
    const natureId = id ? where.get(id) : undefined;
    if (!id || !natureId) return it;
    return { ...it, matchedMappingItemId: undefined, targetMappingId: id, natureId, isNewSuggestedItem: false, aiSuggested: true };
  });
}
