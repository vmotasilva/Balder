import type {
  MappingItem,
  MappingItemDayRule,
  MappingItemMonthState,
  MappingItemPayment,
  MappingItemPaymentAction,
} from '../types';
import { getItemManifestationDays, WEEKDAY_OPTIONS } from './natureScheduling';

const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const latestStateRule = (item: MappingItem, monthKey: string) =>
  (item.stateRules || [])
    .filter((r) => r.fromMonth <= monthKey)
    .sort((a, b) => a.fromMonth.localeCompare(b.fromMonth))
    .pop();

/**
 * Situação de um item mapeado em uma competência (YYYY-MM).
 * Precedência: ajuste pontual do mês > regra mais recente cujo início seja <= competência > padrão (previsto).
 */
export function resolveMappingItemState(item: MappingItem, monthKey: string): MappingItemMonthState {
  const override = item.monthStates?.[monthKey];
  if (override) return override;

  const rule = latestStateRule(item, monthKey);
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

/**
 * "Pago por outra pessoa" vindo de uma regra recorrente ainda não confirmada na competência: o item segue fora da
 * projeção (o flag vale), mas a pessoa precisa confirmar mês a mês que o terceiro arcou. Só pede para competências
 * que já começaram; a competência em que a regra foi criada já nasce confirmada.
 */
export function needsOthersConfirmation(item: MappingItem, monthKey: string): boolean {
  if (item.monthStates?.[monthKey] || monthKey > currentMonthKey()) return false;
  const rule = latestStateRule(item, monthKey);
  return !!rule && !!rule.paidByOthers && !rule.skipped && rule.fromMonth < monthKey;
}

/** Confirma (a pessoa de fato pagou o item) ou nega (eu paguei) o "pago por outra pessoa" da competência. */
export function confirmOthersPayment(
  item: MappingItem,
  monthKey: string,
  paidByOthers: boolean
): Pick<MappingItem, 'monthStates' | 'stateRules'> {
  const { paidBy } = resolveMappingItemState(item, monthKey);
  return applyMappingItemState(item, monthKey, { paidByOthers, ...(paidByOthers && paidBy ? { paidBy } : {}) }, false);
}

export interface MappingExcludedSummary {
  amount: number;  // previsto dos itens fora da projeção na competência
  count: number;
  toConfirm: number; // itens "pago por outra pessoa" aguardando a confirmação do mês
}

/** O que o mapeamento tem na competência mas não entra na projeção (pago por terceiros ou que não vai acontecer). */
export function resolveMappingExcluded(items: MappingItem[], monthKey: string): MappingExcludedSummary {
  const result: MappingExcludedSummary = { amount: 0, count: 0, toConfirm: 0 };
  items.forEach((item) => {
    if (!isExcludedState(resolveMappingItemState(item, monthKey))) return;
    result.amount = round2(result.amount + mappingItemBaseValue(item, monthKey));
    result.count += 1;
    if (needsOthersConfirmation(item, monthKey)) result.toConfirm += 1;
  });
  return result;
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

/** Acréscimo por data vindo de valores não pagos redistribuídos para as ocorrências seguintes. */
export function carryExtras(item: MappingItem, monthKey: string): Map<string, number> {
  const extras = new Map<string, number>();
  (item.payments?.[monthKey] || []).forEach((p) =>
    Object.entries(p.carryTo || {}).forEach(([date, extra]) => extras.set(date, round2((extras.get(date) || 0) + extra)))
  );
  return extras;
}

/** Ocorrências (datas) do item na competência, com o valor previsto de cada uma. */
export function getItemOccurrences(item: MappingItem, monthKey: string): ItemOccurrence[] {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return [];
  const { days } = getItemManifestationDays(item, y, m);
  const daysInMonth = new Date(y, m, 0).getDate();
  const value = round3((item.quantity || 1) * itemUnitPrice(item, monthKey));
  const padM = String(m).padStart(2, '0');
  const extras = carryExtras(item, monthKey);
  return Array.from(new Set(days.map((d) => Math.min(Math.max(1, d), daysInMonth))))
    .sort((a, b) => a - b)
    .map((d) => {
      const date = `${y}-${padM}-${String(d).padStart(2, '0')}`;
      return { date, value: round3(value + (extras.get(date) || 0)) };
    });
}

export interface MappingItemMonthSummary {
  state: MappingItemMonthState;
  payments: MappingItemPayment[];
  coveredDates: Map<string, MappingItemPayment>; // data coberta -> pagamento
  base: number;        // previsto do mês
  paid: number;        // total pago no mês
  openBalance: number; // diferenças deixadas em aberto (SALDO_ABERTO)
  waived: number;      // previsto dispensado em pagamentos do mapeamento (não se mantém)
  pending: number;    // ainda a pagar no mês (datas não cobertas + saldos em aberto)
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
    return { state, payments, coveredDates, base, paid: 0, openBalance: 0, waived: 0, pending: 0, value: 0, isSettled: true };
  }

  // Valor ainda agendado: as ocorrências (datas) do item que não foram cobertas por pagamento. Item com multiplicador
  // maior que as datas do mês (ex.: 22 sem. num item semanal de 5 sábados) não pode ter em aberto mais do que isso.
  const occurrences = getItemOccurrences(item, monthKey);
  const scheduledTotal = occurrences.reduce((acc, o) => acc + o.value, 0);
  const hasSchedule = scheduledTotal > 0.005;
  const scheduledOpen = (covered: Map<string, MappingItemPayment>) =>
    occurrences.filter((o) => !covered.has(o.date)).reduce((acc, o) => acc + o.value, 0);

  if (payments.length === 0) {
    // Sem pagamentos registrados: "realizado" marca o mês inteiro como pago pelo valor previsto
    const paid = state.realized ? base : 0;
    const pending = state.realized ? 0 : hasSchedule ? round2(Math.min(base, scheduledTotal)) : base;
    return { state, payments, coveredDates, base, paid, openBalance: 0, waived: 0, pending, value: round2(paid + pending), isSettled: pending === 0 };
  }

  const paid = round2(payments.reduce((acc, p) => acc + p.amount, 0));
  const occurrenceValue = (item.quantity || 1) * itemUnitPrice(item, monthKey);
  // Partes de pagamentos do mapeamento (modo Resumo) abatem do previsto sem cobrir datas
  const mappingShares = payments.filter((p) => p.mappingPaymentId).reduce((acc, p) => acc + p.amount, 0);
  // Previsto dispensado no pagamento do mapeamento ("o restante não se mantém"): sai do previsto, sem contar como pago
  const mappingWaived = payments.filter((p) => p.mappingPaymentId).reduce((acc, p) => acc + (p.waived || 0), 0);
  const extras = carryExtras(item, monthKey);
  const totalCarry = [...extras.values()].reduce((acc, v) => acc + v, 0);
  // Redistribuído de uma data dispensada: o planejado cresce nas seguintes e cai na dispensada, fechando no mesmo total
  const coveredValue = [...coveredDates.keys()].reduce((acc, d) => acc + occurrenceValue + (extras.get(d) || 0), 0);
  const pendingByBase = Math.max(0, base + totalCarry - coveredValue - mappingShares - mappingWaived);
  const pendingUncovered = state.realized
    ? 0
    : hasSchedule
    ? Math.min(pendingByBase, Math.max(0, scheduledOpen(coveredDates) - mappingShares - mappingWaived))
    : pendingByBase;
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
    waived: round2(mappingWaived),
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
  /** O que não foi pago é redistribuído para as ocorrências seguintes ainda abertas da competência. */
  redistribute?: boolean;
  paymentMethod?: MappingItem['paymentMethod'];
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
  const extras = carryExtras(item, monthKey);
  const expectedAmount = round2(
    coveredDates.reduce((acc, d) => acc + qty * itemUnitPrice(item, monthKey) + (extras.get(d) || 0), 0)
  );
  const payment: MappingItemPayment = {
    id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    paidAt: input.paidAt,
    amount: round2(input.amount),
    expectedAmount,
    coveredDates,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
    ...(input.action && Math.abs(input.amount - expectedAmount) >= 0.01 ? { action: input.action } : {}),
  };

  if (input.redistribute && expectedAmount - payment.amount > 0.005) {
    const lastCovered = coveredDates[coveredDates.length - 1];
    const later = getItemOccurrences(item, monthKey)
      .map((o) => o.date)
      .filter((d) => d > lastCovered && !alreadyCovered.has(d) && !coveredDates.includes(d));
    if (later.length > 0) {
      const carry = round2(expectedAmount - payment.amount);
      const share = Math.floor((carry / later.length) * 100) / 100;
      payment.carryTo = Object.fromEntries(
        later.map((d, i) => [d, i === later.length - 1 ? round2(carry - share * (later.length - 1)) : share])
      );
    }
  }

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

const nextMonthKey = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number);
  return `${new Date(y, m, 1).getFullYear()}-${String(new Date(y, m, 1).getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Muda a data prevista de uma ocorrência ainda não paga, dentro da mesma competência.
 * - 'ONE': só esta ocorrência (os outros meses seguem no dia original).
 * - 'FUTURE': corrige o dia previsto do item daqui em diante (mensal: o dia do mês; quinzenal: o dia da quinzena;
 *   semanal: o dia da semana). Se a competência já tem pagamento cobrindo datas, a regra começa na seguinte e esta
 *   competência recebe só a mudança desta ocorrência, para não soltar o que já foi pago.
 * Devolve só o que gravar no item (vazio quando a mudança não vale).
 */
export function rescheduleOccurrence(
  item: MappingItem,
  monthKey: string,
  fromDate: string,
  toDate: string,
  scope: 'ONE' | 'FUTURE'
): Partial<MappingItem> {
  if (!toDate || toDate === fromDate || !toDate.startsWith(monthKey)) return {};
  const occurrences = getItemOccurrences(item, monthKey);
  if (!occurrences.some((o) => o.date === fromDate) || occurrences.some((o) => o.date === toDate)) return {};
  const covered = new Set((item.payments?.[monthKey] || []).flatMap((p) => p.coveredDates));
  if (covered.has(fromDate)) return {};

  const [y, m] = monthKey.split('-').map(Number);
  const { periodType } = getItemManifestationDays(item, y, m);

  const withMoveInMonth = (moves: Record<string, Record<string, string>>) => {
    const month = { ...(moves[monthKey] || {}) };
    // Mover de novo uma data já movida atualiza a original; voltar ao dia original desfaz a mudança
    const origin = Object.keys(month).find((k) => month[k] === fromDate) ?? fromDate;
    if (origin === toDate) delete month[origin];
    else month[origin] = toDate;
    const next = { ...moves };
    if (Object.keys(month).length > 0) next[monthKey] = month;
    else delete next[monthKey];
    return next;
  };

  if (scope === 'ONE' || periodType === 'DIARIO') return { dateMoves: withMoveInMonth(item.dateMoves || {}) };

  const day = Number(toDate.slice(8, 10));
  const rule: MappingItemDayRule =
    periodType === 'MENSAL'
      ? { fromMonth: monthKey, dayOfMonth: day }
      : periodType === 'QUINZENAL'
      ? { fromMonth: monthKey, dayOfFortnight: day > 15 ? day - 15 : day }
      : {
          fromMonth: monthKey,
          dayOfWeek: WEEKDAY_OPTIONS.find((w) => w.jsDay === new Date(y, m - 1, day).getDay())?.value,
        };

  const keepPaid = covered.size > 0;
  if (keepPaid) rule.fromMonth = nextMonthKey(monthKey);
  const dayRules = [...(item.dayRules || []).filter((r) => r.fromMonth < rule.fromMonth), rule];
  // Mudanças pontuais de meses que a regra passa a cobrir deixam de valer (o mês pago guarda só a própria)
  const dateMoves = Object.fromEntries(Object.entries(item.dateMoves || {}).filter(([key]) => key < rule.fromMonth));
  return { dayRules, dateMoves: keepPaid ? withMoveInMonth(dateMoves) : dateMoves };
}

/** Desfaz um pagamento (libera as datas cobertas). Reajustes de preço já aplicados são mantidos. */
export function removeItemPayment(item: MappingItem, monthKey: string, paymentId: string): Partial<MappingItem> {
  const remaining = (item.payments?.[monthKey] || []).filter((p) => p.id !== paymentId);
  const payments = { ...(item.payments || {}) };
  if (remaining.length > 0) payments[monthKey] = remaining;
  else delete payments[monthKey];
  return { payments };
}

// ─── Mapeamento em modo Resumo: o mapeamento é a linha de cobrança ───────────────────────────────
// Os itens só compõem o previsto; o pagamento é lançado no mapeamento (valor e data) e guardado como
// uma parte em cada item, na proporção do previsto do item no mês (assim previsões e gastos seguem
// funcionando item a item). Pagamentos parciais vão abatendo até quitar o mapeamento.

export interface MappingMonthPayment {
  id: string;
  paidAt: string;
  amount: number;
  waived: number; // previsto dispensado junto com este pagamento
  movementId?: string; // gasto já existente que este lançamento associou ao mapeamento
}

export interface MappingMonthSummary {
  planned: number; // previsto do mês (itens que contam na competência)
  paid: number;
  pending: number;
  payments: MappingMonthPayment[];
}

type MappingLike = { items: MappingItem[] };

/** Totais do mapeamento na competência e os pagamentos lançados nele. */
export function resolveMappingMonth(mapping: MappingLike, monthKey: string): MappingMonthSummary {
  let planned = 0;
  let paid = 0;
  let pending = 0;
  const byPayment = new Map<string, MappingMonthPayment>();
  mapping.items.forEach((item) => {
    const s = resolveMappingItemMonth(item, monthKey);
    if (isExcludedState(s.state)) return;
    planned += s.base - s.waived;
    paid += s.paid;
    pending += s.pending;
    s.payments.forEach((p) => {
      if (!p.mappingPaymentId) return;
      const agg: MappingMonthPayment =
        byPayment.get(p.mappingPaymentId) || { id: p.mappingPaymentId, paidAt: p.paidAt, amount: 0, waived: 0, movementId: p.movementId };
      agg.amount = round2(agg.amount + p.amount);
      agg.waived = round2(agg.waived + (p.waived || 0));
      byPayment.set(p.mappingPaymentId, agg);
    });
  });
  return {
    planned: round2(planned),
    paid: round2(paid),
    pending: round2(pending),
    payments: [...byPayment.values()].sort((a, b) => a.paidAt.localeCompare(b.paidAt)),
  };
}

/**
 * Lança um pagamento no mapeamento. Devolve, por item, as alterações a gravar.
 * O valor é dividido na proporção do previsto de cada item no mês (o último fica com o arredondamento).
 * `waive` é o restante do previsto que não se mantém: sai do previsto, dividido do mesmo jeito, sem contar como pago.
 * Com valor zero e `waive`, só desconsidera o previsto (nada foi gasto). `movementId` é o gasto já existente que o
 * pagamento associa (cada parte guarda o id, para desfazer e para não contar o gasto duas vezes).
 */
export function registerMappingPayment(
  mapping: MappingLike,
  monthKey: string,
  input: { paidAt: string; amount: number; waive?: number; movementId?: string }
): { itemId: string; patch: Partial<MappingItem> }[] {
  const amount = round2(Math.max(0, input.amount));
  const waive = round2(Math.max(0, input.waive || 0));
  if (amount <= 0 && waive <= 0) return [];
  const eligible = mapping.items
    .map((item) => ({ item, s: resolveMappingItemMonth(item, monthKey) }))
    .filter(({ s }) => !isExcludedState(s.state));
  if (eligible.length === 0) return [];
  const totalBase = eligible.reduce((acc, e) => acc + e.s.base, 0);
  // O previsto dispensado vai só para quem ainda tem pendente (item já pago não absorve a dispensa)
  const totalPending = eligible.reduce((acc, e) => acc + e.s.pending, 0);
  const lastPending = eligible.reduce((acc, e, i) => (e.s.pending > 0.005 ? i : acc), eligible.length - 1);
  const id = `mpay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const split = (total: number, s: { base: number }, i: number, remaining: number) =>
    i === eligible.length - 1 ? remaining : round2(totalBase > 0 ? (total * s.base) / totalBase : total / eligible.length);
  let remaining = amount;
  let remainingWaive = waive;
  return eligible.map(({ item, s }, i) => {
    const share = split(amount, s, i, remaining);
    remaining = round2(remaining - share);
    const waivedShare =
      waive <= 0
        ? 0
        : totalPending > 0.005
        ? i === lastPending
          ? remainingWaive
          : s.pending > 0.005
          ? round2(Math.min(s.pending, (waive * s.pending) / totalPending, remainingWaive))
          : 0
        : split(waive, s, i, remainingWaive);
    remainingWaive = round2(remainingWaive - waivedShare);
    const payment: MappingItemPayment = {
      id: `${id}_${item.id}`,
      paidAt: input.paidAt,
      amount: share,
      expectedAmount: share,
      coveredDates: [],
      mappingPaymentId: id,
      ...(waivedShare > 0 ? { waived: waivedShare } : {}),
      ...(input.movementId ? { movementId: input.movementId } : {}),
    };
    const existing = item.payments?.[monthKey] || [];
    return { itemId: item.id, patch: { payments: { ...(item.payments || {}), [monthKey]: [...existing, payment] } } };
  });
}

