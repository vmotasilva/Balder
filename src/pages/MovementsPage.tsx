import React, { useState, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import {
  Plus,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  CreditCard,
  Building2,
  Banknote,
  Zap,
  Briefcase,
  Flag,
  History,
} from 'lucide-react';
import type { MovementType } from '../types';
import { calculatePresentValue, groupLoanMovements } from '../utils/loanMath';
import { generateSalaryVirtualMovements } from '../utils/projectionMath';
import { LoanPrepaymentModal } from '../components/LoanPrepaymentModal';

interface MovementsPageProps {
  onOpenNewMovementModal: (defaultType?: MovementType) => void;
}

type TabFilter = 'TODOS' | 'RECEBER' | 'PAGAR' | 'EMPRESTIMO' | 'CARTAO';
type StatusFilter = 'TODOS' | 'PREVISTA' | 'REALIZADA';

export const MovementsPage: React.FC<MovementsPageProps> = ({ onOpenNewMovementModal }) => {
  const { movements, salaryContracts, deleteMovement, toggleMovementStatus, exportToCSV, activeCheckpoint } = useFinancial();

  const [includePreCheckpoint, setIncludePreCheckpoint] = useState(false);

  // Movimentos virtuais de salário (projetados a partir dos contratos cadastrados)
  const salaryVirtualMovements = useMemo(
    () => generateSalaryVirtualMovements(salaryContracts ?? []),
    [salaryContracts]
  );

  // Lista combinada: movimentos reais + virtuais de salário
  const allMovements = useMemo(
    () => [...movements, ...salaryVirtualMovements],
    [movements, salaryVirtualMovements]
  );

  const [activeTab, setActiveTab] = useState<TabFilter>('TODOS');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS');
  const [bankFilter, setBankFilter] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState('');

  const preCheckpointCount = useMemo(() => {
    if (!activeCheckpoint) return 0;
    return allMovements.filter((m) => m.dueDate < activeCheckpoint.startDate).length;
  }, [allMovements, activeCheckpoint]);

  // Modal de Simulação e Antecipação de Empréstimos
  const [prepaymentModalOpen, setPrepaymentModalOpen] = useState(false);
  const [selectedPrepayGroup, setSelectedPrepayGroup] = useState<string | undefined>(undefined);
  const [selectedPrepayMovement, setSelectedPrepayMovement] = useState<string | undefined>(undefined);

  const handleOpenPrepayment = (groupId?: string, movementId?: string) => {
    setSelectedPrepayGroup(groupId);
    setSelectedPrepayMovement(movementId);
    setPrepaymentModalOpen(true);
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Análise da carteira de empréstimos em aberto
  const loanGroups = useMemo(() => {
    return groupLoanMovements(movements, todayStr);
  }, [movements, todayStr]);

  const totalLoanNominal = useMemo(() => {
    return loanGroups.reduce((sum, g) => sum + g.nominalBalance, 0);
  }, [loanGroups]);

  const totalLoanPresentValue = useMemo(() => {
    return loanGroups.reduce((sum, g) => sum + g.presentValueToday, 0);
  }, [loanGroups]);

  const totalLoanImmediateSavings = useMemo(() => {
    return Math.max(0, Math.round((totalLoanNominal - totalLoanPresentValue) * 100) / 100);
  }, [totalLoanNominal, totalLoanPresentValue]);

  // Filtragem Multidimensional (inclui movimentos virtuais de salário e filtro de marco)
  const filteredMovements = useMemo(() => {
    return allMovements.filter((item) => {
      // Marco de Acompanhamento (oculta transações anteriores ao marco por padrão)
      if (activeCheckpoint && !includePreCheckpoint && item.dueDate < activeCheckpoint.startDate) {
        return false;
      }

      // Aba
      if (activeTab === 'RECEBER' && item.type !== 'RECEBER') return false;
      if (activeTab === 'PAGAR' && item.type !== 'PAGAR') return false;
      if (activeTab === 'EMPRESTIMO' && item.type !== 'EMPRESTIMO') return false;
      if (activeTab === 'CARTAO' && item.type !== 'CARTAO') return false;

      // Status
      if (statusFilter === 'PREVISTA' && item.status !== 'PREVISTA') return false;
      if (statusFilter === 'REALIZADA' && item.status !== 'REALIZADA') return false;

      // Banco
      if (bankFilter !== 'TODOS' && item.bank && item.bank.toLowerCase() !== bankFilter.toLowerCase()) return false;

      // Busca
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        const matchesNotes = (item.notes || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesCat && !matchesNotes) return false;
      }

      return true;
    });
  }, [allMovements, activeTab, statusFilter, bankFilter, searchQuery, activeCheckpoint, includePreCheckpoint]);

  // Totais
  const totalReceber = useMemo(() => {
    return filteredMovements
      .filter((m) => m.type === 'RECEBER' && m.status === 'PREVISTA')
      .reduce((acc, cur) => acc + cur.amount, 0);
  }, [filteredMovements]);

  const totalPagar = useMemo(() => {
    return filteredMovements
      .filter((m) => (m.type === 'PAGAR' || m.type === 'EMPRESTIMO' || m.type === 'CARTAO') && m.status === 'PREVISTA')
      .reduce((acc, cur) => acc + cur.amount, 0);
  }, [filteredMovements]);

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="kicker-badge">
            <span>CENTRAL OPERACIONAL</span>
          </div>
          <h1 className="page-title">Minhas Movimentações</h1>
          <p className="page-subtitle">Acompanhe entradas, saídas, parcelas de empréstimos e faturas de cartão</p>
        </div>

        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={exportToCSV} title="Exportar tabela para planilha CSV">
            <Download size={16} />
            <span>Exportar CSV</span>
          </button>
          <button className="btn btn-primary" onClick={() => onOpenNewMovementModal('PAGAR')}>
            <Plus size={16} />
            <span>Nova Movimentação</span>
          </button>
        </div>
      </div>

      {/* 6 Ações Rápidas de Cadastro */}
      <div className="movements-quick-actions-bar glass-card">
        <span className="quick-actions-label">Ações Imediatas:</span>
        <div className="quick-actions-buttons">
          <button className="quick-action-btn" onClick={() => onOpenNewMovementModal('RECEBER')}>
            <span className="text-emerald">+</span> Cadastrar a Receber
          </button>
          <button className="quick-action-btn" onClick={() => onOpenNewMovementModal('PAGAR')}>
            <span className="text-rose">-</span> Cadastrar a Pagar
          </button>
          <button className="quick-action-btn" onClick={() => onOpenNewMovementModal('PAGAR')}>
            <CheckCircle2 size={14} className="text-emerald" /> Registrar Pagamento
          </button>
          <button className="quick-action-btn" onClick={() => onOpenNewMovementModal('RECEBER')}>
            <Banknote size={14} className="text-cyan" /> Registrar Recebimento
          </button>
          <button className="quick-action-btn" onClick={() => onOpenNewMovementModal('EMPRESTIMO')}>
            <Building2 size={14} className="text-amber" /> Cadastrar Empréstimo
          </button>
          <button className="quick-action-btn" onClick={() => onOpenNewMovementModal('EMPRESTIMO')}>
            <CreditCard size={14} className="text-purple" /> Cadastrar Financiamento
          </button>
        </div>
      </div>

      {/* BANNER EXECUTIVO QUANDO A ABA FOR EMPRÉSTIMO */}
      {activeTab === 'EMPRESTIMO' && loanGroups.length > 0 && (
        <div className="loan-portfolio-banner glass-card animate-fade-in mb-4">
          <div className="loan-portfolio-info">
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-amber text-xs">RESUMO DE CRÉDITOS ATIVOS</span>
              <span className="text-xs text-muted">Resolução BACEN nº 3.516 (Deságio a Valor Presente)</span>
            </div>
            <h3 className="text-lg font-bold text-white">Carteira de Empréstimos & Oportunidade de Quitação</h3>
            <p className="text-xs text-secondary mt-1">
              Você possui <strong>{loanGroups.reduce((acc, g) => acc + g.openInstallments.length, 0)} parcelas futuras</strong> ativas.
              Ao antecipar parcelas, todos os juros futuros não decorridos são deduzidos por lei.
            </p>
          </div>

          <div className="loan-portfolio-kpis">
            <div className="portfolio-kpi-item">
              <span className="portfolio-kpi-label">Saldo Devedor Nominal</span>
              <strong className="portfolio-kpi-val text-white">
                {totalLoanNominal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </strong>
            </div>

            <div className="portfolio-kpi-item">
              <span className="portfolio-kpi-label">Se Quitado Hoje</span>
              <strong className="portfolio-kpi-val text-cyan">
                {totalLoanPresentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </strong>
            </div>

            <div className="portfolio-kpi-item">
              <span className="portfolio-kpi-label">Economia Imediata</span>
              <strong className="portfolio-kpi-val text-emerald">
                +{totalLoanImmediateSavings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </strong>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm portfolio-cta-btn"
              onClick={() => handleOpenPrepayment()}
            >
              <Zap size={15} />
              <span>Simular Antecipação</span>
            </button>
          </div>
        </div>
      )}

      {/* Summary KPI Pills */}
      <div className="movements-kpi-row">
        <div className="kpi-pill glass-card">
          <span className="kpi-pill-label">Total a Receber Previsto</span>
          <span className="kpi-pill-val text-emerald">
            +{totalReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>

        <div className="kpi-pill glass-card">
          <span className="kpi-pill-label">Total a Pagar Previsto</span>
          <span className="kpi-pill-val text-rose">
            -{totalPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>

        <div className="kpi-pill glass-card">
          <span className="kpi-pill-label">Resultado Líquido Filtrado</span>
          <span className={`kpi-pill-val ${totalReceber - totalPagar >= 0 ? 'text-cyan' : 'text-rose'}`}>
            {totalReceber - totalPagar >= 0 ? '+' : ''}
            {(totalReceber - totalPagar).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="movements-filter-panel glass-card">
        {/* View Tabs */}
        <div className="filter-view-tabs">
          <button className={`view-tab ${activeTab === 'TODOS' ? 'active' : ''}`} onClick={() => setActiveTab('TODOS')}>
            Visão Geral
          </button>
          <button className={`view-tab ${activeTab === 'RECEBER' ? 'active' : ''}`} onClick={() => setActiveTab('RECEBER')}>
            Receber
          </button>
          <button className={`view-tab ${activeTab === 'PAGAR' ? 'active' : ''}`} onClick={() => setActiveTab('PAGAR')}>
            Pagar
          </button>
          <button className={`view-tab ${activeTab === 'EMPRESTIMO' ? 'active' : ''}`} onClick={() => setActiveTab('EMPRESTIMO')}>
            Empréstimos {loanGroups.length > 0 && `(${loanGroups.reduce((acc, g) => acc + g.openInstallments.length, 0)})`}
          </button>
          <button className={`view-tab ${activeTab === 'CARTAO' ? 'active' : ''}`} onClick={() => setActiveTab('CARTAO')}>
            Cartões
          </button>
        </div>

        {/* Secondary Filter Controls Row */}
        <div className="filter-controls-row">
          {/* Status Filter */}
          <div className="control-group">
            <span className="control-label">Status:</span>
            <div className="pill-selector">
              <button
                className={`pill-btn ${statusFilter === 'TODOS' ? 'active' : ''}`}
                onClick={() => setStatusFilter('TODOS')}
              >
                Todos
              </button>
              <button
                className={`pill-btn ${statusFilter === 'PREVISTA' ? 'active' : ''}`}
                onClick={() => setStatusFilter('PREVISTA')}
              >
                Previstas
              </button>
              <button
                className={`pill-btn ${statusFilter === 'REALIZADA' ? 'active' : ''}`}
                onClick={() => setStatusFilter('REALIZADA')}
              >
                Realizadas
              </button>
            </div>
          </div>

          {/* Bank Filter */}
          <div className="control-group">
            <span className="control-label">Banco:</span>
            <select className="form-select select-sm" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}>
              <option value="TODOS">Todos os Bancos</option>
              <option value="Nubank">Nubank</option>
              <option value="Inter">Inter</option>
              <option value="XP">XP Investimentos</option>
              <option value="Caixa">Caixa</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="search-input-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por descrição, categoria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Linha de Contexto do Marco Financeiro */}
        {activeCheckpoint && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 mt-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs flex-wrap">
            <div className="flex items-center gap-2 text-slate-300">
              <Flag size={14} className="text-indigo-400" />
              <span>
                Monitorando a partir de <strong>{activeCheckpoint.startDate.split('-').reverse().join('/')}</strong>
                {activeCheckpoint.label && <span className="text-slate-400"> ({activeCheckpoint.label})</span>}
              </span>
            </div>
            {preCheckpointCount > 0 && (
              <button
                type="button"
                onClick={() => setIncludePreCheckpoint(!includePreCheckpoint)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  includePreCheckpoint
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:border-slate-600 hover:text-white'
                }`}
              >
                <History size={13} />
                <span>
                  {includePreCheckpoint
                    ? 'Ocultar histórico anterior'
                    : `Exibir transações anteriores ao marco (${preCheckpointCount})`}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Movements Table */}
      <div className="movements-table-card glass-card">
        {filteredMovements.length > 0 ? (
          <table className="movements-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>Status</th>
                <th>Descrição / Título</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th>Banco</th>
                <th style={{ textAlign: 'right' }}>Valor Nominal</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((item) => {
                const isIncome = item.type === 'RECEBER';
                const isRealized = item.status === 'REALIZADA';
                const isVirtual = (item as any).isSalaryVirtual === true;

                // Cálculo reativo do valor se pago hoje para empréstimos
                let todayPrepayment = null;
                if (item.type === 'EMPRESTIMO' && !isRealized) {
                  const rate = item.interestRatePercent || 3.03;
                  todayPrepayment = calculatePresentValue(item.amount, item.dueDate, todayStr, rate);
                }

                return (
                  <tr key={item.id} className={`${isRealized ? 'row-realized' : ''} ${isVirtual ? 'row-virtual-salary' : ''}`}>
                    {/* Toggle Status Checkbox */}
                    <td>
                      {isVirtual ? (
                        <span title="Previsto pelo contrato de salário" style={{ display: 'flex', justifyContent: 'center', color: 'var(--accent-cyan)', opacity: 0.7 }}>
                          <Briefcase size={16} />
                        </span>
                      ) : (
                        <button
                          className={`status-toggle-btn ${isRealized ? 'checked' : ''}`}
                          onClick={() => toggleMovementStatus(item.id)}
                          title={isRealized ? 'Marcar como prevista' : 'Confirmar liquidação'}
                        >
                          {isRealized ? <CheckCircle2 size={18} className="text-emerald" /> : <Clock size={18} className="text-muted" />}
                        </button>
                      )}
                    </td>

                    {/* Title */}
                    <td>
                      <div className="item-title-col">
                        <div className="flex items-center gap-2">
                          <span className={`item-title ${isRealized ? 'line-through' : ''}`}>{item.title}</span>
                          {isVirtual && (
                            <span className="badge badge-cyan text-xs" style={{ fontSize: '10px', padding: '2px 6px', opacity: 0.85 }}>
                              💼 Salário
                            </span>
                          )}
                          {item.installmentNumber && item.installmentsTotal && (
                            <span className="badge badge-cyan text-xs">
                              {item.installmentNumber}/{item.installmentsTotal}
                            </span>
                          )}
                        </div>
                        {item.notes && <span className="item-notes">{item.notes}</span>}
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td>
                      <span className={`type-badge type-${item.type.toLowerCase()}`}>
                        {item.type}
                      </span>
                    </td>

                    {/* Category */}
                    <td>
                      <span className="category-pill">{item.category}</span>
                    </td>

                    {/* Due Date */}
                    <td>
                      <span className="date-text">{item.dueDate}</span>
                    </td>

                    {/* Bank */}
                    <td>
                      <span className="bank-text">{item.bank}</span>
                    </td>

                    {/* Amount + Valor Se Pago Hoje */}
                    <td style={{ textAlign: 'right' }}>
                      <span className={`amount-text ${isIncome ? 'text-emerald' : 'text-rose font-semibold'}`}>
                        {isIncome ? '+' : '-'} {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>

                      {/* Exibição do Valor se pago hoje para cada parcela de empréstimo cadastrado */}
                      {todayPrepayment && (
                        <div className="prepayment-row-indicator mt-1">
                          <div className="text-xs text-cyan flex justify-end items-center gap-1 font-medium">
                            <span className="text-muted text-xs">Se pago hoje:</span>
                            <strong className="text-white">
                              {todayPrepayment.discountedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </strong>
                          </div>
                          {todayPrepayment.discountAmount > 0 && (
                            <div className="flex justify-end items-center gap-2 mt-1">
                              <span className="badge badge-emerald" style={{ fontSize: '10px', padding: '1px 5px' }}>
                                - {todayPrepayment.discountAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({todayPrepayment.discountPercent}%)
                              </span>
                              <button
                                type="button"
                                className="btn-prepay-shortcut"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenPrepayment(item.installmentGroupId, item.id);
                                }}
                                title="Simular antecipação desta ou de outras parcelas deste contrato"
                              >
                                <Zap size={11} />
                                <span>Simular Antecipação</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'center' }}>
                      {isVirtual ? (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Projetado</span>
                      ) : (
                        <button
                          className="delete-action-btn"
                          onClick={() => deleteMovement(item.id)}
                          title="Excluir movimentação"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state-box">
            <span className="empty-icon">📂</span>
            <h3>Nenhuma movimentação encontrada</h3>
            <p>Tente ajustar os filtros ou cadastre um novo lançamento financeiro.</p>
            <button className="btn btn-primary" onClick={() => onOpenNewMovementModal('PAGAR')}>
              <Plus size={16} /> Cadastrar Movimentação
            </button>
          </div>
        )}
      </div>

      {/* Modal de Simulação de Antecipação de Empréstimo */}
      <LoanPrepaymentModal
        isOpen={prepaymentModalOpen}
        onClose={() => setPrepaymentModalOpen(false)}
        initialGroupId={selectedPrepayGroup}
        initialMovementId={selectedPrepayMovement}
      />
    </div>
  );
};
