import React from 'react';
import { useFinancial } from '../context/FinancialContext';
import {
  Wallet,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  ArrowUpRight,
  Clock,
  Car,
  CheckCircle2,
  CreditCard,
  Home,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigateToMovements: () => void;
  onNavigateToGoals: () => void;
  onNavigateToCopilot: () => void;
  onOpenSimulation: (preset: 'CARRO' | 'QUITAR_DIVIDA' | 'FINANCIAMENTO' | 'IMOVEL') => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToMovements,
  onNavigateToGoals,
  onNavigateToCopilot,
  onOpenSimulation,
}) => {
  const {
    totalNetWorth,
    availableBalance,
    monthlyFreeCashflow,
    emergencyReserveMonths,
    emergencyReserveAmount,
    forecast30d,
    nextCriticalEvent,
    goals,
  } = useFinancial();

  const mainGoal = goals[0];
  const goalPercent = mainGoal ? Math.min(Math.round((mainGoal.currentAmount / mainGoal.targetAmount) * 100), 100) : 85;

  return (
    <div className="page-container animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="kicker-badge">
            <span>DASHBOARD FINANCEIRO</span>
          </div>
          <h1 className="page-title">Meu Dinheiro</h1>
          <p className="page-subtitle">Sua visão consolidada de patrimônio, liquidez imediata e futuro projetado</p>
        </div>

        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={onNavigateToCopilot}>
            <Sparkles size={16} className="text-cyan" />
            <span>Consultar Copilot</span>
          </button>
        </div>
      </div>

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
                <span className="stat-subtext">Consolidado B3 + Bancos</span>
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
                <span className="stat-subtext">Nubank + Inter conta corrente</span>
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

          {mainGoal && (
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
          )}
        </section>
      </div>

      {/* ============================================================== */}
      {/* SEÇÃO 5: SIMULAÇÕES RÁPIDAS DE DECISÃO                         */}
      {/* ============================================================== */}
      <section className="dashboard-section">
        <div className="section-title-row">
          <div className="section-title-left">
            <span className="badge badge-amber">TOMADA DE DECISÃO</span>
            <h2 className="section-heading">Simulações Rápidas</h2>
          </div>
          <span className="section-help-text">Simule antes de comprar para proteger sua reserva e seu fluxo</span>
        </div>

        <div className="simulations-shortcuts-grid">
          <button className="sim-shortcut-card glass-card" onClick={() => onOpenSimulation('CARRO')}>
            <div className="sim-shortcut-icon">
              <Car size={24} className="text-cyan" />
            </div>
            <div className="sim-shortcut-info">
              <h4>Comprar Carro</h4>
              <p>Simular entrada, parcelamento e impacto na reserva</p>
            </div>
            <span className="sim-arrow">→</span>
          </button>

          <button className="sim-shortcut-card glass-card" onClick={() => onOpenSimulation('QUITAR_DIVIDA')}>
            <div className="sim-shortcut-icon">
              <CheckCircle2 size={24} className="text-emerald" />
            </div>
            <div className="sim-shortcut-info">
              <h4>Quitar Empréstimo</h4>
              <p>Calcular economia de juros a valor presente</p>
            </div>
            <span className="sim-arrow">→</span>
          </button>

          <button className="sim-shortcut-card glass-card" onClick={() => onOpenSimulation('FINANCIAMENTO')}>
            <div className="sim-shortcut-icon">
              <CreditCard size={24} className="text-amber" />
            </div>
            <div className="sim-shortcut-info">
              <h4>Novo Financiamento</h4>
              <p>Verificar comprometimento de renda e limite seguro</p>
            </div>
            <span className="sim-arrow">→</span>
          </button>

          <button className="sim-shortcut-card glass-card" onClick={() => onOpenSimulation('IMOVEL')}>
            <div className="sim-shortcut-icon">
              <Home size={24} className="text-purple" />
            </div>
            <div className="sim-shortcut-info">
              <h4>Comprar Imóvel</h4>
              <p>Avaliar viabilidade de entrada alta e parcelas SAC</p>
            </div>
            <span className="sim-arrow">→</span>
          </button>
        </div>
      </section>
    </div>
  );
};