export interface MappingPeriodGap {
  /** Previsto das compras do período (datas dos itens dentro dele), ainda não pago nem dispensado antes deste lançamento. */
  expected: number;
  /** Ocorrências previstas depois do período, no mesmo mês: onde o restante se encaixaria se for mantido. */
  laterOccurrences: number;
}

/**
 * Quanto do previsto do período de acompanhamento (semana, quinzena ou mês) ainda faltava antes de um lançamento.
 * Sem compras previstas dentro do período, vale o que falta no mês inteiro.
 */
export function resolveMappingPeriodGap(
  mapping: MappingLike,
  monthKey: string,
  range: { from: string; to: string }
): MappingPeriodGap {
  const month = resolveMappingMonth(mapping, monthKey);
  let inPeriod = 0;
  let later = 0;
  mapping.items.forEach((item) => {
    if (isExcludedState(resolveMappingItemState(item, monthKey))) return;
    getItemOccurrences(item, monthKey).forEach((o) => {
      if (o.date >= range.from && o.date <= range.to) inPeriod += o.value;
      else if (o.date > range.to) later += 1;
    });
  });
  const settledInPeriod = month.payments
    .filter((p) => p.paidAt >= range.from && p.paidAt <= range.to)
    .reduce((acc, p) => acc + p.amount + p.waived, 0);
  const expected = inPeriod > 0.005 ? Math.max(0, inPeriod - settledInPeriod) : month.pending;
  return { expected: round2(Math.min(expected, month.pending)), laterOccurrences: later };
}

