import React, { useState } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import {
  Car,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Home,
  CreditCard,
  Sparkles,
  Banknote,
  Sliders,
  TrendingUp,
  Shield,
  Plus,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  DollarSign,
  Percent,
} from 'lucide-react';
import type {
  SimulationVerdict,
  SimulationPresetId,
  CreditOperationType,
  FundsDestination,
  CustomScenarioInput,
} from '../types';

interface SimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPreset?: SimulationPresetId;
  initialMode?: 'PRESETS' | 'STUDIO';
}

// Configurações padrão de referência para cada possibilidade
const PRESET_DEFAULTS: Record<SimulationPresetId, {
  title: string;
  defaultAmount: number;
  defaultRate: number;
  defaultInstallments: number;
  defaultBankPayment: number;
  description: string;
}> = {
  NOVO_EMPRESTIMO: {
    title: 'Simulação: Novo Empréstimo Pessoal',
    defaultAmount: 30000,
    defaultRate: 2.10,
    defaultInstallments: 24,
    defaultBankPayment: 1680.00,
    description: 'Captação bancária com parcelas mensais debitadas em conta.',
  },
  FINANCIAMENTO: {
    title: 'Simulação: Novo Financiamento Empresarial / Bens',
    defaultAmount: 50000,
    defaultRate: 1.95,
    defaultInstallments: 36,
    defaultBankPayment: 1950.00,
    description: 'Financiamento estruturado com carência e prazos estendidos.',
  },
  CARRO: {
    title: 'Simulação: Financiamento de Veículo (Auto)',
    defaultAmount: 45000,
    defaultRate: 1.75,
    defaultInstallments: 48,
    defaultBankPayment: 1420.00,
    description: 'Crédito automotivo com alienação fiduciária em garantia.',
  },
  QUITAR_DIVIDA: {
    title: 'Simulação: Troca / Consolidação de Dívida',
    defaultAmount: 17367,
    defaultRate: 3.03,
    defaultInstallments: 14,
    defaultBankPayment: 1458.51,
    description: 'Consolidação e liquidação de passivos rotativos de juros elevados.',
  },
  IMOVEL: {
    title: 'Simulação: Financiamento Imobiliário Residencial',
    defaultAmount: 350000,
    defaultRate: 0.85,
    defaultInstallments: 360,
    defaultBankPayment: 3180.00,
    description: 'Crédito imobiliário habitacional de longo prazo (SFH/SFI).',
  },
};

