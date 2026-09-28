import { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { FinancialProvider, useFinancial } from './context/FinancialContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccountScopeProvider, useAccountScope } from './context/AccountScopeContext';
import { SharedAccountBanner } from './components/SharedAccountBanner';
import { InviteAcceptDialog, captureInviteFromUrl } from './components/InviteAcceptDialog';
import { Sidebar } from './components/Sidebar';
import type { TabId } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { HomeHubPage } from './pages/HomeHubPage';
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

// Link de convite (#convite=TOKEN): guarda antes do login para não perder no redirecionamento
captureInviteFromUrl();

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
    <AccountScopeProvider>
      <ScopedFinancialApp />
    </AccountScopeProvider>
  );
}

/** Recria o contexto financeiro ao trocar entre a própria conta e uma conta compartilhada. */
function ScopedFinancialApp() {
  const { viewing } = useAccountScope();
  return (
    <FinancialProvider key={viewing?.ownerId || 'own'}>
      <AppContent />
    </FinancialProvider>
  );
}

export function AppContent() {
  // Sem tela escolhida (null), abre a tela inicial da preferência: Início ou Painel.
  // Quem já usava o Balder antes do Início continua abrindo no Painel até escolher outra.
  const [chosenTab, setActiveTab] = useState<TabId | null>(null);
  const { viewPreferences, activeCheckpoint } = useFinancial();
  const homeTab: TabId =
    viewPreferences.homeScreen === 'PAINEL'
      ? 'DASHBOARD'
      : viewPreferences.homeScreen === 'INICIO'
      ? 'INICIO'
      : activeCheckpoint
      ? 'DASHBOARD'
      : 'INICIO';
  const activeTab: TabId = chosenTab ?? homeTab;
  // Compartilhamento só do planejamento: a conta aberta mostra apenas o Planejamento Compartilhado
  const { viewing } = useAccountScope();
  const planningOnly = viewing?.scope === 'PLANEJAMENTO';
  const shownTab: TabId = planningOnly ? 'COMPARTILHADO' : activeTab;
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
          onNavigateToDashboard={() => {
            setActiveTab(homeTab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        <SharedAccountBanner />
        <main className="app-content-viewport">
          {shownTab === 'INICIO' && (
            <HomeHubPage
              onNavigate={handleSelectTab}
              onOpenForseti={() => setIsCopilotOpen(true)}
              onOpenOnboarding={handleOpenOnboarding}
            />
          )}

          {(shownTab === 'DASHBOARD' || shownTab === 'COPILOT') && (
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

          {shownTab === 'MOVIMENTACOES' && (
            <MovementsPage onOpenNewMovementModal={handleOpenNewMovement} />
          )}

          {shownTab === 'FATURAS' && <InvoicesPage />}

          {shownTab === 'NATUREZAS' && (
            <NaturezasPage onOpenNewMovementModal={handleOpenNewMovement} />
          )}

          {shownTab === 'EMPRESTIMOS' && <LoansPage />}

          {shownTab === 'METAS' && <GoalsPage />}

          {shownTab === 'COMPARTILHADO' && <SharedPlanningPage />}

          {shownTab === 'PERFIL' && (
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

      <InviteAcceptDialog />
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
