import React, { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ForsetiSetupChecklistProps {
  onOpenOnboarding: (stepIndex?: number) => void;
}

export const ForsetiSetupChecklist: React.FC<ForsetiSetupChecklistProps> = ({
  onOpenOnboarding,
}) => {
  const { activeCheckpoint, movements, cards, natures } = useFinancial();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 1. Ponto de Partida definido?
  const hasCheckpoint = !!activeCheckpoint;

  // 2. Faturas em aberto cadastradas?
  const cardMovements = movements.filter((m) => m.type === 'CARTAO');
  const hasInvoices = cardMovements.length > 0 || cards.length > 0;

  // 3. Naturezas cadastradas?
  const hasNatures = natures.length > 0;

  const completedSteps =
    (hasCheckpoint ? 1 : 0) + (hasInvoices ? 1 : 0) + (hasNatures ? 1 : 0);
  const isAllComplete = completedSteps === 3;

  // Se tudo estiver concluído e o usuário tiver recolhido, exibe apenas um mini badge discreto
  if (isAllComplete && isCollapsed) {
    return (
      <div className="forseti-checklist-compact glass-card animate-fade-in">
        <div className="flex items-center gap-2">
          <div className="forseti-compact-avatar">
            <img src="/forseti-avatar.png" alt="Forseti" className="w-5 h-5 rounded-full" />
            <span className="forseti-pulse-dot" />
          </div>
          <span className="text-xs font-semibold text-emerald-400">
            Sistema 100% Calibrado pela Forseti
          </span>
        </div>
        <button
          type="button"
          className="text-xs text-muted hover:text-cyan flex items-center gap-1 cursor-pointer transition-colors"
          onClick={() => setIsCollapsed(false)}
        >
          <span>Ver Detalhes</span>
          <ChevronDown size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`forseti-setup-checklist-card glass-card animate-fade-in ${
        isAllComplete ? 'completed-theme' : 'pending-theme'
      }`}
    >
      <div className="checklist-header">
        <div className="checklist-header-left">
          <div className="forseti-avatar-box">
            <img
              src="/forseti-avatar.png"
              alt="Forseti IA"
              className="forseti-avatar-img"
              style={{ width: 44, height: 44, minWidth: 44, minHeight: 44, objectFit: 'cover', borderRadius: 12 }}
            />
            <span className="forseti-pulse-dot" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="checklist-title">
                {isAllComplete
                  ? 'Sistema 100% Calibrado pela Forseti'
                  : 'Pendências da Forseti: Calibração Inicial do Sistema'}
              </h3>
              <span
                className={`badge-pill ${
                  isAllComplete ? 'badge-pill-emerald' : 'badge-pill-amber'
                }`}
              >
                {completedSteps} de 3 Concluídos
              </span>
            </div>

            <p className="checklist-subtitle">
              {isAllComplete
                ? 'Seu ponto de partida, faturas e tetos orçamentários estão sincronizados com precisão.'
                : 'Para que a Forseti possa auditar seus gastos e projetar seu fluxo de 30 dias com precisão, conclua os 3 pilares:'}
            </p>
          </div>
        </div>

        <div className="checklist-header-actions">
          {isAllComplete && (
            <button
              type="button"
              className="btn-icon-ghost"
              onClick={() => setIsCollapsed(true)}
              title="Recolher aviso"
            >
              <ChevronUp size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Barra de Progresso */}
      <div className="checklist-progress-bar">
        <div
          className="checklist-progress-fill"
          style={{ width: `${(completedSteps / 3) * 100}%` }}
        />
      </div>

      {/* Grid das 3 Pendências */}
      <div className="checklist-steps-grid">
        {/* Item 1: Ponto de Partida */}
        <div className={`checklist-step-item ${hasCheckpoint ? 'done' : 'pending'}`}>
          <div className="step-icon-container">
            {hasCheckpoint ? (
              <CheckCircle2 size={18} className="text-emerald" />
            ) : (
              <Clock size={18} className="text-amber" />
            )}
          </div>
          <div className="step-content">
            <div className="step-title-row">
              <span className="step-title">1. Ponto de Partida</span>
              <span className={`step-status-tag ${hasCheckpoint ? 'done' : 'pending'}`}>
                {hasCheckpoint ? 'Definido' : 'Pendente'}
              </span>
            </div>
            <p className="step-desc">
              {hasCheckpoint
                ? `Ancorado a partir de ${activeCheckpoint?.startDate.split('-').reverse().join('/')}`
                : 'Defina a data e o saldo inicial em contas para ancorar o patrimônio.'}
            </p>
          </div>
          {!hasCheckpoint && (
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={() => onOpenOnboarding(1)}
            >
              Definir
            </button>
          )}
        </div>

        {/* Item 2: Faturas em Aberto */}
        <div className={`checklist-step-item ${hasInvoices ? 'done' : 'pending'}`}>
          <div className="step-icon-container">
            {hasInvoices ? (
              <CheckCircle2 size={18} className="text-emerald" />
            ) : (
              <Clock size={18} className="text-amber" />
            )}
          </div>
          <div className="step-content">
            <div className="step-title-row">
              <span className="step-title">2. Faturas em Aberto</span>
              <span className={`step-status-tag ${hasInvoices ? 'done' : 'pending'}`}>
                {hasInvoices ? 'Registradas' : 'Pendente'}
              </span>
            </div>
            <p className="step-desc">
              {hasInvoices
                ? `${cards.length} cartão(ões) e faturas provisionados no fluxo.`
                : 'Informe os valores de faturas aberta (atual) e futura para previsão de fluxo.'}
            </p>
          </div>
          {!hasInvoices && (
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={() => onOpenOnboarding(2)}
            >
              Informar
            </button>
          )}
        </div>

        {/* Item 3: Naturezas & Mapeamentos */}
        <div className={`checklist-step-item ${hasNatures ? 'done' : 'pending'}`}>
          <div className="step-icon-container">
            {hasNatures ? (
              <CheckCircle2 size={18} className="text-emerald" />
            ) : (
              <Clock size={18} className="text-amber" />
            )}
          </div>
          <div className="step-content">
            <div className="step-title-row">
              <span className="step-title">3. Naturezas & Mapeamentos</span>
              <span className={`step-status-tag ${hasNatures ? 'done' : 'pending'}`}>
                {hasNatures ? 'Ativas' : 'Pendente'}
              </span>
            </div>
            <p className="step-desc">
              {hasNatures
                ? `${natures.length} naturezas com mapeamentos de rotinas e tetos calculados.`
                : 'Defina naturezas e crie mapeamentos de rotinas de compras para o cálculo automático do teto.'}
            </p>
          </div>
          {!hasNatures && (
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={() => onOpenOnboarding(3)}
            >
              Configurar
            </button>
          )}
        </div>
      </div>

      {/* CTA Inferior se ainda houver pendências */}
      {!isAllComplete && (
        <div className="checklist-bottom-cta">
          <button
            type="button"
            className="btn btn-primary btn-sm flex items-center gap-2 cursor-pointer shadow-md"
            onClick={() =>
              onOpenOnboarding(
                !hasCheckpoint ? 1 : !hasInvoices ? 2 : 3
              )
            }
          >
            <Sparkles size={14} className="text-amber" />
            <span>Continuar Calibração com a Forseti</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
