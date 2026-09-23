import React, { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { useTheme } from '../context/ThemeContext';
import { Plus, Sparkles, Sun, Moon, LayoutGrid } from 'lucide-react';
import { BalderHubModal } from './BalderHubModal';

interface NavbarProps {
  onOpenNewMovementModal: () => void;
  onOpenSimulationModal: () => void;
  onOpenNavMenu?: () => void;
  onOpenOnboarding?: (stepIndex?: number) => void;
  onNavigateToMovements?: () => void;
  onNavigateToInvoices?: () => void;
  onNavigateToGoals?: () => void;
  onNavigateToCopilot?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenNewMovementModal,
  onOpenSimulationModal,
  onOpenNavMenu,
  onOpenOnboarding,
  onNavigateToMovements,
  onNavigateToInvoices,
  onNavigateToGoals,
  onNavigateToCopilot,
}) => {
  const {
    availableBalance,
    emergencyReserveMonths,
    nextCriticalEvent,
    activeCheckpoint,
    movements,
    cards,
    natures,
  } = useFinancial();
  const { theme, toggleTheme } = useTheme();
  const [isHubOpen, setIsHubOpen] = useState(false);

  // Indica se há alertas ou calibração pendente para exibir indicador no logo
  const hasPendingCalibration =
    !activeCheckpoint ||
    (movements.filter((m) => m.type === 'CARTAO').length === 0 && cards.length === 0) ||
    natures.length === 0;
  const hasHubAlerts = hasPendingCalibration || !!nextCriticalEvent;

  return (
    <>
      <header className="app-navbar">
        <div className="navbar-left">
          {/* Botão Interativo do Símbolo do Balder: Abre Get Started & Notificações */}
          <button
            type="button"
            className="navbar-brand-btn"
            onClick={() => setIsHubOpen(true)}
            title="Abrir Central Balder: Notificações & Get Started"
            aria-label="Abrir Central Balder: Notificações & Get Started"
          >
            <div className="navbar-brand-logo-icon">
              <img src="/logo-app.png" alt="Balder" className="navbar-brand-logo-img" />
              {hasHubAlerts && <span className="balder-logo-indicator" />}
            </div>
            <span className="navbar-brand-title">BALDER</span>
          </button>

          {onOpenNavMenu && (
            <button
              type="button"
              className="navbar-menu-btn"
              onClick={onOpenNavMenu}
              title="Menu de Navegação (Módulos & Telas)"
              aria-label="Abrir Menu de Navegação"
            >
              <LayoutGrid size={16} className="text-cyan" />
              <span className="navbar-menu-btn-text">Módulos</span>
            </button>
          )}

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

        {/* Theme Toggle Button */}
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

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

    {/* Modal da Central Balder (Notificações & Acesso Rápido ao Get Started) */}
    <BalderHubModal
      isOpen={isHubOpen}
      onClose={() => setIsHubOpen(false)}
      onOpenOnboarding={onOpenOnboarding || (() => {})}
      onNavigateToMovements={onNavigateToMovements}
      onNavigateToInvoices={onNavigateToInvoices}
      onNavigateToGoals={onNavigateToGoals}
      onNavigateToCopilot={onNavigateToCopilot}
    />
  </>
  );
};
