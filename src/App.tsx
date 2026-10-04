import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { FinancialProvider, useFinancial } from './context/FinancialContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccountScopeProvider, useAccountScope } from './context/AccountScopeContext';
import { MAIN_PLAN_KEY, PlanScopeProvider, usePlans } from './context/PlanScopeContext';
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
import { PlanSettingsModal } from './components/PlanSettingsModal';
import { ConsolidatedPage } from './pages/ConsolidatedPage';
import { IosInstallFromLink } from './components/IosInstallModal';
import { NewMovementModal, type MovementDraft } from './components/NewMovementModal';
import { Modal } from './components/Modal';
import { NewRecordPickerModal, type NewRecordKind } from './components/NewRecordPickerModal';
import { SimulationModal } from './components/SimulationModal';
import { LoanPrepaymentModal } from './components/LoanPrepaymentModal';
import { ForsetiSetupModal } from './components/ForsetiSetupModal';
import { topicFromStepIndex, type SetupTopic } from './utils/setupCatalog';
import type { Movement, MovementType, SimulationPresetId } from './types';
import './App.css';

/** Reabre o "+" depois da troca de planejamento pedida na visão consolidada. */
const PENDING_NEW_RECORD_KEY = 'balder_pending_new_record';

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
      <PlanScopeProvider>
        <ScopedFinancialApp />
      </PlanScopeProvider>
    </AccountScopeProvider>
  );
}

