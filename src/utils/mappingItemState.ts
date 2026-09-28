import type {
  MappingItem,
  MappingItemMonthState,
  MappingItemPayment,
  MappingItemPaymentAction,
} from '../types';
import { getItemManifestationDays } from './natureScheduling';

const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

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
  return {
    realized: rule.realized,
    paidByOthers: rule.paidByOthers,
    paidBy: rule.paidBy,
    skipped: rule.skipped,
    skipReason: rule.skipReason,
  };
}

/** Fora dos valores da competência: pago por outra pessoa ou não vai acontecer. */
export function isExcludedState(state: MappingItemMonthState): boolean {
  return !!(state.paidByOthers || state.skipped);
}

/** Preço por ocorrência vigente na competência (considera reajustes agendados). */
export function itemUnitPrice(item: MappingItem, monthKey?: string): number {
  if (monthKey) {
    const rule = (item.priceRules || [])
      .filter((r) => r.fromMonth <= monthKey)
      .sort((a, b) => a.fromMonth.localeCompare(b.fromMonth))
      .pop();
    if (rule) return rule.price;
  }
  return item.price || 0;
}

/** Valor mensal planejado do item (com reajuste vigente, quando informada a competência). */
export function mappingItemBaseValue(item: MappingItem, monthKey?: string): number {
  const hasRule = !!monthKey && (item.priceRules || []).some((r) => r.fromMonth <= monthKey);
  if (hasRule) {
    return round3((item.quantity || 0) * itemUnitPrice(item, monthKey) * (item.multiplierWeeks || 1));
  }
  return item.totalValue || (item.quantity || 0) * (item.price || 0) * (item.multiplierWeeks || 1);
}

export interface ItemOccurrence {
  date: string;  // YYYY-MM-DD
  value: number; // valor previsto desta ocorrência
}

/** Ocorrências (datas) do item na competência, com o valor previsto de cada uma. */
export function getItemOccurrences(item: MappingItem, monthKey: string): ItemOccurrence[] {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return [];
  const { days } = getItemManifestationDays(item, y, m);
  const daysInMonth = new Date(y, m, 0).getDate();
  const value = round3((item.quantity || 1) * itemUnitPrice(item, monthKey));
  const padM = String(m).padStart(2, '0');
  return Array.from(new Set(days.map((d) => Math.min(Math.max(1, d), daysInMonth))))
    .sort((a, b) => a - b)
    .map((d) => ({ date: `${y}-${padM}-${String(d).padStart(2, '0')}`, value }));
}

export interface MappingItemMonthSummary {
  state: MappingItemMonthState;
  payments: MappingItemPayment[];
  coveredDates: Map<string, MappingItemPayment>; // data coberta -> pagamento
  base: number;        // previsto do mês
  paid: number;        // total pago no mês
  openBalance: number; // diferenças deixadas em aberto (SALDO_ABERTO)
  pending: number;     // ainda a pagar no mês (datas não cobertas + saldos em aberto)
  value: number;       // entra na projeção: pago + pendente (zero se pago por terceiros)
  isSettled: boolean;  // nada pendente no mês
}

