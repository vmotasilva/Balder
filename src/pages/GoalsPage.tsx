import React from 'react';
import { useFinancial } from '../context/FinancialContext';
import { Plus, Sparkles, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export const GoalsPage: React.FC = () => {
  const { goals, monthlyFreeCashflow } = useFinancial();

  const handleCelebrate = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const handleAcceptRecommendations = () => {
    handleCelebrate();
    alert('Recomendações Automáticas Aceitas! O motor do BALDER reprogramou aportes mensais adicionais no seu fluxo de caixa para acelerar suas metas em 4 meses.');
  };

  const handleGenerateExecutionPlan = () => {
    alert('Plano de Execução Gerado! Foi criado um cronograma passo a passo detalhando o aporte de R$ 2.500/mês para a Reserva e R$ 1.800/mês para Quitação da Dívida.');
  };

  const handleRecalculateScenarios = () => {
    alert('Cenários Recalculados com Sucesso! Com base no seu fluxo livre atual (+R$ 4.250/mês), todas as suas 3 metas principais permanecem 100% atingíveis.');
  };

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="kicker-badge">
            <span>METAS & INDEPENDÊNCIA</span>
          </div>
          <h1 className="page-title">Minhas Metas</h1>
          <p className="page-subtitle">Acompanhamento de objetivos, prazos, aportes necessários e planos de aceleração</p>
        </div>

        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => alert('Modal para criar nova meta personalizada.')}>
            <Plus size={16} />
            <span>Nova Meta</span>
          </button>
        </div>
      </div>

      {/* Integration & Acceleration Banner */}
      <div className="goals-acceleration-banner glass-card">
        <div className="acceleration-info">
          <div className="accel-badge">
            <Sparkles size={16} className="text-cyan" />
            <span>CAPACIDADE DE POUPANÇA: +R$ {monthlyFreeCashflow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</span>
          </div>
          <h3>Integração com Fluxo Projetado & Aceleração de Metas</h3>
          <p>Seu fluxo livre de caixa permite acelerar a conclusão das suas metas prioritárias sem comprometer a sua reserva operacional.</p>
        </div>

        <div className="acceleration-actions">
          <button className="btn btn-secondary" onClick={handleAcceptRecommendations}>
            <CheckCircle2 size={16} className="text-emerald" />
            <span>Aceitar Recomendações</span>
          </button>

          <button className="btn btn-secondary" onClick={handleGenerateExecutionPlan}>
            <FileText size={16} className="text-cyan" />
            <span>Gerar Plano</span>
          </button>

          <button className="btn btn-outline" onClick={handleRecalculateScenarios}>
            <RefreshCw size={16} />
            <span>Recalcular Cenários</span>
          </button>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="goals-cards-grid">
        {goals.map((goal) => {
          const percent = Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100);

          return (
            <div key={goal.id} className="goal-detail-card glass-card">
              <div className="goal-detail-header">
                <div className="goal-icon-tag">
                  <span className="goal-card-emoji">{goal.icon}</span>
                  <div>
                    <h3 className="goal-card-title">{goal.title}</h3>
                    <span className="goal-card-category">{goal.category}</span>
                  </div>
                </div>
                <div className="goal-percent-circle">
                  <span>{percent}%</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="goal-progress-bar-container">
                <div className="goal-progress-bar-fill" style={{ width: `${percent}%`, backgroundColor: goal.color }}></div>
              </div>

              {/* Values Breakdown */}
              <div className="goal-detail-values">
                <div className="val-group">
                  <span className="val-label">Valor Atual</span>
                  <span className="val-number">
                    {goal.currentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>

                <div className="val-group text-right">
                  <span className="val-label">Valor Alvo</span>
                  <span className="val-number">
                    {goal.targetAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              <div className="goal-card-footer">
                <div className="goal-footer-metric">
                  <span className="metric-title">Aporte Mensal:</span>
                  <span className="metric-data text-emerald">
                    +{goal.monthlyContribution.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                  </span>
                </div>

                <div className="goal-footer-metric text-right">
                  <span className="metric-title">Prazo Estimado:</span>
                  <span className="metric-data text-cyan">{goal.targetDate}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
