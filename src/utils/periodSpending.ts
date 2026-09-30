import type { ExpenseNature, Movement } from '../types';
import { getItemOccurrences, resolveMappingItemMonth } from './mappingItemState';

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

export type PeriodTense = 'PASSADO' | 'ATUAL' | 'FUTURO';

/**
 * Situação de uma compra: feita (com data e valor pagos), prevista, vencida sem registro,
 * que não vai acontecer ou paga por outra pessoa.
 */
export type PurchaseStatus = 'FEITA' | 'PREVISTA' | 'ATRASADA' | 'NAO_VAI' | 'TERCEIROS';

export interface PeriodPurchase {
  key: string;
  date: string; // data prevista (ou do lançamento, quando não havia previsão)
  status: PurchaseStatus;
  plannedAmount: number; // 0 quando a compra não estava prevista
  paidAt?: string;
  paidAmount?: number;
  note?: string; // quem pagou ou por que não vai acontecer
}

/** Um item de natureza (ou uma conta avulsa) com as compras dele no período. */
export interface PeriodItem {
  id: string;
  title: string;
  detail?: string; // mapeamento ou categoria
  natureId?: string;
  purchases: PeriodPurchase[];
  planned: number; // soma prevista das compras que valem (fora "não vai" e "terceiros")
  spent: number; // soma paga
  done: number; // compras feitas
  total: number; // compras que valem
  nextDate?: string; // próxima compra ainda aberta
  overdue: boolean;
}

const isOpen = (p: PeriodPurchase) => p.status === 'PREVISTA' || p.status === 'ATRASADA';
const counts = (p: PeriodPurchase) => p.status !== 'NAO_VAI' && p.status !== 'TERCEIROS';

function finishItem(base: Omit<PeriodItem, 'planned' | 'spent' | 'done' | 'total' | 'nextDate' | 'overdue'>): PeriodItem {
  const purchases = [...base.purchases].sort((a, b) => a.date.localeCompare(b.date));
  const valid = purchases.filter(counts);
  const open = purchases.filter(isOpen);
  return {
    ...base,
    purchases,
    planned: round2(valid.reduce((acc, p) => acc + p.plannedAmount, 0)),
    spent: round2(purchases.reduce((acc, p) => acc + (p.paidAmount || 0), 0)),
    done: purchases.filter((p) => p.status === 'FEITA').length,
    total: valid.length,
    nextDate: open[0]?.date,
    overdue: open.some((p) => p.status === 'ATRASADA'),
  };
}

/**
 * As compras do período, item por item: cada ocorrência prevista dos itens das naturezas (pela data prevista),
 * dizendo se foi paga, quando e por quanto, e as contas a pagar do período (previstas ou já pagas).
 * Pagamentos que cobrem várias datas são divididos igualmente entre elas.
 */
export function buildPeriodItems(params: {
  natures: ExpenseNature[];
  movements: Movement[];
  range: PeriodRange;
  today?: Date;
}): { tense: PeriodTense; items: PeriodItem[] } {
  const { natures, movements, range } = params;
  const todayIso = isoOf(params.today || new Date());
  const tense: PeriodTense = range.to < todayIso ? 'PASSADO' : range.from > todayIso ? 'FUTURO' : 'ATUAL';
  const inRange = (date?: string) => !!date && date >= range.from && date <= range.to;
  const openStatus = (date: string): PurchaseStatus => (date < todayIso ? 'ATRASADA' : 'PREVISTA');

  const monthKeys: string[] = [];
  const [fy, fm] = range.from.split('-').map(Number);
  for (let d = new Date(fy, fm - 1, 1); isoOf(d).slice(0, 7) <= range.to.slice(0, 7); d.setMonth(d.getMonth() + 1)) {
    monthKeys.push(isoOf(d).slice(0, 7));
  }

  const items: PeriodItem[] = [];

  natures.forEach((nat) => {
    nat.mappings.forEach((mapping) => {
      mapping.items.forEach((item) => {
        const purchases: PeriodPurchase[] = [];
        monthKeys.forEach((monthKey) => {
          const monthNumber = Number(monthKey.slice(5, 7));
          if (mapping.applicableMonths && mapping.applicableMonths.length > 0 && !mapping.applicableMonths.includes(monthNumber)) {
            return;
          }
          const summary = resolveMappingItemMonth(item, monthKey);
          const { state } = summary;
          getItemOccurrences(item, monthKey).forEach((o) => {
            if (!inRange(o.date)) return;
            const base = { key: `${item.id}_${o.date}`, date: o.date, plannedAmount: round2(o.value) };
            if (state.skipped) {
              purchases.push({ ...base, status: 'NAO_VAI', note: state.skipReason });
              return;
            }
            if (state.paidByOthers) {
              purchases.push({ ...base, status: 'TERCEIROS', note: state.paidBy });
              return;
            }
            const payment = summary.coveredDates.get(o.date);
            if (payment) {
              purchases.push({
                ...base,
                status: 'FEITA',
                paidAt: payment.paidAt,
                paidAmount: round2(payment.amount / Math.max(1, payment.coveredDates.length)),
              });
              return;
            }
            // Mês marcado como realizado sem pagamentos registrados: pago pelo previsto, sem data
            if (state.realized && summary.payments.length === 0) {
              purchases.push({ ...base, status: 'FEITA', paidAmount: base.plannedAmount });
              return;
            }
            purchases.push({ ...base, status: openStatus(o.date) });
          });
        });
        if (purchases.length === 0) return;
        items.push(finishItem({ id: item.id, title: item.description, detail: mapping.name, natureId: nat.id, purchases }));
      });
    });
  });

  // Contas a pagar do período: previstas pelo vencimento, pagas pela data do pagamento
  movements.forEach((m) => {
    if (m.type !== 'PAGAR' || m.category === 'Cartões' || m.category === 'Empréstimos') return;
    const paid = m.status === 'REALIZADA';
    if (!inRange(paid ? m.paymentDate || m.dueDate : m.dueDate)) return;
    const purchase: PeriodPurchase = paid
      ? {
          key: m.id,
          date: m.dueDate,
          status: 'FEITA',
          plannedAmount: round2(m.amount),
          paidAt: m.paymentDate || m.dueDate,
          paidAmount: round2(m.actualAmount ?? m.amount),
        }
      : { key: m.id, date: m.dueDate, status: openStatus(m.dueDate), plannedAmount: round2(m.amount) };
    items.push(finishItem({ id: m.id, title: m.title, detail: m.category || undefined, natureId: movementNatureId(m, natures), purchases: [purchase] }));
  });

  return { tense, items };
}
