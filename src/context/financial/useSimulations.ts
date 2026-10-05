import {
  type CustomScenarioInput, type FutureScenarioResult, type MonthlyProjectionPoint,
  type SimulationPresetId, type SimulationScenario, type SimulationVerdict,
} from '../../types';
import type { useFinancialMetrics } from './useFinancialMetrics';
import type { useMovementsAndGoals } from './useMovementsAndGoals';

type Deps =
  Pick<ReturnType<typeof useFinancialMetrics>,
    'availableBalance' | 'emergencyReserveMonths' | 'monthlyFreeCashflow'
  > &
  Pick<ReturnType<typeof useMovementsAndGoals>,
    'addMovement'
  >;

/** Simulações de cenário e aplicação ao orçamento. */
export function useSimulations({
  addMovement, availableBalance, emergencyReserveMonths, monthlyFreeCashflow,
}: Deps) {
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
          title: 'Simulação: Financiamento de Bens',
          description: 'Financiamento de um bem de R$ 50.000 com parcelas de R$ 2.400/mês',
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
      category: result.input.operationType.startsWith('FINANCIAMENTO') ? 'Financiamentos' : 'Empréstimos',
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

  // Motor Conversacional Inteligente do Forseti (IA) com Retenção Efêmera / Temporária
  // Motor Conversacional Inteligente do Forseti (IA) com Retenção Efêmera / Temporária & Multi-Fotos

  return { runSimulation, simulateCustomFutureScenario, applyScenarioToBudget };
}
