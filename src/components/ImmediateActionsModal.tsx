import React, { useEffect } from 'react';
import {
  Zap,
  Briefcase,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Banknote,
  Building2,
  CreditCard,
  ArrowRight,
  X,
} from 'lucide-react';
import type { Movement, MovementType } from '../types';

export interface ImmediateActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSalaryAction: () => void;
  salarySuggestion: {
    hasContract: boolean;
    periodLabel: string;
    dueDate: string;
    amount: number;
    title: string;
    contract?: {
      employer?: string;
    };
  };
  onOpenNewMovementModal: (defaultType?: MovementType, initialData?: Partial<Movement>) => void;
}

export const ImmediateActionsModal: React.FC<ImmediateActionsModalProps> = ({
  isOpen,
  onClose,
  onSalaryAction,
  salarySuggestion,
  onOpenNewMovementModal,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    {
      id: 'salario',
      title: salarySuggestion.hasContract
        ? `Lançar Salário (${salarySuggestion.periodLabel})`
        : '+ Lançar Salário',
      subtitle: salarySuggestion.hasContract
        ? `${salarySuggestion.dueDate.split('-').reverse().join('/')} • R$ ${salarySuggestion.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • ${salarySuggestion.contract?.employer || 'Folha'}`
        : 'Registrar recebimento de salário ou adiantamento',
      badge: salarySuggestion.hasContract ? salarySuggestion.periodLabel : 'Salarial',
      badgeClass: 'badge-emerald',
      icon: <Briefcase size={18} className="text-emerald-400" />,
      onClick: () => {
        onClose();
        onSalaryAction();
      },
    },
    {
      id: 'receber',
      title: 'Cadastrar a Receber',
      subtitle: 'Nova previsão de receita ou valor a receber no fluxo de caixa',
      badge: 'Receita',
      badgeClass: 'badge-emerald',
      icon: <TrendingUp size={18} className="text-emerald-400" />,
      onClick: () => {
        onClose();
        onOpenNewMovementModal('RECEBER');
      },
    },
    {
      id: 'pagar',
      title: 'Cadastrar a Pagar',
      subtitle: 'Novo compromisso, custo operacional ou boleto a liquidar',
      badge: 'Despesa',
      badgeClass: 'badge-rose',
      icon: <TrendingDown size={18} className="text-rose-400" />,
      onClick: () => {
        onClose();
        onOpenNewMovementModal('PAGAR');
      },
    },
    {
      id: 'registrar_pagamento',
      title: 'Registrar Pagamento',
      subtitle: 'Baixar saída já quitada diretamente na conta ou cartão',
      badge: 'Baixa Realizada',
      badgeClass: 'badge-cyan',
      icon: <CheckCircle2 size={18} className="text-emerald-400" />,
      onClick: () => {
        onClose();
        onOpenNewMovementModal('PAGAR');
      },
    },
    {
      id: 'registrar_recebimento',
      title: 'Registrar Recebimento',
      subtitle: 'Confirmar entrada e conciliar saldo na conta corrente',
      badge: 'Entrada Confirmada',
      badgeClass: 'badge-cyan',
      icon: <Banknote size={18} className="text-cyan-400" />,
      onClick: () => {
        onClose();
        onOpenNewMovementModal('RECEBER');
      },
    },
    {
      id: 'cadastrar_emprestimo',
      title: 'Cadastrar Empréstimo',
      subtitle: 'Contrato de dívida bancária com cronograma de amortização',
      badge: 'Crédito',
      badgeClass: 'badge-amber',
      icon: <Building2 size={18} className="text-amber-400" />,
      onClick: () => {
        onClose();
        onOpenNewMovementModal('EMPRESTIMO');
      },
    },
    {
      id: 'cadastrar_financiamento',
      title: 'Cadastrar Financiamento',
      subtitle: 'Financiamento habitacional, automotivo ou de bens',
      badge: 'Financiamento',
      badgeClass: 'badge-purple',
      icon: <CreditCard size={18} className="text-purple-400" />,
      onClick: () => {
        onClose();
        onOpenNewMovementModal('EMPRESTIMO');
      },
    },
  ];

  return (
    <div className="quick-actions-popup-backdrop" onClick={onClose}>
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
                <h3 className="quick-actions-popup-title font-bold text-base">Ações Imediatas</h3>
                <span className="badge badge-amber text-[10px] px-2 py-0.5">
                  {items.length} Ações
                </span>
              </div>
              <span className="quick-actions-popup-subtitle text-xs text-muted block mt-0.5">
                Atalhos rápidos para lançamentos e baixas financeiras
              </span>
            </div>
          </div>
          <button
            type="button"
            className="quick-actions-popup-close"
            onClick={onClose}
            title="Fechar (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lista de Ações Imediatas */}
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
  );
};
