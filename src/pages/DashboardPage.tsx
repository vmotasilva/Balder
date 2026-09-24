import React, { useState, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import {
  Wallet,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  MapPin,
  Calendar,
  Layers,
  Target,
} from 'lucide-react';
import type { SimulationPresetId } from '../types';

export type DashboardTab = 'PROJECAO_MES' | 'PROJECAO_TOTAL' | 'NATUREZAS' | 'METAS';
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
  onOpenOnboarding?: (stepIndex?: number) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToMovements,
  onNavigateToGoals,
  onNavigateToCopilot,
  onNavigateToLoans,
  onNavigateToNatures,
  onOpenSimulation,
  onOpenPrepayment,
  onOpenOnboarding,
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
  const [activeSection, setActiveSection] = useState<DashboardTab>('PROJECAO_MES');

  // Cálculo real do crescimento patrimonial relativo ao marco inicial (evita exibir dados estáticos/falsos)
  const netWorthGrowth = useMemo(() => {
    if (
      !activeCheckpoint ||
      activeCheckpoint.initialNetWorth === undefined ||
      activeCheckpoint.initialNetWorth <= 0 ||
      totalNetWorth === 0
    ) {
      return null;
    }
    const diff = totalNetWorth - activeCheckpoint.initialNetWorth;
    if (Math.abs(diff) < 0.01) return null;
    const pct = (diff / activeCheckpoint.initialNetWorth) * 100;
    return {
      diff,
      pct,
      isPositive: diff >= 0,
    };
  }, [activeCheckpoint, totalNetWorth]);

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
      <div className="page-header dashboard-page-header">
        <div className="dashboard-header-title-box">
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
            {onOpenOnboarding && (
              <button
                onClick={() => onOpenOnboarding(1)}
                title="Refazer assistente Get Started de calibração inicial"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer"
              >
                <Sparkles size={12} className="text-cyan-400" />
                <span>Get Started</span>
              </button>
            )}
          </div>
          <h1 className="page-title dashboard-page-title">Meu Dinheiro</h1>
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
            onOpenOnboarding={onOpenOnboarding}
            size="sm"
          />
          <button className="btn btn-secondary" onClick={onNavigateToCopilot}>
            <Sparkles size={16} className="text-cyan" />
            <span>Consultar Forseti</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SEÇÃO 1: COMO ESTOU                                            */}
      {/* ============================================================== */}
      <section className="dashboard-section">


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
                {netWorthGrowth && (
                  <span className={`trend-pill ${netWorthGrowth.isPositive ? 'trend-up' : 'trend-down'}`}>
                    {netWorthGrowth.isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {netWorthGrowth.isPositive ? '+' : ''}{netWorthGrowth.pct.toFixed(1)}% este mês
                  </span>
                )}
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
                {emergencyReserveMonths >= 6 ? (
                  <span className="trend-pill trend-safe">✓ Nível Seguro &gt; 6m</span>
                ) : emergencyReserveMonths > 0 ? (
                  <span className="trend-pill trend-warning">⚠️ {emergencyReserveMonths}m de cobertura</span>
                ) : (
                  <span className="stat-subtext">Sem reserva configurada</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SELETOR PRINCIPAL DE SEÇÕES (TABS INTERATIVAS)                 */}
      {/* ============================================================== */}
      <div className="dashboard-tabs-container">
        <div className="dashboard-tabs-nav" role="tablist" aria-label="Seções do Dashboard">
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'PROJECAO_MES'}
            className={`dashboard-tab-btn ${activeSection === 'PROJECAO_MES' ? 'active' : ''}`}
            onClick={() => setActiveSection('PROJECAO_MES')}
          >
            <Calendar size={18} />
            <span>Projeção do Mês</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'PROJECAO_TOTAL'}
            className={`dashboard-tab-btn ${activeSection === 'PROJECAO_TOTAL' ? 'active' : ''}`}
            onClick={() => setActiveSection('PROJECAO_TOTAL')}
          >
            <TrendingUp size={18} />
            <span>Projeção Total</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'NATUREZAS'}
            className={`dashboard-tab-btn ${activeSection === 'NATUREZAS' ? 'active' : ''}`}
            onClick={() => setActiveSection('NATUREZAS')}
          >
            <Layers size={18} />
            <span>Naturezas</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'METAS'}
            className={`dashboard-tab-btn ${activeSection === 'METAS' ? 'active' : ''}`}
            onClick={() => setActiveSection('METAS')}
          >
            <Target size={18} />
            <span>Metas</span>
            {goals.length > 0 && (
              <span className="dashboard-tab-badge">{goals.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* CONTEÚDO 1: PROJEÇÃO DO MÊS (30 DIAS + EVENTO CRÍTICO)         */}
      {/* ============================================================== */}
      {activeSection === 'PROJECAO_MES' && (
        <div key="projecao-mes" className="dashboard-tab-content animate-fade-in">
          {/* Seção O Que Vai Acontecer (30 Dias) */}
          <section className="dashboard-section">
            <div className="section-title-row">
              <div className="section-title-left">
                <span className="badge badge-purple">PROJEÇÃO PROSPECTIVA</span>
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

          {/* Seção Próximo Evento Crítico */}
          <section className="dashboard-section">
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
        </div>
      )}

      {/* ============================================================== */}
      {/* CONTEÚDO 2: PROJEÇÃO TOTAL (GRID ORÇAMENTÁRIA MÊS A MÊS)       */}
      {/* ============================================================== */}
      {activeSection === 'PROJECAO_TOTAL' && (
        <div key="projecao-total" className="dashboard-tab-content animate-fade-in">
          <section className="dashboard-section">
            <MonthlyProjectionGrid />
          </section>
        </div>
      )}

      {/* ============================================================== */}
      {/* CONTEÚDO 3: NATUREZAS (PREVISTO vs REALIZADO & TETOS)          */}
      {/* ============================================================== */}
      {activeSection === 'NATUREZAS' && (
        <div key="naturezas" className="dashboard-tab-content animate-fade-in">
          <section className="dashboard-section">
            <NatureBudgetGrid onNavigateToNatures={onNavigateToNatures} />
          </section>
        </div>
      )}

      {/* ============================================================== */}
      {/* CONTEÚDO 4: METAS                                              */}
      {/* ============================================================== */}
      {activeSection === 'METAS' && (
        <div key="metas" className="dashboard-tab-content animate-fade-in">
          <section className="dashboard-section">
            <div className="section-title-row">
              <div className="section-title-left">
                <span className="badge badge-emerald">OBJETIVOS</span>
                <h2 className="section-heading">Minhas Metas</h2>
              </div>
              <button className="link-button" onClick={onNavigateToGoals}>
                Ver todas as metas →
              </button>
            </div>

            {goals && goals.length > 0 ? (
              <div className="goals-cards-grid" style={{ gridTemplateColumns: goals.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))' }}>
                {goals.map((goal) => {
                  const percent = goal.targetAmount > 0
                    ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100)
                    : 0;

                  return (
                    <div key={goal.id} className="goal-featured-card glass-card">
                      <div className="goal-featured-header">
                        <div className="goal-icon-title">
                          <span className="goal-symbol">{goal.icon}</span>
                          <div>
                            <h3 className="goal-featured-name">{goal.title}</h3>
                            <span className="goal-category-tag">{goal.category}</span>
                          </div>
                        </div>
                        <span className="goal-percent-badge">{percent}%</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="goal-progress-track">
                        <div className="goal-progress-fill" style={{ width: `${percent}%`, backgroundColor: goal.color || 'var(--accent-emerald)' }}></div>
                      </div>

                      <div className="goal-values-row">
                        <span>
                          Atual: <strong>{goal.currentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                        </span>
                        <span>
                          Alvo: <strong>{goal.targetAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                        </span>
                      </div>

                      <div className="goal-meta-grid">
                        <div className="goal-meta-item">
                          <span className="goal-meta-label">APORTE MENSAL</span>
                          <span className="goal-meta-val text-emerald">
                            +{goal.monthlyContribution.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                          </span>
                        </div>

                        <div className="goal-meta-item">
                          <span className="goal-meta-label">PREVISÃO ESTIMADA</span>
                          <span className="goal-meta-val text-cyan">{goal.targetDate}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass-card safe-state-card" style={{ padding: '36px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <CheckCircle2 size={32} className="text-emerald" />
                <h4 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Nenhuma meta cadastrada</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, maxWidth: '420px' }}>
                  Defina seus objetivos financeiros, acompanhe a evolução do seu patrimônio e projete quando atingirá sua independência.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onNavigateToGoals}
                  style={{ marginTop: '8px' }}
                >
                  <Target size={16} />
                  <span>Cadastrar Primeira Meta</span>
                </button>
              </div>
            )}
          </section>
        </div>
      )}



      {/* Modal de Configuração do Marco de Acompanhamento */}
      <CheckpointSetupModal
        isOpen={isCheckpointModalOpen}
        onClose={() => setIsCheckpointModalOpen(false)}
        isInitialSetup={!activeCheckpoint}
      />
    </div>
  );
};
