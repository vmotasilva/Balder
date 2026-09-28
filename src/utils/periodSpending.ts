import type { ExpenseNature, Movement } from '../types';

/** Período em que o usuário gosta de acompanhar as finanças. */
export type TrackingPeriod = 'SEMANA' | 'QUINZENA' | 'MES';

export const TRACKING_PERIOD_LABELS: Record<TrackingPeriod, { name: string; this: string; end: string }> = {
  SEMANA: { name: 'Semana', this: 'nesta semana', end: 'até domingo' },
  QUINZENA: { name: 'Quinzena', this: 'nesta quinzena', end: 'até o fim da quinzena' },
  MES: { name: 'Mês', this: 'neste mês', end: 'até o fim do mês' },
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

export interface NaturePeriodInsight {
  natureId: string;
  name: string;
  icon: string;
  spent: number;
  expected: number; // parte do teto no período ou, sem teto, média dos períodos anteriores
  basis: 'TETO' | 'MEDIA' | 'NENHUMA';
  ratio: number; // spent / expected (0 quando não há referência)
  level: 'ACIMA' | 'ATENCAO' | 'OK';
}

/**
 * Gasto de cada natureza no período atual comparado ao esperado: a fração do teto mensal que cabe no
 * período ou, quando a natureza não tem teto, a média dos últimos 4 períodos iguais.
 */
export function buildPeriodInsights(params: {
  natures: ExpenseNature[];
  movements: Movement[];
  period: TrackingPeriod;
  today?: Date;
  monthlyCeiling: (nature: ExpenseNature, monthKey: string) => number;
}): { range: PeriodRange; totalSpent: number; insights: NaturePeriodInsight[] } {
  const { natures, movements, period, monthlyCeiling } = params;
  const today = params.today || new Date();
  const range = trackingPeriodRange(period, today);
  const current = natureSpendingInRange(natures, movements, range);
  const previous = previousPeriodRanges(period, today, 4).map((r) => natureSpendingInRange(natures, movements, r));
  const monthKey = range.from.slice(0, 7);

  const insights: NaturePeriodInsight[] = natures
    .map((nat) => {
      const spent = current[nat.id] || 0;
      const ceiling = monthlyCeiling(nat, monthKey);
      const history = previous.map((p) => p[nat.id] || 0);
      const average = history.some((v) => v > 0) ? round2(history.reduce((a, b) => a + b, 0) / history.length) : 0;
      const basis: NaturePeriodInsight['basis'] = ceiling > 0 ? 'TETO' : average > 0 ? 'MEDIA' : 'NENHUMA';
      const expected = basis === 'TETO' ? periodShareOfMonthly(ceiling, range) : basis === 'MEDIA' ? average : 0;
      const ratio = expected > 0 ? spent / expected : 0;
      const level: NaturePeriodInsight['level'] = expected <= 0 ? 'OK' : ratio > 1 ? 'ACIMA' : ratio >= 0.8 ? 'ATENCAO' : 'OK';
      return { natureId: nat.id, name: nat.name, icon: nat.icon, spent, expected, basis, ratio, level };
    })
    .filter((i) => i.spent > 0)
    .sort((a, b) => b.ratio - a.ratio || b.spent - a.spent);

  const totalSpent = round2(insights.reduce((acc, i) => acc + i.spent, 0));
  return { range, totalSpent, insights };
}
