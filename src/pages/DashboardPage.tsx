import React, { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { Sparkles, MapPin, Users, UserCheck } from 'lucide-react';
import type { SimulationPresetId } from '../types';

export type DashboardTab = 'PROJECAO_MES' | 'PROJECAO_TOTAL';
import { MonthlyProjectionGrid } from '../components/MonthlyProjectionGrid';
import { CheckpointSetupModal } from '../components/CheckpointSetupModal';
import { QuickActionsDropdown } from '../components/QuickActionsDropdown';

interface DashboardPageProps {
  onNavigateToMovements?: () => void;
  onNavigateToGoals: () => void;
  onNavigateToCopilot: () => void;
  onNavigateToLoans?: () => void;
  onNavigateToNatures?: () => void;
  onNavigateToShared?: () => void;
  onOpenSimulation: (preset?: SimulationPresetId, mode?: 'PRESETS' | 'STUDIO') => void;
  onOpenPrepayment?: () => void;
  onOpenOnboarding?: (stepIndex?: number) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToCopilot,
  onNavigateToLoans,
  onNavigateToShared,
  onOpenSimulation,
  onOpenPrepayment,
  onOpenOnboarding,
}) => {
  const {
    isDataReady,
    activeCheckpoint,
    activeTrackingScope,
    defaultTrackingScope,
    setActiveTrackingScope,
  } = useFinancial();

  const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false);

  // Aguarda os dados do Supabase antes de renderizar para evitar flash de dados demo
  if (!isDataReady) {
    return (
      <div className="page-container animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(6,182,212,0.3)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Carregando dados financeiros...</span>
      </div>
    );
  }

  return (

    <div className="page-container animate-fade-in">
      {/* Page Header */}
      <div className="page-header dashboard-page-header">
        <div className="dashboard-header-title-box">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <div className="kicker-badge" style={{ marginBottom: 0 }}>
              <span>DASHBOARD FINANCEIRO</span>
            </div>

            {/* Seletor de Escopo: Próprio vs Compartilhado */}
            <div className="inline-flex items-center p-0.5 rounded-full bg-black/40 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setActiveTrackingScope('INDIVIDUAL')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium transition-all cursor-pointer ${
                  activeTrackingScope === 'INDIVIDUAL'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-muted hover:text-white'
                }`}
                title={defaultTrackingScope === 'INDIVIDUAL' ? 'Acompanhamento Próprio (Definido como Principal ⭐)' : 'Alternar para Acompanhamento Próprio'}
              >
                <UserCheck size={12} />
                <span>Próprio</span>
                {defaultTrackingScope === 'INDIVIDUAL' && (
                  <span className="text-[10px] text-amber-400 font-bold" title="Acompanhamento Principal">★</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTrackingScope('COMPARTILHADO');
                  if (onNavigateToShared && activeTrackingScope === 'COMPARTILHADO') {
                    onNavigateToShared();
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium transition-all cursor-pointer ${
                  activeTrackingScope === 'COMPARTILHADO'
                    ? 'bg-purple-500/20 text-pink-300 border border-purple-500/40 shadow-sm'
                    : 'text-muted hover:text-white'
                }`}
                title={defaultTrackingScope === 'COMPARTILHADO' ? 'Acompanhamento Compartilhado (Definido como Principal ⭐)' : 'Alternar para Acompanhamento Compartilhado'}
              >
                <Users size={12} />
                <span>Compartilhado</span>
                {defaultTrackingScope === 'COMPARTILHADO' && (
                  <span className="text-[10px] text-amber-400 font-bold" title="Acompanhamento Principal">★</span>
                )}
              </button>
            </div>

            {activeCheckpoint && (
              <button
                onClick={() => setIsCheckpointModalOpen(true)}
                title="Clique para gerenciar ou criar novo marco de acompanhamento"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 transition-all cursor-pointer"
              >
                <MapPin size={12} className="text-indigo-400" />
                <span>
                  Marco desde <strong>{activeCheckpoint.startDate.split('-').reverse().join('/')}</strong>
                </span>
              </button>
            )}
          </div>
          <h1 className="page-title dashboard-page-title">Meu Dinheiro</h1>
          <p className="page-subtitle dashboard-page-subtitle">
            Sua visão consolidada de patrimônio, liquidez imediata e futuro projetado
          </p>
        </div>

        <div className="page-header-actions dashboard-header-actions flex items-center gap-2">
          <QuickActionsDropdown
            onOpenSimulation={onOpenSimulation}
            onNavigateToLoans={onNavigateToLoans}
            onOpenPrepayment={onOpenPrepayment}
            onOpenCheckpoint={() => setIsCheckpointModalOpen(true)}
            onOpenOnboarding={onOpenOnboarding}
            size="sm"
          />
          <button className="btn btn-secondary" onClick={onNavigateToCopilot}>
            <Sparkles size={16} className="text-cyan" />
            <span>Consultar Forseti</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* CONTEÚDO 2: PROJEÇÃO TOTAL (GRID ORÇAMENTÁRIA MÊS A MÊS)       */}
      {/* ============================================================== */}
      {(
        <div key="projecao-total" className="dashboard-tab-content animate-fade-in">
          <section className="dashboard-section">
            <MonthlyProjectionGrid />
          </section>
        </div>
      )}

      {/* Modal de Configuração do Marco de Acompanhamento */}
      <CheckpointSetupModal
        isOpen={isCheckpointModalOpen}
        onClose={() => setIsCheckpointModalOpen(false)}
        isInitialSetup={!activeCheckpoint}
      />
    </div>
  );
};
