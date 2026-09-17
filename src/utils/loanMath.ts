import type { Movement } from '../types';

/**
 * Calcula o valor presente de uma parcela na data de pagamento informada
 * com base na taxa de juros mensal do contrato (descapitalização a juros compostos).
 * Conforme Resolução BACEN nº 3.516 e Art. 52 do Código de Defesa do Consumidor.
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

  try {
    const due = new Date(dueDateStr + 'T12:00:00');
    const pay = new Date(paymentDateStr + 'T12:00:00');
    const diffMs = due.getTime() - pay.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));

    // Se o pagamento for no dia ou após o vencimento, não há deságio de antecipação
    if (days <= 0 || monthlyRatePercent <= 0) {
      return {
        discountedAmount: nominalAmount,
        discountAmount: 0,
        discountPercent: 0,
        daysToDueDate: Math.max(0, days),
      };
    }

    const i = monthlyRatePercent / 100;
    const months = days / 30; // base comercial bancária padrão
    const discounted = nominalAmount / Math.pow(1 + i, months);

    const roundedDiscounted = Math.round(discounted * 100) / 100;
    const discount = Math.max(0, Math.round((nominalAmount - roundedDiscounted) * 100) / 100);
    const percent = Math.round((discount / nominalAmount) * 10000) / 100;

    return {
      discountedAmount: roundedDiscounted,
      discountAmount: discount,
      discountPercent: percent,
      daysToDueDate: days,
    };
  } catch (err) {
    return {
      discountedAmount: nominalAmount,
      discountAmount: 0,
      discountPercent: 0,
      daysToDueDate: 0,
    };
  }
}

export interface LoanContractGroup {
  groupId: string;
  title: string;
  bank: string;
  category: string;
  interestRatePercent: number;
  openInstallments: Movement[];
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
  const loanMovements = movements.filter((m) => m.type === 'EMPRESTIMO' && m.status === 'PREVISTA');

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
    // Ordenar por data de vencimento
    items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

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
    if (!rate) rate = 2.50; // fallback padrão se não especificado

    const totalCount = firstItem.installmentsTotal || items.length;
    const nominalBalance = items.reduce((sum, item) => sum + item.amount, 0);

    let pvSum = 0;
    items.forEach((item) => {
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
      openInstallments: items,
      totalInstallmentsCount: totalCount,
      nominalBalance: Math.round(nominalBalance * 100) / 100,
      presentValueToday: roundedPv,
      totalImmediateSavings: totalSavings,
    });
  });

  return result;
}
