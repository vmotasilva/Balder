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
    const day1 = activeContract.secondPaymentDay || 15; // Adiantamento (ex: dia 15)
    const day2 = activeContract.paymentDay || 1;        // Saldo com descontos (ex: dia 1 ou 5)

    // Determina se estamos mais próximos da 1ª ou 2ª quinzena
    const dist1 = Math.abs(todayDay - day1);
    const dist2 = Math.min(
      Math.abs(todayDay - day2),
      Math.abs(todayDay - (day2 + 30)),
      Math.abs((todayDay + 30) - day2)
    );

    const isFirst = dist1 <= dist2;
    const autoPct = activeContract.firstInstallmentPercent || 40;
    const firstAmt = activeContract.firstInstallmentAmount || Math.round(net * (autoPct / 100) * 100) / 100;
    const secondAmt = activeContract.secondInstallmentAmount || Math.round((net - firstAmt) * 100) / 100;

    const amount = isFirst ? firstAmt : secondAmt;
    const dueDay = isFirst ? day1 : day2;
    const periodLabel = isFirst ? '1ª quinzena (Adiantamento)' : '2ª quinzena (Saldo do Mês)';

    // Verificar se este período já foi registrado como realizado
    const alreadyRegistered = movements.some((m) => {
      if (m.type !== 'RECEBER' || m.status !== 'REALIZADA') return false;
      const isSalaryCat = m.category === 'Salário' || m.title.toLowerCase().includes('salário') || m.title.toLowerCase().includes(activeContract.employer.toLowerCase());
      if (!isSalaryCat) return false;

      // Se for quinzena 1 ou 2, conferir o período
      if (isFirst) {
        return m.dueDate.startsWith(monthKey) && (m.title.includes('1ª quinzena') || m.notes?.includes('1ª quinzena') || (parseInt(m.dueDate.slice(8, 10), 10) >= 10 && parseInt(m.dueDate.slice(8, 10), 10) <= 24));
      } else {
        return m.dueDate.startsWith(monthKey) && (m.title.includes('2ª quinzena') || m.notes?.includes('2ª quinzena') || parseInt(m.dueDate.slice(8, 10), 10) <= 9 || parseInt(m.dueDate.slice(8, 10), 10) >= 25);
      }
    });

    // Deve sugerir confirmação se hoje estiver na janela prevista (entre 2 dias antes até 7 dias depois do dia previsto) e ainda não lançado
    const dayDiff = Math.abs(todayDay - dueDay);
    const inConfirmationWindow = dayDiff <= 4 || (todayDay >= dueDay && todayDay <= dueDay + 7);
    const shouldPrompt = inConfirmationWindow && !alreadyRegistered && net > 0;

    return {
      hasContract: true,
      contract: activeContract,
      title: `${activeContract.employer} — ${activeContract.role} (${periodLabel})`,
      amount,
      dueDate: todayStr, // data de hoje como padrão para liquidação
      bank,
      category: 'Salário',
      status: 'REALIZADA',
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

  // UNICO (Integral)
  const dueDay = activeContract.paymentDay || 1;
  const alreadyRegistered = movements.some((m) => {
    return (
      m.type === 'RECEBER' &&
      m.status === 'REALIZADA' &&
      (m.category === 'Salário' || m.title.toLowerCase().includes(activeContract.employer.toLowerCase())) &&
      m.dueDate.startsWith(monthKey)
    );
  });

  const inConfirmationWindow = Math.abs(todayDay - dueDay) <= 4 || (todayDay >= dueDay && todayDay <= dueDay + 7);

  return {
    hasContract: true,
    contract: activeContract,
    title: `${activeContract.employer} — ${activeContract.role} (Salário Integral)`,
    amount: net,
    dueDate: todayStr,
    bank,
    category: 'Salário',
    status: 'REALIZADA',
    periodLabel: 'Salário Integral',
    isQuinzenal: false,
    isSecondQuinzena: false,
    dueDay,
    notes: `Salário mensal integral (${activeContract.employer})`,
    shouldPromptConfirmation: inConfirmationWindow && !alreadyRegistered && net > 0,
  };
}
