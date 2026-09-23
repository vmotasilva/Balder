import React, { useState, useEffect } from 'react';
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
  X,
} from 'lucide-react';
import type { SimulationPresetId } from '../types';

export interface QuickActionsDropdownProps {
  onOpenSimulation: (preset?: SimulationPresetId, mode?: 'PRESETS' | 'STUDIO') => void;
  onNavigateToLoans?: () => void;
  onOpenPrepayment?: () => void;
  onOpenCheckpoint?: () => void;
  className?: string;
  buttonLabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const QuickActionsDropdown: React.FC<QuickActionsDropdownProps> = ({
  onOpenSimulation,
  onNavigateToLoans,
  onOpenPrepayment,
  onOpenCheckpoint,
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

  const items = [
    ...(onOpenCheckpoint
      ? [
          {
            id: 'checkpoint',
            title: 'Definir Ponto de Partida',
            subtitle: 'Calibrar data de início, saldos em contas e faturas abertas',
            badge: 'Ponto de Partida',
            badgeClass: 'badge-purple',
            icon: <Flag size={18} className="text-purple-400" />,
            onClick: () => {
              setIsOpen(false);
              onOpenCheckpoint();
            },
          },
        ]
      : []),
    {
      id: 'studio',
      title: 'Simulador de Cenários Futuros',
      subtitle: 'Estúdio avançado de crédito, amortizações e projeção de 12 meses',
      badge: 'Estúdio',
      badgeClass: 'badge-cyan',
      icon: <Sliders size={18} className="text-cyan-400" />,
      onClick: () => {
        setIsOpen(false);
        onOpenSimulation(undefined, 'STUDIO');
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
    {
      id: 'financiamento',
      title: 'Novo Financiamento',
      subtitle: 'Verificar comprometimento de renda e limite seguro de parcela',
      badge: 'Margem',
      badgeClass: 'badge-amber',
      icon: <CreditCard size={18} className="text-amber-400" />,
      onClick: () => {
        setIsOpen(false);
        onOpenSimulation('FINANCIAMENTO');
      },
    },
    {
      id: 'carro',
      title: 'Comprar Carro',
      subtitle: 'Simular entrada, parcelamento e impacto na reserva de emergência',
      icon: <Car size={18} className="text-sky-400" />,
      onClick: () => {
        setIsOpen(false);
        onOpenSimulation('CARRO');
      },
    },
    {
      id: 'imovel',
      title: 'Comprar Imóvel',
      subtitle: 'Avaliar viabilidade de entrada alta e parcelamento SAC',
      icon: <Home size={18} className="text-purple-400" />,
      onClick: () => {
        setIsOpen(false);
        onOpenSimulation('IMOVEL');
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

      {/* Pop-up Modal de Ações Rápidas (Substituindo o antigo dropdown absoluto) */}
      {isOpen && (
        <div
          className="quick-actions-popup-backdrop"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="quick-actions-popup-dialog glass-card animate-fade-in"
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
                    <h3 className="quick-actions-popup-title font-bold text-base">Ações Rápidas</h3>
                    <span className="badge badge-amber text-[10px] px-2 py-0.5">
                      {items.length} Ações
                    </span>
                  </div>
                  <span className="quick-actions-popup-subtitle text-xs text-muted block mt-0.5">
                    Atalhos diretos para tomada de decisão e simulações
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="quick-actions-popup-close"
                onClick={() => setIsOpen(false)}
                title="Fechar (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Lista de Ações do Pop-up */}
            <div className="quick-actions-popup-body">
              {items.map((item) => (
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
