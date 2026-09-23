import React, { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import {
  Wallet,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Flag,
  MapPin,
  Zap,
} from 'lucide-react';
import type { SimulationPresetId } from '../types';
import { MonthlyProjectionGrid } from '../components/MonthlyProjectionGrid';
import { NatureBudgetGrid } from '../components/NatureBudgetGrid';
import { CheckpointSetupModal } from '../components/CheckpointSetupModal';
import { QuickActionsDropdown } from '../components/QuickActionsDropdown';

interface DashboardPageProps {
  onNavigateToMovements: () => void;
  onNavigateToGoals: () => void;
  onNavigateToCopilot: () => void;
  onNavigateToLoans?: () => void;
  onNavigateToNatures?: () => void;
  onOpenSimulation: (preset?: SimulationPresetId, mode?: 'PRESETS' | 'STUDIO') => void;
  onOpenPrepayment?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToMovements,
  onNavigateToGoals,
  onNavigateToCopilot,
  onNavigateToLoans,
  onNavigateToNatures,
  onOpenSimulation,
  onOpenPrepayment,
}) => {
  const {
    isDataReady,
    totalNetWorth,
    availableBalance,
    monthlyFreeCashflow,
    emergencyReserveMonths,
    emergencyReserveAmount,
    forecast30d,
    nextCriticalEvent,
    goals,
    activeCheckpoint,
  } = useFinancial();

  const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false);

  const mainGoal = goals[0];
  const goalPercent = mainGoal && mainGoal.targetAmount > 0
    ? Math.min(Math.round((mainGoal.currentAmount / mainGoal.targetAmount) * 100), 100)
    : 0;

  // Aguarda os dados do Supabase antes de renderizar para evitar flash de dados demo
  if (!isDataReady) {
    return (
      <div className="page-container animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(6,182,212,0.3)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Carregando dados financeiros...</span>
      </div>
    );
  }

  return (

    <div className="page-container animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <div className="kicker-badge" style={{ marginBottom: 0 }}>
              <span>DASHBOARD FINANCEIRO</span>
            </div>
            {activeCheckpoint && (
              <button
                onClick={() => setIsCheckpointModalOpen(true)}
                title="Clique para gerenciar ou criar novo marco de acompanhamento"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 transition-all cursor-pointer"
              >
                <MapPin size={12} className="text-indigo-400" />
                <span>
                  Marco desde <strong>{activeCheckpoint.startDate.split('-').reverse().join('/')}</strong>
                </span>
              </button>
            )}
          </div>
          <h1 className="page-title">Meu Dinheiro</h1>
          <p className="page-subtitle dashboard-page-subtitle">
            Sua visão consolidada de patrimônio, liquidez imediata e futuro projetado
          </p>
        </div>

        <div className="page-header-actions flex items-center gap-2">
          <QuickActionsDropdown
            onOpenSimulation={onOpenSimulation}
            onNavigateToLoans={onNavigateToLoans}
            onOpenPrepayment={onOpenPrepayment}
            onOpenCheckpoint={() => setIsCheckpointModalOpen(true)}
            size="sm"
          />
          <button className="btn btn-secondary" onClick={onNavigateToCopilot}>
            <Sparkles size={16} className="text-cyan" />
            <span>Consultar Forseti</span>
          </button>
        </div>
      </div>

      {/* Botão de Ponto de Partida: Aparece apenas se NÃO houver marco definido */}
      {!activeCheckpoint && (
        <div className="mb-5 flex items-center">
          <button
            type="button"
            onClick={() => setIsCheckpointModalOpen(true)}
            className="btn btn-primary text-xs py-2 px-4 shadow-lg flex items-center gap-2 cursor-pointer"
          >
            <Flag size={14} />
            <span>Definir Ponto de Partida</span>
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* SEÇÃO 1: COMO ESTOU                                            */}
      {/* ============================================================== */}
      <section className="dashboard-section">
        <div className="section-title-row">
          <div className="section-title-left">
            <span className="badge badge-cyan">SITUAÇÃO ATUAL</span>
            <h2 className="section-heading">Como Estou</h2>
          </div>
          <span className="section-help-text">Atualizado em tempo real com conciliação bancária</span>
        </div>

        <div className="metrics-grid-4">
          {/* Card 1: Patrimônio Líquido */}
          <div className="glass-card stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Patrimônio Líquido</span>
              <div className="stat-icon-wrapper cyan">
                <Wallet size={18} />
              </div>
            </div>
            <div className="stat-card-body">
              <span className="stat-card-value text-glow-cyan">
                {totalNetWorth.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <div className="stat-card-footer">
                <span className="trend-pill trend-up">
                  <ArrowUpRight size={13} /> +4.2% este mês
                </span>
                <span className="stat-subtext">
                  {activeCheckpoint && activeCheckpoint.initialNetWorth !== undefined
                    ? 'Ancorado no Marco'
                    : 'Consolidado B3 + Bancos'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Saldo Disponível */}
          <div className="glass-card stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Saldo Disponível (Caixa)</span>
              <div className="stat-icon-wrapper emerald">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="stat-card-body">
              <span className="stat-card-value text-glow-emerald">
                {availableBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <div className="stat-card-footer">
                <span className="stat-subtext">
                  {activeCheckpoint
                    ? (activeCheckpoint.label || 'Marco de Início Ativo')
                    : 'Nubank + Inter conta corrente'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Fluxo Livre Mensal */}
          <div className="glass-card stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Fluxo Livre Mensal</span>
              <div className="stat-icon-wrapper purple">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="stat-card-body">
              <span className={`stat-card-value ${monthlyFreeCashflow >= 0 ? 'text-cyan' : 'text-rose'}`}>
                {monthlyFreeCashflow >= 0 ? '+' : ''}
                {monthlyFreeCashflow.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                <span className="stat-unit">/mês</span>
              </span>
              <div className="stat-card-footer">
                <span className="stat-subtext">Capacidade de aporte poupança</span>
              </div>
            </div>
          </div>

          {/* Card 4: Reserva de Emergência */}
          <div className="glass-card stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Reserva de Emergência</span>
              <div className="stat-icon-wrapper amber">
                <Clock size={18} />
              </div>
            </div>
            <div className="stat-card-body">
              <span className="stat-card-value text-amber">
                {emergencyReserveMonths} meses
                <span className="stat-unit">({emergencyReserveAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>
              </span>
              <div className="stat-card-footer">
                <span className="trend-pill trend-safe">✓ Nível Seguro &gt; 6m</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SEÇÃO 2: O QUE VAI ACONTECER (30 DIAS)                         */}
      {/* ============================================================== */}
      <section className="dashboard-section">
        <div className="section-title-row">
          <div className="section-title-left">
            <span className="badge badge-purple">PROJEÇÃO PROSPECTIVA</span>
            <h2 className="section-heading">O Que Vai Acontecer</h2>
          </div>
          <button className="link-button" onClick={onNavigateToMovements}>
            Ver todas as movimentações e filtros →
          </button>
        </div>

        <div className="cashflow-projection-card glass-card">
          <div className="projection-grid-4">
            <div className="projection-col">
              <div className="proj-label-row">
                <span className="proj-icon text-emerald">↓</span>
                <span className="proj-label">A RECEBER</span>
              </div>
              <span className="proj-value text-emerald">
                +{forecast30d.income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <span className="proj-subtext">Salários & Proventos previstos</span>
            </div>

            <div className="projection-col">
              <div className="proj-label-row">
                <span className="proj-icon text-rose">↑</span>
                <span className="proj-label">A PAGAR (TOTAL)</span>
              </div>
              <span className="proj-value text-rose">
                -{forecast30d.expenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <span className="proj-subtext">Contas fixas, faturas e empréstimos</span>
            </div>

            <div className="projection-col">
              <div className="proj-label-row">
                <span className="proj-icon text-cyan">±</span>
                <span className="proj-label">RESULTADO LÍQUIDO 30D</span>
              </div>
              <span className={`proj-value ${forecast30d.net >= 0 ? 'text-cyan' : 'text-rose'}`}>
                {forecast30d.net >= 0 ? '+' : ''}
                {forecast30d.net.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <span className="proj-subtext">Saldo gerado no ciclo</span>
            </div>

            <div className="projection-col highlighted-col">
              <div className="proj-label-row">
                <span className="proj-icon text-amber">🏛️</span>
                <span className="proj-label">SALDO PROJETADO EM 30 DIAS</span>
              </div>
              <span className="proj-value text-white font-bold">
                {forecast30d.projectedBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <span className="proj-subtext">Caixa final estimado com folga</span>
            </div>
          </div>
        </div>
      </section>

      {/* Grid Duplo: Próximo Evento Crítico + Minhas Metas */}
      <div className="dashboard-split-grid">
        {/* ============================================================== */}
        {/* SEÇÃO 3: PRÓXIMO EVENTO CRÍTICO                                */}
        {/* ============================================================== */}
        <section className="dashboard-section flex-1">
          <div className="section-title-row">
            <div className="section-title-left">
              <span className="badge badge-rose">ATENÇÃO IMEDIATA</span>
              <h2 className="section-heading">Próximo Evento Crítico</h2>
            </div>
          </div>

          {nextCriticalEvent ? (
            <div className="critical-card glass-card">
              <div className="critical-header">
                <div className="critical-alert-icon">
                  <ShieldAlert size={22} className="text-rose" />
                </div>
                <div className="critical-details">
                  <h3 className="critical-title">{nextCriticalEvent.title}</h3>
                  <span className="critical-entity">Entidade: {nextCriticalEvent.relatedEntity || 'Bancário'}</span>
                </div>
                <div className="countdown-pill">
                  <span className="countdown-num">{nextCriticalEvent.daysRemaining}</span>
                  <span className="countdown-label">dias restantes</span>
                </div>
              </div>

              <div className="critical-amount-row">
                <span className="critical-amount-label">Valor do Evento:</span>
                <span className="critical-amount-val text-rose">
                  {nextCriticalEvent.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>

              <div className="critical-action-box">
                <span className="action-tag">AÇÃO RECOMENDADA:</span>
                <p className="action-desc">{nextCriticalEvent.recommendedAction}</p>
              </div>
            </div>
          ) : (
            <div className="glass-card safe-state-card">
              <CheckCircle2 size={28} className="text-emerald" />
              <h4>Nenhum risco financeiro detectado para os próximos 15 dias.</h4>
              <p>Seu fluxo de caixa está perfeitamente equilibrado.</p>
            </div>
          )}
        </section>

        {/* ============================================================== */}
        {/* SEÇÃO 4: MINHAS METAS                                          */}
        {/* ============================================================== */}
        <section className="dashboard-section flex-1">
          <div className="section-title-row">
            <div className="section-title-left">
              <span className="badge badge-emerald">OBJETIVOS</span>
              <h2 className="section-heading">Minhas Metas</h2>
            </div>
            <button className="link-button" onClick={onNavigateToGoals}>
              Ver todas as metas →
            </button>
          </div>

          {mainGoal ? (
            <div className="goal-featured-card glass-card">
              <div className="goal-featured-header">
                <div className="goal-icon-title">
                  <span className="goal-symbol">{mainGoal.icon}</span>
                  <div>
                    <h3 className="goal-featured-name">{mainGoal.title}</h3>
                    <span className="goal-category-tag">{mainGoal.category}</span>
                  </div>
                </div>
                <span className="goal-percent-badge">{goalPercent}%</span>
              </div>

              {/* Progress Bar */}
              <div className="goal-progress-track">
                <div className="goal-progress-fill" style={{ width: `${goalPercent}%` }}></div>
              </div>

              <div className="goal-values-row">
                <span>
                  Atual: <strong>{mainGoal.currentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </span>
                <span>
                  Alvo: <strong>{mainGoal.targetAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </span>
              </div>

              <div className="goal-meta-grid">
                <div className="goal-meta-item">
                  <span className="goal-meta-label">APORTE MENSAL</span>
                  <span className="goal-meta-val text-emerald">
                    +{mainGoal.monthlyContribution.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                  </span>
                </div>

                <div className="goal-meta-item">
                  <span className="goal-meta-label">PREVISÃO ESTIMADA</span>
                  <span className="goal-meta-val text-cyan">{mainGoal.targetDate}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card safe-state-card" style={{ padding: '24px', textAlign: 'center' }}>
              <CheckCircle2 size={24} className="text-emerald" style={{ margin: '0 auto 8px' }} />
              <h4 style={{ fontSize: '13px', marginBottom: '4px' }}>Nenhuma meta cadastrada</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Defina seus objetivos financeiros e acompanhe a evolução do seu patrimônio.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ============================================================== */}
      {/* SEÇÃO NOBRE: GRID DE PROJEÇÃO ORÇAMENTÁRIA MÊS A MÊS          */}
      {/* ============================================================== */}
      <section className="dashboard-section">
        <MonthlyProjectionGrid />
      </section>

      {/* ============================================================== */}
      {/* SEÇÃO NOBRE: GRID DE NATUREZAS (PREVISTO vs REALIZADO)         */}
      {/* ============================================================== */}
      <section className="dashboard-section">
        <NatureBudgetGrid onNavigateToNatures={onNavigateToNatures} />
      </section>

      {/* ============================================================== */}
      {/* SEÇÃO 4: SIMULAÇÃO DE CENÁRIOS E DECISÕES (AÇÕES RÁPIDAS)      */}
      {/* ============================================================== */}
      <section className="dashboard-section">
        <div className="glass-card quick-actions-panel p-4 md:p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 via-cyan-500/20 to-indigo-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
              <Zap size={22} className="text-amber-400 fill-amber-400/20" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="badge badge-amber text-[10px] uppercase font-bold tracking-wider">
                  TOMADA DE DECISÃO
                </span>
                <span className="text-xs text-muted">Simulações & Planejamento</span>
              </div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                Simulador de Cenários Futuros & Ações Rápidas
              </h3>
              <p className="text-xs text-muted mt-0.5 max-w-xl">
                Simule compra de bens (carro/imóvel), contratação de empréstimos, quitação antecipada com deságio e estúdio avançado de cenários futuros.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <QuickActionsDropdown
              onOpenSimulation={onOpenSimulation}
              onNavigateToLoans={onNavigateToLoans}
              onOpenPrepayment={onOpenPrepayment}
              onOpenCheckpoint={() => setIsCheckpointModalOpen(true)}
              buttonLabel="Ações Rápidas"
              size="lg"
            />
          </div>
        </div>
      </section>

      {/* Modal de Configuração do Marco de Acompanhamento */}
      <CheckpointSetupModal
        isOpen={isCheckpointModalOpen}
        onClose={() => setIsCheckpointModalOpen(false)}
        isInitialSetup={!activeCheckpoint}
      />
    </div>
  );
};
