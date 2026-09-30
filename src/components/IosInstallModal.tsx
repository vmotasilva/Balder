import React from 'react';
import { Smartphone, Share, SquarePlus, CheckCircle2, X, AlertCircle } from 'lucide-react';

interface IosInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** iPhone/iPad (o iPadOS se apresenta como Mac, mas tem tela de toque). */
export const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** Já aberto pelo ícone da Tela de Início (modo app). */
export const isStandalone = () =>
  typeof window !== 'undefined' &&
  ((navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches);

/**
 * No iPhone não existe instalação por arquivo (como o APK do Android): o Balder vira app pelo
 * "Adicionar à Tela de Início", abrindo em tela cheia com o próprio ícone.
 */
export const IosInstallModal: React.FC<IosInstallModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="android-download-overlay animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Instalar o Balder no iPhone"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="android-download-modal glass-card">
        <div className="android-download-header">
          <div className="android-header-icon-box">
            <Smartphone size={24} className="text-cyan" />
          </div>
          <div className="android-header-info">
            <h2 className="android-modal-title">Balder no iPhone</h2>
            <p className="android-modal-sub">Instale pela Tela de Início • sem App Store</p>
          </div>
          <button type="button" className="android-modal-close-btn cursor-pointer" onClick={onClose} title="Fechar" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="android-download-body">
          <div className="android-install-guide">
            <div className="guide-title-row">
              <AlertCircle size={15} className="text-amber" />
              <h4>Como instalar em 3 passos:</h4>
            </div>
            <ol className="guide-steps-list">
              <li>
                <strong>1. Abra no Safari:</strong> acesse <strong>balder-one.vercel.app</strong> pelo Safari (no Chrome do iPhone também
                funciona, pelo mesmo menu de compartilhar).
              </li>
              <li>
                <strong>2. Toque em Compartilhar</strong> <Share size={14} className="ios-inline-icon" /> na barra do navegador.
              </li>
              <li>
                <strong>3. Escolha "Adicionar à Tela de Início"</strong> <SquarePlus size={14} className="ios-inline-icon" /> e
                confirme em <strong>Adicionar</strong>.
              </li>
            </ol>
          </div>

          <div className="android-features-grid">
            <div className="android-feature-item">
              <CheckCircle2 size={16} className="text-emerald" />
              <span>Abre em tela cheia, com o ícone do Balder</span>
            </div>
            <div className="android-feature-item">
              <CheckCircle2 size={16} className="text-emerald" />
              <span>Sempre na versão mais nova, sem atualizar pela loja</span>
            </div>
          </div>
        </div>

        <div className="android-download-footer">
          <button type="button" className="btn btn-secondary w-full" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
