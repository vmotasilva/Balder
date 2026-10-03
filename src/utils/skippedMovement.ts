import type { Movement } from '../types';

/** Valor que teria sido realizado de um lançamento "Desconsiderado" (fica em originalAmount; o lançamento vale zero). */
export const skippedValue = (m: Movement): number =>
  (m.adjustmentReason === 'Desconsiderado' || m.installmentGroupId?.startsWith('skip_')) && (m.originalAmount || 0) > 0 ? m.originalAmount! : 0;