/**
 * Desconsidera o previsto ainda aberto do período (semana, quinzena ou mês): sai do previsto sem contar como pago.
 * Devolve o valor descartado e as alterações a gravar (vazias quando não havia nada em aberto no período).
 */
export function waiveMappingPeriod(
  mapping: MappingLike,
  monthKey: string,
  range: { from: string; to: string }
): { waived: number; changes: { itemId: string; patch: Partial<MappingItem> }[] } {
  const { expected } = resolveMappingPeriodGap(mapping, monthKey, range);
  if (expected <= 0.005) return { waived: 0, changes: [] };
  return { waived: expected, changes: registerMappingPayment(mapping, monthKey, { paidAt: range.from, amount: 0, waive: expected }) };
}

/** Desfaz um pagamento lançado no mapeamento (remove a parte de cada item). */
export function removeMappingPayment(
  mapping: MappingLike,
  monthKey: string,
  mappingPaymentId: string
): { itemId: string; patch: Partial<MappingItem> }[] {
  return mapping.items
    .filter((item) => (item.payments?.[monthKey] || []).some((p) => p.mappingPaymentId === mappingPaymentId))
    .map((item) => {
      const remaining = (item.payments?.[monthKey] || []).filter((p) => p.mappingPaymentId !== mappingPaymentId);
      const payments = { ...(item.payments || {}) };
      if (remaining.length > 0) payments[monthKey] = remaining;
      else delete payments[monthKey];
      return { itemId: item.id, patch: { payments } };
    });
}
