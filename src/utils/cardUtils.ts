import type { CreditCardItem, FinancialCheckpoint, CheckpointBankDebt } from '../types';
import { getBankBranding } from './bankBranding';

/**
 * Normaliza o nome do banco para uma chave única canônica
 * Ex: 'Banco Inter', 'Inter', 'INTER S.A.' -> 'inter'
 * Ex: 'Nubank', 'Nu', 'Cartão Nubank' -> 'nubank'
 */
export function normalizeBankKey(bankOrName?: string): string {
  if (!bankOrName) return 'unknown';
  const brand = getBankBranding(bankOrName);
  if (brand && brand.id && brand.id !== 'other') {
    return brand.id;
  }
  return bankOrName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^banco\s+/, '')
    .replace(/\s+s\/?a\.?$/i, '')
    .replace(/\s+cartao$/i, '')
    .trim();
}

/**
 * Retorna uma chave única para identificar se dois registros se referem ao mesmo cartão físico
 */
export function getCardIdentityKey(card: { bank?: string; name?: string; dueDay?: number }): string {
  const bKey = normalizeBankKey(card.bank || card.name);
  const due = card.dueDay ? card.dueDay : 10;
  return `${bKey}_due${due}`;
}

/**
 * Mescla e remove cartões de crédito duplicados gerados por múltiplas execuções do Get Started ou sincronização.
 * Preserva o cartão com maior saldo utilizado e dados mais completos.
 */
export function deduplicateCards(cardsList: CreditCardItem[]): CreditCardItem[] {
  if (!cardsList || cardsList.length <= 1) return cardsList || [];

  const groups = new Map<string, CreditCardItem[]>();

  for (const card of cardsList) {
    const key = getCardIdentityKey(card);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(card);
  }

  const result: CreditCardItem[] = [];

  groups.forEach((items) => {
    if (items.length === 1) {
      result.push(items[0]);
      return;
    }

    // Se temos mais de um cartão com o mesmo banco e dia de vencimento, mesclamos:
    // Prioriza o que tem limite utilizado maior que zero (para não perder os gastos reais)
    const sorted = [...items].sort((a, b) => {
      const aUsed = a.limitUsed || 0;
      const bUsed = b.limitUsed || 0;
      if (bUsed !== aUsed) return bUsed - aUsed;
      return (b.limitTotal || 0) - (a.limitTotal || 0);
    });

    const primary = sorted[0];
    const brand = getBankBranding(primary.bank || primary.name);

    // Consolida o melhor limite total encontrado entre os duplicados
    const maxLimitTotal = Math.max(...items.map((i) => i.limitTotal || 0));
    const maxLimitUsed = Math.max(...items.map((i) => i.limitUsed || 0));

    result.push({
      ...primary,
      bank: brand.name || primary.bank,
      limitTotal: maxLimitTotal > 0 ? maxLimitTotal : primary.limitTotal,
      limitUsed: maxLimitUsed,
      color: primary.color || brand.primaryColor,
    });
  });

  return result;
}

/**
 * Verifica se um cartão está incluído e sendo considerado nas faturas do Marco de Início Ativo
 */
export function isCardInActiveCheckpoint(
  card: CreditCardItem,
  checkpoint: FinancialCheckpoint | null
): {
  isIncluded: boolean;
  debt?: CheckpointBankDebt;
  totalDebt: number;
  invoicesCount: number;
} {
  if (!checkpoint) {
    return { isIncluded: false, totalDebt: 0, invoicesCount: 0 };
  }

  const cBankKey = normalizeBankKey(card.bank || card.name);

  if (checkpoint.cardDebts && checkpoint.cardDebts.length > 0) {
    // 1. Busca por ID direto do cartão
    let match = checkpoint.cardDebts.find((bd) => bd.cardId && bd.cardId === card.id);

    // 2. Fallback por banco canônico e vencimento compatível
    if (!match) {
      match = checkpoint.cardDebts.find((bd) => {
        const bdBankKey = normalizeBankKey(bd.bankName || bd.cardName);
        if (bdBankKey === cBankKey) {
          if (bd.dueDay && card.dueDay) {
            return bd.dueDay === card.dueDay;
          }
          return true;
        }
        return false;
      });
    }

    if (match) {
      return {
        isIncluded: true,
        debt: match,
        totalDebt: match.totalDebt || 0,
        invoicesCount: match.invoices?.length || 0,
      };
    }
  }

  // 3. Fallback para marcos antigos legados que usavam apenas creditCardDebt global
  if (checkpoint.creditCardDebt && checkpoint.creditCardDebt > 0) {
    const cpNameKey = normalizeBankKey(checkpoint.cardName || '');
    if (cpNameKey && cpNameKey === cBankKey) {
      return {
        isIncluded: true,
        totalDebt: checkpoint.creditCardDebt,
        invoicesCount: checkpoint.cardInstallments || 1,
      };
    }
  }

  return { isIncluded: false, totalDebt: 0, invoicesCount: 0 };
}

/**
 * Resumo dos cartões considerados no marco ativo
 */
export function getActiveCheckpointCardsSummary(
  cards: CreditCardItem[],
  checkpoint: FinancialCheckpoint | null
) {
  let activeCardsCount = 0;
  let totalActiveDebt = 0;
  const activeCardIds = new Set<string>();

  for (const card of cards) {
    const status = isCardInActiveCheckpoint(card, checkpoint);
    if (status.isIncluded) {
      activeCardsCount++;
      totalActiveDebt += status.totalDebt;
      activeCardIds.add(card.id);
    }
  }

  return {
    totalCards: cards.length,
    activeCardsCount,
    unlinkedCardsCount: Math.max(0, cards.length - activeCardsCount),
    totalActiveDebt,
    activeCardIds,
  };
}
