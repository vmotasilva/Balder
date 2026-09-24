import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { useTheme } from '../context/ThemeContext';
import { auditOnboardingProgress } from '../utils/onboardingProgress';
import {
  User,
  Building,
  CreditCard,
  Tag,
  Sliders,
  FileSpreadsheet,
  ShieldCheck,
  Smartphone,
  Download,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  Plus,
  Trash2,
  AlertTriangle,
  Calculator,
  Info,
  FileText,
  Check,
  Sun,
  Moon,
  Wallet,
  Landmark,
  Edit2,
  Briefcase,
  TrendingUp,
  Calendar,
  Flag,
  CalendarDays,
  History,
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
} from 'lucide-react';
import { FinanceEntityModal, type EntityTab } from '../components/FinanceEntityModal';
import { SalaryAdjustmentModal, type SalaryModalMode } from '../components/SalaryAdjustmentModal';
import { CheckpointSetupModal } from '../components/CheckpointSetupModal';
import { Modal } from '../components/Modal';
import { NatureModal } from '../components/NatureModal';
import { MappingModal } from '../components/MappingModal';
import {
  WEEKDAY_OPTIONS,
  formatItemScheduleBadge,
} from '../utils/natureScheduling';
import type { SalaryContract, SalaryAdjustment, FixedExpenseMapping } from '../types';

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
    deleteNature,
    deleteMapping,
    addItemToMapping,
    deleteMappingItem,
    toggleItemFulfilled,
    saveCeilingJustification,
    loadSuggestedMappingsForNature,
    getNatureCeiling,
    getNatureSpent,
    getNatureMissingItems,
    salaryContracts,
    deleteSalaryContract,
    deleteSalaryAdjustment,
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
  } = useFinancial();
  const { theme, setTheme } = useTheme();

  // Auditoria dinâmica dos 5 pilares do Get Started
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

  const [activeSubTab, setActiveSubTab] = useState<
    'PERFIL' | 'ASSINATURA' | 'APP_ANDROID' | 'SALARIO' | 'MARCOS' | 'CONTAS' | 'BANCOS' | 'CATEGORIAS' | 'PREFERENCIAS' | 'EXPORTACOES' | 'SEGURANCA'
  >('PERFIL');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [subscriptionSuccessMsg, setSubscriptionSuccessMsg] = useState<string | null>(null);
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false);
  const [checkpointModalOpen, setCheckpointModalOpen] = useState(false);

  // Estados para Gestão & Arquivamento de Marcos e Simulações
  const [checkpointTabFilter, setCheckpointTabFilter] = useState<'ACTIVE_AND_SIMS' | 'ARCHIVED' | 'ALL'>('ACTIVE_AND_SIMS');
  const [editingCheckpointId, setEditingCheckpointId] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState<string>('');

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

  // Estados de Modal para Salários e Reajustes
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [salaryModalMode, setSalaryModalMode] = useState<SalaryModalMode>('ADJUSTMENT');
  const [salaryEditContract, setSalaryEditContract] = useState<SalaryContract | null>(null);
  const [salaryEditAdjustment, setSalaryEditAdjustment] = useState<{
    contractId: string;
    adjustment: SalaryAdjustment;
  } | null>(null);
  const [selectedContractIdForView, setSelectedContractIdForView] = useState<string>('');

  const handleOpenSalaryModal = (
    mode: SalaryModalMode,
    contractToEdit: SalaryContract | null = null,
    adjToEdit: { contractId: string; adjustment: SalaryAdjustment } | null = null
  ) => {
    setSalaryModalMode(mode);
    setSalaryEditContract(contractToEdit);
    setSalaryEditAdjustment(adjToEdit);
    setSalaryModalOpen(true);
  };

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

  // Estados locais para Naturezas & Mapeamentos
  const [selectedNatureId, setSelectedNatureId] = useState<string>(natures[0]?.id || 'nat_alimentacao');
  const [justificationText, setJustificationText] = useState('');
  const [isDiagnosticExpanded, setIsDiagnosticExpanded] = useState(false);
  const [isOverCeilingExpanded, setIsOverCeilingExpanded] = useState(false);

  useEffect(() => {
    setIsDiagnosticExpanded(false);
    setIsOverCeilingExpanded(false);
  }, [selectedNatureId]);

  // Formulário Inline de Itens por Mapeamento
  const [newItemDesc, setNewItemDesc] = useState<Record<string, string>>({});
  const [newItemQty, setNewItemQty] = useState<Record<string, number | string>>({});
  const [newItemPrice, setNewItemPrice] = useState<Record<string, number | string>>({});
  const [newItemMult, setNewItemMult] = useState<Record<string, number>>({});
  const [newItemRecurrenceType, setNewItemRecurrenceType] = useState<Record<string, 'SEMANAL' | 'QUINZENAL' | 'MENSAL'>>({});
  const [newItemDayOfWeek, setNewItemDayOfWeek] = useState<Record<string, 'DOMINGO' | 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA' | 'SABADO'>>({});
  const [newItemDayOfFortnight, setNewItemDayOfFortnight] = useState<Record<string, number>>({});
  const [newItemDayOfMonth, setNewItemDayOfMonth] = useState<Record<string, number>>({});

  // Modais de Criação e Edição de Natureza
  const [isNatureModalOpen, setIsNatureModalOpen] = useState(false);
  const [natureToEdit, setNatureToEdit] = useState<any | null>(null);

  const handleOpenCreateNature = () => {
    setNatureToEdit(null);
    setIsNatureModalOpen(true);
  };

  const handleOpenEditNature = (nat?: any | null) => {
    setNatureToEdit(nat || selectedNature || null);
    setIsNatureModalOpen(true);
  };

  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [mappingToEdit, setMappingToEdit] = useState<FixedExpenseMapping | null>(null);

  const handleOpenCreateMapping = () => {
    setMappingToEdit(null);
    setIsMappingModalOpen(true);
  };

  const handleOpenEditMapping = (mapping: FixedExpenseMapping) => {
    setMappingToEdit(mapping);
    setIsMappingModalOpen(true);
  };

  // Dados calculados da Natureza Ativa
  const selectedNature = natures.find((n) => n.id === selectedNatureId) || natures[0];
  const natureCeiling = selectedNature ? getNatureCeiling(selectedNature) : 0;
  const natureSpent = selectedNature ? getNatureSpent(selectedNature) : 0;
  const ceilingPercentUsed = natureCeiling > 0 ? Math.round((natureSpent / natureCeiling) * 100) : 0;
  const isCeilingOver = natureCeiling > 0 && natureSpent > natureCeiling;
  const isCeilingFar = natureCeiling > 0 && !isCeilingOver && natureSpent < natureCeiling * 0.75;
  const missingItems = selectedNature ? getNatureMissingItems(selectedNature) : [];

  // Cálculos e helpers para Remuneração e Salários
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const activeContract =
    salaryContracts.find((c) => c.id === selectedContractIdForView) ||
    salaryContracts.find((c) => c.isActive) ||
    salaryContracts[0];

  const sortedHistory = activeContract
    ? [...activeContract.history].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
    : [];
  const oldestAdjustment = activeContract && activeContract.history.length > 0
    ? [...activeContract.history].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))[0]
    : null;
  const initialNet = oldestAdjustment ? oldestAdjustment.netAmount : (activeContract?.currentNetAmount || 0);
  const currentNet = activeContract?.currentNetAmount || 0;
  const totalGrowthPercent = initialNet > 0 && currentNet > 0
    ? Number((((currentNet - initialNet) / initialNet) * 100).toFixed(2))
    : 0;
  const lastAdjustment = sortedHistory.length > 0 ? sortedHistory[0] : null;
  const annualNetProjected = currentNet * (activeContract?.contractType === 'CLT' ? 13.33 : 12);

  const formatMonthYearLabel = (ym: string) => {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const mIndex = parseInt(m, 10) - 1;
    return `${months[mIndex] || m}/${y}`;
  };

  const formatMonthYearFull = (ym: string) => {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const mIndex = parseInt(m, 10) - 1;
    return `${months[mIndex] || m} de ${y}`;
  };

  // Itens de navegação do perfil correspondentes ao card principal (Imagem 2)
  const PROFILE_NAV_ITEMS = [
    { id: 'PERFIL' as const, label: 'Perfil & Dados Pessoais', icon: User, count: null },
    { id: 'ASSINATURA' as const, label: 'Plano & Assinatura', icon: Crown, count: 'PRO' },
    { id: 'APP_ANDROID' as const, label: 'Aplicativo Android (APK)', icon: Smartphone, count: 'v1.0' },
    { id: 'SALARIO' as const, label: 'Remuneração & Salário', icon: Briefcase, count: salaryContracts.length },
    { id: 'MARCOS' as const, label: 'Marcos de Início', icon: Flag, count: checkpoints.length },
    { id: 'CONTAS' as const, label: 'Contas & Meios', icon: CreditCard, count: accounts.length + cards.length },
    { id: 'BANCOS' as const, label: 'Bancos & Instituições', icon: Building, count: banks.length },
    { id: 'CATEGORIAS' as const, label: 'Naturezas & Categorias', icon: Tag, count: null },
    { id: 'PREFERENCIAS' as const, label: 'Preferências de Exibição', icon: Sliders, count: null },
    { id: 'EXPORTACOES' as const, label: 'Exportações (Excel & CSV)', icon: FileSpreadsheet, count: null },
    { id: 'SEGURANCA' as const, label: 'Segurança & Criptografia', icon: ShieldCheck, count: null },
  ];

  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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
          <h1 className="page-title">Meu Perfil</h1>
          <p className="page-subtitle">Gerencie suas contas, conexões bancárias, preferências e exportações analíticas</p>
        </div>
      </div>

      {/* Profile Layout with Nav Tabs */}
      <div className="profile-layout-grid">
        {/* Left Side Menu / Mobile Header Card */}
        <div className="profile-nav-card glass-card">
          <div className="profile-user-summary">
            <div className="profile-avatar-large">
              <span>VM</span>
            </div>
            <div className="profile-user-text">
              <h3>Vinicius Mota</h3>
              <span className="profile-user-email">vinicius@balder.internal</span>
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
                    onOpenOnboarding(onboardingAudit.nextSuggestedStep?.stepIndex || 1);
                  }
                }}
                title="Acessar o Onboarding Get Started e Calibrar o Balder"
              >
                <div className="profile-gs-top">
                  <div className="profile-gs-badge-tag">
                    <Sparkles size={13} className="text-amber-400" />
                    <span className="profile-gs-title">Get Started</span>
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

            {mobileDropdownOpen && (
              <div className="profile-dropdown-menu animate-fade-in">
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
              </div>
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
                  <h3>Assinatura & Recursos Premium</h3>
                  <p className="subtab-desc">
                    Gerencie seu plano Balder, ciclo de cobrança, faturas e métodos de pagamento.
                  </p>
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

          {activeSubTab === 'APP_ANDROID' && (
            <div className="subtab-content animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3>Aplicativo Android</h3>
                    <span className="badge-pill badge-pill-emerald">APK Nativo</span>
                    <span className="badge-pill" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>v1.0.0</span>
                    <span className="badge-pill" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>~33 MB</span>
                  </div>
                  <p className="subtab-desc">Instalação oficial e direta do Balder no seu smartphone Android sem intermediários</p>
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
            </div>
          )}

          {activeSubTab === 'MARCOS' && (
            <div className="subtab-content animate-fade-in space-y-6">
              <div className="naturezas-header-row mb-4">
                <div>
                  <div className="kicker-badge" style={{ marginBottom: '0.25rem' }}>
                    <span>PONTO DE PARTIDA & REINÍCIO</span>
                  </div>
                  <h3>Marcos de Acompanhamento Financeiro</h3>
                  <p className="subtab-desc">
                    Defina a partir de qual data e saldo inicial o Balder contabiliza suas métricas. Se você se desorganizar ou quiser recomeçar, crie um novo marco a qualquer momento sem perder transações passadas.
                  </p>
                </div>
                <button
                  className="btn btn-primary btn-sm flex items-center gap-2"
                  onClick={() => setCheckpointModalOpen(true)}
                >
                  <Plus size={16} />
                  <span>{activeCheckpoint ? 'Iniciar Novo Acompanhamento' : 'Definir Marco Inicial'}</span>
                </button>
              </div>

              {/* Marco Vigente */}
              {activeCheckpoint ? (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/50 via-slate-900/60 to-slate-900/40 border border-indigo-500/30 shadow-xl relative overflow-hidden">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30 shadow-inner">
                        <Flag size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-bold text-white">
                            {activeCheckpoint.label || 'Marco de Acompanhamento'}
                          </h4>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            MARCO ATIVO
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Criado em {new Date(activeCheckpoint.createdAt).toLocaleDateString('pt-BR')} às {new Date(activeCheckpoint.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setCheckpointModalOpen(true)}
                      className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs"
                    >
                      <RotateCcw size={14} />
                      <span>Recomeçar Novo Ponto</span>
                    </button>
                  </div>

                  <div className={`grid grid-cols-1 sm:grid-cols-2 ${activeCheckpoint.creditCardDebt && activeCheckpoint.creditCardDebt > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 mt-5 pt-4 border-t border-slate-800/80`}>
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                        Data de Início
                      </span>
                      <span className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                        <Calendar size={15} className="text-indigo-400" />
                        {activeCheckpoint.startDate.split('-').reverse().join('/')}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                        Saldo Inicial em Caixa
                      </span>
                      <span className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                        <Wallet size={15} className="text-emerald-400" />
                        {activeCheckpoint.initialBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>

                    {activeCheckpoint.creditCardDebt && activeCheckpoint.creditCardDebt > 0 && (
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                          Faturas / Dívida de Cartão
                        </span>
                        <span className="text-sm font-bold text-rose-400 flex items-center gap-1.5 flex-wrap">
                          <CreditCard size={15} className="text-rose-400" />
                          {activeCheckpoint.creditCardDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          {activeCheckpoint.cardInstallments && activeCheckpoint.cardInstallments > 1 && !activeCheckpoint.cardDebts && (
                            <span className="badge badge-amber text-[10px]" style={{ padding: '1px 5px' }}>
                              {activeCheckpoint.cardInstallments}x de {(activeCheckpoint.creditCardDebt / activeCheckpoint.cardInstallments).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          )}
                        </span>
                        {activeCheckpoint.cardDebts && activeCheckpoint.cardDebts.length > 0 ? (
                          <div className="flex flex-col gap-1 mt-2 pt-1.5 border-t border-slate-800/60">
                            {activeCheckpoint.cardDebts.map((b) => (
                              <div key={b.id} className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-300 truncate max-w-[130px]" title={b.cardName}>
                                  💳 {b.cardName}:
                                </span>
                                <span className="text-rose-400 font-mono font-medium">
                                  {b.totalDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  <span className="text-slate-500 text-[9.5px] ml-1 font-normal">
                                    ({b.invoices.length} fat.)
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : activeCheckpoint.cardName ? (
                          <span className="text-[10.5px] text-slate-400 block mt-0.5 truncate" title={activeCheckpoint.cardName}>
                            {activeCheckpoint.cardName} {activeCheckpoint.cardDueDate ? `(${activeCheckpoint.cardDueDate.split('-').reverse().join('/')})` : ''}
                          </span>
                        ) : null}
                      </div>
                    )}

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                        Tempo de Acompanhamento
                      </span>
                      <span className="text-sm font-bold text-cyan-300 flex items-center gap-1.5">
                        <CalendarDays size={15} className="text-cyan-400" />
                        {(() => {
                          const start = new Date(activeCheckpoint.startDate).getTime();
                          const now = new Date().getTime();
                          const diffDays = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
                          return `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-700 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <Flag size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-white">Nenhum marco de início configurado</h4>
                  <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                    Definir um marco permite ao Balder saber exatamente em que momento começar a contar suas métricas, além do saldo base que você tinha em mãos no início.
                  </p>
                  <button
                    onClick={() => setCheckpointModalOpen(true)}
                    className="btn btn-primary btn-sm mt-2 flex items-center gap-2"
                  >
                    <Plus size={14} />
                    <span>Configurar Marco de Início</span>
                  </button>
                </div>
              )}

              {/* Histórico de Marcos Anteriores */}
              {checkpoints.length > 1 && (
                <div className="mt-8">
                  <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
                    <History size={16} className="text-slate-400" />
                    Histórico de Pontos de Partida ({checkpoints.length})
                  </h4>
                  <div className="space-y-2.5">
                    {checkpoints
                      .slice()
                      .reverse()
                      .map((cp) => (
                        <div
                          key={cp.id}
                          className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                            cp.isActive
                              ? 'bg-indigo-950/20 border-indigo-500/40'
                              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              cp.isActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'
                            }`}>
                              <Flag size={16} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">
                                  {cp.label || `Marco de ${cp.startDate}`}
                                </span>
                                {cp.isActive && (
                                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300">
                                    ATUAL
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400">
                                Início: {cp.startDate.split('-').reverse().join('/')} • Saldo Base: {cp.initialBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </div>
                          </div>

                          {!cp.isActive && (
                            <button
                              onClick={() => activateCheckpoint(cp.id)}
                              className="btn btn-outline btn-sm text-[11px] py-1 px-3"
                            >
                              Reativar
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'SALARIO' && (
            <div className="subtab-content animate-fade-in">
              {/* Header com Ações */}
              <div className="naturezas-header-row mb-4">
                <div>
                  <div className="kicker-badge" style={{ marginBottom: '0.25rem' }}>
                    <span>FONTES DE RENDA & PROJEÇÃO</span>
                  </div>
                  <h3>Remuneração & Evolução Salarial</h3>
                  <p className="subtab-desc">
                    Cadastre seus vínculos empregatícios, acompanhe o histórico de reajustes e garanta que competências futuras considerem novos valores.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleOpenSalaryModal('ADJUSTMENT')}
                    title="Registrar novo reajuste ou promoção salarial"
                  >
                    <TrendingUp size={15} />
                    <span>+ Novo Reajuste</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenSalaryModal('CONTRACT')}
                    title="Cadastrar novo contrato ou fonte de renda"
                  >
                    <Briefcase size={15} />
                    <span>+ Novo Contrato</span>
                  </button>
                </div>
              </div>

              {/* Seletor de Contratos se houver mais de um */}
              {salaryContracts.length > 1 && (
                <div className="entity-filters-bar mb-4">
                  {salaryContracts.map((c) => (
                    <button
                      key={c.id}
                      className={`entity-filter-chip ${activeContract?.id === c.id ? 'active' : ''}`}
                      onClick={() => setSelectedContractIdForView(c.id)}
                    >
                      <Briefcase size={13} />
                      <span>
                        {c.employer} — {c.role} ({c.contractType})
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Estado Vazio caso o usuário ainda não tenha cadastrado contratos */}
              {salaryContracts.length === 0 ? (
                <div className="glass-card text-center p-8 mt-4" style={{ borderRadius: '12px' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: 'rgba(6, 182, 212, 0.1)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1rem auto',
                    }}
                  >
                    <Briefcase size={28} />
                  </div>
                  <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Nenhum Vínculo Salarial Cadastrado</h4>
                  <p className="text-muted text-sm max-w-md mx-auto mb-4">
                    Cadastre seu salário e contrato de trabalho para acompanhar o histórico de ganhos, dissídios, méritos e alimentar automaticamente as projeções do fluxo de caixa.
                  </p>
                  <button className="btn btn-primary" onClick={() => handleOpenSalaryModal('CONTRACT')}>
                    <Briefcase size={16} />
                    <span>Cadastrar Primeiro Contrato Salarial</span>
                  </button>
                </div>
              ) : activeContract ? (
                <>
                  {/* Grid de 4 KPIs Estratégicos de Salário */}
                  <div className="salary-kpi-grid mb-4">
                    <div className="salary-kpi-card glass-card">
                      <div className="salary-kpi-header">
                        <span className="salary-kpi-title">Salário Líquido Atual</span>
                        <span className="badge badge-emerald">{activeContract.contractType}</span>
                      </div>
                      <div className="salary-kpi-val text-glow-cyan">
                        R$ {activeContract.currentNetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="salary-kpi-subtitle">
                        Bruto: R$ {activeContract.currentGrossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • {activeContract.role}
                      </div>
                    </div>

                    <div className="salary-kpi-card glass-card">
                      <div className="salary-kpi-header">
                        <span className="salary-kpi-title">Último Reajuste Registrado</span>
                        {lastAdjustment?.percentageIncrease !== undefined && (
                          <span className="badge badge-emerald">+{lastAdjustment.percentageIncrease}%</span>
                        )}
                      </div>
                      <div className="salary-kpi-val" style={{ color: 'var(--color-emerald, #10b981)' }}>
                        {lastAdjustment?.title || lastAdjustment?.reason || 'Admissão'}
                      </div>
                      <div className="salary-kpi-subtitle">
                        {lastAdjustment ? `Vigência a partir de ${formatMonthYearLabel(lastAdjustment.effectiveDate)}` : 'Sem reajustes adicionais'}
                      </div>
                    </div>

                    <div className="salary-kpi-card glass-card">
                      <div className="salary-kpi-header">
                        <span className="salary-kpi-title">Evolução Acumulada</span>
                        <span className="badge badge-cyan">TOTAL</span>
                      </div>
                      <div className="salary-kpi-val text-cyan">
                        {totalGrowthPercent > 0 ? `+${totalGrowthPercent}%` : 'Base Inicial'}
                      </div>
                      <div className="salary-kpi-subtitle">
                        De R$ {initialNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para R$ {currentNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="salary-kpi-card glass-card">
                      <div className="salary-kpi-header">
                        <span className="salary-kpi-title">Renda Anual Projetada</span>
                        <span className="badge badge-purple">{activeContract.contractType === 'CLT' ? '13,33x' : '12x'}</span>
                      </div>
                      <div className="salary-kpi-val" style={{ color: '#C084FC' }}>
                        R$ {annualNetProjected.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="salary-kpi-subtitle">
                        {activeContract.contractType === 'CLT' ? 'Líquido anual (12 salários + 13º + 1/3 férias)' : 'Líquido anual contratual'}
                      </div>
                    </div>
                  </div>

                  {/* Card do Vínculo Empregatício */}
                  <div className="salary-contract-details-card glass-card mb-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="salary-contract-avatar">
                          <Briefcase size={22} />
                        </div>
                        <div>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{activeContract.employer}</h4>
                          <span className="text-xs text-muted">
                            {activeContract.role} • Admissão: {formatMonthYearLabel(activeContract.startDate)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenSalaryModal('CONTRACT', activeContract)}
                        >
                          <Edit2 size={13} />
                          <span>Editar Contrato</span>
                        </button>
                        <button
                          className="btn btn-secondary btn-sm text-rose"
                          onClick={() => {
                            if (confirm(`Deseja realmente remover o contrato com ${activeContract.employer}?`)) {
                              deleteSalaryContract(activeContract.id);
                            }
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="salary-contract-grid-info">
                      <div className="info-cell">
                        <span className="info-cell-label">Regime & Formato</span>
                        <span className="info-cell-val font-semibold flex items-center gap-1.5 flex-wrap">
                          <span>{activeContract.contractType} • {activeContract.paymentSchedule === 'QUINZENAL' || activeContract.secondPaymentDay ? 'Em 2 Quinzenas' : 'Mensal Integral'}</span>
                          {activeContract.payInFollowingMonth && (
                            <span className="badge badge-cyan text-[10px]" title="Pagamento referente à competência é creditado no mês seguinte (M+1)">
                              Mês Seguinte (M+1)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="info-cell">
                        <span className="info-cell-label">
                          {activeContract.paymentSchedule === 'QUINZENAL' || activeContract.secondPaymentDay ? '1ª Quinzena (Adiantamento)' : 'Dia de Pagamento'}
                        </span>
                        <span className="info-cell-val font-semibold">
                          {activeContract.paymentSchedule === 'QUINZENAL' || activeContract.secondPaymentDay ? (() => {
                            const first = activeContract.firstInstallmentAmount || Math.round(activeContract.currentNetAmount * ((activeContract.firstInstallmentPercent || 40) / 100) * 100) / 100;
                            return (
                              <>
                                Dia {activeContract.secondPaymentDay || 15}
                                {first > 0 && (
                                  <span className="text-glow-cyan" style={{ marginLeft: '6px' }}>
                                    (R$ {first.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                                  </span>
                                )}
                              </>
                            );
                          })() : (
                            activeContract.paymentDay === 31 ? 'Último dia do mês' : `Dia ${activeContract.paymentDay}`
                          )}
                        </span>
                      </div>
                      <div className="info-cell">
                        <span className="info-cell-label">
                          {activeContract.paymentSchedule === 'QUINZENAL' || activeContract.secondPaymentDay ? '2ª Quinzena (Saldo)' : 'Banco de Recebimento'}
                        </span>
                        <span className="info-cell-val font-semibold">
                          {activeContract.paymentSchedule === 'QUINZENAL' || activeContract.secondPaymentDay ? (() => {
                            const first = activeContract.firstInstallmentAmount || Math.round(activeContract.currentNetAmount * ((activeContract.firstInstallmentPercent || 40) / 100) * 100) / 100;
                            const second = activeContract.secondInstallmentAmount || Math.round((activeContract.currentNetAmount - first) * 100) / 100;
                            return (
                              <>
                                {activeContract.paymentDay === 31 ? 'Último dia do mês' : `Dia ${activeContract.paymentDay || 1}`}
                                {second > 0 && (
                                  <span className="text-glow-cyan" style={{ marginLeft: '6px' }}>
                                    (R$ {second.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                                  </span>
                                )}
                              </>
                            );
                          })() : (
                            activeContract.receivingBankName || 'Conta Padrão'
                          )}
                        </span>
                      </div>
                      <div className="info-cell">
                        <span className="info-cell-label">Banco / Status</span>
                        <span className="info-cell-val font-semibold flex items-center gap-2">
                          <span>{activeContract.receivingBankName || 'Conta Padrão'}</span>
                          <span className="badge badge-emerald">
                            {activeContract.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Linha do Tempo / Histórico de Reajustes */}
                  <div className="salary-timeline-container glass-card">
                    <div className="salary-timeline-header flex items-center justify-between flex-wrap gap-2 mb-4">
                      <div>
                        <h4 className="flex items-center gap-2" style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                          <TrendingUp size={18} className="text-emerald" />
                          <span>Histórico Cronológico de Reajustes & Vigência</span>
                        </h4>
                        <p className="text-xs text-muted">
                          Competências a partir da data de vigência utilizam o novo salário líquido nas projeções futuras.
                        </p>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleOpenSalaryModal('ADJUSTMENT')}
                      >
                        <Plus size={14} />
                        <span>Novo Reajuste Salarial</span>
                      </button>
                    </div>

                    {sortedHistory.length === 0 ? (
                      <div className="text-center p-6 text-muted text-sm">
                        Nenhum marco de reajuste cadastrado. Clique no botão acima para registrar o primeiro reajuste.
                      </div>
                    ) : (
                      <div className="salary-timeline-list">
                        {sortedHistory.map((adj, index) => {
                          const isFuture = adj.effectiveDate > currentMonthKey;
                          const isLatest = index === 0;

                          return (
                            <div key={adj.id} className="salary-timeline-item">
                              <div className="salary-timeline-marker">
                                <div className={`salary-timeline-dot ${isLatest ? 'latest' : ''}`} />
                                {index < sortedHistory.length - 1 && <div className="salary-timeline-line" />}
                              </div>

                              <div className="salary-timeline-card glass-card">
                                <div className="salary-timeline-card-header flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="salary-timeline-date-badge">
                                      <Calendar size={13} />
                                      {formatMonthYearFull(adj.effectiveDate)}
                                    </span>
                                    {isFuture ? (
                                      <span className="badge badge-purple">Projetado (Futuro)</span>
                                    ) : (
                                      <span className="badge badge-emerald">Vigente</span>
                                    )}
                                    <span className="badge badge-cyan">{adj.reason.replace('_', ' ')}</span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      className="btn btn-ghost btn-xs"
                                      title="Editar Reajuste"
                                      onClick={() =>
                                        handleOpenSalaryModal('ADJUSTMENT', null, {
                                          contractId: activeContract.id,
                                          adjustment: adj,
                                        })
                                      }
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      className="btn btn-ghost btn-xs text-rose"
                                      title="Excluir Reajuste"
                                      onClick={() => {
                                        if (confirm(`Deseja remover este marco de reajuste de ${adj.effectiveDate}?`)) {
                                          deleteSalaryAdjustment(activeContract.id, adj.id);
                                        }
                                      }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>

                                <div className="salary-timeline-card-body mt-2">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div>
                                      <div className="font-semibold" style={{ fontSize: '0.95rem' }}>
                                        {adj.title || adj.reason}
                                      </div>
                                      {adj.notes && (
                                        <div className="text-xs text-muted mt-1">{adj.notes}</div>
                                      )}
                                    </div>

                                    <div className="text-right">
                                      <div className="flex items-center gap-2 justify-end">
                                        <span className="text-lg font-bold text-glow-cyan">
                                          R$ {adj.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                        {adj.percentageIncrease !== undefined && (
                                          <span className="badge badge-emerald font-bold">
                                            +{adj.percentageIncrease}%
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted">
                                        Bruto: R$ {adj.grossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
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
                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      Marcos de Planejamento & Cenários Financeiros
                    </h3>
                  </div>
                  <p className="subtab-desc" style={{ maxWidth: '680px', margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    O <strong>Marco Ativo</strong> é o planejamento vigente que ancora o saldo real em caixa, a régua de acompanhamento e o cálculo das metas. Você pode criar novos cenários, simulações alternativas e arquivar marcos antigos.
                  </p>
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
                        if (
                          window.confirm(
                            'ATENÇÃO: Deseja realmente ZERAR todos os marcos de ponto de partida existentes?\n\nIsso apagará todos os planejamentos atuais e o Balder solicitará um novo ponto de partida para recalibrar o fluxo.'
                          )
                        ) {
                          clearAllCheckpoints();
                        }
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
                    onClick={() => setCheckpointModalOpen(true)}
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
                    onClick={() => setCheckpointModalOpen(true)}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                            onClick={() => setCheckpointModalOpen(true)}
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
                                <div>
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
                  <h3>Contas, Carteiras, Cartões & Meios de Pagamento</h3>
                  <p className="subtab-desc">
                    Gerencie seus saldos conciliados, limites de cartões e métodos de liquidação financeira.
                  </p>
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
                                    if (confirm(`Deseja realmente excluir o cartão "${c.name}"?`)) {
                                      deleteCard(c.id);
                                    }
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
                  <h3>Bancos & Instituições Financeiras</h3>
                  <p className="subtab-desc">
                    Instituições cadastradas e conexões protegidas via Open Finance Brasil
                  </p>
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

            {activeSubTab === 'CATEGORIAS' && (
            <div className="subtab-content naturezas-subtab animate-fade-in">
              <div className="naturezas-header-row">
                <div>
                  <h3>Naturezas & Mapeamento de Gastos Fixos</h3>
                  <p className="subtab-desc">
                    Cadastre suas naturezas orçamentárias e estruture mapeamentos matemáticos de gastos fixos para justificar cada Teto.
                  </p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleOpenCreateNature}>
                  <Plus size={16} />
                  <span>Nova Natureza</span>
                </button>
              </div>

              {/* Seletor de Naturezas em Abas/Pills com Resumo de Teto */}
              <div className="naturezas-tabs-nav">
                {natures.map((nat) => {
                  const ceil = getNatureCeiling(nat);
                  const spent = getNatureSpent(nat);
                  const isOver = ceil > 0 && spent > ceil;
                  const isFar = ceil > 0 && spent < ceil * 0.75;
                  const isSelected = selectedNature?.id === nat.id;

                  return (
                    <button
                      key={nat.id}
                      className={`natureza-tab-item ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedNatureId(nat.id)}
                      style={{ borderLeftColor: nat.color }}
                    >
                      <div className="natureza-tab-top">
                        <span className="natureza-tab-icon">{nat.icon}</span>
                        <strong className="natureza-tab-name">{nat.name}</strong>
                      </div>
                      <div className="natureza-tab-meta">
                        <span className="natureza-tab-ceiling">Teto: {ceil.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        {isOver ? (
                          <span className="badge badge-rose text-xs">TETO EXCEDIDO</span>
                        ) : isFar ? (
                          <span className="badge badge-cyan text-xs">LONGE DO TETO</span>
                        ) : (
                          <span className="badge badge-emerald text-xs">NO LIMITE</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedNature ? (
                <div className="natureza-selected-detail">
                  {/* Card Resumo do Teto Matemático da Natureza */}
                  <div className="natureza-kpi-banner glass-card">
                    <div className="natureza-info-left">
                      <div className="natureza-badge-title">
                        <div
                          className="natureza-large-icon-wrapper"
                          style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                          onClick={() => handleOpenEditNature(selectedNature)}
                          title="Clique para editar nome, emoji e cor da natureza"
                        >
                          <span
                            className="natureza-large-icon"
                            style={{
                              boxShadow: `0 0 16px ${selectedNature.color}33`,
                              borderColor: `${selectedNature.color}66`,
                            }}
                          >
                            {selectedNature.icon}
                          </span>
                          <span
                            style={{
                              position: 'absolute',
                              bottom: '-2px',
                              right: '-2px',
                              background: 'rgba(15, 23, 42, 0.95)',
                              border: '1px solid var(--border-default)',
                              borderRadius: '50%',
                              width: '20px',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#38BDF8',
                              boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                            }}
                          >
                            <Edit2 size={11} />
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="natureza-title-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h4 style={{ borderLeft: `3px solid ${selectedNature.color}`, paddingLeft: '8px', margin: 0 }}>
                              {selectedNature.name}
                            </h4>
                            <span
                              className={`badge ${
                                selectedNature.type === 'ESSENCIAL'
                                  ? 'badge-cyan'
                                  : selectedNature.type === 'FIXA'
                                  ? 'badge-amber'
                                  : 'badge-emerald'
                              }`}
                            >
                              {selectedNature.type}
                            </span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-xs text-cyan"
                                title="Editar Nome, Emoji e Cor desta Natureza"
                                onClick={() => handleOpenEditNature(selectedNature)}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Edit2 size={12} />
                                <span>Editar Natureza</span>
                              </button>

                              {natures.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs text-rose"
                                  title="Excluir esta Natureza"
                                  onClick={() => {
                                    if (confirm(`Deseja realmente excluir a natureza "${selectedNature.name}" e todos os seus mapeamentos?`)) {
                                      deleteNature(selectedNature.id);
                                      const next = natures.find((n) => n.id !== selectedNature.id);
                                      if (next) setSelectedNatureId(next.id);
                                    }
                                  }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Trash2 size={12} />
                                  <span>Excluir</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="natureza-desc-text">
                            {selectedNature.description || 'Mapeamentos matemáticos definem a fundamentação do teto de gastos desta natureza.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="natureza-kpis-grid">
                      <div className="nat-kpi-box">
                        <span className="nat-kpi-label">
                          <Calculator size={14} className="text-cyan" />
                          Teto Calculado
                        </span>
                        <strong className="nat-kpi-val text-cyan">
                          {natureCeiling.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                        <span className="nat-kpi-sub">Soma de {selectedNature.mappings.length} mapeamentos</span>
                      </div>

                      <div className="nat-kpi-box">
                        <span className="nat-kpi-label">
                          <CreditCard size={14} className="text-emerald" />
                          Gasto Real no Mês
                        </span>
                        <strong className={`nat-kpi-val ${isCeilingOver ? 'text-rose' : 'text-emerald'}`}>
                          {natureSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                        <span className="nat-kpi-sub">{ceilingPercentUsed}% do teto consumido</span>
                      </div>

                      <div className="nat-kpi-box">
                        <span className="nat-kpi-label">
                          {isCeilingOver ? <AlertTriangle size={14} className="text-rose" /> : <CheckCircle2 size={14} className="text-cyan" />}
                          Margem Orçamentária
                        </span>
                        <strong className={`nat-kpi-val ${isCeilingOver ? 'text-rose' : 'text-white'}`}>
                          {isCeilingOver ? `+${(natureSpent - natureCeiling).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : (natureCeiling - natureSpent).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                        <span className="nat-kpi-sub">{isCeilingOver ? 'Acima do Teto' : 'Disponível até o Teto'}</span>
                      </div>
                    </div>

                    {/* Barra de Progresso do Teto */}
                    <div className="natureza-progress-container mt-4">
                      <div className="natureza-progress-labels">
                        <span>Consumo do Teto Orçamentário</span>
                        <span>{ceilingPercentUsed}%</span>
                      </div>
                      <div className="natureza-progress-track">
                        <div
                          className={`natureza-progress-fill ${isCeilingOver ? 'bg-rose' : ceilingPercentUsed < 75 ? 'bg-cyan' : 'bg-amber'}`}
                          style={{ width: `${Math.min(ceilingPercentUsed, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* BLOCO INTELIGENTE 1: TETO ULTRAPASSADO -> JUSTIFICATIVA OU AJUSTE (RECOLHÍVEL) */}
                  {isCeilingOver && (
                    <div className="ceiling-alert-box alert-over-ceiling glass-card animate-fade-in mt-4">
                      <div
                        className="ceiling-alert-header cursor-pointer select-none"
                        onClick={() => setIsOverCeilingExpanded(!isOverCeilingExpanded)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <AlertTriangle size={22} className="text-rose flex-shrink-0" />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <h4 className="text-rose" style={{ margin: 0 }}>
                                Teto de Gastos Ultrapassado em{' '}
                                {(natureSpent - natureCeiling).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 3,
                                })}
                              </h4>
                              <span className="badge badge-rose text-xs">Excedido</span>
                            </div>
                            {!isOverCeilingExpanded && (
                              <p className="text-xs text-muted" style={{ margin: '3px 0 0' }}>
                                Clique para registrar justificativa contábil ou consultar o histórico de desvios.
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-rose"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsOverCeilingExpanded(!isOverCeilingExpanded);
                          }}
                        >
                          <span>{isOverCeilingExpanded ? 'Recolher' : 'Expandir'}</span>
                          {isOverCeilingExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {isOverCeilingExpanded && (
                        <div className="animate-fade-in mt-3" style={{ borderTop: '1px solid rgba(244, 63, 94, 0.2)', paddingTop: '12px' }}>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '12px' }}>
                            A despesa acumulada nesta natureza superou o teto estipulado pelos mapeamentos. Registre uma justificativa contábil para conformidade ou reajuste as quantidades/preços dos itens.
                          </p>

                          <div className="justification-form-box mt-3">
                            <label>Justificativa do Desvio Orçamentário:</label>
                            <div className="justification-input-row">
                              <input
                                type="text"
                                className="form-input flex-1"
                                placeholder="Ex: Compra extraordinária para evento em casa e aumento de preços no hortifrúti..."
                                value={justificationText}
                                onChange={(e) => setJustificationText(e.target.value)}
                              />
                              <button
                                className="btn btn-primary"
                                onClick={() => {
                                  if (!justificationText.trim()) return;
                                  saveCeilingJustification(selectedNature.id, justificationText);
                                  setJustificationText('');
                                  alert('Justificativa contábil registrada com sucesso!');
                                }}
                              >
                                <FileText size={16} />
                                <span>Gravar Justificativa</span>
                              </button>
                            </div>

                            {selectedNature.justificationHistory && selectedNature.justificationHistory.length > 0 && (
                              <div className="justification-history mt-3">
                                <span className="justification-history-title">Histórico de Justificativas Registradas:</span>
                                <div className="justification-history-list">
                                  {selectedNature.justificationHistory.map((just) => (
                                    <div key={just.id} className="just-item">
                                      <div className="just-item-meta">
                                        <strong>{just.date} ({just.month})</strong>
                                        <span className="text-rose">Excedente: +{(just.spentAmount - just.ceilingAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 3 })}</span>
                                      </div>
                                      <p className="just-item-reason">"{just.reason}"</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* BLOCO INTELIGENTE 2: LONGE DO TETO -> DIAGNÓSTICO PRECISO DE ITENS EM FALTA (RECOLHÍVEL POR PADRÃO) */}
                  {isCeilingFar && (
                    <div className="ceiling-alert-box alert-far-ceiling glass-card animate-fade-in mt-4">
                      <div
                        className="ceiling-alert-header cursor-pointer select-none"
                        onClick={() => setIsDiagnosticExpanded(!isDiagnosticExpanded)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Info size={22} className="text-cyan flex-shrink-0" />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <h4 className="text-cyan" style={{ margin: 0 }}>
                                Diagnóstico Orçamentário: Por que o Teto está distante?
                              </h4>
                              <span className="badge badge-cyan text-xs">
                                {missingItems.length} {missingItems.length === 1 ? 'item pendente' : 'itens pendentes'}
                              </span>
                            </div>
                            {!isDiagnosticExpanded && (
                              <p className="text-xs text-muted" style={{ margin: '3px 0 0' }}>
                                Falta realizar{' '}
                                <strong className="text-cyan">
                                  {(natureCeiling - natureSpent).toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 3,
                                  })}
                                </strong>{' '}
                                em compras planejadas. Clique para expandir detalhes e itens faltantes.
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-cyan"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsDiagnosticExpanded(!isDiagnosticExpanded);
                          }}
                        >
                          <span>{isDiagnosticExpanded ? 'Recolher' : 'Expandir'}</span>
                          {isDiagnosticExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {isDiagnosticExpanded && (
                        <div className="animate-fade-in mt-3" style={{ borderTop: '1px solid rgba(56, 189, 248, 0.15)', paddingTop: '12px' }}>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '12px' }}>
                            Você realizou <strong>{natureSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> de um teto estipulado de <strong>{natureCeiling.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> (restando <strong className="text-cyan">{(natureCeiling - natureSpent).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 3 })}</strong>).
                            O BALDER identificou os seguintes <strong>itens do mapeamento que ainda estão em falta / pendentes de compra</strong> no mês:
                          </p>

                          {missingItems.length > 0 ? (
                            <div className="missing-items-table-box mt-3">
                              <table className="natureza-items-table">
                                <thead>
                                  <tr>
                                    <th>Item Mapeado</th>
                                    <th>Mapeamento Origem</th>
                                    <th>Qtd × Preço × Semanas</th>
                                    <th>Valor Previsto</th>
                                    <th>Falta Realizar</th>
                                    <th>Ação Rápida</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {missingItems.map(({ item, mappingName, missingAmount }) => (
                                    <tr key={item.id} className="missing-item-row">
                                      <td>
                                        <strong>{item.description}</strong>
                                      </td>
                                      <td>
                                        <span className="badge badge-cyan text-xs">{mappingName}</span>
                                      </td>
                                      <td>
                                        {typeof item.quantity === 'number'
                                          ? item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
                                          : item.quantity}{' '}
                                        {item.unit || 'un'} ×{' '}
                                        {item.price.toLocaleString('pt-BR', {
                                          style: 'currency',
                                          currency: 'BRL',
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 3,
                                        })}{' '}
                                        × {item.multiplierWeeks} {item.multiplierWeeks > 1 ? 'semanas' : 'sem'}
                                      </td>
                                      <td>
                                        {item.totalValue.toLocaleString('pt-BR', {
                                          style: 'currency',
                                          currency: 'BRL',
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 3,
                                        })}
                                      </td>
                                      <td className="text-cyan font-bold">
                                        {missingAmount.toLocaleString('pt-BR', {
                                          style: 'currency',
                                          currency: 'BRL',
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 3,
                                        })}
                                      </td>
                                      <td>
                                        <button
                                          className="btn btn-outline btn-xs"
                                          title="Marcar item como comprado/liquidado no mês"
                                          onClick={() => {
                                            // Achar em qual mapeamento está
                                            const parentMap = selectedNature.mappings.find((m) => m.items.some((it) => it.id === item.id));
                                            if (parentMap) {
                                              toggleItemFulfilled(selectedNature.id, parentMap.id, item.id);
                                            }
                                          }}
                                        >
                                          <Check size={12} className="text-emerald" />
                                          <span>Marcar Comprado</span>
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="subtab-desc mt-2">Todos os itens mapeados já foram marcados como realizados.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SEÇÃO DE MAPEAMENTOS DE GASTOS FIXOS (SUPORTA MAIS DE UM MAPEAMENTO POR NATUREZA) */}
                  <div className="natureza-mappings-section mt-4">
                    <div className="mappings-section-header">
                      <div>
                        <h4>Mapeamentos de Gastos Fixos ({selectedNature.mappings.length})</h4>
                        <p className="subtab-desc">
                          Cadastre mais de um mapeamento para esta natureza para cobrir rotinas, compras semanais ou meses específicos. A soma de todos os itens define o Teto.
                        </p>
                      </div>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={handleOpenCreateMapping}
                      >
                        <Plus size={14} />
                        <span>Novo Mapeamento</span>
                      </button>
                    </div>

                    {selectedNature.mappings.length === 0 ? (
                      <div className="empty-mappings-box glass-card mt-3">
                        <Layers size={32} className="text-muted" />
                        <p>Nenhum mapeamento de gastos cadastrado para esta natureza.</p>
                        <div className="flex items-center gap-3 mt-3">
                          <button className="btn btn-primary btn-sm" onClick={handleOpenCreateMapping}>
                            <Plus size={14} />
                            <span>Criar Primeiro Mapeamento</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm text-xs"
                            onClick={() => {
                              if (confirm(`Deseja carregar sugestões de rotina e mapeamentos padrão para "${selectedNature.name}"?`)) {
                                loadSuggestedMappingsForNature(selectedNature.id);
                              }
                            }}
                            title="Carregar itens e rotinas pré-configuradas para esta natureza"
                          >
                            <span>💡 Carregar Modelos Sugeridos</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mappings-list-container">
                        {selectedNature.mappings.map((mapping) => {
                          const mappingTotal = (mapping.items || []).reduce((acc, it) => acc + it.totalValue, 0);

                          return (
                            <div key={mapping.id} className="mapping-card glass-card mt-4">
                              <div className="mapping-card-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div
                                    style={{
                                      width: '38px',
                                      height: '38px',
                                      borderRadius: '10px',
                                      background: 'rgba(255,255,255,0.06)',
                                      border: '1px solid var(--border-default)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '1.4rem',
                                      cursor: 'pointer',
                                      flexShrink: 0,
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                                      transition: 'all 0.15s ease',
                                    }}
                                    onClick={() => handleOpenEditMapping(mapping)}
                                    title="Clique para editar este mapeamento e seu emoji"
                                  >
                                    {mapping.icon || '📋'}
                                  </div>

                                  <div className="mapping-header-info">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <h5 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{mapping.name}</h5>
                                      <span className="badge badge-cyan">
                                        Total: {mappingTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                                      </span>
                                      <span className="badge badge-emerald">
                                        {mapping.items.length} {mapping.items.length === 1 ? 'item' : 'itens'}
                                      </span>
                                      {mapping.applicableMonths && mapping.applicableMonths.length > 0 && mapping.applicableMonths.length < 12 ? (
                                        <span
                                          className="badge badge-purple cursor-pointer hover:border-purple-400"
                                          onClick={() => handleOpenEditMapping(mapping)}
                                          title="Clique para alterar os meses de manifestação deste mapeamento"
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        >
                                          <Calendar size={11} />
                                          <span>
                                            {mapping.applicableMonths.length} {mapping.applicableMonths.length === 1 ? 'mês' : 'meses'} ({mapping.applicableMonths.map((m) => ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][m-1]).join(', ')})
                                          </span>
                                        </span>
                                      ) : (
                                        <span
                                          className="badge badge-outline text-muted text-xs cursor-pointer hover:border-cyan"
                                          onClick={() => handleOpenEditMapping(mapping)}
                                          title="Clique para definir meses específicos de manifestação na projeção"
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                        >
                                          <span>Ano Todo (12m)</span>
                                        </span>
                                      )}
                                      {mapping.dayOfMonth && (
                                        <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <Calendar size={11} />
                                          Venc. dia {mapping.dayOfMonth}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="mapping-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-xs text-cyan"
                                    title="Editar Nome, Emoji e Vencimento deste Mapeamento"
                                    onClick={() => handleOpenEditMapping(mapping)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <Edit2 size={12} />
                                    <span>Editar Mapeamento</span>
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-xs text-rose"
                                    title="Excluir Mapeamento"
                                    onClick={() => {
                                      if (confirm(`Deseja remover o mapeamento "${mapping.name}"?`)) {
                                        deleteMapping(selectedNature.id, mapping.id);
                                      }
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <Trash2 size={13} />
                                    <span>Excluir</span>
                                  </button>
                                </div>
                              </div>

                              {/* TABELA DE ITENS DO MAPEAMENTO */}
                              <div className="mapping-items-table-wrapper mt-3">
                                <table className="natureza-items-table">
                                  <thead>
                                    <tr>
                                      <th style={{ width: '25%' }}>Descrição / Item</th>
                                      <th style={{ width: '9%' }}>Qtd</th>
                                      <th style={{ width: '12%' }}>Preço Unit.</th>
                                      <th style={{ width: '22%' }}>Dia de Manifestação</th>
                                      <th style={{ width: '12%' }}>Multiplicador</th>
                                      <th style={{ width: '12%' }}>Valor Total</th>
                                      <th style={{ width: '8%' }}>Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {mapping.items.map((item) => (
                                      <tr key={item.id} className={item.isFulfilled ? 'item-row-fulfilled' : ''}>
                                        <td>
                                          <div className="item-desc-cell">
                                            <button
                                              className={`item-check-circle ${item.isFulfilled ? 'checked' : ''}`}
                                              title={item.isFulfilled ? 'Realizado no mês' : 'Pendente de compra'}
                                              onClick={() => toggleItemFulfilled(selectedNature.id, mapping.id, item.id)}
                                            >
                                              {item.isFulfilled ? '✓' : ''}
                                            </button>
                                            <span className={item.isFulfilled ? 'line-through text-muted' : 'font-semibold'}>
                                              {item.description}
                                            </span>
                                          </div>
                                        </td>
                                        <td>
                                          <span className="item-val-pill">
                                            {typeof item.quantity === 'number'
                                              ? item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
                                              : item.quantity}
                                          </span>
                                        </td>
                                        <td>
                                          {item.price.toLocaleString('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 3,
                                          })}
                                        </td>
                                        <td>
                                          {(() => {
                                            const badge = formatItemScheduleBadge(item);
                                            return (
                                              <span
                                                className={`badge ${badge.badgeClass} flex items-center gap-1 text-[11px] font-medium py-0.5 px-2`}
                                                title={badge.detail}
                                              >
                                                <span>{badge.icon}</span>
                                                <span>{badge.label}</span>
                                              </span>
                                            );
                                          })()}
                                        </td>
                                        <td>
                                          <span className="badge badge-cyan">
                                            {item.multiplierWeeks}x {item.multiplierWeeks === 1 ? 'semana/mês' : 'semanas'}
                                          </span>
                                        </td>
                                        <td>
                                          <strong className="text-glow-cyan font-mono">
                                            {item.totalValue.toLocaleString('pt-BR', {
                                              style: 'currency',
                                              currency: 'BRL',
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 3,
                                            })}
                                          </strong>
                                        </td>
                                        <td>
                                          <button
                                            className="btn btn-ghost btn-xs text-rose"
                                            title="Excluir item"
                                            onClick={() => deleteMappingItem(selectedNature.id, mapping.id, item.id)}
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}

                                    {/* Linha de Cadastro Rápido de Novo Item no Mapeamento */}
                                    <tr className="quick-add-item-row">
                                      <td>
                                        <input
                                          type="text"
                                          className="form-input form-input-sm"
                                          placeholder="Ex: Frutas Frescas, Açougue..."
                                          value={newItemDesc[mapping.id] || ''}
                                          onChange={(e) =>
                                            setNewItemDesc((prev) => ({ ...prev, [mapping.id]: e.target.value }))
                                          }
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          className="form-input form-input-sm text-center font-mono"
                                          placeholder="Qtd"
                                          value={newItemQty[mapping.id] !== undefined ? newItemQty[mapping.id] : 1}
                                          onChange={(e) => {
                                            const raw = e.target.value;
                                            setNewItemQty((prev) => ({
                                              ...prev,
                                              [mapping.id]: raw,
                                            }));
                                          }}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          className="form-input form-input-sm font-mono"
                                          placeholder="R$ 0,00"
                                          value={newItemPrice[mapping.id] !== undefined ? newItemPrice[mapping.id] : ''}
                                          onChange={(e) =>
                                            setNewItemPrice((prev) => ({ ...prev, [mapping.id]: e.target.value }))
                                          }
                                        />
                                      </td>
                                      <td>
                                        <div className="flex flex-col gap-1">
                                          <select
                                            className="form-input form-input-sm text-xs py-1"
                                            value={
                                              newItemRecurrenceType[mapping.id] ||
                                              (newItemMult[mapping.id] === 2
                                                ? 'QUINZENAL'
                                                : newItemMult[mapping.id] === 1
                                                ? 'MENSAL'
                                                : 'SEMANAL')
                                            }
                                            onChange={(e) => {
                                              const val = e.target.value as 'SEMANAL' | 'QUINZENAL' | 'MENSAL';
                                              setNewItemRecurrenceType((prev) => ({ ...prev, [mapping.id]: val }));
                                              if (val === 'SEMANAL') setNewItemMult((prev) => ({ ...prev, [mapping.id]: 4 }));
                                              if (val === 'QUINZENAL') setNewItemMult((prev) => ({ ...prev, [mapping.id]: 2 }));
                                              if (val === 'MENSAL') setNewItemMult((prev) => ({ ...prev, [mapping.id]: 1 }));
                                            }}
                                          >
                                            <option value="SEMANAL">🗓️ Semanal</option>
                                            <option value="QUINZENAL">🌓 Quinzenal</option>
                                            <option value="MENSAL">📅 Mensal</option>
                                          </select>

                                          {(!newItemRecurrenceType[mapping.id] || newItemRecurrenceType[mapping.id] === 'SEMANAL') && (
                                            <select
                                              className="form-input form-input-sm text-xs py-1"
                                              value={newItemDayOfWeek[mapping.id] || 'SABADO'}
                                              onChange={(e) =>
                                                setNewItemDayOfWeek((prev) => ({
                                                  ...prev,
                                                  [mapping.id]: e.target.value as any,
                                                }))
                                              }
                                            >
                                              {WEEKDAY_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                  {opt.label}
                                                </option>
                                              ))}
                                            </select>
                                          )}

                                          {newItemRecurrenceType[mapping.id] === 'QUINZENAL' && (
                                            <select
                                              className="form-input form-input-sm text-xs py-1 font-mono"
                                              value={newItemDayOfFortnight[mapping.id] || 1}
                                              onChange={(e) =>
                                                setNewItemDayOfFortnight((prev) => ({
                                                  ...prev,
                                                  [mapping.id]: parseInt(e.target.value) || 1,
                                                }))
                                              }
                                            >
                                              {Array.from({ length: 15 }, (_, i) => i + 1).map((d) => (
                                                <option key={d} value={d}>
                                                  Dia {d} (dias {d} e {d + 15})
                                                </option>
                                              ))}
                                            </select>
                                          )}

                                          {newItemRecurrenceType[mapping.id] === 'MENSAL' && (
                                            <select
                                              className="form-input form-input-sm text-xs py-1 font-mono"
                                              value={newItemDayOfMonth[mapping.id] || 10}
                                              onChange={(e) =>
                                                setNewItemDayOfMonth((prev) => ({
                                                  ...prev,
                                                  [mapping.id]: parseInt(e.target.value) || 1,
                                                }))
                                              }
                                            >
                                              {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                                                <option key={d} value={d}>
                                                  Dia {d}
                                                </option>
                                              ))}
                                              <option value={31}>Dia 31 (Fim do Mês - ajuste auto 28-31)</option>
                                            </select>
                                          )}
                                        </div>
                                      </td>
                                      <td>
                                        <select
                                          className="form-input form-input-sm"
                                          value={newItemMult[mapping.id] !== undefined ? newItemMult[mapping.id] : 4}
                                          onChange={(e) =>
                                            setNewItemMult((prev) => ({ ...prev, [mapping.id]: parseInt(e.target.value) || 1 }))
                                          }
                                        >
                                          <option value={4}>4 Semanas (Mês Padrão)</option>
                                          <option value={2}>2 Semanas (Quinzenal)</option>
                                          <option value={1}>1 Semana / Compra Única</option>
                                          <option value={3}>3 Semanas</option>
                                          <option value={5}>5 Semanas (Mês Longo)</option>
                                        </select>
                                      </td>
                                      <td>
                                        <div className="quick-item-total-preview">
                                          <strong className="font-mono">
                                            {(
                                              Math.round(
                                                (typeof newItemQty[mapping.id] === 'number'
                                                  ? (newItemQty[mapping.id] as number)
                                                  : parseFloat(String(newItemQty[mapping.id] || '1').replace(',', '.')) || 1) *
                                                  (typeof newItemPrice[mapping.id] === 'number'
                                                    ? (newItemPrice[mapping.id] as number)
                                                    : parseFloat(String(newItemPrice[mapping.id] || '0').replace(',', '.')) || 0) *
                                                  (newItemMult[mapping.id] !== undefined ? newItemMult[mapping.id] : 4) *
                                                  1000
                                              ) / 1000
                                            ).toLocaleString('pt-BR', {
                                              style: 'currency',
                                              currency: 'BRL',
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 3,
                                            })}
                                          </strong>
                                        </div>
                                      </td>
                                      <td>
                                        <button
                                          className="btn btn-primary btn-xs w-full"
                                          onClick={() => {
                                            const desc = (newItemDesc[mapping.id] || '').trim();
                                            const rawQty = newItemQty[mapping.id];
                                            const qty =
                                              typeof rawQty === 'number'
                                                ? rawQty
                                                : parseFloat(String(rawQty || '1').replace(',', '.')) || 1;
                                            const rawPrice = newItemPrice[mapping.id];
                                            const price =
                                              typeof rawPrice === 'number'
                                                ? rawPrice
                                                : parseFloat(String(rawPrice || '0').replace(',', '.')) || 0;
                                            const mult = newItemMult[mapping.id] !== undefined ? newItemMult[mapping.id] : 4;

                                            if (!desc) {
                                              alert('Informe a descrição do item.');
                                              return;
                                            }
                                            if (qty <= 0) {
                                              alert('Informe uma quantidade válida maior que zero.');
                                              return;
                                            }
                                            if (price <= 0) {
                                              alert('Informe um preço unitário válido.');
                                              return;
                                            }

                                            const recType =
                                              newItemRecurrenceType[mapping.id] ||
                                              (mult === 4 || mult === 5
                                                ? 'SEMANAL'
                                                : mult === 2
                                                ? 'QUINZENAL'
                                                : 'MENSAL');
                                            const dWeek = newItemDayOfWeek[mapping.id] || 'SABADO';
                                            const dFort = newItemDayOfFortnight[mapping.id] || 1;
                                            const dMonth = newItemDayOfMonth[mapping.id] || 10;

                                            addItemToMapping(selectedNature.id, mapping.id, {
                                              description: desc,
                                              quantity: qty,
                                              price: price,
                                              multiplierWeeks: mult,
                                              realizedValue: 0,
                                              isFulfilled: false,
                                              recurrenceType: recType,
                                              dayOfWeek: recType === 'SEMANAL' ? dWeek : undefined,
                                              dayOfFortnight: recType === 'QUINZENAL' ? dFort : undefined,
                                              dayOfMonth: recType === 'MENSAL' ? dMonth : undefined,
                                            });

                                            // Limpar campos
                                            setNewItemDesc((prev) => ({ ...prev, [mapping.id]: '' }));
                                            setNewItemPrice((prev) => ({ ...prev, [mapping.id]: 0 }));
                                            setNewItemQty((prev) => ({ ...prev, [mapping.id]: 1 }));
                                          }}
                                        >
                                          <Plus size={12} />
                                          <span>Adicionar</span>
                                        </button>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="empty-state glass-card p-6 text-center mt-4">
                  <p>Nenhuma natureza selecionada. Crie uma nova natureza para começar.</p>
                </div>
              )}
            </div>
          )}


          {activeSubTab === 'PREFERENCIAS' && (
            <div className="subtab-content">
              <h3>Preferências de Exibição</h3>
              <p className="subtab-desc">Personalize a sua interface do BALDER</p>

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

      {/* Modal de Nova ou Edição de Natureza */}
      <NatureModal
        isOpen={isNatureModalOpen}
        onClose={() => setIsNatureModalOpen(false)}
        natureToEdit={natureToEdit}
        onSuccess={(id) => {
          if (id) {
            setSelectedNatureId(id);
          }
        }}
      />

      {/* Modal de Criação ou Edição de Mapeamento de Gastos */}
      {selectedNature && (
        <MappingModal
          isOpen={isMappingModalOpen}
          onClose={() => setIsMappingModalOpen(false)}
          natureId={selectedNature.id}
          natureName={selectedNature.name}
          natureColor={selectedNature.color}
          mappingToEdit={mappingToEdit}
        />
      )}

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
      <SalaryAdjustmentModal
        isOpen={salaryModalOpen}
        onClose={() => setSalaryModalOpen(false)}
        initialMode={salaryModalMode}
        editContract={salaryEditContract}
        editAdjustment={salaryEditAdjustment}
      />

      {/* Modal para Marco de Acompanhamento Financeiro */}
      <CheckpointSetupModal
        isOpen={checkpointModalOpen}
        onClose={() => setCheckpointModalOpen(false)}
        isInitialSetup={!activeCheckpoint}
      />
    </div>
  );
};

