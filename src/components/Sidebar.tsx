import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Layers,
  Landmark,
  Sparkles,
  Target,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  LayoutGrid,
  X,
  Check,
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type TabId = 'DASHBOARD' | 'MOVIMENTACOES' | 'FATURAS' | 'NATUREZAS' | 'EMPRESTIMOS' | 'COPILOT' | 'METAS' | 'PERFIL';

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
}) => {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Escuta tecla Escape e trava scroll do body quando menu mobile está aberto
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const userInitials = (user?.name || 'VM')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const navItems = [
    {
      id: 'DASHBOARD' as TabId,
      label: 'Dashboard',
      subtitle: 'Meu Dinheiro',
      icon: LayoutDashboard,
      badge: 'Visão Geral',
    },
    {
      id: 'MOVIMENTACOES' as TabId,
      label: 'Movimentações',
      subtitle: 'Entradas & Saídas',
      icon: ArrowLeftRight,
    },
    {
      id: 'FATURAS' as TabId,
      label: 'Faturas',
      subtitle: 'Cartões & Itens',
      icon: CreditCard,
      badge: 'Cartões',
    },
    {
      id: 'NATUREZAS' as TabId,
      label: 'Naturezas',
      subtitle: 'Tetos & Gastos Fixos',
      icon: Layers,
      badge: 'Tetos',
    },
    {
      id: 'EMPRESTIMOS' as TabId,
      label: 'Empréstimos',
      subtitle: 'Contratos & Simulador',
      icon: Landmark,
      badge: 'Price',
    },
    {
      id: 'METAS' as TabId,
      label: 'Metas',
      subtitle: 'Objetivos & Sonhos',
      icon: Target,
      badge: 'Price',
    },
  ];

  const activeItem = navItems.find((item) => item.id === activeTab) || 
    (activeTab === 'COPILOT' 
      ? { id: 'COPILOT' as TabId, label: 'Forseti IA', subtitle: 'Assistente & Auditor', icon: Sparkles, badge: 'IA' }
      : { id: 'PERFIL' as TabId, label: 'Perfil', subtitle: 'Configurações & Contas', icon: UserCheck }
    );

  return (
    <>
      {/* Desktop Sidebar (mantido 100% inalterado no desktop) */}
      <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-logo-icon">
            <img src="/logo-app.png" alt="Balder" className="brand-logo-img" />
          </div>
          {!collapsed && (
            <div className="brand-text">
              <span className="brand-title">BALDER</span>
              <span className="brand-subtitle">CONTROLE FINANCEIRO</span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="sidebar-nav">
          {!collapsed && <span className="nav-section-label">NAVEGAÇÃO PRINCIPAL</span>}

          <ul className="nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <li key={item.id}>
                  <button
                    className={`nav-button ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectTab(item.id)}
                    title={item.label}
                  >
                    <div className="nav-icon-wrapper">
                      <Icon size={20} className={isActive ? 'icon-active' : ''} />
                    </div>

                    {!collapsed && (
                      <div className="nav-label-group">
                        <span className="nav-item-title">{item.label}</span>
                        <span className="nav-item-subtitle">{item.subtitle}</span>
                      </div>
                    )}

                    {!collapsed && item.badge && (
                      <span className={`badge-pill ${item.badge === 'IA' ? 'badge-pill-cyan' : ''}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer / User Profile, Forseti IA & Collapse Toggle */}
        <div className="sidebar-footer">
          {/* Destaque Especial: Forseti IA na Sidebar Desktop */}
          <button
            type="button"
            className={`desktop-sidebar-forseti-btn ${activeTab === 'COPILOT' ? 'active' : ''}`}
            onClick={() => onSelectTab('COPILOT')}
            title="Forseti — Assistente & Auditor IA"
          >
            <div className="forseti-btn-avatar">
              <img src="/forseti-avatar.png" alt="Forseti IA" className="forseti-btn-avatar-img" />
              <span className="forseti-pulse-dot" />
            </div>
            {!collapsed && (
              <div className="forseti-btn-info">
                <div className="forseti-btn-title-row">
                  <span className="forseti-btn-title">Forseti IA</span>
                  <span className="forseti-badge-ia">AUDITOR</span>
                </div>
                <span className="forseti-btn-sub">Assistente & Auditor IA</span>
              </div>
            )}
          </button>

          <button
            className="collapse-toggle-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expandir Menu' : 'Recolher Menu'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && <span>Recolher Barra</span>}
          </button>

          {collapsed ? (
            <button
              type="button"
              className={`user-avatar-collapsed-btn ${activeTab === 'PERFIL' ? 'active-profile' : ''}`}
              onClick={() => onSelectTab('PERFIL')}
              title="Acessar Perfil & Configurações"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <div className="user-avatar" style={{ boxShadow: activeTab === 'PERFIL' ? '0 0 10px var(--accent-cyan)' : 'none' }}>
                <span>{userInitials}</span>
              </div>
            </button>
          ) : (
            <div className={`user-profile-widget ${activeTab === 'PERFIL' ? 'active-profile' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <button
                type="button"
                className="user-profile-btn"
                onClick={() => onSelectTab('PERFIL')}
                title="Acessar Configurações do Perfil"
              >
                <div className="user-avatar">
                  <span>{userInitials}</span>
                </div>
                <div className="user-info" style={{ overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="user-name" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block' }}>
                      {user?.name || 'Vinicius Mota'}
                    </span>
                    <Settings size={12} className="text-cyan" style={{ opacity: 0.8 }} />
                  </div>
                  <span className="user-workspace">
                    {activeTab === 'PERFIL' ? '⚙️ Configurações Ativas' : 'Meu Perfil'}
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={logout}
                title="Sair da Conta"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #94a3b8)')}
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Floating Circular Navigation Button & Fluid Options Sheet */}
      <div className="mobile-nav-root">
        {/* Floating Circular Trigger Button */}
        <button
          type="button"
          className={`mobile-nav-orb-btn ${isMobileMenuOpen ? 'open' : ''}`}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? 'Fechar Menu de Navegação' : 'Abrir Menu de Navegação'}
          title="Menu de Navegação"
        >
          <div className="mobile-nav-orb-inner">
            {isMobileMenuOpen ? (
              <X size={26} className="mobile-nav-orb-icon icon-close" />
            ) : (
              <LayoutGrid size={24} className="mobile-nav-orb-icon icon-menu" />
            )}
          </div>
          <span className="mobile-nav-orb-glow" />
        </button>

        {/* Backdrop Overlay */}
        {isMobileMenuOpen && (
          <div
            className="mobile-nav-backdrop"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Navigation Sheet / Modal */}
        <div className={`mobile-nav-sheet ${isMobileMenuOpen ? 'open' : ''}`}>
          <div className="mobile-nav-sheet-content">
            {/* Grabber indicator */}
            <div className="mobile-nav-drag-handle" />

            {/* Header */}
            <div className="mobile-nav-sheet-header">
              <div className="mobile-nav-sheet-brand">
                <img src="/logo-app.png" alt="Balder" className="mobile-nav-sheet-logo" />
                <div>
                  <h3 className="mobile-nav-sheet-title">BALDER</h3>
                  <p className="mobile-nav-sheet-subtitle">Menu de Navegação</p>
                </div>
              </div>

              <div className="mobile-nav-sheet-active-pill">
                <span className="mobile-nav-active-dot" />
                <span>{activeItem.label}</span>
              </div>
            </div>

            {/* Scrollable 2-Column Grid of 8 Navigation Options */}
            <div className="mobile-nav-scroll-area">
              <div className="mobile-nav-grid">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`mobile-nav-card ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        onSelectTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <div className="mobile-nav-card-icon-box">
                        <Icon size={20} />
                      </div>
                      <div className="mobile-nav-card-info">
                        <div className="mobile-nav-card-title-row">
                          <span className="mobile-nav-card-title">{item.label}</span>
                          {item.badge && (
                            <span className={`badge-pill ${item.badge === 'IA' ? 'badge-pill-cyan' : ''}`}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <span className="mobile-nav-card-sub">{item.subtitle}</span>
                      </div>
                      {isActive && (
                        <div className="mobile-nav-card-active-check">
                          <Check size={14} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* User Profile, Forseti IA & Logout Footer */}
            <div className="mobile-nav-sheet-footer">
              {/* Perfil do Usuário */}
              <button
                type="button"
                className={`mobile-nav-user-btn ${activeTab === 'PERFIL' ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab('PERFIL');
                  setIsMobileMenuOpen(false);
                }}
                title="Acessar Configurações do Perfil"
              >
                <div className="user-avatar" style={{ boxShadow: activeTab === 'PERFIL' ? '0 0 10px var(--accent-cyan)' : 'none' }}>
                  <span>{userInitials}</span>
                </div>
                <div className="user-info">
                  <span className="user-name">{user?.name || 'Vinicius Mota'}</span>
                  <span className="user-role-label">Meu Perfil</span>
                </div>
              </button>

              {/* Destaque Especial: Forseti IA */}
              <button
                type="button"
                className={`mobile-nav-forseti-btn ${activeTab === 'COPILOT' ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab('COPILOT');
                  setIsMobileMenuOpen(false);
                }}
                title="Abrir Forseti — Assistente & Auditor IA"
              >
                <div className="forseti-btn-avatar">
                  <img src="/forseti-avatar.png" alt="Forseti IA" className="forseti-btn-avatar-img" />
                  <span className="forseti-pulse-dot" />
                </div>
                <div className="forseti-btn-info">
                  <div className="forseti-btn-title-row">
                    <span className="forseti-btn-title">Forseti</span>
                    <span className="forseti-badge-ia">IA</span>
                  </div>
                  <span className="forseti-btn-sub">Auditor</span>
                </div>
              </button>

              {/* Botão Sair */}
              <button
                type="button"
                className="mobile-nav-logout-btn"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                title="Sair da Conta"
                aria-label="Sair da Conta"
              >
                <LogOut size={16} />
                <span className="logout-text">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
