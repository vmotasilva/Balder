import React from 'react';
import { X } from 'lucide-react';
import { ForsetiTopicSetup } from './ForsetiTopicSetup';
import type { SetupTopic } from '../utils/setupCatalog';

interface ForsetiSetupModalProps {
  isOpen: boolean;
  /** Assunto em que a conversa começa; sem ele, a Forseti pergunta por onde começar. */
  topic?: SetupTopic;
  onClose: () => void;
}

/** Configuração conversada com a Forseti, aberta de qualquer tela (pendências, atalhos, perfil). */
export const ForsetiSetupModal: React.FC<ForsetiSetupModalProps> = ({ isOpen, topic, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="onboarding-overlay animate-fade-in" role="dialog" aria-modal="true" aria-label="Configuração com a Forseti">
      <div className="onboarding-dialog glass-card">
        <div className="onboarding-top-bar">
          <div className="flex items-center gap-3">
            <div className="forseti-avatar-box">
              <img src="/forseti-avatar.png" alt="Forseti" className="forseti-avatar-img" />
              <span className="forseti-pulse-dot" />
            </div>
            <div>
              <span className="onboarding-forseti-name">Forseti</span>
              <p className="onboarding-top-sub">Configuração do seu Balder</p>
            </div>
          </div>
          <button type="button" className="onboarding-close-btn" onClick={onClose} title="Continuar depois" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="onboarding-body-container">
          <ForsetiTopicSetup initialTopic={topic} onFinished={onClose} finishLabel="Fechar" />
        </div>
      </div>
    </div>
  );
};
