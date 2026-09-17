import type { SalaryContract, Movement, MovementStatus } from '../types';

export interface SalarySuggestionResult {
  hasContract: boolean;
  contract?: SalaryContract;
  title: string;
  amount: number;
  dueDate: string;
  bank: string;
  category: string;
  status: MovementStatus;
  notes: string;
  periodLabel: string;
  isQuinzenal: boolean;
  isSecondQuinzena: boolean;
  dueDay: number;
  shouldPromptConfirmation: boolean;
}

/**
 * Analisa o contrato de salário vigente, o dia atual e o histórico de movimentações
 * para propor o recebimento de salário com o valor correto e sugerir a quinzena/período correto.
 */
export function getSalarySuggestion(
  contracts: SalaryContract[],
  movements: Movement[] = [],
  referenceDate: Date = new Date()
): SalarySuggestionResult {
  const activeContract = contracts.find((c) => c.isActive) || contracts[0];

  const todayDay = referenceDate.getDate();
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1; // 1..12
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const todayStr = referenceDate.toISOString().split('T')[0];

  if (!activeContract) {
    return {
      hasContract: false,
      title: 'Salário Mensal',
      amount: 0,
      dueDate: todayStr,
      bank: 'Nubank',
      category: 'Salário',
      status: 'REALIZADA',
      notes: 'Recebimento de salário',
      periodLabel: 'Salário',
      isQuinzenal: false,
      isSecondQuinzena: false,
      dueDay: 5,
      shouldPromptConfirmation: false,
    };
  }

  const schedule = activeContract.paymentSchedule || (activeContract.secondPaymentDay ? 'QUINZENAL' : 'UNICO');
  const net = activeContract.currentNetAmount || 0;
  const bank = activeContract.receivingBankName || 'Nubank';

  if (schedule === 'QUINZENAL') {
    const daysInMonth = new Date(year, month, 0).getDate();
    const day1 = activeContract.secondPaymentDay || 15; // Adiantamento (ex: dia 15)
    const rawDay2 = activeContract.paymentDay || 1;     // Saldo com descontos (ex: dia 31, 30 ou 1)
    const day2 = rawDay2 === 31 ? daysInMonth : Math.min(rawDay2, daysInMonth);

    const autoPct = activeContract.firstInstallmentPercent || 40;
    const firstAmt = activeContract.firstInstallmentAmount || Math.round(net * (autoPct / 100) * 100) / 100;
    const secondAmt = activeContract.secondInstallmentAmount || Math.round((net - firstAmt) * 100) / 100;

    // Helper para verificar se a movimentação é de salário
    const isSalaryMov = (m: Movement) => {
      if (m.type !== 'RECEBER') return false;
      const t = m.title.toLowerCase();
      const n = (m.notes || '').toLowerCase();
      const c = m.category.toLowerCase();
      const emp = (activeContract.employer || '').toLowerCase();
      return (
        c.includes('salário') ||
        c.includes('salario') ||
        c.includes('renda') ||
        t.includes('salário') ||
        t.includes('salario') ||
        t.includes('quinzena') ||
        n.includes('salarial') ||
        (emp && t.includes(emp))
      );
    };

    // Verificar se já existe a 1ª quinzena lançada no mês corrente
    const firstQuinzenaMov = movements.find((m) => {
      if (!isSalaryMov(m)) return false;
      if (!m.dueDate.startsWith(monthKey)) return false;
      const t = m.title.toLowerCase();
      const n = (m.notes || '').toLowerCase();
      const dayNum = parseInt(m.dueDate.slice(8, 10), 10);
      return (
        t.includes('1ª quinzena') ||
        t.includes('1a quinzena') ||
        t.includes('adiantamento') ||
        n.includes('1ª quinzena') ||
        n.includes('adiantamento') ||
        (dayNum >= 10 && dayNum <= 24)
      );
    });

    // Verificar se já existe a 2ª quinzena lançada no mês corrente
    const secondQuinzenaMov = movements.find((m) => {
      if (!isSalaryMov(m)) return false;
      if (!m.dueDate.startsWith(monthKey)) return false;
      const t = m.title.toLowerCase();
      const n = (m.notes || '').toLowerCase();
      const dayNum = parseInt(m.dueDate.slice(8, 10), 10);
      return (
        t.includes('2ª quinzena') ||
        t.includes('2a quinzena') ||
        t.includes('saldo') ||
        n.includes('2ª quinzena') ||
        n.includes('saldo') ||
        dayNum >= 25 ||
        dayNum <= 9
      );
    });

    const hasFirst = !!firstQuinzenaMov;
    const hasSecond = !!secondQuinzenaMov;

    let targetQuinzena: 1 | 2 = 1;
    let targetYear = year;
    let targetMonth = month;
    let targetDay = day1;

    if (hasFirst && !hasSecond) {
      // 1ª quinzena já foi praticada! A parcela ativa do mês é a 2ª quinzena
      targetQuinzena = 2;
      targetDay = day2;
    } else if (!hasFirst && hasSecond) {
      // 2ª quinzena já registrada, mas falta a 1ª
      targetQuinzena = 1;
      targetDay = day1;
    } else if (hasFirst && hasSecond) {
      // Ambas quinzenas do mês corrente já estão lançadas -> Propor a 1ª quinzena do próximo mês!
      const nextMonthDate = new Date(year, month, 1);
      targetYear = nextMonthDate.getFullYear();
      targetMonth = nextMonthDate.getMonth() + 1;
      targetQuinzena = 1;
      targetDay = day1;
    } else {
      // Nenhuma das duas lançada no mês:
      // Se hoje for após a metade do caminho entre dia1 e dia2 (ex: dia 23), sugere a 2ª; caso contrário, a 1ª
      const midPoint = Math.floor((day1 + day2) / 2);
      if (todayDay > midPoint) {
        targetQuinzena = 2;
        targetDay = day2;
      } else {
        targetQuinzena = 1;
        targetDay = day1;
      }
    }

    const isFirst = targetQuinzena === 1;
    const amount = isFirst ? firstAmt : secondAmt;
    const dueDay = targetDay;
    const isoDueDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

    // Se a data de vencimento estiver no futuro em relação a hoje, sugere PREVISTA; se for hoje ou passada, REALIZADA
    const isFuture = isoDueDate > todayStr;
    const suggestedStatus: MovementStatus = isFuture ? 'PREVISTA' : 'REALIZADA';

    const periodLabel = isFirst ? '1ª quinzena' : '2ª quinzena';

    // Banner de prompt inteligente (para quando a data da parcela estiver próxima e ainda não realizada)
    const targetMov = isFirst ? firstQuinzenaMov : secondQuinzenaMov;
    const isTargetRealized = targetMov?.status === 'REALIZADA';
    const dayDiff = Math.abs(todayDay - dueDay);
    const inConfirmationWindow =
      targetYear === year &&
      targetMonth === month &&
      (dayDiff <= 3 || (todayDay >= dueDay && todayDay <= dueDay + 7));
    const shouldPrompt = inConfirmationWindow && !isTargetRealized && net > 0;

    return {
      hasContract: true,
      contract: activeContract,
      title: `${activeContract.employer} — ${activeContract.role} (${periodLabel})`,
      amount,
      dueDate: isoDueDate,
      bank,
      category: 'Salário',
      status: suggestedStatus,
      periodLabel,
      isQuinzenal: true,
      isSecondQuinzena: !isFirst,
      dueDay,
      notes: isFirst
        ? `Adiantamento salarial (${activeContract.employer})`
        : `Saldo de salário do mês com descontos da folha (${activeContract.employer})`,
      shouldPromptConfirmation: shouldPrompt,
    };
  }

  if (schedule === 'SEMANAL') {
    const weekNum = Math.ceil(todayDay / 7);
    const weeklyAmt = activeContract.weeklyInstallmentAmount || Math.round((net * 12 / 52) * 100) / 100;
    const periodLabel = `Semana ${weekNum}`;

    const alreadyRegistered = movements.some((m) => {
      return (
        m.type === 'RECEBER' &&
        m.status === 'REALIZADA' &&
        (m.category === 'Salário' || m.title.toLowerCase().includes('semana')) &&
        m.dueDate.startsWith(monthKey) &&
        m.title.includes(`Semana ${weekNum}`)
      );
    });

    const targetDayOfWeek = activeContract.weeklyPaymentDayOfWeek ?? 5;
    const currentDayOfWeek = referenceDate.getDay();
    const isPayDayOrNear = Math.abs(currentDayOfWeek - targetDayOfWeek) <= 1;

    return {
      hasContract: true,
      contract: activeContract,
      title: `${activeContract.employer} — ${activeContract.role} (Semana ${weekNum})`,
      amount: weeklyAmt,
      dueDate: todayStr,
      bank,
      category: 'Salário',
      status: 'REALIZADA',
      periodLabel,
      isQuinzenal: false,
      isSecondQuinzena: false,
      dueDay: todayDay,
      notes: `Pagamento salarial semanal (${activeContract.employer})`,
      shouldPromptConfirmation: isPayDayOrNear && !alreadyRegistered && net > 0,
    };
  }

  // UNICO (Mensal Integral)
  const daysInMonth = new Date(year, month, 0).getDate();
  const rawDueDay = activeContract.paymentDay || 1;
  const dueDay = Math.min(rawDueDay, daysInMonth);

  const alreadyRegistered = movements.some((m) => {
    return (
      m.type === 'RECEBER' &&
      (m.category === 'Salário' || m.title.toLowerCase().includes(activeContract.employer.toLowerCase())) &&
      m.dueDate.startsWith(monthKey)
    );
  });

  let targetYear = year;
  let targetMonth = month;
  let targetDay = dueDay;

  if (alreadyRegistered) {
    // Já lançado no mês corrente: propor o do próximo mês!
    const nextMonthDate = new Date(year, month, 1);
    targetYear = nextMonthDate.getFullYear();
    targetMonth = nextMonthDate.getMonth() + 1;
    const nextDaysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    targetDay = Math.min(rawDueDay, nextDaysInMonth);
  }

  const isoDueDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
  const isFuture = isoDueDate > todayStr;
  const suggestedStatus: MovementStatus = isFuture ? 'PREVISTA' : 'REALIZADA';

  const inConfirmationWindow =
    targetYear === year &&
    targetMonth === month &&
    (Math.abs(todayDay - dueDay) <= 4 || (todayDay >= dueDay && todayDay <= dueDay + 7));

  return {
    hasContract: true,
    contract: activeContract,
    title: `${activeContract.employer} — ${activeContract.role} (Salário Integral)`,
    amount: net,
    dueDate: isoDueDate,
    bank,
    category: 'Salário',
    status: suggestedStatus,
    periodLabel: 'Salário Integral',
    isQuinzenal: false,
    isSecondQuinzena: false,
    dueDay,
    notes: `Salário mensal integral (${activeContract.employer})`,
    shouldPromptConfirmation: inConfirmationWindow && !alreadyRegistered && net > 0,
  };
}
