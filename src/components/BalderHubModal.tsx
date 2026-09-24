import React, { useState, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { auditOnboardingProgress } from '../utils/onboardingProgress';
import {
  Sparkles,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  X,
  Bell,
  Calendar,
  Wallet,
  Target,
  RefreshCw,
} from 'lucide-react';

interface BalderHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOnboarding: (stepIndex?: number) => void;
  onNavigateToMovements?: () => void;
  onNavigateToInvoices?: () => void;
  onNavigateToGoals?: () => void;
  onNavigateToCopilot?: () => void;
}

export interface HubNotification {
  id: string;
  type: 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';
  title: string;
  description: string;
  timestamp: string;
  actionLabel?: string;
  action?: () => void;
  icon?: React.ReactNode;
}

export const BalderHubModal: React.FC<BalderHubModalProps> = ({
  isOpen,
  onClose,
  onOpenOnboarding,
  onNavigateToMovements,
  onNavigateToInvoices,
  onNavigateToGoals,
  onNavigateToCopilot,
}) => {
  const {
    activeCheckpoint,
    salaryContracts,
    movements,
    cards,
    accounts,
    banks,
    natures,
    nextCriticalEvent,
    emergencyReserveMonths,
    goals,
    forecast30d,
  } = useFinancial();

  // IDs de notificações dispensadas pelo usuário nesta sessão
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('balder_dismissed_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleDismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => {
      const updated = [...prev, id];
      try {
        sessionStorage.setItem('balder_dismissed_notifications', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleClearAll = () => {
    const allIds = activeNotifications.map((n) => n.id);
    setDismissedIds(allIds);
    try {
      sessionStorage.setItem('balder_dismissed_notifications', JSON.stringify(allIds));
    } catch {
      // ignore
    }
  };

  // 1. Auditoria dos 5 Pilares do Get Started
  const onboardingAudit = useMemo(
    () =>
      auditOnboardingProgress({
        activeCheckpoint,
        salaryContracts,
        movements,
        cards,
        accounts,
        banks,
        natures,
      }),
    [activeCheckpoint, salaryContracts, movements, cards, accounts, banks, natures]
  );

  // 2. Geração Dinâmica de Notificações Inteligentes
  const activeNotifications = useMemo<HubNotification[]>(() => {
    const list: HubNotification[] = [];

    // Notificações Inteligentes para cada situação pendente do Get Started (1 por situação)
    if (!onboardingAudit.isAllComplete) {
      onboardingAudit.steps.forEach((step) => {
        if (!step.isComplete) {
          list.push({
            id: `notif_gs_${step.id}`,
            type: step.importance === 'CRITICO' ? 'CRITICAL' : 'WARNING',
            title: `Get Started: ${step.title}`,
            description: step.missingHint || step.description,
            timestamp: 'Pendente',
            actionLabel: `${step.actionLabel} (Etapa ${step.stepIndex})`,
            action: () => {
              onClose();
              onOpenOnboarding(step.stepIndex);
            },
            icon: (
              <Sparkles
                size={16}
                className={step.importance === 'CRITICO' ? 'text-rose' : 'text-amber'}
              />
            ),
          });
        }
      });
    } else {
      list.push({
        id: 'notif_calibration_done',
        type: 'SUCCESS',
        title: 'Sistema 100% Calibrado',
        description: `Todos os 5 pilares do Get Started foram calibrados com sucesso pela Forseti. Ponto de partida ativo desde ${activeCheckpoint?.startDate.split('-').reverse().join('/')}.`,
        timestamp: 'Ativo',
        actionLabel: 'Revisar Calibração',
        action: () => {
          onClose();
          onOpenOnboarding(1);
        },
        icon: <CheckCircle2 size={16} className="text-emerald" />,
      });
    }

    // Notificação 2: Próximo Evento Crítico
    if (nextCriticalEvent) {
      list.push({
        id: `notif_critical_${nextCriticalEvent.id}`,
        type: nextCriticalEvent.daysRemaining <= 3 ? 'CRITICAL' : 'WARNING',
        title: `Atenção: ${nextCriticalEvent.title}`,
        description: `Vencimento em ${nextCriticalEvent.daysRemaining} dia(s). Valor: ${nextCriticalEvent.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. ${nextCriticalEvent.recommendedAction}`,
        timestamp: `${nextCriticalEvent.daysRemaining}d restantes`,
        actionLabel: 'Ver Movimentações',
        action: () => {
          onClose();
          if (onNavigateToMovements) onNavigateToMovements();
        },
        icon: <AlertTriangle size={16} className={nextCriticalEvent.daysRemaining <= 3 ? 'text-rose' : 'text-amber'} />,
      });
    }

    // Notificação 3: Contas a pagar nos próximos 7 dias
    const today = new Date().toISOString().split('T')[0];
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const upcomingPayments = movements.filter(
      (m) => m.type === 'PAGAR' && m.status === 'PREVISTA' && m.dueDate >= today && m.dueDate <= in7Days
    );

    if (upcomingPayments.length > 0) {
      const sumUpcoming = upcomingPayments.reduce((acc, m) => acc + m.amount, 0);
      list.push({
        id: 'notif_upcoming_bills',
        type: 'INFO',
        title: `${upcomingPayments.length} conta(s) a pagar nos próximos 7 dias`,
        description: `Total programado de ${sumUpcoming.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Certifique-se de manter saldo disponível em conta.`,
        timestamp: 'Próximos 7 dias',
        actionLabel: 'Conferir Contas',
        action: () => {
          onClose();
          if (onNavigateToMovements) onNavigateToMovements();
        },
        icon: <Clock size={16} className="text-cyan" />,
      });
    }

    // Notificação 4: Faturas de Cartão de Crédito
    const cardMovements = movements.filter((m) => m.type === 'CARTAO');
    if (cardMovements.length > 0) {
      const openCardInvoices = cardMovements.filter((m) => m.status === 'PREVISTA');
      if (openCardInvoices.length > 0) {
        const sumInvoices = openCardInvoices.reduce((acc, m) => acc + m.amount, 0);
        list.push({
          id: 'notif_card_invoices',
          type: 'INFO',
          title: 'Faturas de Cartão Provisionadas',
          description: `Você possui ${sumInvoices.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} provisionados em ${openCardInvoices.length} fatura(s) de cartão de crédito.`,
          timestamp: 'Ciclo Vigente',
          actionLabel: 'Ver Faturas',
          action: () => {
            onClose();
            if (onNavigateToInvoices) onNavigateToInvoices();
          },
          icon: <CreditCard size={16} className="text-purple-400" />,
        });
      }
    }

    // Notificação 5: Alerta da Reserva Runway
    if (emergencyReserveMonths < 3) {
      list.push({
        id: 'notif_reserve_low',
        type: 'WARNING',
        title: 'Reserva Runway Abaixo do Recomendado',
        description: `Sua reserva atual cobre ${emergencyReserveMonths} meses de custo de vida. A Forseti recomenda construir um colchão de pelo menos 6 meses.`,
        timestamp: 'Alerta Forseti',
        actionLabel: 'Consultar Forseti',
        action: () => {
          onClose();
          if (onNavigateToCopilot) onNavigateToCopilot();
        },
        icon: <Wallet size={16} className="text-amber" />,
      });
    }

    // Notificação 6: Metas Financeiras
    if (goals.length > 0) {
      const topGoal = goals[0];
      const percent = topGoal.targetAmount > 0
        ? Math.min(Math.round((topGoal.currentAmount / topGoal.targetAmount) * 100), 100)
        : 0;

      list.push({
        id: 'notif_top_goal',
        type: 'INFO',
        title: `Meta em Andamento: ${topGoal.title} (${percent}%)`,
        description: `Acumulado ${topGoal.currentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de ${topGoal.targetAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Aporte mensal sugerido: +${topGoal.monthlyContribution.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
        timestamp: 'Metas',
        actionLabel: 'Ver Metas',
        action: () => {
          onClose();
          if (onNavigateToGoals) onNavigateToGoals();
        },
        icon: <Target size={16} className="text-emerald" />,
      });
    }

    return list;
  }, [
    onboardingAudit,
    nextCriticalEvent,
    movements,
    emergencyReserveMonths,
    goals,
    onClose,
    onOpenOnboarding,
    onNavigateToMovements,
    onNavigateToInvoices,
    onNavigateToGoals,
    onNavigateToCopilot,
  ]);

  const visibleNotifications = activeNotifications.filter(
    (n) => !dismissedIds.includes(n.id)
  );

  if (!isOpen) return null;

  return (
    <div
      className="balder-hub-overlay animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Central Balder - Notificações e Get Started"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="balder-hub-modal glass-card">
        {/* Hub Header */}
        <div className="balder-hub-header">
          <div className="hub-header-brand">
            <div className="hub-balder-logo">
              <img src="/logo-app.png" alt="Balder" />
              <span className="hub-logo-glow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="hub-title">Central BALDER</h3>
                <span className="badge-pill badge-pill-cyan">Hub & Alertas</span>
              </div>
              <p className="hub-subtitle">
                Monitore os alertas, calibrações e auditorias do seu sistema
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="hub-close-btn"
              onClick={onClose}
              title="Fechar Central"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Hub Content Body */}
        <div className="balder-hub-body">
          {/* Seção de Notificações Inteligentes */}
          <div className="hub-notifications-section">
            <div className="hub-notif-header">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-cyan" />
                <h4 className="hub-notif-title">Notificações & Alertas Ativos</h4>
                <span className="hub-notif-count-badge">
                  {visibleNotifications.length}
                </span>
              </div>

              {visibleNotifications.length > 0 && (
                <button
                  type="button"
                  className="hub-clear-btn cursor-pointer"
                  onClick={handleClearAll}
                  title="Dispensar todas as notificações visíveis"
                >
                  Limpar Todas
                </button>
              )}
            </div>

            {visibleNotifications.length > 0 ? (
              <div className="hub-notif-list">
                {visibleNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`hub-notif-card notif-${notif.type.toLowerCase()}`}
                    onClick={() => {
                      if (notif.action) notif.action();
                    }}
                  >
                    <div className="hub-notif-icon-box">{notif.icon || <Bell size={16} />}</div>

                    <div className="hub-notif-content">
                      <div className="hub-notif-title-row">
                        <span className="hub-notif-item-title">{notif.title}</span>
                        <span className="hub-notif-time">{notif.timestamp}</span>
                      </div>
                      <p className="hub-notif-desc">{notif.description}</p>

                      {notif.actionLabel && (
                        <div className="hub-notif-action-row">
                          <button
                            type="button"
                            className="hub-notif-inline-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (notif.action) notif.action();
                            }}
                          >
                            <span>{notif.actionLabel}</span>
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="hub-notif-dismiss-btn"
                      onClick={(e) => handleDismissNotification(notif.id, e)}
                      title="Dispensar aviso"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="hub-empty-notif glass-card">
                <CheckCircle2 size={32} className="text-emerald" />
                <h5>Nenhum alerta pendente no momento</h5>
                <p>Seu fluxo de caixa e obrigações financeiras estão em dia.</p>
                {dismissedIds.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs mt-2"
                    onClick={() => {
                      setDismissedIds([]);
                      sessionStorage.removeItem('balder_dismissed_notifications');
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Restaurar Notificações Dispensadas</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Hub Footer */}
        <div className="balder-hub-footer">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Calendar size={13} className="text-cyan" />
            <span>
              Projeção 30d: <strong>{forecast30d.projectedBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToCopilot && (
              <button
                type="button"
                className="btn btn-secondary btn-xs flex items-center gap-1.5"
                onClick={() => {
                  onClose();
                  onNavigateToCopilot();
                }}
              >
                <Sparkles size={12} className="text-cyan" />
                <span>Abrir Forseti</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-xs"
              onClick={onClose}
            >
              Concluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
