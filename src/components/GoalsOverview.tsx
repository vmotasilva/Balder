import React from 'react';
import { CheckCircle2, Target } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';

/** Metas em cartões (progresso, aporte mensal e previsão): usado no Início, na aba Metas. */
export const GoalsOverview: React.FC<{ onNavigateToGoals: () => void }> = ({ onNavigateToGoals }) => {
  const { goals } = useFinancial();
  return (
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
  );
};
