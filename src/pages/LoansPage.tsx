import React, { useState, useMemo, useEffect } from 'react';
import { DecimalInput } from '../components/DecimalInput';
import { useFinancial } from '../context/FinancialContext';
import {
  Landmark,
  Calculator,
  FileSpreadsheet,
  Download,
  PlusCircle,
  CheckCircle2,
  Clock,
  Sliders,
  Sparkles,
  RotateCcw,
  X,
  Check,
  Zap,
  TrendingDown,
  Archive,
  ArchiveRestore,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog, useConfirmDialog } from '../components/ConfirmDialog';
import { InstallmentPaymentModal } from '../components/InstallmentPaymentModal';
import type { Movement } from '../types';
import { calculateLoanSpreadsheet, solveMonthlyRateForInstallment } from '../utils/loanSpreadsheetMath';
import type { LoanSpreadsheetInput } from '../utils/loanSpreadsheetMath';
import { groupLoanMovements, calculatePresentValue } from '../utils/loanMath';
import { buildMonthlyProjectionGrid } from '../utils/projectionMath';
import { Modal } from '../components/Modal';
import { NumberInput } from '../components/NumberInput';
import { InfoButton } from '../components/InfoButton';

export type RowSimMode = 'NORMAL' | 'ANTECIPAR' | 'PAUSAR' | 'CUSTOM';

export interface RowSimConfig {
  mode: RowSimMode;
  customAmount?: number;
}

