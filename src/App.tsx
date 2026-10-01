import { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { FinancialProvider, useFinancial } from './context/FinancialContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccountScopeProvider, useAccountScope } from './context/AccountScopeContext';
import { SharedAccountBanner } from './components/SharedAccountBanner';
import { PENDING_TAB_KEY } from './components/PlanningSwitcher';
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
import { ContractsPage } from './pages/ContractsPage';
import { SharedPlanningPage } from './pages/SharedPlanningPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { IosInstallFromLink } from './components/IosInstallModal';
import { NewMovementModal } from './components/NewMovementModal';
import { NewRecordPickerModal, type NewRecordKind } from './components/NewRecordPickerModal';
import { SimulationModal } from './components/SimulationModal';
import { LoanPrepaymentModal } from './components/LoanPrepaymentModal';
import { ForsetiSetupModal } from './components/ForsetiSetupModal';
import { topicFromStepIndex, type SetupTopic } from './utils/setupCatalog';
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
  const [chosenTab, setActiveTab] = useState<TabId | null>(() => {
    // Aba pedida antes de uma troca de planejamento (ex.: "Planejar com outras pessoas")
    try {
      const pending = sessionStorage.getItem(PENDING_TAB_KEY) as TabId | null;
      if (pending) sessionStorage.removeItem(PENDING_TAB_KEY);
      return pending;
    } catch {
      return null;
    }
  });
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
  const [onboardingTopic, setOnboardingTopic] = useState<SetupTopic | undefined>(undefined);
  const [onboardingRun, setOnboardingRun] = useState(0);

  // Global Modals State
  const [newMovementModalOpen, setNewMovementModalOpen] = useState(false);
  const [recordPickerOpen, setRecordPickerOpen] = useState(false);
  const [newInvoiceSignal, setNewInvoiceSignal] = useState(0);
  const [newLoanSignal, setNewLoanSignal] = useState(0);
  const [purchaseMode, setPurchaseMode] = useState(false);
  const [defaultMovementType, setDefaultMovementType] = useState<MovementType>('PAGAR');
  const [initialMovementData, setInitialMovementData] = useState<Partial<Movement> | undefined>(undefined);

  const [simulationModalOpen, setSimulationModalOpen] = useState(false);
  const [simulationPreset, setSimulationPreset] = useState<SimulationPresetId>('CARRO');
  const [simulationMode, setSimulationMode] = useState<'PRESETS' | 'STUDIO'>('PRESETS');

  const [prepaymentModalOpen, setPrepaymentModalOpen] = useState(false);

  // Sem etapa, a Forseti pergunta por onde começar; com etapa, a conversa abre no assunto dela
  const handleOpenOnboarding = (step?: number) => {
    setOnboardingTopic(topicFromStepIndex(step));
    setOnboardingRun((n) => n + 1);
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
    initialData?: Partial<Movement>,
    purchase = false
  ) => {
    setPurchaseMode(purchase);
    setDefaultMovementType(type);
    setInitialMovementData(initialData);
    setNewMovementModalOpen(true);
  };

  // Escolha do "+": cada tipo leva à tela específica do cadastro
  const handleSelectRecordKind = (kind: NewRecordKind) => {
    setRecordPickerOpen(false);
    if (kind === 'PAGAR' || kind === 'RECEBER') handleOpenNewMovement(kind);
    else if (kind === 'COMPRA') handleOpenNewMovement('PAGAR', undefined, true);
    else if (kind === 'EMPRESTIMO') {
      handleSelectTab('EMPRESTIMOS');
      setNewLoanSignal((n) => n + 1);
    }
    else if (kind === 'CARTAO') {
      handleSelectTab('FATURAS');
      setNewInvoiceSignal((n) => n + 1);
    }
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
          onOpenNewMovementModal={() => setRecordPickerOpen(true)}
          onOpenSimulationModal={() => handleOpenSimulation('CARRO')}
          onOpenOnboarding={handleOpenOnboarding}
          onNavigateToMovements={() => setActiveTab('MOVIMENTACOES')}
          onNavigateToInvoices={() => setActiveTab('FATURAS')}
          onNavigateToGoals={() => setActiveTab('METAS')}
          onNavigateToCopilot={() => setIsCopilotOpen(true)}
          onNavigateToOpportunities={() => {
            handleSelectTab('OPORTUNIDADES');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onPlanWithOthers={() => {
            setActiveTab('COMPARTILHADO');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateToDashboard={() => {
            setActiveTab('INICIO');
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
              onPlanWithOthers={() => {
                setActiveTab('COMPARTILHADO');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
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
            <MovementsPage
              onOpenNewMovementModal={handleOpenNewMovement}
              onOpenNewRecordPicker={() => setRecordPickerOpen(true)}
            />
          )}

          {shownTab === 'FATURAS' && <InvoicesPage newInvoiceSignal={newInvoiceSignal} />}

          {shownTab === 'NATUREZAS' && (
            <NaturezasPage onOpenNewMovementModal={handleOpenNewMovement} />
          )}

          {shownTab === 'EMPRESTIMOS' && <ContractsPage newLoanSignal={newLoanSignal} />}

          {shownTab === 'METAS' && <GoalsPage />}

          {shownTab === 'OPORTUNIDADES' && <PurchasesPage onRegisterPurchase={(t, d) => handleOpenNewMovement(t, d, true)} />}

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
      <ForsetiSetupModal
        key={onboardingRun}
        isOpen={isOnboardingOpen}
        topic={onboardingTopic}
        onClose={() => {
          setIsOnboardingOpen(false);
          sessionStorage.setItem('balder_onboarding_dismissed', 'true');
        }}
      />

      <NewMovementModal
        isOpen={newMovementModalOpen}
        onClose={() => {
          setNewMovementModalOpen(false);
          setInitialMovementData(undefined);
        }}
        defaultType={defaultMovementType}
        initialData={initialMovementData}
        purchase={purchaseMode}
      />

      <NewRecordPickerModal
        isOpen={recordPickerOpen}
        onClose={() => setRecordPickerOpen(false)}
        onSelect={handleSelectRecordKind}
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
      <IosInstallFromLink />
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
