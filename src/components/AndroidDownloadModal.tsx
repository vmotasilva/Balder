import React from 'react';
import { Smartphone, Download, X, CheckCircle2, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

interface AndroidDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidDownloadModal: React.FC<AndroidDownloadModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="android-download-overlay animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Download do Aplicativo Android"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="android-download-modal glass-card">
        {/* Header */}
        <div className="android-download-header">
          <div className="android-header-icon-box">
            <Smartphone size={24} className="text-emerald" />
          </div>
          <div className="android-header-info">
            <div className="flex items-center gap-2">
              <h2 className="android-modal-title">Balder para Android</h2>
              <span className="badge-pill badge-pill-emerald">APK Nativo</span>
            </div>
            <p className="android-modal-sub">Versão oficial 1.0.0 • React Native & Expo</p>
          </div>
          <button
            type="button"
            className="android-modal-close-btn cursor-pointer"
            onClick={onClose}
            title="Fechar"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="android-download-body">
          {/* Highlights */}
          <div className="android-features-grid">
            <div className="android-feature-item">
              <ShieldCheck size={16} className="text-cyan" />
              <span>Multi-tenant Isolado com Supabase RLS</span>
            </div>
            <div className="android-feature-item">
              <Sparkles size={16} className="text-amber" />
              <span>Forseti IA com Reconhecimento OCR</span>
            </div>
            <div className="android-feature-item">
              <CheckCircle2 size={16} className="text-emerald" />
              <span>Gestão de Dívidas & Simulador PRICE</span>
            </div>
          </div>

          {/* Primary Download Action Card */}
          <div className="android-download-action-card">
            <a
              href="/balder-android.apk"
              download="balder-android.apk"
              className="android-download-btn cursor-pointer"
              onClick={() => {
                // Notificação amigável
              }}
            >
              <div className="android-dl-icon-circle">
                <Download size={22} className="text-white" />
              </div>
              <div className="android-dl-btn-text">
                <span className="android-dl-btn-title">Baixar Pacote APK (.apk)</span>
                <span className="android-dl-btn-meta">Instalação direta no smartphone Android • ~33 MB</span>
              </div>
            </a>
          </div>

          {/* Step-by-Step Installation Guide */}
          <div className="android-install-guide">
            <div className="guide-title-row">
              <AlertCircle size={15} className="text-amber" />
              <h4>Como instalar no seu celular em 3 passos:</h4>
            </div>
            <ol className="guide-steps-list">
              <li>
                <strong>1. Baixe o arquivo:</strong> Toque no botão acima e confirme o download no seu navegador.
              </li>
              <li>
                <strong>2. Autorize a instalação:</strong> Abra o arquivo baixado. Se o Android exibir o aviso <em>"Para sua segurança, seu telefone não tem permissão para instalar apps desconhecidos desta fonte"</em>, toque em <strong>Configurações</strong> e ative <strong>Permitir desta fonte</strong>.
              </li>
              <li>
                <strong>3. Conclua a instalação:</strong> Toque em <strong>Instalar</strong> e faça login com sua conta Google oficial.
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="android-download-footer">
          <button type="button" className="btn btn-secondary w-full" onClick={onClose}>
            Entendido / Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