export const LoansPage: React.FC = () => {
  const {
    movements,
    natures,
    addMovement,
    prepayInstallments,
    updateMovement,
    activeCheckpoint,
    monthlyClosings,
    archivedLoanGroups,
    setLoanGroupArchived,
    deleteLoanContract,
  } = useFinancial();
  const { confirm: confirmAction, dialogProps: confirmDialogProps } = useConfirmDialog();
  const [showArchivedLoans, setShowArchivedLoans] = useState(false);
  // Parcela sendo paga: a data do pagamento define a competência em que ela aparece
  const [payingInstallment, setPayingInstallment] = useState<Movement | null>(null);

  const [activeTab, setActiveTab] = useState<'CONTRACTED' | 'SIMULATOR'>('CONTRACTED');
  const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState(false);

  // Parcelas já pagas no passado para empréstimos existentes
  const [alreadyPaidCount, setAlreadyPaidCount] = useState<number>(0);
  const [includeDisbursement, setIncludeDisbursement] = useState<boolean>(true);

  // Filtro de parcelas na tela de contratos ativos ('ALL' | 'OPEN' | 'PAID')
  const [contractInstallmentFilter, setContractInstallmentFilter] = useState<'ALL' | 'OPEN' | 'PAID'>('ALL');

  // Modo de exibição da tabela: Impacto no Caixa ou Tabela Price Oficial
  const [gridMode, setGridMode] = useState<'CASHFLOW_IMPACT' | 'OFFICIAL_PRICE'>('CASHFLOW_IMPACT');

  // Simulação livre linha a linha: mês da parcela (1..15) -> RowSimConfig
  const [rowSimulations, setRowSimulations] = useState<Record<number, RowSimConfig>>({});

  // Mapeamento de parcelas antecipadas: parcela k (1..15) -> mês m (1..15) onde foi paga (onde m <= k)
  // Exemplo: { 15: 3, 14: 3 } significa que as parcelas 15 e 14 serão antecipadas e pagas no Mês 3 (Dezembro/2026)!
  const [prepaidAllocations, setPrepaidAllocations] = useState<Record<number, number>>({});

  // Mês selecionado para abrir o modal de antecipação de parcelas futuras
  const [prepayModalMonth, setPrepayModalMonth] = useState<number | null>(null);

  // Fecha o pop-up com a tecla Escape e bloqueia o scroll da página de fundo
  useEffect(() => {
    if (prepayModalMonth === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPrepayModalMonth(null);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [prepayModalMonth]);

  // Parâmetros do Simulador (default idêntico aos valores do arquivo Simulador Emprestimo.xlsx)
  // Taxa e parcela vêm do banco e são informadas pelo usuário. A diferença entre a parcela cobrada e a
  // parcela pela taxa é o IOS; as antecipações usam sempre a taxa do banco.
  const [params, setParams] = useState<LoanSpreadsheetInput>({
    principalAmount: 42000,
    monthlyInterestRate: 0.03612, // 3.612% a.m.
    termMonths: 15,
    contractDate: '2026-10-03',
    firstDueDate: '2026-10-15',
    simulationDate: '2026-09-03',
    installmentValueOverride: 0,
  });
  const typedInstallment = params.installmentValueOverride || 0;
  // Taxa efetiva embutida na parcela cobrada (inclui o IOS), só para acompanhamento
  const effectiveRate = useMemo(
    () => (typedInstallment > 0 ? solveMonthlyRateForInstallment(params, typedInstallment) : null),
    [params, typedInstallment]
  );

  const [contractName, setContractName] = useState('Empréstimo Financiado');

  // Cálculo reativo do motor da planilha
  const { summary, rows } = useMemo(() => {
    return calculateLoanSpreadsheet(params);
  }, [params]);

  // Fluxo de caixa base gerado para os 15 meses (2026-09 até 2027-11)
  const initialBalance = activeCheckpoint ? activeCheckpoint.initialBalance : 0;
  const baseCashFlow = useMemo(() => {
    return buildMonthlyProjectionGrid(
      movements,
      natures,
      initialBalance,
      monthlyClosings
    );
  }, [movements, natures, initialBalance, monthlyClosings]);

  // Função utilitária para calcular o valor presente e economia ao antecipar parcela k no mês m
  const calculateAdvanceDetails = (k: number, m: number, pmt: number, rate: number) => {
    const deltaMonths = k - m;
    if (deltaMonths <= 0) {
      return { vp: pmt, savings: 0, deltaMonths: 0 };
    }
    // Descapitalização exponencial de juros compostos: VP = PMT / (1 + i)^deltaMonths
    const vp = pmt / Math.pow(1 + rate, deltaMonths);
    const savings = Math.max(0, pmt - vp);
    return {
      vp: Math.round(vp * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      deltaMonths,
    };
  };

  // Motor de simulação livre linha a linha integrado ao Saldo e Saldo Acumulado
  const simAnalysis = useMemo(() => {
    let totalSimulatedCost = 0;
    let totalInterestSaved = 0;
    let modifiedCount = 0;
    let runningAccumulated = 0;

    const simulatedRows = rows.map((row, idx) => {
      if (row.month === 0) {
        return {
          ...row,
          simMode: 'NORMAL' as RowSimMode,
          customAmount: undefined as number | undefined,
          effectivePayment: 0,
          savings: 0,
          monthNetSimulated: baseCashFlow[0]?.monthNet || 0,
          accumulatedSimulated: baseCashFlow[0]?.accumulatedBalance || 0,
          deltaMonthNet: 0,
          deltaAccumulated: 0,
          isDeficit: (baseCashFlow[0]?.monthNet || 0) < 0,
          isPrepaidPrior: false,
          prepaidInMonth: undefined as number | undefined,
          basePayment: 0,
          sumAdvancesVP: 0,
          advanceSavingsSum: 0,
          advancesInThisMonth: [] as {
            installmentNumber: number;
            vp: number;
            savings: number;
            deltaMonths: number;
          }[],
        };
      }

      const m = row.month;
      const simConfig = rowSimulations[m] || { mode: 'NORMAL' };

      // Verifica se a parcela deste mês já foi quitada antecipadamente num mês anterior
      const isPrepaidPrior = prepaidAllocations[m] !== undefined && prepaidAllocations[m] < m;
      const paidInMonth = prepaidAllocations[m];

      // Busca parcelas futuras que foram alocadas para antecipação NESTE mês m
      const advancesInThisMonth: {
        installmentNumber: number;
        vp: number;
        savings: number;
        deltaMonths: number;
      }[] = [];

      Object.entries(prepaidAllocations).forEach(([instKey, allocMonth]) => {
        const instNum = Number(instKey);
        if (allocMonth === m && instNum > m) {
          const adv = calculateAdvanceDetails(
            instNum,
            m,
            row.installmentValue,
            params.monthlyInterestRate
          );
          advancesInThisMonth.push({
            installmentNumber: instNum,
            ...adv,
          });
        }
      });

      // Cálculo do pagamento base do mês
      let basePayment = row.installmentValue;
      let savingsFromBase = 0;

      if (isPrepaidPrior) {
        // Parcela eliminada! Valor a pagar neste mês é zero
        basePayment = 0;
        savingsFromBase = row.installmentValue;
        modifiedCount++;
      } else if (simConfig.mode === 'ANTECIPAR') {
        // Antecipação da própria parcela do mês para hoje
        basePayment = row.payoffTodayValue > 0 ? row.payoffTodayValue : row.installmentValue;
        savingsFromBase = Math.max(0, row.installmentValue - basePayment);
        modifiedCount++;
      } else if (simConfig.mode === 'PAUSAR') {
        basePayment = 0;
        savingsFromBase = row.installmentValue;
        modifiedCount++;
      } else if (simConfig.mode === 'CUSTOM') {
        basePayment = simConfig.customAmount !== undefined ? simConfig.customAmount : row.installmentValue;
        savingsFromBase = row.installmentValue - basePayment;
        modifiedCount++;
      }

      // Soma dos pagamentos de parcelas futuras antecipadas neste mês
      const sumAdvancesVP = advancesInThisMonth.reduce((acc, it) => acc + it.vp, 0);
      const sumAdvancesSavings = advancesInThisMonth.reduce((acc, it) => acc + it.savings, 0);

      if (advancesInThisMonth.length > 0) {
        modifiedCount += advancesInThisMonth.length;
      }

      const effectivePayment = Math.round((basePayment + sumAdvancesVP) * 100) / 100;
      const totalSavingsThisMonth = Math.round((savingsFromBase + sumAdvancesSavings) * 100) / 100;

      totalSimulatedCost += effectivePayment;
      totalInterestSaved += sumAdvancesSavings + (simConfig.mode === 'ANTECIPAR' ? savingsFromBase : 0);

      // Mapear para a competência do fluxo de caixa correspondente
      const flowIdx = Math.min(idx - 1, baseCashFlow.length - 1);
      const baseFlow = baseCashFlow[flowIdx];

      // Saldo do mês sem empréstimo
      const baseLoanPaid = baseFlow?.loanPayment || 0;
      const baseMonthNet = baseFlow?.monthNet || 0;
      const cashflowWithoutLoan = baseMonthNet + baseLoanPaid;

      // Novo saldo líquido com o desembolso total simulado
      const monthNetSimulated = Math.round((cashflowWithoutLoan - effectivePayment) * 100) / 100;

      if (idx === 1) {
        runningAccumulated = monthNetSimulated;
      } else {
        runningAccumulated = Math.round((runningAccumulated + monthNetSimulated) * 100) / 100;
      }

      const deltaMonthNet = Math.round((monthNetSimulated - baseMonthNet) * 100) / 100;
      const baseAccumulated = baseFlow?.accumulatedBalance || 0;
      const deltaAccumulated = Math.round((runningAccumulated - baseAccumulated) * 100) / 100;

      return {
        ...row,
        simMode: simConfig.mode,
        customAmount: simConfig.customAmount,
        isPrepaidPrior,
        prepaidInMonth: paidInMonth,
        advancesInThisMonth,
        basePayment,
        sumAdvancesVP,
        effectivePayment,
        savings: totalSavingsThisMonth,
        advanceSavingsSum: sumAdvancesSavings,
        monthNetSimulated,
        accumulatedSimulated: runningAccumulated,
        deltaMonthNet,
        deltaAccumulated,
        isDeficit: monthNetSimulated < 0,
      };
    });

    const finalBaseAccumulated = baseCashFlow[baseCashFlow.length - 1]?.accumulatedBalance || 0;
    const finalSimulatedAccumulated = runningAccumulated;
    const totalAccumulatedGain = Math.round((finalSimulatedAccumulated - finalBaseAccumulated) * 100) / 100;

    return {
      simulatedRows,
      totalSimulatedCost,
      totalInterestSaved,
      modifiedCount,
      finalBaseAccumulated,
      finalSimulatedAccumulated,
      totalAccumulatedGain,
    };
  }, [rows, rowSimulations, prepaidAllocations, baseCashFlow, params.monthlyInterestRate]);

  // Handlers para simulação em lote e linha a linha
  const handleSetRowMode = (month: number, mode: RowSimMode, customVal?: number) => {
    setRowSimulations((prev) => ({
      ...prev,
      [month]: {
        mode,
        customAmount: customVal !== undefined ? customVal : prev[month]?.customAmount,
      },
    }));
  };

  // Alternar antecipação de uma parcela futura k no mês m
  const handleTogglePrepay = (k: number, m: number) => {
    setPrepaidAllocations((prev) => {
      const updated = { ...prev };
      if (updated[k] === m) {
        delete updated[k];
      } else {
        updated[k] = m;
      }
      return updated;
    });
  };

  // Reverter antecipação de uma parcela k
  const handleCancelPrepay = (k: number) => {
    setPrepaidAllocations((prev) => {
      const updated = { ...prev };
      delete updated[k];
      return updated;
    });
  };

  // Presets Inteligentes
  const handlePrepayBonusMonth = () => {
    // No Mês 3 (Dezembro/2026), antecipa as 3 últimas parcelas (13, 14 e 15) com desconto máximo de tempo!
    setPrepaidAllocations({
      15: 3,
      14: 3,
      13: 3,
    });
    setRowSimulations({});
  };

  const handlePrepayLastN = (count: number) => {
    // Antecipa as N últimas parcelas no Mês 1
    const newAllocations: Record<number, number> = {};
    const startMonth = Math.max(2, summary.termMonths - count + 1);
    for (let k = startMonth; k <= summary.termMonths; k++) {
      newAllocations[k] = 1;
    }
    setPrepaidAllocations(newAllocations);
    setRowSimulations({});
  };

  const handleResetSimulations = () => {
    setRowSimulations({});
    setPrepaidAllocations({});
  };

  // Contratos reais ativos cadastrados no Balder
  const contractedGroups = useMemo(() => {
    return groupLoanMovements(movements);
  }, [movements]);

  // Arquivados somem da lista principal (os lançamentos continuam no fluxo)
  const activeLoanGroups = useMemo(
    () => contractedGroups.filter((g) => !archivedLoanGroups.includes(g.groupId)),
    [contractedGroups, archivedLoanGroups]
  );
  const archivedLoanGroupsList = useMemo(
    () => contractedGroups.filter((g) => archivedLoanGroups.includes(g.groupId)),
    [contractedGroups, archivedLoanGroups]
  );
  const visibleLoanGroups = showArchivedLoans ? archivedLoanGroupsList : activeLoanGroups;

  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    contractedGroups[0]?.groupId || ''
  );

  const selectedGroup = useMemo(() => {
    return visibleLoanGroups.find((g) => g.groupId === selectedGroupId) || visibleLoanGroups[0];
  }, [visibleLoanGroups, selectedGroupId]);

  const fmtLoanBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleArchiveLoan = (groupId: string, title: string, openCount: number, openBalance: number) => {
    if (openCount === 0) {
      setLoanGroupArchived(groupId, true);
      return;
    }
    confirmAction({
      title: 'Arquivar contrato',
      message: `"${title}" ainda tem ${openCount} parcela(s) em aberto (${fmtLoanBRL(openBalance)}). Arquivar só tira o contrato da lista: as parcelas continuam no fluxo de caixa e nas projeções. Para retirá-las, exclua o contrato.`,
      confirmLabel: 'Arquivar',
      variant: 'warning',
      onConfirm: () => setLoanGroupArchived(groupId, true),
    });
  };

  const handleDeleteLoan = (groupId: string, title: string, movementIds: string[], paidCount: number) => {
    confirmAction({
      title: 'Excluir contrato',
      message: `Excluir "${title}" apaga as ${movementIds.length} parcela(s)${paidCount > 0 ? ` (incluindo ${paidCount} já paga(s))` : ''} e a captação registrada no contrato, se houver. Isso muda o saldo e as projeções e não pode ser desfeito.`,
      confirmLabel: 'Excluir contrato',
      variant: 'danger',
      onConfirm: () => deleteLoanContract(groupId, movementIds),
    });
  };

  // Parcelas do contrato selecionado a serem exibidas conforme o filtro ativo ('ALL' | 'OPEN' | 'PAID')
  const displayedInstallments = useMemo(() => {
    if (!selectedGroup) return [];
    let list = selectedGroup.allInstallments;
    if (contractInstallmentFilter === 'OPEN') {
      list = selectedGroup.openInstallments;
    } else if (contractInstallmentFilter === 'PAID') {
      list = selectedGroup.paidInstallments;
    }
    return [...list].sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
  }, [selectedGroup, contractInstallmentFilter]);

  // Contratar / Efetivar simulação no fluxo de caixa do Balder
  const handleContractInBalder = () => {
    if (typedInstallment <= 0 || params.monthlyInterestRate <= 0) {
      alert('Informe a taxa de juros e o valor da parcela cobrados pelo banco.');
      return;
    }
    if (summary.installmentValue <= 0 || summary.termMonths <= 0) return;

    const newGroupId = `loan_sim_${Date.now()}`;
    const totalCount = summary.termMonths;
    const paidCount = alreadyPaidCount;
    const openCount = totalCount - paidCount;

    const msgConfirm =
      alreadyPaidCount > 0
        ? `Deseja cadastrar este empréstimo no Balder com ${alreadyPaidCount} parcela(s) já quitada(s)?\n\n• Valor Financiado: R$ ${summary.principalAmount.toLocaleString('pt-BR')}\n• Parcelas Totais: ${totalCount} de R$ ${summary.installmentValue.toLocaleString('pt-BR')}\n• Parcelas já pagas: ${paidCount} (serão registradas como quitadas)\n• Parcelas em aberto: ${openCount} (agendadas no fluxo futuro)\n• Registrar captação inicial: ${includeDisbursement ? 'Sim' : 'Não'}`
        : `Deseja contratar e efetivar este empréstimo no Balder?\n\n• Valor Financiado: R$ ${summary.principalAmount.toLocaleString('pt-BR')}\n• ${summary.termMonths} parcelas de R$ ${summary.installmentValue.toLocaleString('pt-BR')}\n\nSerá agendada a entrada do recurso e a programação de todas as parcelas mensais no seu fluxo de caixa.`;

    const confirmed = window.confirm(msgConfirm);
    if (!confirmed) return;

    // 1. Injeção de Liquidez (Entrada do recurso) - opcional se já for empréstimo antigo
    if (includeDisbursement) {
      addMovement({
        title: `Captação: ${contractName}`,
        type: 'RECEBER',
        amount: summary.principalAmount,
        dueDate: params.contractDate,
        bank: 'Inter',
        status: 'REALIZADA',
        category: 'Empréstimos',
        notes: `Captação financiada de R$ ${summary.principalAmount.toFixed(2)} a ${(params.monthlyInterestRate * 100).toFixed(3)}% a.m.`,
        installmentGroupId: newGroupId,
      });
    }

    // 2. Programação de todas as parcelas (pagas no passado e abertas no futuro)
    rows.slice(1).forEach((row) => {
      // Converte DD/MM/YYYY para YYYY-MM-DD
      const [d, m, y] = row.dueDate.split('/');
      const isoDue = `${y}-${m}-${d}`;
      const isPaidPast = row.month <= alreadyPaidCount;

      addMovement({
        title: `${contractName} (${row.month}/${summary.termMonths})`,
        type: 'EMPRESTIMO',
        amount: row.installmentValue,
        dueDate: isoDue,
        bank: 'Inter',
        status: isPaidPast ? 'REALIZADA' : 'PREVISTA',
        category: 'Empréstimos',
        notes: `Tabela Price. Taxa ${(params.monthlyInterestRate * 100).toFixed(5)}% a.m. Amortização: R$ ${row.amortizationValue.toFixed(2)} | Juros: R$ ${row.interestValue.toFixed(2)} | IOS: R$ ${summary.iosPerInstallment.toFixed(2)}${isPaidPast ? ' (Quitada anteriormente)' : ''}`,
        interestRatePercent: params.monthlyInterestRate * 100,
        installmentNumber: row.month,
        installmentsTotal: summary.termMonths,
        installmentGroupId: newGroupId,
      });
    });

    alert(
      alreadyPaidCount > 0
        ? `✓ Empréstimo registrado com sucesso!\n\n${paidCount} parcela(s) quitada(s) e ${openCount} parcela(s) em aberto foram salvas.`
        : `✓ Empréstimo contratado com sucesso!\n\nAs ${summary.termMonths} parcelas de R$ ${summary.installmentValue.toLocaleString('pt-BR')} foram agendadas no seu cronograma contábil.`
    );
    setIsSimulatorModalOpen(false);
    setActiveTab('CONTRACTED');
    setSelectedGroupId(newGroupId);
  };

  // Exportar Grid para CSV idêntico ao Excel
  const handleExportCSV = () => {
    const headers = [
      'Mês',
      'Vencimento',
      'Valor da Parcela (R$)',
      'Juros da Parcela (R$)',
      'Amortização (R$)',
      'Saldo Devedor (R$)',
      'Valor p/ Quitar Hoje (R$)',
      'Economia ao Antecipar (R$)',
      'DATA SIMULAÇÃO',
      'N (MESES)',
      'VALOR COM DESÁGIO',
    ];

    const csvRows = rows.map((r) => [
      r.month,
      r.dueDate,
      r.installmentValue > 0 ? r.installmentValue.toFixed(2) : '',
      r.interestValue > 0 ? r.interestValue.toFixed(2) : '',
      r.amortizationValue > 0 ? r.amortizationValue.toFixed(2) : '',
      r.balanceRemaining.toFixed(2),
      r.payoffTodayValue > 0 ? r.payoffTodayValue.toFixed(2) : '',
      r.savingsAtAdvance > 0 ? r.savingsAtAdvance.toFixed(2) : '',
      r.simDate || '',
      r.monthsDiff !== undefined && r.monthsDiff > 0 ? r.monthsDiff : '',
      r.discountedPayoff !== undefined && r.discountedPayoff > 0 ? r.discountedPayoff.toFixed(2) : '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(';'), ...csvRows.map((row) => row.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Simulador_Emprestimo_Tabela_Price.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSimulatorContent = (isInsideModal: boolean = false) => (
    <div
      className="loan-simulator-view animate-fade-in"
      style={
        isInsideModal
          ? {
              maxHeight: 'calc(85vh - 80px)',
              overflowY: 'auto',
              paddingRight: '6px',
            }
          : undefined
      }
    >
      {/* Grid de 2 Painéis Superiores (Condições + Resumo) */}
      <div className="loan-sim-top-grid">
        {/* Painel 1: Preencha as Condições */}
        <div className="glass-card loan-params-card">
              <div className="card-section-title">
                <span className="step-num">1</span>
                <h3>Condições do Empréstimo</h3>
              </div>

              <div className="params-inputs-grid">
                <div className="form-group">
                  <label>Identificação / Título</label>
                  <input
                    type="text"
                    className="form-input"
                    value={contractName}
                    onChange={(e) => setContractName(e.target.value)}
                    placeholder="Ex: Empréstimo Pessoal, Consignado"
                  />
                </div>

                <div className="form-group">
                  <label>Valor Financiado (R$)</label>
                  <DecimalInput
                    className="form-input"
                    value={params.principalAmount}
                    onValueChange={(v) => setParams({ ...params, principalAmount: v })}
                  />
                </div>

                <div className="form-group">
                  <label>Taxa de Juros do banco (% a.m.) *</label>
                  <DecimalInput
                    money={false}
                    maxFractionDigits={5}
                    className="form-input"
                    placeholder="0,00000"
                    value={Math.round(params.monthlyInterestRate * 100 * 1e5) / 1e5}
                    emptyWhenZero
                    onValueChange={(v) => setParams({ ...params, monthlyInterestRate: v / 100 })}
                  />
                </div>

                <div className="form-group">
                  <label>Valor da Parcela cobrada (R$) *</label>
                  <DecimalInput
                    className="form-input"
                    placeholder="0,00"
                    value={typedInstallment}
                    emptyWhenZero
                    onValueChange={(v) => setParams({ ...params, installmentValueOverride: v })}
                  />
                  {typedInstallment <= 0 && (
                    <small className="loan-calc-error">Informe a parcela que o banco cobra.</small>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    IOS por parcela (R$) <span className="loan-calc-tag">calculado</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    className="form-input loan-calculated-field"
                    value={
                      typedInstallment > 0
                        ? summary.iosPerInstallment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '—'
                    }
                    title="Parcela cobrada − parcela pela taxa"
                  />
                </div>

                <div className="form-group">
                  <label>
                    IOS total (R$) <span className="loan-calc-tag">calculado</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    className="form-input loan-calculated-field"
                    value={
                      typedInstallment > 0
                        ? summary.iosTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '—'
                    }
                    title={`IOS nas ${params.termMonths} parcelas`}
                  />
                </div>

                <p className="loan-ios-note col-span-2">
                  Parcela pela taxa do banco:{' '}
                  <strong>{summary.calculatedInstallmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                  {effectiveRate?.ok && (
                    <>
                      {' '}· taxa efetiva com IOS:{' '}
                      <strong>
                        {(effectiveRate.monthlyInterestRate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 5 })}% a.m.
                      </strong>
                    </>
                  )}
                  {' '}— os descontos por antecipação usam a taxa do banco.
                </p>

                <div className="form-group">
                  <label>Prazo (Meses)</label>
                  <NumberInput
                    min={1}
                    max={120}
                    className="form-input"
                    value={params.termMonths}
                    onValueChange={(termMonths) => setParams({ ...params, termMonths })}
                  />
                </div>

                <div className="form-group">
                  <label>Data da Contratação</label>
                  <input
                    type="date"
                    className="form-input"
                    value={params.contractDate}
                    onChange={(e) => setParams({ ...params, contractDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>1º Vencimento</label>
                  <input
                    type="date"
                    className="form-input"
                    value={params.firstDueDate}
                    onChange={(e) => setParams({ ...params, firstDueDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Data para Simulação de Antecipação</label>
                  <input
                    type="date"
                    className="form-input"
                    value={params.simulationDate || params.contractDate}
                    onChange={(e) => setParams({ ...params, simulationDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Seção: Empréstimo Já em Andamento / Parcelas Anteriores */}
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '1rem',
                  background: 'rgba(14, 165, 233, 0.05)',
                  border: '1px solid rgba(14, 165, 233, 0.2)',
                  borderRadius: '12px',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-cyan flex items-center gap-1.5 uppercase tracking-wider">
                    <Clock size={14} /> Empréstimo já em andamento?
                    <InfoButton title="Empréstimo já em andamento">
                      <p>
                        Se você contratou este empréstimo no passado, informe quantas parcelas já foram pagas. O Balder registra
                        esse histórico e deixa em aberto só as parcelas que faltam.
                      </p>
                    </InfoButton>
                  </span>
                  {alreadyPaidCount > 0 && (
                    <span className="badge badge-emerald text-xs">
                      {alreadyPaidCount} de {params.termMonths} quitadas
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.78rem' }}>Parcelas Já Quitadas no Passado</label>
                    <NumberInput
                      min={0}
                      max={Math.max(0, params.termMonths - 1)}
                      className="form-input"
                      value={alreadyPaidCount}
                      onValueChange={(val) => {
                        setAlreadyPaidCount(val);
                        if (val > 0) {
                          setIncludeDisbursement(false);
                        }
                      }}
                      placeholder="0"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Atalhos rápidos</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {[0, 1, 3, 6, 12]
                        .filter((n) => n < params.termMonths)
                        .map((num) => (
                          <button
                            key={num}
                            type="button"
                            className={`btn btn-xs ${alreadyPaidCount === num ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => {
                              setAlreadyPaidCount(num);
                              if (num > 0) setIncludeDisbursement(false);
                            }}
                          >
                            {num === 0 ? 'Nenhuma (Novo)' : `${num} pagas`}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <input
                    type="checkbox"
                    id="chk-disbursement"
                    checked={includeDisbursement}
                    onChange={(e) => setIncludeDisbursement(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: '#0ea5e9' }}
                  />
                  <label htmlFor="chk-disbursement" className="text-xs text-secondary cursor-pointer">
                    Lançar entrada do valor captado ({params.principalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) na data de contratação
                  </label>
                </div>
              </div>
            </div>

            {/* Painel 2: Resumo do Financiamento */}
            <div className="glass-card loan-summary-card">
              <div className="card-section-title">
                <span className="step-num">2</span>
                <h3>Resumo do Financiamento</h3>
              </div>

              <div className="summary-metrics-list">
                <div className="summary-metric-row highlight">
                  <span className="metric-label">
                    {typedInstallment > 0 ? 'Parcela cobrada (R$):' : 'Parcela pela taxa (R$):'}
                  </span>
                  <strong className="metric-value text-cyan text-lg">
                    {summary.installmentValue.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </strong>
                </div>

                <div className="summary-metric-row">
                  <span className="metric-label">Custo Total (R$):</span>
                  <span className="metric-value font-semibold text-white">
                    {summary.totalCost.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>

                <div className="summary-metric-row">
                  <span className="metric-label">Total de Juros (R$):</span>
                  <span className="metric-value text-rose font-medium">
                    {summary.totalInterest.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>

                {typedInstallment > 0 && (
                  <div className="summary-metric-row">
                    <span className="metric-label">
                      IOS ({params.termMonths}× {summary.iosPerInstallment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}):
                    </span>
                    <span className="metric-value text-amber font-semibold">
                      {summary.iosTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                )}

                <div className="summary-metric-row">
                  <span className="metric-label">Valor p/ Quitar Hoje:</span>
                  <span className="metric-value text-emerald font-semibold">
                    {summary.totalPayoffToday.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>

                <div className="summary-metric-row">
                  <span className="metric-label">Economia Potencial ao Antecipar:</span>
                  <span className="metric-value text-amber font-semibold">
                    {summary.totalSavingsPotential.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
              </div>

              {alreadyPaidCount > 0 && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.65rem 0.75rem',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '8px',
                  }}
                >
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-muted">Já quitadas no passado:</span>
                    <strong className="text-emerald">
                      {alreadyPaidCount}x ({(alreadyPaidCount * summary.installmentValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted">A pagar em aberto:</span>
                    <strong className="text-cyan font-bold">
                      {params.termMonths - alreadyPaidCount}x ({((params.termMonths - alreadyPaidCount) * summary.installmentValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                    </strong>
                  </div>
                </div>
              )}

              {/* Nota Oficial da Planilha */}
              <div className="info-inline mt-3">
                <span>Como o cálculo é feito</span>
                <InfoButton title="Regra de cálculo">
                  <p>
                    O 1º período usa juros proporcionais aos dias corridos (mês-base de 30 dias). As demais parcelas seguem a
                    Tabela Price mensal.
                  </p>
                  <p>
                    "Valor p/ quitar hoje" é trazido à data da contratação com o desconto integral dos juros, conforme o Art. 52
                    do CDC.
                  </p>
                </InfoButton>
              </div>

              {/* Botões de Ação */}
              <div className="loan-sim-actions mt-4 flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm flex-1"
                  onClick={handleContractInBalder}
                >
                  <PlusCircle size={16} />
                  <span>
                    {alreadyPaidCount > 0
                      ? `Registrar (${params.termMonths - alreadyPaidCount} em aberto)`
                      : 'Contratar no Balder'}
                  </span>
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleExportCSV}
                  title="Exportar no formato da planilha Excel"
                >
                  <Download size={16} />
                  <span>Exportar Planilha</span>
                </button>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SIMULADOR LIVRE LINHA A LINHA & IMPACTO NO SALDO              */}
          {/* ============================================================== */}
          <div className="glass-card loan-spreadsheet-grid-card mt-6">
            <div className="flex justify-between items-center mb-3 flex-wrap gap-3">
              <div>
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  <Sliders size={18} className="text-cyan" />
                  <span>Simulador Livre Linha a Linha & Impacto no Caixa</span>
                  <InfoButton title="Simulador linha a linha">
                    <p>Simule a antecipação ou o ajuste de cada parcela e veja na hora o impacto no saldo e no saldo acumulado.</p>
                  </InfoButton>
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <div className="grid-filter-pills">
                  <button
                    type="button"
                    className={`pill-btn ${gridMode === 'CASHFLOW_IMPACT' ? 'active' : ''}`}
                    onClick={() => setGridMode('CASHFLOW_IMPACT')}
                  >
                    📊 Impacto no Saldo (Livre)
                  </button>
                  <button
                    type="button"
                    className={`pill-btn ${gridMode === 'OFFICIAL_PRICE' ? 'active' : ''}`}
                    onClick={() => setGridMode('OFFICIAL_PRICE')}
                  >
                    📄 Tabela Price Oficial
                  </button>
                </div>
              </div>
            </div>

            {/* Painel Superior de KPIs Dinâmicos da Simulação Livre */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-muted block">Saldo Acumulado Projetado</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span
                    className={`text-base font-mono font-bold ${
                      simAnalysis.finalSimulatedAccumulated >= 0 ? 'text-emerald' : 'text-rose'
                    }`}
                  >
                    {simAnalysis.finalSimulatedAccumulated.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                  {simAnalysis.totalAccumulatedGain !== 0 && (
                    <span className="text-[11px] font-semibold text-emerald">
                      (+ {simAnalysis.totalAccumulatedGain.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Cenário Base: {simAnalysis.finalBaseAccumulated.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-muted block">Economia Total em Juros</span>
                <span className="text-base font-mono font-bold text-amber block mt-0.5">
                  {simAnalysis.totalInterestSaved.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Descontos por antecipação a valor presente
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-muted block">Novo Desembolso c/ Empréstimo</span>
                <span className="text-base font-mono font-bold text-white block mt-0.5">
                  {simAnalysis.totalSimulatedCost.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Contratado: {summary.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-muted block">Parcelas Modificadas</span>
                <span className="text-base font-mono font-bold text-cyan block mt-0.5">
                  {simAnalysis.modifiedCount} de {summary.termMonths}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Linhas com antecipação ou ajuste livre
                </span>
              </div>
            </div>

            {/* Presets Rápidos de Simulação em 1 Clique */}
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/30 flex-wrap">
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold">
                <Sparkles size={14} className="text-amber" /> Estratégias Rápidas:
              </span>
              <button
                type="button"
                className="btn btn-primary btn-xs text-xs font-semibold"
                onClick={handlePrepayBonusMonth}
                title="Aproveita o 13º salário de Dezembro/2026 (Mês 3) para abater as 3 últimas parcelas (13, 14 e 15) com desconto máximo de tempo"
              >
                🌟 13º Salário: Antecipar 3 Últimas no Mês 3 (Dez/2026)
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs text-xs"
                onClick={() => handlePrepayLastN(1)}
                title="Simula antecipar a última parcela (Mês 15) hoje no Mês 1 com desconto máximo de juros futuros"
              >
                ⚡ Antecipar Parcela 15 no Mês 1
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs text-xs"
                onClick={() => handlePrepayLastN(5)}
                title="Simula antecipar as 5 últimas parcelas no Mês 1 reduzindo os juros mais longos"
              >
                🎯 Antecipar 5 Últimas Parcelas
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs text-xs"
                onClick={() => {
                  handleSetRowMode(1, 'PAUSAR');
                  handleSetRowMode(2, 'PAUSAR');
                }}
                title="Simula carência nos 2 primeiros meses"
              >
                ⏸️ Carência 2 Meses (Pausar)
              </button>
              {simAnalysis.modifiedCount > 0 && (
                <button
                  type="button"
                  className="btn btn-outline btn-xs text-xs text-rose border-rose/40 hover:bg-rose/10 ml-auto"
                  onClick={handleResetSimulations}
                >
                  <RotateCcw size={12} /> Resetar Simulação
                </button>
              )}
            </div>

            <div className="spreadsheet-table-wrapper">
              <table className="spreadsheet-table">
                <thead>
                  {gridMode === 'CASHFLOW_IMPACT' ? (
                    <tr>
                      <th className="th-center">Mês</th>
                      <th>Vencimento</th>
                      <th className="th-right">Parcela Base</th>
                      <th className="th-center" style={{ minWidth: '220px' }}>
                        Simulação Livre (Ação Linha a Linha)
                      </th>
                      <th className="th-right th-highlight">Valor a Pagar Simulado</th>
                      <th className="th-right">Saldo do Mês (Simulado)</th>
                      <th className="th-right th-highlight-amber">Saldo Acumulado (Simulado)</th>
                      <th className="th-right">Alívio / Impacto</th>
                      <th className="th-right">Economia de Juros</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="th-center">Mês</th>
                      <th>Vencimento</th>
                      <th className="th-right">Valor Parcela (R$)</th>
                      <th className="th-right">Juros (R$)</th>
                      <th className="th-right">Amortização (R$)</th>
                      <th className="th-right">Saldo Devedor (R$)</th>
                      <th className="th-right th-highlight">Valor p/ Quitar Hoje</th>
                      <th className="th-right th-highlight-amber">Economia Antecipar</th>
                      <th>Data Simulação</th>
                      <th className="th-center">N (Meses)</th>
                      <th className="th-right">Valor Deságio</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {gridMode === 'CASHFLOW_IMPACT'
                    ? simAnalysis.simulatedRows.map((row) => (
                        <tr
                          key={row.month}
                          className={`${row.month === 0 ? 'row-month-zero' : ''} ${
                            row.simMode !== 'NORMAL' ? 'row-simulated-active' : ''
                          }`}
                        >
                          <td className="th-center font-mono font-bold">
                            {row.month === 0 ? '0 (Inicial)' : row.month}
                          </td>
                          <td className="font-mono text-muted">{row.dueDate}</td>
                          <td className="th-right font-mono text-muted">
                            {row.installmentValue > 0
                              ? row.installmentValue.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })
                              : '-'}
                          </td>

                          {/* Controles de Simulação Livre Linha a Linha */}
                          <td className="th-center">
                            {row.month === 0 ? (
                              <span className="text-xs text-slate-500 font-mono">Início da Operação</span>
                            ) : row.isPrepaidPrior ? (
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <span className="badge badge-emerald text-[11px] font-semibold flex items-center gap-1 py-0.5 px-2">
                                  <CheckCircle2 size={12} /> Quitada no Mês {row.prepaidInMonth}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs text-[10px] text-rose border-rose/30 hover:bg-rose/10 py-0.5 px-1.5"
                                  onClick={() => handleCancelPrepay(row.month)}
                                  title="Reverter quitação antecipada desta parcela"
                                >
                                  ✕ Reverter
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                <button
                                  type="button"
                                  className={`btn-row-sim ${row.simMode === 'NORMAL' && (!row.advancesInThisMonth || row.advancesInThisMonth.length === 0) ? 'active-normal' : ''}`}
                                  onClick={() => handleSetRowMode(row.month, 'NORMAL')}
                                  title="Pagar parcela contratada normal"
                                >
                                  Normal
                                </button>
                                <button
                                  type="button"
                                  className={`btn-row-sim ${row.simMode === 'PAUSAR' ? 'active-pausar' : ''}`}
                                  onClick={() => handleSetRowMode(row.month, 'PAUSAR')}
                                  title="Carência (R$ 0,00 neste mês)"
                                >
                                  ⏸️ Pausar
                                </button>
                                <button
                                  type="button"
                                  className={`btn-row-sim ${row.simMode === 'CUSTOM' ? 'active-custom' : ''}`}
                                  onClick={() =>
                                    handleSetRowMode(
                                      row.month,
                                      'CUSTOM',
                                      row.customAmount !== undefined ? row.customAmount : row.installmentValue
                                    )
                                  }
                                  title="Digitar valor livre"
                                >
                                  ✏️ Livre
                                </button>
                                {row.month < summary.termMonths && (
                                  <button
                                    type="button"
                                    className={`btn-row-sim ${
                                      row.advancesInThisMonth && row.advancesInThisMonth.length > 0
                                        ? 'active-antecipar font-bold'
                                        : 'border-emerald/40 text-emerald hover:bg-emerald/10'
                                    }`}
                                    onClick={() => setPrepayModalMonth(row.month)}
                                    title={`Simular antecipação de parcelas futuras no Mês ${row.month}`}
                                  >
                                    {row.advancesInThisMonth && row.advancesInThisMonth.length > 0
                                      ? `⚡ +${row.advancesInThisMonth.length} Antecipadas`
                                      : `⚡ Antecipar Futuras`}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Valor a Pagar Efetivo Simulado */}
                          <td className="th-right font-mono font-bold text-white bg-cyan-950/20">
                            {row.month === 0 ? (
                              '-'
                            ) : row.isPrepaidPrior ? (
                              <div>
                                <span className="text-[11px] text-slate-500 line-through block">
                                  {row.installmentValue.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </span>
                                <span className="text-emerald-400 font-bold text-xs">R$ 0,00 (QUITADA)</span>
                              </div>
                            ) : row.advancesInThisMonth && row.advancesInThisMonth.length > 0 ? (
                              <div>
                                <span className="text-cyan-400 font-bold">
                                  {row.effectivePayment.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </span>
                                <span className="text-[10px] text-emerald-400 block font-normal">
                                  +{row.advancesInThisMonth.length} parc. antecipadas (Economia R$ {row.advanceSavingsSum?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                                </span>
                              </div>
                            ) : row.simMode === 'CUSTOM' ? (
                              <DecimalInput
                                className="row-custom-input font-mono text-right"
                                value={row.customAmount !== undefined ? row.customAmount : row.installmentValue}
                                onValueChange={(v) => handleSetRowMode(row.month, 'CUSTOM', v)}
                              />
                            ) : (
                              <span
                                className={
                                  row.simMode === 'PAUSAR'
                                    ? 'text-cyan-400'
                                    : 'text-white'
                                }
                              >
                                {row.effectivePayment.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </span>
                            )}
                          </td>

                          {/* Saldo do Mês (Simulado) */}
                          <td
                            className={`th-right font-mono font-bold ${
                              row.isDeficit ? 'text-deficit' : 'text-surplus'
                            }`}
                          >
                            {row.month === 0 ? (
                              '-'
                            ) : row.isDeficit ? (
                              <span className="val-deficit">
                                -{Math.abs(row.monthNetSimulated).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            ) : (
                              <span className="val-surplus">
                                +{row.monthNetSimulated.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            )}
                          </td>

                          {/* Saldo Acumulado (Simulado) */}
                          <td
                            className={`th-right font-mono font-bold ${
                              row.accumulatedSimulated < 0 ? 'text-deficit' : 'text-surplus'
                            }`}
                          >
                            {row.month === 0 ? (
                              '-'
                            ) : row.accumulatedSimulated < 0 ? (
                              <span className="val-deficit">
                                -{Math.abs(row.accumulatedSimulated).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            ) : (
                              <span className="val-surplus-gold font-bold">
                                {row.accumulatedSimulated.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            )}
                          </td>

                          {/* Alívio / Impacto vs. Base */}
                          <td className="th-right font-mono text-xs">
                            {row.month === 0 ? (
                              '-'
                            ) : row.isPrepaidPrior ? (
                              <span className="text-emerald font-semibold block">
                                + {row.installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                <span className="text-[9px] text-emerald-400/80 block">Alívio Total</span>
                              </span>
                            ) : row.deltaMonthNet > 0 ? (
                              <span className="text-emerald font-semibold">
                                + {row.deltaMonthNet.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            ) : row.deltaMonthNet < 0 ? (
                              <span className="text-rose font-semibold">
                                - {Math.abs(row.deltaMonthNet).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            ) : (
                              <span className="text-muted">R$ 0,00</span>
                            )}
                          </td>

                          {/* Economia de Juros */}
                          <td className="th-right font-mono text-amber font-semibold">
                            {row.savings > 0 ? (
                              <span className="text-amber">
                                {row.isPrepaidPrior ? (
                                  <span className="text-slate-400 text-xs">-</span>
                                ) : (
                                  `- ${row.savings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                                )}
                              </span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    : rows.map((row) => (
                        <tr key={row.month} className={row.month === 0 ? 'row-month-zero' : ''}>
                          <td className="th-center font-mono font-bold">
                            {row.month === 0 ? '0 (Inicial)' : row.month}
                          </td>
                          <td className="font-mono text-muted">{row.dueDate}</td>
                          <td className="th-right font-mono font-semibold text-white">
                            {row.installmentValue > 0
                              ? row.installmentValue.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })
                              : '-'}
                          </td>
                          <td className="th-right font-mono text-rose">
                            {row.interestValue > 0
                              ? row.interestValue.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })
                              : '-'}
                          </td>
                          <td className="th-right font-mono text-emerald">
                            {row.amortizationValue > 0
                              ? row.amortizationValue.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })
                              : '-'}
                          </td>
                          <td className="th-right font-mono text-cyan font-bold">
                            {row.balanceRemaining.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="th-right font-mono text-emerald bg-emerald-glow">
                            {row.payoffTodayValue > 0
                              ? row.payoffTodayValue.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })
                              : '-'}
                          </td>
                          <td className="th-right font-mono text-amber bg-amber-glow font-semibold">
                            {row.savingsAtAdvance > 0
                              ? `-${row.savingsAtAdvance.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}`
                              : '-'}
                          </td>
                          <td className="font-mono text-muted text-xs">{row.simDate || '-'}</td>
                          <td className="th-center font-mono text-muted">
                            {row.monthsDiff !== undefined && row.monthsDiff > 0 ? row.monthsDiff : '-'}
                          </td>
                          <td className="th-right font-mono text-white">
                            {row.discountedPayoff !== undefined && row.discountedPayoff > 0
                              ? row.discountedPayoff.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })
                              : '-'}
                          </td>
                        </tr>
                      ))}
                </tbody>
                <tfoot>
                  <tr className="spreadsheet-tfoot">
                    <th colSpan={2}>TOTAIS CONSOLIDADOS</th>
                    <th className="th-right font-mono text-white">
                      {summary.totalCost.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </th>
                    {gridMode === 'CASHFLOW_IMPACT' ? (
                      <>
                        <th></th>
                        <th className="th-right font-mono text-cyan font-bold">
                          {simAnalysis.totalSimulatedCost.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </th>
                        <th></th>
                        <th className="th-right font-mono text-amber font-bold">
                          {simAnalysis.finalSimulatedAccumulated.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </th>
                        <th className="th-right font-mono text-emerald font-bold">
                          {simAnalysis.totalAccumulatedGain !== 0 ? (
                            `+ ${simAnalysis.totalAccumulatedGain.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}`
                          ) : (
                            '-'
                          )}
                        </th>
                        <th className="th-right font-mono text-amber font-bold">
                          {simAnalysis.totalInterestSaved.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="th-right font-mono text-rose">
                          {summary.totalInterest.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </th>
                        <th className="th-right font-mono text-emerald">
                          {summary.principalAmount.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </th>
                        <th className="th-right font-mono text-muted">R$ 0,00</th>
                        <th className="th-right font-mono text-emerald">
                          {summary.totalPayoffToday.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </th>
                        <th className="th-right font-mono text-amber">
                          {summary.totalSavingsPotential.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </th>
                        <th colSpan={3}></th>
                      </>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
  );

  return (
    <div className="page-container loans-page animate-fade-in">
      {/* Header Principal */}
      <div className="page-header flex justify-between items-start flex-wrap gap-4">
        <div>
          <div className="kicker-badge">
            <Landmark size={14} className="text-cyan" />
            <span>ENGENHARIA FINANCEIRA & CRÉDITO</span>
          </div>
          <h1 className="page-title label-with-info">
            Sessão de Empréstimos & Financiamentos
            <InfoButton title="Sessão de Empréstimos & Financiamentos">
              <p>Simulações determinísticas e auditoria de contratos com a Tabela Price oficial, pró-rata e deságio a valor presente.</p>
            </InfoButton>
          </h1>
        </div>

        {/* Alternância de Abas: Contratos vs Simulador */}
        <div className="loans-nav-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'CONTRACTED' ? 'active' : ''}`}
            onClick={() => setActiveTab('CONTRACTED')}
          >
            <FileSpreadsheet size={16} />
            <span>Contratos Ativos ({activeLoanGroups.length})</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'SIMULATOR' ? 'active' : ''}`}
            onClick={() => setActiveTab('SIMULATOR')}
          >
            <Calculator size={16} />
            <span>Simulador Price & Antecipação</span>
          </button>
        </div>
      </div>

      {activeTab === 'SIMULATOR' ? (
        renderSimulatorContent(false)
      ) : (
        /* ================================================================ */
        /* ABA 2: EMPRÉSTIMOS CONTRATADOS NO BALDER                         */
        /* ================================================================ */
        <div className="loan-contracted-view animate-fade-in">
          {contractedGroups.length === 0 ? (
            <div className="empty-state-card glass-card text-center p-8">
              <Landmark size={48} className="text-muted mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">Nenhum Empréstimo Contratado Ativo</h3>
              <p className="text-sm text-secondary mb-4">
                Utilize o simulador para calcular condições da Tabela Price oficial e contratar diretamente no seu fluxo de caixa.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsSimulatorModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <PlusCircle size={16} />
                <span>Simular & Contratar Novo Empréstimo</span>
              </button>
            </div>
          ) : (
            <div>
              {/* Barra de Ações de Contratos */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Seus Contratos de Financiamento
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Acompanhe parcelas em aberto, saldo devedor e execute amortizações antecipadas
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(archivedLoanGroupsList.length > 0 || showArchivedLoans) && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setShowArchivedLoans((v) => !v)}
                    >
                      {showArchivedLoans ? <FileSpreadsheet size={14} /> : <Archive size={14} />}
                      <span>{showArchivedLoans ? `Ver ativos (${activeLoanGroups.length})` : `Arquivados (${archivedLoanGroupsList.length})`}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsSimulatorModalOpen(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <PlusCircle size={16} />
                    <span>+ Novo Empréstimo</span>
                  </button>
                </div>
              </div>

              {visibleLoanGroups.length === 0 && (
                <div className="glass-card text-center p-8 mb-4">
                  <p className="text-sm text-secondary">
                    {showArchivedLoans
                      ? 'Nenhum contrato arquivado.'
                      : `Nenhum contrato ativo. ${archivedLoanGroupsList.length} contrato(s) arquivado(s).`}
                  </p>
                </div>
              )}

              {/* Seletor de Contratos Contratados */}
              <div className="contract-selector-cards-grid mb-4">
                {visibleLoanGroups.map((g) => {
                  const isSelected = g.groupId === selectedGroupId;
                  const openCount = g.openInstallments.length;
                  const paidCount = g.paidInstallments.length;
                  const totalCount = g.totalInstallmentsCount || g.allInstallments.length;
                  const progressPct =
                    totalCount > 0
                      ? Math.round((paidCount / totalCount) * 100)
                      : 0;

                  return (
                    <div
                      key={g.groupId}
                      className={`contract-card glass-card cursor-pointer ${
                        isSelected ? 'active' : ''
                      } ${showArchivedLoans ? 'contract-card--archived' : ''}`}
                      onClick={() => setSelectedGroupId(g.groupId)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs text-cyan font-semibold">{g.bank}</span>
                          <h4 className="font-bold text-white text-md">{g.title}</h4>
                        </div>
                        <span className={`badge ${paidCount === totalCount && totalCount > 0 ? 'badge-emerald' : 'badge-cyan'} text-xs`}>
                          {showArchivedLoans ? 'Arquivado · ' : ''}
                          {paidCount}/{totalCount} Pagas
                        </span>
                      </div>

                      <div className="flex justify-between text-xs text-muted mb-2">
                        <span>Saldo Devedor ({openCount} em aberto):</span>
                        <strong className="text-white">
                          {g.nominalBalance.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </strong>
                      </div>

                      <div className="progress-bar-wrap">
                        <div className="progress-bar-fill" style={{ width: `${progressPct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grid do Contrato Selecionado */}
              {selectedGroup && (
                <div className="glass-card loan-spreadsheet-grid-card">
                  <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                    <div>
                      <h3 className="text-md font-bold text-white label-with-info">
                        Evolução das Parcelas: {selectedGroup.title}
                        <InfoButton title="Evolução das parcelas">
                          <p>
                            Mostra o que já foi pago, o que está em aberto e quanto custaria antecipar cada parcela hoje (valor
                            presente, com o desconto dos juros).
                          </p>
                        </InfoButton>
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="contract-actions">
                        {archivedLoanGroups.includes(selectedGroup.groupId) ? (
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => setLoanGroupArchived(selectedGroup.groupId, false)}
                            title="Voltar o contrato para a lista de ativos"
                          >
                            <ArchiveRestore size={13} />
                            <span>Restaurar</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() =>
                              handleArchiveLoan(
                                selectedGroup.groupId,
                                selectedGroup.title,
                                selectedGroup.openInstallments.length,
                                selectedGroup.nominalBalance
                              )
                            }
                            title="Tirar o contrato da lista (os lançamentos continuam)"
                          >
                            <Archive size={13} />
                            <span>Arquivar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline btn-xs contract-delete-btn"
                          onClick={() =>
                            handleDeleteLoan(
                              selectedGroup.groupId,
                              selectedGroup.title,
                              selectedGroup.allInstallments.map((m) => m.id),
                              selectedGroup.paidInstallments.length
                            )
                          }
                          title="Excluir o contrato e todos os lançamentos dele"
                        >
                          <Trash2 size={13} />
                          <span>Excluir</span>
                        </button>
                      </div>

                      <div className="grid-filter-pills">
                        <button
                          type="button"
                          className={`pill-btn ${contractInstallmentFilter === 'ALL' ? 'active' : ''}`}
                          onClick={() => setContractInstallmentFilter('ALL')}
                        >
                          Todas ({selectedGroup.allInstallments.length})
                        </button>
                        <button
                          type="button"
                          className={`pill-btn ${contractInstallmentFilter === 'OPEN' ? 'active' : ''}`}
                          onClick={() => setContractInstallmentFilter('OPEN')}
                        >
                          Em Aberto ({selectedGroup.openInstallments.length})
                        </button>
                        <button
                          type="button"
                          className={`pill-btn ${contractInstallmentFilter === 'PAID' ? 'active' : ''}`}
                          onClick={() => setContractInstallmentFilter('PAID')}
                        >
                          Pagas ({selectedGroup.paidInstallments.length})
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-muted block">Quitação Restante Hoje</span>
                        <strong className="text-emerald text-sm">
                          {selectedGroup.presentValueToday.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    const todayIso = new Date().toISOString().split('T')[0];
                    // Situação, cálculo de antecipação e ações de cada parcela: a mesma coisa na tabela e nos cards
                    const partsOf = (inst: Movement) => {
                      const isPaid = inst.status === 'REALIZADA';
                      const pvCalc = calculatePresentValue(inst.amount, inst.dueDate, todayIso, selectedGroup.interestRatePercent);
                      const label = `${inst.installmentNumber || 1}/${inst.installmentsTotal || selectedGroup.totalInstallmentsCount}`;
                      const paidInfo =
                        isPaid && inst.paymentDate
                          ? `em ${inst.paymentDate.split('-').reverse().join('/')}${
                              inst.originalAmount !== undefined && Math.abs(inst.originalAmount - inst.amount) > 0.005 ? ` · ${brl(inst.amount)}` : ''
                            }`
                          : '';
                      const status = isPaid ? (
                        <span className="installment-paid-status">
                          <span className="badge badge-emerald flex items-center gap-1 justify-center">
                            <CheckCircle2 size={12} />
                            <span>Paga</span>
                          </span>
                          {paidInfo && <small>{paidInfo}</small>}
                        </span>
                      ) : (
                        <span className="badge badge-cyan flex items-center gap-1 justify-center">
                          <Clock size={12} />
                          <span>Em Aberto</span>
                        </span>
                      );
                      const actions = isPaid ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs text-muted hover:text-white"
                          title="Marcar parcela novamente como em aberto"
                          onClick={() => {
                            if (window.confirm(`Deseja reabrir a parcela ${inst.installmentNumber || ''} e marcá-la como em aberto?`)) {
                              // Volta ao valor previsto e ao mês do vencimento
                              updateMovement(inst.id, {
                                status: 'PREVISTA',
                                amount: inst.originalAmount ?? inst.amount,
                                paymentDate: '',
                              });
                            }
                          }}
                        >
                          <RotateCcw size={12} />
                          <span>Reabrir</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs text-emerald border-emerald-500/30 hover:bg-emerald-500/10"
                            title="Informar a data e o valor do pagamento"
                            onClick={() => setPayingInstallment(inst)}
                          >
                            <Check size={12} />
                            <span>Marcar Paga</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => {
                              const confirmPay = window.confirm(
                                `Deseja liquidar esta parcela antecipada por R$ ${pvCalc.discountedAmount.toLocaleString(
                                  'pt-BR'
                                )} (Economia de R$ ${pvCalc.discountAmount.toLocaleString('pt-BR')})?`
                              );
                              if (confirmPay) {
                                prepayInstallments([inst.id], { [inst.id]: pvCalc.discountedAmount }, todayIso);
                              }
                            }}
                          >
                            Antecipar
                          </button>
                        </>
                      );
                      return { isPaid, pvCalc, label, status, actions };
                    };

                    const emptyMessage = `Nenhuma parcela encontrada para o filtro selecionado (${
                      contractInstallmentFilter === 'PAID' ? 'Pagas' : contractInstallmentFilter === 'OPEN' ? 'Em Aberto' : 'Todas'
                    }).`;

                    return (
                      <>
                        {/* Computador: tabela */}
                        <div className="spreadsheet-table-wrapper loan-installments-table">
                          <table className="spreadsheet-table">
                            <thead>
                              <tr>
                                <th>Parcela</th>
                                <th>Vencimento</th>
                                <th className="th-right">Valor Nominal</th>
                                <th className="th-right">Se Pago Hoje</th>
                                <th className="th-right">Economia ao Antecipar</th>
                                <th className="th-center">Status</th>
                                <th className="th-center">Ação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {displayedInstallments.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="text-center py-6 text-muted" style={{ padding: '2rem 1rem' }}>
                                    {emptyMessage}
                                  </td>
                                </tr>
                              ) : (
                                displayedInstallments.map((inst) => {
                                  const { isPaid, pvCalc, label, status, actions } = partsOf(inst);
                                  return (
                                    <tr key={inst.id} className={isPaid ? 'row-paid' : ''}>
                                      <td className="font-mono font-bold">{label}</td>
                                      <td className="font-mono text-muted">{inst.dueDate}</td>
                                      <td className="th-right font-mono font-semibold text-white">{brl(inst.amount)}</td>
                                      <td className="th-right font-mono text-emerald">{isPaid ? '-' : brl(pvCalc.discountedAmount)}</td>
                                      <td className="th-right font-mono text-amber">
                                        {isPaid ? '-' : `-${brl(pvCalc.discountAmount)} (${pvCalc.discountPercent.toFixed(1)}%)`}
                                      </td>
                                      <td className="th-center">{status}</td>
                                      <td className="th-center">
                                        <div className="flex items-center justify-center gap-1.5 flex-wrap">{actions}</div>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Celular: um card por parcela */}
                        <div className="loan-installment-cards">
                          {displayedInstallments.length === 0 ? (
                            <p className="text-center text-muted text-xs py-6">{emptyMessage}</p>
                          ) : (
                            displayedInstallments.map((inst) => {
                              const { isPaid, pvCalc, label, status, actions } = partsOf(inst);
                              return (
                                <div key={inst.id} className={`loan-installment-card ${isPaid ? 'is-paid' : ''}`}>
                                  <div className="loan-installment-head">
                                    <div>
                                      <strong>Parcela {label}</strong>
                                      <span>Vence {inst.dueDate.split('-').reverse().join('/')}</span>
                                    </div>
                                    {status}
                                  </div>
                                  <div className="loan-installment-values">
                                    <div>
                                      <span>{isPaid ? 'Valor' : 'Valor nominal'}</span>
                                      <strong>{brl(inst.amount)}</strong>
                                    </div>
                                    {!isPaid && (
                                      <>
                                        <div>
                                          <span>Se pago hoje</span>
                                          <strong className="text-emerald">{brl(pvCalc.discountedAmount)}</strong>
                                        </div>
                                        <div>
                                          <span>Economia</span>
                                          <strong className="text-amber">
                                            {brl(pvCalc.discountAmount)} <small>({pvCalc.discountPercent.toFixed(1)}%)</small>
                                          </strong>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <div className="loan-installment-actions">{actions}</div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE SIMULAÇÃO / NOVO EMPRÉSTIMO */}
      <Modal
        isOpen={isSimulatorModalOpen}
        onClose={() => setIsSimulatorModalOpen(false)}
        title="Novo Empréstimo — Simulador Price & Antecipação"
        subtitle="Simule condições de crédito com a Tabela Price oficial e contrate com 1 clique"
        maxWidth="1260px"
      >
        {renderSimulatorContent(true)}
      </Modal>

      {/* MODAL DE ANTECIPAÇÃO INTERTEMPORAL DE PARCELAS */}
      {prepayModalMonth !== null && (
        <div className="modal-overlay" onClick={() => setPrepayModalMonth(null)} style={{ zIndex: 1200 }}>
          <div
            className="modal-container glass-card prepay-intertemporal-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '850px', width: '95%' }}
          >
            <div className="modal-header">
              <div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-emerald flex items-center gap-1 font-semibold">
                    <Sparkles size={13} /> ANTECIPAÇÃO DE PARCELAS FUTURAS
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Mês {prepayModalMonth} ({simAnalysis.simulatedRows[prepayModalMonth]?.dueDate})
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1 label-with-info">
                  Planejar Antecipações com Desconto no Mês {prepayModalMonth}
                  <InfoButton title="Antecipação com desconto">
                    <p>Quanto mais meses você antecipa, menor o valor pago, porque os juros futuros são descontados (valor presente).</p>
                  </InfoButton>
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-slate-400 hover:text-white p-1"
                onClick={() => setPrepayModalMonth(null)}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body space-y-4">
              {/* Painel de Ações Rápidas no Modal */}
              <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg bg-slate-900/60 border border-border/40">
                <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                  <Zap size={13} className="text-amber" /> Ações Rápidas:
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-xs text-xs font-semibold text-emerald border-emerald/40 hover:bg-emerald/10"
                  onClick={() => {
                    // Antecipa a maior parcela k > prepayModalMonth ainda não alocada
                    for (let k = summary.termMonths; k > prepayModalMonth; k--) {
                      if (prepaidAllocations[k] === undefined || prepaidAllocations[k] === prepayModalMonth) {
                        handleTogglePrepay(k, prepayModalMonth);
                        break;
                      }
                    }
                  }}
                  title="Antecipa a parcela mais distante para obter o maior desconto de juros possível"
                >
                  🎯 Antecipar Última Parcela Pendente
                </button>

                {prepayModalMonth + 1 <= summary.termMonths && (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs text-xs"
                    onClick={() => handleTogglePrepay(prepayModalMonth + 1, prepayModalMonth)}
                  >
                    ⏩ Antecipar Próxima Parcela (Mês {prepayModalMonth + 1})
                  </button>
                )}

                {Object.values(prepaidAllocations).some((m) => m === prepayModalMonth) && (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs text-xs text-rose border-rose/30 hover:bg-rose/10 ml-auto"
                    onClick={() => {
                      setPrepaidAllocations((prev) => {
                        const updated = { ...prev };
                        Object.keys(updated).forEach((k) => {
                          if (updated[Number(k)] === prepayModalMonth) {
                            delete updated[Number(k)];
                          }
                        });
                        return updated;
                      });
                    }}
                  >
                    <RotateCcw size={12} /> Limpar Deste Mês
                  </button>
                )}
              </div>

              {/* Tabela de Parcelas Futuras Elegíveis */}
              <div className="spreadsheet-table-wrapper max-h-[320px] overflow-y-auto">
                <table className="spreadsheet-table text-xs">
                  <thead>
                    <tr>
                      <th className="th-center" style={{ width: '45px' }}>Sel.</th>
                      <th className="th-center">Parcela</th>
                      <th>Vencimento Original</th>
                      <th className="th-center">Antecedência</th>
                      <th className="th-right">Valor Original</th>
                      <th className="th-right th-highlight">Valor c/ Desconto (VP)</th>
                      <th className="th-right th-highlight-amber">Economia em Juros</th>
                      <th className="th-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .filter((r) => r.month > prepayModalMonth)
                      .map((futureRow) => {
                        const k = futureRow.month;
                        const isAllocatedHere = prepaidAllocations[k] === prepayModalMonth;
                        const isAllocatedElsewhere =
                          prepaidAllocations[k] !== undefined && prepaidAllocations[k] !== prepayModalMonth;
                        const otherMonth = prepaidAllocations[k];

                        const advDetails = calculateAdvanceDetails(
                          k,
                          prepayModalMonth,
                          futureRow.installmentValue,
                          params.monthlyInterestRate
                        );

                        return (
                          <tr
                            key={k}
                            className={`cursor-pointer transition-colors ${
                              isAllocatedHere
                                ? 'bg-emerald-950/30'
                                : isAllocatedElsewhere
                                ? 'opacity-40 bg-slate-900/30'
                                : 'hover:bg-slate-800/40'
                            }`}
                            onClick={() => {
                              if (!isAllocatedElsewhere) {
                                handleTogglePrepay(k, prepayModalMonth);
                              }
                            }}
                          >
                            <td className="th-center">
                              <input
                                type="checkbox"
                                checked={isAllocatedHere}
                                disabled={isAllocatedElsewhere}
                                onChange={() => handleTogglePrepay(k, prepayModalMonth)}
                                className="cursor-pointer"
                              />
                            </td>
                            <td className="th-center font-mono font-bold text-white">
                              {k}/{summary.termMonths}
                            </td>
                            <td className="font-mono text-muted">{futureRow.dueDate}</td>
                            <td className="th-center font-mono text-cyan-400 font-semibold">
                              {advDetails.deltaMonths} meses antes
                            </td>
                            <td className="th-right font-mono text-slate-400 line-through">
                              {futureRow.installmentValue.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </td>
                            <td className="th-right font-mono font-bold text-emerald-400">
                              {advDetails.vp.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </td>
                            <td className="th-right font-mono font-bold text-amber">
                              - {advDetails.savings.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </td>
                            <td className="th-center">
                              {isAllocatedHere ? (
                                <span className="badge badge-emerald text-[10px] py-0.5 px-2 inline-flex items-center gap-1">
                                  <Check size={10} /> Pagar no Mês {prepayModalMonth}
                                </span>
                              ) : isAllocatedElsewhere ? (
                                <span className="badge badge-amber text-[10px] py-0.5 px-2">
                                  Alocada no Mês {otherMonth}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Disponível</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Card Resumo do Mês */}
              {(() => {
                const rowSim = simAnalysis.simulatedRows[prepayModalMonth];
                const advancesCount = rowSim?.advancesInThisMonth?.length || 0;
                return (
                  <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/30 flex justify-between items-center flex-wrap gap-3">
                    <div>
                      <span className="text-xs text-cyan-300 font-semibold block">
                        Impacto Consolidado no Mês {prepayModalMonth} ({rowSim?.dueDate}):
                      </span>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {advancesCount > 0 ? (
                          <>
                            Pagamento da parcela regular{' '}
                            <strong>
                              {rowSim?.basePayment.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </strong>{' '}
                            + <strong>{advancesCount}</strong> parcelas futuras antecipadas com deságio.
                          </>
                        ) : (
                          'Nenhuma parcela futura antecipada neste mês ainda.'
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Desembolso no Mês</span>
                        <strong className="text-sm text-cyan-400 font-mono font-bold">
                          {rowSim?.effectivePayment.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 justify-end uppercase">
                          <TrendingDown size={12} className="text-amber" /> Economia de Juros
                        </span>
                        <strong className="text-sm text-amber font-mono font-bold">
                          {rowSim?.savings > 0
                            ? `- ${rowSim.savings.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}`
                            : 'R$ 0,00'}
                        </strong>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm ml-2 font-semibold"
                        onClick={() => setPrepayModalMonth(null)}
                      >
                        Aplicar e Fechar
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmDialogProps} />

      {payingInstallment && (
        <InstallmentPaymentModal
          installment={payingInstallment}
          monthlyRatePercent={selectedGroup?.interestRatePercent || 0}
          onClose={() => setPayingInstallment(null)}
          onConfirm={(paymentDate, amount) => {
            updateMovement(payingInstallment.id, {
              status: 'REALIZADA',
              paymentDate,
              amount,
              actualAmount: amount,
              originalAmount: payingInstallment.originalAmount ?? payingInstallment.amount,
            });
            setPayingInstallment(null);
          }}
        />
      )}
    </div>
  );
};
