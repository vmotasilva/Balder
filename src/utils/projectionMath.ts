import type { Movement, ExpenseNature, MonthlyGridProjectionRow, SalaryContract } from '../types';

export interface ProjectionGridConfig {
  initialBalance?: number;
  defaultSalary?: number;
  fixedCostOverride?: number;
  horizonMonths?: number;
}

// Mapa de parcelas de cartão e avulsos por competência da planilha do usuário
// Mostra o decaimento gradual e realista dos cartões de crédito ao longo dos meses
export const creditCardSchedule: Record<string, number> = {
  '2026-09': 6706.53,
  '2026-10': 4902.49,
  '2026-11': 3502.93,
  '2026-12': 2687.27,
  '2027-01': 1829.54,
  '2027-02': 1551.81,
  '2027-03': 545.78,
  '2027-04': 274.47,
  '2027-05': 247.75,
  '2027-06': 136.74,
  '2027-07': 54.54,
  '2027-08': 0,
  '2027-09': 0,
  '2027-10': 0,
  '2027-11': 0,
};

export const variableCostSchedule: Record<string, number> = {
  '2026-09': 510.00,
  '2026-10': 360.00,
  '2026-11': 360.00,
  '2026-12': 600.00,
};

export const extrasSchedule: Record<string, number> = {
  '2026-09': 1000.00,
  '2026-12': 21311.33, // 13º Salário / Bônus
};

/**
 * Constrói o grid de projeção financeira mês a mês (2026 - 2027)
 * com base na estrutura da planilha do usuário.
 */
