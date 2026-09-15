import React, { createContext, useContext, useState, useMemo } from 'react';
import type {
  Movement,
  CriticalEvent,
  Goal,
  SimulationScenario,
  BankAccount,
  CopilotMessage,
  SimulationPresetId,
  SimulationVerdict,
  CustomScenarioInput,
  FutureScenarioResult,
  MonthlyProjectionPoint,
} from '../types';

interface FinancialContextType {
  // Estado
  accounts: BankAccount[];
  movements: Movement[];
  goals: Goal[];
  criticalEvents: CriticalEvent[];
  chatHistory: CopilotMessage[];

  // Métricas Calculadas
  totalNetWorth: number;
  availableBalance: number;
  monthlyFreeCashflow: number;
  emergencyReserveMonths: number;
  emergencyReserveAmount: number;

  forecast30d: {
    income: number;
    expenses: number;
    net: number;
    projectedBalance: number;
  };

  nextCriticalEvent: CriticalEvent | null;

  // Ações
  addMovement: (movement: Omit<Movement, 'id'>) => void;
  deleteMovement: (id: string) => void;
  toggleMovementStatus: (id: string) => void;
  addGoal: (goal: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  runSimulation: (preset: SimulationPresetId) => SimulationScenario;
  simulateCustomFutureScenario: (input: CustomScenarioInput) => FutureScenarioResult;
  applyScenarioToBudget: (result: FutureScenarioResult) => void;
  sendMessageToCopilot: (query: string) => void;
  exportToCSV: () => void;
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Contas Bancárias Reais
  const [accounts] = useState<BankAccount[]>([
    { id: 'acc_nubank', name: 'Nubank', type: 'CORRENTE', balance: 14250.00, color: '#8A05BE', icon: '🟣' },
    { id: 'acc_inter', name: 'Inter', type: 'CORRENTE', balance: 10550.00, color: '#FF7A00', icon: '🟠' },
    { id: 'acc_xp', name: 'XP Investimentos', type: 'INVESTIMENTO', balance: 732700.00, color: '#1E293B', icon: '⚪' },
    { id: 'acc_reserva', name: 'Tesouro Selic (Reserva)', type: 'POUPANCA', balance: 85000.00, color: '#10B981', icon: '🟢' },
  ]);

  // Movimentações Iniciais
  const [movements, setMovements] = useState<Movement[]>([
    {
      id: 'rec_1',
      title: 'Salário (1ª Quinzena CLT)',
      type: 'RECEBER',
      amount: 8500.00,
      dueDate: '2026-10-05',
      bank: 'Inter',
      status: 'PREVISTA',
      category: 'Salário',
      notes: 'Adiantamento mensal líquido',
    },
    {
      id: 'rec_2',
      title: 'Dividendos & Proventos B3',
      type: 'RECEBER',
      amount: 1450.00,
      dueDate: '2026-10-15',
      bank: 'XP',
      status: 'PREVISTA',
      category: 'Investimentos',
      notes: 'Rendimento de FIIs e Ações',
    },
    {
      id: 'rec_3',
      title: 'Consultoria Estratégica',
      type: 'RECEBER',
      amount: 5700.00,
      dueDate: '2026-10-22',
      bank: 'Nubank',
      status: 'PREVISTA',
      category: 'Serviços',
      notes: 'Honorário de projeto avulso',
    },
    {
      id: 'pay_1',
      title: 'Condomínio & Manutenção',
      type: 'PAGAR',
      amount: 1250.00,
      dueDate: '2026-10-08',
      bank: 'Nubank',
      status: 'PREVISTA',
      category: 'Moradia',
      notes: 'Taxa condominial residencial',
    },
    {
      id: 'pay_2',
      title: 'Escola / Educação Filhos',
      type: 'PAGAR',
      amount: 2850.00,
      dueDate: '2026-10-10',
      bank: 'Inter',
      status: 'PREVISTA',
      category: 'Educação',
      notes: 'Mensalidade escolar',
    },
    {
      id: 'pay_3',
      title: 'Plano de Saúde Familiar',
      type: 'PAGAR',
      amount: 1680.00,
      dueDate: '2026-10-12',
      bank: 'Nubank',
      status: 'PREVISTA',
      category: 'Saúde',
      notes: 'Cobertura médica ampla',
    },
    {
      id: 'pay_4',
      title: 'Energia Elétrica (Coelba)',
      type: 'PAGAR',
      amount: 420.00,
      dueDate: '2026-10-16',
      bank: 'Caixa',
      status: 'PREVISTA',
      category: 'Utilidades',
      notes: 'Consumo do mês',
    },
    {
      id: 'lia_1',
      title: 'Parcela Empréstimo Consignado',
      type: 'EMPRESTIMO',
      amount: 1458.51,
      dueDate: '2026-10-10',
      bank: 'Inter',
      status: 'PREVISTA',
      category: 'Empréstimos',
      notes: 'Parcela 4 de 18 (Taxa 3.03% a.m.)',
    },
    {
      id: 'cc_1',
      title: 'Fatura Nubank Mastercard Black',
      type: 'CARTAO',
      amount: 3850.00,
      dueDate: '2026-10-06',
      bank: 'Nubank',
      status: 'PREVISTA',
      category: 'Cartão de Crédito',
      notes: 'Gastos recorrentes e mercado',
    },
    {
      id: 'cc_2',
      title: 'Fatura XP Visa Infinite',
      type: 'CARTAO',
      amount: 1260.00,
      dueDate: '2026-10-15',
      bank: 'XP',
      status: 'PREVISTA',
      category: 'Cartão de Crédito',
      notes: 'Viagens e lazer',
    },
    {
      id: 'real_1',
      title: 'Supermercado Mensal',
      type: 'PAGAR',
      amount: 680.00,
      dueDate: '2026-09-12',
      bank: 'Nubank',
      status: 'REALIZADA',
      category: 'Alimentação',
      notes: 'Pago no débito',
    },
    {
      id: 'real_2',
      title: 'Adiantamento de Projeto',
      type: 'RECEBER',
      amount: 3200.00,
      dueDate: '2026-09-10',
      bank: 'Inter',
      status: 'REALIZADA',
      category: 'Serviços',
      notes: 'PIX compensado',
    },
  ]);

  // Metas Financeiras
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: 'goal_1',
      title: 'Reserva de Emergência (8 Meses)',
      category: 'Segurança',
      currentAmount: 85000,
      targetAmount: 100000,
      monthlyContribution: 2500,
      targetDate: 'Dezembro de 2026',
      icon: '🛡️',
      color: '#10B981',
    },
    {
      id: 'goal_2',
      title: 'Quitação Antecipada do Empréstimo',
      category: 'Desendividamento',
      currentAmount: 12000,
      targetAmount: 17367,
      monthlyContribution: 1800,
      targetDate: 'Março de 2027',
      icon: '⚡',
      color: '#38BDF8',
    },
    {
      id: 'goal_3',
      title: 'Aporte de Independência Financeira',
      category: 'Liberdade',
      currentAmount: 645500,
      targetAmount: 1200000,
      monthlyContribution: 4000,
      targetDate: 'Outubro de 2031',
      icon: '🏛️',
      color: '#A855F7',
    },
  ]);

  // Eventos Críticos Sentinela
  const criticalEvents = useMemo<CriticalEvent[]>(() => {
    return [
      {
        id: 'crit_1',
        title: 'Vencimento Fatura Cartão Nubank (R$ 3.850)',
        type: 'CONTA',
        amount: 3850,
        daysRemaining: 4,
        recommendedAction: 'Garantir saldo em conta corrente até o dia 05 para débito automático.',
        severity: 'CRITICAL',
        relatedEntity: 'Nubank Black',
      },
      {
        id: 'crit_2',
        title: 'Parcela Empréstimo Consignado (R$ 1.458)',
        type: 'PARCELA',
        amount: 1458.51,
        daysRemaining: 8,
        recommendedAction: 'Avaliar quitação com deságio de juros utilizando parte da liquidez.',
        severity: 'WARNING',
        relatedEntity: 'Inter Crédito',
      },
      {
        id: 'crit_3',
        title: 'Mensalidade Escolar (R$ 2.850)',
        type: 'CONTA',
        amount: 2850,
        daysRemaining: 8,
        recommendedAction: 'Despesa prioritária inegociável programada para o 10º dia do mês.',
        severity: 'WARNING',
        relatedEntity: 'Colégio',
      },
    ];
  }, []);

  // Próximo evento crítico mais próximo
  const nextCriticalEvent = useMemo(() => {
    return criticalEvents.length > 0 ? criticalEvents[0] : null;
  }, [criticalEvents]);

  // Métricas Calculadas
  const availableBalance = useMemo(() => {
    return accounts
      .filter((a) => a.type === 'CORRENTE')
      .reduce((acc, cur) => acc + cur.balance, 0);
  }, [accounts]);

  const totalNetWorth = useMemo(() => {
    return accounts.reduce((acc, cur) => acc + cur.balance, 0);
  }, [accounts]);

  const emergencyReserveAmount = useMemo(() => {
    const res = accounts.find((a) => a.id === 'acc_reserva');
    return res ? res.balance : 85000;
  }, [accounts]);

  // Projeção dos Próximos 30 Dias
  const forecast30d = useMemo(() => {
    const plannedIncome = movements
      .filter((m) => m.type === 'RECEBER' && m.status === 'PREVISTA')
      .reduce((acc, cur) => acc + cur.amount, 0);

    const plannedExpenses = movements
      .filter((m) => (m.type === 'PAGAR' || m.type === 'EMPRESTIMO' || m.type === 'CARTAO') && m.status === 'PREVISTA')
      .reduce((acc, cur) => acc + cur.amount, 0);

    const net = plannedIncome - plannedExpenses;
    const projectedBalance = availableBalance + net;

    return {
      income: plannedIncome,
      expenses: plannedExpenses,
      net,
      projectedBalance,
    };
  }, [movements, availableBalance]);

  const monthlyFreeCashflow = forecast30d.net;
  const emergencyReserveMonths = 6.8;

  // Histórico Conversacional do Copilot
  const [chatHistory, setChatHistory] = useState<CopilotMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content: 'Olá! Sou o Copilot do BALDER. Estou conectado aos seus fluxos financeiros em tempo real. Você pode registrar entradas e saídas em linguagem natural, questionar seus números ou simular decisões financeiras.',
      timestamp: 'Agora',
      suggestedFollowUps: [
        'Receberei R$ 8.500 dia 5.',
        'Paguei R$ 320 no mercado.',
        'Por que meu saldo projetado caiu?',
        'Posso comprar um carro?',
      ],
    },
  ]);

  // Adicionar Movimentação
  const addMovement = (item: Omit<Movement, 'id'>) => {
    const newMovement: Movement = {
      ...item,
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    };
    setMovements((prev) => [newMovement, ...prev]);
  };

  // Excluir Movimentação
  const deleteMovement = (id: string) => {
    setMovements((prev) => prev.filter((m) => m.id !== id));
  };

  // Alternar Status Prevista / Realizada
  const toggleMovementStatus = (id: string) => {
    setMovements((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          return {
            ...m,
            status: m.status === 'PREVISTA' ? 'REALIZADA' : 'PREVISTA',
          };
        }
        return m;
      })
    );
  };

  // Metas
  const addGoal = (item: Omit<Goal, 'id'>) => {
    setGoals((prev) => [...prev, { ...item, id: `goal_${Date.now()}` }]);
  };

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  };

  // Motor de Simulações
  const runSimulation = (preset: SimulationPresetId): SimulationScenario => {
    switch (preset) {
      case 'CARRO':
        return {
          id: 'sim_carro',
          title: 'Simulação: Compra de Carro Novo',
          description: 'Entrada de R$ 25.000 + 36 parcelas de R$ 1.850,00',
          initialOutflow: 25000,
          monthlyCost: 1850,
          runwayBeforeMonths: 6.8,
          runwayAfterMonths: 4.8,
          verdict: 'COM_RESTRICAO',
          explanation: 'A compra reduz sua reserva de emergência em 2 meses e absorve 43% do seu fluxo livre mensal (+R$ 4.250). É viável, mas reduzirá o ritmo do seu aporte de independência financeira.',
          actionRecommendations: [
            'Aumentar a entrada para R$ 35.000 visando reduzir a parcela mensal para R$ 1.300.',
            'Preservar integralmente os R$ 85.000 da reserva antes de assumir o financiamento.',
          ],
        };

      case 'QUITAR_DIVIDA':
        return {
          id: 'sim_quitar',
          title: 'Simulação: Quitação Antecipada de Empréstimo',
          description: 'Liquidação de R$ 17.367 a valor presente (economia imediata de juros)',
          initialOutflow: 17367,
          monthlyCost: -1458.51,
          runwayBeforeMonths: 6.8,
          runwayAfterMonths: 5.6,
          verdict: 'RECOMENDADO',
          explanation: 'Altamente benéfico! Você economiza R$ 4.886 em juros bancários futuros e libera instantaneamente +R$ 1.458,51 no seu fluxo de caixa mensal.',
          actionRecommendations: [
            'Utilizar parte do saldo disponível em conta corrente sem tocar no fundo de emergência.',
            'Redirecionar a parcela economizada (+R$ 1.458) diretamente para investimentos.',
          ],
        };

      case 'NOVO_EMPRESTIMO':
        return {
          id: 'sim_novo_emprestimo',
          title: 'Simulação: Tomada de Novo Empréstimo',
          description: 'Captação de R$ 30.000 em 24x de R$ 1.680,00 (CET estimado: 2,1% a.m.)',
          initialOutflow: -30000,
          monthlyCost: 1680,
          runwayBeforeMonths: 6.8,
          runwayAfterMonths: 5.1,
          verdict: 'COM_RESTRICAO',
          explanation: 'O crédito injeta +R$ 30.000 imediatos em caixa (elevando saldo para R$ 54.800). No entanto, a nova parcela de R$ 1.680 consome 39,5% do seu fluxo livre mensal (+R$ 4.250). O custo total de juros acumulados será de R$ 10.320 em 24 meses.',
          actionRecommendations: [
            'Verificar se a taxa contratual (2,1% a.m.) é menor que o retorno gerado pela destinação dos recursos.',
            'Pesquisar linhas com garantia de imóvel ou investimento para tentar reduzir os juros para menos de 1,4% a.m.',
            'Não utilizar o recurso emprestado para cobrir despesas fixas recorrentes.',
          ],
        };

      case 'FINANCIAMENTO':
        return {
          id: 'sim_financiamento',
          title: 'Simulação: Novo Financiamento Empresarial/Pessoal',
          description: 'Aporte de capital de R$ 50.000 com parcelas de R$ 2.400/mês',
          initialOutflow: 0,
          monthlyCost: 2400,
          runwayBeforeMonths: 6.8,
          runwayAfterMonths: 4.2,
          verdict: 'COM_RESTRICAO',
          explanation: 'A parcela de R$ 2.400 consome 56% do seu fluxo livre atual. Recomenda-se apenas se o retorno do capital investido superar a taxa de juros do contrato.',
          actionRecommendations: [
            'Garantir carência inicial mínima de 60 dias para estabilização de caixa.',
            'Comparar a CET (Custo Efetivo Total) entre 3 instituições bancárias.',
          ],
        };

      case 'IMOVEL':
        return {
          id: 'sim_imovel',
          title: 'Simulação: Aquisição de Imóvel Residencial',
          description: 'Entrada de R$ 120.000 + parcelas decrescentes de R$ 4.200 (SAC)',
          initialOutflow: 120000,
          monthlyCost: 4200,
          runwayBeforeMonths: 6.8,
          runwayAfterMonths: 3.1,
          verdict: 'NAO_RECOMENDADO',
          explanation: 'A entrada de R$ 120.000 compromete severamente a liquidez total e a parcela de R$ 4.200 zera seu fluxo livre (+R$ 4.250), deixando o orçamento sem margem de segurança.',
          actionRecommendations: [
            'Aguardar acúmulo de patrimônio líquido até R$ 1.000.000 para não desproteger a reserva.',
            'Simular consórcio imobiliário como alternativa com custo efetivo menor.',
          ],
        };
    }
  };

  // Motor Avançado de Cenários Futuros (Crédito, Direcionamento e Comportamento)
  const simulateCustomFutureScenario = (input: CustomScenarioInput): FutureScenarioResult => {
    const i = (input.monthlyInterestRate || 0) / 100;
    const n = Math.max(input.installmentsCount || 1, 1);
    const pv = Math.max(input.principalAmount || 0, 0);

    // Amortização Price
    const computedMonthlyPayment = i > 0 && n > 0
      ? (pv * i) / (1 - Math.pow(1 + i, -n))
      : pv / n;

    const totalRepayment = computedMonthlyPayment * n;
    const totalInterestPaid = Math.max(totalRepayment - pv, 0);

    // Renda estimada média do perfil
    const estimatedMonthlyIncome = 18000;
    const debtToIncomeRatio = Math.round((computedMonthlyPayment / estimatedMonthlyIncome) * 1000) / 10;

    // Efeitos comportamentais
    const baseVariableExpenses = 3800;
    const variableExpensesCut = baseVariableExpenses * ((input.behavior.cutVariableExpensesPercent || 0) / 100);
    const incomeBoost = input.behavior.expectedMonthlyIncomeBoost || 0;
    const pausedGoalsRelief = input.behavior.pauseGoalContributions ? 2500 : 0;
    const previousDebtRelief = input.destination === 'QUITAR_DIVIDAS_CARAS' ? 1458.51 : 0;

    const netMonthlyImpact = incomeBoost + variableExpensesCut + pausedGoalsRelief + previousDebtRelief - computedMonthlyPayment;

    // Runway
    const runwayBeforeMonths = emergencyReserveMonths;
    let runwayAfterMonths = runwayBeforeMonths;
    if (input.destination === 'INVESTIMENTO_RESERVA') {
      runwayAfterMonths = Math.min(Math.round((runwayBeforeMonths + (pv / 12500)) * 10) / 10, 18);
    } else if (input.destination === 'CAPITAL_GIRO_CAIXA') {
      runwayAfterMonths = Math.min(Math.round((runwayBeforeMonths + (pv / 16000)) * 10) / 10, 15);
    } else {
      const degradation = netMonthlyImpact < 0 ? Math.min(Math.abs(netMonthlyImpact) / 2500, 2.5) : 0;
      runwayAfterMonths = Math.max(Math.round((runwayBeforeMonths - degradation) * 10) / 10, 1.5);
    }

    // Projeção mês a mês nos próximos 12 meses
    const monthNames = ['Mês 1', 'Mês 2', 'Mês 3', 'Mês 4', 'Mês 5', 'Mês 6', 'Mês 7', 'Mês 8', 'Mês 9', 'Mês 10', 'Mês 11', 'Mês 12'];
    let runningBaseline = availableBalance;
    let runningSimulated = availableBalance;

    if (input.destination === 'CAPITAL_GIRO_CAIXA' || input.destination === 'INVESTIMENTO_RESERVA') {
      runningSimulated += pv;
    }

    const projection12Months: MonthlyProjectionPoint[] = [];

    for (let m = 1; m <= 12; m++) {
      runningBaseline += monthlyFreeCashflow;

      const isGracePeriod = m <= (input.gracePeriodMonths || 0);
      const effectivePayment = isGracePeriod ? (pv * i) : computedMonthlyPayment;

      const monthlyDelta = incomeBoost + variableExpensesCut + pausedGoalsRelief + previousDebtRelief - effectivePayment;

      let extraAmort = 0;
      if (input.behavior.extraAmortizationMonth === m && input.behavior.extraAmortizationAmount) {
        extraAmort = input.behavior.extraAmortizationAmount;
      }

      runningSimulated += (monthlyFreeCashflow + monthlyDelta - extraAmort);
      const isStressed = runningSimulated < 15000 || (monthlyFreeCashflow + monthlyDelta) < 0;

      projection12Months.push({
        monthIndex: m,
        monthLabel: monthNames[m - 1],
        baselineBalance: Math.round(runningBaseline),
        simulatedBalance: Math.round(runningSimulated),
        cashflowImpact: Math.round(monthlyDelta),
        isStressed,
      });
    }

    let verdict: SimulationVerdict = 'RECOMENDADO';
    let verdictReason = '';
    const recommendations: string[] = [];
    const minSimulated = Math.min(...projection12Months.map((p) => p.simulatedBalance));

    if (minSimulated < 10000 || debtToIncomeRatio > 32 || netMonthlyImpact < -2000) {
      verdict = 'NAO_RECOMENDADO';
      verdictReason = `A operação coloca sua liquidez em risco alto. O comprometimento de renda (${debtToIncomeRatio}%) ou a queda de caixa reduzem perigosamente sua margem de segurança.`;
      recommendations.push('Aumentar o prazo em parcelas para diluir o valor mensal.');
      recommendations.push('Intensificar o corte de despesas supérfluas para pelo menos 20% antes de contratar.');
      recommendations.push('Buscar taxa de juros com garantia inferior a 1,4% a.m.');
    } else if (debtToIncomeRatio > 18 || netMonthlyImpact < -500 || input.destination === 'AQUISICAO_BEM') {
      verdict = 'COM_RESTRICAO';
      verdictReason = `Cenário viável mediante disciplina. A parcela de R$ ${Math.round(computedMonthlyPayment).toLocaleString('pt-BR')} compromete ${debtToIncomeRatio}% da renda estimada, mas suas medidas comportamentais atenuam o impacto.`;
      recommendations.push(`Manter rigoroso o corte de ${input.behavior.cutVariableExpensesPercent}% nos gastos variáveis.`);
      if (input.behavior.expectedMonthlyIncomeBoost > 0) {
        recommendations.push(`Certificar-se de que a renda extra de R$ ${input.behavior.expectedMonthlyIncomeBoost.toLocaleString('pt-BR')} se concretize nos primeiros 60 dias.`);
      }
      recommendations.push('Aproveitar receitas sazonais (13º/bônus) para amortizar parcelas antecipadas.');
    } else {
      verdict = 'RECOMENDADO';
      verdictReason = `Excelente estruturação estratégica! O direcionamento do dinheiro ${input.destination === 'QUITAR_DIVIDAS_CARAS' ? 'elimina dívidas caras' : 'fortalece seu caixa'} e as contrapartidas comportamentais mantêm seu fluxo positivo (+R$ ${Math.round(netMonthlyImpact).toLocaleString('pt-BR')}/mês).`;
      recommendations.push('Seguir rigorosamente o cronograma de pagamentos para não incidir encargos moratórios.');
      recommendations.push('Manter os recursos aportados em ativos com liquidez imediata (100% CDI).');
      recommendations.push('Reavaliar o cenário trimestralmente no Balder.');
    }

    return {
      input,
      computedMonthlyPayment: Math.round(computedMonthlyPayment * 100) / 100,
      totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
      totalRepayment: Math.round(totalRepayment * 100) / 100,
      debtToIncomeRatio,
      netMonthlyImpact: Math.round(netMonthlyImpact * 100) / 100,
      runwayBeforeMonths,
      runwayAfterMonths,
      verdict,
      verdictReason,
      tacticalRecommendations: recommendations,
      projection12Months,
    };
  };

  const applyScenarioToBudget = (result: FutureScenarioResult) => {
    const today = new Date().toISOString().split('T')[0];

    // 1. Injeção do crédito se for para caixa ou reserva
    if (result.input.destination === 'CAPITAL_GIRO_CAIXA' || result.input.destination === 'INVESTIMENTO_RESERVA') {
      addMovement({
        title: `Captação: ${result.input.operationType.replace(/_/g, ' ')}`,
        type: 'RECEBER',
        amount: result.input.principalAmount,
        dueDate: today,
        bank: 'Nubank',
        status: 'REALIZADA',
        category: 'Empréstimos / Crédito',
        notes: `Cenário simulado no Balder: ${result.input.installmentsCount}x de R$ ${result.computedMonthlyPayment.toFixed(2)}`,
      });
    }

    // 2. Programação da 1ª Parcela Futura
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1 + (result.input.gracePeriodMonths || 0));
    const nextMonthStr = nextMonth.toISOString().split('T')[0];

    addMovement({
      title: `Parcela 1/${result.input.installmentsCount} - ${result.input.operationType.replace(/_/g, ' ')}`,
      type: 'EMPRESTIMO',
      amount: result.computedMonthlyPayment,
      dueDate: nextMonthStr,
      bank: 'Nubank',
      status: 'PREVISTA',
      category: 'Empréstimos & Financiamentos',
      notes: `Programado via Simulador de Cenários Futuros. Taxa: ${result.input.monthlyInterestRate}% a.m.`,
    });

    if (result.input.destination === 'QUITAR_DIVIDAS_CARAS') {
      addMovement({
        title: `Quitação Consolidada de Passivo Anterior`,
        type: 'PAGAR',
        amount: result.input.principalAmount,
        dueDate: today,
        bank: 'Nubank',
        status: 'REALIZADA',
        category: 'Quitação de Dívida',
        notes: `Liquidação viabilizada pela troca de dívida no Simulador.`,
      });
    }

    alert(`Cenário Efetivado no Balder!\n\nForam gerados os registros correspondentes no seu fluxo de caixa:\n• Injeção de R$ ${result.input.principalAmount.toLocaleString('pt-BR')}\n• Programação da parcela de R$ ${result.computedMonthlyPayment.toLocaleString('pt-BR')}/mês a partir de ${nextMonthStr}.`);
  };

  // Motor Conversacional Inteligente do Copilot
  const sendMessageToCopilot = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const userMessage: CopilotMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: 'Agora',
    };

    setChatHistory((prev) => [...prev, userMessage]);

    // Análise Cognitiva da Pergunta / Comando
    setTimeout(() => {
      let responseText = '';
      let actionBadge = '';
      let suggestedFollowUps: string[] = [];
      const lower = trimmed.toLowerCase();

      // 1. Cadastros em Linguagem Natural
      if (lower.includes('receberei') || lower.includes('vou receber') || lower.includes('ganhei')) {
        const matchAmount = trimmed.match(/(?:R\$\s*)?([\d.,]+)/i);
        const amountFound = matchAmount ? parseFloat(matchAmount[1].replace('.', '').replace(',', '.')) : 5000;
        
        addMovement({
          title: `Recebimento Programado: ${trimmed.slice(0, 30)}`,
          type: 'RECEBER',
          amount: isNaN(amountFound) ? 5000 : amountFound,
          dueDate: '2026-10-05',
          bank: 'Inter',
          status: 'PREVISTA',
          category: 'Receita Operacional',
          notes: 'Registrado automaticamente via Copilot em linguagem natural.',
        });

        responseText = `Entendido! Agendei uma nova receita de R$ ${amountFound.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no seu Contas a Receber para o dia 05. Seu saldo projetado para 30 dias foi recalculado para cima.`;
        actionBadge = 'RECEITA AGENDADA';
        suggestedFollowUps = ['Ver fluxo projetado atualizado', 'Registrar outra movimentação'];
      } else if (lower.includes('paguei') || lower.includes('gastei') || lower.includes('comprei')) {
        const matchAmount = trimmed.match(/(?:R\$\s*)?([\d.,]+)/i);
        const amountFound = matchAmount ? parseFloat(matchAmount[1].replace('.', '').replace(',', '.')) : 320;

        addMovement({
          title: `Despesa: ${trimmed.slice(0, 30)}`,
          type: 'PAGAR',
          amount: isNaN(amountFound) ? 320 : amountFound,
          dueDate: new Date().toISOString().split('T')[0],
          bank: 'Nubank',
          status: 'REALIZADA',
          category: 'Alimentação / Mercado',
          notes: 'Registrado via Copilot.',
        });

        responseText = `Registrei seu pagamento de R$ ${amountFound.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} como realizado na conta Nubank. O saldo disponível foi ajustado instantaneamente.`;
        actionBadge = 'PAGAMENTO CONCLUÍDO';
        suggestedFollowUps = ['Quanto sobrou para gastar no mês?', 'Ver minhas movimentações'];
      } else if (lower.includes('por que') && (lower.includes('caiu') || lower.includes('saldo') || lower.includes('diminuiu'))) {
        responseText = `Auditoria Concluída: Seu saldo projetado teve redução devido a 2 compromissos de alto impacto concentrados nos próximos 8 dias:\n\n1. Fatura Nubank Black: R$ 3.850,00 (Vencimento em 4 dias)\n2. Parcela de Empréstimo Consignado: R$ 1.458,51 (Vencimento em 8 dias)\n\nJuntos, esses dois eventos somam R$ 5.308,51. Nenhum erro contábil ou cobrança indevida foi detectada.`;
        actionBadge = 'AUDITORIA FINANCEIRA';
        suggestedFollowUps = ['Como posso otimizar essas despesas?', 'Simular quitação do empréstimo'];
      } else if (lower.includes('carro') || lower.includes('posso comprar')) {
        const sim = runSimulation('CARRO');
        responseText = `Análise de Viabilidade: ${sim.verdict === 'COM_RESTRICAO' ? '⚠️ Viável com Restrições' : 'Simulação Executada'}.\n\n${sim.explanation}\n\nRecomendações:\n• ${sim.actionRecommendations.join('\n• ')}`;
        actionBadge = 'DECISÃO FINANCEIRA';
        suggestedFollowUps = ['Simular quitar o empréstimo', 'Ver impacto nas minhas metas'];
      } else if (lower.includes('novo empréstimo') || lower.includes('novo emprestimo') || lower.includes('pegar empréstimo') || lower.includes('pegar emprestimo') || lower.includes('tomar emprestimo')) {
        const sim = runSimulation('NOVO_EMPRESTIMO');
        responseText = `Simulação de Novo Empréstimo: ${sim.verdict === 'COM_RESTRICAO' ? '⚠️ Viável com Restrições' : 'Simulação Concluída'}.\n\n${sim.explanation}\n\nRecomendações:\n• ${sim.actionRecommendations.join('\n• ')}`;
        actionBadge = 'SIMULAÇÃO DE CRÉDITO';
        suggestedFollowUps = ['Simular quitar o empréstimo', 'Ver impacto no meu runway'];
      } else {
        responseText = `Entendido perfeitamente. Seus dados financeiros indicam que você tem R$ ${availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em saldo disponível e um fluxo líquido mensal positivo de R$ ${monthlyFreeCashflow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Posso agendar uma movimentação, simular uma decisão ou auditar qualquer valor para você.`;
        actionBadge = 'ASSISTENTE OPERACIONAL';
        suggestedFollowUps = ['Receberei R$ 8.500 dia 5.', 'Simular novo empréstimo', 'Por que meu saldo projetado caiu?'];
      }

      const assistantMessage: CopilotMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: 'Agora',
        actionBadge,
        suggestedFollowUps,
      };

      setChatHistory((prev) => [...prev, assistantMessage]);
    }, 400);
  };

  // Exportar dados para CSV estruturado
  const exportToCSV = () => {
    const headers = ['ID', 'Titulo', 'Tipo', 'Valor', 'Vencimento', 'Banco', 'Status', 'Categoria', 'Notas'];
    const rows = movements.map((m) => [
      m.id,
      `"${m.title}"`,
      m.type,
      m.amount.toFixed(2),
      m.dueDate,
      m.bank,
      m.status,
      `"${m.category}"`,
      `"${m.notes || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BALDER_MOVIMENTACOES_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <FinancialContext.Provider
      value={{
        accounts,
        movements,
        goals,
        criticalEvents,
        chatHistory,
        totalNetWorth,
        availableBalance,
        monthlyFreeCashflow,
        emergencyReserveMonths,
        emergencyReserveAmount,
        forecast30d,
        nextCriticalEvent,
        addMovement,
        deleteMovement,
        toggleMovementStatus,
        addGoal,
        updateGoal,
        runSimulation,
        simulateCustomFutureScenario,
        applyScenarioToBudget,
        sendMessageToCopilot,
        exportToCSV,
      }}
    >
      {children}
    </FinancialContext.Provider>
  );
};

export const useFinancial = () => {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error('useFinancial deve ser utilizado dentro de um FinancialProvider');
  }
  return context;
};
