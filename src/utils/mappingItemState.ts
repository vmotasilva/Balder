import type { MappingItem, MappingItemMonthState } from '../types';

/**
 * Situação de um item mapeado em uma competência (YYYY-MM).
 * Precedência: ajuste pontual do mês > regra mais recente cujo início seja <= competência > padrão (previsto).
 */
export function resolveMappingItemState(item: MappingItem, monthKey: string): MappingItemMonthState {
  const override = item.monthStates?.[monthKey];
  if (override) return override;

  const rule = (item.stateRules || [])
    .filter((r) => r.fromMonth <= monthKey)
    .sort((a, b) => a.fromMonth.localeCompare(b.fromMonth))
    .pop();
  if (!rule) return {};
  return { realized: rule.realized, paidByOthers: rule.paidByOthers, paidBy: rule.paidBy };
}

/** Valor mensal planejado do item, sem considerar a situação da competência. */
export function mappingItemBaseValue(item: MappingItem): number {
  return item.totalValue || (item.quantity || 0) * (item.price || 0) * (item.multiplierWeeks || 1);
}

/** Valor do item que entra na projeção da competência (zero quando pago por terceiros). */
export function mappingItemMonthValue(item: MappingItem, monthKey: string): number {
  return resolveMappingItemState(item, monthKey).paidByOthers ? 0 : mappingItemBaseValue(item);
}

/**
 * Retorna o item com a nova situação aplicada.
 * - Só esta competência: grava um ajuste pontual.
 * - Esta e as futuras: grava uma regra a partir da competência, descartando ajustes pontuais
 *   e regras de competências iguais ou posteriores (a nova regra passa a valer para todas elas).
 */
export function applyMappingItemState(
  item: MappingItem,
  monthKey: string,
  state: MappingItemMonthState,
  applyToFuture: boolean
): Pick<MappingItem, 'monthStates' | 'stateRules'> {
  const clean: MappingItemMonthState = {
    realized: !!state.realized,
    paidByOthers: !!state.paidByOthers,
    ...(state.paidByOthers && state.paidBy?.trim() ? { paidBy: state.paidBy.trim() } : {}),
  };

  if (!applyToFuture) {
    return {
      monthStates: { ...(item.monthStates || {}), [monthKey]: clean },
      stateRules: item.stateRules || [],
    };
  }

  const monthStates = Object.fromEntries(
    Object.entries(item.monthStates || {}).filter(([key]) => key < monthKey)
  );
  const stateRules = [
    ...(item.stateRules || []).filter((r) => r.fromMonth < monthKey),
    { fromMonth: monthKey, ...clean },
  ];
  return { monthStates, stateRules };
}
