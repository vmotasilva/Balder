import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Zap,
  Sliders,
  CheckCircle2,
  Banknote,
  CreditCard,
  Car,
  Home,
  ArrowRight,
  Flag,
  Sparkles,
  X,
} from 'lucide-react';
import type { SimulationPresetId } from '../types';

export interface QuickActionsDropdownProps {
  onOpenSimulation: (preset?: SimulationPresetId, mode?: 'PRESETS' | 'STUDIO') => void;
  onNavigateToLoans?: () => void;
  onOpenPrepayment?: () => void;
  onOpenCheckpoint?: () => void;
  onOpenOnboarding?: (stepIndex?: number) => void;
  className?: string;
  buttonLabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const QuickActionsDropdown: React.FC<QuickActionsDropdownProps> = ({
  onOpenSimulation,
  onNavigateToLoans,
  onOpenPrepayment,
  onOpenCheckpoint,
  onOpenOnboarding,
  className = '',
  buttonLabel = 'Ações Rápidas',
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const decisionSimulations = [
    {
      id: 'carro',
      title: 'Comprar Carro',
      subtitle: 'Simular entrada, parcelamento e impacto na reserva de emergência',
      icon: <Car size={18} className="text-sky-400" />,
      badge: 'Aquisição',
      badgeClass: 'badge-cyan',
      onClick: () => {
        setIsOpen(false);
        onOpenSimulation('CARRO');
      },
    },
    {
      id: 'imovel',
      title: 'Comprar Imóvel',
      subtitle: 'Avaliar viabilidade de entrada alta e parcelamento SAC/Price',
      icon: <Home size={18} className="text-purple-400" />,
      badge: 'Patrimônio',
      badgeClass: 'badge-purple',
      onClick: () => {
        setIsOpen(false);
        onOpenSimulation('IMOVEL');
      },
    },
    {
      id: 'financiamento',
      title: 'Novo Financiamento',
      subtitle: 'Verificar comprometimento de renda e margem segura da parcela',
      badge: 'Margem',
      badgeClass: 'badge-amber',
      icon: <CreditCard size={18} className="text-amber-400" />,
      onClick: () => {
        setIsOpen(false);
        onOpenSimulation('FINANCIAMENTO');
      },
    },
    {
      id: 'quitar',
      title: 'Quitar / Antecipar Empréstimo',
      subtitle: 'Deságio a valor presente e amortização com abatimento de juros',
      badge: 'BACEN 3.516',
      badgeClass: 'badge-emerald',
      icon: <CheckCircle2 size={18} className="text-emerald-400" />,
      onClick: () => {
        setIsOpen(false);
        if (onNavigateToLoans) {
          onNavigateToLoans();
        } else if (onOpenPrepayment) {
          onOpenPrepayment();
        } else {
          onOpenSimulation('QUITAR_DIVIDA');
        }
      },
    },
    {
      id: 'novo_emprestimo',
      title: 'Novo Empréstimo',
      subtitle: 'Simulador Price com taxa a.m., juros compostos e parcelas',
      badge: 'Price',
      badgeClass: 'badge-cyan',
      icon: <Banknote size={18} className="text-cyan-400" />,
      onClick: () => {
        setIsOpen(false);
        if (onNavigateToLoans) {
          onNavigateToLoans();
        } else {
          onOpenSimulation('NOVO_EMPRESTIMO');
        }
      },
    },
  ];

  const sizeClasses = {
    sm: 'text-xs py-1.5 px-3',
    md: 'text-xs md:text-sm py-2 px-4',
    lg: 'text-sm py-2.5 px-5',
  }[size];

  return (
    <div className={`quick-actions-container inline-block ${className}`}>
      <button
        type="button"
        className={`btn btn-primary flex items-center gap-2 cursor-pointer font-semibold shadow-lg transition-all ${sizeClasses}`}
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
      >
        <Zap size={16} className="text-amber-300 fill-amber-300 flex-shrink-0 animate-pulse" />
        <span>{buttonLabel}</span>
      </button>

      {/* Pop-up Modal de Ações Rápidas renderizado diretamente no body (Portal Viewport) */}
      {isOpen &&
        createPortal(
          <div
            className="quick-actions-popup-backdrop"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="quick-actions-popup-dialog"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              {/* Cabeçalho do Pop-up */}
              <div className="quick-actions-popup-header">
                <div className="flex items-center gap-2.5">
                  <div className="quick-actions-header-icon-box">
                    <Zap size={18} className="text-amber-400 fill-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="quick-actions-popup-title font-bold text-base">
                        Ações Rápidas & Decisão
                      </h3>
                      <span className="badge badge-amber text-[10px] px-2 py-0.5">
                        Tomada de Decisão
                      </span>
                    </div>
                    <span className="quick-actions-popup-subtitle text-xs text-muted block mt-0.5">
                      Simuladores, amortizações e atalhos estratégicos
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="quick-actions-popup-close"
                  onClick={() => setIsOpen(false)}
                  title="Fechar (Esc)"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Corpo com Destaque de Tomada de Decisão & Lista de Ações */}
              <div className="quick-actions-popup-body">
                {/* Hero: Simulador de Cenários Futuros & Tomada de Decisão */}
                <div className="quick-actions-decision-hero">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="quick-actions-hero-icon-box">
                        <Sliders size={20} className="text-cyan-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="badge badge-amber text-[9.5px] uppercase font-bold tracking-wider">
                            TOMADA DE DECISÃO
                          </span>
                          <span className="text-[11px] text-muted">Estúdio 12 Meses</span>
                        </div>
                        <h4 className="text-sm font-bold text-white">
                          Simulador de Cenários Futuros
                        </h4>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shrink-0"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenSimulation(undefined, 'STUDIO');
                      }}
                    >
                      <span>Abrir Estúdio</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                  <p className="text-[11px] text-muted mt-2 leading-relaxed">
                    Simule compra de bens (carro/imóvel), contratação de empréstimos, quitação antecipada com deságio e estúdio avançado de cenários futuros.
                  </p>
                </div>

                {/* Seção 1: Simulações Específicas de Bens & Crédito */}
                <span className="quick-actions-section-title">
                  SIMULAÇÕES DE COMPRAS & CRÉDITO
                </span>

                {decisionSimulations.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="quick-action-card cursor-pointer text-left w-full"
                    onClick={item.onClick}
                  >
                    <div className="quick-action-icon-box">{item.icon}</div>
                    <div className="quick-action-text flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="quick-action-title font-bold text-xs md:text-sm">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className={`badge ${item.badgeClass} text-[9px] px-1.5 py-0.5`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className="quick-action-subtitle text-[11px] text-muted block mt-0.5">
                        {item.subtitle}
                      </span>
                    </div>
                    <ArrowRight size={15} className="quick-action-arrow text-muted flex-shrink-0" />
                  </button>
                ))}

