import React from 'react';
import { useFinancial } from '../context/FinancialContext';
import { Plus, Sparkles } from 'lucide-react';

interface NavbarProps {
  onOpenNewMovementModal: () => void;
  onOpenSimulationModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenNewMovementModal, onOpenSimulationModal }) => {
  const { availableBalance, emergencyReserveMonths, nextCriticalEvent } = useFinancial();

  return (
    <header className="app-navbar">
      <div className="navbar-left">
        <div className="system-pill">
          <div className="pulsing-dot"></div>
          <span className="system-status-text">BALDER SYSTEM ACTIVE</span>
        </div>

        {nextCriticalEvent && (
          <div className="critical-notice-banner">
            <span className="notice-icon">⚠️</span>
            <span className="notice-text">
              <strong>Próximo evento em {nextCriticalEvent.daysRemaining} dias:</strong> {nextCriticalEvent.title}
            </span>
          </div>
        )}
      </div>

      <div className="navbar-right">
        {/* Quick Tickers */}
        <div className="navbar-stat-item">
          <span className="stat-label">Saldo em Caixa</span>
          <span className="stat-value text-cyan">
            {availableBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>

        <div className="navbar-stat-divider"></div>

        <div className="navbar-stat-item">
          <span className="stat-label">Reserva Runway</span>
          <span className="stat-value text-emerald">
            {emergencyReserveMonths} meses
          </span>
        </div>

        {/* Quick Action Buttons */}
        <button 
          className="btn btn-secondary btn-sm"
          onClick={onOpenSimulationModal}
          title="Simular decisões de compra e crédito"
        >
          <Sparkles size={14} className="text-amber" />
          <span>Simular Decisão</span>
        </button>

        <button 
          className="btn btn-primary btn-sm"
          onClick={onOpenNewMovementModal}
          title="Cadastrar entrada ou saída"
        >
          <Plus size={16} />
          <span>Nova Movimentação</span>
        </button>
      </div>
    </header>
  );
};
