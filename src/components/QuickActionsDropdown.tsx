import React, { useState, useRef, useEffect } from 'react';
import {
  Zap,
  ChevronDown,
  Sliders,
  CheckCircle2,
  Banknote,
  CreditCard,
  Car,
  Home,
  ArrowRight,
} from 'lucide-react';
import type { SimulationPresetId } from '../types';

export interface QuickActionsDropdownProps {
  onOpenSimulation: (preset?: SimulationPresetId, mode?: 'PRESETS' | 'STUDIO') => void;
  onNavigateToLoans?: () => void;
  onOpenPrepayment?: () => void;
  className?: string;
  buttonLabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const QuickActionsDropdown: React.FC<QuickActionsDropdownProps> = ({
  onOpenSimulation,
  onNavigateToLoans,
  onOpenPrepayment,
  className = '',
  buttonLabel = 'Ações Rápidas',
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const items = [
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
    <div className={`quick-actions-dropdown-container relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className={`btn btn-primary flex items-center gap-2 cursor-pointer font-semibold shadow-lg transition-all ${sizeClasses} ${
          isOpen ? 'ring-2 ring-cyan-400 shadow-cyan-500/20' : ''
        }`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Zap size={16} className="text-amber-300 fill-amber-300 flex-shrink-0 animate-pulse" />
        <span>{buttonLabel}</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="quick-actions-menu glass-card animate-scale-in">
          <div className="quick-actions-menu-header">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Tomada de Decisão & Simulações Rápidas
            </span>
            <span className="badge badge-amber text-[9px] px-1.5 py-0.2">6 Ações</span>
          </div>

          <div className="quick-actions-menu-list">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="quick-action-item cursor-pointer text-left w-full"
                onClick={item.onClick}
              >
                <div className="quick-action-icon-box">{item.icon}</div>
                <div className="quick-action-text flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="quick-action-title font-semibold text-xs md:text-sm">
                      {item.title}
                    </span>
                    {item.badge && (
                      <span className={`badge ${item.badgeClass} text-[9px] px-1.5 py-0.2`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="quick-action-subtitle text-[11px] text-muted block truncate mt-0.5">
                    {item.subtitle}
                  </span>
                </div>
                <ArrowRight size={14} className="quick-action-arrow text-muted flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