/** Recria o contexto financeiro ao trocar entre a própria conta, uma conta compartilhada e os planejamentos próprios. */
function ScopedFinancialApp() {
  const { viewing } = useAccountScope();
  const { activePlanId } = usePlans();
  return (
    <FinancialProvider key={viewing?.ownerId ? `v:${viewing.ownerId}` : activePlanId ? `p:${activePlanId}` : 'own'}>
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
  const { viewPreferences, activeCheckpoint, registerForsetiNavigator } = useFinancial();
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
  // Visão consolidada (soma dos planejamentos marcados): ocupa o lugar da tela até o usuário escolher outra
  const { consolidated, setConsolidated, compareIds, plans, activePlanId, switchPlan, mainPlan } = usePlans();
  // Na visão consolidada o lançamento precisa de um planejamento de destino, confirmado antes de começar
  const [planChoiceOpen, setPlanChoiceOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  // Texto que já abre escrito no campo do chat da Forseti (ex.: ditado na Início)
  const [forsetiDraft, setForsetiDraft] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);

  // Onboarding Get Started State
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingTopic, setOnboardingTopic] = useState<SetupTopic | undefined>(undefined);
  const [onboardingRun, setOnboardingRun] = useState(0);

  // Global Modals State
  const [newMovementModalOpen, setNewMovementModalOpen] = useState(false);
  // Depois de escolher o destino na visão consolidada a tela é recriada no planejamento escolhido: o "+" reabre lá
  const [recordPickerOpen, setRecordPickerOpen] = useState(() => {
    try {
      const pending = sessionStorage.getItem(PENDING_NEW_RECORD_KEY);
      if (pending) sessionStorage.removeItem(PENDING_NEW_RECORD_KEY);
      return !!pending;
    } catch {
      return false;
    }
  });
  // Lançamento começado e deixado em suspensão por 5 minutos (retomado pelo botão da barra superior)
  const SUSPEND_MS = 5 * 60 * 1000;
  const [suspended, setSuspended] = useState<{ draft: MovementDraft; expiresAt: number } | null>(null);
  const [resumeDraft, setResumeDraft] = useState<MovementDraft | null>(null);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  useEffect(() => {
    if (!suspended) return;
    const id = window.setTimeout(() => setSuspended(null), Math.max(0, suspended.expiresAt - Date.now()));
    return () => window.clearTimeout(id);
  }, [suspended]);
  const [newInvoiceSignal, setNewInvoiceSignal] = useState(0);
  const [newLoanSignal, setNewLoanSignal] = useState(0);
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
    // O pedido de "novo empréstimo" vale uma vez; ao navegar, não pode reabrir o simulador
    setNewLoanSignal(0);
    if (tab !== 'COPILOT') setConsolidated(false);
    if (tab === 'COPILOT') {
      setIsCopilotOpen(true);
    } else {
      setActiveTab(tab);
      setIsCopilotOpen(false);
    }
  };

  // A Forseti abre telas a pedido (depois da confirmação no chat)
  useEffect(() => {
    registerForsetiNavigator((tab) => handleSelectTab(tab as TabId));
    return () => registerForsetiNavigator(null);
  });

  const handleOpenNewMovement = (
    type: MovementType = 'PAGAR',
    initialData?: Partial<Movement>
  ) => {
    // Lançamento novo limpa o que estava em suspensão
    setSuspended(null);
    setResumeDraft(null);
    setDefaultMovementType(type);
    setInitialMovementData(initialData);
    setNewMovementModalOpen(true);
  };

  // "+": com um lançamento em suspensão, pergunta se quer retomá-lo antes de começar outro
  const openNewRecord = () => {
    if (consolidated) {
      setPlanChoiceOpen(true);
      return;
    }
    if (suspended && suspended.expiresAt > Date.now()) setResumePromptOpen(true);
    else setRecordPickerOpen(true);
  };
  const chooseTargetPlan = (key: string) => {
    setPlanChoiceOpen(false);
    const target = key === MAIN_PLAN_KEY ? null : key;
    setConsolidated(false);
    if (target === activePlanId) {
      setRecordPickerOpen(true);
      return;
    }
    try {
      sessionStorage.setItem(PENDING_NEW_RECORD_KEY, '1');
    } catch {
      // sem armazenamento: o planejamento muda e o "+" é tocado de novo
    }
    switchPlan(target);
  };
  const resumeSuspended = () => {
    if (!suspended) return;
    setResumePromptOpen(false);
    setResumeDraft(suspended.draft);
    setDefaultMovementType(suspended.draft.type);
    setInitialMovementData(undefined);
    setSuspended(null);
    setNewMovementModalOpen(true);
  };
  const startNewDiscardingSuspended = () => {
    setSuspended(null);
    setResumePromptOpen(false);
    setRecordPickerOpen(true);
  };

  // Escolha do "+": cada tipo leva à tela específica do cadastro
  const handleSelectRecordKind = (kind: NewRecordKind) => {
    setRecordPickerOpen(false);
    if (kind === 'PAGAR' || kind === 'RECEBER') handleOpenNewMovement(kind);
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
          onOpenNewMovementModal={openNewRecord}
          suspendedDraft={suspended ? { label: suspended.draft.title.trim() || 'sem título', expiresAt: suspended.expiresAt } : null}
          onResumeDraft={resumeSuspended}
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
          {consolidated && <ConsolidatedPage />}

          {/* No celular, toda tela (menos o Início) tem um atalho de volta no topo */}
          {!consolidated && shownTab !== 'INICIO' && !planningOnly && (
            <button type="button" className="back-home-btn" onClick={() => setActiveTab('INICIO')}>
              <ArrowLeft size={16} />
              <span>Início</span>
            </button>
          )}

          {!consolidated && shownTab === 'INICIO' && (
            <HomeHubPage
              onNavigate={handleSelectTab}
              onOpenForseti={(draft) => {
                setForsetiDraft(draft || '');
                setIsCopilotOpen(true);
              }}
              onOpenOnboarding={handleOpenOnboarding}
              onPlanWithOthers={() => {
                setActiveTab('COMPARTILHADO');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {!consolidated && (shownTab === 'DASHBOARD' || shownTab === 'COPILOT') && (
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

          {!consolidated && shownTab === 'MOVIMENTACOES' && (
            <MovementsPage
              onOpenNewMovementModal={handleOpenNewMovement}
              onOpenNewRecordPicker={openNewRecord}
            />
          )}

          {!consolidated && shownTab === 'FATURAS' && <InvoicesPage newInvoiceSignal={newInvoiceSignal} />}

          {!consolidated && shownTab === 'NATUREZAS' && (
            <NaturezasPage onOpenNewMovementModal={handleOpenNewMovement} />
          )}

          {!consolidated && shownTab === 'EMPRESTIMOS' && <ContractsPage newLoanSignal={newLoanSignal} />}

          {!consolidated && shownTab === 'METAS' && <GoalsPage />}

          {!consolidated && shownTab === 'OPORTUNIDADES' && <PurchasesPage onRegisterPurchase={handleOpenNewMovement} />}

          {!consolidated && shownTab === 'COMPARTILHADO' && <SharedPlanningPage />}

          {!consolidated && shownTab === 'PERFIL' && (
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
              initialDraft={forsetiDraft}
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
          setResumeDraft(null);
        }}
        resumeDraft={resumeDraft}
        onSuspend={(draft) => setSuspended({ draft, expiresAt: Date.now() + SUSPEND_MS })}
        onSaved={() => setSuspended(null)}
        defaultType={defaultMovementType}
        initialData={initialMovementData}
      />

      <Modal
        isOpen={resumePromptOpen}
        onClose={() => setResumePromptOpen(false)}
        title="Há um lançamento em suspensão"
        subtitle="Você começou um lançamento e deixou para depois. Quer retomá-lo antes de começar outro?"
        maxWidth="460px"
      >
        {suspended && (
          <p className="text-sm" style={{ marginBottom: 16 }}>
            <strong>{suspended.draft.title.trim() || 'Sem título'}</strong>
            {suspended.draft.amount ? ` · R$ ${suspended.draft.amount}` : ''}
          </p>
        )}
        <div className="modal-footer-actions">
          <button type="button" className="btn btn-outline" onClick={startNewDiscardingSuspended}>
            Descartar e começar outro
          </button>
          <button type="button" className="btn btn-primary" onClick={resumeSuspended}>
            Retomar
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={planChoiceOpen}
        onClose={() => setPlanChoiceOpen(false)}
        title="Em qual planejamento lançar?"
        subtitle="Você está na visão consolidada, que é só leitura. O lançamento será feito dentro do planejamento que escolher."
        maxWidth="460px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {compareIds.map((key) => (
            <button key={key} type="button" className="btn btn-outline" onClick={() => chooseTargetPlan(key)}>
              {key === MAIN_PLAN_KEY ? `${mainPlan.name} (principal)` : plans.find((p) => p.id === key)?.name || 'Planejamento'}
            </button>
          ))}
        </div>
      </Modal>

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

      <PlanSettingsModal />
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
