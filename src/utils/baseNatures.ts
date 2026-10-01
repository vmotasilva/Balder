import type { ExpenseNature } from '../types';

/** Categorias que o sistema usa por conta própria (faturas, lançamentos sem natureza); nunca viram natureza do usuário. */
const BASE_CATEGORY_NAMES = new Set(['fatura de cartão', 'não analisada', 'geral', 'outros']);

const RESTORED_MARKER = 'Natureza restaurada automaticamente';

export const isBaseCategoryName = (name: string) => BASE_CATEGORY_NAMES.has(name.trim().toLowerCase());

/**
 * Natureza de base: criada pelo sistema (recuperada de uma categoria de lançamento sem natureza,
 * ou categoria interna), não pelo usuário. Fica oculta e não pode ser editada nem excluída.
 */
export const isBaseNature = (n: ExpenseNature) =>
  isBaseCategoryName(n.name) || (n.description || '').startsWith(RESTORED_MARKER);

export const userNatures = (natures: ExpenseNature[]) => natures.filter((n) => !isBaseNature(n));
