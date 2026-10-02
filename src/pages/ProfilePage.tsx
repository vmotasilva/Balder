import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useFinancial } from '../context/FinancialContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { auditOnboardingProgress } from '../utils/onboardingProgress';
import {
  User,
  Building,
  Eraser,
  CreditCard,
  Sliders,
  FileSpreadsheet,
  ShieldCheck,
  Smartphone,
  Download,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Layers,
  Plus,
  Trash2,
  AlertTriangle,
  Check,
  Sun,
  Moon,
  Wallet,
  Landmark,
  Edit2,
  TrendingUp,
  Calendar,
  Flag,
  CalendarDays,
  RotateCcw,
  Crown,
  Sparkles,
  Zap,
  Receipt,
  X,
  Archive,
  ArchiveRestore,
  Copy,
  Compass,
  Eye,
} from 'lucide-react';
import { FinanceEntityModal, type EntityTab } from '../components/FinanceEntityModal';
import { CheckpointSetupModal } from '../components/CheckpointSetupModal';
import { Modal } from '../components/Modal';
import type { FinancialCheckpoint, CheckpointBankDebt } from '../types';
import { ConfirmDialog, useConfirmDialog } from '../components/ConfirmDialog';
import { DataFormatPanel } from '../components/DataFormatPanel';
import { InfoButton } from '../components/InfoButton';

