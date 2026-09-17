import type { Movement, ExpenseNature, MonthlyGridProjectionRow, SalaryContract, SalaryAdjustment } from '../types';

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
interface SalaryResolution {
  total: number;
  first: number;          // 1ª quinzena (QUINZENAL)
  second: number;         // 2ª quinzena (QUINZENAL)
  weeklyAmount: number;   // Valor por semana (SEMANAL)
  weeklyCount: number;    // Nº de pagamentos semanais no mês (SEMANAL)
}

/**
 * Retorna o valor líquido total de um contrato para uma competência específica,
 * respeitando o histórico de reajustes e o formato de pagamento:
 *   - UNICO    : pagamento único mensal = netAmount
 *   - QUINZENAL: soma de 1ª + 2ª quinzena
 *   - SEMANAL  : weeklyAmount × nº de pagamentos do dia da semana no mês
 *
 * installmentValueMode:
 *   - 'FIXED' → usa os valores por período exatamente como cadastrados
 *   - 'AUTO'  → recalcula a partir do netAmount a cada resolução (ignora valores fixados)
 *   - undefined → comportamento legado: tenta FIXED; se não houver, cai em AUTO
 */
function resolveSalaryForMonth(sc: SalaryContract, compKey: string): SalaryResolution {
  const zero: SalaryResolution = { total: 0, first: 0, second: 0, weeklyAmount: 0, weeklyCount: 0 };

  if (!sc.startDate || sc.startDate > compKey) return zero;

  // ── Encontrar a entrada de histórico aplicável ──────────────────────────────
  let applicableEntry: SalaryAdjustment | null = null;
  if (sc.history && sc.history.length > 0) {
    const sorted = [...sc.history].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    applicableEntry = sorted.filter((a) => a.effectiveDate <= compKey).pop() ?? null;
  }

  // Valores base: preferir entrada do histórico
  const baseNetAmount = applicableEntry?.netAmount ?? sc.currentNetAmount;

  // O modo vigente: a entrada do histórico pode sobrescrever o do contrato
  const mode = applicableEntry?.installmentValueMode ?? sc.installmentValueMode;

  // Valores explícitos por período (só relevantes no modo FIXED ou legado)
  const storedFirst       = applicableEntry?.firstInstallmentAmount  ?? sc.firstInstallmentAmount  ?? 0;
  const storedSecond      = applicableEntry?.secondInstallmentAmount ?? sc.secondInstallmentAmount ?? 0;
  const storedWeeklyValue = applicableEntry?.weeklyInstallmentAmount ?? sc.weeklyInstallmentAmount ?? 0;

  const schedule = sc.paymentSchedule ?? 'UNICO';

  // ── UNICO ──────────────────────────────────────────────────────────────────
  if (schedule === 'UNICO') {
    return { total: baseNetAmount, first: 0, second: 0, weeklyAmount: 0, weeklyCount: 0 };
  }

  // ── QUINZENAL ──────────────────────────────────────────────────────────────
  if (schedule === 'QUINZENAL') {
    const isFixed = mode === 'FIXED' || (mode === undefined && storedFirst > 0);

    if (isFixed && storedFirst > 0) {
      const first  = storedFirst;
      const second = storedSecond > 0 ? storedSecond : Math.round((baseNetAmount - first) * 100) / 100;
      return { total: first + second, first, second, weeklyAmount: 0, weeklyCount: 0 };
    }

    // AUTO: derivar do percentual ou 40/60 padrão
    const pct    = sc.firstInstallmentPercent ?? 40;
    const first  = Math.round((baseNetAmount * pct) / 100 * 100) / 100;
    const second = Math.round((baseNetAmount - first) * 100) / 100;
    return { total: baseNetAmount, first, second, weeklyAmount: 0, weeklyCount: 0 };
  }

  // ── SEMANAL ────────────────────────────────────────────────────────────────
  const dayOfWeek = sc.weeklyPaymentDayOfWeek ?? 5;
  const [yearStr, monthStr] = compKey.split('-');
  const year      = parseInt(yearStr, 10);
  const month     = parseInt(monthStr, 10);
  const weeklyCount = countWeekdayOccurrencesInMonth(year, month, dayOfWeek);

  const isFixed = mode === 'FIXED' || (mode === undefined && storedWeeklyValue > 0);

  if (isFixed && storedWeeklyValue > 0) {
    const total = Math.round(storedWeeklyValue * weeklyCount * 100) / 100;
    return { total, first: 0, second: 0, weeklyAmount: storedWeeklyValue, weeklyCount };
  }

  // AUTO: deriva semanalmente do líquido anual ÷ 52
  const weeklyFromAnnual = Math.round((baseNetAmount * 12 / 52) * 100) / 100;
  const total = Math.round(weeklyFromAnnual * weeklyCount * 100) / 100;
  return { total, first: 0, second: 0, weeklyAmount: weeklyFromAnnual, weeklyCount };
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
export function buildMonthlyProjectionGrid(
  movements: Movement[],
  natures: ExpenseNature[],
  initialBalance: number = 0,
  salaryContracts?: SalaryContract[]
): MonthlyGridProjectionRow[] {
  const competenceMonths = generateCompetenceMonths();

  // ── Custo Fixo das Naturezas (segregado por meio de pagamento) ──────────────
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

  const defaultMonthlyFixedCost = totalFixedFromNatures;
  const defaultFixedOnCard = fixedOnCardFromNatures;
  const defaultFixedDirect = fixedDirectFromNatures;

  const loanMovements = movements.filter((m) => m.type === 'EMPRESTIMO');

  const rows: MonthlyGridProjectionRow[] = [];
  let runningAccumulated = 0;

  competenceMonths.forEach((comp, idx) => {
    const isFirstMonth = idx === 0;
    const initial = isFirstMonth ? initialBalance : undefined;

    // ── 1. Extras / Receitas avulsas (+) ──────────────────────────────────────
    const extrasTotal = movements
      .filter(
        (m) =>
          m.type === 'RECEBER' &&
          m.category !== 'Salário' &&
          !m.title.toLowerCase().includes('salário') &&
          m.dueDate.startsWith(comp.key)
      )
      .reduce((acc, m) => acc + m.amount, 0);

    // ── 2. Salário (+) — suporta UNICO, QUINZENAL e SEMANAL ──────────────────
    let salary = 0;
    let salaryFirstInstallment: number | undefined;
    let salarySecondInstallment: number | undefined;
    let salaryWeeklyAmount: number | undefined;
    let salaryWeeklyInstallments: number | undefined;

    if (salaryContracts && salaryContracts.length > 0) {
      salaryContracts
        .filter((sc) => sc.isActive)
        .forEach((sc) => {
          const res = resolveSalaryForMonth(sc, comp.key);
          salary = Math.round((salary + res.total) * 100) / 100;

          if (res.first > 0 || res.second > 0) {
            salaryFirstInstallment  = Math.round(((salaryFirstInstallment  ?? 0) + res.first)  * 100) / 100;
            salarySecondInstallment = Math.round(((salarySecondInstallment ?? 0) + res.second) * 100) / 100;
          }
          if (res.weeklyCount > 0) {
            salaryWeeklyAmount       = Math.round(((salaryWeeklyAmount      ?? 0) + res.weeklyAmount) * 100) / 100;
            salaryWeeklyInstallments = Math.max(salaryWeeklyInstallments ?? 0, res.weeklyCount); // usa maior (múltiplos contratos semanais são raros)
          }
        });
    } else {
      // Fallback: movimentos de salário cadastrados para o mês
      salary = movements
        .filter(
          (m) =>
            m.type === 'RECEBER' &&
            (m.category === 'Salário' || m.title.toLowerCase().includes('salário')) &&
            m.dueDate.startsWith(comp.key)
        )
        .reduce((acc, m) => acc + m.amount, 0);
    }

    // ── 3. Cartão de Crédito (-) ───────────────────────────────────────────────
    const creditCardTotal = movements
      .filter((m) => m.type === 'CARTAO' && m.dueDate.startsWith(comp.key))
      .reduce((acc, m) => acc + m.amount, 0);

    // ── 4. Custo Fixo Mapeado (-) ──────────────────────────────────────────────
    const fixedCostMapped  = defaultMonthlyFixedCost;
    const fixedCostOnCard  = defaultFixedOnCard;
    const fixedCostDirect  = defaultFixedDirect;

    // ── 5. Custos Avulsos / Variáveis (-) ─────────────────────────────────────
    const variableCost = movements
      .filter(
        (m) =>
          m.type === 'PAGAR' &&
          m.category !== 'Cartões' &&
          m.category !== 'Empréstimos' &&
          m.dueDate.startsWith(comp.key)
      )
      .reduce((acc, m) => acc + m.amount, 0);

    // ── 6. Empréstimos Recebidos (+) ───────────────────────────────────────────
    const loanReceived = movements
      .filter((m) => m.type === 'EMPRESTIMO' && m.category === 'Recebimento' && m.dueDate.startsWith(comp.key))
      .reduce((acc, m) => acc + m.amount, 0);

    // ── 7. Parcelas de Empréstimo (-) ──────────────────────────────────────────
    const loanPayment = loanMovements
      .filter((m) => m.category !== 'Recebimento' && m.dueDate.startsWith(comp.key))
      .reduce((acc, m) => acc + m.amount, 0);

    // ── 8. Saldo do Mês ────────────────────────────────────────────────────────
    const totalInflow  = extrasTotal + salary + loanReceived;
    const totalOutflow = creditCardTotal + fixedCostDirect + variableCost + loanPayment;
    const monthNet     = Math.round((totalInflow - totalOutflow) * 100) / 100;

    // ── 9. Saldo Acumulado ─────────────────────────────────────────────────────
    if (isFirstMonth) {
      runningAccumulated = Math.round((initialBalance + monthNet) * 100) / 100;
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
    });
  });

  return rows;
}

