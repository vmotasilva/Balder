import type { ExpenseNature, Movement } from '../types';
import { getItemOccurrences, isExcludedState, resolveMappingItemMonth } from './mappingItemState';
import { findMappingSpendCandidates, spendAmount, spendDate } from './mappingSpendCandidates';
import { isSalaryMovement } from './projectionMath';

export type ForecastEntrySource =
  | 'SALARIO'
  | 'RECEITA'
  | 'EMPRESTIMO_RECEBIDO'
  | 'PARCELA'
  | 'FATURA'
  | 'CONTA'
  | 'NATUREZA';

export interface ForecastEntry {
  id: string;
  date: string; // YYYY-MM-DD (primeira ocorrência na janela, para itens de natureza)
  title: string;
  detail?: string;
  kind: 'ENTRADA' | 'SAIDA';
  source: ForecastEntrySource;
  amount: number;
  overdue: boolean; // vencido antes de hoje e ainda não realizado
  /** Origem dos itens de natureza (para agrupar por natureza → mapeamento → item). */
  natureId?: string;
  mappingId?: string;
  itemId?: string;
  /** Mapeamento em modo Resumo: uma linha só para o mapeamento (os itens só compõem o valor). */
  mappingSummary?: boolean;
}

export type ForecastPeriod = 'SEMANA' | 'QUINZENA' | 'MES' | 'DIAS_30';

export const FORECAST_PERIODS: { id: ForecastPeriod; label: string }[] = [
  { id: 'SEMANA', label: 'Essa Semana' },
  { id: 'QUINZENA', label: 'Essa Quinzena' },
  { id: 'MES', label: 'Esse Mês' },
  { id: 'DIAS_30', label: 'Próximos 30 dias' },
];

/** Períodos oferecidos na tela: os 30 dias corridos seguem calculados só para os avisos e a reserva. */
export const FORECAST_PERIOD_OPTIONS = FORECAST_PERIODS.filter((p) => p.id !== 'DIAS_30');

/**
 * Fim (inclusive) de cada período a partir de hoje:
 * semana de segunda a domingo; quinzena até o dia 15 ou até o fim do mês; mês até o último dia; 30 dias corridos.
 */
