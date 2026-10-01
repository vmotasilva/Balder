import type { ExpenseNature } from '../types';

/** Categorias que o sistema usa por conta própria (faturas, lançamentos sem natureza); nunca viram natureza do usuário. */
const BASE_CATEGORY_NAMES = new Set(['fatura de cartao', 'fatura do cartao', 'nao analisada', 'geral', 'outros']);

const plain = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const RESTORED_MARKER = 'Natureza restaurada automaticamente';

export const isBaseCategoryName = (name: string) => BASE_CATEGORY_NAMES.has(plain(name));

/**
 * Natureza de base: criada pelo sistema (recuperada de uma categoria de lançamento sem natureza,
 * ou categoria interna), não pelo usuário. Fica oculta e não pode ser editada nem excluída.
 */
export const isBaseNature = (n: ExpenseNature) =>
  isBaseCategoryName(n.name) || (n.description || '').startsWith(RESTORED_MARKER);

const words = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);

/**
 * Natureza do usuário que já cobre uma categoria: mesmo nome ou nome que a contém
 * ("Saúde" já está em "Saúde & Cuidados"; "Transporte" em "Transporte & Mobilidade").
 * Evita criar uma natureza nova quando já existe uma equivalente.
 */
export const natureCoveringCategory = (category: string, natures: ExpenseNature[]): ExpenseNature | undefined => {
  const cat = words(category);
  if (cat.length === 0) return undefined;
  return userNatures(natures).find((n) => {
    const nameWords = words(n.name);
    return cat.every((w) => nameWords.includes(w));
  });
};

export const userNatures = (natures: ExpenseNature[]) => natures.filter((n) => !isBaseNature(n));
