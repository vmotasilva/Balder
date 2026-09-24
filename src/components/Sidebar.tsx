import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFinancial } from '../context/FinancialContext';
import { auditOnboardingProgress } from '../utils/onboardingProgress';

export type TabId = 'DASHBOARD' | 'MOVIMENTACOES' | 'FATURAS' | 'NATUREZAS' | 'EMPRESTIMOS' | 'COPILOT' | 'METAS' | 'COMPARTILHADO' | 'PERFIL';

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenOnboarding?: (stepIndex?: number) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  isOpen,
  onOpenChange,
  onOpenOnboarding,
}) => {
  const { user, logout } = useAuth();
  const {
    activeCheckpoint,
    salaryContracts,
    movements,
    cards,
    accounts,
    banks,
    natures,
  } = useFinancial();
  const [internalOpen, setInternalOpen] = useState(false);

  // Cálculo detalhado dos 5 pilares do Get Started
  const onboardingAudit = useMemo(
    () =>
      auditOnboardingProgress({
        activeCheckpoint,
        salaryContracts,
        movements,
        cards,
        accounts,
        banks,
        natures,
      }),
    [activeCheckpoint, salaryContracts, movements, cards, accounts, banks, natures]
  );
  const completionPercentage = onboardingAudit.percent;
  const completedSteps = onboardingAudit.completedCount;

  const isMenuOpen = isOpen !== undefined ? isOpen : internalOpen;
  const setIsMenuOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    }
    setInternalOpen(open);
  };

  // Posição flutuante móvel do botão de navegação com persistência em localStorage
  const [orbPosition, setOrbPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('balder_orb_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const clampedX = Math.min(Math.max(8, parsed.x), (window.innerWidth || 400) - 64);
          const clampedY = Math.min(Math.max(8, parsed.y), (window.innerHeight || 700) - 64);
          return { x: clampedX, y: clampedY };
        }
      }
    } catch {
      // fallback
    }
    return null;
  });

  const [isDraggingOrb, setIsDraggingOrb] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);
  const isMovedRef = useRef(false);
  const orbBtnRef = useRef<HTMLButtonElement>(null);

  const handleOrbPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return; // Apenas clique com botão principal / toque

    const btn = orbBtnRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: orbPosition ? orbPosition.x : rect.left,
      initY: orbPosition ? orbPosition.y : rect.top,
    };
    isMovedRef.current = false;
    btn.setPointerCapture(e.pointerId);
  };

  const handleOrbPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    if (!isMovedRef.current && Math.hypot(deltaX, deltaY) > 6) {
      isMovedRef.current = true;
      setIsDraggingOrb(true);
    }

    if (isMovedRef.current) {
      const btnSize = 56;
      const margin = 8;
      const maxX = (window.innerWidth || 400) - btnSize - margin;
      const maxY = (window.innerHeight || 700) - btnSize - margin;

      let nextX = dragStartRef.current.initX + deltaX;
      let nextY = dragStartRef.current.initY + deltaY;

      nextX = Math.max(margin, Math.min(maxX, nextX));
      nextY = Math.max(margin, Math.min(maxY, nextY));

      setOrbPosition({ x: nextX, y: nextY });
    }
  };

  const handleOrbPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;

    const btn = orbBtnRef.current;
    if (btn && btn.hasPointerCapture(e.pointerId)) {
      btn.releasePointerCapture(e.pointerId);
    }

    if (isMovedRef.current) {
      setOrbPosition((current) => {
        if (current) {
          try {
            localStorage.setItem('balder_orb_pos', JSON.stringify(current));
          } catch {
            // ignore
          }
        }
        return current;
      });
    }

    setIsDraggingOrb(false);
    setTimeout(() => {
      isMovedRef.current = false;
      dragStartRef.current = null;
    }, 60);
  };

  const handleOrbPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    const btn = orbBtnRef.current;
    if (btn && btn.hasPointerCapture(e.pointerId)) {
      btn.releasePointerCapture(e.pointerId);
    }
    setIsDraggingOrb(false);
    isMovedRef.current = false;
    dragStartRef.current = null;
  };

  const handleOrbClick = () => {
    if (isMovedRef.current) return;
    setIsMenuOpen(!isMenuOpen);
  };

  // Re-garante que o botão permaneça na tela se a janela for redimensionada
  useEffect(() => {
    const handleResize = () => {
      setOrbPosition((prev) => {
        if (!prev) return null;
        const btnSize = 56;
        const margin = 8;
        const maxX = window.innerWidth - btnSize - margin;
        const maxY = window.innerHeight - btnSize - margin;
        if (maxX <= margin || maxY <= margin) return prev;
        const clampedX = Math.max(margin, Math.min(maxX, prev.x));
        const clampedY = Math.max(margin, Math.min(maxY, prev.y));
        return { x: clampedX, y: clampedY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Escuta tecla Escape e trava scroll do body quando menu está aberto
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const userInitials = (user?.name || 'VM')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const desktopNavItems = [
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
      id: 'COMPARTILHADO' as TabId,
      label: 'Planejamento Conjunto',
      subtitle: 'Acompanhamento Mútuo',
      icon: Users,
      badge: 'Mútuo',
    },
  ];

  // No menu mobile sheet, Forseti fica em destaque ao lado do perfil no rodapé,
  // permitindo que os 6 módulos fiquem em uma grade 2x3 equilibrada.
  const mobileNavGridItems = desktopNavItems.filter((item) => item.id !== 'COPILOT');

  const activeItem = desktopNavItems.find((item) => item.id === activeTab) || {
    id: 'PERFIL' as TabId,
    label: 'Perfil',
    subtitle: 'Configurações & Contas',
    icon: UserCheck,
  };

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
            {desktopNavItems.map((item) => {
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

          {/* Botão Get Started na Barra Lateral Desktop Abaixo do Perfil (oculto em 100%) */}
          {!collapsed && completionPercentage < 100 && (
            <div className="sidebar-gs-container">
              <button
                type="button"
                className="sidebar-gs-btn"
                onClick={() => {
                  if (onOpenOnboarding) {
                    onOpenOnboarding(onboardingAudit.nextSuggestedStep?.stepIndex || 1);
                  }
                }}
                title="Acessar Get Started — Calibração Inicial"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles size={14} className="text-amber-400 shrink-0" />
                  <span className="sidebar-gs-text">Get Started</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`sidebar-gs-badge ${completionPercentage === 100 ? 'done' : 'pending'}`}>
                    {completionPercentage}%
                  </span>
                  <ChevronRight size={13} className="text-muted" />
                </div>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Floating Circular Navigation Button & Fluid Options Sheet */}
      <div className="mobile-nav-root">
        {/* Floating Circular Trigger Button (Móvel / Arrastável) */}
        <button
          ref={orbBtnRef}
          type="button"
          className={`mobile-nav-orb-btn ${isMenuOpen ? 'open' : ''} ${isDraggingOrb ? 'is-dragging' : ''}`}
          onClick={handleOrbClick}
          onPointerDown={handleOrbPointerDown}
          onPointerMove={handleOrbPointerMove}
          onPointerUp={handleOrbPointerUp}
          onPointerCancel={handleOrbPointerCancel}
          style={
            orbPosition
              ? {
                  left: `${orbPosition.x}px`,
                  top: `${orbPosition.y}px`,
                  bottom: 'auto',
                  right: 'auto',
                  transform: isDraggingOrb ? 'scale(1.12)' : isMenuOpen ? 'rotate(90deg)' : 'none',
                }
              : undefined
          }
          aria-label={isMenuOpen ? 'Fechar Menu de Navegação' : 'Abrir Menu de Navegação (Arraste para mover)'}
          title="Menu de Navegação (Pressione e arraste para posicionar onde desejar)"
        >
          <div className="mobile-nav-orb-inner">
            {isMenuOpen ? (
              <X size={26} className="mobile-nav-orb-icon icon-close" />
            ) : (
              <LayoutGrid size={24} className="mobile-nav-orb-icon icon-menu" />
            )}
          </div>
          <span className="mobile-nav-orb-glow" />
        </button>

        {/* Backdrop Overlay */}
        {isMenuOpen && (
          <div
            className="mobile-nav-backdrop"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Navigation Sheet / Modal */}
        <div className={`mobile-nav-sheet ${isMenuOpen ? 'open' : ''}`}>
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

              <div className="mobile-nav-sheet-actions">
                <div className="mobile-nav-sheet-active-pill">
                  <span className="mobile-nav-active-dot" />
                  <span>{activeItem.label}</span>
                </div>
                <button
                  type="button"
                  className="mobile-nav-close-btn"
                  onClick={() => setIsMenuOpen(false)}
                  title="Fechar Menu"
                  aria-label="Fechar Menu"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Scrollable 2-Column Grid of 8 Navigation Options */}
            <div className="mobile-nav-scroll-area">
              <div className="mobile-nav-grid">
                {mobileNavGridItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`mobile-nav-card ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        onSelectTab(item.id);
                        setIsMenuOpen(false);
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
                  setIsMenuOpen(false);
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
                  setIsMenuOpen(false);
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
                  setIsMenuOpen(false);
                  logout();
                }}
                title="Sair da Conta"
                aria-label="Sair da Conta"
              >
                <LogOut size={16} />
                <span className="logout-text">Sair</span>
              </button>
            </div>

            {/* Botão Get Started com Percentual logo Abaixo do Perfil no Menu Mobile (oculto quando 100%) */}
            {completionPercentage < 100 && (
              <div className="mobile-nav-gs-row">
                <button
                  type="button"
                  className="mobile-nav-gs-btn"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (onOpenOnboarding) {
                      onOpenOnboarding(onboardingAudit.nextSuggestedStep?.stepIndex || 1);
                    }
                  }}
                  title="Acessar Get Started — Calibração do Sistema"
                >
                  <div className="mobile-nav-gs-left">
                    <div className="mobile-nav-gs-icon-wrap">
                      <Sparkles size={16} className="text-amber-400" />
                    </div>
                    <div className="mobile-nav-gs-texts">
                      <div className="mobile-nav-gs-title-line">
                        <span className="mobile-nav-gs-title">Get Started</span>
                        <span className="badge-pill badge-pill-cyan text-[10px]">Forseti</span>
                      </div>
                      <span className="mobile-nav-gs-sub">
                        {completedSteps} de 3 passos definidos
                      </span>
                    </div>
                  </div>

                  <div className="mobile-nav-gs-right">
                    <div className="mobile-nav-gs-progress-mini">
                      <div
                        className="mobile-nav-gs-progress-fill"
                        style={{ width: `${Math.max(completionPercentage, 8)}%` }}
                      />
                    </div>
                    <span className={`mobile-nav-gs-badge ${completionPercentage === 100 ? 'done' : 'pending'}`}>
                      {completionPercentage}%
                    </span>
                    <ChevronRight size={15} className="text-muted" />
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
