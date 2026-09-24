import type {
  FinancialCheckpoint,
  SalaryContract,
  Movement,
  CreditCardItem,
  BankAccount,
  BankInstitution,
  ExpenseNature,
} from '../types';

export interface OnboardingStepAudit {
  id: 'checkpoint' | 'salary' | 'invoices' | 'natures' | 'ai_mappings';
  title: string;
  shortLabel: string;
  stepIndex: number; // 1 = Ponto de Partida/Salário, 2 = Faturas, 3 = Naturezas/Mapeamentos
  status: 'DONE' | 'PARTIAL' | 'PENDING';
  isComplete: boolean;
  score: number; // 0 to 20
  description: string;
  actionLabel: string;
  missingHint?: string;
  importance: 'CRITICO' | 'ALTO' | 'RECOMENDADO';
}

export interface OnboardingAuditResult {
  percent: number; // 0 to 100
  completedCount: number;
  totalCount: number;
  isAllComplete: boolean;
  steps: OnboardingStepAudit[];
  nextSuggestedStep: OnboardingStepAudit | null;
  missingStepsCount: number;
  summaryMessage: string;
}

export interface AuditInputData {
  activeCheckpoint: FinancialCheckpoint | null;
  salaryContracts: SalaryContract[];
  movements: Movement[];
  cards: CreditCardItem[];
  accounts: BankAccount[];
  banks: BankInstitution[];
  natures: ExpenseNature[];
}

/**
 * Avalia de forma determinística quanto do Get Started / Calibração Inicial
 * foi realizado pelo usuário e identifica os passos úteis pendentes.
 */
