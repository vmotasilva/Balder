import type { ExpenseNature } from '../types';

const compact = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

const tokens = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);

export interface MappingItemMatch {
  natureId: string;
  mappingId: string;
  itemId: string;
}

/**
 * Acha o item de mapeamento (natureza → mapeamento → item) que corresponde ao título de um lançamento,
 * comparando com a descrição do item e com as palavras-chave do mapeamento ("Neon.tech" ↔ "Neon Tech").
 * Prefere itens ainda não cumpridos. Devolve null quando nada combina com segurança.
 */
export function findMappingItemForTitle(title: string, natures: ExpenseNature[]): MappingItemMatch | null {
  const t = compact(title);
  if (t.length < 3) return null;
  const titleTokens = tokens(title);
  let best: { match: MappingItemMatch; score: number } | null = null;

  const consider = (match: MappingItemMatch, text: string, fulfilled: boolean, bonus = 0) => {
    const c = compact(text);
    if (c.length < 3) return;
    let score = 0;
    if (c === t) score = 100;
    else if (c.length >= 4 && (t.includes(c) || (t.length >= 4 && c.includes(t)))) score = 80;
    else {
      const common = tokens(text).filter((tk) => titleTokens.includes(tk));
      if (common.length > 0) score = 40 + common.length * 10;
    }
    if (score === 0) return;
    score += bonus - (fulfilled ? 15 : 0);
    if (!best || score > best.score) best = { match, score };
  };

  for (const nat of natures) {
    for (const map of nat.mappings || []) {
      for (const item of map.items || []) {
        consider({ natureId: nat.id, mappingId: map.id, itemId: item.id }, item.description, !!item.isFulfilled);
      }
      // Palavra-chave do mapeamento: liga ao primeiro item ainda aberto dele
      for (const kw of map.keywords || []) {
        const open = (map.items || []).find((i) => !i.isFulfilled) || (map.items || [])[0];
        if (open) consider({ natureId: nat.id, mappingId: map.id, itemId: open.id }, kw, !!open.isFulfilled, -10);
      }
    }
  }
  const found = best as { match: MappingItemMatch; score: number } | null;
  return found && found.score >= 50 ? found.match : null;
}
