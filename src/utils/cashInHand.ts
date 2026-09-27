/** Origem "Dinheiro em mãos": dinheiro físico, acompanhado separado do dinheiro em conta. */
export const CASH_IN_HAND = 'Dinheiro em mãos';

export const isCashInHand = (bank?: string | null): boolean =>
  (bank || '').trim().toLowerCase() === CASH_IN_HAND.toLowerCase();