// Cálculo da Taxa Efetiva Real (TIR mensal) com base no PV, Parcela do Banco e N
export function calculateEffectiveRate(pv: number, pmtBanco: number, n: number): number {
  if (pv <= 0 || pmtBanco <= 0 || n <= 0) return 0;
  if (pmtBanco * n <= pv) return 0;

  let low = 0.00001;
  let high = 1.0; // até 100% a.m.

  for (let iter = 0; iter < 60; iter++) {
    const mid = (low + high) / 2;
    const factor = Math.pow(1 + mid, -n);
    const computedPv = (pmtBanco * (1 - factor)) / mid;

    if (Math.abs(computedPv - pv) < 0.01) {
      return Math.round(mid * 10000) / 100;
    }

    if (computedPv > pv) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.round(((low + high) / 2) * 10000) / 100;
}

// Cálculo Matemático Rigoroso da Parcela Teórica (Price com ajuste de dias até 1º vencimento)
export function calculateMathematicalLoan(
  pv: number,
  monthlyRatePercent: number,
  n: number,
  contractDateStr: string,
  firstDueDateStr: string
) {
  if (pv <= 0 || n <= 0) {
    return {
      calculatedPayment: 0,
      calculatedTotal: 0,
      totalInterest: 0,
      daysDifference: 30,
    };
  }

  const i = (monthlyRatePercent || 0) / 100;

  let daysDiff = 30;
  let adjustedPv = pv;
  try {
    const cDate = new Date(contractDateStr + 'T12:00:00');
    const fDate = new Date(firstDueDateStr + 'T12:00:00');
    const diffMs = fDate.getTime() - cDate.getTime();
    daysDiff = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

    // Se o prazo até a 1ª parcela for superior a 30 dias (carência), incidem juros pro-rata
    if (daysDiff > 30) {
      const extraDays = daysDiff - 30;
      adjustedPv = pv * (1 + (i * (extraDays / 30)));
    }
  } catch (e) {
    daysDiff = 30;
  }

  const pmt = i > 0
    ? (adjustedPv * i) / (1 - Math.pow(1 + i, -n))
    : pv / n;

  const total = pmt * n;
  const totalInterest = Math.max(0, total - pv);

  return {
    calculatedPayment: Math.round(pmt * 100) / 100,
    calculatedTotal: Math.round(total * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    daysDifference: daysDiff,
  };
}

export const SimulationModal: React.FC<SimulationModalProps> = ({
  isOpen,
  onClose,
  initialPreset = 'NOVO_EMPRESTIMO',
  initialMode = 'PRESETS',
}) => {
  const {
    simulateCustomFutureScenario,
    applyScenarioToBudget,
    addMultipleMovements,
    monthlyFreeCashflow,
  } = useFinancial();

  const [activeMode, setActiveMode] = useState<'PRESETS' | 'STUDIO'>(initialMode);
  const [selectedPreset, setSelectedPreset] = useState<SimulationPresetId>(initialPreset);

  // ==============================================================
  // OS 10 CAMPOS CRÍTICOS DE AUDITORIA & SIMULAÇÃO PREENCHÍVEIS
  // ==============================================================
  const todayStr = new Date().toISOString().split('T')[0];
  const nextMonthDate = new Date();
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const nextMonthStr = nextMonthDate.toISOString().split('T')[0];

  const currentDefaults = PRESET_DEFAULTS[selectedPreset] || PRESET_DEFAULTS.NOVO_EMPRESTIMO;

  const [loanAmount, setLoanAmount] = useState<number>(currentDefaults.defaultAmount);
  const [declaredRate, setDeclaredRate] = useState<number>(currentDefaults.defaultRate);
  const [installments, setInstallments] = useState<number>(currentDefaults.defaultInstallments);
  const [contractDate, setContractDate] = useState<string>(todayStr);
  const [firstDueDate, setFirstDueDate] = useState<string>(nextMonthStr);
  const [bankPayment, setBankPayment] = useState<number>(currentDefaults.defaultBankPayment);
  const [showFieldDetails, setShowFieldDetails] = useState<boolean>(false);

  // Atualizar valores padrão ao mudar de preset
  const handlePresetSelect = (preset: SimulationPresetId) => {
    setSelectedPreset(preset);
    const def = PRESET_DEFAULTS[preset];
    setLoanAmount(def.defaultAmount);
    setDeclaredRate(def.defaultRate);
    setInstallments(def.defaultInstallments);
    setBankPayment(def.defaultBankPayment);
  };

  // CÁLCULOS AUTOMÁTICOS DO BALDER
  const mathResults = calculateMathematicalLoan(
    loanAmount,
    declaredRate,
    installments,
    contractDate,
    firstDueDate
  );

  const calculatedPayment = mathResults.calculatedPayment;
  const calculatedTotal = mathResults.calculatedTotal;
  const bankTotal = Math.round(bankPayment * installments * 100) / 100;
  const effectiveRate = calculateEffectiveRate(loanAmount, bankPayment, installments);

  // VALIDAÇÃO DA PARCELA
  const paymentDiff = Math.round((bankPayment - calculatedPayment) * 100) / 100;
  const totalDiff = Math.round((bankTotal - calculatedTotal) * 100) / 100;
  const rateDiff = Math.round((effectiveRate - declaredRate) * 100) / 100;

  let validationVerdict: 'CONFORME' | 'CUSTO_OCULTO' | 'SUBSIDIADO' = 'CONFORME';
  if (paymentDiff > 1.50) {
    validationVerdict = 'CUSTO_OCULTO';
  } else if (paymentDiff < -1.50) {
    validationVerdict = 'SUBSIDIADO';
  }

  // Modo 2: Estúdio de Cenários Futuros
  const [operationType, setOperationType] = useState<CreditOperationType>('EMPRESTIMO_PESSOAL');
  const [principalAmount, setPrincipalAmount] = useState(40000);
  const [installmentsCount, setInstallmentsCount] = useState(36);
  const [monthlyInterestRate, setMonthlyInterestRate] = useState(1.85);
  const [gracePeriodMonths, setGracePeriodMonths] = useState(1);
  const [destination, setDestination] = useState<FundsDestination>('QUITAR_DIVIDAS_CARAS');
  
  // Comportamento Financeiro
  const [cutVariableExpensesPercent, setCutVariableExpensesPercent] = useState(15);
  const [expectedMonthlyIncomeBoost, setExpectedMonthlyIncomeBoost] = useState(500);
  const [pauseGoalContributions, setPauseGoalContributions] = useState(false);
  const [extraAmortizationMonth, setExtraAmortizationMonth] = useState(12);
  const [extraAmortizationAmount, setExtraAmortizationAmount] = useState(4000);

  // Cálculo reativo do cenário personalizado
  const customScenarioInput: CustomScenarioInput = {
    operationType,
    principalAmount,
    installmentsCount,
    monthlyInterestRate,
    gracePeriodMonths,
    destination,
    behavior: {
      cutVariableExpensesPercent,
      expectedMonthlyIncomeBoost,
      pauseGoalContributions,
      extraAmortizationMonth,
      extraAmortizationAmount,
    },
  };

  const customResult = simulateCustomFutureScenario(customScenarioInput);

  const getVerdictBadge = (verdict: SimulationVerdict) => {
    switch (verdict) {
      case 'RECOMENDADO':
        return (
          <div className="verdict-badge verdict-success">
            <CheckCircle2 size={16} />
            <span>ALTAMENTE RECOMENDADO</span>
          </div>
        );
      case 'COM_RESTRICAO':
        return (
          <div className="verdict-badge verdict-warning">
            <AlertTriangle size={16} />
            <span>VIÁVEL COM RESTRIÇÕES</span>
          </div>
        );
      case 'NAO_RECOMENDADO':
        return (
          <div className="verdict-badge verdict-danger">
            <XCircle size={16} />
            <span>NÃO RECOMENDADO NO MOMENTO</span>
          </div>
        );
    }
  };

  // Salvar a simulação validada diretamente no planejamento financeiro
  const handleSaveValidatedLoan = () => {
    if (confirm(`Deseja efetivar este financiamento no seu Balder?\n\n• Captação de ${loanAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em ${contractDate}\n• ${installments} parcelas de ${bankPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} a partir de ${firstDueDate}.`)) {
      const groupId = `loan_${Date.now()}`;
      const itemsToAdd = [];

      // 1. Entrada do valor captado
      itemsToAdd.push({
        title: `Captação: ${currentDefaults.title.replace('Simulação: ', '')}`,
        type: 'RECEBER' as const,
        amount: loanAmount,
        dueDate: contractDate,
        bank: 'Nubank',
        status: 'REALIZADA' as const,
        category: 'Empréstimos / Financiamentos',
        notes: `Efetivado via Simulador de Crédito. Taxa real: ${effectiveRate}% a.m.`,
      });

      // 2. Projeção das parcelas mensais
      const startParts = firstDueDate.split('-');
      const y = parseInt(startParts[0], 10);
      const m = parseInt(startParts[1], 10) - 1;
      const d = parseInt(startParts[2], 10);

      for (let idx = 0; idx < installments; idx++) {
        const pDate = new Date(y, m + idx, d);
        if (pDate.getDate() !== d) pDate.setDate(0);

        itemsToAdd.push({
          title: `Parcela (${idx + 1}/${installments}) - ${currentDefaults.title.replace('Simulação: ', '')}`,
          type: 'EMPRESTIMO' as const,
          amount: bankPayment,
          dueDate: pDate.toISOString().split('T')[0],
          bank: 'Nubank',
          status: 'PREVISTA' as const,
          category: 'Empréstimos & Financiamentos',
          notes: `Plano de ${installments}x de ${bankPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} • Taxa Real: ${effectiveRate}% a.m.`,
          installmentNumber: idx + 1,
          installmentsTotal: installments,
          installmentGroupId: groupId,
        });
      }

      addMultipleMovements(itemsToAdd);
      alert('Operação de crédito efetivada no seu fluxo de caixa!');
      onClose();
    }
  };

  const handleApplyScenario = () => {
    if (confirm('Deseja efetivar este cenário no seu Balder? Isso programará a captação e as parcelas futuras no seu fluxo de caixa.')) {
      applyScenarioToBudget(customResult);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activeMode === 'STUDIO' ? 'Estúdio de Cenários Futuros' : 'Simulador & Auditor de Crédito'}
      subtitle={
        activeMode === 'STUDIO'
          ? 'Projete créditos, direcione o recurso e defina o comportamento orçamentário com projeção de 12 meses'
          : 'Preencha as propostas de bancos e audite taxas reais, parcelas calculadas e custos ocultos'
      }
      maxWidth={activeMode === 'STUDIO' ? '920px' : '860px'}
    >
      <div className="simulation-modal-content">
        {/* Top Dual Mode Switcher */}
        <div className="sim-mode-switcher">
          <button
            className={`sim-mode-btn ${activeMode === 'PRESETS' ? 'active' : ''}`}
            onClick={() => setActiveMode('PRESETS')}
          >
            <Sparkles size={16} />
            <span>Auditor de Propostas & Possibilidades</span>
          </button>

          <button
            className={`sim-mode-btn ${activeMode === 'STUDIO' ? 'active' : ''}`}
            onClick={() => setActiveMode('STUDIO')}
          >
            <Sliders size={16} />
            <span>Estúdio de Cenários Futuros (12 Meses)</span>
            <span className="badge badge-cyan" style={{ fontSize: '9px', padding: '2px 6px' }}>AVANÇADO</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* MODO 1: AUDITOR DE POSSIBILIDADES COM OS 10 CAMPOS CRÍTICOS     */}
        {/* ============================================================== */}
        {activeMode === 'PRESETS' && (
          <div className="presets-mode-wrapper animate-fade-in">
            {/* Seletor de Possibilidades Rápidas */}
            <div className="simulation-presets-grid">
              <button
                className={`sim-preset-btn ${selectedPreset === 'NOVO_EMPRESTIMO' ? 'active' : ''}`}
                onClick={() => handlePresetSelect('NOVO_EMPRESTIMO')}
              >
                <Banknote size={18} />
                <span>Novo Empréstimo</span>
              </button>

              <button
                className={`sim-preset-btn ${selectedPreset === 'FINANCIAMENTO' ? 'active' : ''}`}
                onClick={() => handlePresetSelect('FINANCIAMENTO')}
              >
                <CreditCard size={18} />
                <span>Financiamento</span>
              </button>

              <button
                className={`sim-preset-btn ${selectedPreset === 'CARRO' ? 'active' : ''}`}
                onClick={() => handlePresetSelect('CARRO')}
              >
                <Car size={18} />
                <span>Comprar Carro</span>
              </button>

              <button
                className={`sim-preset-btn ${selectedPreset === 'QUITAR_DIVIDA' ? 'active' : ''}`}
                onClick={() => handlePresetSelect('QUITAR_DIVIDA')}
              >
                <CheckCircle2 size={18} />
                <span>Quitar Dívida</span>
              </button>

              <button
                className={`sim-preset-btn ${selectedPreset === 'IMOVEL' ? 'active' : ''}`}
                onClick={() => handlePresetSelect('IMOVEL')}
              >
                <Home size={18} />
                <span>Comprar Imóvel</span>
              </button>
            </div>

            {/* FORMULÁRIO DOS CAMPOS ESSENCIAIS DE ENTRADA */}
            <div className="loan-audit-form-card glass-card mt-3">
              <div className="loan-audit-header">
                <div>
                  <h4 className="text-white font-bold">{currentDefaults.title}</h4>
                  <p className="text-xs text-secondary">{currentDefaults.description}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() => setShowFieldDetails(!showFieldDetails)}
                >
                  <HelpCircle size={14} className="text-cyan" />
                  <span>{showFieldDetails ? 'Ocultar Detalhamento' : 'Detalhamento dos Campos'}</span>
                  {showFieldDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

              {/* DETALHAMENTO DIDÁTICO DOS CAMPOS (EXPANSÍVEL) */}
              {showFieldDetails && (
                <div className="loan-fields-glossary glass-card animate-fade-in mt-3 p-3">
                  <h5 className="text-xs font-bold text-cyan mb-2">Detalhamento dos Campos & Fórmulas Contábeis:</h5>
                  <div className="glossary-grid">
                    <div className="glossary-item">
                      <strong>1. Valor Emprestado:</strong> Montante principal captado líquido liberado na sua conta.
                    </div>
                    <div className="glossary-item">
                      <strong>2. Taxa:</strong> Taxa de juros mensal nominal declarada pelo banco ou financeira na proposta.
                    </div>
                    <div className="glossary-item">
                      <strong>3. Quantidade de Parcelas:</strong> Prazo de pagamento em prestações mensais consecutivas.
                    </div>
                    <div className="glossary-item">
                      <strong>4. Data da Contratação:</strong> Dia do desembolso / assinatura do contrato de crédito.
                    </div>
                    <div className="glossary-item">
                      <strong>5. Data de Vencimento Inicial:</strong> Vencimento da 1ª parcela (define dias de carência).
                    </div>
                    <div className="glossary-item">
                      <strong>6. Valor da Parcela (Calculada):</strong> Prestação teórica calculada matematicamente pela Tabela Price pura.
                    </div>
                    <div className="glossary-item">
                      <strong>7. Valor Total c/ Juros (Calculada):</strong> Total rigoroso sem cobranças adicionais (Parcela Calc. × N).
                    </div>
                    <div className="glossary-item">
                      <strong>8. Valor da Parcela (No Banco):</strong> Valor real exigido pela instituição bancária no boleto/fatura.
                    </div>
                    <div className="glossary-item">
                      <strong>9. Valor Total c/ Juros (No Banco):</strong> Custo total efetivo a ser pago ao banco (Parcela Banco × N).
                    </div>
                    <div className="glossary-item">
                      <strong>10. Taxa (de acordo com o cálculo):</strong> Taxa efetiva real (TIR/CET) apurada pelo valor da parcela cobrada.
                    </div>
                  </div>
                </div>
              )}

              {/* LINHA 1: VALOR EMPRESTADO, TAXA, PARCELAS */}
              <div className="form-grid-3 mt-3">
                <div className="form-group">
                  <label>
                    <DollarSign size={13} className="text-emerald inline mr-1" />
                    Valor Emprestado (R$)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    className="form-input text-base font-bold text-emerald"
                    value={loanAmount || ''}
                    onChange={(e) => setLoanAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <Percent size={13} className="text-amber inline mr-1" />
                    Taxa Declarada (% a.m.)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="30"
                    step="0.05"
                    className="form-input text-base font-bold text-amber"
                    value={declaredRate || ''}
                    onChange={(e) => setDeclaredRate(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="form-group">
                  <label>Quantidade de Parcelas</label>
                  <input
                    type="number"
                    min="2"
                    max="420"
                    className="form-input text-base font-bold text-cyan"
                    value={installments || ''}
                    onChange={(e) => setInstallments(parseInt(e.target.value, 10) || 1)}
                  />
                </div>
              </div>

              {/* LINHA 2: DATAS E VALOR COBRADO PELO BANCO */}
              <div className="form-grid-3 mt-3">
                <div className="form-group">
                  <label>
                    <Calendar size={13} className="text-muted inline mr-1" />
                    Data da Contratação
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={contractDate}
                    onChange={(e) => setContractDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <Calendar size={13} className="text-cyan inline mr-1" />
                    Data Vencimento Inicial
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={firstDueDate}
                    onChange={(e) => setFirstDueDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="text-glow-cyan font-bold">
                    Valor da Parcela (No Banco)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input text-base font-bold border-cyan text-white"
                    placeholder="Valor exigido pelo banco"
                    value={bankPayment || ''}
                    onChange={(e) => setBankPayment(parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-xs text-muted block mt-1">Preencha com o valor da proposta real do banco</span>
                </div>
              </div>

              {/* PAINEL COMPARATIVO & AUDITORIA FINANCEIRA BALDER */}
              <div className="audit-comparison-panel glass-card mt-4">
                <div className="audit-table-wrapper">
                  <table className="audit-comparison-table">
                    <thead>
                      <tr>
                        <th>Métrica de Auditoria</th>
                        <th className="text-cyan">Cálculo Matemático Puro</th>
                        <th className="text-amber">Proposta Real do Banco</th>
                        <th className="text-right">Diferença / Auditoria Balder</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <strong>Valor da Parcela</strong>
                          <span className="text-xs text-muted block">Prestação mensal devida</span>
                        </td>
                        <td className="text-cyan font-bold text-base">
                          {calculatedPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="text-amber font-bold text-base">
                          {bankPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="text-right font-bold">
                          <span className={paymentDiff > 1.5 ? 'text-rose' : paymentDiff < -1.5 ? 'text-emerald' : 'text-cyan'}>
                            {paymentDiff > 0 ? `+ ${paymentDiff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês` : paymentDiff < 0 ? `- ${Math.abs(paymentDiff).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês` : 'R$ 0,00 (Exato)'}
                          </span>
                        </td>
                      </tr>

                      <tr>
                        <td>
                          <strong>Valor Total c/ Juros</strong>
                          <span className="text-xs text-muted block">Soma de todas as {installments} parcelas</span>
                        </td>
                        <td className="text-cyan font-semibold">
                          {calculatedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="text-amber font-semibold">
                          {bankTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="text-right font-bold">
                          <span className={totalDiff > 10 ? 'text-rose' : totalDiff < -10 ? 'text-emerald' : 'text-cyan'}>
                            {totalDiff > 0 ? `+ ${totalDiff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} acumulados` : totalDiff < 0 ? `- ${Math.abs(totalDiff).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : 'R$ 0,00 (Exato)'}
                          </span>
                        </td>
                      </tr>

                      <tr>
                        <td>
                          <strong>Taxa de Juros Mensal</strong>
                          <span className="text-xs text-muted block">Nominal vs Efetiva real</span>
                        </td>
                        <td className="text-cyan">
                          {declaredRate.toFixed(2)}% a.m. (Declarada)
                        </td>
                        <td className="text-amber font-bold">
                          {effectiveRate.toFixed(2)}% a.m. (De acordo c/ o cálculo)
                        </td>
                        <td className="text-right">
                          <span className={`badge ${rateDiff > 0.05 ? 'badge-rose' : rateDiff < -0.05 ? 'badge-emerald' : 'badge-cyan'}`}>
                            {rateDiff > 0 ? `Spread Oculto: +${rateDiff.toFixed(2)}% a.m.` : rateDiff < 0 ? `Desconto: ${rateDiff.toFixed(2)}% a.m.` : 'Taxa Exata'}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* VEREDITO E VALIDAÇÃO DA PARCELA */}
                <div className={`loan-validation-banner mt-3 ${validationVerdict === 'CUSTO_OCULTO' ? 'val-warning' : validationVerdict === 'SUBSIDIADO' ? 'val-bonus' : 'val-success'}`}>
                  <div className="val-banner-icon">
                    {validationVerdict === 'CUSTO_OCULTO' ? (
                      <AlertTriangle size={22} className="text-rose" />
                    ) : (
                      <CheckCircle2 size={22} className="text-emerald" />
                    )}
                  </div>
                  <div className="val-banner-text">
                    {validationVerdict === 'CUSTO_OCULTO' && (
                      <>
                        <h5 className="text-rose font-bold">⚠️ Atenção: Custos e Tarifas Ocultas Identificadas na Proposta</h5>
                        <p className="text-xs">
                          O banco informou taxa nominal de <strong>{declaredRate.toFixed(2)}% a.m.</strong>, mas pela parcela cobrada de <strong>{bankPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>, a <strong>Taxa Real Efetiva é de {effectiveRate.toFixed(2)}% a.m.</strong> Você pagará <strong>{totalDiff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} a mais</strong> do que o cálculo puro dos juros. Isso decorre de IOF financiado, TAC, tarifas cadastrais ou seguros embutidos.
                        </p>
                      </>
                    )}

                    {validationVerdict === 'CONFORME' && (
                      <>
                        <h5 className="text-emerald font-bold">✓ Parcela Válida & Conforme com o Cálculo Matemático</h5>
                        <p className="text-xs">
                          A parcela de <strong>{bankPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> reflete rigorosamente a taxa declarada de <strong>{declaredRate.toFixed(2)}% a.m.</strong> pela Tabela Price, sem incidência de custos ocultos desproporcionais.
                        </p>
                      </>
                    )}

                    {validationVerdict === 'SUBSIDIADO' && (
                      <>
                        <h5 className="text-cyan font-bold">⭐ Condição Especial / Parcela com Subsídio</h5>
                        <p className="text-xs">
                          A parcela cobrada pelo banco é inferior ao custo matemático puro da taxa, o que indica subsídio de juros da montadora/loja ou carência contratual bonificada.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* IMPACTO NO FLUXO DE CAIXA E RUNWAY */}
                <div className="loan-cashflow-impact mt-3">
                  <div className="impact-pill">
                    <span className="text-xs text-muted">Impacto Mensal no Fluxo</span>
                    <strong className="text-rose">- {bankPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês</strong>
                  </div>
                  <div className="impact-pill">
                    <span className="text-xs text-muted">Fluxo Livre Após Parcela</span>
                    <strong className={monthlyFreeCashflow - bankPayment >= 0 ? 'text-emerald' : 'text-rose'}>
                      {(monthlyFreeCashflow - bankPayment).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                    </strong>
                  </div>
                  <div className="impact-pill">
                    <span className="text-xs text-muted">Total de Juros Pagos</span>
                    <strong className="text-amber">
                      {Math.max(0, bankTotal - loanAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </div>
                </div>
              </div>

              {/* AÇÕES DE SALVAR NO PLANEJAMENTO */}
              <div className="loan-actions-row mt-4">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveMode('STUDIO')}
                >
                  <Sliders size={14} />
                  <span>Projetar no Estúdio de 12 Meses</span>
                </button>

                <div className="flex gap-2">
                  <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                    Fechar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveValidatedLoan}
                  >
                    <Plus size={14} />
                    <span>Salvar no Planejamento</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}

        {/* MODO 2: ESTÚDIO DE CENÁRIOS FUTUROS (CUSTOMIZADO)               */}
        {/* ============================================================== */}
        {activeMode === 'STUDIO' && (
          <div className="studio-mode-wrapper animate-fade-in">
            {/* ETAPA 1: PARÂMETROS DA OPERAÇÃO DE CRÉDITO */}
            <div className="studio-card glass-card mb-4">
              <div className="studio-card-header">
                <div className="step-indicator">1</div>
                <div>
                  <h4>Operação de Crédito / Captação</h4>
                  <p>Defina o tipo, valor, prazo e taxa de juros pretendidos</p>
                </div>
              </div>

              <div className="studio-controls-grid">
                <div className="form-group">
                  <label>Tipo de Operação</label>
                  <select
                    className="form-select"
                    value={operationType}
                    onChange={(e) => setOperationType(e.target.value as CreditOperationType)}
                  >
                    <option value="EMPRESTIMO_PESSOAL">Empréstimo Pessoal Bancário</option>
                    <option value="EMPRESTIMO_CONSIGNADO">Empréstimo Consignado / Garantia</option>
                    <option value="FINANCIAMENTO_AUTO">Financiamento de Veículo</option>
                    <option value="FINANCIAMENTO_IMOVEL">Financiamento Imobiliário</option>
                    <option value="CAPITAL_GIRO">Capital de Giro / Expansão Profissional</option>
                  </select>
                </div>

                <div className="form-group">
                  <div className="slider-label-row">
                    <label>Valor Solicitado</label>
                    <span className="slider-value-badge">
                      {principalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <input
                    type="range"
                    className="slider-range"
                    min={5000}
                    max={250000}
                    step={2500}
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(Number(e.target.value))}
                  />
                  <div className="slider-ticks">
                    <span>R$ 5k</span>
                    <span>R$ 100k</span>
                    <span>R$ 250k</span>
                  </div>
                </div>

                <div className="form-group">
                  <div className="slider-label-row">
                    <label>Prazo de Pagamento</label>
                    <span className="slider-value-badge">{installmentsCount} parcelas</span>
                  </div>
                  <input
                    type="range"
                    className="slider-range"
                    min={6}
                    max={84}
                    step={6}
                    value={installmentsCount}
                    onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                  />
                  <div className="slider-ticks">
                    <span>6 meses</span>
                    <span>36 meses</span>
                    <span>84 meses</span>
                  </div>
                </div>

                <div className="form-group">
                  <div className="slider-label-row">
                    <label>Taxa de Juros Estimada</label>
                    <span className="slider-value-badge text-amber">{monthlyInterestRate.toFixed(2)}% a.m.</span>
                  </div>
                  <input
                    type="range"
                    className="slider-range"
                    min={0.8}
                    max={4.5}
                    step={0.05}
                    value={monthlyInterestRate}
                    onChange={(e) => setMonthlyInterestRate(Number(e.target.value))}
                  />
                  <div className="slider-ticks">
                    <span>0,8% (Consignado/Imóvel)</span>
                    <span>2,5% (Auto)</span>
                    <span>4,5% (Pessoal)</span>
                  </div>
                </div>
              </div>

              <div className="form-row mt-2">
                <div className="form-group flex-1">
                  <label>Carência Inicial (Meses sem amortização)</label>
                  <select
                    className="form-select"
                    value={gracePeriodMonths}
                    onChange={(e) => setGracePeriodMonths(Number(e.target.value))}
                  >
                    <option value={0}>Sem carência (1º vencimento em 30 dias)</option>
                    <option value={1}>1 mês de carência</option>
                    <option value={2}>2 meses de carência (60 dias)</option>
                    <option value={3}>3 meses de carência (90 dias)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ETAPA 2: DIRECIONAMENTO DO DINHEIRO */}
            <div className="studio-card glass-card mb-4">
              <div className="studio-card-header">
                <div className="step-indicator">2</div>
                <div>
                  <h4>Direcionamento do Capital</h4>
                  <p>Para onde o dinheiro captado será alocado imediatamente?</p>
                </div>
              </div>

              <div className="destinations-grid">
                <button
                  type="button"
                  className={`destination-card ${destination === 'QUITAR_DIVIDAS_CARAS' ? 'active' : ''}`}
                  onClick={() => setDestination('QUITAR_DIVIDAS_CARAS')}
                >
                  <div className="dest-icon-row">
                    <CheckCircle2 size={20} className="text-emerald" />
                    <span className="dest-tag dest-tag-save">Economia Imediata</span>
                  </div>
                  <h5>Quitar Dívidas Caras</h5>
                  <p>Troca de dívida cara por crédito mais longo, eliminando R$ 1.458/mês de encargos imediatos.</p>
                </button>

                <button
                  type="button"
                  className={`destination-card ${destination === 'INVESTIMENTO_RESERVA' ? 'active' : ''}`}
                  onClick={() => setDestination('INVESTIMENTO_RESERVA')}
                >
                  <div className="dest-icon-row">
                    <TrendingUp size={20} className="text-cyan" />
                    <span className="dest-tag dest-tag-growth">Expansão</span>
                  </div>
                  <h5>Ativo / Investimento</h5>
                  <p>Aporte em capital produtivo ou reserva estratégica gerando rendimento e colchão financeiro.</p>
                </button>

                <button
                  type="button"
                  className={`destination-card ${destination === 'AQUISICAO_BEM' ? 'active' : ''}`}
                  onClick={() => setDestination('AQUISICAO_BEM')}
                >
                  <div className="dest-icon-row">
                    <Car size={20} className="text-amber" />
                    <span className="dest-tag dest-tag-asset">Ativo Físico</span>
                  </div>
                  <h5>Aquisição de Bem / Reforma</h5>
                  <p>Compra de veículo, maquinário ou reforma patrimonial com saída imediata do capital.</p>
                </button>

                <button
                  type="button"
                  className={`destination-card ${destination === 'CAPITAL_GIRO_CAIXA' ? 'active' : ''}`}
                  onClick={() => setDestination('CAPITAL_GIRO_CAIXA')}
                >
                  <div className="dest-icon-row">
                    <Shield size={20} className="text-purple" />
                    <span className="dest-tag dest-tag-safety">Liquidez</span>
                  </div>
                  <h5>Capital de Giro em Caixa</h5>
                  <p>O valor permanece integralmente em conta corrente para absorver oportunidades e volatilidade.</p>
                </button>
              </div>
            </div>

            {/* ETAPA 3: DEFINIÇÃO DE COMPORTAMENTO FINANCEIRO */}
            <div className="studio-card glass-card mb-4">
              <div className="studio-card-header">
                <div className="step-indicator">3</div>
                <div>
                  <h4>Comportamento Orçamentário (Suas Ações)</h4>
                  <p>Como suas decisões e hábitos se ajustarão para equilibrar as novas parcelas?</p>
                </div>
              </div>

              <div className="behavior-controls-grid">
                {/* 1. Corte de Gastos Variáveis */}
                <div className="behavior-item-card">
                  <div className="slider-label-row">
                    <label>Corte em Despesas Variáveis</label>
                    <span className="slider-value-badge text-emerald">
                      {cutVariableExpensesPercent}% (- R$ {Math.round(3800 * (cutVariableExpensesPercent / 100)).toLocaleString('pt-BR')}/mês)
                    </span>
                  </div>
                  <input
                    type="range"
                    className="slider-range"
                    min={0}
                    max={30}
                    step={5}
                    value={cutVariableExpensesPercent}
                    onChange={(e) => setCutVariableExpensesPercent(Number(e.target.value))}
                  />
                  <div className="slider-ticks">
                    <span>0% (Sem cortes)</span>
                    <span>15% (Moderado)</span>
                    <span>30% (Intensivo)</span>
                  </div>
                </div>

                {/* 2. Renda Mensal Adicional Prevista */}
                <div className="behavior-item-card">
                  <div className="slider-label-row">
                    <label>Renda Extra Mensal Esperada</label>
                    <span className="slider-value-badge text-cyan">
                      + R$ {expectedMonthlyIncomeBoost.toLocaleString('pt-BR')}/mês
                    </span>
                  </div>
                  <input
                    type="range"
                    className="slider-range"
                    min={0}
                    max={4000}
                    step={250}
                    value={expectedMonthlyIncomeBoost}
                    onChange={(e) => setExpectedMonthlyIncomeBoost(Number(e.target.value))}
                  />
                  <div className="slider-ticks">
                    <span>R$ 0</span>
                    <span>R$ 2.000</span>
                    <span>R$ 4.000</span>
                  </div>
                </div>

                {/* 3. Pausar Aportes em Metas */}
                <div className="behavior-item-card flex-between">
                  <div>
                    <label className="font-semibold block mb-1">Pausar Aportes em Metas</label>
                    <p className="text-xs text-muted">
                      Libera temporariamente +R$ 2.500/mês no seu fluxo durante o pagamento do empréstimo.
                    </p>
                  </div>
                  <label className="switch-toggle">
                    <input
                      type="checkbox"
                      checked={pauseGoalContributions}
                      onChange={(e) => setPauseGoalContributions(e.target.checked)}
                    />
                    <span className="switch-slider"></span>
                  </label>
                </div>

                {/* 4. Amortização Extra com 13º / Bônus */}
                <div className="behavior-item-card">
                  <div className="slider-label-row">
                    <div className="flex-row items-center gap-2">
                      <label>Amortização Extra no</label>
                      <select
                        className="form-select"
                        style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
                        value={extraAmortizationMonth}
                        onChange={(e) => setExtraAmortizationMonth(Number(e.target.value))}
                      >
                        <option value={6}>Mês 6</option>
                        <option value={12}>Mês 12 (13º)</option>
                        <option value={18}>Mês 18</option>
                        <option value={24}>Mês 24</option>
                      </select>
                    </div>
                    <span className="slider-value-badge text-amber">
                      R$ {extraAmortizationAmount.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex-row gap-2">
                    <input
                      type="range"
                      className="slider-range flex-1"
                      min={0}
                      max={20000}
                      step={1000}
                      value={extraAmortizationAmount}
                      onChange={(e) => setExtraAmortizationAmount(Number(e.target.value))}
                    />
                  </div>
                  <div className="slider-ticks">
                    <span>Sem amortização</span>
                    <span>R$ 10.000</span>
                    <span>R$ 20.000</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PAINEL DE RESULTADOS & DIAGNÓSTICO EM TEMPO REAL */}
            <div className="studio-results-card glass-card">
              <div className="results-header">
                <div>
                  <span className="badge badge-cyan mb-1">DIAGNÓSTICO COMPUTADO EM TEMPO REAL</span>
                  <h3 className="results-title">Veredito do Cenário Personalizado</h3>
                </div>
                {getVerdictBadge(customResult.verdict)}
              </div>

              <p className="results-explanation">{customResult.verdictReason}</p>

              {/* 5 Métricas Chave */}
              <div className="studio-metrics-row">
                <div className="studio-metric-tile">
                  <span className="tile-label">Parcela Estimada (Price)</span>
                  <span className="tile-value text-rose">
                    R$ {customResult.computedMonthlyPayment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                  </span>
                  <span className="tile-sub">{installmentsCount}x com taxa {monthlyInterestRate}% a.m.</span>
                </div>

                <div className="studio-metric-tile">
                  <span className="tile-label">Juros Totais Acumulados</span>
                  <span className="tile-value text-amber">
                    R$ {customResult.totalInterestPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="tile-sub">Total a pagar: R$ {customResult.totalRepayment.toLocaleString('pt-BR')}</span>
                </div>

                <div className="studio-metric-tile">
                  <span className="tile-label">Comprometimento de Renda</span>
                  <span className={`tile-value ${customResult.debtToIncomeRatio > 30 ? 'text-rose' : customResult.debtToIncomeRatio > 18 ? 'text-amber' : 'text-emerald'}`}>
                    {customResult.debtToIncomeRatio}%
                  </span>
                  <span className="tile-sub">Teto recomendado: 25%</span>
                </div>

                <div className="studio-metric-tile">
                  <span className="tile-label">Fluxo Livre Líquido Final</span>
                  <span className={`tile-value ${monthlyFreeCashflow + customResult.netMonthlyImpact > 0 ? 'text-emerald' : 'text-rose'}`}>
                    {monthlyFreeCashflow + customResult.netMonthlyImpact > 0 ? '+' : ''}
                    R$ {(monthlyFreeCashflow + customResult.netMonthlyImpact).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                  </span>
                  <span className="tile-sub">Com seus ajustes de comportamento</span>
                </div>

                <div className="studio-metric-tile">
                  <span className="tile-label">Reserva Runway</span>
                  <span className="tile-value text-cyan">
                    {customResult.runwayBeforeMonths}m ➔ <strong>{customResult.runwayAfterMonths}m</strong>
                  </span>
                  <span className="tile-sub">Autonomia de sobrevivência</span>
                </div>
              </div>

              {/* Linha do Tempo Comparativa (12 Meses) */}
              <div className="projection-timeline-section mt-4">
                <div className="timeline-header-row">
                  <div>
                    <h5>Projeção de Caixa Comparativa (Próximos 12 Meses)</h5>
                    <span className="text-xs text-muted">
                      Compara seu saldo atual projetado (Baseline) com a curva deste Cenário
                    </span>
                  </div>
                  <div className="timeline-legend">
                    <span className="legend-item"><span className="legend-dot baseline"></span> Saldo Atual Projetado</span>
                    <span className="legend-item"><span className="legend-dot simulated"></span> Com Cenário + Comportamento</span>
                  </div>
                </div>

                <div className="timeline-bars-grid">
                  {customResult.projection12Months.map((p) => {
                    const maxVal = Math.max(...customResult.projection12Months.map((x) => Math.max(x.baselineBalance, x.simulatedBalance)), 80000);
                    const baselineHeight = Math.max((p.baselineBalance / maxVal) * 100, 10);
                    const simulatedHeight = Math.max((p.simulatedBalance / maxVal) * 100, 10);

                    return (
                      <div key={p.monthIndex} className={`timeline-bar-column ${p.isStressed ? 'stressed' : ''}`}>
                        <div className="bar-visual-pair">
                          <div
                            className="bar-fill bar-baseline"
                            style={{ height: `${baselineHeight}%` }}
                            title={`Baseline: R$ ${p.baselineBalance.toLocaleString('pt-BR')}`}
                          ></div>
                          <div
                            className={`bar-fill bar-simulated ${p.isStressed ? 'bar-danger' : ''}`}
                            style={{ height: `${simulatedHeight}%` }}
                            title={`Simulado: R$ ${p.simulatedBalance.toLocaleString('pt-BR')}`}
                          ></div>
                        </div>
                        <span className="timeline-month-label">{p.monthLabel}</span>
                        <span className="timeline-val-label">
                          R$ {Math.round(p.simulatedBalance / 1000)}k
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recomendações Táticas do Motor */}
              <div className="studio-recommendations-box mt-4">
                <h5>Recomendações do Guardião Financeiro:</h5>
                <ul>
                  {customResult.tacticalRecommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>

              {/* Botões de Ação */}
              <div className="studio-footer-actions mt-4">
                <button type="button" className="btn btn-outline" onClick={onClose}>
                  Fechar sem Salvar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleApplyScenario}
                >
                  <Plus size={16} />
                  <span>Efetivar Cenário no Meu Balder</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