/**
 * Gera movimentos VIRTUAIS (previstos) a partir dos contratos de salário cadastrados.
 * Esses movimentos não existem no Appwrite — são projetados para exibição na tela
 * de Movimentações → Receber → Previstas.
 *
 * Geração: mês atual + próximos 11 meses (12 meses no total).
 * Retorna objetos com id prefixado em "salary_virtual_" para diferenciá-los.
 */
export function generateSalaryVirtualMovements(
  salaryContracts: SalaryContract[]
): (Movement & { isSalaryVirtual: true })[] {
  if (!salaryContracts || salaryContracts.length === 0) return [];

  const result: (Movement & { isSalaryVirtual: true })[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-indexed
    const compKey = `${year}-${String(month).padStart(2, '0')}`;

    for (const sc of salaryContracts) {
      if (!sc.startDate || sc.startDate > compKey) continue;
      if (!sc.isActive) continue;

      const resolution = resolveSalaryForMonth(sc, compKey);
      if (resolution.total <= 0) continue;

      // Título a exibir: usa o employer + role como label
      const contractTitle = [sc.employer, sc.role].filter(Boolean).join(' — ') || 'Salário';
      const bankName = sc.receivingBankName ?? '';
      const baseId = `salary_virtual_${sc.id}_${compKey}`;
      const schedule = sc.paymentSchedule ?? 'UNICO';

      if (schedule === 'QUINZENAL') {
        // 1ª quinzena: usa secondPaymentDay (adiantamento, ex: dia 15)
        const day1 = sc.secondPaymentDay ?? 15;
        const date1 = `${year}-${String(month).padStart(2, '0')}-${String(day1).padStart(2, '0')}`;
        result.push({
          id: `${baseId}_1`,
          title: `${contractTitle} (1ª quinzena)`,
          type: 'RECEBER',
          amount: resolution.first,
          dueDate: date1,
          bank: bankName,
          status: 'PREVISTA',
          category: 'Salário',
          notes: `Contrato: ${sc.employer}`,
          isSalaryVirtual: true,
        });

        // 2ª quinzena: usa paymentDay (principal, ex: dia 5 do mês seguinte ou dia 1)
        const day2 = sc.paymentDay;
        const daysInMonth = new Date(year, month, 0).getDate();
        const clampedDay2 = Math.min(day2, daysInMonth);
        const date2 = `${year}-${String(month).padStart(2, '0')}-${String(clampedDay2).padStart(2, '0')}`;
        result.push({
          id: `${baseId}_2`,
          title: `${contractTitle} (2ª quinzena)`,
          type: 'RECEBER',
          amount: resolution.second,
          dueDate: date2,
          bank: bankName,
          status: 'PREVISTA',
          category: 'Salário',
          notes: `Contrato: ${sc.employer}`,
          isSalaryVirtual: true,
        });

      } else if (schedule === 'SEMANAL') {
        const dayOfWeek = sc.weeklyPaymentDayOfWeek ?? 5;
        const daysInMonth = new Date(year, month, 0).getDate();
        let weekIdx = 0;
        for (let day = 1; day <= daysInMonth; day++) {
          const wd = new Date(year, month - 1, day).getDay();
          if (wd === dayOfWeek) {
            weekIdx++;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            result.push({
              id: `${baseId}_w${weekIdx}`,
              title: `${contractTitle} (semana ${weekIdx})`,
              type: 'RECEBER',
              amount: resolution.weeklyAmount,
              dueDate: dateStr,
              bank: bankName,
              status: 'PREVISTA',
              category: 'Salário',
              notes: `Contrato: ${sc.employer}`,
              isSalaryVirtual: true,
            });
          }
        }

      } else {
        // UNICO
        const daysInMonth = new Date(year, month, 0).getDate();
        const clampedDay = Math.min(sc.paymentDay, daysInMonth);
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
        result.push({
          id: baseId,
          title: contractTitle,
          type: 'RECEBER',
          amount: resolution.total,
          dueDate: dateStr,
          bank: bankName,
          status: 'PREVISTA',
          category: 'Salário',
          notes: `Contrato: ${sc.employer}`,
          isSalaryVirtual: true,
        });
      }
    }
  }

  return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