/** Resumo financeiro do item na competência. */
export function resolveMappingItemMonth(item: MappingItem, monthKey: string): MappingItemMonthSummary {
  const state = resolveMappingItemState(item, monthKey);
  const payments = item.payments?.[monthKey] || [];
  const base = mappingItemBaseValue(item, monthKey);
  const coveredDates = new Map<string, MappingItemPayment>();
  payments.forEach((p) => p.coveredDates.forEach((d) => coveredDates.set(d, p)));

  if (isExcludedState(state)) {
    return { state, payments, coveredDates, base, paid: 0, openBalance: 0, pending: 0, value: 0, isSettled: true };
  }

  if (payments.length === 0) {
    // Sem pagamentos registrados: "realizado" marca o mês inteiro como pago pelo valor previsto
    const paid = state.realized ? base : 0;
    const pending = state.realized ? 0 : base;
    return { state, payments, coveredDates, base, paid, openBalance: 0, pending, value: base, isSettled: pending === 0 };
  }

  const paid = round2(payments.reduce((acc, p) => acc + p.amount, 0));
  const occurrenceValue = (item.quantity || 1) * itemUnitPrice(item, monthKey);
  const pendingUncovered = state.realized ? 0 : Math.max(0, base - coveredDates.size * occurrenceValue);
  const openBalance = payments
    .filter((p) => p.action === 'SALDO_ABERTO')
    .reduce((acc, p) => acc + Math.max(0, p.expectedAmount - p.amount), 0);
  const pending = round2(pendingUncovered + openBalance);

  return {
    state,
    payments,
    coveredDates,
    base,
    paid,
    openBalance: round2(openBalance),
    pending,
    value: round2(paid + pending),
    isSettled: pending <= 0.005,
  };
}

/** Valor do item que entra na projeção da competência (pago + pendente; zero quando pago por terceiros). */
export function mappingItemMonthValue(item: MappingItem, monthKey: string): number {
  return resolveMappingItemMonth(item, monthKey).value;
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
  const clean: MappingItemMonthState = state.skipped
    ? { realized: false, paidByOthers: false, skipped: true, ...(state.skipReason?.trim() ? { skipReason: state.skipReason.trim() } : {}) }
    : {
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

export interface ItemPaymentInput {
  paidAt: string;
  amount: number;
  coveredDates: string[];
  reason?: string;
  action?: MappingItemPaymentAction;
}

/**
 * Registra um pagamento cobrindo datas da competência. Datas já pagas são ignoradas (sem duplicidade).
 * Com a ação REAJUSTE, o novo preço por ocorrência passa a valer desta competência em diante:
 * na competência atual (ou anterior) atualiza o preço do próprio item; numa futura, agenda um reajuste.
 */
export function registerItemPayment(
  item: MappingItem,
  monthKey: string,
  input: ItemPaymentInput
): Partial<MappingItem> {
  const existing = item.payments?.[monthKey] || [];
  const alreadyCovered = new Set(existing.flatMap((p) => p.coveredDates));
  const coveredDates = Array.from(new Set(input.coveredDates)).filter((d) => !alreadyCovered.has(d)).sort();
  if (coveredDates.length === 0) return {};

  const qty = item.quantity || 1;
  const expectedAmount = round2(coveredDates.length * qty * itemUnitPrice(item, monthKey));
  const payment: MappingItemPayment = {
    id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    paidAt: input.paidAt,
    amount: round2(input.amount),
    expectedAmount,
    coveredDates,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.action && Math.abs(input.amount - expectedAmount) >= 0.01 ? { action: input.action } : {}),
  };

  const patch: Partial<MappingItem> = {
    payments: { ...(item.payments || {}), [monthKey]: [...existing, payment] },
  };

  if (payment.action === 'REAJUSTE') {
    const newPrice = round3(payment.amount / (coveredDates.length * qty));
    if (monthKey <= currentMonthKey()) {
      patch.price = newPrice;
      patch.totalValue = round3(qty * newPrice * (item.multiplierWeeks || 1));
      patch.priceRules = (item.priceRules || []).filter((r) => r.fromMonth > monthKey);
    } else {
      patch.priceRules = [
        ...(item.priceRules || []).filter((r) => r.fromMonth < monthKey),
        { fromMonth: monthKey, price: newPrice },
      ];
    }
  }

  return patch;
}

/** Desfaz um pagamento (libera as datas cobertas). Reajustes de preço já aplicados são mantidos. */
export function removeItemPayment(item: MappingItem, monthKey: string, paymentId: string): Partial<MappingItem> {
  const remaining = (item.payments?.[monthKey] || []).filter((p) => p.id !== paymentId);
  const payments = { ...(item.payments || {}) };
  if (remaining.length > 0) payments[monthKey] = remaining;
  else delete payments[monthKey];
  return { payments };
}
