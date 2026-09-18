import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Tag,
  Trash2,
  Calendar,
  Check,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import type { Movement, MovementStatus, InvoiceNatureItemBreakdown } from '../types';
import { MovementDetailModal } from '../components/MovementDetailModal';

export const InvoicesPage: React.FC = () => {
  const {
    movements,
    updateMovement,
    addMovement,
    cards,
    natures,
  } = useFinancial();

  // Estados de Filtros e Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBankFilter, setSelectedBankFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'PREVISTA' | 'REALIZADA'>('ALL');
  const [selectedConciliationFilter, setSelectedConciliationFilter] = useState<'ALL' | 'RECONCILED' | 'PARTIAL' | 'UNANALYZED'>('ALL');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('ALL');

  // Modal de Detalhamento Pop-up (MovementDetailModal)
  const [selectedMovementForModal, setSelectedMovementForModal] = useState<Movement | null>(null);

  // Cards recolhidos / expandidos para detalhamento de itens
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});

  // Inline Quick Add Item por Fatura
  const [inlineItemNature, setInlineItemNature] = useState<Record<string, string>>({});
  const [inlineItemDesc, setInlineItemDesc] = useState<Record<string, string>>({});
  const [inlineItemAmount, setInlineItemAmount] = useState<Record<string, string>>({});

  // Obter todos os movimentos de Cartão de Crédito
  const cardMovements = useMemo(() => {
    return movements
      .filter((m) => m.type === 'CARTAO')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [movements]);

  // Lista de bancos presentes nos movimentos de cartão
  const availableBanks = useMemo(() => {
    const set = new Set<string>();
    cardMovements.forEach((m) => {
      if (m.bank) set.add(m.bank);
    });
    cards.forEach((c) => {
      if (c.bank) set.add(c.bank);
    });
    return Array.from(set);
  }, [cardMovements, cards]);

  // Lista de meses de competência presentes
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    cardMovements.forEach((m) => {
      if (m.dueDate) {
        const d = new Date(m.dueDate + 'T12:00:00');
        const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        set.add(label);
      }
    });
    return Array.from(set);
  }, [cardMovements]);

  // Cálculos de KPIs Globais
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthPrefix = todayStr.substring(0, 7);

  const kpis = useMemo(() => {
    let openCurrentMonth = 0;
    let openFuture = 0;
    let totalUnanalyzed = 0;
    let totalReconciled = 0;
    let totalRealized = 0;

    cardMovements.forEach((m) => {
      const isPaid = m.status === 'REALIZADA';
      if (isPaid) {
        totalRealized += m.amount;
      } else {
        if (m.dueDate.startsWith(currentMonthPrefix)) {
          openCurrentMonth += m.amount;
        } else if (m.dueDate > todayStr) {
          openFuture += m.amount;
        } else {
          openCurrentMonth += m.amount;
        }
      }

      // Cálculo de analisado vs não analisado
      const breakdown = m.invoiceBreakdown || [];
      const allocatedAmount = breakdown.reduce((acc, item) => acc + item.amount, 0);

      if (breakdown.length === 0) {
        if (m.category === 'Não Analisada' || !m.category) {
          totalUnanalyzed += m.amount;
        } else {
          // Se tiver uma natureza fixa atribuída
          totalReconciled += m.amount;
        }
      } else {
        const unallocated = Math.max(0, m.amount - allocatedAmount);
        totalUnanalyzed += unallocated;
        totalReconciled += allocatedAmount;
      }
    });

    return {
      openCurrentMonth,
      openFuture,
      totalUnanalyzed,
      totalReconciled,
      totalRealized,
      totalCards: cards.length,
    };
  }, [cardMovements, currentMonthPrefix, todayStr, cards.length]);

  // Filtragem dos movimentos
  const filteredInvoices = useMemo(() => {
    return cardMovements.filter((m) => {
      // Busca
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(query);
        const matchBank = (m.bank || '').toLowerCase().includes(query);
        const matchNotes = (m.notes || '').toLowerCase().includes(query);
        const matchItems = (m.invoiceBreakdown || []).some(
          (i) => i.description.toLowerCase().includes(query) || i.natureName.toLowerCase().includes(query)
        );
        if (!matchTitle && !matchBank && !matchNotes && !matchItems) return false;
      }

      // Banco
      if (selectedBankFilter !== 'ALL' && m.bank !== selectedBankFilter) {
        return false;
      }

      // Status
      if (selectedStatusFilter !== 'ALL' && m.status !== selectedStatusFilter) {
        return false;
      }

      // Mês
      if (selectedMonthFilter !== 'ALL') {
        const d = new Date(m.dueDate + 'T12:00:00');
        const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        if (label !== selectedMonthFilter) return false;
      }

      // Detalhamento / Conciliação
      if (selectedConciliationFilter !== 'ALL') {
        const breakdown = m.invoiceBreakdown || [];
        const allocated = breakdown.reduce((acc, i) => acc + i.amount, 0);
        const isFullyReconciled = breakdown.length > 0 && Math.abs(m.amount - allocated) < 0.01;
        const isPartial = breakdown.length > 0 && allocated < m.amount;
        const isUnanalyzed = breakdown.length === 0 || m.category === 'Não Analisada';

        if (selectedConciliationFilter === 'RECONCILED' && !isFullyReconciled) return false;
        if (selectedConciliationFilter === 'PARTIAL' && !isPartial) return false;
        if (selectedConciliationFilter === 'UNANALYZED' && !isUnanalyzed) return false;
      }

      return true;
    });
  }, [
    cardMovements,
    searchTerm,
    selectedBankFilter,
    selectedStatusFilter,
    selectedMonthFilter,
    selectedConciliationFilter,
  ]);

  // Alterna expansão de fatura
  const toggleExpand = (id: string) => {
    setExpandedInvoices((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Helper para formatar moeda
  const fmtBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Classificar restante como Outros diretamente
  const handleQuickAllocateRemainingAsOutros = (m: Movement) => {
    const currentBreakdown = m.invoiceBreakdown || [];
    const currentAllocated = currentBreakdown.reduce((acc, i) => acc + i.amount, 0);
    const diff = Math.max(0, m.amount - currentAllocated);

    if (diff <= 0.01) return;

    const newRow: InvoiceNatureItemBreakdown = {
      id: `breakdown_outros_${Date.now()}`,
      natureId: 'OUTROS',
      natureName: 'Outros',
      description: 'Despesas diversas avulsas (Outros)',
      amount: Math.round(diff * 100) / 100,
      isAnalyzed: true,
    };

    const updatedBreakdown = [...currentBreakdown, newRow];
    updateMovement(m.id, {
      invoiceBreakdown: updatedBreakdown,
      unanalyzedAmount: 0,
      category: 'Fatura de Cartão',
    });
  };

  // Adicionar item inline ao detalhamento da fatura
  const handleAddInlineItem = (m: Movement) => {
    const natureId = inlineItemNature[m.id] || (natures[0]?.id ?? 'OUTROS');
    const desc = (inlineItemDesc[m.id] || '').trim();
    const rawAmount = inlineItemAmount[m.id] || '';

    let parsedAmount = 0;
    const clean = rawAmount.replace(/[R$\s]/g, '').trim();
    if (clean.includes('.') && clean.includes(',')) {
      parsedAmount = parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
    } else if (clean.includes(',')) {
      parsedAmount = parseFloat(clean.replace(',', '.')) || 0;
    } else {
      parsedAmount = parseFloat(clean) || 0;
    }

    if (parsedAmount <= 0) return;

    const natObj = natures.find((n) => n.id === natureId);
    const natureName = natureId === 'OUTROS' ? 'Outros' : natObj?.name || 'Natureza';

    const currentBreakdown = m.invoiceBreakdown || [];
    const newRow: InvoiceNatureItemBreakdown = {
      id: `breakdown_${Date.now()}`,
      natureId,
      natureName,
      description: desc || (natureId === 'OUTROS' ? 'Gasto avulso' : `Item ${natureName}`),
      amount: Math.round(parsedAmount * 100) / 100,
      isAnalyzed: true,
    };

    const updatedBreakdown = [...currentBreakdown, newRow];
    const totalAllocated = updatedBreakdown.reduce((acc, i) => acc + i.amount, 0);
    const unanalyzed = Math.max(0, m.amount - totalAllocated);

    updateMovement(m.id, {
      invoiceBreakdown: updatedBreakdown,
      unanalyzedAmount: unanalyzed,
      category: unanalyzed > 0.01 ? 'Não Analisada' : 'Fatura de Cartão',
    });

    // Limpar campos inline
    setInlineItemDesc((prev) => ({ ...prev, [m.id]: '' }));
    setInlineItemAmount((prev) => ({ ...prev, [m.id]: '' }));
  };

  // Excluir item do detalhamento
  const handleDeleteBreakdownItem = (m: Movement, itemId: string) => {
    const currentBreakdown = m.invoiceBreakdown || [];
    const updatedBreakdown = currentBreakdown.filter((i) => i.id !== itemId);
    const totalAllocated = updatedBreakdown.reduce((acc, i) => acc + i.amount, 0);
    const unanalyzed = Math.max(0, m.amount - totalAllocated);

    updateMovement(m.id, {
      invoiceBreakdown: updatedBreakdown,
      unanalyzedAmount: unanalyzed,
      category: unanalyzed > 0.01 ? 'Não Analisada' : 'Fatura de Cartão',
    });
  };

  // Marcar fatura como realizada / paga
  const handleToggleInvoiceStatus = (m: Movement) => {
    const nextStatus: MovementStatus = m.status === 'REALIZADA' ? 'PREVISTA' : 'REALIZADA';
    updateMovement(m.id, {
      status: nextStatus,
      paymentDate: nextStatus === 'REALIZADA' ? todayStr : undefined,
    });
  };

  return (
    <div className="invoices-page-container page-container animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="kicker-badge">
            <CreditCard size={13} className="mr-1" />
            <span>MÓDULO DE FATURAS & CARTÕES</span>
          </div>
          <h1 className="page-title">Gestão & Detalhamento de Faturas</h1>
          <p className="page-subtitle">
            Monitore o valor real de cada fatura, destrinche seus itens entre as naturezas orçamentárias e acompanhe o que resta pendente de análise.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              addMovement({
                title: 'Nova Fatura de Cartão',
                type: 'CARTAO',
                amount: 1500,
                dueDate: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
                bank: cards[0]?.bank || 'Nubank',
                status: 'PREVISTA',
                category: 'Não Analisada',
                notes: 'Fatura cadastrada manualmente para conciliação',
              });
            }}
          >
            <Plus size={16} />
            <span>Adicionar Fatura</span>
          </button>
        </div>
      </div>

      {/* Top KPIs Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-4 flex items-center gap-3 border border-slate-800/80">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-sky-500/10 text-sky-400 font-bold">
            <CreditCard size={22} />
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
              Faturas em Aberto (Mês)
            </span>
            <strong className="text-xl font-black text-[var(--text-primary)]">
              {fmtBRL(kpis.openCurrentMonth)}
            </strong>
            <span className="text-[11px] text-sky-400/80 block mt-0.5">Vencimento próximo</span>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3 border border-slate-800/80">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-400 font-bold">
            <Calendar size={22} />
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
              Faturas Futuras
            </span>
            <strong className="text-xl font-black text-[var(--text-primary)]">
              {fmtBRL(kpis.openFuture)}
            </strong>
            <span className="text-[11px] text-indigo-400/80 block mt-0.5">Parcelamentos a vencer</span>
          </div>
        </div>

        <div
          className={`glass-card p-4 flex items-center gap-3 border transition-all ${
            kpis.totalUnanalyzed > 0
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-emerald-500/30 bg-emerald-500/5'
          }`}
        >
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold ${
              kpis.totalUnanalyzed > 0
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {kpis.totalUnanalyzed > 0 ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
              Pendente de Análise
            </span>
            <strong
              className={`text-xl font-black ${
                kpis.totalUnanalyzed > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {fmtBRL(kpis.totalUnanalyzed)}
            </strong>
            <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
              {kpis.totalUnanalyzed > 0 ? 'Aguardando classificação' : '100% categorizado!'}
            </span>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3 border border-slate-800/80">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400 font-bold">
            <Layers size={22} />
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
              Alocado em Naturezas
            </span>
            <strong className="text-xl font-black text-[var(--text-primary)]">
              {fmtBRL(kpis.totalReconciled)}
            </strong>
            <span className="text-[11px] text-emerald-400/80 block mt-0.5">Abatendo dos tetos</span>
          </div>
        </div>
      </div>

      {/* Notice box about Credit Card Logic */}
      <div className="glass-card p-4 mb-6 flex items-start gap-3 border border-indigo-900/40 bg-indigo-950/20 rounded-xl">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles size={16} />
        </div>
        <div className="text-xs leading-relaxed text-slate-300 flex-1">
          <strong className="text-indigo-300 block font-semibold mb-0.5">
            Regra de Competência e Vencimento de Cartão de Crédito
          </strong>
          Os gastos efetuados no mês atual (ex: Setembro) têm sua fatura fechada com vencimento no mês seguinte (ex: Outubro). Ao destrinchar os itens nas Naturezas, os valores abatem diretamente as metas e tetos orçamentários do Balder. O saldo não distribuído é mantido como <strong>Não Analisada</strong> até que você decida alocá-lo ou transferi-lo para <strong>Outros</strong>.
        </div>
      </div>

      {/* Filter Panel */}
      <div className="glass-card p-4 mb-6 border border-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Filtros & Pesquisa
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Mostrando <strong>{filteredInvoices.length}</strong> de {cardMovements.length} faturas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Busca */}
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-900/60 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="Buscar por fatura, banco, item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filtro Banco */}
          <div>
            <select
              className="w-full py-2 px-3 text-xs rounded-lg bg-slate-900/60 border border-slate-700/80 text-white focus:outline-none focus:border-indigo-500"
              value={selectedBankFilter}
              onChange={(e) => setSelectedBankFilter(e.target.value)}
            >
              <option value="ALL">Todos os Bancos / Emissores</option>
              {availableBanks.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Mês */}
          <div>
            <select
              className="w-full py-2 px-3 text-xs rounded-lg bg-slate-900/60 border border-slate-700/80 text-white focus:outline-none focus:border-indigo-500"
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
            >
              <option value="ALL">Todas as Competências</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Status */}
          <div>
            <select
              className="w-full py-2 px-3 text-xs rounded-lg bg-slate-900/60 border border-slate-700/80 text-white focus:outline-none focus:border-indigo-500"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
            >
              <option value="ALL">Todos os Status</option>
              <option value="PREVISTA">Em Aberto / Prevista</option>
              <option value="REALIZADA">Paga / Realizada</option>
            </select>
          </div>

          {/* Filtro Conciliação */}
          <div>
            <select
              className="w-full py-2 px-3 text-xs rounded-lg bg-slate-900/60 border border-slate-700/80 text-white focus:outline-none focus:border-indigo-500"
              value={selectedConciliationFilter}
              onChange={(e) => setSelectedConciliationFilter(e.target.value as any)}
            >
              <option value="ALL">Todas as Situações</option>
              <option value="RECONCILED">100% Conciliada</option>
              <option value="PARTIAL">Parcialmente Detalhada</option>
              <option value="UNANALYZED">Não Analisada</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Faturas */}
      {filteredInvoices.length === 0 ? (
        <div className="glass-card p-12 text-center border border-slate-800/80 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-slate-800/60 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <CreditCard size={32} />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Nenhuma fatura de cartão encontrada</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Não encontramos faturas correspondentes aos filtros selecionados. Você pode adicionar uma nova fatura ou redefinir seus filtros.
          </p>
          <button
            className="btn btn-secondary text-xs"
            onClick={() => {
              setSearchTerm('');
              setSelectedBankFilter('ALL');
              setSelectedStatusFilter('ALL');
              setSelectedMonthFilter('ALL');
              setSelectedConciliationFilter('ALL');
            }}
          >
            Limpar Filtros
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInvoices.map((m) => {
            const breakdown = m.invoiceBreakdown || [];
            const isExpanded = !!expandedInvoices[m.id];
            const isPaid = m.status === 'REALIZADA';

            // Cálculos da Composição
            const natureItems = breakdown.filter((i) => i.natureId !== 'OUTROS');
            const outrosItems = breakdown.filter((i) => i.natureId === 'OUTROS');

            const natureAllocated = natureItems.reduce((acc, i) => acc + i.amount, 0);
            const outrosAllocated = outrosItems.reduce((acc, i) => acc + i.amount, 0);
            const totalAllocated = natureAllocated + outrosAllocated;

            const unallocated = Math.max(0, m.amount - totalAllocated);

            const naturePct = m.amount > 0 ? (natureAllocated / m.amount) * 100 : 0;
            const outrosPct = m.amount > 0 ? (outrosAllocated / m.amount) * 100 : 0;
            const unallocatedPct = m.amount > 0 ? (unallocated / m.amount) * 100 : 0;

            const isFullyReconciled = breakdown.length > 0 && unallocated <= 0.01;
            const isPartiallyReconciled = breakdown.length > 0 && unallocated > 0.01;

            // Formatação de data
            const dueDateObj = new Date(m.dueDate + 'T12:00:00');
            const dueDateFormatted = dueDateObj.toLocaleDateString('pt-BR');
            const monthName = dueDateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

            return (
              <div
                key={m.id}
                className="glass-card border border-slate-800/80 rounded-2xl overflow-hidden hover:border-slate-700/80 transition-all shadow-lg"
              >
                {/* Header da Fatura */}
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 font-bold shrink-0">
                      <CreditCard size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold text-indigo-300 uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                          {m.bank || 'Cartão'}
                        </span>
                        {m.installmentNumber && (
                          <span className="text-xs font-semibold text-slate-300 px-2 py-0.5 rounded-full bg-slate-800">
                            Parcela {m.installmentNumber}/{m.installmentsTotal || 10}
                          </span>
                        )}
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                            isPaid
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                          }`}
                        >
                          {isPaid ? 'REALIZADA (PAGA)' : 'PREVISTA NO FLUXO'}
                        </span>

                        {isFullyReconciled ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            100% Conciliada
                          </span>
                        ) : isPartiallyReconciled ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            Parcial ({fmtBRL(unallocated)} pendente)
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            Não Analisada
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-white">{m.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Vencimento: <strong className="text-slate-200">{dueDateFormatted}</strong> ({monthName}) • Competência:{' '}
                        <span className="text-slate-300">Gastos do mês anterior</span>
                      </p>
                    </div>
                  </div>

                  {/* Valor e Ações Rápidas do Header */}
                  <div className="flex items-center gap-4 self-end md:self-center">
                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                        Valor da Fatura
                      </span>
                      <strong className="text-2xl font-black text-white">
                        {fmtBRL(m.amount)}
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="btn btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
                        onClick={() => setSelectedMovementForModal(m)}
                        title="Abrir pop-up detalhado de conciliação"
                      >
                        <ArrowUpRight size={14} />
                        <span>Abrir Pop-up</span>
                      </button>

                      <button
                        className={`p-2 rounded-lg border transition-all ${
                          isPaid
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40'
                        }`}
                        onClick={() => handleToggleInvoiceStatus(m)}
                        title={isPaid ? 'Marcar como prevista' : 'Marcar como paga / realizada'}
                      >
                        <Check size={16} />
                      </button>

                      <button
                        className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white"
                        onClick={() => toggleExpand(m.id)}
                        title={isExpanded ? 'Recolher detalhes' : 'Expandir itens e naturezas'}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Barra de Progresso Visual da Composição */}
                <div className="px-5 py-3 border-t border-b border-slate-800/60 bg-slate-950/40">
                  <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                        Naturezas: <strong>{fmtBRL(natureAllocated)}</strong> ({naturePct.toFixed(0)}%)
                      </span>
                      <span className="flex items-center gap-1.5 text-sky-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                        Outros: <strong>{fmtBRL(outrosAllocated)}</strong> ({outrosPct.toFixed(0)}%)
                      </span>
                      {unallocated > 0.01 && (
                        <span className="flex items-center gap-1.5 text-amber-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                          Não Analisada: <strong>{fmtBRL(unallocated)}</strong> ({unallocatedPct.toFixed(0)}%)
                        </span>
                      )}
                    </div>

                    {unallocated > 0.01 && (
                      <button
                        className="text-[11px] font-bold text-sky-400 hover:text-sky-300 underline underline-offset-2 flex items-center gap-1"
                        onClick={() => handleQuickAllocateRemainingAsOutros(m)}
                      >
                        <span>Classificar restante ({fmtBRL(unallocated)}) como Outros</span>
                      </button>
                    )}
                  </div>

                  {/* Visual Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${naturePct}%` }}
                      title={`Naturezas: ${fmtBRL(natureAllocated)}`}
                    />
                    <div
                      className="h-full bg-sky-500 transition-all duration-300"
                      style={{ width: `${outrosPct}%` }}
                      title={`Outros: ${fmtBRL(outrosAllocated)}`}
                    />
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${unallocatedPct}%` }}
                      title={`Não Analisada: ${fmtBRL(unallocated)}`}
                    />
                  </div>
                </div>

                {/* Conteúdo Expandido (Lista de Itens e Inclusão Rápida) */}
                {isExpanded && (
                  <div className="p-5 bg-slate-950/20 animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <Tag size={13} className="text-indigo-400" />
                        Itens Detalhados da Fatura ({breakdown.length})
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        Cada item abatido alimenta a execução orçamentária do Balder
                      </span>
                    </div>

                    {breakdown.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center bg-slate-900/20 mb-4">
                        <p className="text-xs text-slate-400 mb-2">
                          Esta fatura ainda não possui itens detalhados. O valor integral de{' '}
                          <strong className="text-amber-400">{fmtBRL(m.amount)}</strong> consta como{' '}
                          <strong>Não Analisada</strong>.
                        </p>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="btn btn-secondary text-xs"
                            onClick={() => setSelectedMovementForModal(m)}
                          >
                            <ArrowUpRight size={13} className="mr-1" />
                            Detalhar no Pop-up
                          </button>
                          <button
                            className="btn btn-primary text-xs"
                            onClick={() => handleQuickAllocateRemainingAsOutros(m)}
                          >
                            Classificar Tudo como Outros
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto mb-4">
                        <table className="w-full text-xs text-left">
                          <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-900/30">
                            <tr>
                              <th className="py-2.5 px-3">Natureza</th>
                              <th className="py-2.5 px-3">Descrição do Item</th>
                              <th className="py-2.5 px-3 text-right">Valor (R$)</th>
                              <th className="py-2.5 px-3 text-right">% da Fatura</th>
                              <th className="py-2.5 px-3 text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {breakdown.map((item) => {
                              const itemPct = m.amount > 0 ? (item.amount / m.amount) * 100 : 0;
                              const isOutros = item.natureId === 'OUTROS';
                              return (
                                <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] ${
                                        isOutros
                                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                      }`}
                                    >
                                      {item.natureName}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-white font-medium">
                                    {item.description}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                                    {fmtBRL(item.amount)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-slate-400">
                                    {itemPct.toFixed(1)}%
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <button
                                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                      onClick={() => handleDeleteBreakdownItem(m, item.id)}
                                      title="Remover item do detalhamento"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Inline Form para adicionar item */}
                    <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <div className="w-full sm:w-48 shrink-0">
                        <select
                          className="w-full py-1.5 px-2.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                          value={inlineItemNature[m.id] || (natures[0]?.id ?? 'OUTROS')}
                          onChange={(e) =>
                            setInlineItemNature((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                        >
                          <option value="OUTROS">Outros (Despesas Gerais)</option>
                          {natures.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex-1">
                        <input
                          type="text"
                          className="w-full py-1.5 px-3 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          placeholder="Descrição do item ou gasto..."
                          value={inlineItemDesc[m.id] || ''}
                          onChange={(e) =>
                            setInlineItemDesc((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                        />
                      </div>

                      <div className="w-full sm:w-32 shrink-0">
                        <input
                          type="text"
                          className="w-full py-1.5 px-3 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-bold"
                          placeholder={unallocated > 0 ? `R$ ${unallocated.toFixed(2)}` : 'R$ 0,00'}
                          value={inlineItemAmount[m.id] || ''}
                          onChange={(e) =>
                            setInlineItemAmount((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                        />
                      </div>

                      <button
                        className="btn btn-primary text-xs py-1.5 px-3 shrink-0 flex items-center justify-center gap-1"
                        onClick={() => handleAddInlineItem(m)}
                      >
                        <Plus size={14} />
                        <span>Adicionar Item</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Detalhamento Pop-up (MovementDetailModal) */}
      {selectedMovementForModal && (
        <MovementDetailModal
          isOpen={!!selectedMovementForModal}
          onClose={() => setSelectedMovementForModal(null)}
          movement={selectedMovementForModal}
        />
      )}
    </div>
  );
};
