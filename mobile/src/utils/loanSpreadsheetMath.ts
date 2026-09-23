import type { LoanSpreadsheetRow, LoanSpreadsheetSummary } from '../types';

export interface LoanSpreadsheetInput {
  principalAmount: number;     // ex: 42000
  monthlyInterestRate: number; // ex: 0.03612 (3,612%)
  termMonths: number;          // ex: 15
  contractDate: string;        // 'YYYY-MM-DD', ex: '2026-10-03'
  firstDueDate: string;        // 'YYYY-MM-DD', ex: '2026-10-15'
  simulationDate?: string;     // 'YYYY-MM-DD', default hoje ou data de contratação
}

function addMonthsToDate(dateStr: string, monthsToAdd: number): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  const targetDate = new Date(year, month + monthsToAdd, day);
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${d}/${m}/${y}`;
}

function getDaysDiff(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
}

function formatISODateToBR(isoDate: string): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export function calculateLoanSpreadsheet(input: LoanSpreadsheetInput): {
  summary: LoanSpreadsheetSummary;
  rows: LoanSpreadsheetRow[];
} {
  const {
    principalAmount,
    monthlyInterestRate: i,
    termMonths: n,
    contractDate,
    firstDueDate,
    simulationDate = contractDate,
  } = input;

  if (principalAmount <= 0 || i <= 0 || n <= 0) {
    return {
      summary: {
        principalAmount: 0,
        monthlyInterestRate: 0,
        termMonths: 0,
        contractDate,
        firstDueDate,
        simulationDate,
        installmentValue: 0,
        totalCost: 0,
        totalInterest: 0,
        totalPayoffToday: 0,
        totalSavingsPotential: 0,
      },
      rows: [],
    };
  }

  const daysDiff = getDaysDiff(contractDate, firstDueDate);
  const proRataFactor = 1 + i * (daysDiff / 30);
  const adjustedPrincipal = (principalAmount * proRataFactor) / (1 + i);

  const discountFactor = 1 - Math.pow(1 + i, -n);
  const installmentValue = discountFactor > 0 ? (adjustedPrincipal * i) / discountFactor : 0;

  const totalCost = installmentValue * n;
  const totalInterest = totalCost - principalAmount;

  const rows: LoanSpreadsheetRow[] = [];
  let currentBalance = adjustedPrincipal;

  rows.push({
    month: 0,
    dueDate: formatISODateToBR(contractDate),
    installmentValue: 0,
    interestValue: 0,
    amortizationValue: 0,
    balanceRemaining: Math.round(currentBalance * 100) / 100,
    payoffTodayValue: 0,
    savingsAtAdvance: 0,
  });

  let totalPayoffTodaySum = 0;

  for (let k = 1; k <= n; k++) {
    const interestValue = currentBalance * i;
    const amortizationValue = installmentValue - interestValue;
    currentBalance = Math.max(0, currentBalance - amortizationValue);

    const payoffDivisor = proRataFactor * Math.pow(1 + i, k - 1);
    const payoffTodayValue = payoffDivisor > 0 ? installmentValue / payoffDivisor : installmentValue;
    const savingsAtAdvance = Math.max(0, installmentValue - payoffTodayValue);
    totalPayoffTodaySum += payoffTodayValue;

    const dueDateFormatted = addMonthsToDate(firstDueDate, k - 1);

    const simDateFormatted = formatISODateToBR(simulationDate);
    const [, mSim, ySim] = simDateFormatted.split('/').map(Number);
    const [, mDue, yDue] = dueDateFormatted.split('/').map(Number);
    const monthsDiff = Math.max(0, (yDue - ySim) * 12 + (mDue - mSim));
    const discountedPayoff = monthsDiff > 0 ? installmentValue / Math.pow(1 + i, monthsDiff) : installmentValue;

    rows.push({
      month: k,
      dueDate: dueDateFormatted,
      installmentValue: Math.round(installmentValue * 100) / 100,
      interestValue: Math.round(interestValue * 100) / 100,
      amortizationValue: Math.round(amortizationValue * 100) / 100,
      balanceRemaining: Math.round(currentBalance * 100) / 100,
      payoffTodayValue: Math.round(payoffTodayValue * 100) / 100,
      savingsAtAdvance: Math.round(savingsAtAdvance * 100) / 100,
      simDate: simDateFormatted,
      monthsDiff,
      discountedPayoff: Math.round(discountedPayoff * 100) / 100,
    });
  }

  const summary: LoanSpreadsheetSummary = {
    principalAmount,
    monthlyInterestRate: i,
    termMonths: n,
    contractDate,
    firstDueDate,
    simulationDate,
    installmentValue: Math.round(installmentValue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPayoffToday: Math.round(totalPayoffTodaySum * 100) / 100,
    totalSavingsPotential: Math.round(rows.reduce((acc, r) => acc + (r.savingsAtAdvance || 0), 0) * 100) / 100,
  };

  return { summary, rows };
}
