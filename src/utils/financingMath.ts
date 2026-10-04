export type AmortizationSystem = 'SAC' | 'PRICE';

export interface FinancingInput {
  /** Valor base do imóvel/bem (R$) */
  baseValue: number;
  /** Entrada (FGTS + extra) abatida do valor base */
  downPayment: number;
  /** Taxa de juros anual nominal (fração, ex.: 0.119) — a mensal é anual/12, como na planilha */
  annualRate: number;
  termMonths: number;
  /** 'YYYY-MM' da 1ª parcela */
  startMonth: string;
  /** Amortizações extras por número da parcela (1..n) */
  extras: Record<number, number>;
}

export interface FinancingRow {
  index: number;
  /** 'YYYY-MM' */
  month: string;
  installment: number;
  interest: number;
  amortization: number;
  extra: number;
  balance: number;
}

export interface FinancingScheduleSummary {
  firstInstallment: number;
  lastInstallment: number;
  totalPaid: number;
  totalInterest: number;
  /** Parcelas efetivamente pagas (menor que o prazo quando há amortização extra) */
  paidMonths: number;
}

export interface FinancingSchedule {
  rows: FinancingRow[];
  summary: FinancingScheduleSummary;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export const financedAmount = (i: Pick<FinancingInput, 'baseValue' | 'downPayment'>) =>
  Math.max(0, round2(i.baseValue - i.downPayment));

export function addMonths(yearMonth: string, n: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Cronograma SAC (amortização constante) ou Price (parcela fixa).
 * A amortização extra reduz o saldo e encurta o prazo, mantendo a amortização (SAC) ou a parcela (Price).
 */
export function buildFinancingSchedule(input: FinancingInput, system: AmortizationSystem): FinancingSchedule {
  const principal = financedAmount(input);
  const n = Math.floor(input.termMonths);
  const i = input.annualRate / 12;
  const rows: FinancingRow[] = [];
  if (principal <= 0 || n <= 0 || input.annualRate < 0) {
    return { rows, summary: { firstInstallment: 0, lastInstallment: 0, totalPaid: 0, totalInterest: 0, paidMonths: 0 } };
  }

  const sacAmort = principal / n;
  const pmt = i === 0 ? principal / n : (principal * i) / (1 - Math.pow(1 + i, -n));
  let balance = principal;

  for (let k = 1; k <= n && balance > 0.005; k++) {
    const interest = round2(balance * i);
    let amort = system === 'SAC' ? sacAmort : pmt - balance * i;
    if (k === n || amort > balance) amort = balance;
    amort = round2(amort);
    balance = round2(balance - amort);
    const extra = Math.min(round2(Math.max(0, input.extras[k] ?? 0)), balance);
    balance = round2(balance - extra);
    rows.push({
      index: k,
      month: addMonths(input.startMonth, k - 1),
      installment: round2(interest + amort),
      interest,
      amortization: amort,
      extra,
      balance: Math.max(0, balance),
    });
  }

  const totalInterest = round2(rows.reduce((s, r) => s + r.interest, 0));
  const totalPaid = round2(rows.reduce((s, r) => s + r.installment + r.extra, 0));
  return {
    rows,
    summary: {
      firstInstallment: rows[0]?.installment ?? 0,
      lastInstallment: rows[rows.length - 1]?.installment ?? 0,
      totalPaid,
      totalInterest,
      paidMonths: rows.length,
    },
  };
}
