import React, { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import {
  User,
  Building,
  CreditCard,
  Tag,
  Sliders,
  FileSpreadsheet,
  ShieldCheck,
  Download,
  CheckCircle2,
  ChevronRight,
  Layers,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { accounts, exportToCSV } = useFinancial();
  const [activeSubTab, setActiveSubTab] = useState<'PERFIL' | 'CONTAS' | 'BANCOS' | 'CATEGORIAS' | 'PREFERENCIAS' | 'EXPORTACOES' | 'SEGURANCA'>('PERFIL');
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false);

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="kicker-badge">
            <span>CONFIGURAÇÕES & SEGURANÇA</span>
          </div>
          <h1 className="page-title">Meu Perfil</h1>
          <p className="page-subtitle">Gerencie suas contas, conexões bancárias, preferências e exportações analíticas</p>
        </div>
      </div>

      {/* Profile Layout with Nav Tabs */}
      <div className="profile-layout-grid">
        {/* Left Side Menu */}
        <div className="profile-nav-card glass-card">
          <div className="profile-user-summary">
            <div className="profile-avatar-large">
              <span>VM</span>
            </div>
            <h3>Vinicius Mota</h3>
            <span className="profile-user-email">vinicius@balder.internal</span>
            <span className="badge badge-emerald mt-2">ASSINANTE BETA PRO</span>
          </div>

          <div className="profile-nav-list">
            <button
              className={`profile-nav-item ${activeSubTab === 'PERFIL' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('PERFIL')}
            >
              <User size={18} />
              <span>Perfil & Dados Pessoais</span>
            </button>

            <button
              className={`profile-nav-item ${activeSubTab === 'CONTAS' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('CONTAS')}
            >
              <CreditCard size={18} />
              <span>Contas & Carteiras ({accounts.length})</span>
            </button>

            <button
              className={`profile-nav-item ${activeSubTab === 'BANCOS' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('BANCOS')}
            >
              <Building size={18} />
              <span>Bancos & Open Finance</span>
            </button>

            <button
              className={`profile-nav-item ${activeSubTab === 'CATEGORIAS' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('CATEGORIAS')}
            >
              <Tag size={18} />
              <span>Naturezas & Categorias</span>
            </button>

            <button
              className={`profile-nav-item ${activeSubTab === 'PREFERENCIAS' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('PREFERENCIAS')}
            >
              <Sliders size={18} />
              <span>Preferências de Exibição</span>
            </button>

            <button
              className={`profile-nav-item ${activeSubTab === 'EXPORTACOES' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('EXPORTACOES')}
            >
              <FileSpreadsheet size={18} />
              <span>Exportações (Excel & CSV)</span>
            </button>

            <button
              className={`profile-nav-item ${activeSubTab === 'SEGURANCA' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('SEGURANCA')}
            >
              <ShieldCheck size={18} />
              <span>Segurança & Criptografia</span>
            </button>
          </div>

          {/* Subseção Ferramentas Avançadas */}
          <div className="advanced-tools-box">
            <div className="advanced-tools-header">
              <Layers size={16} className="text-cyan" />
              <span>Ferramentas Avançadas</span>
            </div>
            <p className="advanced-tools-desc">Acesso a Workspaces, Dashboards Internos e Ferramentas Especializadas.</p>
            <button className="btn btn-outline btn-sm w-full" onClick={() => setAdvancedModalOpen(true)}>
              <span>Abrir Catálogo Avançado</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Right Side Content Panel */}
        <div className="profile-content-card glass-card">
          {activeSubTab === 'PERFIL' && (
            <div className="subtab-content">
              <h3>Perfil do Usuário</h3>
              <p className="subtab-desc">Suas informações cadastrais e identificação do sistema</p>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input type="text" className="form-input" defaultValue="Vinicius Mota" readOnly />
                </div>
                <div className="form-group">
                  <label>E-mail Principal</label>
                  <input type="email" className="form-input" defaultValue="vinicius@balder.internal" readOnly />
                </div>
                <div className="form-group">
                  <label>Moeda Padrão</label>
                  <input type="text" className="form-input" defaultValue="Real Brasileiro (BRL - R$)" readOnly />
                </div>
                <div className="form-group">
                  <label>Fuso Horário</label>
                  <input type="text" className="form-input" defaultValue="América/São Paulo (GMT-3)" readOnly />
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'CONTAS' && (
            <div className="subtab-content">
              <h3>Contas & Carteiras Cadastradas</h3>
              <p className="subtab-desc">Saldos conciliados das suas instituições financeiras</p>

              <div className="accounts-list-grid">
                {accounts.map((acc) => (
                  <div key={acc.id} className="account-item-card glass-card">
                    <div className="account-item-header">
                      <span className="account-icon">{acc.icon}</span>
                      <div>
                        <h4>{acc.name}</h4>
                        <span className="account-type-tag">{acc.type}</span>
                      </div>
                    </div>
                    <span className="account-balance text-glow-cyan">
                      {acc.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSubTab === 'BANCOS' && (
            <div className="subtab-content">
              <h3>Bancos & Open Finance</h3>
              <p className="subtab-desc">Conexões automáticas protegidas via Open Finance Brasil</p>

              <div className="open-finance-status-box">
                <div className="of-status-item">
                  <span className="of-logo">🟣</span>
                  <div className="of-info">
                    <strong>Nubank S.A.</strong>
                    <span>Sincronizado há 12 minutos • 1 Conta, 1 Cartão</span>
                  </div>
                  <span className="badge badge-emerald">CONECTADO</span>
                </div>

                <div className="of-status-item">
                  <span className="of-logo">🟠</span>
                  <div className="of-info">
                    <strong>Banco Inter</strong>
                    <span>Sincronizado há 1 hora • 1 Conta, 1 Empréstimo</span>
                  </div>
                  <span className="badge badge-emerald">CONECTADO</span>
                </div>

                <div className="of-status-item">
                  <span className="of-logo">⚪</span>
                  <div className="of-info">
                    <strong>XP Investimentos</strong>
                    <span>Sincronizado há 4 horas • Carteira de Ações e FIIs</span>
                  </div>
                  <span className="badge badge-emerald">CONECTADO</span>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'CATEGORIAS' && (
            <div className="subtab-content">
              <h3>Naturezas & Categorias</h3>
              <p className="subtab-desc">Estrutura contábil padronizada do BALDER</p>

              <div className="categories-pills-list">
                {['Salário & Renda', 'Moradia & Condomínio', 'Alimentação & Mercado', 'Educação', 'Saúde', 'Utilidades', 'Empréstimos', 'Cartão de Crédito', 'Investimentos & Proventos', 'Lazer & Viagens'].map((cat, idx) => (
                  <span key={idx} className="category-pill-large">
                    ✓ {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {activeSubTab === 'PREFERENCIAS' && (
            <div className="subtab-content">
              <h3>Preferências de Exibição</h3>
              <p className="subtab-desc">Personalize a sua interface do BALDER</p>

              <div className="preference-toggles">
                <div className="pref-row">
                  <div>
                    <strong>Tema Escuro (Dark Luxury)</strong>
                    <p>Otimizado para conforto visual e contraste estético</p>
                  </div>
                  <span className="badge badge-cyan">ATIVADO</span>
                </div>

                <div className="pref-row">
                  <div>
                    <strong>Sensibilidade de Riscos</strong>
                    <p>Notificar vencimentos com antecedência mínima de 5 dias</p>
                  </div>
                  <span className="badge badge-emerald">ALERTA ATIVO</span>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'EXPORTACOES' && (
            <div className="subtab-content">
              <h3>Exportações de Dados</h3>
              <p className="subtab-desc">Exporte suas movimentações e projeções para análise em Excel (.xlsx) ou CSV</p>

              <div className="export-options-grid">
                <div className="export-card glass-card">
                  <FileSpreadsheet size={32} className="text-emerald" />
                  <h4>Exportar Movimentações (CSV / Excel)</h4>
                  <p>Arquivo compatível com Microsoft Excel, Google Sheets e LibreOffice com todas as receitas, despesas e status.</p>
                  <button className="btn btn-primary" onClick={exportToCSV}>
                    <Download size={16} />
                    <span>Download CSV Completo</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'SEGURANCA' && (
            <div className="subtab-content">
              <h3>Segurança & Privacidade</h3>
              <p className="subtab-desc">Seus dados financeiros permanecem sob custódia criptografada</p>

              <div className="security-info-box">
                <div className="sec-item">
                  <ShieldCheck size={20} className="text-emerald" />
                  <div>
                    <strong>Criptografia em Repouso e Trânsito</strong>
                    <p>Todas as comunicações utilizam TLS 1.3 e chaves AES-256 bits.</p>
                  </div>
                </div>

                <div className="sec-item">
                  <CheckCircle2 size={20} className="text-cyan" />
                  <div>
                    <strong>Constituição BALDER Enforced (Ω)</strong>
                    <p>Nenhum dado financeiro é compartilhado com terceiros sem seu consentimento explícito.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Ferramentas Avançadas */}
      {advancedModalOpen && (
        <div className="modal-backdrop" onClick={() => setAdvancedModalOpen(false)}>
          <div className="modal-container glass-card animate-fade-in" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Ferramentas Avançadas</h3>
                <p className="modal-subtitle">Workspaces, Painéis Administrativos e Centros Analíticos</p>
              </div>
              <button className="modal-close-btn" onClick={() => setAdvancedModalOpen(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="advanced-catalog-grid">
                <div className="adv-item glass-card">
                  <h4>🏛️ Multi-Window Analysis</h4>
                  <p>Grid de 4 quadrantes sincronizados (Fluxo, Patrimônio, Simulação, Copilot).</p>
                </div>

                <div className="adv-item glass-card">
                  <h4>📊 Excel Import & Export Center</h4>
                  <p>Ingestão e conciliação em lote com suporte a arquivos OFX e XLSX.</p>
                </div>

                <div className="adv-item glass-card">
                  <h4>⚡ Founder Analytics Dashboard</h4>
                  <p>Métricas de produto, retenção de coorte, NPS e Life Impact Score.</p>
                </div>
              </div>

              <div className="modal-footer-actions mt-4">
                <button className="btn btn-outline" onClick={() => setAdvancedModalOpen(false)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