export function buildMonthlyProjectionGrid(
  movements: Movement[],
  natures: ExpenseNature[],
  initialBalance: number = 668.78,
  salaryContracts?: SalaryContract[]
): MonthlyGridProjectionRow[] {
  // Competências base: Setembro/2026 até Novembro/2027 (15 meses)
  const competenceMonths = [
    { key: '2026-09', date: '01/09/2026', label: 'Set/2026', monthIndex: 9, year: 2026 },
    { key: '2026-10', date: '01/10/2026', label: 'Out/2026', monthIndex: 10, year: 2026 },
    { key: '2026-11', date: '01/11/2026', label: 'Nov/2026', monthIndex: 11, year: 2026 },
    { key: '2026-12', date: '01/12/2026', label: 'Dez/2026', monthIndex: 12, year: 2026 },
    { key: '2027-01', date: '01/01/2027', label: 'Jan/2027', monthIndex: 1, year: 2027 },
    { key: '2027-02', date: '01/02/2027', label: 'Fev/2027', monthIndex: 2, year: 2027 },
    { key: '2027-03', date: '01/03/2027', label: 'Mar/2027', monthIndex: 3, year: 2027 },
    { key: '2027-04', date: '01/04/2027', label: 'Abr/2027', monthIndex: 4, year: 2027 },
    { key: '2027-05', date: '01/05/2027', label: 'Mai/2027', monthIndex: 5, year: 2027 },
    { key: '2027-06', date: '01/06/2027', label: 'Jun/2027', monthIndex: 6, year: 2027 },
    { key: '2027-07', date: '01/07/2027', label: 'Jul/2027', monthIndex: 7, year: 2027 },
    { key: '2027-08', date: '01/08/2027', label: 'Ago/2027', monthIndex: 8, year: 2027 },
    { key: '2027-09', date: '01/09/2027', label: 'Set/2027', monthIndex: 9, year: 2027 },
    { key: '2027-10', date: '01/10/2027', label: 'Out/2027', monthIndex: 10, year: 2027 },
    { key: '2027-11', date: '01/11/2027', label: 'Nov/2027', monthIndex: 11, year: 2027 },
  ];

  // Cálculo do Custo Fixo Mapeado das Naturezas com segregação de meio de pagamento
  let totalFixedFromNatures = 0;
  let fixedOnCardFromNatures = 0;
  let fixedDirectFromNatures = 0;

  natures.forEach((nat) => {
    nat.mappings.forEach((m) => {
      m.items.forEach((item) => {
        const itemVal = item.totalValue || item.quantity * item.price * (item.multiplierWeeks || 1);
        totalFixedFromNatures += itemVal;

        if (item.paymentMethod === 'CARTAO') {
          fixedOnCardFromNatures += itemVal;
        } else {
          fixedDirectFromNatures += itemVal;
        }
      });
    });
  });

  // Se não houver itens cadastrados nas naturezas, fallback para o valor base da planilha (R$ 3.945,67)
  const defaultMonthlyFixedCost = totalFixedFromNatures > 0 ? totalFixedFromNatures : 3945.67;
  const defaultFixedOnCard = fixedOnCardFromNatures;
  const defaultFixedDirect = fixedDirectFromNatures > 0 ? fixedDirectFromNatures : defaultMonthlyFixedCost;

  // Identificar salário cadastrado nas movimentações como fallback
  const salaryMovement = movements.find(
    (m) => m.type === 'RECEBER' && (m.category === 'Salário' || m.title.toLowerCase().includes('salário'))
  );
  const regularSalary = salaryMovement ? salaryMovement.amount : 8963.68;

  // Identificar parcela de empréstimo contratada
  const loanInstallment = movements.find((m) => m.type === 'EMPRESTIMO');
  const regularLoanPayment = loanInstallment ? loanInstallment.amount : 1415.54;

  const rows: MonthlyGridProjectionRow[] = [];
  let runningAccumulated = 0;

  competenceMonths.forEach((comp, idx) => {
    // 1. Saldo Inicial
    const isFirstMonth = idx === 0;
    const initial = isFirstMonth ? initialBalance : undefined;

    // 2. Extras Total (+)
    // Soma movimentações avulsas de recebimento daquele mês + schedule
    const customExtras = movements
      .filter((m) => m.type === 'RECEBER' && m.category !== 'Salário' && m.dueDate.startsWith(comp.key))
      .reduce((acc, m) => acc + m.amount, 0);
    const extrasTotal = (extrasSchedule[comp.key] || 0) + (customExtras > 0 ? customExtras : 0);

    // 3. Salário (+) calculado dinamicamente conforme reajustes vigentes na competência comp.key
    const isJanuary2027 = comp.key === '2027-01';
    let salary = 0;
    if (!isJanuary2027) {
      if (salaryContracts && salaryContracts.length > 0) {
        salary = salaryContracts
          .filter((sc) => sc.isActive)
          .reduce((sum, sc) => {
            if (!sc.history || sc.history.length === 0) return sum + sc.currentNetAmount;
            const sorted = [...sc.history].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
            const applicable = sorted.filter((a) => a.effectiveDate <= comp.key).pop();
            return sum + (applicable ? applicable.netAmount : sorted[0].netAmount);
          }, 0);
      } else {
        salary = regularSalary;
      }
    }

    // 4. Cartão de Crédito (-)
    const customCard = movements
      .filter((m) => m.type === 'CARTAO' && m.dueDate.startsWith(comp.key))
      .reduce((acc, m) => acc + m.amount, 0);
    const creditCardTotal = customCard > 0 && comp.key === '2026-10' ? customCard : (creditCardSchedule[comp.key] || 0);

    // 5. Custo Fixo Mapeado (-)
    const fixedCostMapped = defaultMonthlyFixedCost;
    const fixedCostOnCard = defaultFixedOnCard;
    const fixedCostDirect = defaultFixedDirect;

    // 6. Custos Avulsos (Variável) (-)
    const customVariable = movements
      .filter(
        (m) =>
          m.type === 'PAGAR' &&
          m.category !== 'Cartões' &&
          m.category !== 'Empréstimos' &&
          m.dueDate.startsWith(comp.key)
      )
      .reduce((acc, m) => acc + m.amount, 0);
    const variableCost = (variableCostSchedule[comp.key] || 0) + (customVariable > 0 && !variableCostSchedule[comp.key] ? customVariable : 0);

    // 7. Empréstimo (+) TOTAL (Valor Recebido)
    const loanReceived = 0;

    // 8. Empréstimo (-) TOTAL (Valor a pagar no mês)
    // Na planilha começa a pagar a partir de 11/2026
    const hasLoanPaymentThisMonth = comp.key >= '2026-11';
    const loanPayment = hasLoanPaymentThisMonth ? regularLoanPayment : 0;

    // 9. SALDO (Mês Net) COM REGRA ANTI-DUPLICIDADE:
    // O valor de custo fixo pago no cartão de crédito já integra a fatura do cartão (creditCardTotal).
    // O desembolso de caixa direto em conta/boleto é apenas fixedCostDirect.
    // Portanto, totalOutflow debita creditCardTotal + fixedCostDirect para evitar duplicidade!
    const totalInflow = extrasTotal + salary + loanReceived;
    const totalOutflow = creditCardTotal + fixedCostDirect + variableCost + loanPayment;
    const monthNet = Math.round((totalInflow - totalOutflow) * 100) / 100;

    // 10. SALDO ACUMULADO
    if (isFirstMonth) {
      runningAccumulated = monthNet;
    } else {
      runningAccumulated = Math.round((runningAccumulated + monthNet) * 100) / 100;
    }

    rows.push({
      monthKey: comp.key,
      formattedCompetence: comp.date,
      competenceLabel: comp.label,
      initialBalance: initial,
      extrasTotal,
      salary,
      creditCardTotal,
      fixedCostMapped,
      fixedCostOnCard,
      fixedCostDirect,
      variableCost,
      loanReceived,
      loanPayment,
      monthNet,
      accumulatedBalance: runningAccumulated,
      isDeficit: monthNet < 0,
    });
  });

  return rows;
}
