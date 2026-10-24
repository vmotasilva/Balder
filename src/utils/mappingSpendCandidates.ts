import type { ExpenseNature, Movement } from '../types';
import { resolveMovementNatureId } from './movementNature';

const compact = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

/** Data e valor em que o gasto saiu do caixa. */
export const spendDate = (m: Movement) => m.paymentDate || m.dueDate;
export const spendAmount = (m: Movement) => m.actualAmount ?? m.amount;

/**
 * Gastos já realizados no período que podem ser a compra prevista de um mapeamento: pagos dentro do período, da mesma
 * natureza, ainda sem ligação com um item de mapeamento (esses já entram no "Real" pelo item) e sem lançamento
 * anterior no mapeamento. Os que citam o nome ou as palavras-chave do mapeamento vêm primeiro.
 */
export function findMappingSpendCandidates(params: {
  movements: Movement[];
  natures: ExpenseNature[];
  natureId: string;
  mappingId: string;
  range: { from: string; to: string };
  /** Data prevista da compra: desempata os gastos pela proximidade dela (o mais perto primeiro). */
  near?: string;
  /** Só os que citam o mapeamento (nome ou palavras-chave) ou já são dele: seguro para baixar vencimentos sozinho. */
  onlyMatching?: boolean;
}): Movement[] {
  const { movements, natures, natureId, mappingId, range, near, onlyMatching } = params;
  const mapping = natures.find((n) => n.id === natureId)?.mappings.find((m) => m.id === mappingId);
  if (!mapping) return [];

  const itemIds = new Set<string>();
  const linkedMovementIds = new Set<string>();
  natures.forEach((n) =>
    n.mappings.forEach((mp) =>
      mp.items.forEach((it) => {
        itemIds.add(it.id);
        Object.values(it.payments || {}).forEach((list) => list.forEach((p) => p.movementId && linkedMovementIds.add(p.movementId)));
      })
    )
  );

  const terms = [mapping.name, ...(mapping.keywords || [])].map(compact).filter((t) => t.length >= 3);
  const score = (m: Movement) => {
    const text = compact(`${m.title} ${m.notes || ''}`);
    return terms.some((t) => text.includes(t)) ? 1 : 0;
  };

  const dayNumber = (iso: string) => {
    const [y, mo, d] = iso.split('-').map(Number);
    return Math.round(new Date(y, mo - 1, d).getTime() / 86400000);
  };
  const distance = (m: Movement) => (near ? Math.abs(dayNumber(spendDate(m)) - dayNumber(near)) : 0);

  return movements
    .filter((m) => {
      if (m.type !== 'PAGAR' || m.status !== 'REALIZADA') return false;
      if (m.category === 'Cartões' || m.category === 'Empréstimos') return false;
      if (m.adjustmentReason === 'Desconsiderado' || m.installmentGroupId?.startsWith('skip_')) return false;
      const date = spendDate(m);
      if (!date || date < range.from || date > range.to || spendAmount(m) <= 0) return false;
      if (linkedMovementIds.has(m.id)) return false;
      if (m.mappingItemId && itemIds.has(m.mappingItemId)) return false;
      if (m.mappingId && m.mappingId !== mappingId) return false;
      if (onlyMatching && m.mappingId !== mappingId && score(m) === 0) return false;
      return resolveMovementNatureId(m, natures) === natureId;
    })
    .sort((a, b) => score(b) - score(a) || distance(a) - distance(b) || spendDate(a).localeCompare(spendDate(b)));
}