export function auditOnboardingProgress(data: AuditInputData): OnboardingAuditResult {
  const {
    activeCheckpoint,
    salaryContracts,
    movements,
    cards,
    accounts,
    banks,
    natures,
  } = data;

  const steps: OnboardingStepAudit[] = [];

  // --------------------------------------------------------------------------
  // 1. PONTO DE PARTIDA & CONTAS BANCÁRIAS (Passo 1 do Get Started)
  // --------------------------------------------------------------------------
  const hasCheckpoint = !!activeCheckpoint;
  const hasAccounts = (accounts && accounts.length > 0) || (banks && banks.length > 0);

  if (hasCheckpoint && hasAccounts) {
    const formattedDate = activeCheckpoint.startDate.split('-').reverse().join('/');
    const count = (accounts && accounts.length > 0) ? accounts.length : banks.length;
    steps.push({
      id: 'checkpoint',
      title: 'Ponto de Partida & Contas',
      shortLabel: 'Ponto de Partida',
      stepIndex: 1,
      status: 'DONE',
      isComplete: true,
      score: 20,
      description: `Ancorado em ${formattedDate} com ${count} conta(s)/instituição(ões) vinculadas.`,
      actionLabel: 'Revisar',
      importance: 'CRITICO',
    });
  } else if (hasCheckpoint) {
    steps.push({
      id: 'checkpoint',
      title: 'Ponto de Partida & Contas',
      shortLabel: 'Ponto de Partida',
      stepIndex: 1,
      status: 'PARTIAL',
      isComplete: false,
      score: 10,
      description: 'Data de início definida, mas adicione suas contas bancárias para apurar a liquidez.',
      missingHint: 'Vincule ao menos um banco ou conta para ancorar o saldo em caixa.',
      actionLabel: 'Completar Contas',
      importance: 'ALTO',
    });
  } else {
    steps.push({
      id: 'checkpoint',
      title: 'Ponto de Partida & Contas',
      shortLabel: 'Ponto de Partida',
      stepIndex: 1,
      status: 'PENDING',
      isComplete: false,
      score: 0,
      description: 'Defina a data e o saldo inicial em contas para ancorar o patrimônio e fluxo de caixa.',
      missingHint: 'O ponto de partida é a âncora matemática de todo o fluxo de 30 a 90 dias.',
      actionLabel: 'Definir Marco',
      importance: 'CRITICO',
    });
  }

  // --------------------------------------------------------------------------
  // 2. REMUNERAÇÃO & CONTRATO DE SALÁRIO (Passo 1 do Get Started)
  // Concluído assim que houver ao menos 1 remuneração cadastrada no perfil,
  // independentemente de isActive ou valor (conforme definição do usuário).
  // --------------------------------------------------------------------------
  const allSalaries = salaryContracts || [];
  const activeSalaries = allSalaries.filter((s) => s.isActive && s.currentNetAmount > 0);
  const hasSalaryRegistered = allSalaries.length > 0;

  if (hasSalaryRegistered) {
    // Prefere o contrato ativo com maior valor para exibição, senão usa o primeiro cadastrado
    const displaySalary = activeSalaries.length > 0
      ? activeSalaries[0]
      : allSalaries[0];
    const valFormatted = displaySalary.currentNetAmount
      ? displaySalary.currentNetAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'Valor a confirmar';
    steps.push({
      id: 'salary',
      title: 'Remuneração & Salário',
      shortLabel: 'Salário & Renda',
      stepIndex: 1,
      status: 'DONE',
      isComplete: true,
      score: 20,
      description: `${displaySalary.role || 'Remuneração'} (${valFormatted}${displaySalary.paymentDay ? `, Dia ${displaySalary.paymentDay}` : ''}) cadastrada no perfil.`,
      actionLabel: 'Ajustar',
      importance: 'CRITICO',
    });
  } else {
    steps.push({
      id: 'salary',
      title: 'Remuneração & Salário',
      shortLabel: 'Salário & Renda',
      stepIndex: 1,
      status: 'PENDING',
      isComplete: false,
      score: 0,
      description: 'Cadastre seu salário líquido e dia de pagamento para projetar recebimentos.',
      missingHint: 'Sem o contrato de salário, os valores a receber futuros no dashboard e na grade exibem R$ 0,00.',
      actionLabel: 'Cadastrar Salário',
      importance: 'CRITICO',
    });
  }

  // --------------------------------------------------------------------------
  // 3. CARTÕES DE CRÉDITO & FATURAS EM ABERTO (Passo 2 do Get Started)
  // Fontes de evidência (qualquer uma basta para confirmar o preenchimento):
  //   a) cards[] com cartões cadastrados no contexto
  //   b) movements[] filtrados por type === 'CARTAO'
  //   c) activeCheckpoint.cardDebts (preenchido no Get Started — sync anterior ao cache de cards)
  // Isso garante consistência entre dispositivos mesmo antes do cache local ser populado.
  // --------------------------------------------------------------------------
  const hasCards = cards && cards.length > 0;
  const cardMovements = (movements || []).filter((m) => m.type === 'CARTAO');
  const hasCardMovements = cardMovements.length > 0;
  const checkpointCardDebts = (activeCheckpoint?.cardDebts || []);
  const hasCheckpointCards = checkpointCardDebts.length > 0;

  // Contagens para a descrição (preferência: dados em tempo real; fallback: checkpoint)
  const displayCardCount = hasCards
    ? cards.length
    : hasCheckpointCards
      ? checkpointCardDebts.length
      : 0;
  const displayInvoiceCount = hasCardMovements
    ? cardMovements.length
    : hasCheckpointCards
      ? checkpointCardDebts.reduce((acc, d) => acc + (d.invoices?.length || 0), 0)
      : 0;

  // hasCardMovements sozinho basta: movimentos tipo CARTAO são a evidência real de faturas
  // provisionadas. Não depende de cards[] (volátil entre dispositivos antes do sync).
  const isInvoicesDone = hasCardMovements || hasCheckpointCards;
  const isInvoicesPartial = !isInvoicesDone && hasCards;

  if (isInvoicesDone) {
    const invoiceDesc = displayCardCount > 0
      ? `${displayCardCount} cartão(ões) e ${displayInvoiceCount} fatura(s) provisionada(s) no fluxo.`
      : cardMovements.length > 0
        ? `${cardMovements.length} fatura(s) de cartão provisionada(s) no fluxo.`
        : 'Faturas de cartão configuradas no Ponto de Partida.';
    steps.push({
      id: 'invoices',
      title: 'Faturas de Cartão em Aberto',
      shortLabel: 'Faturas de Cartão',
      stepIndex: 2,
      status: 'DONE',
      isComplete: true,
      score: 20,
      description: invoiceDesc,
      actionLabel: 'Revisar Faturas',
      importance: 'ALTO',
    });
  } else if (isInvoicesPartial) {
    steps.push({
      id: 'invoices',
      title: 'Faturas de Cartão em Aberto',
      shortLabel: 'Faturas de Cartão',
      stepIndex: 2,
      status: 'PARTIAL',
      isComplete: false,
      score: 10,
      description: hasCards
        ? 'Cartão cadastrado, mas informe a fatura atual e faturas futuras previstas.'
        : 'Faturas lançadas, mas cadastre o cartão para acompanhar fechamento e limites.',
      missingHint: 'Provisionar faturas futuras evita surpresas com parcelamentos nos próximos meses.',
      actionLabel: 'Completar Faturas',
      importance: 'ALTO',
    });
  } else {
    steps.push({
      id: 'invoices',
      title: 'Faturas de Cartão em Aberto',
      shortLabel: 'Faturas de Cartão',
      stepIndex: 2,
      status: 'PENDING',
      isComplete: false,
      score: 0,
      description: 'Informe seus cartões e os valores das faturas aberta e futuras.',
      missingHint: 'Faturas de cartão costumam ser a maior fonte de desequilíbrio no fluxo se não provisionadas.',
      actionLabel: 'Informar Faturas',
      importance: 'ALTO',
    });
  }

  // --------------------------------------------------------------------------
  // 4. NATUREZAS ORÇAMENTÁRIAS COM TETOS (Passo 3 do Get Started)
  // --------------------------------------------------------------------------
  const natureCount = (natures || []).length;
  if (natureCount >= 3) {
    steps.push({
      id: 'natures',
      title: 'Naturezas & Tetos de Gastos',
      shortLabel: 'Naturezas & Tetos',
      stepIndex: 3,
      status: 'DONE',
      isComplete: true,
      score: 20,
      description: `${natureCount} naturezas orçamentárias calibradas (Fixas, Essenciais e Variáveis).`,
      actionLabel: 'Ver Tetos',
      importance: 'ALTO',
    });
  } else if (natureCount > 0) {
    steps.push({
      id: 'natures',
      title: 'Naturezas & Tetos de Gastos',
      shortLabel: 'Naturezas & Tetos',
      stepIndex: 3,
      status: 'PARTIAL',
      isComplete: false,
      score: 10,
      description: `Apenas ${natureCount} natureza(s) cadastrada(s). Recomendamos cobrir ao menos Alimentação, Moradia e Transporte.`,
      missingHint: 'Com mais naturezas, a Forseti audita desvios em cada categoria antes do estouro.',
      actionLabel: 'Completar Tetos',
      importance: 'ALTO',
    });
  } else {
    steps.push({
      id: 'natures',
      title: 'Naturezas & Tetos de Gastos',
      shortLabel: 'Naturezas & Tetos',
      stepIndex: 3,
      status: 'PENDING',
      isComplete: false,
      score: 0,
      description: 'Configure seus tetos de gastos para que a IA possa auditar seus limites mensais.',
      missingHint: 'Defina os limites de gastos por natureza para ativar o Sentinela Orçamentário.',
      actionLabel: 'Configurar Naturezas',
      importance: 'ALTO',
    });
  }

  // --------------------------------------------------------------------------
  // 5. MAPEAMENTOS DE ROTINAS & PALAVRAS-CHAVE IA (Passo 3 do Get Started)
  // --------------------------------------------------------------------------
  const naturesWithMappings = (natures || []).filter(
    (n) => n.mappings && Array.isArray(n.mappings) && n.mappings.length > 0
  ).length;
  const naturesWithKeywords = (natures || []).filter(
    (n) => n.keywords && Array.isArray(n.keywords) && n.keywords.length > 0
  ).length;

  if (naturesWithMappings > 0 && naturesWithKeywords > 0) {
    steps.push({
      id: 'ai_mappings',
      title: 'Rotinas & Palavras-Chave de IA',
      shortLabel: 'Inteligência de IA',
      stepIndex: 3,
      status: 'DONE',
      isComplete: true,
      score: 20,
      description: `${naturesWithKeywords} natureza(s) com palavras-chave de IA e rotinas para classificação automática.`,
      actionLabel: 'Revisar IA',
      importance: 'RECOMENDADO',
    });
  } else if (naturesWithMappings > 0 || naturesWithKeywords > 0) {
    steps.push({
      id: 'ai_mappings',
      title: 'Rotinas & Palavras-Chave de IA',
      shortLabel: 'Inteligência de IA',
      stepIndex: 3,
      status: 'PARTIAL',
      isComplete: false,
      score: 10,
      description: naturesWithKeywords === 0
        ? 'Rotinas cadastradas, mas faltam palavras-chave para o Forseti OCR classificar cupons automaticamente.'
        : 'Palavras-chave cadastradas, mas crie rotinas de compras para estimar os tetos.',
      missingHint: 'Cadastrar palavras-chave como "supermercado", "uber" e "farmácia" permite que a IA classifique fotos de comprovantes sem esforço.',
      actionLabel: 'Completar IA',
      importance: 'RECOMENDADO',
    });
  } else {
    steps.push({
      id: 'ai_mappings',
      title: 'Rotinas & Palavras-Chave de IA',
      shortLabel: 'Inteligência de IA',
      stepIndex: 3,
      status: 'PENDING',
      isComplete: false,
      score: 0,
      description: 'Cadastre palavras-chave e rotinas para que a IA classifique gastos e comprovantes sozinha.',
      missingHint: 'A IA utiliza as palavras-chave para reconhecer estabelecimentos e lançar despesas na natureza certa automaticamente.',
      actionLabel: 'Calibrar IA',
      importance: 'RECOMENDADO',
    });
  }

  // --------------------------------------------------------------------------
  // CÁLCULO GERAL E PRÓXIMO PASSO SUGERIDO
  // --------------------------------------------------------------------------
  const totalScore = steps.reduce((acc, s) => acc + s.score, 0);
  const percent = Math.min(100, Math.max(0, totalScore));
  const completedCount = steps.filter((s) => s.isComplete).length;
  const missingSteps = steps.filter((s) => !s.isComplete);
  const isAllComplete = percent === 100;

  // Próximo passo sugerido: prioriza passos críticos pendentes
  const nextSuggestedStep =
    missingSteps.find((s) => s.importance === 'CRITICO' && s.status === 'PENDING') ||
    missingSteps.find((s) => s.status === 'PENDING') ||
    missingSteps.find((s) => s.status === 'PARTIAL') ||
    null;

  let summaryMessage = '';
  if (isAllComplete) {
    summaryMessage = 'Sistema 100% Calibrado! Todos os 5 pilares essenciais estão configurados para projeções e auditoria em tempo real.';
  } else if (percent >= 80) {
    summaryMessage = `Calibração avançada (${percent}%). Falta apenas ajustar ${missingSteps[0]?.shortLabel.toLowerCase()} para liberar 100% do potencial da IA.`;
  } else if (percent >= 50) {
    summaryMessage = `Calibração intermediária (${percent}%). Configure ${missingSteps[0]?.shortLabel.toLowerCase()} para maior precisão de fluxo.`;
  } else {
    summaryMessage = `Calibração inicial (${percent}%). Conclua os passos essenciais para que o Balder consiga projetar seus saldos e faturas.`;
  }

  return {
    percent,
    completedCount,
    totalCount: steps.length,
    isAllComplete,
    steps,
    nextSuggestedStep,
    missingStepsCount: missingSteps.length,
    summaryMessage,
  };
}
