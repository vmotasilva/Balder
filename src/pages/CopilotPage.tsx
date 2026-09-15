import React, { useState, useRef, useEffect } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { Send, Sparkles, User } from 'lucide-react';

export const CopilotPage: React.FC = () => {
  const { chatHistory, sendMessageToCopilot } = useFinancial();
  const [inputQuery, setInputQuery] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSend = (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = customQuery || inputQuery;
    if (!query.trim()) return;

    sendMessageToCopilot(query);
    setInputQuery('');
  };

  const quickChips = [
    'Receberei R$ 8.500 dia 5.',
    'Paguei R$ 320 no mercado.',
    'Por que meu saldo projetado caiu?',
    'Posso comprar um carro?',
    'Simular quitação do empréstimo',
  ];

  return (
    <div className="page-container copilot-page animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="kicker-badge">
            <span>INTELIGÊNCIA OPERACIONAL</span>
          </div>
          <h1 className="page-title">Meu Assistente (Copilot)</h1>
          <p className="page-subtitle">Comando em linguagem natural, auditoria de números e validação determinística</p>
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
            <span className="role-name text-amber">Auditor Financeiro</span>
            <span className="role-desc">Audita desvios de saldo e rastreia impactos de compromissos</span>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="copilot-chat-container glass-card">
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
                    <img src="/logo-app.png" alt="Balder" className="copilot-avatar-img" />
                  )}
                </div>

                <div className="message-bubble">
                  <div className="message-meta-row">
                    <span className="message-author">{isUser ? 'Você' : 'BALDER Copilot'}</span>
                    <span className="message-time">{msg.timestamp}</span>
                    {msg.actionBadge && (
                      <span className="badge badge-cyan message-action-badge">{msg.actionBadge}</span>
                    )}
                  </div>

                  <div className="message-text">
                    {msg.content.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>

                  {/* Suggested Follow-up chips */}
                  {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                    <div className="message-suggestions">
                      <span className="suggestions-label">Sugestões rápidas:</span>
                      <div className="suggestions-chips">
                        {msg.suggestedFollowUps.map((chip, idx) => (
                          <button
                            key={idx}
                            className="suggestion-chip"
                            onClick={() => handleSend(undefined, chip)}
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

        {/* Quick Action Chips Above Input */}
        <div className="chat-quick-chips-bar">
          <span className="chips-bar-label">Comandos frequentes:</span>
          <div className="chips-scroll">
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                className="quick-chip-btn"
                onClick={() => handleSend(undefined, chip)}
              >
                <Sparkles size={12} className="text-cyan" />
                <span>{chip}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="chat-input-bar">
          <input
            type="text"
            className="chat-text-input"
            placeholder="Digite algo em linguagem natural (ex: 'Receberei R$ 8.500 dia 5' ou 'Por que meu saldo caiu?')..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary chat-send-btn" disabled={!inputQuery.trim()}>
            <Send size={16} />
            <span>Enviar</span>
          </button>
        </form>
      </div>
    </div>
  );
};
