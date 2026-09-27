import type { Movement, ExpenseNature, MonthlyGridProjectionRow, MonthlyClosing } from '../types';
import { resolveMappingItemMonth } from './mappingItemState';

export interface ProjectionGridConfig {
  initialBalance?: number;
  defaultSalary?: number;
  fixedCostOverride?: number;
  horizonMonths?: number;
}

/**
 * Gera as competências do horizonte de projeção: 15 meses a partir do mês atual.
 */
/**
 * Competências da grade. Começa no mês do ponto de partida (marco), quando informado, ou no mês atual,
 * e vai até 15 meses à frente do mês atual (no mínimo 15 meses, no máximo 36).
 */
function generateCompetenceMonths(startDate?: string) {
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (startDate && /^\d{4}-\d{2}/.test(startDate)) {
    start = new Date(Number(startDate.slice(0, 4)), Number(startDate.slice(5, 7)) - 1, 1);
  }
  const monthsBeforeNow = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  const count = Math.min(36, Math.max(15, monthsBeforeNow + 15));
  const months = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
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
 * Identifica recebimentos de salário. Regra única usada pela grade e pelo detalhamento,
 * para que um lançamento nunca seja contado como salário e extra ao mesmo tempo.
 */
export function isSalaryMovement(m: Movement): boolean {
  if (m.type !== 'RECEBER') return false;
  const title = m.title.toLowerCase();
  return (
    m.category === 'Salário' ||
    (m.category || '').toLowerCase().includes('salário') ||
    title.includes('salário') ||
    title.includes('quinzena')
  );
}

/**
 * Competência (YYYY-MM) de um salário: a vinculada explicitamente pelo detalhamento
 * (installmentGroupId `sal_q1_YYYY-MM` / `sal_q2_YYYY-MM`) ou, na ausência, o mês de vencimento.
 */
export function getSalaryCompetenceKey(m: Movement): string {
  const linked = m.installmentGroupId?.match(/sal_q[12]_(\d{4}-\d{2})/);
  return linked ? linked[1] : m.dueDate.slice(0, 7);
}

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
  viewMode: ProjectionViewMode = 'PROJETADO',
  options: { startDate?: string } = {}
): MonthlyGridProjectionRow[] {
  const competenceMonths = generateCompetenceMonths(options.startDate);
  // Com ponto de partida, o saldo inicial do marco já inclui o que aconteceu antes da data:
  // só entram lançamentos a partir dela
  if (options.startDate) {
    const startDate = options.startDate;
    movements = movements.filter((m) => !m.dueDate || m.dueDate >= startDate);
  }

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
        if (isSalaryMovement(m)) return false;
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
      (m) => isSalaryMovement(m) && getSalaryCompetenceKey(m) === comp.key
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
    // Parcela ainda a realizar (modo PREVISTO) e itens diretos já realizados (modo REALIZADO)
    let pendingFixedFromNatures = 0;
    let pendingFixedOnCard = 0;
    let pendingFixedDirect = 0;
    const realizedDirectItems: { description: string; value: number }[] = [];

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
          // Pago + ainda pendente no mês (pagamentos registrados substituem o previsto das datas cobertas)
          const summary = resolveMappingItemMonth(item, comp.key);
          // Itens pagos por terceiros na competência não entram nos valores
          if (summary.state.paidByOthers) return;
          const onCard = item.paymentMethod === 'CARTAO';
          monthlyFixedFromNatures += summary.value;
          pendingFixedFromNatures += summary.pending;
          if (onCard) {
            monthlyFixedOnCard += summary.value;
            pendingFixedOnCard += summary.pending;
          } else {
            monthlyFixedDirect += summary.value;
            pendingFixedDirect += summary.pending;
            if (summary.paid > 0) realizedDirectItems.push({ description: item.description, value: summary.paid });
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

      // Itens mapeados (fora do cartão) marcados como realizados, sem pagamento lançado de mesmo nome
      realizedDirectItems.forEach((it) => {
        const alreadyLaunched = realizedPagar.some(
          (m) => m.title.toLowerCase() === it.description.toLowerCase()
        );
        if (!alreadyLaunched) realFixedSum += it.value;
      });

      fixedCostMapped = realFixedSum;
      fixedCostDirect = realFixedSum;
      fixedCostOnCard = 0;
      variableCost = realVarSum;
    } else if (viewMode === 'PREVISTO') {
      // No modo PREVISTO: custos fixos orçados ainda não realizados + custos variáveis a pagar
      fixedCostMapped = pendingFixedFromNatures;
      fixedCostOnCard = pendingFixedOnCard;
      fixedCostDirect = pendingFixedDirect;
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


