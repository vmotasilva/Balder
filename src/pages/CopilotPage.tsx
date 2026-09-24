import React, { useState, useRef, useEffect } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { ReceiptReconciliationCard } from '../components/ReceiptReconciliationCard';
import { Send, Sparkles, User, Image as ImageIcon, X, Paperclip, UploadCloud, Info, Plus, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import type { TabId } from '../components/Sidebar';
import type { CopilotAttachment } from '../types';

export interface CopilotPageProps {
  onBack?: () => void;
  activeScreen?: TabId;
  isPopup?: boolean;
  onOpenOnboarding?: (stepIndex?: number) => void;
}

const SCREEN_NAMES: Record<TabId, string> = {
  DASHBOARD: 'Meu Dinheiro (Dashboard)',
  MOVIMENTACOES: 'Lançamentos & Movimentações',
  FATURAS: 'Faturas de Cartão',
  NATUREZAS: 'Naturezas & Tetos',
  EMPRESTIMOS: 'Empréstimos (PRICE)',
  METAS: 'Metas Financeiras',
  COMPARTILHADO: 'Planejamento Conjunto & Mútuo',
  PERFIL: 'Perfil & Configurações',
  COPILOT: 'Forseti IA',
};

export const CopilotPage: React.FC<CopilotPageProps> = ({
  onBack,
  activeScreen = 'DASHBOARD',
  isPopup = false,
  onOpenOnboarding,
}) => {
  const { chatHistory, sendMessageToCopilot, respondToCopilotOption, reconcileReceiptData, natures, activeCheckpoint, movements } = useFinancial();
  const [inputQuery, setInputQuery] = useState('');
  const [attachedImages, setAttachedImages] = useState<CopilotAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, attachedImages]);

  // Fechar popover do '+' e modal ao clicar fora ou pressionar Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showRolesModal) {
          setShowRolesModal(false);
        } else if (showPlusMenu) {
          setShowPlusMenu(false);
        } else if (onBack) {
          onBack();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showRolesModal, showPlusMenu, onBack]);

  // Suporte a Colar Imagem da Área de Transferência (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            pastedFiles.push(file);
          }
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        processImageFiles(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const processImageFiles = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (validFiles.length === 0) {
      alert('Por favor, selecione arquivos de imagem válidos (PNG, JPG, WEBP, etc.).');
      return;
    }

    const newAttachments: CopilotAttachment[] = validFiles.map((file) => {
      const tempUrl = URL.createObjectURL(file);
      const sizeFormatted =
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`;

      return {
        url: tempUrl,
        name: file.name || 'comprovante.png',
        size: sizeFormatted,
        revoke: () => URL.revokeObjectURL(tempUrl),
      };
    });

    setAttachedImages((prev) => [...prev, ...newAttachments]);
  };

  const handleRemoveAttachedImage = (indexToRemove: number) => {
    setAttachedImages((prev) => {
      const target = prev[indexToRemove];
      if (target?.revoke) {
        target.revoke();
      }
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  };

  const handleClearAllAttachments = () => {
    attachedImages.forEach((img) => img.revoke?.());
    setAttachedImages([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImageFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFiles(e.dataTransfer.files);
    }
  };

  const handleSend = (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = customQuery || inputQuery;
    if (!query.trim() && attachedImages.length === 0) return;

    sendMessageToCopilot(query, attachedImages.length > 0 ? attachedImages : undefined);
    setInputQuery('');
    setAttachedImages([]);
  };

  const screenTitle = SCREEN_NAMES[activeScreen] || 'Meu Dinheiro';
  const screenShortTitle = screenTitle.split(' ')[0];

  const quickChips = [
    `🔍 Analisar esta tela (${screenShortTitle})`,
    '📸 Anexar Comprovante / Cupom',
    'Receberei R$ 8.500 dia 5.',
    'Paguei R$ 320 no mercado.',
    'Por que meu saldo projetado caiu?',
    'Posso comprar um carro?',
    'Simular quitação do empréstimo',
  ];

  const handleChipClick = (chip: string) => {
    if (chip.includes('Anexar Comprovante')) {
      fileInputRef.current?.click();
    } else if (chip.startsWith('🔍 Analisar esta tela')) {
      handleSend(undefined, `Forseti, analise a tela de ${screenTitle} aberta no Balder agora e me dê um diagnóstico.`);
    } else {
      handleSend(undefined, chip);
    }
  };

  // Detecta se há um card de OCR ativo (não conciliado) na última mensagem
  const lastAssistantMsg = [...chatHistory].reverse().find((m) => m.role === 'assistant');
  const hasActiveOcr = !!(lastAssistantMsg?.receiptReconciliation && !lastAssistantMsg.receiptReconciliation.isReconciled);

  return (
    <div className={`page-container copilot-page animate-fade-in ${isPopup ? 'is-popup-mode' : ''}`}>
      {/* Chat Container em Tela Cheia */}
      <div
        className={`copilot-chat-container ${isDragging ? 'is-dragging-file' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Topbar compacta do chat com status, botão voltar ao lado do avatar, e fechar */}
        <div className="copilot-chat-topbar">
          <div className="copilot-topbar-identity">
            {onBack && (
              <button
                type="button"
                className="copilot-back-btn"
                onClick={onBack}
                title="Voltar para a tela anterior"
                aria-label="Voltar para a tela anterior"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="copilot-topbar-avatar">
              <img src="/forseti-avatar.png" alt="Forseti" />
            </div>
            <div className="copilot-topbar-info">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="copilot-topbar-name">BALDER Forseti</span>
                <span className="copilot-status-dot" title="Forseti Operacional Online" />
                {screenTitle && (
                  <span className="copilot-screen-context-badge">
                    👁️ {screenTitle}
                  </span>
                )}
              </div>
              <span className="copilot-topbar-sub">Patrono da conciliação e auditoria financeira</span>
            </div>
          </div>

          <div className="copilot-topbar-actions">
            <button
              type="button"
              onClick={() => setShowRolesModal(true)}
              className="copilot-info-icon-btn cursor-pointer"
              title="Como o Forseti opera (3 papéis)..."
            >
              <Info size={15} />
              <span className="copilot-info-btn-text">Como opera</span>
            </button>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="copilot-close-btn cursor-pointer"
                title="Fechar Forseti e voltar à tela"
                aria-label="Fechar Forseti"
              >
                <X size={17} />
              </button>
            )}
          </div>
        </div>
        {/* Overlay para Drag & Drop */}
        {isDragging && (
          <div className="drag-drop-overlay animate-fade-in">
            <UploadCloud size={48} className="text-cyan" />
            <h3>Solte sua imagem aqui</h3>
            <p>Comprovante, cupom fiscal ou fatura para interpretação com Forseti OCR</p>
          </div>
        )}

        {/* Messages Feed */}
        <div className="chat-messages-feed">
          {(!activeCheckpoint || movements.filter(m => m.type === 'CARTAO').length === 0 || natures.length === 0) && (
            <div className="copilot-pending-calibration-notice animate-fade-in">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber" />
                <strong className="text-xs text-amber-300">
                  Calibração Inicial Recomendada pela Forseti
                </strong>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Olá! Notei que seu Balder ainda tem etapas de calibração pendentes ({!activeCheckpoint ? 'Ponto de Partida, ' : ''}{movements.filter(m => m.type === 'CARTAO').length === 0 ? 'Faturas em Aberto, ' : ''}{natures.length === 0 ? 'Naturezas & Mapeamentos' : ''}). Recomendo concluirmos esses 3 passos para que minhas auditorias de fluxo e projeções de 30 dias sejam exatas.
              </p>
              {onOpenOnboarding && (
                <button
                  type="button"
                  className="btn btn-primary btn-xs mt-2.5 flex items-center gap-1.5 cursor-pointer"
                  onClick={() => onOpenOnboarding(!activeCheckpoint ? 1 : movements.filter(m => m.type === 'CARTAO').length === 0 ? 2 : 3)}
                >
                  <span>Iniciar Calibração com a Forseti</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          )}

          {chatHistory.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div key={msg.id} className={`chat-message-row ${isUser ? 'message-user' : 'message-assistant'}`}>
                <div className="message-avatar">
                  {isUser ? (
                    <User size={18} />
                  ) : (
                    <img src="/forseti-avatar.png" alt="Forseti" className="copilot-avatar-img" />
                  )}
                </div>

                <div className="message-bubble">
                  <div className="message-meta-row">
                    <span className="message-author">{isUser ? 'Você' : 'BALDER Forseti'}</span>
                    <span className="message-time">{msg.timestamp}</span>
                    {msg.actionBadge && (
                      <span className="badge badge-cyan message-action-badge">{msg.actionBadge}</span>
                    )}
                  </div>

                  {/* Anexos de Imagens ou Notificação de Espaço Temporário Liberado */}
                  {msg.attachments && msg.attachments.length > 1 ? (
                    <div className="message-attachment-card animate-fade-in flex flex-col gap-2">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-xs">
                          <Paperclip size={13} />
                          <span>{msg.attachments.length} Fotos Anexadas</span>
                        </div>
                        {msg.isEphemeralPurged && (
                          <span className="attachment-purged-badge flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <ShieldCheck size={13} />
                            <span>Espaço temporário liberado (0 KB mantidos)</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full">
                        {msg.attachments.map((att, aIdx) => (
                          <div key={aIdx} className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/60 border border-slate-700/60 text-xs flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-slate-300 font-medium max-w-[110px] truncate">{att.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    (msg.attachmentUrl || msg.isEphemeralPurged) && (
                      <div className="message-attachment-card animate-fade-in">
                        <div className="attachment-thumb-wrap">
                          {msg.attachmentUrl ? (
                            <img src={msg.attachmentUrl} alt={msg.attachmentName || 'Comprovante Anexo'} className="message-attachment-img" />
                          ) : (
                            <div className="attachment-purged-thumb flex items-center justify-center w-full h-full bg-emerald-500/10 text-emerald-400">
                              <ShieldCheck size={18} />
                            </div>
                          )}
                        </div>
                        <div className="attachment-card-info">
                          <div className="attachment-card-name-row">
                            <Paperclip size={13} className="text-cyan" />
                            <span className="attachment-filename">{msg.attachmentName || 'Comprovante Anexo'}</span>
                            {msg.attachmentSize && <span className="text-[10px] text-muted">({msg.attachmentSize})</span>}
                          </div>
                          {msg.isEphemeralPurged ? (
                            <span className="attachment-purged-badge flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Espaço temporário liberado com sucesso (0 KB em disco)
                            </span>
                          ) : (
                            <span className="attachment-ocr-badge">Processando no buffer temporário...</span>
                          )}
                        </div>
                      </div>
                    )
                  )}

                  <div className="message-text">
                    {msg.content.split('\n').map((line, i) => {
                      // Renderizar negrito básico com segurança
                      const parts = line.split(/(\*\*.*?\*\*)/g);
                      return (
                        <p key={i}>
                          {parts.map((part, pIdx) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              return <strong key={pIdx} className="text-white">{part.slice(2, -2)}</strong>;
                            }
                            return part;
                          })}
                        </p>
                      );
                    })}
                  </div>

                  {/* Card Interativo de Conciliação e Mapeamento de Itens */}
                  {msg.receiptReconciliation && (
                    <ReceiptReconciliationCard
                      data={msg.receiptReconciliation}
                      messageId={msg.id}
                      natures={natures}
                      onConfirm={reconcileReceiptData}
                    />
                  )}

                  {/* Perguntas & Opções Rápidas Interativas */}
                  {msg.pendingConfirmation && (
                    <div className="copilot-interactive-options-card animate-fade-in">
                      <div className="options-card-header">
                        <span className="options-question-label">
                          {msg.pendingConfirmation.question}
                        </span>
                      </div>

                      <div className="interactive-options-grid">
                        {msg.pendingConfirmation.options.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className="interactive-option-btn"
                            onClick={() => respondToCopilotOption(msg.id, opt)}
                          >
                            <span className="option-icon">{opt.icon || '👉'}</span>
                            <div className="option-text-col">
                              <div className="option-title-row">
                                <span className="option-label">{opt.label}</span>
                                {opt.badge && <span className="option-badge">{opt.badge}</span>}
                              </div>
                              {opt.description && (
                                <span className="option-desc">{opt.description}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Follow-up chips */}
                  {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                    <div className="message-suggestions">
                      <span className="suggestions-label">Sugestões rápidas:</span>
                      <div className="suggestions-chips">
                        {msg.suggestedFollowUps.map((chip, idx) => (
                          <button
                            key={idx}
                            className="suggestion-chip"
                            onClick={() => handleChipClick(chip)}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={chatBottomRef} />
        </div>

        {/* ── Bottom Input Zone ────────────────────────────────── */}
        <div className="chat-bottom-zone">
          {/* Preview dos Anexos antes de Enviar (Suporte Multi-Fotos) */}
          {attachedImages.length > 0 && (
            <div className="chat-attachment-preview-bar animate-fade-in flex flex-col gap-2">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Paperclip size={14} className="text-cyan" />
                  <span className="text-xs font-semibold text-primary">
                    {attachedImages.length} {attachedImages.length === 1 ? 'Foto selecionada' : 'Fotos selecionadas'}
                  </span>
                  <span className="preview-status-tag flex items-center gap-1 text-[11px] text-cyan-300 ml-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Buffer efêmero • Descarte automático pós-OCR (0 bytes mantidos)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    title="Adicionar mais imagens"
                  >
                    <Plus size={13} />
                    <span>Adicionar mais fotos</span>
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-muted hover:text-rose-400 cursor-pointer"
                    onClick={handleClearAllAttachments}
                    title="Limpar todos os anexos"
                  >
                    Limpar todas
                  </button>
                </div>
              </div>

              {/* Strip com miniaturas rolantes */}
              <div className="flex items-center gap-2.5 overflow-x-auto py-1 max-w-full">
                {attachedImages.map((img, idx) => (
                  <div key={idx} className="relative group flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 flex-shrink-0">
                    <div className="w-8 h-8 rounded overflow-hidden bg-black flex-shrink-0 border border-slate-700">
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col max-w-[120px]">
                      <span className="text-[11px] font-medium text-slate-200 truncate">{img.name}</span>
                      {img.size && <span className="text-[9px] text-muted">{img.size}</span>}
                    </div>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-rose-400 p-0.5 ml-1 cursor-pointer transition-colors"
                      onClick={() => handleRemoveAttachedImage(idx)}
                      title={`Remover ${img.name}`}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input Bar com Botão '+' Unificado para Anexos e Ações */}
          <form onSubmit={handleSend} className="chat-input-bar">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* Botão '+' Agrupador de Anexos e Ações Rápidas */}
            <div className="chat-plus-menu-wrapper" ref={plusMenuRef}>
              <button
                type="button"
                className={`chat-plus-btn ${showPlusMenu ? 'active' : ''} ${attachedImages.length > 0 ? 'has-attachment' : ''}`}
                onClick={() => setShowPlusMenu(!showPlusMenu)}
                title="Anexar comprovante ou selecionar ação rápida (+)"
              >
                <Plus size={20} className={`chat-plus-icon ${showPlusMenu ? 'is-open' : ''}`} />
              </button>

              {/* Popover flutuante com Anexos e Comandos Rápidos */}
              {showPlusMenu && (
                <div className="chat-plus-popover animate-scale-up">
                  <div className="plus-popover-header">
                    <span className="plus-popover-title">Anexos & Ações Rápidas</span>
                    <button
                      type="button"
                      onClick={() => setShowPlusMenu(false)}
                      className="text-muted hover:text-primary p-0.5 cursor-pointer"
                      title="Fechar menu"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Anexar Comprovante / Cupom (OCR) */}
                  <div className="plus-popover-group">
                    <button
                      type="button"
                      className="plus-popover-item primary-action cursor-pointer"
                      onClick={() => {
                        setShowPlusMenu(false);
                        fileInputRef.current?.click();
                      }}
                    >
                      <div className="plus-item-icon-box bg-cyan-500/15 text-cyan-400">
                        <ImageIcon size={17} />
                      </div>
                      <div className="plus-item-text-box">
                        <strong className="plus-item-name">Anexar Comprovante / Cupom</strong>
                        <span className="plus-item-hint">Foto para leitura com Forseti OCR (espaço temporário auto-liberado)</span>
                      </div>
                    </button>
                  </div>

                  {/* Sugestões de Ações e Comandos Rápidos (ocultos quando há OCR ativo não conciliado) */}
                  {!hasActiveOcr && (
                    <div className="plus-popover-group">
                      <span className="plus-group-label">Sugestões de Comandos</span>
                      {quickChips
                        .filter((chip) => !chip.includes('Anexar'))
                        .map((chip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="plus-popover-item cursor-pointer"
                            onClick={() => {
                              setShowPlusMenu(false);
                              handleSend(undefined, chip);
                            }}
                          >
                            <div className="plus-item-icon-box bg-amber-500/10 text-amber-400">
                              <Sparkles size={13} />
                            </div>
                            <div className="plus-item-text-box">
                              <span className="plus-item-name text-xs">{chip}</span>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <input
              type="text"
              className="chat-text-input"
              placeholder={
                attachedImages.length > 0
                  ? `Instrução para as ${attachedImages.length} fotos (ex: "considere no valor não mapeado da fatura") ou Enviar...`
                  : "Digite algo ou anexe fotos com '+' (Ctrl+V para colar)..."
              }
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
            />

            <button
              type="submit"
              className="btn btn-primary chat-send-btn"
              disabled={!inputQuery.trim() && attachedImages.length === 0}
            >
              <Send size={16} />
              <span className="send-btn-label">Enviar</span>
            </button>
          </form>
        </div>
      </div>

      {/* Modal Popup Informativo: Como o Forseti Opera (3 Papéis) */}
      {showRolesModal && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setShowRolesModal(false)}>
          <div
            className="glass-card copilot-roles-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="copilot-roles-modal-header">
              <div className="flex items-center gap-2.5">
                <div className="forseti-modal-avatar">
                  <img src="/forseti-avatar.png" alt="Forseti" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-primary">Como o Forseti opera</h3>
                  <p className="text-xs text-muted">Inteligência Operacional, Conciliação e Auditoria</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRolesModal(false)}
                className="text-muted hover:text-primary p-1 cursor-pointer"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="copilot-roles-modal-body">
              <div className="role-modal-card">
                <span className="role-modal-icon">💡</span>
                <div className="role-modal-info">
                  <span className="role-modal-title text-cyan">Assistente Financeiro</span>
                  <p className="role-modal-desc">
                    Explica cenários futuros, projeta horizontes de liquidez e calcula a viabilidade de compras e decisões estratégicas.
                  </p>
                </div>
              </div>

              <div className="role-modal-card">
                <span className="role-modal-icon">⚡</span>
                <div className="role-modal-info">
                  <span className="role-modal-title text-emerald">Assistente Operacional</span>
                  <p className="role-modal-desc">
                    Cadastra, liquida e programa movimentações em linguagem natural diretamente no fluxo de caixa.
                  </p>
                </div>
              </div>

              <div className="role-modal-card">
                <span className="role-modal-icon">🔍</span>
                <div className="role-modal-info">
                  <span className="role-modal-title text-amber">Auditor Determinístico & OCR</span>
                  <p className="role-modal-desc">
                    Audita desvios de saldo, identifica inconsistências e extrai dados de comprovantes e cupons fiscais via OCR.
                  </p>
                </div>
              </div>
            </div>

            <div className="copilot-roles-modal-footer">
              <button
                type="button"
                className="btn btn-primary text-xs py-2 px-4 w-full justify-center"
                onClick={() => setShowRolesModal(false)}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
