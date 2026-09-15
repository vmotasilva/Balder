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

export const SimulationModal: React.FC<SimulationModalProps> = ({
  isOpen,
  onClose,
  initialPreset = 'CARRO',
  initialMode = 'PRESETS',
}) => {
  const {
    runSimulation,
    simulateCustomFutureScenario,
    applyScenarioToBudget,
    monthlyFreeCashflow,
  } = useFinancial();

  const [activeMode, setActiveMode] = useState<'PRESETS' | 'STUDIO'>(initialMode);

  // Modo 1: Presets Rápidos
  const [selectedPreset, setSelectedPreset] = useState<SimulationPresetId>(initialPreset);
  const presetScenario = runSimulation(selectedPreset);

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
      title={activeMode === 'STUDIO' ? 'Estúdio de Cenários Futuros' : 'Simulador de Decisões'}
      subtitle={
        activeMode === 'STUDIO'
          ? 'Projete créditos, direcione o recurso e defina o comportamento orçamentário com projeção de 12 meses'
          : 'Teste o impacto patrimonial e de liquidez antes de assumir compromissos'
      }
      maxWidth={activeMode === 'STUDIO' ? '880px' : '720px'}
    >
      <div className="simulation-modal-content">
        {/* Top Dual Mode Switcher */}
        <div className="sim-mode-switcher">
          <button
            className={`sim-mode-btn ${activeMode === 'PRESETS' ? 'active' : ''}`}
            onClick={() => setActiveMode('PRESETS')}
          >
            <Sparkles size={16} />
            <span>Decisões Rápidas (Presets)</span>
          </button>

          <button
            className={`sim-mode-btn ${activeMode === 'STUDIO' ? 'active' : ''}`}
            onClick={() => setActiveMode('STUDIO')}
          >
            <Sliders size={16} />
            <span>Estúdio de Cenários Futuros (Avançado)</span>
            <span className="badge badge-cyan" style={{ fontSize: '9px', padding: '2px 6px' }}>NOVO</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* MODO 1: PRESETS RÁPIDOS                                         */}
        {/* ============================================================== */}
        {activeMode === 'PRESETS' && (
          <div className="presets-mode-wrapper animate-fade-in">
            {/* Presets Selector Grid */}
            <div className="simulation-presets-grid">
              <button
                className={`sim-preset-btn ${selectedPreset === 'CARRO' ? 'active' : ''}`}
                onClick={() => setSelectedPreset('CARRO')}
              >
                <Car size={20} />
                <span>Comprar Carro</span>
              </button>

              <button
                className={`sim-preset-btn ${selectedPreset === 'QUITAR_DIVIDA' ? 'active' : ''}`}
                onClick={() => setSelectedPreset('QUITAR_DIVIDA')}
              >
                <CheckCircle2 size={20} />
                <span>Quitar Dívida</span>
              </button>

              <button
                className={`sim-preset-btn ${selectedPreset === 'NOVO_EMPRESTIMO' ? 'active' : ''}`}
                onClick={() => setSelectedPreset('NOVO_EMPRESTIMO')}
              >
                <Banknote size={20} />
                <span>Novo Empréstimo</span>
              </button>

              <button
                className={`sim-preset-btn ${selectedPreset === 'FINANCIAMENTO' ? 'active' : ''}`}
                onClick={() => setSelectedPreset('FINANCIAMENTO')}
              >
                <CreditCard size={20} />
                <span>Novo Financiamento</span>
              </button>

              <button
                className={`sim-preset-btn ${selectedPreset === 'IMOVEL' ? 'active' : ''}`}
                onClick={() => setSelectedPreset('IMOVEL')}
              >
                <Home size={20} />
                <span>Comprar Imóvel</span>
              </button>
            </div>

            {/* Verdict Box */}
            <div className="scenario-card glass-card">
              <div className="scenario-header">
                <div>
                  <h4 className="scenario-title">{presetScenario.title}</h4>
                  <p className="scenario-desc">{presetScenario.description}</p>
                </div>
                {getVerdictBadge(presetScenario.verdict)}
              </div>

              {/* Impact Metrics Grid */}
              <div className="scenario-metrics-grid">
                <div className="metric-box">
                  <span className="metric-box-label">
                    {presetScenario.initialOutflow < 0 ? 'Captação em Caixa' : 'Desembolso Inicial'}
                  </span>
                  <span className={`metric-box-value ${presetScenario.initialOutflow < 0 ? 'text-emerald' : presetScenario.initialOutflow > 0 ? 'text-amber' : ''}`}>
                    {presetScenario.initialOutflow < 0
                      ? `+ ${Math.abs(presetScenario.initialOutflow).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                      : presetScenario.initialOutflow > 0
                      ? `- ${presetScenario.initialOutflow.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                      : 'R$ 0,00'}
                  </span>
                </div>

                <div className="metric-box">
                  <span className="metric-box-label">Impacto Mensal no Fluxo</span>
                  <span className={`metric-box-value ${presetScenario.monthlyCost > 0 ? 'text-rose' : 'text-emerald'}`}>
                    {presetScenario.monthlyCost > 0
                      ? `- ${presetScenario.monthlyCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês`
                      : `+ ${Math.abs(presetScenario.monthlyCost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês`}
                  </span>
                </div>

                <div className="metric-box">
                  <span className="metric-box-label">Reserva Runway</span>
                  <span className="metric-box-value">
                    {presetScenario.runwayBeforeMonths}m ➔ <strong className="text-cyan">{presetScenario.runwayAfterMonths}m</strong>
                  </span>
                </div>
              </div>

              {/* Explanation Text */}
              <div className="scenario-explanation">
                <h5>Diagnóstico do Motor Financeiro:</h5>
                <p>{presetScenario.explanation}</p>
              </div>

              {/* Action Recommendations */}
              <div className="scenario-recommendations">
                <h5>Recomendações Táticas:</h5>
                <ul>
                  {presetScenario.actionRecommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>

              <div className="scenario-footer-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveMode('STUDIO')}
                >
                  <Sliders size={14} />
                  <span>Personalizar no Estúdio Avançado</span>
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
                  Entendido
                </button>
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