interface ProfilePageProps {
  onOpenOnboarding?: (stepIndex?: number) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onOpenOnboarding }) => {
  const {
    accounts,
    cards,
    paymentMethods,
    banks,
    deleteAccount,
    deleteCard,
    deletePaymentMethod,
    deleteBank,
    exportToCSV,
    natures,
    checkpoints,
    activeCheckpoint,
    activateCheckpoint,
    updateCheckpoint,
    archiveCheckpoint,
    unarchiveCheckpoint,
    deleteCheckpoint,
    clearAllCheckpoints,
    duplicateCheckpointAsSimulation,
    movements,
    viewPreferences,
    setViewPreferences,
  } = useFinancial();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  // Confirm Dialog
  const { confirm: confirmAction, dialogProps: confirmDialogProps } = useConfirmDialog();

  // Auditoria dinâmica dos pilares do Get Started
  const onboardingAudit = useMemo(
    () =>
      auditOnboardingProgress({
        activeCheckpoint,
        movements,
        cards,
        accounts,
        banks,
        natures,
      }),
    [activeCheckpoint, movements, cards, accounts, banks, natures]
  );
  const completionPercentage = onboardingAudit.percent;
  const completedSteps = onboardingAudit.completedCount;

  const [activeSubTab, setActiveSubTab] = useState<
    'PERFIL' | 'ASSINATURA' | 'DOWNLOAD' | 'SALARIO' | 'MARCOS' | 'CONTAS' | 'BANCOS' | 'PREFERENCIAS' | 'EXPORTACOES' | 'SEGURANCA' | 'FORMATAR'
  >('PERFIL');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [iosLinkCopied, setIosLinkCopied] = useState(false);
  const [subscriptionSuccessMsg, setSubscriptionSuccessMsg] = useState<string | null>(null);
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false);
  const [checkpointModalOpen, setCheckpointModalOpen] = useState(false);
  const [checkpointModalMode, setCheckpointModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');

  // Estados para Gestão & Arquivamento de Marcos e Simulações
  const [checkpointTabFilter, setCheckpointTabFilter] = useState<'ACTIVE_AND_SIMS' | 'ARCHIVED' | 'ALL'>('ACTIVE_AND_SIMS');
  const [editingCheckpointId, setEditingCheckpointId] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState<string>('');
  const [selectedCheckpointDetails, setSelectedCheckpointDetails] = useState<FinancialCheckpoint | null>(null);

  const duplicateCheckpoints = useMemo(() => {
    const seen = new Set<string>();
    const dups: typeof checkpoints = [];
    checkpoints.forEach((cp) => {
      const key = `${cp.startDate}_${cp.initialBalance}_${cp.creditCardDebt || 0}`;
      if (seen.has(key)) {
        dups.push(cp);
      } else {
        seen.add(key);
      }
    });
    return dups;
  }, [checkpoints]);

  // Estados de Modal para Entidades Financeiras (Contas, Cartões, Pagamentos, Bancos)
  const [entityModalOpen, setEntityModalOpen] = useState(false);
  const [entityModalTab, setEntityModalTab] = useState<EntityTab>('CONTA');
  const [entityEditItem, setEntityEditItem] = useState<{ type: EntityTab; data: any } | null>(null);
  const [contasFilter, setContasFilter] = useState<'TODAS' | 'CONTAS' | 'CARTOES' | 'PAGAMENTOS'>('TODAS');

  const handleOpenEntityModal = (tab: EntityTab, itemToEdit: any = null) => {
    setEntityModalTab(tab);
    setEntityEditItem(itemToEdit ? { type: tab, data: itemToEdit } : null);
    setEntityModalOpen(true);
  };

  // Itens de navegação do perfil correspondentes ao card principal (Imagem 2)
  const PROFILE_NAV_ITEMS = [
    { id: 'PERFIL' as const, label: 'Perfil & Dados Pessoais', icon: User, count: null },
    { id: 'ASSINATURA' as const, label: 'Plano & Assinatura', icon: Crown, count: 'PRO' },
    { id: 'DOWNLOAD' as const, label: 'Download', icon: Download, count: 'Android · iPhone' },
    { id: 'MARCOS' as const, label: 'Marcos de Início', icon: Flag, count: checkpoints.length },
    { id: 'CONTAS' as const, label: 'Contas & Meios', icon: CreditCard, count: accounts.length + cards.length },
    { id: 'BANCOS' as const, label: 'Bancos & Instituições', icon: Building, count: banks.length },
    { id: 'PREFERENCIAS' as const, label: 'Preferências de Exibição', icon: Sliders, count: null },
    { id: 'EXPORTACOES' as const, label: 'Exportações (Excel & CSV)', icon: FileSpreadsheet, count: null },
    { id: 'SEGURANCA' as const, label: 'Segurança & Criptografia', icon: ShieldCheck, count: null },
    { id: 'FORMATAR' as const, label: 'Formatar Dados', icon: Eraser, count: null },
  ];

  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);
  // O menu vai para o body (position: fixed): nenhum cartão, blur ou overflow da tela o esconde (Safari incluso)
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!mobileDropdownOpen) return;
    const place = () => {
      const rect = dropdownRef.current?.querySelector('.profile-dropdown-btn')?.getBoundingClientRect();
      if (rect) setMenuBox({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [mobileDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target) && !dropdownMenuRef.current?.contains(target)) {
        setMobileDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const currentNavItem = PROFILE_NAV_ITEMS.find((item) => item.id === activeSubTab) || PROFILE_NAV_ITEMS[0];
  const CurrentNavIcon = currentNavItem.icon;

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="kicker-badge">
            <span>CONFIGURAÇÕES & SEGURANÇA</span>
          </div>
          <h1 className="page-title label-with-info">
            Meu Perfil
            <InfoButton title="Meu Perfil">
              <p>Gerencie suas contas, conexões bancárias, preferências e exportações analíticas</p>
            </InfoButton>
          </h1>
        </div>
      </div>

      {/* Profile Layout with Nav Tabs */}
      <div className="profile-layout-grid">
        {/* Left Side Menu / Mobile Header Card */}
        <div className="profile-nav-card glass-card">
          <div className="profile-user-summary">
            <div className="profile-avatar-large">
              <span>{(user?.name || '?').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}</span>
            </div>
            <div className="profile-user-text">
              <h3>{user?.name || 'Perfil'}</h3>
              <span className="profile-user-email">{user?.email}</span>
              <button
                type="button"
                className="badge badge-emerald mt-1 profile-beta-badge flex items-center gap-1 cursor-pointer"
                onClick={() => setActiveSubTab('ASSINATURA')}
                title="Clique para gerenciar sua assinatura e faturamento"
              >
                <Crown size={12} className="text-amber" />
                <span>ASSINANTE BETA PRO</span>
              </button>
            </div>
          </div>

          {/* Botão Get Started com Percentual logo Abaixo do Perfil (oculto quando 100%) */}
          {completionPercentage < 100 && (
            <div className="profile-getstarted-quick-box">
              <button
                type="button"
                className="profile-getstarted-btn"
                onClick={() => {
                  if (onOpenOnboarding) {
                    onOpenOnboarding(onboardingAudit.nextSuggestedStep?.stepIndex);
                  }
                }}
                title="Configurar o Balder com a Forseti"
              >
                <div className="profile-gs-top">
                  <div className="profile-gs-badge-tag">
                    <Sparkles size={13} className="text-amber-400" />
                    <span className="profile-gs-title">Configuração com a Forseti</span>
                  </div>
                  <span className={`profile-gs-pct-badge ${completionPercentage === 100 ? 'done' : 'pending'}`}>
                    {completionPercentage}%
                  </span>
                </div>

                <div className="profile-gs-progress-bar">
                  <div
                    className="profile-gs-progress-fill"
                    style={{ width: `${Math.max(completionPercentage, 6)}%` }}
                  />
                </div>

                <div className="profile-gs-bottom">
                  <span className="profile-gs-status-text">
                    {completionPercentage === 100
                      ? '100% Calibrado e Concluído'
                      : `${completedSteps} de ${onboardingAudit.totalCount} pilares concluídos${
                          onboardingAudit.nextSuggestedStep
                            ? ` (Falta: ${onboardingAudit.nextSuggestedStep.shortLabel})`
                            : ''
                        }`}
                  </span>
                  <ChevronRight size={14} className="profile-gs-arrow" />
                </div>
              </button>
            </div>
          )}

          {/* Botão Drop-Down Móvel com os itens do card principal */}
          <div className="profile-mobile-dropdown-wrapper" ref={dropdownRef}>
            <label className="profile-dropdown-label">Seção do Perfil:</label>
            <button
              type="button"
              className={`profile-dropdown-btn ${mobileDropdownOpen ? 'active' : ''}`}
              onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}
              aria-label="Selecionar seção do perfil"
            >
              <div className="profile-dropdown-btn-left">
                <CurrentNavIcon size={18} className="text-cyan shrink-0" />
                <span className="profile-dropdown-btn-text">
                  {currentNavItem.label} {currentNavItem.count !== null ? `(${currentNavItem.count})` : ''}
                </span>
              </div>
              <ChevronDown
                size={18}
                className={`profile-dropdown-chevron ${mobileDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {mobileDropdownOpen && menuBox && createPortal(
              <div
                ref={dropdownMenuRef}
                className="profile-dropdown-menu animate-fade-in"
                style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width, right: 'auto' }}
              >
                {PROFILE_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeSubTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`profile-dropdown-menu-item ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        setActiveSubTab(item.id);
                        setMobileDropdownOpen(false);
                      }}
                    >
                      <div className="profile-dropdown-menu-item-left">
                        <Icon size={17} className={isSelected ? 'text-cyan' : 'text-muted'} />
                        <span className="profile-dropdown-menu-item-title">
                          {item.label} {item.count !== null ? `(${item.count})` : ''}
                        </span>
                      </div>
                      {isSelected && <Check size={16} className="text-cyan shrink-0" />}
                    </button>
                  );
                })}

                <div className="profile-dropdown-divider" />
                <button
                  type="button"
                  className="profile-dropdown-menu-item text-cyan font-medium"
                  onClick={() => {
                    setMobileDropdownOpen(false);
                    setAdvancedModalOpen(true);
                  }}
                >
                  <div className="profile-dropdown-menu-item-left">
                    <Layers size={17} className="text-cyan" />
                    <span>Ferramentas Avançadas</span>
                  </div>
                  <ChevronRight size={14} className="text-cyan shrink-0" />
                </button>
              </div>,
              document.body
            )}
          </div>

          {/* Desktop Nav List (Oculto em telas mobile) */}
          <div className="profile-nav-list profile-desktop-nav-list">
            {PROFILE_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`profile-nav-item ${activeSubTab === item.id ? 'active' : ''}`}
                  onClick={() => setActiveSubTab(item.id)}
                >
                  <Icon size={18} />
                  <span>
                    {item.label} {item.count !== null ? `(${item.count})` : ''}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Subseção Ferramentas Avançadas (Desktop) */}
          <div className="advanced-tools-box profile-desktop-advanced">
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
              <h3 className="label-with-info">
                Perfil do Usuário
                <InfoButton title="Perfil do Usuário">
                  <p>Suas informações cadastrais e identificação do sistema</p>
                </InfoButton>
              </h3>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input type="text" className="form-input" value={user?.name || ''} readOnly />
                </div>
                <div className="form-group">
                  <label>E-mail Principal</label>
                  <input type="email" className="form-input" value={user?.email || ''} readOnly />
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

              {/* Seção Resumida de Assinatura no Perfil */}
              <div className="profile-subscription-summary-card">
                <div className="profile-sub-header-flex">
                  <div className="flex items-center gap-3">
                    <div className="profile-sub-icon-box">
                      <Crown size={22} className="text-amber" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="profile-sub-title">Plano Balder Pro</h4>
                        <span className="profile-sub-status-badge">
                          <span className="profile-sub-pulse-dot" />
                          ATIVO
                        </span>
                      </div>
                      <p className="profile-sub-meta">
                        Assinatura Mensal • Próxima renovação em <strong>23/10/2026</strong> (R$ 29,90)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm flex items-center gap-1.5"
                    onClick={() => setActiveSubTab('ASSINATURA')}
                  >
                    <span>Gerenciar Assinatura</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className="profile-sub-chips-row">
                  <div className="profile-sub-chip">
                    <Sparkles size={13} className="text-cyan" />
                    <span>Forseti IA com OCR Ilimitado</span>
                  </div>
                  <div className="profile-sub-chip">
                    <Zap size={13} className="text-emerald" />
                    <span>Multi-Device (Web + App Android)</span>
                  </div>
                  <div className="profile-sub-chip">
                    <ShieldCheck size={13} className="text-purple" />
                    <span>Nuvem Criptografada Supabase</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'ASSINATURA' && (
            <div className="subtab-content animate-fade-in space-y-6">
              {/* Header com Toggle de Ciclo */}
              <div className="naturezas-header-row mb-4">
                <div>
                  <div className="kicker-badge" style={{ marginBottom: '0.25rem' }}>
                    <span>PLANO & FATURAMENTO</span>
                  </div>
                  <h3 className="label-with-info">
                    Assinatura & Recursos Premium
                    <InfoButton title="Assinatura & Recursos Premium">
                      <p>Gerencie seu plano Balder, ciclo de cobrança, faturas e métodos de pagamento.</p>
                    </InfoButton>
                  </h3>
                </div>

                <div className="subscription-billing-toggle">
                  <button
                    type="button"
                    className={`sub-toggle-btn ${billingCycle === 'MONTHLY' ? 'active' : ''}`}
                    onClick={() => setBillingCycle('MONTHLY')}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    className={`sub-toggle-btn ${billingCycle === 'YEARLY' ? 'active' : ''}`}
                    onClick={() => setBillingCycle('YEARLY')}
                  >
                    <span>Anual</span>
                    <span className="sub-save-badge">Economize 33%</span>
                  </button>
                </div>
              </div>

              {/* Toast de Feedback */}
              {subscriptionSuccessMsg && (
                <div className="subscription-toast-msg animate-fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald shrink-0" />
                    <span>{subscriptionSuccessMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubscriptionSuccessMsg(null)}
                    className="subscription-toast-close"
                    aria-label="Fechar mensagem"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Spotlight: Plano Ativo Vigente */}
              <div className="subscription-active-spotlight">
                <div className="sub-spotlight-top">
                  <div className="flex items-center gap-2">
                    <span className="sub-spotlight-badge">
                      <span className="sub-pulse-dot" />
                      PLANO ATIVO: BALDER PRO
                    </span>
                    <span className="badge badge-emerald text-[10px]">MEMBRO FUNDADOR</span>
                  </div>
                  <span className="sub-spotlight-renewal">Renovação automática em 23/10/2026</span>
                </div>

                <div className="sub-spotlight-body">
                  <div className="sub-spotlight-info">
                    <div className="sub-spotlight-icon-circle">
                      <Crown size={30} className="text-amber" />
                    </div>
                    <div>
                      <h4 className="sub-spotlight-title">Balder Pro — Ciclo {billingCycle === 'MONTHLY' ? 'Mensal' : 'Anual'}</h4>
                      <p className="sub-spotlight-desc">
                        {billingCycle === 'MONTHLY'
                          ? 'R$ 29,90 por mês • Cobrança automática no cartão •••• 4028'
                          : 'R$ 238,80 por ano (equivalente a R$ 19,90/mês) • 2 meses grátis'}
                      </p>
                    </div>
                  </div>

                  <div className="sub-spotlight-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        const newCycle = billingCycle === 'MONTHLY' ? 'YEARLY' : 'MONTHLY';
                        setBillingCycle(newCycle);
                        setSubscriptionSuccessMsg(
                          newCycle === 'YEARLY'
                            ? 'Ciclo Anual selecionado! Economia de 33% aplicada.'
                            : 'Ciclo Mensal selecionado.'
                        );
                      }}
                    >
                      Alternar para {billingCycle === 'MONTHLY' ? 'Anual (-33%)' : 'Mensal'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm flex items-center gap-1.5"
                      onClick={() => setSubscriptionSuccessMsg('Você já está desfrutando de todos os recursos do Balder Pro.')}
                    >
                      <CheckCircle2 size={15} />
                      <span>Plano em Dia</span>
                    </button>
                  </div>
                </div>

                {/* Grid de Benefícios do Plano Ativo */}
                <div className="sub-spotlight-perks-grid">
                  <div className="sub-spotlight-perk">
                    <CheckCircle2 size={16} className="text-emerald shrink-0" />
                    <span>Forseti IA com Leitura OCR de Comprovantes Ilimitada</span>
                  </div>
                  <div className="sub-spotlight-perk">
                    <CheckCircle2 size={16} className="text-emerald shrink-0" />
                    <span>Multi-tenant & Criptografia Segura Supabase RLS</span>
                  </div>
                  <div className="sub-spotlight-perk">
                    <CheckCircle2 size={16} className="text-emerald shrink-0" />
                    <span>Sincronização com App Nativo Android (.APK)</span>
                  </div>
                  <div className="sub-spotlight-perk">
                    <CheckCircle2 size={16} className="text-emerald shrink-0" />
                    <span>Simuladores PRICE / SAC & Gestão Inteligente de Dívidas</span>
                  </div>
                  <div className="sub-spotlight-perk">
                    <CheckCircle2 size={16} className="text-emerald shrink-0" />
                    <span>Contas, Cartões, Naturezas e Mapeamentos Ilimitados</span>
                  </div>
                  <div className="sub-spotlight-perk">
                    <CheckCircle2 size={16} className="text-emerald shrink-0" />
                    <span>Exportações Automatizadas em Formato Excel e CSV</span>
                  </div>
                </div>
              </div>

              {/* Grid Comparativo de Planos */}
              <div className="subscription-tiers-grid">
                {/* Plano Free */}
                <div className="sub-tier-card glass-card">
                  <div className="sub-tier-header">
                    <span className="sub-tier-name">Starter</span>
                    <div className="sub-tier-price-row">
                      <span className="sub-tier-price">R$ 0</span>
                      <span className="sub-tier-freq">/mês</span>
                    </div>
                    <p className="sub-tier-desc">Controle financeiro essencial para uso individual básico.</p>
                  </div>

                  <ul className="sub-tier-features">
                    <li><Check size={14} className="text-slate-400" /> Até 2 contas bancárias</li>
                    <li><Check size={14} className="text-slate-400" /> Até 1 cartão de crédito</li>
                    <li><Check size={14} className="text-slate-400" /> Histórico limitado a 90 dias</li>
                    <li className="opacity-40"><X size={14} /> Sem Forseti IA OCR</li>
                    <li className="opacity-40"><X size={14} /> Sem simulações avançadas de dívidas</li>
                  </ul>

                  <div className="sub-tier-footer">
                    <button type="button" className="btn btn-secondary w-full text-xs" disabled>
                      Plano Gratuito
                    </button>
                  </div>
                </div>

                {/* Plano Pro (Atual) */}
                <div className="sub-tier-card glass-card sub-tier-pro">
                  <div className="sub-tier-featured-tag">SEU PLANO ATUAL</div>
                  <div className="sub-tier-header">
                    <div className="flex items-center gap-1.5 text-cyan font-bold">
                      <Crown size={16} />
                      <span className="sub-tier-name text-cyan">Balder Pro</span>
                    </div>
                    <div className="sub-tier-price-row">
                      <span className="sub-tier-price text-cyan">
                        {billingCycle === 'MONTHLY' ? 'R$ 29,90' : 'R$ 19,90'}
                      </span>
                      <span className="sub-tier-freq">/mês</span>
                    </div>
                    <p className="sub-tier-desc">
                      {billingCycle === 'MONTHLY' ? 'Faturamento mensal recorrente' : 'Faturado anualmente (R$ 238,80/ano)'}
                    </p>
                  </div>

                  <ul className="sub-tier-features">
                    <li><Check size={14} className="text-cyan" /> Contas e cartões ilimitados</li>
                    <li><Check size={14} className="text-cyan" /> Forseti IA com OCR ilimitado</li>
                    <li><Check size={14} className="text-cyan" /> Multi-dispositivos (Web + App Android)</li>
                    <li><Check size={14} className="text-cyan" /> Simuladores PRICE / SAC de Dívidas</li>
                    <li><Check size={14} className="text-cyan" /> Exportações completas CSV e Excel</li>
                    <li><Check size={14} className="text-cyan" /> Suporte com canal prioritário</li>
                  </ul>

                  <div className="sub-tier-footer">
                    <button type="button" className="btn btn-primary w-full text-xs flex items-center justify-center gap-1.5" disabled>
                      <Check size={14} />
                      <span>Plano Vigente Ativo</span>
                    </button>
                  </div>
                </div>

                {/* Plano Founder Lifetime */}
                <div className="sub-tier-card glass-card sub-tier-founder">
                  <div className="sub-tier-founder-tag">VITALÍCIO • 14 VAGAS</div>
                  <div className="sub-tier-header">
                    <div className="flex items-center gap-1.5 text-amber font-bold">
                      <Sparkles size={16} />
                      <span className="sub-tier-name text-amber">Founder Lifetime</span>
                    </div>
                    <div className="sub-tier-price-row">
                      <span className="sub-tier-price text-amber">R$ 497</span>
                      <span className="sub-tier-freq">único</span>
                    </div>
                    <p className="sub-tier-desc">Acesso vitalício irrestrito sem nenhuma cobrança futura.</p>
                  </div>

                  <ul className="sub-tier-features">
                    <li><Check size={14} className="text-amber" /> Todos os recursos Pro para sempre</li>
                    <li><Check size={14} className="text-amber" /> Sem mensalidades ou anuidades</li>
                    <li><Check size={14} className="text-amber" /> Badge dourado de Membro Fundador</li>
                    <li><Check size={14} className="text-amber" /> Acesso antecipado a novas IAs financeiras</li>
                    <li><Check size={14} className="text-amber" /> Grupo VIP e contato com os fundadores</li>
                  </ul>

                  <div className="sub-tier-footer">
                    <button
                      type="button"
                      className="btn btn-amber w-full text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      onClick={() => setSubscriptionSuccessMsg('Upgrade para Founder Lifetime solicitado! Redirecionando para o checkout seguro...')}
                    >
                      <Sparkles size={14} />
                      <span>Garantir Vaga Vitalícia</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Informações de Pagamento & Faturas */}
              <div className="sub-billing-details-grid">
                {/* Cartão de Crédito Cadastrado */}
                <div className="sub-payment-card glass-card">
                  <div className="sub-card-title-row">
                    <div className="flex items-center gap-2">
                      <CreditCard size={18} className="text-cyan" />
                      <h4 className="text-sm font-bold text-white">Método de Pagamento</h4>
                    </div>
                    <span className="badge badge-emerald text-[10px]">PADRÃO</span>
                  </div>

                  <div className="sub-cc-info-box">
                    <div className="flex items-center gap-3">
                      <div className="sub-cc-brand">MC</div>
                      <div>
                        <p className="sub-cc-name">Mastercard Platinum</p>
                        <p className="sub-cc-number">•••• •••• •••• 4028 • Expira em 08/2029</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => setSubscriptionSuccessMsg('Modal para atualização de cartão acionado.')}
                    >
                      Atualizar
                    </button>
                  </div>

                  <p className="text-[11px] text-muted mt-3">
                    Cobranças processadas com segurança com criptografia de ponta a ponta (PCI-DSS Compliant).
                  </p>
                </div>

                {/* Histórico Recente de Faturas */}
                <div className="sub-invoices-card glass-card">
                  <div className="sub-card-title-row">
                    <div className="flex items-center gap-2">
                      <Receipt size={18} className="text-emerald" />
                      <h4 className="text-sm font-bold text-white">Histórico de Faturas</h4>
                    </div>
                    <span className="text-[11px] text-muted">3 recibos disponíveis</span>
                  </div>

                  <div className="sub-invoices-list">
                    <div className="sub-invoice-item">
                      <div>
                        <p className="sub-invoice-date">23/09/2026</p>
                        <p className="sub-invoice-plan">Balder Pro Mensal</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="sub-invoice-value">R$ 29,90</span>
                        <span className="badge badge-emerald text-[10px]">PAGO</span>
                        <button
                          type="button"
                          className="sub-invoice-dl-btn"
                          onClick={() => setSubscriptionSuccessMsg('Download da fatura de 23/09/2026 iniciado.')}
                          title="Baixar comprovante fiscal em PDF"
                        >
                          <Download size={13} />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>

                    <div className="sub-invoice-item">
                      <div>
                        <p className="sub-invoice-date">23/08/2026</p>
                        <p className="sub-invoice-plan">Balder Pro Mensal</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="sub-invoice-value">R$ 29,90</span>
                        <span className="badge badge-emerald text-[10px]">PAGO</span>
                        <button
                          type="button"
                          className="sub-invoice-dl-btn"
                          onClick={() => setSubscriptionSuccessMsg('Download da fatura de 23/08/2026 iniciado.')}
                          title="Baixar comprovante fiscal em PDF"
                        >
                          <Download size={13} />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>

                    <div className="sub-invoice-item">
                      <div>
                        <p className="sub-invoice-date">23/07/2026</p>
                        <p className="sub-invoice-plan">Balder Pro Mensal</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="sub-invoice-value">R$ 29,90</span>
                        <span className="badge badge-emerald text-[10px]">PAGO</span>
                        <button
                          type="button"
                          className="sub-invoice-dl-btn"
                          onClick={() => setSubscriptionSuccessMsg('Download da fatura de 23/07/2026 iniciado.')}
                          title="Baixar comprovante fiscal em PDF"
                        >
                          <Download size={13} />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações de Cancelamento / Garantia */}
              <div className="sub-guarantee-box">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-cyan shrink-0" />
                  <span className="text-xs text-slate-300">
                    Garantia incondicional de 14 dias com reembolso integral. Você pode cancelar sua assinatura a qualquer momento com apenas 1 clique nas configurações.
                  </span>
                </div>
                <button
                  type="button"
                  className="sub-cancel-link"
                  onClick={() => setSubscriptionSuccessMsg('Opções de pausa ou cancelamento abertas.')}
                >
                  Pausar ou cancelar assinatura
                </button>
              </div>
            </div>
          )}

          {activeSubTab === 'DOWNLOAD' && (
            <div className="subtab-content animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <h3>Download</h3>
                  <p className="subtab-desc">Instale o Balder no seu celular: Android (APK) ou iPhone (Tela de Início)</p>
                </div>
              </div>

              {/* Card Destaque de Download */}
              <div className="android-profile-card glass-card">
                <div className="android-profile-card-header">
                  <div className="android-profile-icon-box">
                    <Smartphone size={28} className="text-emerald" />
                  </div>
                  <div className="android-profile-header-info">
                    <h4>Balder Mobile para Android</h4>
                    <p>Experiência móvel nativa e ultra-rápida, sincronizada em tempo real com seu workspace na nuvem.</p>
                  </div>
                </div>

                <div className="android-profile-highlights-grid">
                  <div className="android-feature-item">
                    <ShieldCheck size={18} className="text-cyan shrink-0" />
                    <div>
                      <strong className="block text-xs text-white">Multi-tenant com Supabase RLS</strong>
                      <span className="text-xs text-muted">Isolamento rigoroso por usuário e criptografia de ponta a ponta</span>
                    </div>
                  </div>
                  <div className="android-feature-item">
                    <Sparkles size={18} className="text-amber shrink-0" />
                    <div>
                      <strong className="block text-xs text-white">Forseti IA com Scanner OCR</strong>
                      <span className="text-xs text-muted">Auditoria e leitura de cupons com purge de memória temporária</span>
                    </div>
                  </div>
                  <div className="android-feature-item">
                    <CheckCircle2 size={18} className="text-emerald shrink-0" />
                    <div>
                      <strong className="block text-xs text-white">Gestão Rápida & Simulador PRICE</strong>
                      <span className="text-xs text-muted">Controle total de amortizações, faturas e fluxo de caixa na palma da mão</span>
                    </div>
                  </div>
                </div>

                {/* Botão de Download Principal */}
                <div className="android-profile-dl-action">
                  <a
                    href="/balder-android.apk"
                    download="balder-android.apk"
                    className="android-download-btn cursor-pointer"
                  >
                    <div className="android-dl-icon-circle">
                      <Download size={22} className="text-white" />
                    </div>
                    <div className="android-dl-btn-text">
                      <span className="android-dl-btn-title">Baixar Pacote APK Nativo (.apk)</span>
                      <span className="android-dl-btn-meta">balder-android.apk • Tamanho: 32,9 MB • Arquitetura Universal (Release)</span>
                    </div>
                  </a>
                </div>

                {/* Especificações Técnicas */}
                <div className="android-profile-specs-grid">
                  <div className="spec-box">
                    <span className="spec-label">Identificador do Pacote</span>
                    <span className="spec-value">com.balder.financial</span>
                  </div>
                  <div className="spec-box">
                    <span className="spec-label">Versão do Aplicativo</span>
                    <span className="spec-value">1.0.0 (Build 1)</span>
                  </div>
                  <div className="spec-box">
                    <span className="spec-label">Compatibilidade Mínima</span>
                    <span className="spec-value">Android 8.0 (API 26) ou superior</span>
                  </div>
                  <div className="spec-box">
                    <span className="spec-label">Status da Assinatura</span>
                    <span className="spec-value text-emerald font-semibold">Assinado Oficialmente (v1/v2)</span>
                  </div>
                </div>

                {/* Guia de Instalação Passo a Passo */}
                <div className="android-install-guide mt-2">
                  <div className="guide-title-row">
                    <AlertTriangle size={16} className="text-amber" />
                    <h4>Como instalar no seu celular Android em 3 passos:</h4>
                  </div>
                  <ol className="guide-steps-list">
                    <li>
                      <strong>1. Baixe o pacote:</strong> Toque no botão verde acima. Se o seu navegador exibir um aviso sobre arquivos APK externos (ex: <em>"O arquivo pode ser nocivo"</em>), toque em <strong>Fazer o download mesmo assim</strong>.
                    </li>
                    <li>
                      <strong>2. Autorize a instalação:</strong> Abra o arquivo baixado através da barra de notificações ou da pasta <em>Downloads</em> do seu celular. Caso o sistema solicite permissão, toque em <strong>Configurações</strong> e ative <strong>"Permitir desta fonte"</strong>.
                    </li>
                    <li>
                      <strong>3. Conclua a instalação:</strong> Toque em <strong>Instalar</strong>. Em seguida, toque em <strong>Abrir</strong> e faça login com sua conta do Balder.
                    </li>
                  </ol>
                </div>
              </div>

              {/* iPhone: não há instalação por arquivo; o Balder vira app pela Tela de Início */}
              <div className="android-profile-card ios-profile-card glass-card">
                <div className="android-profile-card-header">
                  <div className="android-profile-icon-box ios-profile-icon-box">
                    <Smartphone size={28} className="text-cyan" />
                  </div>
                  <div className="android-profile-header-info">
                    <h4>Balder para iPhone</h4>
                    <p>
                      Instale pela Tela de Início do iPhone: abre em tela cheia, com o ícone do Balder e sempre na versão mais nova,
                      sem passar pela App Store.
                    </p>
                  </div>
                </div>

                <div className="ios-profile-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const link = `${window.location.origin}/#iphone`;
                      navigator.clipboard?.writeText(link).then(
                        () => setIosLinkCopied(true),
                        () => window.prompt('Copie o link para enviar ao iPhone:', link)
                      );
                      window.setTimeout(() => setIosLinkCopied(false), 2500);
                    }}
                  >
                    {iosLinkCopied ? <CheckCircle2 size={16} className="text-emerald" /> : <Copy size={16} />}
                    <span>{iosLinkCopied ? 'Link copiado!' : 'Copiar link para o iPhone'}</span>
                  </button>
                </div>

                <div className="android-install-guide mt-2">
                  <div className="guide-title-row">
                    <AlertTriangle size={16} className="text-amber" />
                    <h4>Como instalar no iPhone em 3 passos:</h4>
                  </div>
                  <ol className="guide-steps-list">
                    <li>
                      <strong>1. Abra no Safari:</strong> acesse <strong>{window.location.host}</strong> no iPhone (ou envie o link acima para
                      você mesmo). No Chrome do iPhone também funciona.
                    </li>
                    <li>
                      <strong>2. Toque em Compartilhar:</strong> o ícone de quadrado com a seta para cima, na barra do navegador.
                    </li>
                    <li>
                      <strong>3. Escolha "Adicionar à Tela de Início"</strong> e confirme em <strong>Adicionar</strong>. O ícone do Balder
                      aparece junto com os seus apps.
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          

          {activeSubTab === 'MARCOS' && (
            <div className="subtab-content animate-fade-in">
              {/* Header do Módulo com Ações Globais */}
              <div className="naturezas-header-row mb-5" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        color: '#818CF8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Compass size={20} />
                    </div>
                    <h3 className="label-with-info" style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      Marcos de Planejamento & Cenários Financeiros
                      <InfoButton title="Marcos e cenários">
                        <p>
                          O <strong>marco ativo</strong> é o planejamento em vigor: ele ancora o saldo em caixa, o acompanhamento e o
                          cálculo das metas.
                        </p>
                        <p>Você pode criar novos cenários, fazer simulações alternativas e arquivar marcos antigos.</p>
                      </InfoButton>
                    </h3>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {duplicateCheckpoints.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{
                        background: 'rgba(245, 158, 11, 0.15)',
                        borderColor: 'rgba(245, 158, 11, 0.4)',
                        color: '#FCD34D',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      onClick={() => {
                        if (window.confirm(`Deseja consolidar e remover as ${duplicateCheckpoints.length} réplicas duplicadas mantendo apenas o marco principal?`)) {
                          duplicateCheckpoints.forEach((cp) => deleteCheckpoint(cp.id));
                        }
                      }}
                      title="Remover réplicas criadas repetidamente"
                    >
                      <Copy size={14} />
                      <span>Limpar Duplicados ({duplicateCheckpoints.length})</span>
                    </button>
                  )}

                  {checkpoints.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        borderColor: 'rgba(239, 68, 68, 0.35)',
                        color: '#FCA5A5',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      onClick={() => {
                        confirmAction({
                          title: 'Zerar Todos os Marcos',
                          message:
                            'Todos os marcos e cenários serão apagados definitivamente (neste dispositivo e na nuvem) e o Balder solicitará um novo ponto de partida. Para apagar também lançamentos, faturas e outros dados, use Perfil › Formatar Dados.',
                          confirmLabel: 'Zerar Marcos',
                          onConfirm: () => {
                            void clearAllCheckpoints();
                          },
                        });
                      }}
                      title="Zerar todos os marcos existentes no sistema"
                    >
                      <RotateCcw size={14} />
                      <span>Zerar Todos os Marcos</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                    onClick={() => {
                      setCheckpointModalMode('CREATE');
                      setCheckpointModalOpen(true);
                    }}
                  >
                    <Plus size={15} />
                    <span>Novo Ponto de Partida</span>
                  </button>
                </div>
              </div>

              {/* Filtros em Abas: Planejamentos & Simulações vs Arquivados vs Todos */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '20px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                    background: checkpointTabFilter === 'ACTIVE_AND_SIMS' ? 'var(--color-primary, #6366f1)' : 'rgba(255, 255, 255, 0.05)',
                    color: checkpointTabFilter === 'ACTIVE_AND_SIMS' ? '#fff' : 'var(--text-secondary)',
                    border: checkpointTabFilter === 'ACTIVE_AND_SIMS' ? '1px solid #4f46e5' : '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                  onClick={() => setCheckpointTabFilter('ACTIVE_AND_SIMS')}
                >
                  <Flag size={13} />
                  <span>Planejamentos & Simulações ({checkpoints.filter((c) => !c.isArchived).length})</span>
                </button>

                <button
                  type="button"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                    background: checkpointTabFilter === 'ARCHIVED' ? 'var(--color-primary, #6366f1)' : 'rgba(255, 255, 255, 0.05)',
                    color: checkpointTabFilter === 'ARCHIVED' ? '#fff' : 'var(--text-secondary)',
                    border: checkpointTabFilter === 'ARCHIVED' ? '1px solid #4f46e5' : '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                  onClick={() => setCheckpointTabFilter('ARCHIVED')}
                >
                  <Archive size={13} />
                  <span>Arquivados ({checkpoints.filter((c) => c.isArchived).length})</span>
                </button>

                <button
                  type="button"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                    background: checkpointTabFilter === 'ALL' ? 'var(--color-primary, #6366f1)' : 'rgba(255, 255, 255, 0.05)',
                    color: checkpointTabFilter === 'ALL' ? '#fff' : 'var(--text-secondary)',
                    border: checkpointTabFilter === 'ALL' ? '1px solid #4f46e5' : '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                  onClick={() => setCheckpointTabFilter('ALL')}
                >
                  <span>Todos ({checkpoints.length})</span>
                </button>
              </div>

              {checkpoints.length === 0 ? (
                <div className="empty-state-card glass-card text-center p-8" style={{ borderRadius: '16px', border: '1px dashed rgba(99, 102, 241, 0.3)', padding: '48px 24px' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '16px',
                      background: 'rgba(99, 102, 241, 0.12)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      color: '#818CF8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px auto',
                    }}
                  >
                    <Flag size={32} />
                  </div>
                  <h4 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Nenhum marco de início definido
                  </h4>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 20px auto', lineHeight: '1.6' }}>
                    Defina um ponto de partida para indicar a partir de quando o Balder deve calcular seus saldos em caixa, patrimônio líquido e projetar suas finanças.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '10px 20px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    onClick={() => {
                      setCheckpointModalMode('CREATE');
                      setCheckpointModalOpen(true);
                    }}
                  >
                    <Flag size={16} />
                    <span>Definir Ponto de Partida Agora</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* HERO CARD: Marco Vigente / Planejamento Ativo no Sistema */}
                  {activeCheckpoint && checkpointTabFilter !== 'ARCHIVED' && (
                    <div
                      style={{
                        padding: '24px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        boxShadow: '0 8px 32px rgba(16, 185, 129, 0.08), 0 0 20px rgba(99, 102, 241, 0.05)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '12px',
                              background: 'rgba(16, 185, 129, 0.25)',
                              border: '1px solid rgba(16, 185, 129, 0.5)',
                              color: '#34D399',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Flag size={20} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <h4 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#fff' }}>
                                {activeCheckpoint.label || 'Marco de Início'}
                              </h4>
                              <span
                                style={{
                                  padding: '3px 10px',
                                  borderRadius: '9999px',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                  background: 'rgba(16, 185, 129, 0.25)',
                                  border: '1px solid rgba(16, 185, 129, 0.5)',
                                  color: '#34D399',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                }}
                              >
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34D399', boxShadow: '0 0 6px #34D399' }} />
                                Planejamento Ativo no Sistema
                              </span>
                              {activeCheckpoint.type === 'SIMULATION' && (
                                <span
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: '9999px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    background: 'rgba(168, 85, 247, 0.2)',
                                    border: '1px solid rgba(168, 85, 247, 0.4)',
                                    color: '#C084FC',
                                  }}
                                >
                                  Simulação Alternativa
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              Início em <strong>{activeCheckpoint.startDate.split('-').reverse().join('/')}</strong> • Ancorando Dashboard, Runway e Metas
                            </span>
                          </div>
                        </div>

                        {/* Ações Rápidas no Marco Ativo */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            style={{
                              fontSize: '12px',
                              padding: '5px 12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'rgba(99, 102, 241, 0.25)',
                              borderColor: 'rgba(99, 102, 241, 0.5)',
                              color: '#C7D2FE',
                              fontWeight: 700,
                            }}
                            onClick={() => setSelectedCheckpointDetails(activeCheckpoint)}
                            title="Abrir pop-up com detalhamento completo das faturas e métricas deste marco"
                          >
                            <Eye size={14} />
                            <span>Ver Detalhamento</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            style={{
                              fontSize: '12px',
                              padding: '5px 10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                            onClick={() => duplicateCheckpointAsSimulation(activeCheckpoint.id)}
                            title="Clonar este marco como simulação para testar outros números"
                          >
                            <Copy size={13} />
                            <span>Duplicar p/ Simulação</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            style={{
                              fontSize: '12px',
                              padding: '5px 10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                            onClick={() => {
                              setCheckpointModalMode('EDIT');
                              setCheckpointModalOpen(true);
                            }}
                            title="Editar valores e recalibrar este ponto de partida"
                          >
                            <Edit2 size={13} />
                            <span>Recalibrar</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            style={{
                              fontSize: '12px',
                              padding: '5px 10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              color: 'var(--text-muted)',
                            }}
                            onClick={() => {
                              if (window.confirm('Deseja arquivar este planejamento vigente?')) {
                                archiveCheckpoint(activeCheckpoint.id);
                              }
                            }}
                            title="Arquivar este planejamento no histórico"
                          >
                            <Archive size={13} />
                            <span>Arquivar</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            style={{
                              fontSize: '12px',
                              padding: '5px 10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              color: '#F87171',
                            }}
                            onClick={() => {
                              confirmAction({
                                title: 'Excluir Marco',
                                message: `Deseja excluir definitivamente o marco "${activeCheckpoint.label || activeCheckpoint.startDate}"?${
                                  checkpoints.length <= 1
                                    ? ' É o único marco: o Balder pedirá um novo ponto de partida para recalibrar o fluxo.'
                                    : ' Outro marco será ativado no lugar dele.'
                                } Esta ação não pode ser desfeita.`,
                                confirmLabel: 'Excluir',
                                onConfirm: () => {
                                  if (checkpoints.length <= 1) {
                                    void clearAllCheckpoints();
                                  } else {
                                    deleteCheckpoint(activeCheckpoint.id);
                                  }
                                },
                              });
                            }}
                            title="Excluir definitivamente este marco"
                          >
                            <Trash2 size={13} />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>

                      {/* Grade de Métricas do Marco Vigente */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '12px',
                          background: 'rgba(0, 0, 0, 0.25)',
                          padding: '14px',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Data de Início
                          </span>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <Calendar size={15} style={{ color: '#818CF8' }} />
                            {activeCheckpoint.startDate.split('-').reverse().join('/')}
                          </span>
                        </div>

                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Saldo Inicial em Caixa
                          </span>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#34D399', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <Wallet size={15} style={{ color: '#34D399' }} />
                            {activeCheckpoint.initialBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>

                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Faturas / Dívida de Cartão
                          </span>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#F87171', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <CreditCard size={15} style={{ color: '#F87171' }} />
                            {activeCheckpoint.creditCardDebt && activeCheckpoint.creditCardDebt > 0
                              ? `- ${activeCheckpoint.creditCardDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                              : 'R$ 0,00'}
                          </span>
                        </div>

                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Patrimônio Líquido de Partida
                          </span>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <TrendingUp size={15} style={{ color: '#38BDF8' }} />
                            {(activeCheckpoint.initialNetWorth !== undefined
                              ? activeCheckpoint.initialNetWorth
                              : activeCheckpoint.initialBalance - (activeCheckpoint.creditCardDebt || 0)
                            ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                      </div>

                      {activeCheckpoint.notes && (
                        <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          "{activeCheckpoint.notes}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Subtítulo da Lista de Cenários */}
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                      {checkpointTabFilter === 'ARCHIVED'
                        ? 'Marcos Arquivados no Histórico'
                        : checkpointTabFilter === 'ALL'
                        ? 'Todos os Cenários Cadastrados'
                        : 'Demais Cenários & Simulações Alternativas'}
                    </h4>

                    {/* Grade dos Demais Marcos */}
                    {checkpoints
                      .filter((cp) => {
                        if (checkpointTabFilter === 'ARCHIVED') return cp.isArchived;
                        if (checkpointTabFilter === 'ACTIVE_AND_SIMS') return !cp.isArchived;
                        return true;
                      })
                      .filter((cp) => (checkpointTabFilter === 'ACTIVE_AND_SIMS' ? !cp.isActive : true)).length === 0 ? (
                      <div
                        style={{
                          padding: '24px',
                          textAlign: 'center',
                          borderRadius: '12px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px dashed rgba(255, 255, 255, 0.1)',
                          color: 'var(--text-muted)',
                          fontSize: '13px',
                        }}
                      >
                        {checkpointTabFilter === 'ARCHIVED'
                          ? 'Nenhum marco arquivado no momento.'
                          : 'Nenhum outro cenário cadastrado. Você pode duplicar o marco ativo para criar simulações.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {checkpoints
                          .filter((cp) => {
                            if (checkpointTabFilter === 'ARCHIVED') return cp.isArchived;
                            if (checkpointTabFilter === 'ACTIVE_AND_SIMS') return !cp.isArchived;
                            return true;
                          })
                          .filter((cp) => (checkpointTabFilter === 'ACTIVE_AND_SIMS' ? !cp.isActive : true))
                          .map((cp) => (
                            <div
                              key={cp.id}
                              className="glass-card"
                              style={{
                                padding: '18px',
                                borderRadius: '14px',
                                border: cp.isActive ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                                background: cp.isActive
                                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)'
                                  : 'rgba(255, 255, 255, 0.03)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s',
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div
                                      style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        background: cp.isActive
                                          ? 'rgba(16, 185, 129, 0.2)'
                                          : cp.type === 'SIMULATION'
                                          ? 'rgba(168, 85, 247, 0.15)'
                                          : 'rgba(255, 255, 255, 0.06)',
                                        color: cp.isActive ? '#34D399' : cp.type === 'SIMULATION' ? '#C084FC' : 'var(--text-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {cp.type === 'SIMULATION' ? <Sparkles size={18} /> : <Flag size={18} />}
                                    </div>
                                    <div>
                                      {editingCheckpointId === cp.id ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <input
                                            type="text"
                                            value={editingLabelValue}
                                            onChange={(e) => setEditingLabelValue(e.target.value)}
                                            style={{
                                              padding: '4px 8px',
                                              borderRadius: '6px',
                                              fontSize: '13px',
                                              background: 'rgba(0, 0, 0, 0.4)',
                                              border: '1px solid #6366f1',
                                              color: '#fff',
                                            }}
                                            autoFocus
                                          />
                                          <button
                                            type="button"
                                            className="btn btn-primary btn-xs"
                                            onClick={() => {
                                              updateCheckpoint(cp.id, { label: editingLabelValue.trim() || cp.label });
                                              setEditingCheckpointId(null);
                                            }}
                                          >
                                            Salvar
                                          </button>
                                        </div>
                                      ) : (
                                        <h4
                                          style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                          <span>{cp.label || 'Marco de Início'}</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingCheckpointId(cp.id);
                                              setEditingLabelValue(cp.label || '');
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                                            title="Editar nome do planejamento"
                                          >
                                            <Edit2 size={12} />
                                          </button>
                                        </h4>
                                      )}
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        Início em {cp.startDate.split('-').reverse().join('/')}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Badges de Status */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    {cp.isActive && (
                                      <span
                                        style={{
                                          padding: '2px 8px',
                                          borderRadius: '9999px',
                                          fontSize: '10px',
                                          fontWeight: 800,
                                          background: 'rgba(16, 185, 129, 0.25)',
                                          border: '1px solid rgba(16, 185, 129, 0.5)',
                                          color: '#34D399',
                                        }}
                                      >
                                        ATIVO
                                      </span>
                                    )}

                                    {cp.type === 'SIMULATION' && (
                                      <span
                                        style={{
                                          padding: '2px 8px',
                                          borderRadius: '9999px',
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          background: 'rgba(168, 85, 247, 0.15)',
                                          border: '1px solid rgba(168, 85, 247, 0.35)',
                                          color: '#C084FC',
                                        }}
                                      >
                                        SIMULAÇÃO
                                      </span>
                                    )}

                                    {cp.isArchived && (
                                      <span
                                        style={{
                                          padding: '2px 8px',
                                          borderRadius: '9999px',
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          background: 'rgba(255, 255, 255, 0.1)',
                                          color: 'var(--text-muted)',
                                        }}
                                      >
                                        ARQUIVADO
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Valores com Espaçamento Adequado */}
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '10px',
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    background: 'rgba(0, 0, 0, 0.25)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    marginBottom: '12px',
                                  }}
                                >
                                  <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                                      Saldo em Caixa
                                    </span>
                                    <strong style={{ fontSize: '13px', color: '#34D399' }}>
                                      {cp.initialBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </strong>
                                  </div>

                                  <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                                      Dívida de Cartão
                                    </span>
                                    <strong style={{ fontSize: '13px', color: cp.creditCardDebt && cp.creditCardDebt > 0 ? '#F87171' : 'var(--text-muted)' }}>
                                      {cp.creditCardDebt && cp.creditCardDebt > 0
                                        ? `- ${cp.creditCardDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                                        : 'R$ 0,00'}
                                    </strong>
                                  </div>
                                </div>

                                {cp.notes && (
                                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 12px 0' }}>
                                    "{cp.notes}"
                                  </p>
                                )}
                              </div>

                              {/* Rodapé do Card com Ação de Ativação e Gestão */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                  paddingTop: '10px',
                                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  {!cp.isActive && (
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-xs"
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        padding: '4px 10px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                      }}
                                      onClick={() => activateCheckpoint(cp.id)}
                                      title="Tornar este o planejamento e marco ativo no sistema"
                                    >
                                      <Zap size={12} />
                                      <span>Ativar este Planejamento</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-xs"
                                    style={{
                                      fontSize: '11px',
                                      padding: '4px 8px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      color: '#C7D2FE',
                                      background: 'rgba(99, 102, 241, 0.15)',
                                      border: '1px solid rgba(99, 102, 241, 0.3)',
                                    }}
                                    onClick={() => setSelectedCheckpointDetails(cp)}
                                    title="Ver detalhamento completo deste marco"
                                  >
                                    <Eye size={12} />
                                    <span>Detalhamento</span>
                                  </button>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    type="button"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--text-muted)',
                                      cursor: 'pointer',
                                      padding: '4px',
                                    }}
                                    onClick={() => duplicateCheckpointAsSimulation(cp.id)}
                                    title="Duplicar como Simulação"
                                  >
                                    <Copy size={14} />
                                  </button>

                                  <button
                                    type="button"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--text-muted)',
                                      cursor: 'pointer',
                                      padding: '4px',
                                    }}
                                    onClick={() => (cp.isArchived ? unarchiveCheckpoint(cp.id) : archiveCheckpoint(cp.id))}
                                    title={cp.isArchived ? 'Desarquivar Marco' : 'Arquivar Marco'}
                                  >
                                    {cp.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                                  </button>

                                  <button
                                    type="button"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#F87171',
                                      cursor: 'pointer',
                                      padding: '4px',
                                    }}
                                    title="Excluir este marco"
                                    onClick={() => {
                                      if (window.confirm(`Tem certeza que deseja excluir o marco "${cp.label || cp.startDate}"?`)) {
                                        deleteCheckpoint(cp.id);
                                      }
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'CONTAS' && (
            <div className="subtab-content animate-fade-in">
              {/* Header com Ações Rápidas */}
              <div className="naturezas-header-row mb-4">
                <div>
                  <h3 className="label-with-info">
                    Contas, Carteiras, Cartões & Meios de Pagamento
                    <InfoButton title="Contas, Carteiras, Cartões & Meios de Pagamento">
                      <p>Gerencie seus saldos conciliados, limites de cartões e métodos de liquidação financeira.</p>
                    </InfoButton>
                  </h3>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleOpenEntityModal('CONTA')}
                    title="Cadastrar nova conta bancária ou carteira"
                  >
                    <Plus size={15} />
                    <span>Nova Conta</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenEntityModal('CARTAO')}
                    title="Cadastrar novo cartão de crédito"
                  >
                    <CreditCard size={15} />
                    <span>Novo Cartão</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenEntityModal('PAGAMENTO')}
                    title="Cadastrar nova forma de pagamento"
                  >
                    <Wallet size={15} />
                    <span>Forma Pagamento</span>
                  </button>
                </div>
              </div>

              {/* Filtros Internos por Categoria */}
              <div className="entity-filter-pills mb-5">
                <button
                  type="button"
                  className={`entity-filter-pill ${contasFilter === 'TODAS' ? 'active' : ''}`}
                  onClick={() => setContasFilter('TODAS')}
                >
                  Todas ({accounts.length + cards.length + paymentMethods.length})
                </button>
                <button
                  type="button"
                  className={`entity-filter-pill ${contasFilter === 'CONTAS' ? 'active' : ''}`}
                  onClick={() => setContasFilter('CONTAS')}
                >
                  🏦 Contas & Carteiras ({accounts.length})
                </button>
                <button
                  type="button"
                  className={`entity-filter-pill ${contasFilter === 'CARTOES' ? 'active' : ''}`}
                  onClick={() => setContasFilter('CARTOES')}
                >
                  💳 Cartões de Crédito ({cards.length})
                </button>
                <button
                  type="button"
                  className={`entity-filter-pill ${contasFilter === 'PAGAMENTOS' ? 'active' : ''}`}
                  onClick={() => setContasFilter('PAGAMENTOS')}
                >
                  ⚡ Meios de Pagamento ({paymentMethods.length})
                </button>
              </div>

              {/* SEÇÃO 1: CONTAS & CARTEIRAS */}
              {(contasFilter === 'TODAS' || contasFilter === 'CONTAS') && (
                <div className="entity-section mb-6">
                  <div className="entity-section-title-row">
                    <h4>
                      <Landmark size={18} className="text-cyan inline mr-2" />
                      Contas Bancárias & Carteiras ({accounts.length})
                    </h4>
                    <button
                      className="btn btn-ghost btn-xs text-cyan"
                      onClick={() => handleOpenEntityModal('CONTA')}
                    >
                      <Plus size={14} />
                      <span>Adicionar Conta</span>
                    </button>
                  </div>

                  {accounts.length > 0 ? (
                    <div className="accounts-list-grid">
                      {accounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="account-item-card glass-card"
                          style={{ borderLeft: `3px solid ${acc.color || 'var(--accent-cyan)'}` }}
                        >
                          <div className="account-item-header">
                            <span className="account-icon">{acc.icon}</span>
                            <div>
                              <h4 className="font-semibold">{acc.name}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                {acc.bankName && (
                                  <span className="text-xs text-muted font-medium">{acc.bankName} •</span>
                                )}
                                <span className="account-type-tag">{acc.type}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="account-balance text-glow-cyan block">
                                {acc.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                              <span className="text-xs text-muted">Saldo disponível</span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                className="btn btn-ghost btn-xs text-muted hover:text-cyan"
                                title="Editar Conta"
                                onClick={() => handleOpenEntityModal('CONTA', acc)}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                className="btn btn-ghost btn-xs text-muted hover:text-rose"
                                title="Excluir Conta"
                                onClick={() => {
                                  if (confirm(`Deseja realmente excluir a conta "${acc.name}"?`)) {
                                    deleteAccount(acc.id);
                                  }
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state-card glass-card">
                      <Landmark size={36} className="text-cyan mb-2" />
                      <h4>Nenhuma conta ou carteira cadastrada</h4>
                      <p>
                        Cadastre suas contas correntes, contas salário, poupanças ou carteiras físicas para acompanhar seu saldo real em caixa.
                      </p>
                      <button
                        className="btn btn-primary btn-sm mt-3"
                        onClick={() => handleOpenEntityModal('CONTA')}
                      >
                        <Plus size={15} />
                        <span>Cadastrar Primeira Conta</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* SEÇÃO 2: CARTÕES DE CRÉDITO */}
              {(contasFilter === 'TODAS' || contasFilter === 'CARTOES') && (
                <div className="entity-section mb-6">
                  <div className="entity-section-title-row">
                    <h4>
                      <CreditCard size={18} className="text-purple-400 inline mr-2" />
                      Cartões de Crédito ({cards.length})
                    </h4>
                    <button
                      className="btn btn-ghost btn-xs text-purple-400"
                      onClick={() => handleOpenEntityModal('CARTAO')}
                    >
                      <Plus size={14} />
                      <span>Adicionar Cartão</span>
                    </button>
                  </div>

                  {cards.length > 0 ? (
                    <div className="cards-list-grid">
                      {cards.map((c) => {
                        const used = c.limitUsed || 0;
                        const available = Math.max(0, c.limitTotal - used);
                        const percentUsed = c.limitTotal > 0 ? Math.round((used / c.limitTotal) * 100) : 0;

                        return (
                          <div
                            key={c.id}
                            className="credit-card-display-box glass-card"
                            style={{
                              borderLeft: `4px solid ${c.color || '#8A05BE'}`,
                            }}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: c.color || '#8A05BE' }}
                                />
                                <strong className="text-white text-base">{c.name}</strong>
                                <span className="badge badge-outline text-xs">{c.brand}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  className="btn btn-ghost btn-xs text-muted hover:text-cyan"
                                  title="Editar Cartão"
                                  onClick={() => handleOpenEntityModal('CARTAO', c)}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  className="btn btn-ghost btn-xs text-muted hover:text-rose"
                                  title="Excluir Cartão"
                                  onClick={() => {
                                    confirmAction({
                                  title: 'Excluir Cartão',
                                  message: `Deseja realmente excluir o cartão "${c.name}"? Esta ação não pode ser desfeita.`,
                                  confirmLabel: 'Excluir',
                                  onConfirm: () => deleteCard(c.id),
                                });
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-muted mb-2">
                              <span>Emissor: <strong className="text-secondary">{c.bank}</strong></span>
                              <span>Fecha dia <strong>{c.closingDay}</strong> • Vence dia <strong className="text-cyan">{c.dueDay}</strong></span>
                            </div>

                            {/* Barra de Limite */}
                            <div className="cc-limit-progress-track mb-2">
                              <div
                                className="cc-limit-progress-fill"
                                style={{
                                  width: `${Math.min(percentUsed, 100)}%`,
                                  backgroundColor: c.color || '#8A05BE',
                                }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted">
                                Usado: <strong>{used.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                              </span>
                              <span className="text-cyan font-medium">
                                Disponível: <strong>{available.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                              </span>
                              <span className="text-secondary font-medium">
                                Total: <strong>{c.limitTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state-card glass-card">
                      <CreditCard size={36} className="text-purple-400 mb-2" />
                      <h4>Nenhum cartão cadastrado</h4>
                      <p>
                        Cadastre seus cartões para controle das faturas, datas de fechamento e conciliação de compras parceladas.
                      </p>
                      <button
                        className="btn btn-secondary btn-sm mt-3"
                        onClick={() => handleOpenEntityModal('CARTAO')}
                      >
                        <Plus size={15} />
                        <span>Cadastrar Primeiro Cartão</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* SEÇÃO 3: FORMAS DE PAGAMENTO */}
              {(contasFilter === 'TODAS' || contasFilter === 'PAGAMENTOS') && (
                <div className="entity-section">
                  <div className="entity-section-title-row">
                    <h4>
                      <Wallet size={18} className="text-emerald inline mr-2" />
                      Formas de Pagamento ({paymentMethods.length})
                    </h4>
                    <button
                      className="btn btn-ghost btn-xs text-emerald"
                      onClick={() => handleOpenEntityModal('PAGAMENTO')}
                    >
                      <Plus size={14} />
                      <span>Adicionar Forma de Pagamento</span>
                    </button>
                  </div>

                  {paymentMethods.length > 0 ? (
                    <div className="payment-methods-list-grid">
                      {paymentMethods.map((pm) => {
                        const linkedAcc = accounts.find((a) => a.id === pm.linkedAccountId);
                        const linkedC = cards.find((c) => c.id === pm.linkedCardId);

                        return (
                          <div
                            key={pm.id}
                            className="payment-method-card glass-card"
                            style={{ borderLeft: `3px solid ${pm.color || '#00D2B6'}` }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{pm.icon || '⚡'}</span>
                              <div>
                                <strong className="text-white text-sm block">{pm.name}</strong>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="badge badge-emerald text-xs">{pm.type}</span>
                                  {linkedAcc && (
                                    <span className="text-xs text-muted">
                                      • Conta: {linkedAcc.name}
                                    </span>
                                  )}
                                  {linkedC && (
                                    <span className="text-xs text-muted">
                                      • Cartão: {linkedC.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                className="btn btn-ghost btn-xs text-muted hover:text-cyan"
                                title="Editar Forma de Pagamento"
                                onClick={() => handleOpenEntityModal('PAGAMENTO', pm)}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                className="btn btn-ghost btn-xs text-muted hover:text-rose"
                                title="Excluir Forma de Pagamento"
                                onClick={() => {
                                  if (confirm(`Deseja excluir a forma de pagamento "${pm.name}"?`)) {
                                    deletePaymentMethod(pm.id);
                                  }
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state-card glass-card">
                      <Wallet size={36} className="text-emerald mb-2" />
                      <h4>Nenhuma forma de pagamento cadastrada</h4>
                      <p>
                        Cadastre opções rápidas como PIX, Boleto Bancário ou Débito para facilitar seus lançamentos e conciliação.
                      </p>
                      <button
                        className="btn btn-secondary btn-sm mt-3"
                        onClick={() => handleOpenEntityModal('PAGAMENTO')}
                      >
                        <Plus size={15} />
                        <span>Cadastrar Meio de Pagamento</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'BANCOS' && (
            <div className="subtab-content animate-fade-in">
              <div className="naturezas-header-row mb-4">
                <div>
                  <h3 className="label-with-info">
                    Bancos & Instituições Financeiras
                    <InfoButton title="Bancos & Instituições Financeiras">
                      <p>Instituições cadastradas e conexões protegidas via Open Finance Brasil</p>
                    </InfoButton>
                  </h3>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleOpenEntityModal('BANCO')}
                >
                  <Plus size={15} />
                  <span>Adicionar Banco</span>
                </button>
              </div>

              {banks.length > 0 ? (
                <div className="open-finance-status-box">
                  {banks.map((b) => {
                    const linkedAccountsCount = accounts.filter(
                      (a) => a.bankName === b.name || a.name.toLowerCase().includes(b.name.toLowerCase().split(' ')[0])
                    ).length;
                    const linkedCardsCount = cards.filter(
                      (c) => c.bank === b.name || c.bank.toLowerCase().includes(b.name.toLowerCase().split(' ')[0])
                    ).length;

                    return (
                      <div key={b.id} className="of-status-item glass-card">
                        <div className="flex items-center gap-3">
                          <span className="of-logo text-2xl">{b.icon}</span>
                          <div className="of-info">
                            <div className="flex items-center gap-2">
                              <strong>{b.name}</strong>
                              {b.code && (
                                <span className="badge badge-outline text-xs">COMPE {b.code}</span>
                              )}
                            </div>
                            <span className="text-xs text-muted block mt-0.5">
                              {b.status === 'CONECTADO'
                                ? `Sincronizado ${b.syncedAt || 'recentemente'} • ${linkedAccountsCount} Conta(s), ${linkedCardsCount} Cartão(ões)`
                                : `Instituição Manual • ${linkedAccountsCount} Conta(s), ${linkedCardsCount} Cartão(ões)`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`badge ${b.status === 'CONECTADO' ? 'badge-emerald' : 'badge-cyan'}`}>
                            {b.status === 'CONECTADO' ? 'CONECTADO' : 'ATIVO MANUAL'}
                          </span>

                          <button
                            className="btn btn-ghost btn-xs text-muted hover:text-cyan"
                            title="Editar Banco"
                            onClick={() => handleOpenEntityModal('BANCO', b)}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="btn btn-ghost btn-xs text-muted hover:text-rose"
                            title="Excluir Banco"
                            onClick={() => {
                              if (confirm(`Deseja realmente excluir o banco "${b.name}"?`)) {
                                deleteBank(b.id);
                              }
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state-card glass-card">
                  <Building size={36} className="text-cyan mb-2" />
                  <h4>Nenhum banco ou instituição cadastrada</h4>
                  <p>
                    Cadastre os bancos onde você possui contas e cartões para organizar seus relatórios e conciliações.
                  </p>
                  <button
                    className="btn btn-primary btn-sm mt-3"
                    onClick={() => handleOpenEntityModal('BANCO')}
                  >
                    <Plus size={15} />
                    <span>Cadastrar Primeiro Banco</span>
                  </button>
                </div>
              )}
            </div>
          )}



          {activeSubTab === 'PREFERENCIAS' && (
            <div className="subtab-content">
              <h3 className="label-with-info">
                Preferências de Exibição
                <InfoButton title="Preferências de Exibição">
                  <p>Personalize a sua interface do BALDER</p>
                </InfoButton>
              </h3>

              <div className="preference-toggles">
                <div className="pref-row">
                  <div>
                    <strong>{theme === 'dark' ? 'Tema Escuro (Dark Luxury)' : 'Tema Claro (Light Elegance)'}</strong>
                    <p>
                      {theme === 'dark'
                        ? 'Otimizado para conforto visual noturno e contraste estético refinado.'
                        : 'Visual limpo e sofisticado com alta legibilidade e contraste.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`btn btn-sm ${theme === 'light' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setTheme('light')}
                      title="Ativar Tema Claro"
                    >
                      <Sun size={14} />
                      <span>Claro</span>
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${theme === 'dark' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setTheme('dark')}
                      title="Ativar Tema Escuro"
                    >
                      <Moon size={14} />
                      <span>Escuro</span>
                    </button>
                  </div>
                </div>

                <div className="pref-row">
                  <div>
                    <strong>Como quer ser chamado</strong>
                    <p>Nome usado nas saudações e no menu. Sem apelido, usamos o primeiro nome.</p>
                  </div>
                  <input
                    className="form-input form-input-sm"
                    style={{ maxWidth: '200px' }}
                    defaultValue={viewPreferences.nickname || ''}
                    placeholder={(user?.name || '').split(' ')[0] || 'Seu apelido'}
                    aria-label="Como quer ser chamado"
                    onBlur={(e) => {
                      if (e.target.value.trim() !== (viewPreferences.nickname || '')) {
                        setViewPreferences({ nickname: e.target.value.trim() });
                      }
                    }}
                  />
                </div>

                <div className="pref-row">
                  <div>
                    <strong>Tela inicial</strong>
                    <p>O que abre quando você entra no Balder. O símbolo do Balder no topo sempre leva ao Início.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(
                      [
                        ['INICIO', 'Início'],
                        ['PAINEL', 'Painel'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={`btn btn-sm ${(viewPreferences.homeScreen || (activeCheckpoint ? 'PAINEL' : 'INICIO')) === id ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setViewPreferences({ homeScreen: id })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pref-row">
                  <div>
                    <strong>Modo de uso</strong>
                    <p>
                      {viewPreferences.experienceMode === 'GUIADO'
                        ? 'Guiado: a Forseti conduz, sugere e te lembra do que fazer.'
                        : 'Manual: você configura e acompanha tudo do seu jeito.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(
                      [
                        ['GUIADO', 'Guiado'],
                        ['MANUAL', 'Manual'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={`btn btn-sm ${(viewPreferences.experienceMode || 'MANUAL') === id ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setViewPreferences({ experienceMode: id })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pref-row">
                  <div>
                    <strong>Acompanhamento</strong>
                    <p>Período dos resumos de gastos e das tarefas no Início.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(
                      [
                        ['SEMANA', 'Semanal'],
                        ['QUINZENA', 'Quinzenal'],
                        ['MES', 'Mensal'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={`btn btn-sm ${(viewPreferences.trackingPeriod || 'MES') === id ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setViewPreferences({ trackingPeriod: id })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
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
              <h3 className="label-with-info">
                Exportações de Dados
                <InfoButton title="Exportações de Dados">
                  <p>Exporte suas movimentações e projeções para análise em Excel (.xlsx) ou CSV</p>
                </InfoButton>
              </h3>

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
              <h3 className="label-with-info">
                Segurança & Privacidade
                <InfoButton title="Segurança & Privacidade">
                  <p>Seus dados financeiros permanecem sob custódia criptografada</p>
                </InfoButton>
              </h3>

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

          {activeSubTab === 'FORMATAR' && <DataFormatPanel />}
        </div>
      </div>

      {/* Modal de Ferramentas Avançadas */}
      <Modal
        isOpen={advancedModalOpen}
        onClose={() => setAdvancedModalOpen(false)}
        title="Ferramentas Avançadas"
        subtitle="Workspaces, Painéis Administrativos e Centros Analíticos"
        maxWidth="600px"
      >
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
          <button type="button" className="btn btn-outline" onClick={() => setAdvancedModalOpen(false)}>
            Fechar
          </button>
        </div>
      </Modal>

      {/* Modal Unificado para Cadastro e Edição de Entidades Financeiras */}
      <FinanceEntityModal
        isOpen={entityModalOpen}
        onClose={() => setEntityModalOpen(false)}
        initialTab={entityModalTab}
        editItem={entityEditItem}
      />

      {/* Modal para Cadastro de Salários e Registro de Reajustes com Vigência */}
      

      {/* Modal para Marco de Acompanhamento Financeiro */}
      <CheckpointSetupModal
        isOpen={checkpointModalOpen}
        onClose={() => setCheckpointModalOpen(false)}
        isInitialSetup={!activeCheckpoint}
        mode={checkpointModalMode}
        checkpointToEdit={checkpointModalMode === 'EDIT' ? activeCheckpoint : null}
      />

      {/* Pop-up Modal de Detalhamento Completo do Marco Selecionado */}
      {selectedCheckpointDetails && (
        <Modal
          isOpen={!!selectedCheckpointDetails}
          onClose={() => setSelectedCheckpointDetails(null)}
          title={selectedCheckpointDetails.label || 'Marco de Acompanhamento'}
          subtitle={`Planejamento com ponto de partida em ${selectedCheckpointDetails.startDate.split('-').reverse().join('/')}`}
          maxWidth="680px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Status e Tempo de Acompanhamento */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: selectedCheckpointDetails.isActive
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'rgba(255, 255, 255, 0.04)',
                border: selectedCheckpointDetails.isActive
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    background: selectedCheckpointDetails.isActive
                      ? 'rgba(16, 185, 129, 0.25)'
                      : selectedCheckpointDetails.type === 'SIMULATION'
                      ? 'rgba(168, 85, 247, 0.2)'
                      : 'rgba(255, 255, 255, 0.1)',
                    color: selectedCheckpointDetails.isActive
                      ? '#34D399'
                      : selectedCheckpointDetails.type === 'SIMULATION'
                      ? '#C084FC'
                      : 'var(--text-secondary)',
                    border: selectedCheckpointDetails.isActive
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {selectedCheckpointDetails.isActive
                    ? '● Marco Ativo Vigente'
                    : selectedCheckpointDetails.type === 'SIMULATION'
                    ? '🔮 Simulação de Cenário'
                    : selectedCheckpointDetails.isArchived
                    ? '📁 Cenário Arquivado'
                    : '📋 Planejamento Alternativo'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <CalendarDays size={14} style={{ color: '#818CF8' }} />
                <span>
                  Tempo: <strong>{(() => {
                    const start = new Date(selectedCheckpointDetails.startDate).getTime();
                    const now = new Date().getTime();
                    const diffDays = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
                    return `${diffDays} ${diffDays === 1 ? 'dia decorrido' : 'dias decorridos'}`;
                  })()}</strong>
                </span>
              </div>
            </div>

            {/* Grid de Métricas Principais */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
                padding: '14px',
                borderRadius: '12px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                  Saldo Inicial em Caixa
                </span>
                <strong style={{ fontSize: '15px', color: '#34D399', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                  <Wallet size={15} />
                  {selectedCheckpointDetails.initialBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                  Dívida Total de Cartões
                </span>
                <strong style={{ fontSize: '15px', color: selectedCheckpointDetails.creditCardDebt && selectedCheckpointDetails.creditCardDebt > 0 ? '#F87171' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                  <CreditCard size={15} />
                  {selectedCheckpointDetails.creditCardDebt && selectedCheckpointDetails.creditCardDebt > 0
                    ? `- ${selectedCheckpointDetails.creditCardDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                    : 'R$ 0,00'}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                  Patrimônio Líquido Inicial
                </span>
                <strong style={{ fontSize: '15px', color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                  <TrendingUp size={15} />
                  {(selectedCheckpointDetails.initialNetWorth !== undefined
                    ? selectedCheckpointDetails.initialNetWorth
                    : selectedCheckpointDetails.initialBalance - (selectedCheckpointDetails.creditCardDebt || 0)
                  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </div>
            </div>

            {/* Detalhamento das Faturas por Banco */}
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Faturas & Dívidas por Banco
              </h4>

              {selectedCheckpointDetails.cardDebts && selectedCheckpointDetails.cardDebts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedCheckpointDetails.cardDebts.map((b: CheckpointBankDebt) => (
                    <div
                      key={b.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px' }}>💳</span>
                          <strong style={{ fontSize: '13px', color: '#fff' }}>{b.cardName || b.bankName}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            (Vencimento todo dia {b.dueDay || 10})
                          </span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#F87171' }}>
                          - {b.totalDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>

                      {/* Lista de Faturas deste Banco */}
                      {b.invoices && b.invoices.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(0, 0, 0, 0.25)', padding: '8px 10px', borderRadius: '8px' }}>
                          {b.invoices.map((inv: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              <span>
                                {inv.monthLabel || `Fatura ${idx + 1}`} • Venc. {inv.dueDate.split('-').reverse().join('/')}
                              </span>
                              <strong style={{ color: '#FCA5A5' }}>
                                {inv.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : selectedCheckpointDetails.creditCardDebt && selectedCheckpointDetails.creditCardDebt > 0 ? (
                <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)', fontSize: '12px', color: '#FCA5A5' }}>
                  Dívida consolidada de {selectedCheckpointDetails.creditCardDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  {selectedCheckpointDetails.cardName ? ` no cartão ${selectedCheckpointDetails.cardName}` : ''}
                  {selectedCheckpointDetails.cardInstallments && selectedCheckpointDetails.cardInstallments > 1
                    ? ` parcelada em ${selectedCheckpointDetails.cardInstallments}x`
                    : ''}
                </div>
              ) : (
                <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px dashed rgba(255, 255, 255, 0.08)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Nenhuma dívida de cartão associada a este marco.
                </div>
              )}
            </div>

            {/* Observações */}
            {selectedCheckpointDetails.notes && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Observações
                </span>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  "{selectedCheckpointDetails.notes}"
                </p>
              </div>
            )}

            {/* Ações no Rodapé do Pop-up */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', flexWrap: 'wrap' }}>
              <div>
                {!selectedCheckpointDetails.isActive && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                    onClick={() => {
                      activateCheckpoint(selectedCheckpointDetails.id);
                      setSelectedCheckpointDetails(null);
                    }}
                  >
                    <Zap size={14} />
                    <span>Ativar este Planejamento</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    duplicateCheckpointAsSimulation(selectedCheckpointDetails.id);
                    setSelectedCheckpointDetails(null);
                  }}
                >
                  <Copy size={14} />
                  <span>Duplicar Simulação</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    setCheckpointModalMode('EDIT');
                    setCheckpointModalOpen(true);
                    setSelectedCheckpointDetails(null);
                  }}
                >
                  <Edit2 size={14} />
                  <span>Recalibrar</span>
                </button>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedCheckpointDetails(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

