import type { InvestmentFrequency, InvestmentPlan } from '../types';

const MAX_OCCURRENCES = 1000;

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
};
const fmt = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Ocorrência de ordem k (0 = início). No mensal, usa o último dia do mês quando o dia não existe. */
function occurrence(startDate: string, frequency: InvestmentFrequency, k: number): string {
  const { y, m, d } = parse(startDate);
  if (frequency === 'MONTHLY') {
    const lastDay = new Date(y, m + k + 1, 0).getDate();
    return fmt(new Date(y, m + k, Math.min(d, lastDay)));
  }
  return fmt(new Date(y, m, d + k * (frequency === 'WEEKLY' ? 7 : 14)));
}

/** Datas da programação entre o início e `until` (inclusive), respeitando o fim da programação. */
export function planOccurrences(plan: Pick<InvestmentPlan, 'startDate' | 'frequency' | 'endDate'>, until: string): string[] {
  const limit = plan.endDate && plan.endDate < until ? plan.endDate : until;
  const out: string[] = [];
  for (let k = 0; k < MAX_OCCURRENCES; k++) {
    const date = occurrence(plan.startDate, plan.frequency, k);
    if (date > limit) break;
    out.push(date);
  }
  return out;
}

/** Ocorrências já vencidas (até hoje) que ainda não foram confirmadas nem puladas. */
export function dueOccurrences(plan: InvestmentPlan, today: string): string[] {
  const done = new Set(plan.doneDates);
  return planOccurrences(plan, today).filter((d) => !done.has(d));
}

/** Próxima ocorrência futura (depois de hoje), ou null se a programação já terminou. */
export function nextOccurrence(plan: InvestmentPlan, today: string): string | null {
  for (let k = 0; k < MAX_OCCURRENCES; k++) {
    const date = occurrence(plan.startDate, plan.frequency, k);
    if (plan.endDate && date > plan.endDate) return null;
    if (date > today) return date;
  }
  return null;
}

export const FREQUENCY_LABELS: Record<InvestmentFrequency, string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal (14 dias)',
  MONTHLY: 'Mensal',
};
