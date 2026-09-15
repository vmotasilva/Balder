import React from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Bot,
  Target,
  UserCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export type TabId = 'DASHBOARD' | 'MOVIMENTACOES' | 'COPILOT' | 'METAS' | 'PERFIL';

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
      id: 'COPILOT' as TabId,
      label: 'Copilot',
      subtitle: 'Assistente & Auditor',
      icon: Bot,
      badge: 'IA',
    },
    {
      id: 'METAS' as TabId,
      label: 'Metas',
      subtitle: 'Objetivos & Planos',
      icon: Target,
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
          <div className="user-profile-widget">
            <div className="user-avatar">
              <span>VM</span>
            </div>
            <div className="user-info">
              <span className="user-name">Vinicius Mota</span>
              <span className="user-workspace">Workspace Pessoal</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
