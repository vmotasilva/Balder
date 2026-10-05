import type { Movement } from '../types';

const isoAddMonths = (iso: string, delta: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + delta, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
};

const isoDaysBetween = (from: string, to: string): number =>
  Math.round((new Date(to + 'T12:00:00').getTime() - new Date(from + 'T12:00:00').getTime()) / 86400000);

/**
 * Valor de uma parcela paga antes do vencimento (mesma regra da planilha, "Valor p/ Quitar Hoje"):
 *
 *   Valor da parcela / ((1 + i × (Vencimento − Data do pagamento) / 30) × (1 + i)^(Nº da parcela − 1))
 *
 * "Vencimento" é o primeiro vencimento do calendário da parcela que cai na data do pagamento ou depois
 * dela, e "Nº da parcela − 1" é quantos meses a parcela está à frente desse vencimento. Ex.: pagar em
 * 27/09 a parcela de 15/12 → Vencimento 15/10 (18 dias, juros simples pró-rata) × 2 meses compostos.
 * No vencimento ou depois, vale o valor nominal.
 */
export function calculatePresentValue(
  nominalAmount: number,
  dueDateStr: string,
  paymentDateStr: string,
  monthlyRatePercent: number
): {
  discountedAmount: number;
  discountAmount: number;
  discountPercent: number;
  daysToDueDate: number;
} {
  if (nominalAmount <= 0) {
    return { discountedAmount: 0, discountAmount: 0, discountPercent: 0, daysToDueDate: 0 };
  }

  const validIso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!validIso(dueDateStr) || !validIso(paymentDateStr)) {
    return { discountedAmount: nominalAmount, discountAmount: 0, discountPercent: 0, daysToDueDate: 0 };
  }

  const days = isoDaysBetween(paymentDateStr, dueDateStr);
  if (days <= 0 || monthlyRatePercent <= 0) {
    return { discountedAmount: nominalAmount, discountAmount: 0, discountPercent: 0, daysToDueDate: Math.max(0, days) };
  }

  const i = monthlyRatePercent / 100;
  // Meses inteiros entre o vencimento de referência (1º vencimento >= pagamento) e o da parcela
  let monthsAhead = 0;
  while (monthsAhead < 600 && isoAddMonths(dueDateStr, -(monthsAhead + 1)) >= paymentDateStr) monthsAhead++;
  const referenceDue = isoAddMonths(dueDateStr, -monthsAhead);
  const proRataDays = isoDaysBetween(paymentDateStr, referenceDue);

  const divisor = (1 + i * (proRataDays / 30)) * Math.pow(1 + i, monthsAhead);
  const roundedDiscounted = Math.round((nominalAmount / divisor) * 100) / 100;
  const discount = Math.max(0, Math.round((nominalAmount - roundedDiscounted) * 100) / 100);
  const percent = Math.round((discount / nominalAmount) * 10000) / 100;

  return {
    discountedAmount: roundedDiscounted,
    discountAmount: discount,
    discountPercent: percent,
    daysToDueDate: days,
  };
}

export type LoanPaymentKind = 'ANTECIPADA' | 'EM_DIA' | 'ATRASADA';

export interface LoanPaymentOutcome {
  kind: LoanPaymentKind;
  /** Valor a pagar na data informada. */
  amount: number;
  /** Desconto (antecipação) ou acréscimo (atraso), sempre positivo. */
  adjustment: number;
  /** Dias de antecedência ou de atraso em relação ao vencimento. */
  days: number;
  reason: string;
}

/**
 * Encargos de uma parcela paga depois do vencimento: multa de 2% mais juros de mora de 1% ao mês (pró-rata
 * por dia), o padrão do crédito ao consumidor. O contrato pode prever outros valores: o campo fica editável.
 */
export function calculateLateCharges(nominalAmount: number, dueDateStr: string, paymentDateStr: string) {
  const days = Math.max(0, isoDaysBetween(dueDateStr, paymentDateStr));
  const fine = Math.round(nominalAmount * 0.02 * 100) / 100;
  const interest = Math.round(nominalAmount * 0.01 * (days / 30) * 100) / 100;
  return { days, charges: Math.round((fine + interest) * 100) / 100 };
}

/**
 * O que acontece com o valor da parcela conforme a data do pagamento em relação ao vencimento:
 * antes, antecipação com desconto a valor presente; no dia, o valor exato da parcela; depois, encargos de atraso.
 */
