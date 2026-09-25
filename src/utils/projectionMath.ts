import type { Movement, ExpenseNature, MonthlyGridProjectionRow, MonthlyClosing } from '../types';

export interface ProjectionGridConfig {
  initialBalance?: number;
  defaultSalary?: number;
  fixedCostOverride?: number;
  horizonMonths?: number;
}

/**
 * Gera as competências do horizonte de projeção: 15 meses a partir do mês atual.
 */
function generateCompetenceMonths() {
  const now = new Date();
  const months = [];
  for (let i = 0; i < 15; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    const date = `01/${String(month).padStart(2, '0')}/${year}`;
    months.push({ key, date, label, monthIndex: month, year });
  }
  return months;
}

/**
 * Conta quantas ocorrências de um determinado dia da semana existem em um mês.
 * @param year  Ano (ex: 2026)
 * @param month Mês 1-indexed (ex: 9 = setembro)
 * @param dayOfWeek 0 = Domingo … 6 = Sábado (padrão JS Date)
 */
function countWeekdayOccurrencesInMonth(year: number, month: number, dayOfWeek: number): number {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  // Quantos dias completos do mês têm aquele dia da semana
  let count = Math.floor(daysInMonth / 7);
  const remainder = daysInMonth % 7;
  // Os dias "sobrando" após as semanas completas (começando do firstDay)
  for (let extra = 0; extra < remainder; extra++) {
    if ((firstDay + extra) % 7 === dayOfWeek) {
      count++;
    }
  }
  return count;
}

/**
 * Resultado da resolução do salário para uma competência.
 */

/**
 * Constrói o grid de projeção financeira mês a mês.
 * Utiliza APENAS dados efetivamente cadastrados pelo usuário.
 * Sem valores hardcoded ou fallbacks arbitrários.
 *
 * Formatos de pagamento suportados:
 *   - UNICO    : pagamento integral único no mês
 *   - QUINZENAL: dois pagamentos (1ª + 2ª quinzena) com valores específicos ou percentual
 *   - SEMANAL  : N pagamentos por semana no mês (conta ocorrências reais do dia da semana)
 */
export type ProjectionViewMode = 'PROJETADO' | 'REALIZADO' | 'PREVISTO';

/**
 * Constrói as linhas do Grid Mensal (Visão Macro & DRE Glanceable)
 *
 * Suporta 3 modos de visão (viewMode):
 *   - PROJETADO : consolidado completo (valores realizados + previstos)
 *   - REALIZADO : estritamente movimentações e entradas efetivadas (status === 'REALIZADA')
 *   - PREVISTO  : lançamentos e contratos planejados a vencer (status === 'PREVISTA')
 */
