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
} from 'lucide-react';
import type { MovementType } from '../types';

interface MovementsPageProps {
  onOpenNewMovementModal: (defaultType?: MovementType) => void;
}

type TabFilter = 'TODOS' | 'RECEBER' | 'PAGAR' | 'EMPRESTIMO' | 'CARTAO';
type StatusFilter = 'TODOS' | 'PREVISTA' | 'REALIZADA';

export const MovementsPage: React.FC<MovementsPageProps> = ({ onOpenNewMovementModal }) => {
  const { movements, deleteMovement, toggleMovementStatus, exportToCSV } = useFinancial();

  const [activeTab, setActiveTab] = useState<TabFilter>('TODOS');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS');
  const [bankFilter, setBankFilter] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtragem Multidimensional
  const filteredMovements = useMemo(() => {
    return movements.filter((item) => {
      // Aba
      if (activeTab === 'RECEBER' && item.type !== 'RECEBER') return false;
      if (activeTab === 'PAGAR' && item.type !== 'PAGAR') return false;
      if (activeTab === 'EMPRESTIMO' && item.type !== 'EMPRESTIMO') return false;
      if (activeTab === 'CARTAO' && item.type !== 'CARTAO') return false;

      // Status
      if (statusFilter === 'PREVISTA' && item.status !== 'PREVISTA') return false;
      if (statusFilter === 'REALIZADA' && item.status !== 'REALIZADA') return false;

      // Banco
      if (bankFilter !== 'TODOS' && item.bank.toLowerCase() !== bankFilter.toLowerCase()) return false;

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
  }, [movements, activeTab, statusFilter, bankFilter, searchQuery]);

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
            Empréstimos
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
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((item) => {
                const isIncome = item.type === 'RECEBER';
                const isRealized = item.status === 'REALIZADA';

                return (
                  <tr key={item.id} className={isRealized ? 'row-realized' : ''}>
                    {/* Toggle Status Checkbox */}
                    <td>
                      <button
                        className={`status-toggle-btn ${isRealized ? 'checked' : ''}`}
                        onClick={() => toggleMovementStatus(item.id)}
                        title={isRealized ? 'Marcar como prevista' : 'Confirmar liquidação'}
                      >
                        {isRealized ? <CheckCircle2 size={18} className="text-emerald" /> : <Clock size={18} className="text-muted" />}
                      </button>
                    </td>

                    {/* Title */}
                    <td>
                      <div className="item-title-col">
                        <span className={`item-title ${isRealized ? 'line-through' : ''}`}>{item.title}</span>
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

                    {/* Amount */}
                    <td style={{ textAlign: 'right' }}>
                      <span className={`amount-text ${isIncome ? 'text-emerald' : 'text-rose font-semibold'}`}>
                        {isIncome ? '+' : '-'} {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="delete-action-btn"
                        onClick={() => deleteMovement(item.id)}
                        title="Excluir movimentação"
                      >
                        <Trash2 size={16} />
                      </button>
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
    </div>
  );
};