export function loanPaymentOutcome(
  nominalAmount: number,
  dueDateStr: string,
  paymentDateStr: string,
  monthlyRatePercent: number
): LoanPaymentOutcome {
  const valid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!valid(dueDateStr) || !valid(paymentDateStr) || paymentDateStr === dueDateStr) {
    return { kind: 'EM_DIA', amount: nominalAmount, adjustment: 0, days: 0, reason: 'Pagamento da parcela no valor contratual' };
  }
  if (paymentDateStr < dueDateStr) {
    const pv = calculatePresentValue(nominalAmount, dueDateStr, paymentDateStr, monthlyRatePercent);
    if (pv.discountAmount <= 0) {
      return { kind: 'EM_DIA', amount: nominalAmount, adjustment: 0, days: pv.daysToDueDate, reason: 'Pagamento da parcela no valor contratual' };
    }
    return {
      kind: 'ANTECIPADA',
      amount: pv.discountedAmount,
      adjustment: pv.discountAmount,
      days: pv.daysToDueDate,
      reason: 'Antecipação com desconto a valor presente (BACEN nº 3.516)',
    };
  }
  const late = calculateLateCharges(nominalAmount, dueDateStr, paymentDateStr);
  return {
    kind: 'ATRASADA',
    amount: Math.round((nominalAmount + late.charges) * 100) / 100,
    adjustment: late.charges,
    days: late.days,
    reason: 'Pagamento em atraso com multa de 2% e juros de mora de 1% a.m.',
  };
}

export interface LoanContractGroup {
  groupId: string;
  title: string;
  bank: string;
  category: string;
  interestRatePercent: number;
  allInstallments: Movement[];
  openInstallments: Movement[];
  paidInstallments: Movement[];
  totalInstallmentsCount: number;
  nominalBalance: number;
  presentValueToday: number;
  totalImmediateSavings: number;
}

/**
 * Agrupa movimentações de empréstimo por contrato e gera sumário com valores presentes.
 */
export function groupLoanMovements(
  movements: Movement[],
  paymentDateStr: string = new Date().toISOString().split('T')[0]
): LoanContractGroup[] {
  // Considera todas as parcelas de empréstimo (tanto previstas quanto já realizadas/pagas)
  const loanMovements = movements.filter((m) => m.type === 'EMPRESTIMO');

  const groupsMap = new Map<string, Movement[]>();

  loanMovements.forEach((mov) => {
    // Chave de agrupamento: groupId ou base do título
    const key = mov.installmentGroupId || mov.title.replace(/\s*\(\d+\/\d+\).*/, '').trim();
    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
    }
    groupsMap.get(key)!.push(mov);
  });

  const result: LoanContractGroup[] = [];

  groupsMap.forEach((items, key) => {
    // Ordenar por número da parcela ou por data de vencimento
    items.sort((a, b) => {
      if (a.installmentNumber && b.installmentNumber) {
        return a.installmentNumber - b.installmentNumber;
      }
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    const openItems = items.filter((m) => m.status === 'PREVISTA');
    const paidItems = items.filter((m) => m.status === 'REALIZADA');

    const firstItem = items[0];
    const cleanTitle = firstItem.title.replace(/\s*\(\d+\/\d+\).*/, '').trim();
    
    // Taxa do contrato: do campo ou de anotação ou fallback 2.5% a.m.
    let rate = firstItem.interestRatePercent || 0;
    if (!rate && firstItem.notes) {
      const match = firstItem.notes.match(/Taxa\s*([\d.,]+)%\s*a\.m\./i);
      if (match) {
        rate = parseFloat(match[1].replace(',', '.'));
      }
    }
    if (!rate && firstItem.installmentGroupId) {
      // Captação do mesmo contrato: "Captação financiada de R$ ... a 3.520% a.m."
      const disbursement = movements.find(
        (m) => m.installmentGroupId === firstItem.installmentGroupId && m.type === 'RECEBER' && m.notes
      );
      const match = disbursement?.notes?.match(/a\s*([\d.,]+)%\s*a\.m\./i);
      if (match) rate = parseFloat(match[1].replace(',', '.'));
    }
    if (!rate) rate = 2.50; // fallback padrão se não especificado

    const totalCount = Math.max(
      firstItem.installmentsTotal || 0,
      items.length,
      ...items.map((i) => i.installmentNumber || 0)
    );
    const nominalBalance = openItems.reduce((sum, item) => sum + item.amount, 0);

    let pvSum = 0;
    openItems.forEach((item) => {
      const calc = calculatePresentValue(item.amount, item.dueDate, paymentDateStr, rate);
      pvSum += calc.discountedAmount;
    });

    const roundedPv = Math.round(pvSum * 100) / 100;
    const totalSavings = Math.max(0, Math.round((nominalBalance - roundedPv) * 100) / 100);

    result.push({
      groupId: key,
      title: cleanTitle,
      bank: firstItem.bank,
      category: firstItem.category,
      interestRatePercent: rate,
      allInstallments: items,
      openInstallments: openItems,
      paidInstallments: paidItems,
      totalInstallmentsCount: totalCount,
      nominalBalance: Math.round(nominalBalance * 100) / 100,
      presentValueToday: roundedPv,
      totalImmediateSavings: totalSavings,
    });
  });

  return result;
}
