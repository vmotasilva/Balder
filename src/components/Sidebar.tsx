import React from 'react';
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
      id: 'COPILOT' as TabId,
      label: 'Forseti',
      subtitle: 'Assistente & Auditor',
      icon: Sparkles,
      badge: 'IA',
    },
    {
      id: 'METAS' as TabId,
      label: 'Metas',
      subtitle: 'Objetivos & Sonhos',
      icon: Target,
      badge: 'Price',
    },
    {
      id: 'PERFIL' as TabId,
      label: 'Perfil',
      subtitle: 'Configurações & Contas',
      icon: UserCheck,
    },
  ];

  return (
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

      {/* Footer / User Profile & Collapse Toggle */}
      <div className="sidebar-footer">
        <button
          className="collapse-toggle-btn"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expandir Menu' : 'Recolher Menu'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span>Recolher Barra</span>}
        </button>

        {!collapsed && (
          <div className="user-profile-widget" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <div className="user-avatar">
                <span>{userInitials}</span>
              </div>
              <div className="user-info" style={{ overflow: 'hidden' }}>
                <span className="user-name" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block' }}>
                  {user?.name || 'Vinicius Mota'}
                </span>
                <span className="user-workspace">
                  {user?.isGuest ? 'Modo Demo Local' : 'Supabase Cloud'}
                </span>
              </div>
            </div>
            <button
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
  );
};
