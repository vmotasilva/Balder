import type { ExpenseNature, Movement } from '../types';
import { getItemOccurrences, isExcludedState, resolveMappingItemMonth } from './mappingItemState';

/** Período em que o usuário gosta de acompanhar as finanças. */
export type TrackingPeriod = 'SEMANA' | 'QUINZENA' | 'MES';

export const TRACKING_PERIOD_LABELS: Record<TrackingPeriod, { name: string; this: string; that: string; end: string }> = {
  SEMANA: { name: 'Semana', this: 'nesta semana', that: 'na semana', end: 'até domingo' },
  QUINZENA: { name: 'Quinzena', this: 'nesta quinzena', that: 'na quinzena', end: 'até o fim da quinzena' },
  MES: { name: 'Mês', this: 'neste mês', that: 'no mês', end: 'até o fim do mês' },
};

export interface PeriodRange {
  from: string; // YYYY-MM-DD (inclusive)
  to: string; // YYYY-MM-DD (inclusive)
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Período que contém a data: semana de segunda a domingo, quinzena 1–15 / 16–fim, mês inteiro. */
export function trackingPeriodRange(period: TrackingPeriod, date: Date = new Date()): PeriodRange {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (period === 'SEMANA') {
    const start = new Date(d);
    start.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: isoOf(start), to: isoOf(end) };
  }
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (period === 'QUINZENA') {
    const first = d.getDate() <= 15;
    return {
      from: isoOf(new Date(d.getFullYear(), d.getMonth(), first ? 1 : 16)),
      to: isoOf(new Date(d.getFullYear(), d.getMonth(), first ? 15 : lastDay)),
    };
  }
  return {
    from: isoOf(new Date(d.getFullYear(), d.getMonth(), 1)),
    to: isoOf(new Date(d.getFullYear(), d.getMonth(), lastDay)),
  };
}

/** Uma data dentro do período `offset` períodos distante do que contém a data (negativo = passado). */
export function shiftPeriodDate(period: TrackingPeriod, date: Date, offset: number): Date {
  if (period === 'SEMANA') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7 * offset);
  if (period === 'MES') return new Date(date.getFullYear(), date.getMonth() + offset, 1);
  const half = date.getMonth() * 2 + (date.getDate() <= 15 ? 0 : 1) + offset;
  return new Date(date.getFullYear(), Math.floor(half / 2), ((half % 2) + 2) % 2 === 0 ? 1 : 16);
}

const monthName = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'long' });

