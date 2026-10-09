import React, { useEffect, useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { ForecastBreakdownModal, forecastPeriodLabel, formatBRL, useForecastPeriod } from './ForecastBreakdownModal';
import type { HubNotification, useHubNotifications } from '../hooks/useHubNotifications';
import { NotificationDetailsModal } from './NotificationDetailsModal';
import { Sparkles, CheckCircle2, ArrowRight, X, Bell, Calendar, RefreshCw, ListChecks } from 'lucide-react';

interface BalderHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  hub: ReturnType<typeof useHubNotifications>;
  isForecastOpen: boolean;
  onForecastOpenChange: (open: boolean) => void;
  onNavigateToCopilot?: () => void;
}

/** Central de notificações: o que precisa da sua atenção agora. */
export const BalderHubModal: React.FC<BalderHubModalProps> = ({
  isOpen,
  onClose,
  hub,
  isForecastOpen,
  onForecastOpenChange,
  onNavigateToCopilot,
}) => {
  const { forecasts } = useFinancial();
  const [forecastPeriod, setForecastPeriod] = useForecastPeriod('MES');
  // Aviso cujos itens estão abertos no pop-up de detalhes (guarda o id: a lista acompanha as mudanças)
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const detailsNotif: HubNotification | null = hub.notifications.find((n) => n.id === detailsId) || null;

  // Abrir a Central conta como leitura: o número do sino some
  useEffect(() => {
    if (isOpen && hub.unreadCount > 0) hub.markAllSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, hub.unreadCount]);

  const visible = hub.notifications;

  return (
    <>
      {isOpen && (
        <div
          className="balder-hub-overlay animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Central Balder - Notificações"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="balder-hub-modal glass-card">
            <div className="balder-hub-header">
              <div className="hub-header-brand">
                <div className="hub-balder-logo">
                  <img src="/logo-app.png" alt="Balder" />
                  <span className="hub-logo-glow" />
                </div>
                <div>
                  <h3 className="hub-title">Central BALDER</h3>
                  <p className="hub-subtitle">O que precisa da sua atenção agora</p>
                </div>
              </div>

              <button type="button" className="hub-close-btn" onClick={onClose} title="Fechar Central" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="balder-hub-body">
              <div className="hub-notifications-section">
                <div className="hub-notif-header">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-cyan" />
                    <h4 className="hub-notif-title">Notificações</h4>
                    {visible.length > 0 && <span className="hub-notif-count-badge">{visible.length}</span>}
                  </div>

                  {visible.length > 0 && (
                    <button type="button" className="hub-clear-btn cursor-pointer" onClick={hub.dismissAll} title="Dispensar todas">
                      Limpar todas
                    </button>
                  )}
                </div>

                {visible.length > 0 ? (
                  <div className="hub-notif-list">
                    {visible.map((notif) => (
                      <div
                        key={notif.id}
                        className={`hub-notif-card notif-${notif.type.toLowerCase()}`}
                        onClick={() => {
                          // Com itens sinalizados, tocar no aviso mostra quais são
                          if (notif.details && notif.details.length > 0) {
                            setDetailsId(notif.id);
                            return;
                          }
                          if (!notif.action) return;
                          onClose();
                          notif.action();
                        }}
                      >
                        <div className="hub-notif-icon-box">{notif.icon || <Bell size={16} />}</div>

                        <div className="hub-notif-content">
                          <div className="hub-notif-title-row">
                            <span className="hub-notif-item-title">{notif.title}</span>
                            <span className="hub-notif-time">{notif.timestamp}</span>
                          </div>
                          <p className="hub-notif-desc">{notif.description}</p>

                          {(notif.actionLabel || (notif.details && notif.details.length > 0)) && (
                            <div className="hub-notif-action-row">
                              {notif.details && notif.details.length > 0 && (
                                <button
                                  type="button"
                                  className="hub-notif-inline-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetailsId(notif.id);
                                  }}
                                >
                                  <ListChecks size={12} />
                                  <span>Ver os {notif.details.length} itens</span>
                                </button>
                              )}
                              {notif.actionLabel && (
                              <button
                                type="button"
                                className="hub-notif-inline-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onClose();
                                  notif.action?.();
                                }}
                              >
                                <span>{notif.actionLabel}</span>
                                <ArrowRight size={12} />
                              </button>
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className="hub-notif-dismiss-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            hub.dismiss(notif.id);
                          }}
                          title="Dispensar aviso"
                          aria-label="Dispensar aviso"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="hub-empty-notif glass-card">
                    <CheckCircle2 size={32} className="text-emerald" />
                    <h5>Tudo em dia</h5>
                    <p>Nenhuma conta atrasada, nada a confirmar e nenhum vencimento nos próximos dias.</p>
                    {hub.hasDismissed && (
                      <button type="button" className="btn btn-outline btn-xs mt-2" onClick={hub.restoreDismissed}>
                        <RefreshCw size={12} />
                        <span>Mostrar as dispensadas</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="balder-hub-footer">
              <button
                type="button"
                className="hub-forecast-btn"
                onClick={() => onForecastOpenChange(true)}
                title="Ver o que compõe o saldo previsto"
              >
                <Calendar size={13} className="text-cyan" />
                <span>
                  {forecastPeriodLabel(forecastPeriod)}:{' '}
                  <strong className={forecasts[forecastPeriod].projectedBalance < 0 ? 'text-rose' : ''}>
                    {formatBRL(forecasts[forecastPeriod].projectedBalance)}
                  </strong>
                </span>
              </button>

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
                <button type="button" className="btn btn-primary btn-xs" onClick={onClose}>
                  Concluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <NotificationDetailsModal
        notification={detailsNotif}
        onClose={() => setDetailsId(null)}
        onOpenAction={
          detailsNotif?.action
            ? () => {
                const action = detailsNotif.action;
                setDetailsId(null);
                onClose();
                action?.();
              }
            : undefined
        }
      />
      <ForecastBreakdownModal
        isOpen={isForecastOpen}
        onClose={() => onForecastOpenChange(false)}
        period={forecastPeriod}
        onPeriodChange={setForecastPeriod}
      />
    </>
  );
};
