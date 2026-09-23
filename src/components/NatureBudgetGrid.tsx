import React, { useState, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import {
  Layers,
  Search,
  Clock,
  ExternalLink,
  Edit3,
  X,
  AlertTriangle,
  LayoutGrid,
  Table,
} from 'lucide-react';
import type { ExpenseNature, MonthlyGridProjectionRow, MappingItem } from '../types';
import { buildMonthlyProjectionGrid } from '../utils/projectionMath';
import { GridCellDetailModal, generateNatureDateGroups } from './GridCellDetailModal';
import type { GridCellSelection } from './GridCellDetailModal';

interface NatureBudgetRow {
  nature: ExpenseNature;
  natureId: string;
  name: string;
  color: string;
  type: string;
  category: string;
  plannedAmount: number;
  realizedAmount: number;
  diffAmount: number;
  percentUsed: number;
  isOverCeiling: boolean;
  observations: string;
  customNotes?: string;
  lastTransaction: {
    dateFormatted: string;
    description: string;
    amount: number;
    paymentMethod?: string;
    cardName?: string;
  } | null;
  itemsCount: number;
  routinesCount: number;
  hasAttentionPoint: boolean;
  attentionType: 'OVER_CEILING' | 'ATYPICAL' | null;
}

interface NatureBudgetGridProps {
  onNavigateToNatures?: () => void;
}

export const NatureBudgetGrid: React.FC<NatureBudgetGridProps> = ({ onNavigateToNatures }) => {
  const {
    movements,
    natures,
    salaryContracts,
    getNatureCeiling,
    updateNature,
    activeCheckpoint,
    monthlyClosings,
  } = useFinancial();

  // Mês selecionado para acompanhamento (padrão: Set/2026)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('2026-09');
  // Termo de busca rápida para filtrar naturezas
  const [searchTerm, setSearchTerm] = useState<string>('');
  // Filtro de status: ALL, OVER (Acima do teto), WITHIN (Dentro do teto)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVER' | 'WITHIN'>('ALL');
  // Modo de exibição: CARDS (padrão otimizado) ou TABLE
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  // Estado para abrir modal de edição de observação da natureza
  const [editingNatureId, setEditingNatureId] = useState<string | null>(null);
  const [editingObservationText, setEditingObservationText] = useState<string>('');

  // Estado para abertura do modal de detalhamento da célula/natureza
  const [cellSelection, setCellSelection] = useState<GridCellSelection | null>(null);

  const initialBalance = activeCheckpoint ? activeCheckpoint.initialBalance : 0;

  // Projeção financeira completa para recuperar os totais da competência selecionada
  const allRows: MonthlyGridProjectionRow[] = useMemo(() => {
    return buildMonthlyProjectionGrid(
      movements,
      natures,
      initialBalance,
      salaryContracts,
      monthlyClosings
    );
  }, [movements, natures, initialBalance, salaryContracts, monthlyClosings]);

  // Lista de competências disponíveis
  const availableMonths = useMemo(() => {
    return allRows.map((r) => ({
      key: r.monthKey,
      label: r.competenceLabel,
      formatted: r.formattedCompetence,
    }));
  }, [allRows]);

  const currentRow = useMemo(() => {
    return allRows.find((r) => r.monthKey === selectedMonthKey) || allRows[0];
  }, [allRows, selectedMonthKey]);

  // Formatação monetária
  const formatBRL = (val?: number) => {
    if (val === undefined || val === null) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Processamento e cálculo de cada linha do Grid de Naturezas
  const natureRows: NatureBudgetRow[] = useMemo(() => {
    if (!currentRow) return [];

    return natures.map((nat) => {
      // 1. Previsto (Teto orçado mensal da natureza)
      const planned = getNatureCeiling(nat);

      // 2. Realizado: apurado via movimentos reais ou mapeamentos ativos no ciclo
      const matchingMovements = movements.filter((m) => {
        const isExpense = m.type === 'PAGAR' || m.type === 'CARTAO';
        const inMonth = m.dueDate.startsWith(selectedMonthKey);
        const nameMatch = m.category.toLowerCase() === nat.name.toLowerCase();
        const itemMatch = nat.mappings.some((mp) =>
          mp.items.some((it) => it.description.toLowerCase() === m.title.toLowerCase())
        );
        return isExpense && inMonth && (nameMatch || itemMatch);
      });

      // Mapeamentos ativos
      const natItems: Array<{
        natureName: string;
        natureColor: string;
        mappingName: string;
        item: MappingItem;
      }> = [];

      nat.mappings.forEach((m) => {
        m.items.forEach((it) => {
          natItems.push({
            natureName: nat.name,
            natureColor: nat.color,
            mappingName: m.name,
            item: it,
          });
        });
      });

      const mappedSum = natItems.reduce((acc, ni) => {
        const val =
          ni.item.totalValue ||
          (ni.item.quantity || 1) * (ni.item.price || 0) * (ni.item.multiplierWeeks || 1);
        return acc + val;
      }, 0);

      const realized =
        matchingMovements.length > 0
          ? matchingMovements.reduce((acc, m) => acc + m.amount, 0)
          : mappedSum;

      // 3. Diferença e Aderência
      const diff = planned - realized;
      const pct = planned > 0 ? Math.round((realized / planned) * 100) : (realized > 0 ? 100 : 0);
      const isOver = realized > planned && planned > 0;

      // 4. Última Transação
      let lastTx: NatureBudgetRow['lastTransaction'] = null;

      if (matchingMovements.length > 0) {
        // Ordenar movimentos por data decrescente
        const sortedMovements = [...matchingMovements].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
        const latestM = sortedMovements[0];
        const dParts = latestM.dueDate.split('-');
        const dateFormatted = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}/${dParts[0]}` : latestM.dueDate;

        lastTx = {
          dateFormatted,
          description: latestM.title,
          amount: latestM.amount,
          paymentMethod: latestM.type === 'CARTAO' ? 'Cartão' : 'Conta',
          cardName: latestM.bank,
        };
      } else if (natItems.length > 0) {
        // Gerar grupos de datas da natureza
        const dateGroups = generateNatureDateGroups(currentRow.monthKey, nat.name, natItems);
        if (dateGroups.length > 0) {
          const sortedDgs = [...dateGroups].sort((a, b) => b.dateStr.localeCompare(a.dateStr));
          const latestDg = sortedDgs[0];
          const latestSub = latestDg.items[0] || null;

          lastTx = {
            dateFormatted: latestDg.dateFormatted.split(' ')[0], // pega só DD/MM/AAAA
            description: latestSub ? latestSub.description : latestDg.eventTitle,
            amount: latestSub ? latestSub.totalValue : latestDg.subtotal,
            paymentMethod: latestSub?.paymentMethod === 'CARTAO' ? 'Cartão' : 'Conta',
            cardName: latestSub?.cardName,
          };
        }
      }

      // 5. Identificação de Imprevistos e Gastos Atípicos (Ofensores)
      const ATYPICAL_KEYWORD_REGEX =
        /\b(avulso|avulsa|avulsos|avulsas|não-recorrente|nao-recorrente|não recorrente|nao recorrente|imprevisto|imprevista|imprevistos|imprevistas|pontual|pontuais|atípico|atipico|atípica|atipica|atípicos|atipicos|extra|extras|emergência|emergencia|excepcional|anomalia)\b/i;

      interface AnalyzedExpense {
        name: string;
        amount: number;
        isAtypical: boolean;
      }

      const allExpenses: AnalyzedExpense[] = [];

      if (matchingMovements.length > 0) {
        matchingMovements.forEach((m) => {
          const textToScan = `${m.title || ''} ${m.notes || ''} ${m.category || ''}`;
          const hasAtypicalKeyword = ATYPICAL_KEYWORD_REGEX.test(textToScan);

          // Verifica se o título do movimento corresponde a algum item da rotina fixa recorrente
          const isRecognizedRoutineItem = nat.mappings.some((mp) =>
            mp.frequency !== 'PONTUAL' &&
            mp.items.some((it) => it.description.trim().toLowerCase() === m.title.trim().toLowerCase())
          );

          const isAtypical = hasAtypicalKeyword || !isRecognizedRoutineItem;
          allExpenses.push({
            name: m.title,
            amount: m.amount,
            isAtypical,
          });
        });
      } else if (natItems.length > 0) {
        nat.mappings.forEach((mp) => {
          const isMappingPontual =
            mp.frequency === 'PONTUAL' || ATYPICAL_KEYWORD_REGEX.test(mp.name);
          mp.items.forEach((it) => {
            const itemVal =
              it.totalValue ||
              (it.quantity || 1) * (it.price || 0) * (it.multiplierWeeks || 1);
            const hasAtypicalKeyword = ATYPICAL_KEYWORD_REGEX.test(it.description);
            const isAtypical = isMappingPontual || hasAtypicalKeyword;
            allExpenses.push({
              name: it.description,
              amount: itemVal,
              isAtypical,
            });
          });
        });
      }

      // Separação dos gastos atípicos ordenados por maior valor
      const atypicalExpenses = allExpenses
        .filter((e) => e.isAtypical && e.amount > 0)
        .sort((a, b) => b.amount - a.amount);

      // Maior despesa geral para caso de estouro sem atípicos explícitos
      const topOverallExpense = [...allExpenses]
        .filter((e) => e.amount > 0)
        .sort((a, b) => b.amount - a.amount)[0];

      // 6. Regra de Negócios para Observações Analíticas
      let autoObservation = '';

      if (isOver) {
        // Se houver estouro de teto (Realizado > Previsto):
        // Identifique e exiba o nome e valor da maior despesa ou da despesa atípica que causou o estouro.
        const primeOffender = atypicalExpenses.length > 0 ? atypicalExpenses[0] : topOverallExpense;
        if (primeOffender) {
          autoObservation = `Excedente impactado por: ${primeOffender.name} (${formatBRL(primeOffender.amount)}).`;
        } else {
          autoObservation = `Excedente impactado por despesas pontuais (${formatBRL(Math.abs(diff))}).`;
        }
      } else if (atypicalExpenses.length > 0) {
        // Se houver gastos atípicos (mas dentro do teto):
        // Exiba um resumo curto dessas anomalias.
        const totalAtypical = atypicalExpenses.reduce((acc, e) => acc + e.amount, 0);
        const topAtypical = atypicalExpenses[0];
        const count = atypicalExpenses.length;

        autoObservation = `Inclui ${count} ${
          count === 1 ? 'gasto atípico' : 'gastos atípicos'
        } somando ${formatBRL(totalAtypical)} (Ex: ${topAtypical.name}).`;
      } else {
        // Se ocorreu tudo exatamente como o previsto (apenas custos fixos/recorrentes normais):
        // Deixe a coluna de observação com traço ("-") para reduzir o ruído visual.
        autoObservation = '-';
      }

      // Justificativa manual personalizada cadastrada pelo usuário na natureza (se existir)
      if (nat.overCeilingJustification && nat.overCeilingJustification.trim()) {
        const customNote = nat.overCeilingJustification.trim();
        if (autoObservation && autoObservation !== '-') {
          autoObservation = `${customNote} • ${autoObservation}`;
        } else {
          autoObservation = customNote;
        }
      }

      const hasAttention = isOver || atypicalExpenses.length > 0;
      const attentionType: 'OVER_CEILING' | 'ATYPICAL' | null = isOver
        ? 'OVER_CEILING'
        : atypicalExpenses.length > 0
        ? 'ATYPICAL'
        : null;

      return {
        nature: nat,
        natureId: nat.id,
        name: nat.name,
        color: nat.color,
        type: nat.type || 'FIXA',
        category: nat.description || 'Gasto Recorrente',
        plannedAmount: planned,
        realizedAmount: realized,
        diffAmount: diff,
        percentUsed: pct,
        isOverCeiling: isOver,
        observations: autoObservation,
        customNotes: nat.overCeilingJustification,
        lastTransaction: lastTx,
        itemsCount: natItems.length,
        routinesCount: nat.mappings.length,
        hasAttentionPoint: hasAttention,
        attentionType,
      };
    });
  }, [currentRow, natures, movements, selectedMonthKey, getNatureCeiling]);

  // Filtragem por busca e por status
  const filteredRows = useMemo(() => {
    return natureRows.filter((r) => {
      // Filtro de texto
      const matchesSearch =
        !searchTerm.trim() ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.observations.toLowerCase().includes(searchTerm.toLowerCase());

      // Filtro de status
      let matchesStatus = true;
      if (statusFilter === 'OVER') matchesStatus = r.isOverCeiling;
      if (statusFilter === 'WITHIN') matchesStatus = !r.isOverCeiling;

      return matchesSearch && matchesStatus;
    });
  }, [natureRows, searchTerm, statusFilter]);

  // Totais consolidados do grid de naturezas
  const summaryTotals = useMemo(() => {
    const totalPlanned = natureRows.reduce((acc, r) => acc + r.plannedAmount, 0);
    const totalRealized = natureRows.reduce((acc, r) => acc + r.realizedAmount, 0);
    const totalDiff = totalPlanned - totalRealized;
    const overCount = natureRows.filter((r) => r.isOverCeiling).length;
    const withinCount = natureRows.length - overCount;
    const avgPct = totalPlanned > 0 ? Math.round((totalRealized / totalPlanned) * 100) : 0;

    return {
      totalPlanned,
      totalRealized,
      totalDiff,
      overCount,
      withinCount,
      avgPct,
    };
  }, [natureRows]);

  // Abrir modal de detalhamento para uma natureza específica
  const handleOpenNatureDetail = (row: NatureBudgetRow) => {
    if (!currentRow) return;
    setCellSelection({
      columnKey: 'creditCard',
      columnTitle: `Faturas & Detalhes — ${row.name}`,
      competenceLabel: currentRow.competenceLabel,
      formattedCompetence: currentRow.formattedCompetence,
      totalValue: row.realizedAmount,
      row: currentRow,
      initialNatureId: row.natureId,
      initialNatureName: row.name,
    });
  };

  // Salvar anotação/observação customizada da natureza
  const handleSaveObservation = () => {
    if (!editingNatureId) return;
    updateNature(editingNatureId, {
      overCeilingJustification: editingObservationText.trim() || undefined,
    });
    setEditingNatureId(null);
    setEditingObservationText('');
  };

  return (
    <div className="nature-budget-grid-container glass-card animate-fade-in">
      {/* Cabeçalho da Seção */}
      <div className="nature-grid-header">
        <div className="nature-grid-title-area">
          <div className="flex items-center gap-2">
            <span className="badge badge-cyan text-xs font-semibold">ORÇAMENTO & NATUREZAS</span>
            <span className="text-xs text-muted">Acompanhamento Mensal</span>
          </div>
          <h2 className="text-lg font-bold flex items-center gap-2 mt-1" style={{ color: 'var(--text-primary)' }}>
            <Layers size={20} className="text-cyan-400" />
            Grid de Naturezas: Previsto vs Realizado
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Compare o teto orçado com as despesas executadas, analise desvios orçamentários e monitore a última transação.
          </p>
        </div>

        {/* Controles: Seletor de Mês e Busca */}
        <div className="nature-grid-controls flex items-center gap-2 flex-wrap">
          {/* Seletor de Competência */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 dark:bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-border/50">
            <Clock size={14} className="text-cyan-400 flex-shrink-0" />
            <span className="text-xs text-muted font-medium">Mês:</span>
            <select
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="nature-month-select text-xs font-semibold bg-transparent border-none outline-none cursor-pointer"
              style={{ color: 'var(--text-primary)' }}
            >
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key} className="bg-slate-900 text-slate-100">
                  {m.label} ({m.formatted})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Status de Teto */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border/50 text-xs" style={{ background: 'var(--bg-app)' }}>
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2 py-1 rounded font-medium transition cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                  : 'text-muted hover:text-primary'
              }`}
            >
              Todas ({natureRows.length})
            </button>
            {summaryTotals.overCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('OVER')}
                className={`px-2 py-1 rounded font-medium transition cursor-pointer ${
                  statusFilter === 'OVER'
                    ? 'bg-rose-500/20 text-rose border border-rose-500/30 font-bold'
                    : 'text-muted hover:text-rose'
                }`}
              >
                ⚠️ Acima ({summaryTotals.overCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => setStatusFilter('WITHIN')}
              className={`px-2 py-1 rounded font-medium transition cursor-pointer ${
                statusFilter === 'WITHIN'
                  ? 'bg-emerald-500/20 text-emerald border border-emerald-500/30 font-bold'
                  : 'text-muted hover:text-emerald'
              }`}
            >
              ✓ No Teto ({summaryTotals.withinCount})
            </button>
          </div>

          {/* Campo de Busca de Natureza */}
          <div className="nature-search-wrap" style={{ width: '180px' }}>
            <Search size={14} className="nature-search-icon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar natureza..."
              className="nature-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="nature-search-clear"
                title="Limpar busca"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Seletor de Modo de Visualização: Cards vs Tabela */}
          <div className="flex items-center p-0.5 rounded-lg border border-border/50 text-xs" style={{ background: 'var(--bg-app)' }}>
            <button
              type="button"
              onClick={() => setViewMode('CARDS')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'CARDS'
                  ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 font-bold'
                  : 'text-muted hover:text-primary'
              }`}
              title="Exibir Naturezas como Cards (Otimizado para Espaço)"
            >
              <LayoutGrid size={13} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'TABLE'
                  ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 font-bold'
                  : 'text-muted hover:text-primary'
              }`}
              title="Exibir Naturezas como Tabela Tradicional"
            >
              <Table size={13} />
              <span>Tabela</span>
            </button>
          </div>

          {/* Atalho para Gerenciar Naturezas */}
          {onNavigateToNatures && (
            <button
              type="button"
              onClick={onNavigateToNatures}
              className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 flex-shrink-0"
              title="Ajustar Tetos e Mapeamentos de Gastos"
            >
              <ExternalLink size={13} />
              <span>Gerenciar Tetos</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Chips de Resumo no Topo */}
      <div className="nature-grid-kpis-bar">
        <div className="nature-kpi-chip">
          <span className="nature-kpi-chip-label">Teto Previsto Total:</span>
          <span className="nature-kpi-chip-val font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
            {formatBRL(summaryTotals.totalPlanned)}
          </span>
        </div>
        <div className="nature-kpi-chip">
          <span className="nature-kpi-chip-label">Realizado Total:</span>
          <span className="nature-kpi-chip-val font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
            {formatBRL(summaryTotals.totalRealized)}
          </span>
        </div>
        <div className="nature-kpi-chip">
          <span className="nature-kpi-chip-label">
            {summaryTotals.totalDiff >= 0 ? 'Saldo Restante:' : 'Estouro Global:'}
          </span>
          <span
            className={`nature-kpi-chip-val font-mono font-bold ${
              summaryTotals.totalDiff >= 0 ? 'text-emerald' : 'text-rose'
            }`}
          >
            {summaryTotals.totalDiff >= 0 ? `+${formatBRL(summaryTotals.totalDiff)}` : `-${formatBRL(Math.abs(summaryTotals.totalDiff))}`}
          </span>
        </div>
        <div className="nature-kpi-chip">
          <span className="nature-kpi-chip-label">Aderência:</span>
          <span
            className={`nature-kpi-chip-val font-mono font-bold ${
              summaryTotals.avgPct > 100 ? 'text-rose' : 'text-emerald'
            }`}
          >
            {summaryTotals.avgPct}%
          </span>
          <div className="w-10 bg-slate-700/50 rounded-full h-1.5 overflow-hidden ml-1">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                summaryTotals.avgPct > 100 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(summaryTotals.avgPct, 100)}%` }}
            />
          </div>
        </div>
        <div className="nature-kpi-chip">
          <span className="nature-kpi-chip-label">Conformidade:</span>
          <span className="nature-kpi-chip-val font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
            {summaryTotals.withinCount} de {natureRows.length} no teto
          </span>
        </div>
      </div>

      {viewMode === 'TABLE' ? (
        /* Visualização em Tabela Tradicional */
        <div className="nature-table-wrapper">
          <table className="nature-budget-table">
          <thead>
            <tr>
              <th style={{ width: '22%', minWidth: '190px' }}>Natureza</th>
              <th style={{ width: '13%', minWidth: '110px', textAlign: 'right' }}>Previsto (R$)</th>
              <th style={{ width: '13%', minWidth: '110px', textAlign: 'right' }}>Realizado (R$)</th>
              <th style={{ width: '16%', minWidth: '130px', textAlign: 'right' }}>Diferença</th>
              <th style={{ width: '22%', minWidth: '220px' }}>Observações</th>
              <th style={{ width: '14%', minWidth: '160px', textAlign: 'right' }}>Última transação</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr
                key={row.natureId}
                className={`nature-table-row cursor-pointer ${
                  row.hasAttentionPoint
                    ? row.attentionType === 'OVER_CEILING'
                      ? 'row-attention-rose'
                      : 'row-attention-amber'
                    : ''
                }`}
                onClick={() => handleOpenNatureDetail(row)}
                title="Clique para ver o detalhamento completo dos lançamentos desta natureza"
              >
                {/* Coluna 1: Natureza */}
                <td>
                  <div className="flex items-center gap-2.5">
                    <div
                      className="nature-color-dot flex-shrink-0"
                      style={{
                        backgroundColor: row.color || '#38BDF8',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        boxShadow: `0 0 6px ${row.color || '#38BDF8'}66`,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong
                          className="text-xs font-bold truncate max-w-[170px]"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {row.name}
                        </strong>
                        <span className="badge badge-pill text-[9px] uppercase tracking-wider flex-shrink-0">
                          {row.type}
                        </span>
                        {row.hasAttentionPoint && (
                          <span
                            className={`nature-attention-badge ${
                              row.attentionType === 'OVER_CEILING' ? 'rose' : 'amber'
                            }`}
                            title={
                              row.attentionType === 'OVER_CEILING'
                                ? 'Ponto de Atenção: Teto orçado excedido!'
                                : 'Ponto de Atenção: Gasto atípico identificado!'
                            }
                          >
                            <AlertTriangle size={10} className="flex-shrink-0" />
                            {row.attentionType === 'OVER_CEILING' ? 'Atenção: Teto' : 'Atenção: Atípico'}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted block truncate max-w-[190px]">
                        {row.routinesCount} rotinas • {row.itemsCount} itens
                      </span>
                    </div>
                  </div>
                </td>

                {/* Coluna 2: Previsto (R$) */}
                <td style={{ textAlign: 'right' }}>
                  <div className="font-mono font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
                    {formatBRL(row.plannedAmount)}
                  </div>
                  <span className="text-[10px] text-muted block">Teto mensal</span>
                </td>

                {/* Coluna 3: Realizado (R$) */}
                <td style={{ textAlign: 'right' }}>
                  <div className="font-mono font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
                    {formatBRL(row.realizedAmount)}
                  </div>
                  <span className="text-[10px] text-muted block">
                    {row.realizedAmount > 0 ? `${row.percentUsed}% gasto` : 'Sem gastos'}
                  </span>
                </td>

                {/* Coluna 4: Diferença */}
                <td style={{ textAlign: 'right' }}>
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-mono font-bold text-xs ${
                        row.diffAmount >= 0 ? 'text-emerald' : 'text-rose'
                      }`}
                    >
                      {row.diffAmount >= 0
                        ? `+${formatBRL(row.diffAmount)}`
                        : `-${formatBRL(Math.abs(row.diffAmount))}`}
                    </span>
                    <span
                      className={`text-[10px] font-semibold mt-0.5 px-1.5 py-0.2 rounded inline-block ${
                        row.isOverCeiling
                          ? 'bg-rose-500/15 text-rose'
                          : 'bg-emerald-500/15 text-emerald'
                      }`}
                    >
                      {row.isOverCeiling ? '⚠️ Acima do Teto' : '✓ Dentro do Teto'}
                    </span>
                  </div>
                </td>

                {/* Coluna 5: Observações (Insights acionáveis sobre gastos atípicos ou ofensores) */}
                <td>
                  <div className="flex items-start justify-between gap-2 group/obs">
                    {row.hasAttentionPoint && row.observations !== '-' ? (
                      <div
                        className={`obs-attention-chip ${
                          row.attentionType === 'OVER_CEILING' ? 'rose' : 'amber'
                        }`}
                        title={row.observations}
                      >
                        <div className="obs-attention-chip-header">
                          <AlertTriangle size={11} className="flex-shrink-0" />
                          <span className="obs-attention-chip-label">
                            {row.attentionType === 'OVER_CEILING'
                              ? 'Ponto de Atenção • Estouro'
                              : 'Ponto de Atenção • Atípico'}
                          </span>
                        </div>
                        <p className="obs-attention-chip-text">
                          {row.observations}
                        </p>
                      </div>
                    ) : (
                      <p
                        className="text-[11px] leading-relaxed line-clamp-2 text-muted/40 font-mono text-center w-full"
                        style={{ color: 'var(--text-muted)', opacity: 0.35 }}
                      >
                        —
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNatureId(row.natureId);
                        setEditingObservationText(row.customNotes || '');
                      }}
                      className="opacity-0 group-hover/obs:opacity-100 p-1 text-muted hover:text-cyan-400 rounded transition flex-shrink-0 mt-0.5"
                      title="Editar observação personalizada"
                    >
                      <Edit3 size={12} />
                    </button>
                  </div>
                </td>

                {/* Coluna 6: Última transação */}
                <td style={{ textAlign: 'right' }}>
                  {row.lastTransaction ? (
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {row.lastTransaction.dateFormatted}
                        </span>
                        {row.lastTransaction.cardName && (
                          <span className="badge badge-cyan text-[9px] truncate max-w-[80px]">
                            {row.lastTransaction.cardName.split(' ')[0]}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted truncate max-w-[150px] block" title={row.lastTransaction.description}>
                        {row.lastTransaction.description}
                      </span>
                      <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--accent-emerald)' }}>
                        {formatBRL(row.lastTransaction.amount)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted italic">-</span>
                  )}
                </td>
              </tr>
            ))}

            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted text-xs">
                  Nenhuma natureza encontrada para o filtro selecionado.
                </td>
              </tr>
            )}
          </tbody>

          {/* Rodapé com Totais Consolidados */}
          <tfoot>
            <tr className="nature-table-tfoot">
              <th>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                  Total Consolidado ({filteredRows.length} naturezas)
                </span>
              </th>
              <th style={{ textAlign: 'right' }}>
                <span className="font-mono font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
                  {formatBRL(summaryTotals.totalPlanned)}
                </span>
              </th>
              <th style={{ textAlign: 'right' }}>
                <span className="font-mono font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
                  {formatBRL(summaryTotals.totalRealized)}
                </span>
              </th>
              <th style={{ textAlign: 'right' }}>
                <span
                  className={`font-mono font-bold text-xs ${
                    summaryTotals.totalDiff >= 0 ? 'text-emerald' : 'text-rose'
                  }`}
                >
                  {summaryTotals.totalDiff >= 0
                    ? `+${formatBRL(summaryTotals.totalDiff)}`
                    : `-${formatBRL(Math.abs(summaryTotals.totalDiff))}`}
                </span>
              </th>
              <th>
                <span className="text-[11px] font-medium text-muted block">
                  {summaryTotals.overCount > 0
                    ? `${summaryTotals.overCount} naturezas acima do teto estipulado.`
                    : 'Todas as naturezas estão em estrita conformidade orçamentária.'}
                </span>
              </th>
              <th style={{ textAlign: 'right' }}>
                <span className="text-[10px] text-muted">Competência {currentRow?.competenceLabel}</span>
              </th>
            </tr>
          </tfoot>
        </table>
      </div>
      ) : (
        /* Visualização em Cards Otimizada para Espaço (Desktop e Mobile) */
        <div className="nature-cards-grid-view">
          {filteredRows.map((row) => (
            <div
              key={row.natureId}
              className={`nature-card-item ${
                row.hasAttentionPoint
                  ? row.attentionType === 'OVER_CEILING'
                    ? 'card-attention-rose'
                    : 'card-attention-amber'
                  : ''
              }`}
              onClick={() => handleOpenNatureDetail(row)}
              title="Clique para ver os lançamentos desta natureza"
            >
              {/* Header do Card: Nome, Tipo e Status do Teto */}
              <div className="nature-card-header">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="nature-color-dot flex-shrink-0"
                    style={{
                      backgroundColor: row.color || '#38BDF8',
                      width: '11px',
                      height: '11px',
                      borderRadius: '50%',
                      boxShadow: `0 0 6px ${row.color || '#38BDF8'}80`,
                    }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-xs font-bold truncate max-w-[150px]" style={{ color: 'var(--text-primary)' }}>
                        {row.name}
                      </strong>
                      <span className="badge badge-pill text-[9px] uppercase tracking-wider flex-shrink-0">
                        {row.type}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted block">
                      {row.routinesCount} rotinas • {row.itemsCount} itens
                    </span>
                  </div>
                </div>

                {/* Status do Teto e Ação de Editar Nota */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span
                    className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                      row.isOverCeiling
                        ? 'bg-rose-500/20 text-rose border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald border border-emerald-500/30'
                    }`}
                  >
                    {row.isOverCeiling ? '⚠️ Acima' : '✓ No Teto'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingNatureId(row.natureId);
                      setEditingObservationText(row.customNotes || '');
                    }}
                    className="p-1 text-muted hover:text-cyan-400 rounded transition cursor-pointer"
                    title="Editar anotação personalizada"
                  >
                    <Edit3 size={12} />
                  </button>
                </div>
              </div>

              {/* Barra de Progresso Visual de Aderência */}
              <div className="nature-card-progress-wrap mt-2">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-muted font-medium">Consumo do Teto</span>
                  <span className={`font-mono font-bold ${row.isOverCeiling ? 'text-rose' : 'text-emerald'}`}>
                    {row.percentUsed}% gasto
                  </span>
                </div>
                <div className="w-full bg-slate-800/80 dark:bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      row.isOverCeiling
                        ? 'bg-rose-500'
                        : row.percentUsed > 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(row.percentUsed, 100)}%` }}
                  />
                </div>
              </div>

              {/* Grid de 3 Valores Financeiros */}
              <div className="nature-card-metrics-grid mt-2">
                <div className="nature-card-metric-col">
                  <span className="nature-card-metric-label">Previsto</span>
                  <span className="nature-card-metric-val font-mono font-medium text-xs">{formatBRL(row.plannedAmount)}</span>
                </div>
                <div className="nature-card-metric-col">
                  <span className="nature-card-metric-label">Realizado</span>
                  <span className="nature-card-metric-val font-mono font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
                    {formatBRL(row.realizedAmount)}
                  </span>
                </div>
                <div className="nature-card-metric-col text-right">
                  <span className="nature-card-metric-label">Diferença</span>
                  <span
                    className={`nature-card-metric-val font-mono font-bold text-xs ${
                      row.diffAmount >= 0 ? 'text-emerald' : 'text-rose'
                    }`}
                  >
                    {row.diffAmount >= 0 ? `+${formatBRL(row.diffAmount)}` : `-${formatBRL(Math.abs(row.diffAmount))}`}
                  </span>
                </div>
              </div>

              {/* Observações / Ponto de Atenção se houver */}
              {row.hasAttentionPoint && row.observations !== '-' && (
                <div
                  className={`obs-attention-chip mt-2 ${
                    row.attentionType === 'OVER_CEILING' ? 'rose' : 'amber'
                  }`}
                >
                  <div className="obs-attention-chip-header">
                    <AlertTriangle size={11} className="flex-shrink-0" />
                    <span className="obs-attention-chip-label">
                      {row.attentionType === 'OVER_CEILING' ? 'Atenção • Estouro' : 'Atenção • Gasto Atípico'}
                    </span>
                  </div>
                  <p className="obs-attention-chip-text line-clamp-2">{row.observations}</p>
                </div>
              )}

              {/* Rodapé do Card com Última Transação */}
              {row.lastTransaction && (
                <div className="nature-card-footer mt-2 pt-2 border-t border-border/30 flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1 min-w-0 text-muted">
                    <span className="font-mono font-medium text-slate-300 dark:text-slate-300">{row.lastTransaction.dateFormatted}</span>
                    {row.lastTransaction.cardName && (
                      <span className="badge badge-cyan text-[8.5px] px-1 py-0.2">
                        {row.lastTransaction.cardName.split(' ')[0]}
                      </span>
                    )}
                    <span>•</span>
                    <span className="truncate max-w-[95px]">{row.lastTransaction.description}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald flex-shrink-0">
                    {formatBRL(row.lastTransaction.amount)}
                  </span>
                </div>
              )}
            </div>
          ))}

          {filteredRows.length === 0 && (
            <div className="glass-card text-center py-8 text-muted text-xs col-span-full" style={{ width: '100%' }}>
              Nenhuma natureza encontrada para o filtro selecionado.
            </div>
          )}

          {/* Card de Totais Consolidados das Naturezas */}
          {filteredRows.length > 0 && (
            <div className="nature-consolidated-card">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                    Total Consolidado ({filteredRows.length} naturezas)
                  </span>
                  <span className="text-[10px] text-muted">Competência {currentRow?.competenceLabel}</span>
                </div>
                <span className="badge badge-cyan text-[10px] font-bold">{summaryTotals.avgPct}% aderência</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2 text-center">
                <div className="p-1.5 rounded-lg bg-black/10 dark:bg-black/20">
                  <span className="text-[10px] text-muted block uppercase font-semibold">Previsto Total</span>
                  <span className="font-mono font-bold text-xs" style={{ color: 'var(--text-primary)' }}>{formatBRL(summaryTotals.totalPlanned)}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-black/10 dark:bg-black/20">
                  <span className="text-[10px] text-muted block uppercase font-semibold">Realizado Total</span>
                  <span className="font-mono font-bold text-xs" style={{ color: 'var(--text-primary)' }}>{formatBRL(summaryTotals.totalRealized)}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-black/10 dark:bg-black/20">
                  <span className="text-[10px] text-muted block uppercase font-semibold">Saldo / Estouro</span>
                  <span className={`font-mono font-bold text-xs ${summaryTotals.totalDiff >= 0 ? 'text-emerald' : 'text-rose'}`}>
                    {summaryTotals.totalDiff >= 0 ? `+${formatBRL(summaryTotals.totalDiff)}` : `-${formatBRL(Math.abs(summaryTotals.totalDiff))}`}
                  </span>
                </div>
              </div>
              <div className="mt-2 text-center">
                <span className="text-[11px] text-muted">
                  {summaryTotals.overCount > 0
                    ? `⚠️ ${summaryTotals.overCount} naturezas acima do teto estipulado.`
                    : '✓ Todas as naturezas estão em estrita conformidade orçamentária.'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Inline Rápido para Editar Observação */}
      {editingNatureId && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setEditingNatureId(null)}>
          <div
            className="glass-card p-4 rounded-xl max-w-md w-full"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Edit3 size={15} className="text-cyan-400" />
                Anotação / Observação da Natureza
              </h3>
              <button
                type="button"
                onClick={() => setEditingNatureId(null)}
                className="text-muted hover:text-primary cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-muted my-2">
              Insira uma explicação ou justificativa personalizada para os desvios ou particularidades desta categoria:
            </p>
            <textarea
              rows={3}
              value={editingObservationText}
              onChange={(e) => setEditingObservationText(e.target.value)}
              placeholder="Ex: Teto excedido devido a reformas emergenciais ou compras do ciclo..."
              className="w-full p-2.5 rounded-lg text-xs bg-slate-900/60 border border-border/60 text-slate-100 outline-none focus:border-cyan-500 transition"
            />
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setEditingNatureId(null)}
                className="btn btn-secondary text-xs py-1 px-3"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveObservation}
                className="btn btn-primary text-xs py-1 px-3"
              >
                Salvar Observação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhamento da Célula ao Clicar na Linha */}
      <GridCellDetailModal
        isOpen={!!cellSelection}
        onClose={() => setCellSelection(null)}
        selection={cellSelection}
      />
    </div>
  );
};