export function buildMonthlyProjectionGrid(
  movements: Movement[],
  natures: ExpenseNature[],
  initialBalance: number = 0,
  monthlyClosings?: MonthlyClosing[],
  viewMode: ProjectionViewMode = 'PROJETADO'
): MonthlyGridProjectionRow[] {
  const competenceMonths = generateCompetenceMonths();

  const loanMovements = movements.filter((m) => m.type === 'EMPRESTIMO');

  const rows: MonthlyGridProjectionRow[] = [];
  let runningAccumulated = 0;

  competenceMonths.forEach((comp, idx) => {
    const isFirstMonth = idx === 0;
    const prevMonthKey = idx > 0 ? competenceMonths[idx - 1].key : undefined;

    // Determina o Saldo Inicial do mês:
    let initial = 0;
    if (isFirstMonth) {
      initial = initialBalance;
    } else if (prevMonthKey) {
      const prevClosing = monthlyClosings?.find(
        (c) => c.monthKey === prevMonthKey && c.status === 'FECHADO'
      );
      if (prevClosing) {
        initial = prevClosing.closingBalance;
      } else {
        initial = runningAccumulated;
      }
    }

    // ── 1. Extras / Receitas avulsas (+) ──────────────────────────────────────
    const extrasTotal = movements
      .filter((m) => {
        if (m.type !== 'RECEBER') return false;
        if (m.category === 'Salário' || m.title.toLowerCase().includes('salário')) return false;
        if (!m.dueDate.startsWith(comp.key)) return false;
        if (viewMode === 'REALIZADO') return m.status === 'REALIZADA';
        if (viewMode === 'PREVISTO') return m.status === 'PREVISTA';
        return true;
      })
      .reduce((acc, m) => acc + m.amount, 0);

    // ── 2. Salário (+) ────────────────────────────────────────────────────────
    let salary = 0;
    let salaryFirstInstallment: number | undefined;
    let salarySecondInstallment: number | undefined;
    let salaryWeeklyAmount: number | undefined;
    let salaryWeeklyInstallments: number | undefined;

    const realSalariesForMonth = movements.filter(
      (m) =>
        m.type === 'RECEBER' &&
        (m.category === 'Salário' ||
          m.title.toLowerCase().includes('salário') ||
          m.title.toLowerCase().includes('quinzena')) &&
        (m.dueDate.startsWith(comp.key) || (m.installmentGroupId && m.installmentGroupId.includes(comp.key)))
    );

    let applicableSalaries = realSalariesForMonth;
    if (viewMode === 'REALIZADO') {
      applicableSalaries = realSalariesForMonth.filter((m) => m.status === 'REALIZADA');
    } else if (viewMode === 'PREVISTO') {
      applicableSalaries = realSalariesForMonth.filter((m) => m.status === 'PREVISTA');
    }
    
    salary = applicableSalaries.reduce((acc, m) => acc + m.amount, 0);

    const mQ1 = applicableSalaries.find(
      (m) =>
        m.title.toLowerCase().includes('1ª') ||
        m.title.toLowerCase().includes('adiantamento') ||
        m.installmentGroupId?.includes('q1')
    );
    const mQ2 = applicableSalaries.find(
      (m) =>
        m.title.toLowerCase().includes('2ª') ||
        m.title.toLowerCase().includes('principal') ||
        m.installmentGroupId?.includes('q2')
    );
    if (mQ1) salaryFirstInstallment = mQ1.amount;
    if (mQ2) salarySecondInstallment = mQ2.amount;

    // ── 3. Cartão de Crédito (-) ───────────────────────────────────────────────
    const creditCardTotal = movements
      .filter((m) => {
        if (m.type !== 'CARTAO') return false;
        if (!m.dueDate.startsWith(comp.key)) return false;
        if (viewMode === 'REALIZADO') return m.status === 'REALIZADA';
        if (viewMode === 'PREVISTO') return m.status === 'PREVISTA';
        return true;
      })
      .reduce((acc, m) => acc + m.amount, 0);

    // ── 4. Custo Fixo Mapeado (-) neste Mês de Competência & 5. Custos Avulsos / Variáveis (-)
    const compMonthNumber = parseInt(comp.key.split('-')[1], 10);
    let monthlyFixedFromNatures = 0;
    let monthlyFixedOnCard = 0;
    let monthlyFixedDirect = 0;

    natures.forEach((nat) => {
      nat.mappings.forEach((m) => {
        if (
          m.applicableMonths &&
          m.applicableMonths.length > 0 &&
          !m.applicableMonths.includes(compMonthNumber)
        ) {
          return;
        }
        m.items.forEach((item) => {
          const itemVal = item.totalValue || item.quantity * item.price * (item.multiplierWeeks || 1);
          monthlyFixedFromNatures += itemVal;
          if (item.paymentMethod === 'CARTAO') {
            monthlyFixedOnCard += itemVal;
          } else {
            monthlyFixedDirect += itemVal;
          }
        });
      });
    });

    let fixedCostMapped = monthlyFixedFromNatures;
    let fixedCostOnCard = monthlyFixedOnCard;
    let fixedCostDirect = monthlyFixedDirect;
    let variableCost = 0;

    if (viewMode === 'REALIZADO') {
      // No modo REALIZADO: não projeta teto não gasto. Apura despesas pagas.
      const realizedPagar = movements.filter(
        (m) =>
          m.type === 'PAGAR' &&
          m.category !== 'Cartões' &&
          m.category !== 'Empréstimos' &&
          m.dueDate.startsWith(comp.key) &&
          m.status === 'REALIZADA'
      );

      let realFixedSum = 0;
      let realVarSum = 0;

      realizedPagar.forEach((m) => {
        const isFixed =
          !!m.natureId ||
          m.category === 'Custos Fixos' ||
          m.category === 'Habitação' ||
          m.category === 'Assinaturas' ||
          natures.some(
            (nat) =>
              nat.name.toLowerCase() === m.category.toLowerCase() ||
              nat.mappings.some((mp) => {
                if (
                  mp.applicableMonths &&
                  mp.applicableMonths.length > 0 &&
                  !mp.applicableMonths.includes(compMonthNumber)
                ) {
                  return false;
                }
                return mp.items.some((it) => it.description.toLowerCase() === m.title.toLowerCase());
              })
          );
        if (isFixed) {
          realFixedSum += m.amount;
        } else {
          realVarSum += m.amount;
        }
      });

      fixedCostMapped = realFixedSum;
      fixedCostDirect = realFixedSum;
      fixedCostOnCard = 0;
      variableCost = realVarSum;
    } else if (viewMode === 'PREVISTO') {
      // No modo PREVISTO: custos fixos orçados + custos variáveis a pagar
      fixedCostMapped = monthlyFixedFromNatures;
      fixedCostOnCard = monthlyFixedOnCard;
      fixedCostDirect = monthlyFixedDirect;
      variableCost = movements
        .filter(
          (m) =>
            m.type === 'PAGAR' &&
            m.category !== 'Cartões' &&
            m.category !== 'Empréstimos' &&
            m.dueDate.startsWith(comp.key) &&
            m.status === 'PREVISTA'
        )
        .reduce((acc, m) => acc + m.amount, 0);
    } else {
      // Modo PROJETADO consolidado
      fixedCostMapped = monthlyFixedFromNatures;
      fixedCostOnCard = monthlyFixedOnCard;
      fixedCostDirect = monthlyFixedDirect;
      variableCost = movements
        .filter(
          (m) =>
            m.type === 'PAGAR' &&
            m.category !== 'Cartões' &&
            m.category !== 'Empréstimos' &&
            m.dueDate.startsWith(comp.key)
        )
        .reduce((acc, m) => acc + m.amount, 0);
    }

    // ── 6. Empréstimos Recebidos (+) ───────────────────────────────────────────
    const loanReceived = movements
      .filter((m) => {
        if (m.type !== 'EMPRESTIMO' || m.category !== 'Recebimento' || !m.dueDate.startsWith(comp.key)) return false;
        if (viewMode === 'REALIZADO') return m.status === 'REALIZADA';
        if (viewMode === 'PREVISTO') return m.status === 'PREVISTA';
        return true;
      })
      .reduce((acc, m) => acc + m.amount, 0);

    // ── 7. Parcelas de Empréstimo (-) ──────────────────────────────────────────
    const loanPayment = loanMovements
      .filter((m) => {
        if (m.category === 'Recebimento' || !m.dueDate.startsWith(comp.key)) return false;
        if (viewMode === 'REALIZADO') return m.status === 'REALIZADA';
        if (viewMode === 'PREVISTO') return m.status === 'PREVISTA';
        return true;
      })
      .reduce((acc, m) => acc + m.amount, 0);

    // ── 8. Saldo do Mês ────────────────────────────────────────────────────────
    const totalInflow = extrasTotal + salary + loanReceived;
    const totalOutflow = creditCardTotal + fixedCostDirect + variableCost + loanPayment;
    const monthNet = Math.round((totalInflow - totalOutflow) * 100) / 100;

    // Verificar se o mês atual já possui fechamento formalizado
    const currentClosing = monthlyClosings?.find(
      (c) => c.monthKey === comp.key && c.status === 'FECHADO'
    );
    const isClosed = !!currentClosing;

    // ── 9. Saldo Acumulado ─────────────────────────────────────────────────────
    if (isClosed && currentClosing) {
      runningAccumulated = currentClosing.closingBalance;
    } else {
      runningAccumulated = Math.round((initial + monthNet) * 100) / 100;
    }

    rows.push({
      monthKey: comp.key,
      formattedCompetence: comp.date,
      competenceLabel: comp.label,
      initialBalance: initial,
      extrasTotal,
      salary,
      salaryFirstInstallment:   salaryFirstInstallment   && salaryFirstInstallment   > 0 ? salaryFirstInstallment   : undefined,
      salarySecondInstallment:  salarySecondInstallment  && salarySecondInstallment  > 0 ? salarySecondInstallment  : undefined,
      salaryWeeklyAmount:       salaryWeeklyAmount       && salaryWeeklyAmount       > 0 ? salaryWeeklyAmount       : undefined,
      salaryWeeklyInstallments: salaryWeeklyInstallments && salaryWeeklyInstallments > 0 ? salaryWeeklyInstallments : undefined,
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
      isClosed,
      closingDetails: currentClosing,
      previousMonthKey: prevMonthKey,
      isFirstMonth,
    });
  });

  return rows;
}


