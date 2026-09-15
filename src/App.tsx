import { useState } from 'react';
import { FinancialProvider } from './context/FinancialContext';
import { Sidebar } from './components/Sidebar';
import type { TabId } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { MovementsPage } from './pages/MovementsPage';
import { CopilotPage } from './pages/CopilotPage';
import { GoalsPage } from './pages/GoalsPage';
import { ProfilePage } from './pages/ProfilePage';
import { NewMovementModal } from './components/NewMovementModal';
import { SimulationModal } from './components/SimulationModal';
import type { MovementType } from './types';
import './App.css';

export function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('DASHBOARD');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Global Modals State
  const [newMovementModalOpen, setNewMovementModalOpen] = useState(false);
  const [defaultMovementType, setDefaultMovementType] = useState<MovementType>('PAGAR');

  const [simulationModalOpen, setSimulationModalOpen] = useState(false);
  const [simulationPreset, setSimulationPreset] = useState<'CARRO' | 'QUITAR_DIVIDA' | 'FINANCIAMENTO' | 'IMOVEL'>('CARRO');

  const handleOpenNewMovement = (type: MovementType = 'PAGAR') => {
    setDefaultMovementType(type);
    setNewMovementModalOpen(true);
  };

  const handleOpenSimulation = (preset: 'CARRO' | 'QUITAR_DIVIDA' | 'FINANCIAMENTO' | 'IMOVEL' = 'CARRO') => {
    setSimulationPreset(preset);
    setSimulationModalOpen(true);
  };

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Layout */}
      <div className="app-main-layout">
        <Navbar
          onOpenNewMovementModal={() => handleOpenNewMovement('PAGAR')}
          onOpenSimulationModal={() => handleOpenSimulation('CARRO')}
        />

        <main className="app-content-viewport">
          {activeTab === 'DASHBOARD' && (
            <DashboardPage
              onNavigateToMovements={() => setActiveTab('MOVIMENTACOES')}
              onNavigateToGoals={() => setActiveTab('METAS')}
              onNavigateToCopilot={() => setActiveTab('COPILOT')}
              onOpenSimulation={handleOpenSimulation}
            />
          )}

          {activeTab === 'MOVIMENTACOES' && (
            <MovementsPage onOpenNewMovementModal={handleOpenNewMovement} />
          )}

          {activeTab === 'COPILOT' && <CopilotPage />}

          {activeTab === 'METAS' && <GoalsPage />}

          {activeTab === 'PERFIL' && <ProfilePage />}
        </main>
      </div>

      {/* Global Modals */}
      <NewMovementModal
        isOpen={newMovementModalOpen}
        onClose={() => setNewMovementModalOpen(false)}
        defaultType={defaultMovementType}
      />

      <SimulationModal
        isOpen={simulationModalOpen}
        onClose={() => setSimulationModalOpen(false)}
        initialPreset={simulationPreset}
      />
    </div>
  );
}

export default function App() {
  return (
    <FinancialProvider>
      <AppContent />
    </FinancialProvider>
  );
}
