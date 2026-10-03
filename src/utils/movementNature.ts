import type { ExpenseNature, Movement } from '../types';

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/**
 * A natureza de um lançamento, na ordem em que o app a reconhece:
 * 1. vínculo direto (natureId de uma natureza que existe);
 * 2. vínculo com um mapeamento ou item de mapeamento (a natureza dona dele);
 * 3. categoria com o mesmo nome de uma natureza.
 * Fonte única: telas, projeções e a Forseti usam esta mesma regra, para não discordarem sobre o que está "sem natureza".
 */
export function resolveMovementNatureId(
  m: Pick<Movement, 'natureId' | 'mappingId' | 'mappingItemId' | 'category'>,
  natures: ExpenseNature[]
): string | undefined {
  if (m.natureId && natures.some((n) => n.id === m.natureId)) return m.natureId;
  if (m.mappingId || m.mappingItemId) {
    const owner = natures.find((n) =>
      (n.mappings || []).some((map) => map.id === m.mappingId || (m.mappingItemId && (map.items || []).some((i) => i.id === m.mappingItemId)))
    );
    if (owner) return owner.id;
  }
  const cat = normalize(m.category || '');
  if (!cat) return undefined;
  return natures.find((n) => normalize(n.name) === cat)?.id;
}