                {/* Seção 2: Calibração & Assistente Inicial (Get Started) */}
                {(onOpenOnboarding || onOpenCheckpoint) && (
                  <>
                    <span className="quick-actions-section-title mt-2">
                      CALIBRAÇÃO & ASSISTENTE INICIAL (GET STARTED)
                    </span>

                    {onOpenOnboarding && (
                      <div className="quick-action-wizard-container">
                        <button
                          type="button"
                          className="quick-action-card quick-action-card-featured cursor-pointer text-left w-full"
                          onClick={() => {
                            setIsOpen(false);
                            onOpenOnboarding(1);
                          }}
                        >
                          <div className="quick-action-icon-box bg-cyan-500/15 border border-cyan-500/30">
                            <Sparkles size={18} className="text-cyan-400" />
                          </div>
                          <div className="quick-action-text flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="quick-action-title font-bold text-xs md:text-sm text-cyan-200">
                                Refazer Assistente Inicial (Get Started)
                              </span>
                              <span className="badge badge-cyan text-[9px] px-1.5 py-0.5">
                                Onboarding
                              </span>
                            </div>
                            <span className="quick-action-subtitle text-[11px] text-muted block mt-0.5">
                              Reconfigure ponto de partida, salário, faturas e naturezas recomendadas
                            </span>
                          </div>
                          <ArrowRight size={15} className="quick-action-arrow text-cyan-400 flex-shrink-0" />
                        </button>

                        {/* Atalhos Rápidos por Etapa */}
                        <div className="quick-action-step-pills">
                          <span className="quick-action-pills-label">
                            Ir direto:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              onOpenOnboarding(1);
                            }}
                            className="quick-action-step-pill"
                            title="Ir para Ponto de Partida e Salário"
                          >
                            1. Ponto de Partida & Salário
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              onOpenOnboarding(2);
                            }}
                            className="quick-action-step-pill"
                            title="Ir para Faturas de Cartão"
                          >
                            2. Faturas de Cartão
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              onOpenOnboarding(3);
                            }}
                            className="quick-action-step-pill"
                            title="Ir para Naturezas & Tetos"
                          >
                            3. Naturezas & Tetos
                          </button>
                        </div>
                      </div>
                    )}

                    {onOpenCheckpoint && (
                      <button
                        type="button"
                        className="quick-action-card cursor-pointer text-left w-full"
                        onClick={() => {
                          setIsOpen(false);
                          onOpenCheckpoint();
                        }}
                      >
                        <div className="quick-action-icon-box">
                          <Flag size={18} className="text-purple-400" />
                        </div>
                        <div className="quick-action-text flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="quick-action-title font-bold text-xs md:text-sm">
                              Definir Ponto de Partida
                            </span>
                            <span className="badge badge-purple text-[9px] px-1.5 py-0.5">
                              Marco Inicial
                            </span>
                          </div>
                          <span className="quick-action-subtitle text-[11px] text-muted block mt-0.5">
                            Calibrar data de início, saldos em contas e faturas abertas
                          </span>
                        </div>
                        <ArrowRight size={15} className="quick-action-arrow text-muted flex-shrink-0" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
