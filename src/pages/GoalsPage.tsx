import React, { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { Plus, RefreshCw, FileText, CheckCircle2, Archive, Ban, RotateCcw, Trash2, Pause, Play } from 'lucide-react';
import { ResumeGoalModal } from '../components/ResumeGoalModal';
import confetti from 'canvas-confetti';
import { NewGoalModal } from '../components/NewGoalModal';
import { Modal } from '../components/Modal';
import { ConfirmDialog, useConfirmDialog } from '../components/ConfirmDialog';
import type { Goal } from '../types';

type GoalFilter = 'ATIVAS' | 'PAUSADA' | 'ARQUIVADA' | 'CANCELADA';

export const GoalsPage: React.FC = () => {
  const { goals, goalStatuses, setGoalStatus, deleteGoal } = useFinancial();
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [filter, setFilter] = useState<GoalFilter>('ATIVAS');
  const [cancelingGoal, setCancelingGoal] = useState<Goal | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [resumingGoal, setResumingGoal] = useState<Goal | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const statusOf = (g: Goal) => goalStatuses[g.id]?.status;
  const counts = {
    ATIVAS: goals.filter((g) => !statusOf(g)).length,
    PAUSADA: goals.filter((g) => statusOf(g) === 'PAUSADA').length,
    ARQUIVADA: goals.filter((g) => statusOf(g) === 'ARQUIVADA').length,
    CANCELADA: goals.filter((g) => statusOf(g) === 'CANCELADA').length,
  };
  const visibleGoals = goals.filter((g) => (filter === 'ATIVAS' ? !statusOf(g) : statusOf(g) === filter));

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
          <button className="btn btn-primary" onClick={() => setIsNewGoalOpen(true)}>
            <Plus size={16} />
            <span>Nova Meta</span>
          </button>
        </div>
      </div>

      {/* Integration & Acceleration Actions */}
      <div className="goals-acceleration-banner glass-card">
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

      {/* Filtro: ativas, arquivadas, canceladas */}
      {(counts.PAUSADA > 0 || counts.ARQUIVADA > 0 || counts.CANCELADA > 0) && (
        <div className="pill-selector goals-filter mb-4" role="tablist">
          {([
            ['ATIVAS', `Ativas (${counts.ATIVAS})`],
            ['PAUSADA', `Pausadas (${counts.PAUSADA})`],
            ['ARQUIVADA', `Arquivadas (${counts.ARQUIVADA})`],
            ['CANCELADA', `Canceladas (${counts.CANCELADA})`],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className={`pill-btn ${filter === id ? 'active' : ''}`} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {filter !== 'ATIVAS' && visibleGoals.length === 0 && (
        <p className="text-sm text-muted mb-4">
          Nenhuma meta {filter === 'PAUSADA' ? 'pausada' : filter === 'ARQUIVADA' ? 'arquivada' : 'cancelada'}.
        </p>
      )}

      {/* Goals Grid */}
      {goals.length === 0 && (
        <div className="glass-card text-center" style={{ padding: '2rem 1rem' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Você ainda não tem metas. Crie a primeira para acompanhar quanto falta e quanto guardar por mês.
          </p>
          <button className="btn btn-primary btn-sm mt-3" onClick={() => setIsNewGoalOpen(true)}>
            <Plus size={14} />
            <span>Criar primeira meta</span>
          </button>
        </div>
      )}
      <div className="goals-cards-grid">
        {visibleGoals.map((goal) => {
          const percent =
            goal.targetAmount > 0 ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100) : 0;

          return (
            <div key={goal.id} className={`goal-detail-card glass-card ${statusOf(goal) ? 'is-closed' : ''}`}>
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

              {goalStatuses[goal.id] && (
                <p className="goal-status-note">
                  {goalStatuses[goal.id].status === 'CANCELADA'
                    ? 'Cancelada'
                    : goalStatuses[goal.id].status === 'PAUSADA'
                    ? 'Pausada'
                    : 'Arquivada'}{' '}
                  em{' '}
                  {new Date(goalStatuses[goal.id].at).toLocaleDateString('pt-BR')}
                  {goalStatuses[goal.id].reason ? `: ${goalStatuses[goal.id].reason}` : '.'}
                </p>
              )}

              <div className="goal-card-actions">
                {statusOf(goal) === 'PAUSADA' ? (
                  <button type="button" className="btn btn-primary btn-xs" onClick={() => setResumingGoal(goal)}>
                    <Play size={13} />
                    <span>Retomar</span>
                  </button>
                ) : statusOf(goal) ? (
                  <button type="button" className="btn btn-outline btn-xs" onClick={() => setGoalStatus(goal.id, null)}>
                    <RotateCcw size={13} />
                    <span>Reativar</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => setGoalStatus(goal.id, { status: 'PAUSADA', at: new Date().toISOString() })}
                      title="Parar os aportes por um tempo; ao retomar, o sistema reajusta prazo ou aporte"
                    >
                      <Pause size={13} />
                      <span>Pausar</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => setGoalStatus(goal.id, { status: 'ARQUIVADA', at: new Date().toISOString() })}
                      title="Tirar da lista de ativas sem apagar"
                    >
                      <Archive size={13} />
                      <span>Arquivar</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => {
                        setCancelReason('');
                        setCancelingGoal(goal);
                      }}
                      title="Desistir da meta, registrando o motivo"
                    >
                      <Ban size={13} />
                      <span>Cancelar</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn btn-outline btn-xs goal-delete-btn"
                  onClick={() =>
                    confirm({
                      title: 'Excluir meta',
                      message: `Excluir "${goal.title}" apaga a meta e o histórico dela. Isso não pode ser desfeito.`,
                      confirmLabel: 'Excluir',
                      onConfirm: () => deleteGoal(goal.id),
                    })
                  }
                >
                  <Trash2 size={13} />
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <NewGoalModal isOpen={isNewGoalOpen} onClose={() => setIsNewGoalOpen(false)} />

      {/* Cancelamento com justificativa */}
      <Modal
        isOpen={!!cancelingGoal}
        onClose={() => setCancelingGoal(null)}
        title="Cancelar meta"
        subtitle={cancelingGoal?.title}
        maxWidth="440px"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!cancelingGoal || !cancelReason.trim()) return;
            setGoalStatus(cancelingGoal.id, { status: 'CANCELADA', reason: cancelReason.trim(), at: new Date().toISOString() });
            setCancelingGoal(null);
          }}
        >
          <div className="form-group mb-3">
            <label htmlFor="goal-cancel-reason">Por que esta meta foi cancelada?</label>
            <textarea
              id="goal-cancel-reason"
              className="form-input"
              rows={3}
              placeholder="Ex.: mudança de prioridade, o objetivo deixou de fazer sentido"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              autoFocus
            />
          </div>
          <p className="text-xs text-muted mb-3">A meta sai da lista de ativas e fica em "Canceladas" com esta justificativa. Dá para reativar depois.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setCancelingGoal(null)}>
              Voltar
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={!cancelReason.trim()}>
              Cancelar meta
            </button>
          </div>
        </form>
      </Modal>

      {resumingGoal && (
        <ResumeGoalModal
          goal={resumingGoal}
          pausedAt={goalStatuses[resumingGoal.id]?.at}
          onClose={() => setResumingGoal(null)}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
};
