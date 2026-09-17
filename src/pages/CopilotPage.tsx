import React, { useState, useRef, useEffect } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { ReceiptReconciliationCard } from '../components/ReceiptReconciliationCard';
import { Send, Sparkles, User, Image as ImageIcon, X, Paperclip, UploadCloud } from 'lucide-react';

export const CopilotPage: React.FC = () => {
  const { chatHistory, sendMessageToCopilot, respondToCopilotOption, reconcileReceiptData, natures } = useFinancial();
  const [inputQuery, setInputQuery] = useState('');
  const [attachedImage, setAttachedImage] = useState<{ url: string; name: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, attachedImage]);

  // Suporte a Colar Imagem da Área de Transferência (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP, etc.).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setAttachedImage({
          url: result,
          name: file.name || 'comprovante_anexo.png',
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
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
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    }
  };

  const handleSend = (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = customQuery || inputQuery;
    if (!query.trim() && !attachedImage) return;

    sendMessageToCopilot(query, attachedImage || undefined);
    setInputQuery('');
    setAttachedImage(null);
  };

  const quickChips = [
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
    } else {
      handleSend(undefined, chip);
    }
  };

  // Detecta se há um card de OCR ativo (não conciliado) na última mensagem
  const lastAssistantMsg = [...chatHistory].reverse().find((m) => m.role === 'assistant');
  const hasActiveOcr = !!(lastAssistantMsg?.receiptReconciliation && !lastAssistantMsg.receiptReconciliation.isReconciled);

  return (
    <div className="page-container copilot-page animate-fade-in">
      {/* Header */}
      <div className="page-header forseti-page-header">
        <div className="forseti-header-identity">
          <div className="forseti-header-avatar">
            <img src="/forseti-avatar.png" alt="Forseti" className="forseti-header-avatar-img" />
          </div>
          <div>
            <div className="kicker-badge">
              <span>INTELIGÊNCIA OPERACIONAL & CONCILIAÇÃO</span>
            </div>
            <h1 className="page-title">Forseti <span className="forseti-title-sub">— Assistente & Auditor IA</span></h1>
            <p className="page-subtitle">Comando em linguagem natural, leitura de comprovantes com OCR e conciliação determinística</p>
          </div>
        </div>
      </div>

      {/* 3 Active Operational Roles Banner */}
      <div className="copilot-roles-banner glass-card">
        <div className="role-item">
          <span className="role-icon">💡</span>
          <div className="role-content">
            <span className="role-name text-cyan">Assistente Financeiro</span>
            <span className="role-desc">Explica cenários, projeta horizontes e calcula viabilidade</span>
          </div>
        </div>

        <div className="role-divider"></div>

        <div className="role-item">
          <span className="role-icon">⚡</span>
          <div className="role-content">
            <span className="role-name text-emerald">Assistente Operacional</span>
            <span className="role-desc">Cadastra e liquida movimentações em linguagem natural</span>
          </div>
        </div>

        <div className="role-divider"></div>

        <div className="role-item">
          <span className="role-icon">🔍</span>
          <div className="role-content">
            <span className="role-name text-amber">Auditor Determinístico</span>
            <span className="role-desc">Audita desvios de saldo e interpreta comprovantes via OCR</span>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div
        className={`copilot-chat-container glass-card ${isDragging ? 'is-dragging-file' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
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

                  {/* Anexo de Imagem na Mensagem do Usuário */}
                  {msg.attachmentUrl && (
                    <div className="message-attachment-card animate-fade-in">
                      <div className="attachment-thumb-wrap">
                        <img src={msg.attachmentUrl} alt={msg.attachmentName || 'Comprovante Anexo'} className="message-attachment-img" />
                      </div>
                      <div className="attachment-card-info">
                        <div className="attachment-card-name-row">
                          <Paperclip size={13} className="text-cyan" />
                          <span className="attachment-filename">{msg.attachmentName || 'Comprovante Anexo'}</span>
                        </div>
                        <span className="attachment-ocr-badge">Processado com Forseti OCR</span>
                      </div>
                    </div>
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
          {/* Quick Action Chips — ocultos quando há OCR ativo não conciliado */}
          {!hasActiveOcr && (
            <div className="chat-quick-chips-bar">
              <div className="chips-scroll">
                {quickChips.map((chip, idx) => (
                  <button
                    key={idx}
                    className={`quick-chip-btn ${chip.includes('Anexar') ? 'highlight-attach-chip' : ''}`}
                    onClick={() => handleChipClick(chip)}
                  >
                    {chip.includes('Anexar') ? (
                      <ImageIcon size={13} className="text-cyan" />
                    ) : (
                      <Sparkles size={12} className="text-cyan" />
                    )}
                    <span>{chip}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview do Anexo antes de Enviar */}
          {attachedImage && (
            <div className="chat-attachment-preview-bar animate-fade-in">
              <div className="attachment-preview-left">
                <div className="preview-thumb-box">
                  <img src={attachedImage.url} alt={attachedImage.name} className="preview-thumb-img" />
                </div>
                <div className="preview-info-col">
                  <div className="preview-filename-row">
                    <Paperclip size={13} className="text-cyan" />
                    <span className="preview-filename-text">{attachedImage.name}</span>
                  </div>
                  <span className="preview-status-tag">Pronto para Interpretação e Leitura OCR</span>
                </div>
              </div>
              <button
                type="button"
                className="preview-remove-btn"
                onClick={() => setAttachedImage(null)}
                title="Remover anexo"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Input Bar */}
          <form onSubmit={handleSend} className="chat-input-bar">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* Botão de Anexo de Imagem */}
            <button
              type="button"
              className={`chat-attach-btn ${attachedImage ? 'has-attachment' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              title="Anexar comprovante, fatura ou cupom fiscal (imagem)"
            >
              <ImageIcon size={18} />
              <span className="attach-btn-label">Anexar</span>
            </button>

            <input
              type="text"
              className="chat-text-input"
              placeholder={
                attachedImage
                  ? "Adicione uma instrução sobre o comprovante (ou clique em Enviar)..."
                  : "Digite algo ou anexe uma foto de comprovante/cupom fiscal (Ctrl+V para colar)..."
              }
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
            />

            <button
              type="submit"
              className="btn btn-primary chat-send-btn"
              disabled={!inputQuery.trim() && !attachedImage}
            >
              <Send size={16} />
              <span>Enviar</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