/** Descrição curta do período: "22 a 28 de setembro", "2ª quinzena de setembro (16 a 30)", "Setembro de 2026". */
export function periodRangeLabel(period: TrackingPeriod, range: PeriodRange, today: Date = new Date()): string {
  const [y1, m1, d1] = range.from.split('-').map(Number);
  const [y2, m2, d2] = range.to.split('-').map(Number);
  const from = new Date(y1, m1 - 1, d1);
  const to = new Date(y2, m2 - 1, d2);
  const year = (d: Date) => (d.getFullYear() !== today.getFullYear() ? ` de ${d.getFullYear()}` : '');
  if (period === 'MES') {
    const name = monthName(from);
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${from.getFullYear()}`;
  }
  if (period === 'QUINZENA') {
    return `${d1 === 1 ? '1ª' : '2ª'} quinzena de ${monthName(from)}${year(from)} (${d1} a ${d2})`;
  }
  if (m1 === m2) return `${d1} a ${d2} de ${monthName(to)}${year(to)}`;
  return `${d1} de ${monthName(from)}${y1 !== y2 ? year(from) : ''} a ${d2} de ${monthName(to)}${year(to)}`;
}

/** Os `count` períodos imediatamente anteriores ao que contém a data (do mais recente para o mais antigo). */
export function previousPeriodRanges(period: TrackingPeriod, date: Date, count: number): PeriodRange[] {
  const ranges: PeriodRange[] = [];
  let cursor = trackingPeriodRange(period, date);
  for (let i = 0; i < count; i++) {
    const [y, m, dd] = cursor.from.split('-').map(Number);
    cursor = trackingPeriodRange(period, new Date(y, m - 1, dd - 1));
    ranges.push(cursor);
  }
  return ranges;
}

const daysBetween = (range: PeriodRange) => {
  const [y1, m1, d1] = range.from.split('-').map(Number);
  const [y2, m2, d2] = range.to.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000) + 1;
};

/** Parte do teto mensal que cabe no período (proporcional aos dias do mês em que o período começa). */
export function periodShareOfMonthly(monthlyAmount: number, range: PeriodRange): number {
  const [y, m] = range.from.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  return round2((monthlyAmount * daysBetween(range)) / daysInMonth);
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** A natureza de um lançamento: vínculo direto ou categoria com o mesmo nome. */
function movementNatureId(m: Movement, natures: ExpenseNature[]): string | undefined {
  if (m.natureId && natures.some((n) => n.id === m.natureId)) return m.natureId;
  const cat = normalize(m.category || '');
  if (!cat) return undefined;
  return natures.find((n) => normalize(n.name) === cat)?.id;
}

/**
 * Quanto já foi gasto em cada natureza dentro do período: saídas realizadas (pela data do pagamento)
 * e pagamentos registrados nos itens das naturezas.
 */
export function natureSpendingInRange(
  natures: ExpenseNature[],
  movements: Movement[],
  range: PeriodRange
): Record<string, number> {
  const inRange = (date?: string) => !!date && date >= range.from && date <= range.to;
  const totals: Record<string, number> = {};
  const add = (natureId: string, amount: number) => {
    totals[natureId] = round2((totals[natureId] || 0) + amount);
  };

  movements.forEach((m) => {
    if (m.status !== 'REALIZADA' || m.type !== 'PAGAR') return;
    if (m.category === 'Cartões' || m.category === 'Empréstimos') return;
    if (!inRange(m.paymentDate || m.dueDate)) return;
    const natureId = movementNatureId(m, natures);
    if (natureId) add(natureId, m.actualAmount ?? m.amount);
  });

  natures.forEach((nat) => {
    nat.mappings.forEach((mapping) => {
      mapping.items.forEach((item) => {
        Object.values(item.payments || {}).forEach((list) => {
          list.forEach((p) => {
            if (inRange(p.paidAt)) add(nat.id, p.amount);
          });
        });
      });
    });
  });

  return totals;
}

/**
 * Quanto ainda está previsto em cada natureza dentro do período, de hoje em diante: ocorrências dos itens
 * das naturezas ainda não pagas (mesma distribuição da previsão de caixa) e contas previstas da natureza.
 */
export function naturePlannedInRange(
  natures: ExpenseNature[],
  movements: Movement[],
  range: PeriodRange,
  todayIso: string
): Record<string, number> {
  const from = range.from > todayIso ? range.from : todayIso;
  const totals: Record<string, number> = {};
  if (from > range.to) return totals;
  const inRange = (date: string) => date >= from && date <= range.to;
  const add = (natureId: string, amount: number) => {
    if (amount > 0) totals[natureId] = round2((totals[natureId] || 0) + amount);
  };

  movements.forEach((m) => {
    if (m.status !== 'PREVISTA' || m.type !== 'PAGAR') return;
    if (m.category === 'Cartões' || m.category === 'Empréstimos') return;
    if (!inRange(m.dueDate)) return;
    const natureId = movementNatureId(m, natures);
    if (natureId) add(natureId, m.amount);
  });

  const monthKeys: string[] = [];
  const [fy, fm] = from.split('-').map(Number);
  for (let d = new Date(fy, fm - 1, 1); isoOf(d).slice(0, 7) <= range.to.slice(0, 7); d.setMonth(d.getMonth() + 1)) {
    monthKeys.push(isoOf(d).slice(0, 7));
  }

  natures.forEach((nat) => {
    nat.mappings.forEach((mapping) => {
      mapping.items.forEach((item) => {
        monthKeys.forEach((monthKey) => {
          const monthNumber = Number(monthKey.slice(5, 7));
          if (mapping.applicableMonths && mapping.applicableMonths.length > 0 && !mapping.applicableMonths.includes(monthNumber)) {
            return;
          }
          const summary = resolveMappingItemMonth(item, monthKey);
          if (isExcludedState(summary.state) || summary.pending <= 0.005 || summary.state.realized) return;
          const uncovered = getItemOccurrences(item, monthKey).filter((o) => !summary.coveredDates.has(o.date));
          if (uncovered.length === 0) return;
          const perOccurrence = Math.max(0, summary.pending - summary.openBalance) / uncovered.length;
          uncovered.forEach((o) => {
            if (inRange(o.date)) add(nat.id, perOccurrence);
          });
        });
      });
    });
  });

  return totals;
}

export interface NaturePeriodInsight {
  natureId: string;
  name: string;
  icon: string;
  spent: number;
  planned: number; // ainda previsto no período, de hoje em diante
  expected: number; // parte do teto no período ou, sem teto, média dos períodos anteriores
  basis: 'TETO' | 'MEDIA' | 'NENHUMA';
  ratio: number; // spent / expected (0 quando não há referência)
  projectedRatio: number; // (spent + planned) / expected
  level: 'ACIMA' | 'ATENCAO' | 'OK';
}

export type PeriodTense = 'PASSADO' | 'ATUAL' | 'FUTURO';

/**
 * Gasto de cada natureza no período comparado ao esperado: a fração do teto mensal que cabe no período ou,
 * quando a natureza não tem teto, a média dos últimos 4 períodos já vividos. No período atual e nos futuros
 * soma também o que ainda está previsto; nos futuros, o alerta olha para esse previsto.
 */
export function buildPeriodInsights(params: {
  natures: ExpenseNature[];
  movements: Movement[];
  period: TrackingPeriod;
  date?: Date; // qualquer dia do período mostrado (padrão: hoje)
  today?: Date;
  monthlyCeiling: (nature: ExpenseNature, monthKey: string) => number;
}): { range: PeriodRange; tense: PeriodTense; totalSpent: number; totalPlanned: number; insights: NaturePeriodInsight[] } {
  const { natures, movements, period, monthlyCeiling } = params;
  const today = params.today || new Date();
  const todayIso = isoOf(today);
  const range = trackingPeriodRange(period, params.date || today);
  const tense: PeriodTense = range.to < todayIso ? 'PASSADO' : range.from > todayIso ? 'FUTURO' : 'ATUAL';
  const current = natureSpendingInRange(natures, movements, range);
  const planned = tense === 'PASSADO' ? {} : naturePlannedInRange(natures, movements, range, todayIso);
  // A média vem sempre de períodos já vividos
  const previous = previousPeriodRanges(period, tense === 'FUTURO' ? today : params.date || today, 4).map((r) =>
    natureSpendingInRange(natures, movements, r)
  );
  const monthKey = range.from.slice(0, 7);

  const insights: NaturePeriodInsight[] = natures
    .map((nat) => {
      const spent = current[nat.id] || 0;
      const plannedAmount = planned[nat.id] || 0;
      const ceiling = monthlyCeiling(nat, monthKey);
      const history = previous.map((p) => p[nat.id] || 0);
      const average = history.some((v) => v > 0) ? round2(history.reduce((a, b) => a + b, 0) / history.length) : 0;
      const basis: NaturePeriodInsight['basis'] = ceiling > 0 ? 'TETO' : average > 0 ? 'MEDIA' : 'NENHUMA';
      const expected = basis === 'TETO' ? periodShareOfMonthly(ceiling, range) : basis === 'MEDIA' ? average : 0;
      const ratio = expected > 0 ? spent / expected : 0;
      const projectedRatio = expected > 0 ? (spent + plannedAmount) / expected : 0;
      const alertRatio = tense === 'FUTURO' ? projectedRatio : ratio;
      const level: NaturePeriodInsight['level'] =
        expected <= 0 ? 'OK' : alertRatio > 1 ? 'ACIMA' : alertRatio >= 0.8 ? 'ATENCAO' : 'OK';
      return { natureId: nat.id, name: nat.name, icon: nat.icon, spent, planned: plannedAmount, expected, basis, ratio, projectedRatio, level };
    })
    .filter((i) => i.spent > 0 || i.planned > 0)
    .sort((a, b) =>
      tense === 'FUTURO'
        ? b.projectedRatio - a.projectedRatio || b.planned - a.planned
        : b.ratio - a.ratio || b.spent - a.spent || b.planned - a.planned
    );

  const totalSpent = round2(insights.reduce((acc, i) => acc + i.spent, 0));
  const totalPlanned = round2(insights.reduce((acc, i) => acc + i.planned, 0));
  return { range, tense, totalSpent, totalPlanned, insights };
}
