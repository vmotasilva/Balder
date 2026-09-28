import React, { useState, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { useTheme } from '../context/ThemeContext';
import { Plus, Sparkles, Sun, Moon, LayoutGrid, Bell } from 'lucide-react';
import { BalderHubModal } from './BalderHubModal';
import { PlanningSwitcher } from './PlanningSwitcher';
import { auditOnboardingProgress } from '../utils/onboardingProgress';

interface NavbarProps {
  onOpenNewMovementModal: () => void;
  onOpenSimulationModal: () => void;
  onOpenNavMenu?: () => void;
  onOpenOnboarding?: (stepIndex?: number) => void;
  onNavigateToMovements?: () => void;
  onNavigateToInvoices?: () => void;
  onNavigateToGoals?: () => void;
  onNavigateToCopilot?: () => void;
  onNavigateToDashboard?: () => void;
  onPlanWithOthers?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenNewMovementModal,
  onOpenSimulationModal,
  onOpenNavMenu,
  onNavigateToDashboard,
  onOpenOnboarding,
  onNavigateToMovements,
  onNavigateToInvoices,
  onNavigateToGoals,
  onNavigateToCopilot,
  onPlanWithOthers,
}) => {
  const {
    availableBalance,
    accountBalance,
    cashInHandBalance,
    emergencyReserveMonths,
    nextCriticalEvent,
    activeCheckpoint,
    movements,
    cards,
    accounts,
    banks,
    natures,
  } = useFinancial();
  const { theme, toggleTheme } = useTheme();
  const [isHubOpen, setIsHubOpen] = useState(false);

  // Auditoria dos pilares do Get Started
  const onboardingAudit = useMemo(
    () =>
      auditOnboardingProgress({
        activeCheckpoint,
        movements,
        cards,
        accounts,
        banks,
        natures,
      }),
    [activeCheckpoint, movements, cards, accounts, banks, natures]
  );

  const pendingCount = onboardingAudit.missingStepsCount + (nextCriticalEvent ? 1 : 0);
  const hasHubAlerts = pendingCount > 0;

  return (
    <>
      <header className="app-navbar">
        <div className="navbar-left">
          {/* Botão Interativo do Símbolo do Balder: Abre Get Started & Notificações */}
          <button
            type="button"
            className="navbar-brand-btn"
            onClick={() => (onNavigateToDashboard ? onNavigateToDashboard() : setIsHubOpen(true))}
            title="Ir para o início"
            aria-label="Ir para o início"
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

          <PlanningSwitcher onPlanWithOthers={onPlanWithOthers} />

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
          <span
            className="stat-value text-cyan"
            title={`Em conta: ${accountBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · Em mãos: ${cashInHandBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
          >
            {availableBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
          <span className="stat-split">
            🏦 {accountBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · 💵{' '}
            {cashInHandBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>

        <div className="navbar-stat-divider"></div>

        <div className="navbar-stat-item">
          <span className="stat-label">Reserva Runway</span>
          <span className="stat-value text-emerald">
            {emergencyReserveMonths} meses
          </span>
        </div>

        {/* Notifications & Pendencies Center Button */}
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={() => setIsHubOpen(true)}
          title="Notificações & Central de Pendências"
          aria-label="Abrir Notificações"
          style={{ position: 'relative' }}
        >
          <Bell size={17} />
          {pendingCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#f43f5e',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                borderRadius: '999px',
                padding: '1px 5px',
                lineHeight: '1.2',
                boxShadow: '0 0 6px rgba(244, 63, 94, 0.6)',
              }}
            >
              {pendingCount}
            </span>
          )}
        </button>

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

        {/* Atalho da Forseti */}
        {onNavigateToCopilot && (
          <button
            type="button"
            className="btn btn-secondary btn-sm navbar-forseti-btn"
            onClick={onNavigateToCopilot}
            title="Conversar com a Forseti"
            aria-label="Abrir Forseti"
          >
            <img src="/forseti-avatar.png" alt="" className="navbar-forseti-avatar" />
            <span>Forseti</span>
          </button>
        )}

        {/* Quick Action Buttons */}
        <button 
          className="btn btn-secondary btn-sm navbar-simulate-btn"
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
