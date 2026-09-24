import { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { FinancialProvider } from './context/FinancialContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import type { TabId } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MovementsPage } from './pages/MovementsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { CopilotPage } from './pages/CopilotPage';
import { GoalsPage } from './pages/GoalsPage';
import { ProfilePage } from './pages/ProfilePage';
import { NaturezasPage } from './pages/NaturezasPage';
import { LoansPage } from './pages/LoansPage';
import { SharedPlanningPage } from './pages/SharedPlanningPage';
import { NewMovementModal } from './components/NewMovementModal';
import { SimulationModal } from './components/SimulationModal';
import { LoanPrepaymentModal } from './components/LoanPrepaymentModal';
import { GetStartedOnboarding } from './components/GetStartedOnboarding';
import type { Movement, MovementType, SimulationPresetId } from './types';
import './App.css';

export function ProtectedApp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading-screen">Carregando Balder...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  // Só monta o FinancialProvider depois que o usuário já é conhecido,
  // evitando o flash de dados DEMO para usuários autenticados.
  return (
    <FinancialProvider>
      <AppContent />
    </FinancialProvider>
  );
}

export function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('DASHBOARD');
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);

  // Onboarding Get Started State
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingInitialStep, setOnboardingInitialStep] = useState(1);

  // Global Modals State
  const [newMovementModalOpen, setNewMovementModalOpen] = useState(false);
  const [defaultMovementType, setDefaultMovementType] = useState<MovementType>('PAGAR');
  const [initialMovementData, setInitialMovementData] = useState<Partial<Movement> | undefined>(undefined);

  const [simulationModalOpen, setSimulationModalOpen] = useState(false);
  const [simulationPreset, setSimulationPreset] = useState<SimulationPresetId>('CARRO');
  const [simulationMode, setSimulationMode] = useState<'PRESETS' | 'STUDIO'>('PRESETS');

  const [prepaymentModalOpen, setPrepaymentModalOpen] = useState(false);

  const handleOpenOnboarding = (step = 1) => {
    setOnboardingInitialStep(step);
    setIsOnboardingOpen(true);
  };

  const handleSelectTab = (tab: TabId) => {
    if (tab === 'COPILOT') {
      setIsCopilotOpen(true);
    } else {
      setActiveTab(tab);
      setIsCopilotOpen(false);
    }
  };

  const handleOpenNewMovement = (
    type: MovementType = 'PAGAR',
    initialData?: Partial<Movement>
  ) => {
    setDefaultMovementType(type);
    setInitialMovementData(initialData);
    setNewMovementModalOpen(true);
  };

  const handleOpenSimulation = (
    preset: SimulationPresetId = 'CARRO',
    mode: 'PRESETS' | 'STUDIO' = 'PRESETS'
  ) => {
    setSimulationPreset(preset);
    setSimulationMode(mode);
    setSimulationModalOpen(true);
  };

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={isCopilotOpen ? 'COPILOT' : activeTab}
        onSelectTab={handleSelectTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isOpen={isNavMenuOpen}
        onOpenChange={setIsNavMenuOpen}
        onOpenOnboarding={handleOpenOnboarding}
      />

      {/* Main Content Layout */}
      <div className="app-main-layout">
        <Navbar
          onOpenNewMovementModal={() => handleOpenNewMovement('PAGAR')}
          onOpenSimulationModal={() => handleOpenSimulation('CARRO')}
          onOpenNavMenu={() => setIsNavMenuOpen(true)}
          onOpenOnboarding={handleOpenOnboarding}
          onNavigateToMovements={() => setActiveTab('MOVIMENTACOES')}
          onNavigateToInvoices={() => setActiveTab('FATURAS')}
          onNavigateToGoals={() => setActiveTab('METAS')}
          onNavigateToCopilot={() => setIsCopilotOpen(true)}
        />

        <main className="app-content-viewport">
          {(activeTab === 'DASHBOARD' || activeTab === 'COPILOT') && (
            <DashboardPage
              onNavigateToMovements={() => setActiveTab('MOVIMENTACOES')}
              onNavigateToGoals={() => setActiveTab('METAS')}
              onNavigateToCopilot={() => setIsCopilotOpen(true)}
              onNavigateToLoans={() => setActiveTab('EMPRESTIMOS')}
              onNavigateToNatures={() => setActiveTab('NATUREZAS')}
              onNavigateToShared={() => setActiveTab('COMPARTILHADO')}
              onOpenSimulation={handleOpenSimulation}
              onOpenPrepayment={() => setPrepaymentModalOpen(true)}
              onOpenOnboarding={handleOpenOnboarding}
            />
          )}

          {activeTab === 'MOVIMENTACOES' && (
            <MovementsPage onOpenNewMovementModal={handleOpenNewMovement} />
          )}

          {activeTab === 'FATURAS' && <InvoicesPage />}

          {activeTab === 'NATUREZAS' && (
            <NaturezasPage onOpenNewMovementModal={handleOpenNewMovement} />
          )}

          {activeTab === 'EMPRESTIMOS' && <LoansPage />}

          {activeTab === 'METAS' && <GoalsPage />}

          {activeTab === 'COMPARTILHADO' && <SharedPlanningPage />}

          {activeTab === 'PERFIL' && (
            <ProfilePage onOpenOnboarding={handleOpenOnboarding} />
          )}
        </main>
      </div>

      {/* Pop-up Modal da Forseti sobrepondo a tela atual */}
      {isCopilotOpen && (
        <div
          className="copilot-popup-overlay animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Forseti - Assistente e Auditor Financeiro"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCopilotOpen(false);
          }}
        >
          <div className="copilot-popup-window glass-card">
            <CopilotPage
              onBack={() => setIsCopilotOpen(false)}
              activeScreen={activeTab === 'COPILOT' ? 'DASHBOARD' : activeTab}
              isPopup={true}
              onOpenOnboarding={handleOpenOnboarding}
            />
          </div>
        </div>
      )}

      {/* Global Modals */}
      <GetStartedOnboarding
        isOpen={isOnboardingOpen}
        initialStep={onboardingInitialStep}
        onClose={() => {
          setIsOnboardingOpen(false);
          sessionStorage.setItem('balder_onboarding_dismissed', 'true');
        }}
        onComplete={() => setIsOnboardingOpen(false)}
      />

      <NewMovementModal
        isOpen={newMovementModalOpen}
        onClose={() => {
          setNewMovementModalOpen(false);
          setInitialMovementData(undefined);
        }}
        defaultType={defaultMovementType}
        initialData={initialMovementData}
      />

      <SimulationModal
        isOpen={simulationModalOpen}
        onClose={() => setSimulationModalOpen(false)}
        initialPreset={simulationPreset}
        initialMode={simulationMode}
      />

      <LoanPrepaymentModal
        isOpen={prepaymentModalOpen}
        onClose={() => setPrepaymentModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProtectedApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