export function forecastPeriodEnd(period: ForecastPeriod, today: Date = new Date()): Date {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (period === 'SEMANA') {
    d.setDate(d.getDate() + (6 - ((d.getDay() + 6) % 7)));
  } else if (period === 'QUINZENA') {
    if (d.getDate() <= 15) d.setDate(15);
    else d.setDate(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
  } else if (period === 'MES') {
    d.setDate(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
  } else {
    d.setDate(d.getDate() + 30);
  }
  return d;
}

export interface ForecastWindow {
  fromDate: string;
  toDate: string;
  days: number;
  startingBalance: number;
  income: number;
  expenses: number;
  net: number;
  projectedBalance: number;
  entries: ForecastEntry[];
}

const round2 = (v: number) => Math.round(v * 100) / 100;
/** Último dia (domingo) da semana, de segunda a domingo, que contém a data. */
const weekEndIso = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return isoOf(d);
};
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** "12 a 18/10" (ou "26/10 a 01/11" quando a semana cruza o mês) para a semana que termina no domingo informado. */
const weekRangeLabel = (endIso: string) => {
  const end = new Date(`${endIso}T00:00:00`);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  const dd = (d: Date) => String(d.getDate()).padStart(2, '0');
  const mm = (d: Date) => String(d.getMonth() + 1).padStart(2, '0');
  return start.getMonth() === end.getMonth()
    ? `${dd(start)} a ${dd(end)}/${mm(end)}`
    : `${dd(start)}/${mm(start)} a ${dd(end)}/${mm(end)}`;
};

/**
 * Projeção de caixa de hoje até o fim de um período, com a mesma lógica da grade mensal:
 * saldo em caixa hoje + entradas previstas − saídas previstas com vencimento até o fim da janela.
 *
 * - Movimentos PREVISTOS vencidos desde o início do marco continuam pendentes e entram como "em atraso";
 *   os anteriores ao marco ficam de fora, exceto faturas de cartão, que seguem em aberto até serem pagas.
 * - Itens das naturezas entram pelas ocorrências ainda não pagas (datas não cobertas por pagamento,
 *   mês não marcado como realizado, não pago por terceiros). Itens no cartão ficam de fora: já entram
 *   pela fatura. As ocorrências vencidas do mês corrente contam como "em atraso", como na grade.
 */
export function buildForecastWindow(params: {
  movements: Movement[];
  natures: ExpenseNature[];
  startingBalance: number;
  startDate?: string; // início do marco ativo (itens das naturezas antes dele são ignorados)
  today?: Date;
  period?: ForecastPeriod;
  /** Exibição padrão de cada natureza ('MAPEAMENTOS' = Resumo); o mapeamento pode ter a sua. */
  natureDetailModes?: Record<string, 'ITENS' | 'MAPEAMENTOS'>;
}): ForecastWindow {
  const { movements, natures, startingBalance, startDate = '0000-01-01', period = 'DIAS_30', natureDetailModes = {} } = params;
  const today = params.today ? new Date(params.today) : new Date();
  today.setHours(0, 0, 0, 0);
  const end = forecastPeriodEnd(period, today);
  const days = Math.round((end.getTime() - today.getTime()) / 86400000) + 1;
  const fromDate = isoOf(today);
  const toDate = isoOf(end);
  const currentMonthKey = fromDate.slice(0, 7);

  const entries: ForecastEntry[] = [];

  // ── Movimentos previstos ──
  movements.forEach((m) => {
    if (m.status !== 'PREVISTA') return;
    // Nada anterior ao início do marco aparece; previstos vencidos depois dele entram como em atraso.
    // Fatura de cartão em aberto não some com o marco: continua pendente (como na grade) até ser paga.
    if (m.dueDate > toDate || (m.dueDate < startDate && m.type !== 'CARTAO')) return;
    // Mesmo critério da grade: lançamentos de "Cartões"/"Empréstimos" em contas a pagar duplicariam fatura/parcela
    if (m.type === 'PAGAR' && (m.category === 'Cartões' || m.category === 'Empréstimos')) return;

    let source: ForecastEntrySource;
    let kind: ForecastEntry['kind'];
    if (m.type === 'RECEBER') {
      source = isSalaryMovement(m) ? 'SALARIO' : 'RECEITA';
      kind = 'ENTRADA';
    } else if (m.type === 'EMPRESTIMO') {
      const received = m.category === 'Recebimento';
      source = received ? 'EMPRESTIMO_RECEBIDO' : 'PARCELA';
      kind = received ? 'ENTRADA' : 'SAIDA';
    } else if (m.type === 'CARTAO') {
      source = 'FATURA';
      kind = 'SAIDA';
    } else {
      source = 'CONTA';
      kind = 'SAIDA';
    }

    entries.push({
      id: m.id,
      date: m.dueDate,
      title: m.title,
      detail: m.bank || m.category || undefined,
      kind,
      source,
      amount: round2(m.amount),
      overdue: m.dueDate < fromDate,
    });
  });

  // ── Itens das naturezas (competências tocadas pela janela) ──
  const monthKeys: string[] = [];
  for (let d = new Date(today.getFullYear(), today.getMonth(), 1); isoOf(d).slice(0, 7) <= toDate.slice(0, 7); d.setMonth(d.getMonth() + 1)) {
    monthKeys.push(isoOf(d).slice(0, 7));
  }

  // Itens comprados no cartão em faturas ainda abertas, por item da natureza. Quando a fatura é paga, a
  // reconciliação registra o pagamento no item; até lá, a compra no cartão já conta como resolvida.
  // Compra ligada só ao mapeamento (sem o item) abate o que estiver em aberto nos itens dele
  const cardCredit = new Map<string, number>();
  const mappingCardCredit = new Map<string, number>();
  movements.forEach((inv) => {
    if (inv.type !== 'CARTAO' || inv.status !== 'PREVISTA') return;
    (inv.invoiceBreakdown || []).forEach((ib) => {
      if (ib.mappingItemId) cardCredit.set(ib.mappingItemId, (cardCredit.get(ib.mappingItemId) || 0) + ib.amount);
      else if (ib.mappingId) mappingCardCredit.set(ib.mappingId, (mappingCardCredit.get(ib.mappingId) || 0) + ib.amount);
    });
  });

  natures.forEach((nat) => {
    nat.mappings.forEach((mapping) => {
      // Modo Resumo: o mapeamento é a linha de cobrança; os itens só somam o valor dele
      const summarized = (mapping.detailMode ?? natureDetailModes[nat.id]) === 'MAPEAMENTOS';
      const mappingBuckets = new Map<string, { amount: number; count: number; first: string; overdue: boolean }>();
      const mappingItemIds = new Set<string>();
      let mappingSettled = 0;
      let mappingCreditLeft = mappingCardCredit.get(mapping.id) || 0;

      mapping.items.forEach((item) => {
        if (item.paymentMethod === 'CARTAO') return;

        const buckets = summarized
          ? mappingBuckets
          : new Map<string, { amount: number; count: number; first: string; overdue: boolean }>();
        monthKeys.forEach((monthKey) => {
          const monthNumber = Number(monthKey.slice(5, 7));
          if (mapping.applicableMonths && mapping.applicableMonths.length > 0 && !mapping.applicableMonths.includes(monthNumber)) {
            return;
          }
          const summary = resolveMappingItemMonth(item, monthKey);
          if (isExcludedState(summary.state) || summary.pending <= 0.005) return;

          // Pendente do mês distribuído pelas datas ainda não cobertas (fecha com o total da grade)
          const uncovered = summary.state.realized
            ? []
            : getItemOccurrences(item, monthKey).filter((o) => !summary.coveredDates.has(o.date));
          const pendingUncovered = Math.max(0, summary.pending - summary.openBalance);
          // Resumo: cada semana vale o previsto das suas ocorrências; o que já foi pago/desconsiderado no mapeamento
          // abate depois, das semanas mais antigas (senão o abatimento se espalharia e a semana vencida nunca zeraria)
          const rawUncovered = uncovered.reduce((acc, o) => acc + o.value, 0);
          const perOccurrence = summarized
            ? 0
            : uncovered.length > 0
            ? pendingUncovered / uncovered.length
            : 0;
          let monthHasBucket = false;

          const add = (date: string, amount: number) => {
            if (amount <= 0) return;
            if (date > toDate || date < startDate) return;
            // Ocorrências vencidas só contam dentro da competência atual
            if (date < fromDate && monthKey !== currentMonthKey) return;
            monthHasBucket = true;
            // Resumo: uma linha por semana do mapeamento, vencendo no último dia da semana (domingo)
            const dueDate = summarized ? weekEndIso(date) : date;
            const overdue = dueDate < fromDate;
            const key = summarized ? dueDate : overdue ? 'overdue' : 'upcoming';
            if (summarized) mappingItemIds.add(item.id);
            const bucket = buckets.get(key) || { amount: 0, count: 0, first: dueDate, overdue };
            bucket.overdue = bucket.overdue || overdue;
            bucket.amount += amount;
            bucket.count += 1;
            if (dueDate < bucket.first) bucket.first = dueDate;
            buckets.set(key, bucket);
          };

          uncovered.forEach((o) => add(o.date, summarized ? o.value : perOccurrence));
          if (summarized && monthHasBucket) mappingSettled += Math.max(0, rawUncovered - pendingUncovered);
          // Diferenças deixadas em aberto (SALDO_ABERTO) ficam para hoje
          if (summary.openBalance > 0 && monthKey === currentMonthKey) add(fromDate, summary.openBalance);
        });

        // Compra no cartão ligada ao item (fatura ainda em aberto): já resolve a pendência, não cobrar de novo
        const credit = cardCredit.get(item.id) || 0;
        if (summarized) {
          if (credit > 0 && buckets.size > 0) mappingSettled += credit;
          return;
        }
        // Crédito do mapeamento (sem item): vale pelo que este item ainda tem em aberto
        const itemOpen = [...buckets.values()].reduce((acc, b) => acc + b.amount, 0);
        const fromMapping = Math.min(mappingCreditLeft, Math.max(0, itemOpen - credit));
        mappingCreditLeft -= fromMapping;
        let left = credit + fromMapping;
        [...buckets.values()]
          .sort((a, b) => a.first.localeCompare(b.first))
          .forEach((b) => {
            const drained = Math.min(b.amount, left);
            b.amount -= drained;
            left -= drained;
          });
        buckets.forEach((b, key) => {
          if (b.amount <= 0.005) return;
          entries.push({
            id: `nat_${item.id}_${key}`,
            date: b.first,
            title: item.description,
            detail: `${nat.name} · ${mapping.name}${b.count > 1 ? ` · ${b.count} ocorrências` : ''}`,
            kind: 'SAIDA',
            source: 'NATUREZA',
            amount: round2(b.amount),
            overdue: b.overdue,
            natureId: nat.id,
            mappingId: mapping.id,
            itemId: item.id,
          });
        });
      });

      if (summarized && mappingBuckets.size > 0) mappingSettled += mappingCreditLeft;

      // Gasto já lançado na semana (antes ou depois do dia do vencimento) baixa a semana; o que sobra abate as seguintes
      if (summarized && mappingBuckets.size > 0) {
        const keys = [...mappingBuckets.keys()].sort();
        const weekStart = new Date(`${keys[0]}T00:00:00`);
        weekStart.setDate(weekStart.getDate() - 6);
        const spendByWeek = new Map<string, number>();
        findMappingSpendCandidates({
          movements,
          natures,
          natureId: nat.id,
          mappingId: mapping.id,
          range: { from: isoOf(weekStart), to: keys[keys.length - 1] },
          onlyMatching: true,
        }).forEach((m) => {
          const week = weekEndIso(spendDate(m));
          spendByWeek.set(week, (spendByWeek.get(week) || 0) + spendAmount(m));
        });
        let carry = 0;
        keys.forEach((key) => {
          const b = mappingBuckets.get(key)!;
          const available = (spendByWeek.get(key) || 0) + carry;
          const drained = Math.min(b.amount, available);
          b.amount -= drained;
          carry = available - drained;
        });
      }

      [...mappingBuckets.keys()].sort().forEach((key) => {
        if (mappingSettled <= 0.005) return;
        const b = mappingBuckets.get(key)!;
        const drained = Math.min(b.amount, mappingSettled);
        b.amount -= drained;
        mappingSettled -= drained;
      });

      mappingBuckets.forEach((b, key) => {
        if (b.amount <= 0.005) return;
        entries.push({
          id: `natmap_${mapping.id}_${key}`,
          date: b.first,
          title: `${mapping.name} · semana ${weekRangeLabel(key)}`,
          detail: `${nat.name} · ${mappingItemIds.size} ${mappingItemIds.size === 1 ? 'item' : 'itens'} no resumo`,
          kind: 'SAIDA',
          source: 'NATUREZA',
          amount: round2(b.amount),
          overdue: b.overdue,
          natureId: nat.id,
          mappingId: mapping.id,
          mappingSummary: true,
        });
      });
    });
  });

  entries.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  const income = round2(entries.filter((e) => e.kind === 'ENTRADA').reduce((acc, e) => acc + e.amount, 0));
  const expenses = round2(entries.filter((e) => e.kind === 'SAIDA').reduce((acc, e) => acc + e.amount, 0));
  const net = round2(income - expenses);

  return {
    fromDate,
    toDate,
    days,
    startingBalance: round2(startingBalance),
    income,
    expenses,
    net,
    projectedBalance: round2(startingBalance + net),
    entries,
  };
}
