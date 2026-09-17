import React, { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { useTheme } from '../context/ThemeContext';
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
} from 'lucide-react';
import { FinanceEntityModal, type EntityTab } from '../components/FinanceEntityModal';
import { SalaryAdjustmentModal, type SalaryModalMode } from '../components/SalaryAdjustmentModal';
import { CheckpointSetupModal } from '../components/CheckpointSetupModal';
import type { SalaryContract, SalaryAdjustment } from '../types';

export const ProfilePage: React.FC = () => {
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
    addNature,
    deleteNature,
    addMappingToNature,
    deleteMapping,
    addItemToMapping,
    deleteMappingItem,
    toggleItemFulfilled,
    saveCeilingJustification,
    getNatureCeiling,
    getNatureSpent,
    getNatureMissingItems,
    salaryContracts,
    deleteSalaryContract,
    deleteSalaryAdjustment,
    checkpoints,
    activeCheckpoint,
    activateCheckpoint,
  } = useFinancial();
  const { theme, setTheme } = useTheme();

  const [activeSubTab, setActiveSubTab] = useState<
    'PERFIL' | 'SALARIO' | 'MARCOS' | 'CONTAS' | 'BANCOS' | 'CATEGORIAS' | 'PREFERENCIAS' | 'EXPORTACOES' | 'SEGURANCA'
  >('PERFIL');
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false);
  const [checkpointModalOpen, setCheckpointModalOpen] = useState(false);

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

  // Formulário Inline de Itens por Mapeamento
  const [newItemDesc, setNewItemDesc] = useState<Record<string, string>>({});
  const [newItemQty, setNewItemQty] = useState<Record<string, number>>({});
  const [newItemPrice, setNewItemPrice] = useState<Record<string, number>>({});
  const [newItemMult, setNewItemMult] = useState<Record<string, number>>({});

  // Modais de Criação
  const [isNewNatureModalOpen, setIsNewNatureModalOpen] = useState(false);
  const [newNatureName, setNewNatureName] = useState('');
  const [newNatureIcon, setNewNatureIcon] = useState('🏷️');
  const [newNatureColor, setNewNatureColor] = useState('#10B981');
  const [newNatureType, setNewNatureType] = useState<'ESSENCIAL' | 'FIXA' | 'VARIAVEL'>('ESSENCIAL');
  const [newNatureDesc, setNewNatureDesc] = useState('');

  const [isNewMappingModalOpen, setIsNewMappingModalOpen] = useState(false);
  const [newMappingName, setNewMappingName] = useState('');

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
              className={`profile-nav-item ${activeSubTab === 'SALARIO' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('SALARIO')}
            >
              <Briefcase size={18} />
              <span>Remuneração & Salário ({salaryContracts.length})</span>
            </button>

            <button
              className={`profile-nav-item ${activeSubTab === 'MARCOS' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('MARCOS')}
            >
              <Flag size={18} />
              <span>Marcos de Início ({checkpoints.length})</span>
            </button>

            <button
              className={`profile-nav-item ${activeSubTab === 'CONTAS' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('CONTAS')}
            >
              <CreditCard size={18} />
              <span>Contas & Meios ({accounts.length + cards.length})</span>
            </button>

            <button
              className={`profile-nav-item ${activeSubTab === 'BANCOS' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('BANCOS')}
            >
              <Building size={18} />
              <span>Bancos & Instituições ({banks.length})</span>
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-800/80">
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
                        <span className="info-cell-val font-semibold">
                          {activeContract.contractType} • {activeContract.paymentSchedule === 'QUINZENAL' || activeContract.secondPaymentDay ? 'Em 2 Quinzenas' : 'Mensal Integral'}
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
                <button className="btn btn-primary btn-sm" onClick={() => setIsNewNatureModalOpen(true)}>
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
                        <span className="natureza-large-icon">{selectedNature.icon}</span>
                        <div className="flex-1">
                          <div className="natureza-title-meta">
                            <h4>{selectedNature.name}</h4>
                            <span className="badge badge-cyan">{selectedNature.type}</span>
                            {natures.length > 1 && (
                              <button
                                className="btn btn-ghost btn-xs text-rose ml-auto"
                                title="Excluir esta Natureza"
                                onClick={() => {
                                  if (confirm(`Deseja realmente excluir a natureza "${selectedNature.name}" e todos os seus mapeamentos?`)) {
                                    deleteNature(selectedNature.id);
                                    const next = natures.find((n) => n.id !== selectedNature.id);
                                    if (next) setSelectedNatureId(next.id);
                                  }
                                }}
                              >
                                <Trash2 size={13} />
                                <span>Excluir Natureza</span>
                              </button>
                            )}
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

                  {/* BLOCO INTELIGENTE 1: TETO ULTRAPASSADO -> JUSTIFICATIVA OU AJUSTE */}
                  {isCeilingOver && (
                    <div className="ceiling-alert-box alert-over-ceiling glass-card animate-fade-in mt-4">
                      <div className="ceiling-alert-header">
                        <AlertTriangle size={24} className="text-rose" />
                        <div>
                          <h4 className="text-rose">Teto de Gastos Ultrapassado em {(natureSpent - natureCeiling).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h4>
                          <p>
                            A despesa acumulada nesta natureza superou o teto estipulado pelos mapeamentos. Registre uma justificativa contábil para conformidade ou reajuste as quantidades/preços dos itens.
                          </p>
                        </div>
                      </div>

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
                                    <span className="text-rose">Excedente: +{(just.spentAmount - just.ceilingAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
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

                  {/* BLOCO INTELIGENTE 2: LONGE DO TETO -> DIAGNÓSTICO PRECISO DE ITENS EM FALTA */}
                  {isCeilingFar && (
                    <div className="ceiling-alert-box alert-far-ceiling glass-card animate-fade-in mt-4">
                      <div className="ceiling-alert-header">
                        <Info size={24} className="text-cyan" />
                        <div>
                          <h4 className="text-cyan">Diagnóstico Orçamentário: Por que o Teto está distante?</h4>
                          <p>
                            Você realizou <strong>{natureSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> de um teto estipulado de <strong>{natureCeiling.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> (restando <strong>{(natureCeiling - natureSpent).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>).
                            O BALDER identificou os seguintes <strong>itens do mapeamento que ainda estão em falta / pendentes de compra</strong> no mês:
                          </p>
                        </div>
                      </div>

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
                                    {item.quantity} un × {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} × {item.multiplierWeeks} {item.multiplierWeeks > 1 ? 'semanas' : 'sem'}
                                  </td>
                                  <td>{item.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                  <td className="text-cyan font-bold">
                                    {missingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                        onClick={() => setIsNewMappingModalOpen(true)}
                      >
                        <Plus size={14} />
                        <span>Novo Mapeamento</span>
                      </button>
                    </div>

                    {selectedNature.mappings.length === 0 ? (
                      <div className="empty-mappings-box glass-card mt-3">
                        <Layers size={32} className="text-muted" />
                        <p>Nenhum mapeamento de gastos cadastrado para esta natureza.</p>
                        <button className="btn btn-primary btn-sm mt-2" onClick={() => setIsNewMappingModalOpen(true)}>
                          Criar Primeiro Mapeamento
                        </button>
                      </div>
                    ) : (
                      <div className="mappings-list-container">
                        {selectedNature.mappings.map((mapping) => {
                          const mappingTotal = (mapping.items || []).reduce((acc, it) => acc + it.totalValue, 0);

                          return (
                            <div key={mapping.id} className="mapping-card glass-card mt-4">
                              <div className="mapping-card-header">
                                <div className="mapping-header-info">
                                  <h5>{mapping.name}</h5>
                                  <span className="badge badge-cyan">
                                    Total do Mapeamento: {mappingTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                  <span className="badge badge-emerald">
                                    {mapping.items.length} {mapping.items.length === 1 ? 'item' : 'itens'}
                                  </span>
                                </div>
                                <div className="mapping-header-actions">
                                  <button
                                    className="btn btn-ghost btn-xs text-rose"
                                    title="Excluir Mapeamento"
                                    onClick={() => {
                                      if (confirm(`Deseja remover o mapeamento "${mapping.name}"?`)) {
                                        deleteMapping(selectedNature.id, mapping.id);
                                      }
                                    }}
                                  >
                                    <Trash2 size={14} />
                                    <span>Excluir Mapeamento</span>
                                  </button>
                                </div>
                              </div>

                              {/* TABELA DE ITENS DO MAPEAMENTO */}
                              <div className="mapping-items-table-wrapper mt-3">
                                <table className="natureza-items-table">
                                  <thead>
                                    <tr>
                                      <th style={{ width: '30%' }}>Descrição / Item</th>
                                      <th style={{ width: '12%' }}>Quantidade</th>
                                      <th style={{ width: '15%' }}>Preço Unitário</th>
                                      <th style={{ width: '18%' }}>Multiplicador (Semanas)</th>
                                      <th style={{ width: '15%' }}>Valor Total</th>
                                      <th style={{ width: '10%' }}>Ações</th>
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
                                          {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td>
                                          <span className="badge badge-cyan">
                                            {item.multiplierWeeks}x {item.multiplierWeeks === 1 ? 'semana/mês' : 'semanas'}
                                          </span>
                                        </td>
                                        <td>
                                          <strong className="text-glow-cyan">
                                            {item.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                                          type="number"
                                          step="any"
                                          min="0.001"
                                          className="form-input form-input-sm text-center"
                                          placeholder="Qtd"
                                          value={newItemQty[mapping.id] !== undefined ? newItemQty[mapping.id] : 1}
                                          onChange={(e) => {
                                            const raw = e.target.value.replace(',', '.');
                                            const val = parseFloat(raw);
                                            setNewItemQty((prev) => ({
                                              ...prev,
                                              [mapping.id]: isNaN(val) ? (raw === '' ? ('' as any) : 0) : val,
                                            }));
                                          }}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          className="form-input form-input-sm"
                                          placeholder="R$ 0,00"
                                          value={newItemPrice[mapping.id] !== undefined ? newItemPrice[mapping.id] : ''}
                                          onChange={(e) =>
                                            setNewItemPrice((prev) => ({ ...prev, [mapping.id]: parseFloat(e.target.value) || 0 }))
                                          }
                                        />
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
                                          <span className="text-xs text-muted">Total:</span>
                                          <strong>
                                            {(
                                              Math.round(
                                                (typeof newItemQty[mapping.id] === 'number'
                                                  ? newItemQty[mapping.id]
                                                  : parseFloat(String(newItemQty[mapping.id] || '1').replace(',', '.')) || 1) *
                                                  (newItemPrice[mapping.id] || 0) *
                                                  (newItemMult[mapping.id] !== undefined ? newItemMult[mapping.id] : 4) *
                                                  100
                                              ) / 100
                                            ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                                            const price = newItemPrice[mapping.id] || 0;
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

                                            addItemToMapping(selectedNature.id, mapping.id, {
                                              description: desc,
                                              quantity: qty,
                                              price: price,
                                              multiplierWeeks: mult,
                                              realizedValue: 0,
                                              isFulfilled: false,
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

      {/* Modal de Nova Natureza */}
      {isNewNatureModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsNewNatureModalOpen(false)}>
          <div className="modal-container glass-card animate-fade-in" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Nova Natureza de Gastos</h3>
                <p className="modal-subtitle">Defina uma nova categoria orçamentária para receber mapeamentos fixos</p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsNewNatureModalOpen(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="form-group mb-3">
                <label>Nome da Natureza</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Pets & Veterinário, Lazer, etc."
                  value={newNatureName}
                  onChange={(e) => setNewNatureName(e.target.value)}
                />
              </div>

              <div className="form-grid-3 mb-3">
                <div className="form-group">
                  <label>Ícone / Emoji</label>
                  <input
                    type="text"
                    className="form-input text-center text-xl"
                    placeholder="🏷️"
                    value={newNatureIcon}
                    onChange={(e) => setNewNatureIcon(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Tipo Orçamentário</label>
                  <select
                    className="form-input"
                    value={newNatureType}
                    onChange={(e) => setNewNatureType(e.target.value as any)}
                  >
                    <option value="ESSENCIAL">Essencial (Sobrevivência)</option>
                    <option value="FIXA">Fixa (Compromisso)</option>
                    <option value="VARIAVEL">Variável (Estilo de Vida)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Cor de Destaque</label>
                  <div className="nature-color-picker-row">
                    {['#10B981', '#38BDF8', '#A855F7', '#F43F5E', '#F59E0B', '#6366F1'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`color-dot-btn ${newNatureColor === c ? 'active' : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setNewNatureColor(c)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-group mb-3">
                <label>Descrição / Finalidade</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Finalidade orçamentária dos gastos desta natureza..."
                  value={newNatureDesc}
                  onChange={(e) => setNewNatureDesc(e.target.value)}
                />
              </div>

              <div className="modal-footer-actions mt-4">
                <button className="btn btn-outline" onClick={() => setIsNewNatureModalOpen(false)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (!newNatureName.trim()) {
                      alert('Informe o nome da natureza.');
                      return;
                    }
                    addNature({
                      name: newNatureName.trim(),
                      icon: newNatureIcon || '🏷️',
                      color: newNatureColor,
                      type: newNatureType,
                      description: newNatureDesc,
                      overCeilingJustification: '',
                      justificationHistory: [],
                    });
                    setNewNatureName('');
                    setNewNatureDesc('');
                    setIsNewNatureModalOpen(false);
                  }}
                >
                  <Plus size={16} />
                  <span>Cadastrar Natureza</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Novo Mapeamento de Gastos Fixos */}
      {isNewMappingModalOpen && selectedNature && (
        <div className="modal-backdrop" onClick={() => setIsNewMappingModalOpen(false)}>
          <div className="modal-container glass-card animate-fade-in" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Novo Mapeamento de Gastos</h3>
                <p className="modal-subtitle">
                  Adicionar mapeamento à natureza: <strong>{selectedNature.name}</strong>
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsNewMappingModalOpen(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="form-group mb-3">
                <label>Nome do Mapeamento</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Feira Semanal de Bairro, Compras em Atacado, etc."
                  value={newMappingName}
                  onChange={(e) => setNewMappingName(e.target.value)}
                />
                <span className="text-xs text-muted mt-1 block">
                  Você poderá cadastrar múltiplos itens com quantidades, preços e multiplicadores semanais para compor o teto.
                </span>
              </div>

              <div className="modal-footer-actions mt-4">
                <button className="btn btn-outline" onClick={() => setIsNewMappingModalOpen(false)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (!newMappingName.trim()) {
                      alert('Informe o nome do mapeamento.');
                      return;
                    }
                    addMappingToNature(selectedNature.id, newMappingName.trim());
                    setNewMappingName('');
                    setIsNewMappingModalOpen(false);
                  }}
                >
                  <Plus size={16} />
                  <span>Criar Mapeamento</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

