import React, { useState, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import { auditOnboardingProgress } from '../utils/onboardingProgress';

interface ForsetiSetupChecklistProps {
  onOpenOnboarding: (stepIndex?: number) => void;
}

export const ForsetiSetupChecklist: React.FC<ForsetiSetupChecklistProps> = ({
  onOpenOnboarding,
}) => {
  const {
    activeCheckpoint,
    salaryContracts,
    movements,
    cards,
    accounts,
    banks,
    natures,
  } = useFinancial();

  const [isCollapsed, setIsCollapsed] = useState(false);

  const audit = useMemo(
    () =>
      auditOnboardingProgress({
        activeCheckpoint,
        salaryContracts,
        movements,
        cards,
        accounts,
        banks,
        natures,
      }),
    [activeCheckpoint, salaryContracts, movements, cards, accounts, banks, natures]
  );

  // Se tudo estiver concluído e o usuário tiver recolhido, exibe apenas um mini badge discreto
  if (audit.isAllComplete && isCollapsed) {
    return (
      <div className="forseti-checklist-compact glass-card animate-fade-in mb-4">
        <div className="flex items-center gap-2">
          <div className="forseti-compact-avatar">
            <img src="/forseti-avatar.png" alt="Forseti" className="w-5 h-5 rounded-full" />
            <span className="forseti-pulse-dot" />
          </div>
          <span className="text-xs font-semibold text-emerald-400">
            Sistema 100% Calibrado pela Forseti (5 de 5 Pilares)
          </span>
        </div>
        <button
          type="button"
          className="text-xs text-muted hover:text-cyan flex items-center gap-1 cursor-pointer transition-colors"
          onClick={() => setIsCollapsed(false)}
        >
          <span>Ver Pilares</span>
          <ChevronDown size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`forseti-setup-checklist-card glass-card animate-fade-in mb-6 ${
        audit.isAllComplete ? 'completed-theme' : 'pending-theme'
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
                {audit.isAllComplete
                  ? 'Sistema 100% Calibrado pela Forseti'
                  : 'Calibração do Balder: Pilares do Get Started'}
              </h3>
              <span
                className={`badge-pill ${
                  audit.isAllComplete ? 'badge-pill-emerald' : 'badge-pill-amber'
                }`}
              >
                {audit.percent}% • {audit.completedCount} de {audit.totalCount} Concluídos
              </span>
            </div>

            <p className="checklist-subtitle">
              {audit.summaryMessage}
            </p>
          </div>
        </div>

        <div className="checklist-header-actions">
          <button
            type="button"
            className="btn-icon-ghost"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expandir checklist' : 'Recolher checklist'}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* Barra de Progresso */}
      <div className="checklist-progress-bar">
        <div
          className="checklist-progress-fill"
          style={{ width: `${Math.max(audit.percent, 4)}%` }}
        />
      </div>

      {/* Grid dos 5 Pilares */}
      {!isCollapsed && (
        <>
          <div className="checklist-steps-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {audit.steps.map((step, idx) => {
              const isDone = step.status === 'DONE';
              const isPartial = step.status === 'PARTIAL';

              return (
                <div
                  key={step.id}
                  className={`checklist-step-item ${isDone ? 'done' : isPartial ? 'partial active' : 'pending'}`}
                >
                  <div className="step-icon-container">
                    {isDone ? (
                      <CheckCircle2 size={18} className="text-emerald" />
                    ) : isPartial ? (
                      <AlertCircle size={18} className="text-amber" />
                    ) : (
                      <Clock size={18} className="text-amber" />
                    )}
                  </div>
                  <div className="step-content">
                    <div className="step-title-row">
                      <span className="step-title">
                        {idx + 1}. {step.title}
                      </span>
                      <span
                        className={`step-status-tag ${
                          isDone ? 'done' : isPartial ? 'partial' : 'pending'
                        }`}
                      >
                        {isDone ? 'Concluído' : isPartial ? 'Parcial' : 'Pendente'}
                      </span>
                    </div>

                    <p className="step-desc">{step.description}</p>

                    {step.missingHint && !isDone && (
                      <div className="flex items-start gap-1.5 mt-2 text-xs text-amber-300/90 bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                        <Lightbulb size={13} className="shrink-0 mt-0.5 text-amber-400" />
                        <span>{step.missingHint}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className={`btn btn-xs ${isDone ? 'btn-ghost text-muted' : 'btn-outline text-cyan border-cyan/40 hover:bg-cyan/10'}`}
                    onClick={() => onOpenOnboarding(step.stepIndex)}
                    title={`Abrir Passo ${step.stepIndex} no Get Started`}
                  >
                    {step.actionLabel}
                  </button>
                </div>
              );
            })}
          </div>

          {/* CTA Inferior se ainda houver pendências */}
          {!audit.isAllComplete && audit.nextSuggestedStep && (
            <div className="checklist-bottom-cta flex items-center justify-between flex-wrap gap-3 mt-4 pt-3 border-t border-white/5">
              <span className="text-xs text-muted flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400 shrink-0" />
                <span>
                  Próximo passo recomendado: <strong>{audit.nextSuggestedStep.title}</strong>
                </span>
              </span>

              <button
                type="button"
                className="btn btn-primary btn-sm flex items-center gap-2 cursor-pointer shadow-md"
                onClick={() => onOpenOnboarding(audit.nextSuggestedStep!.stepIndex)}
              >
                <span>{audit.nextSuggestedStep.actionLabel}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
