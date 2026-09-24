import React, { useState, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { Download, Info, Lock, CheckCircle2, ArrowRight, ChevronDown, ChevronUp, Clock, Layers } from 'lucide-react';
import { buildMonthlyProjectionGrid } from '../utils/projectionMath';
import type { ProjectionViewMode } from '../utils/projectionMath';
import type { MonthlyGridProjectionRow } from '../types';
import { GridCellDetailModal } from './GridCellDetailModal';
import type { GridCellSelection } from './GridCellDetailModal';
import { MonthClosingModal } from './MonthClosingModal';

/**
 * Componente para exibição inteligente de valores numéricos:
 * - Oculta ,00 quando o valor for redondo (ex: R$ 6.706)
 * - Esmaece os centavos quando fracionado (ex: R$ 6.706,53)
 */
export const GlanceableCurrency: React.FC<{
  value?: number;
  prefix?: string;
  isPositivePrefix?: boolean;
  className?: string;
}> = ({ value, prefix = '', isPositivePrefix = false, className = '' }) => {
  if (value === undefined || value === null) {
    return <span className={`font-mono text-muted ${className}`}>-</span>;
  }

  const sign = value < 0 ? '-' : isPositivePrefix && value > 0 ? '+' : '';
  const abs = Math.abs(value);
  const isRound = abs % 1 === 0;

  if (isRound) {
    const formatted = Math.round(abs).toLocaleString('pt-BR');
    return (
      <span className={`font-mono ${className}`}>
        {sign}{prefix}R$ {formatted}
      </span>
    );
  }

  const parts = abs.toFixed(2).split('.');
  const intPart = parseInt(parts[0], 10).toLocaleString('pt-BR');
  const cents = parts[1];

  return (
    <span className={`font-mono ${className}`}>
      {sign}{prefix}R$ {intPart}
      <span className="cents-muted text-[0.85em] opacity-80 font-medium">,{cents}</span>
    </span>
  );
};

export const MonthlyProjectionGrid: React.FC = () => {
  const {
    movements,
    natures,
    salaryContracts,
    activeCheckpoint,
    monthlyClosings,
    closeMonth,
    reopenMonth,
  } = useFinancial();

  const initialBalance = activeCheckpoint ? activeCheckpoint.initialBalance : 0;

  // Modo de visualização da projeção: 'PROJETADO' (Consolidado), 'REALIZADO' (Apenas Realizados), 'PREVISTO' (Apenas Previstos)
  const [viewMode, setViewMode] = useState<ProjectionViewMode>(() => {
    const saved = localStorage.getItem('balder_grid_view_mode');
    if (saved === 'REALIZADO' || saved === 'PREVISTO' || saved === 'PROJETADO') {
      return saved as ProjectionViewMode;
    }
    return 'PROJETADO';
  });

  const handleViewModeChange = (mode: ProjectionViewMode) => {
    setViewMode(mode);
    localStorage.setItem('balder_grid_view_mode', mode);
  };

  // Geração determinística dos dados mês a mês respeitando fechamentos, carryover e o modo ativo
  const allRows: MonthlyGridProjectionRow[] = useMemo(() => {
    return buildMonthlyProjectionGrid(
      movements,
      natures,
      initialBalance,
      salaryContracts,
      monthlyClosings,
      viewMode
    );
  }, [movements, natures, initialBalance, salaryContracts, monthlyClosings, viewMode]);

  // Anos disponíveis na base projetada
  const availableYears = useMemo(() => {
    const setYears = new Set(allRows.map((r) => r.monthKey.slice(0, 4)));
    return Array.from(setYears).sort();
  }, [allRows]);

  // Filtro por Ano: padrão '2026' para garantir máximo de 12 linhas e zero scroll vertical
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  // Mês Atual de referência para ancorar a visão do usuário
  const currentMonthKey = '2026-09';

  // Estado para abertura do pop-up modal de detalhamento da célula clicada
  const [cellSelection, setCellSelection] = useState<GridCellSelection | null>(null);

  // Estado para o modal de fechamento financeiro da competência
  const [closingModalRow, setClosingModalRow] = useState<MonthlyGridProjectionRow | null>(null);

  // Estado para controlar quais competências estão expandidas na visão mobile em cards (recolhidas por padrão)
  const [expandedMonthKeys, setExpandedMonthKeys] = useState<Set<string>>(() => new Set());

  const toggleMonthExpanded = (monthKey: string) => {
    setExpandedMonthKeys((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  };

  const handleToggleAll = () => {
    if (expandedMonthKeys.size > 0) {
      setExpandedMonthKeys(new Set());
    } else {
      setExpandedMonthKeys(new Set(displayedRows.map((r) => r.monthKey)));
    }
  };

  const handleOpenCell = (
    row: MonthlyGridProjectionRow,
    columnKey: GridCellSelection['columnKey'],
    columnTitle: string,
    totalValue: number
  ) => {
    setCellSelection({
      columnKey,
      columnTitle,
      competenceLabel: row.competenceLabel,
      formattedCompetence: row.formattedCompetence,
      totalValue,
      row,
      viewMode,
    });
  };

  // Filtragem estrita por ano (máximo 12 linhas)
  const displayedRows = useMemo(() => {
    if (selectedYear === 'ALL') return allRows;
    return allRows.filter((r) => r.monthKey.startsWith(selectedYear));
  }, [allRows, selectedYear]);

  // Maior resultado absoluto do período para cálculo proporcional do micro-gráfico in-line
  const maxAbsNet = useMemo(() => {
    return Math.max(...displayedRows.map((r) => Math.abs(r.monthNet)), 1);
  }, [displayedRows]);

  // Totais macro consolidados do período filtrado
  const totals = useMemo(() => {
    return displayedRows.reduce(
      (acc, r) => {
        const totalIncome = r.salary + r.extrasTotal + r.loanReceived;
        const totalExpense = r.creditCardTotal + r.fixedCostMapped + r.variableCost + r.loanPayment;
        return {
          totalIncome: acc.totalIncome + totalIncome,
          totalExpense: acc.totalExpense + totalExpense,
          monthNet: acc.monthNet + r.monthNet,
        };
      },
      {
        totalIncome: 0,
        totalExpense: 0,
        monthNet: 0,
      }
    );
  }, [displayedRows]);

  const firstInitialBalance = displayedRows[0]?.initialBalance;
  const lastAccumulatedBalance = displayedRows[displayedRows.length - 1]?.accumulatedBalance || 0;

  // Exportar para CSV (Visão Macro & Glanceable)
  const handleExportCSV = () => {
    const headers = [
      'Competencia',
      'Saldo_Inicial',
      viewMode === 'REALIZADO' ? 'Total_Entradas_Recebidas' : viewMode === 'PREVISTO' ? 'Total_Entradas_Previstas' : 'Total_Entradas_Receitas',
      viewMode === 'REALIZADO' ? 'Total_Saidas_Pagas' : viewMode === 'PREVISTO' ? 'Total_Saidas_Previstas' : 'Total_Saidas_Despesas',
      'Resultado_Mes',
      'Saldo_Acumulado',
    ];

    const csvRows = displayedRows.map((r) => {
      const totalIncome = r.salary + r.extrasTotal + r.loanReceived;
      const totalExpense = r.creditCardTotal + r.fixedCostMapped + r.variableCost + r.loanPayment;
      return [
        r.formattedCompetence,
        r.initialBalance !== undefined ? r.initialBalance.toFixed(2) : '',
        totalIncome.toFixed(2),
        (-totalExpense).toFixed(2),
        r.monthNet.toFixed(2),
        r.accumulatedBalance.toFixed(2),
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(';'), ...csvRows.map((row) => row.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Balder_Fluxo_Macro_${selectedYear}_${viewMode.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="monthly-projection-grid-container glass-card animate-fade-in mt-6">
      {/* Header com Título, Seletor de Modo (Real vs Previsto) & Filtro por Ano */}
      <div className="grid-section-header">
        <div className="grid-header-title-col hide-on-mobile">
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-cyan text-xs">VISÃO GERAL GLANCEABLE</span>
            <span className="text-xs text-muted">Fluxo de Caixa Macro</span>
          </div>
          <h2 className="text-lg font-bold flex items-center gap-2 monthly-projection-heading hide-on-mobile" style={{ color: 'var(--text-primary)' }}>
            <span>Projeção Orçamentária Mês a Mês</span>
            <span className={`text-xs font-normal dre-competence-badge px-2 py-0.5 rounded ${
              viewMode === 'REALIZADO'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : viewMode === 'PREVISTO'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : ''
            }`}>
              {viewMode === 'REALIZADO'
                ? 'DRE Realizada (Valores Reais)'
                : viewMode === 'PREVISTO'
                ? 'DRE Prevista (Planejamento)'
                : 'DRE Sintética (Consolidada)'}
            </span>
          </h2>
          <p className="text-xs text-secondary mt-1 monthly-projection-subtext hide-on-mobile">
            {viewMode === 'REALIZADO'
              ? 'Exibindo estritamente movimentações financeiras já realizadas/efetivadas. Clique nas células para inspecionar os lançamentos quitados.'
              : viewMode === 'PREVISTO'
              ? 'Exibindo projeção de lançamentos e orçamentos previstos a vencer. Clique nas células para inspecionar o planejamento.'
              : 'Visão consolidada sem rolagem. Clique nas células de Entradas ou Saídas para inspecionar o detalhamento completo dos lançamentos.'}
          </p>
        </div>

        <div className="grid-header-actions">
          {/* Seletor de Modo: Realizado vs Previsto vs Projetado */}
          <div className="view-mode-filter-pills" role="group" aria-label="Modo de visualização da projeção">
            <button
              type="button"
              className={`pill-btn ${viewMode === 'PROJETADO' ? 'active mode-projetado' : ''}`}
              onClick={() => handleViewModeChange('PROJETADO')}
              title="Visão Projetada: reúne lançamentos realizados e previsões futuras em um fluxo contínuo"
            >
              <Layers size={13} />
              <span>Projetado</span>
            </button>
            <button
              type="button"
              className={`pill-btn ${viewMode === 'REALIZADO' ? 'active mode-realizado' : ''}`}
              onClick={() => handleViewModeChange('REALIZADO')}
              title="Apenas Valores Reais: filtra estritamente movimentações e receitas efetivadas em caixa"
            >
              <CheckCircle2 size={13} />
              <span>Valores Reais</span>
            </button>
            <button
              type="button"
              className={`pill-btn ${viewMode === 'PREVISTO' ? 'active mode-previsto' : ''}`}
              onClick={() => handleViewModeChange('PREVISTO')}
              title="Apenas Valores Previstos: exibe os lançamentos e despesas planejados a vencer"
            >
              <Clock size={13} />
              <span>Valores Previstos</span>
            </button>
          </div>

          {/* Seletor de Ano em Tabs Compactas */}
          <div className="horizon-filter-pills">
            {availableYears.map((year) => (
              <button
                key={year}
                type="button"
                className={`pill-btn ${selectedYear === year ? 'active' : ''}`}
                onClick={() => setSelectedYear(year)}
              >
                Ano {year}
              </button>
            ))}
            <button
              type="button"
              className={`pill-btn ${selectedYear === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedYear('ALL')}
            >
              Todos ({allRows.length}m)
            </button>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExportCSV}
            title="Exportar dados para planilha CSV"
          >
            <Download size={14} />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* 4 Mini Cards de Indicadores do Grid */}
      <div className="grid-summary-kpis-row mt-3 mb-3">
        <div className="grid-kpi-card">
          <span className="grid-kpi-title">
            {viewMode === 'REALIZADO' ? 'Entradas Realizadas' : viewMode === 'PREVISTO' ? 'Entradas Previstas' : 'Média de Entradas'} ({selectedYear})
          </span>
          <strong className="grid-kpi-num text-emerald">
            <GlanceableCurrency value={displayedRows.length > 0 ? totals.totalIncome / displayedRows.length : 0} />
          </strong>
          <span className="grid-kpi-sub">
            {viewMode === 'REALIZADO' ? 'Salários + Extras já recebidos' : viewMode === 'PREVISTO' ? 'Salários + Extras planejados' : 'Salários + Extras médios'}
          </span>
        </div>

        <div className="grid-kpi-card">
          <span className="grid-kpi-title">
            {viewMode === 'REALIZADO' ? 'Saídas Realizadas' : viewMode === 'PREVISTO' ? 'Saídas Previstas' : 'Média de Saídas'} ({selectedYear})
          </span>
          <strong className="grid-kpi-num text-rose">
            <GlanceableCurrency value={displayedRows.length > 0 ? totals.totalExpense / displayedRows.length : 0} prefix="-" />
          </strong>
          <span className="grid-kpi-sub">
            {viewMode === 'REALIZADO' ? 'Cartões + Fixos + Avulsos pagos' : viewMode === 'PREVISTO' ? 'Teto orçado + Faturas a vencer' : 'Cartões + Fixos + Avulsos'}
          </span>
        </div>

        <div className="grid-kpi-card">
          <span className="grid-kpi-title">
            {viewMode === 'REALIZADO' ? 'Resultado Realizado' : viewMode === 'PREVISTO' ? 'Resultado Previsto' : 'Resultado Líquido do Ciclo'}
          </span>
          <strong className={`grid-kpi-num ${totals.monthNet >= 0 ? 'text-emerald' : 'text-rose'}`}>
            <GlanceableCurrency value={totals.monthNet} isPositivePrefix={true} />
          </strong>
          <span className="grid-kpi-sub">
            {totals.monthNet >= 0
              ? (viewMode === 'REALIZADO' ? 'Superávit efetivado em caixa' : 'Superávit acumulado')
              : (viewMode === 'REALIZADO' ? 'Déficit efetivado em caixa' : 'Déficit acumulado')}
          </span>
        </div>

        <div className="grid-kpi-card highlight">
          <span className="grid-kpi-title">
            {viewMode === 'REALIZADO' ? 'Saldo Final Realizado' : viewMode === 'PREVISTO' ? 'Saldo Final Previsto' : 'Saldo Final Projetado'} ({selectedYear})
          </span>
          <strong className={`grid-kpi-num ${lastAccumulatedBalance >= 0 ? 'text-emerald font-bold' : 'text-rose'}`}>
            <GlanceableCurrency value={lastAccumulatedBalance} />
          </strong>
          <span className="grid-kpi-sub">
            {viewMode === 'REALIZADO' ? 'Posição real de caixa apurada' : viewMode === 'PREVISTO' ? 'Posição orçada ao fim do ciclo' : 'Posição de caixa ao fim do ano'}
          </span>
        </div>
      </div>

      {/* Dica de Interatividade (Oculta na Versão Mobile) */}
      <div className="grid-interactive-tip hide-on-mobile flex items-center gap-2 mb-2 text-xs px-3 py-2 rounded-lg">
        <Info size={14} className="flex-shrink-0 text-cyan" />
        <span>
          <strong>Layout Glanceable:</strong> 6 macro-colunas sem rolagem. Modo ativo:{' '}
          <strong className={viewMode === 'REALIZADO' ? 'text-emerald' : viewMode === 'PREVISTO' ? 'text-amber' : 'text-cyan'}>
            {viewMode === 'REALIZADO' ? 'Valores Reais (Realizado)' : viewMode === 'PREVISTO' ? 'Valores Previstos (Planejado)' : 'Projetado (Consolidado)'}
          </strong>. Clique nas células de <strong>Entradas</strong> ou <strong>Saídas</strong> para inspecionar os lançamentos e naturezas.
        </span>
      </div>

      {/* Tabela Glanceable em 100% de Largura (Desktop) */}
      <div className="projection-table-glanceable-wrapper projection-table-desktop-view">
        <table className="projection-glanceable-grid">
          <thead>
            <tr>
              <th className="th-competence" style={{ width: '18%' }}>Competência</th>
              <th style={{ width: '14%', textAlign: 'right' }}>Saldo Inicial</th>
              <th style={{ width: '17%', textAlign: 'right' }}>
                {viewMode === 'REALIZADO' ? 'Total Entradas (Recebidas)' : viewMode === 'PREVISTO' ? 'Total Entradas (A Receber)' : 'Total Entradas (Receitas)'}
              </th>
              <th style={{ width: '17%', textAlign: 'right' }}>
                {viewMode === 'REALIZADO' ? 'Total Saídas (Pagas)' : viewMode === 'PREVISTO' ? 'Total Saídas (A Pagar)' : 'Total Saídas (Despesas)'}
              </th>
              <th className="th-saldo" style={{ width: '20%', textAlign: 'right' }}>Resultado (Mês)</th>
              <th className="th-acumulado" style={{ width: '14%', textAlign: 'right' }}>
                {viewMode === 'REALIZADO' ? 'Saldo Efetivado' : viewMode === 'PREVISTO' ? 'Saldo Estimado' : 'Saldo Acumulado'}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((row) => {
              const totalIncome = row.salary + row.extrasTotal + row.loanReceived;
              const totalExpense = row.creditCardTotal + row.fixedCostMapped + row.variableCost + row.loanPayment;
              const isCurrentMonth = row.monthKey === currentMonthKey;
              const isSurplus = row.monthNet >= 0;
              const barPercent = Math.min(Math.round((Math.abs(row.monthNet) / maxAbsNet) * 100), 100);

              return (
                <tr
                  key={row.monthKey}
                  className={`glanceable-row ${isCurrentMonth ? 'current-month-row' : ''} ${row.isDeficit ? 'row-deficit' : 'row-surplus'}`}
                >
                  {/* 1. Competência com destaque do Mês Atual e Fechamento (sem colisão visual) */}
                  <td
                    className="td-competence td-clickable"
                    title="Clique para ver o resumo completo desta competência"
                    onClick={() =>
                      handleOpenCell(row, 'monthNet', `DRE Resumo: ${row.competenceLabel}`, row.monthNet)
                    }
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="competence-badge font-bold">{row.formattedCompetence}</span>
                        {isCurrentMonth && (
                          <span className="current-month-pill flex-shrink-0" title="Competência em andamento no Balder">
                            Atual
                          </span>
                        )}
                        {row.isClosed ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClosingModalRow(row);
                            }}
                            className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded flex items-center gap-1 hover:bg-emerald-500/30 transition-colors"
                            title="Competência Fechada — Clique para gerenciar o fechamento"
                          >
                            <Lock className="w-2.5 h-2.5" />
                            Fechado
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClosingModalRow(row);
                            }}
                            className="px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 rounded flex items-center gap-1 transition-colors"
                            title="Clique para fechar financeiramente este mês"
                          >
                            <Lock className="w-2.5 h-2.5 opacity-60" />
                            Fechar
                          </button>
                        )}
                      </div>
                      <span className="competence-sublabel text-[11px] text-muted truncate">{row.competenceLabel}</span>
                    </div>
                  </td>

                  {/* 2. Saldo Inicial */}
                  <td
                    style={{ textAlign: 'right' }}
                    className="text-muted td-clickable"
                    title={
                      row.isFirstMonth
                        ? 'Saldo Inicial do Ponto de Partida'
                        : `Saldo Inicial transportado do mês anterior (${row.previousMonthKey || ''})`
                    }
                    onClick={() =>
                      handleOpenCell(row, 'accumulated', 'Saldo Inicial do Ciclo', row.initialBalance || 0)
                    }
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <GlanceableCurrency value={row.initialBalance} className="text-secondary font-medium" />
                      {row.isClosed && (
                        <span title="Saldo conciliado e fechado">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 3. Total Entradas (Receitas) */}
                  <td
                    style={{ textAlign: 'right' }}
                    className="td-clickable"
                    title="Clique para detalhar todas as entradas (Salário CLT, 13º/Bônus e Créditos)"
                    onClick={() =>
                      handleOpenCell(row, 'totalIncome', 'Detalhamento de Entradas (Receitas)', totalIncome)
                    }
                  >
                    <GlanceableCurrency value={totalIncome} isPositivePrefix={true} className="text-emerald font-bold" />
                  </td>

                  {/* 4. Total Saídas (Despesas) */}
                  <td
                    style={{ textAlign: 'right' }}
                    className="td-clickable"
                    title="Clique para detalhar todas as saídas (Cartão, Custos Fixos Mapeados, Avulsos e Financiamentos)"
                    onClick={() =>
                      handleOpenCell(row, 'totalExpense', 'Detalhamento de Saídas (Despesas)', totalExpense)
                    }
                  >
                    <GlanceableCurrency value={totalExpense} prefix="-" className="text-rose font-semibold" />
                  </td>

                  {/* 5. Resultado (Mês) com Micro-Gráfico In-line */}
                  <td
                    style={{ textAlign: 'right' }}
                    className="td-saldo td-clickable"
                    title={`Resultado Líquido: ${isSurplus ? 'Superávit' : 'Déficit'} de ${row.monthNet.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                    onClick={() =>
                      handleOpenCell(row, 'monthNet', 'Resultado Líquido do Mês (Entradas - Saídas)', row.monthNet)
                    }
                  >
                    <div className="flex items-center justify-end gap-2.5 w-full">
                      <GlanceableCurrency
                        value={row.monthNet}
                        isPositivePrefix={true}
                        className={isSurplus ? 'val-surplus' : 'val-deficit'}
                      />
                      {/* Micro-Gráfico In-line Proporcional */}
                      <div
                        className="mini-result-track flex-shrink-0"
                        title={`${isSurplus ? 'Superávit' : 'Déficit'}: ${barPercent}% do pico do ano`}
                      >
                        <div
                          className={`mini-result-fill ${isSurplus ? 'surplus' : 'deficit'}`}
                          style={{ width: `${Math.max(barPercent, 8)}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* 6. Saldo Acumulado */}
                  <td
                    style={{ textAlign: 'right' }}
                    className="td-acumulado td-clickable font-bold"
                    title="Clique para ver a projeção de liquidez acumulada"
                    onClick={() =>
                      handleOpenCell(row, 'accumulated', 'Saldo Acumulado Projetado', row.accumulatedBalance)
                    }
                  >
                    <GlanceableCurrency
                      value={row.accumulatedBalance}
                      className={row.accumulatedBalance < 0 ? 'val-deficit' : 'val-surplus-gold'}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Linha de Totais Consolidados no Rodapé */}
          <tfoot>
            <tr className="tfoot-totals-row font-bold">
              <th className="td-competence">
                {viewMode === 'REALIZADO'
                  ? 'TOTAIS REALIZADOS'
                  : viewMode === 'PREVISTO'
                  ? 'TOTAIS PREVISTOS'
                  : 'TOTAIS CONSOLIDADOS'}
              </th>
              <th style={{ textAlign: 'right' }}>
                <GlanceableCurrency value={firstInitialBalance} className="text-muted" />
              </th>
              <th style={{ textAlign: 'right' }}>
                <GlanceableCurrency value={totals.totalIncome} isPositivePrefix={true} className="text-emerald" />
              </th>
              <th style={{ textAlign: 'right' }}>
                <GlanceableCurrency value={totals.totalExpense} prefix="-" className="text-rose" />
              </th>
              <th style={{ textAlign: 'right' }}>
                <div className="flex items-center justify-end gap-2.5 w-full">
                  <GlanceableCurrency
                    value={totals.monthNet}
                    isPositivePrefix={true}
                    className={totals.monthNet >= 0 ? 'text-emerald' : 'text-rose'}
                  />
                  <div className="mini-result-track opacity-0 pointer-events-none" />
                </div>
              </th>
              <th style={{ textAlign: 'right' }} className="th-acumulado">
                <GlanceableCurrency
                  value={lastAccumulatedBalance}
                  className={lastAccumulatedBalance >= 0 ? 'text-amber font-bold' : 'text-rose font-bold'}
                />
              </th>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Lista de Cards da Projeção Orçamentária (Versão Mobile em Cards com Modo Recolhido) */}
      <div className="projection-cards-mobile-view">
        {/* Barra de controle superior dos cards mobile */}
        <div className="proj-mobile-list-header flex items-center justify-between px-1 mb-1">
          <span className="text-[11px] font-semibold text-secondary">
            {displayedRows.length} competências ({selectedYear === 'ALL' ? 'Todos' : selectedYear})
          </span>
          <button
            type="button"
            onClick={handleToggleAll}
            className="text-[11px] font-semibold text-cyan hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
          >
            {expandedMonthKeys.size > 0 ? 'Recolher Todos' : 'Expandir Todos'}
          </button>
        </div>

        {displayedRows.map((row) => {
          const totalIncome = row.salary + row.extrasTotal + row.loanReceived;
          const totalExpense = row.creditCardTotal + row.fixedCostMapped + row.variableCost + row.loanPayment;
          const isCurrentMonth = row.monthKey === currentMonthKey;
          const isSurplus = row.monthNet >= 0;
          const barPercent = Math.min(Math.round((Math.abs(row.monthNet) / maxAbsNet) * 100), 100);
          const isExpanded = expandedMonthKeys.has(row.monthKey);

          return (
            <div
              key={row.monthKey}
              className={`projection-mobile-card ${isExpanded ? 'is-expanded' : 'is-collapsed'} ${isCurrentMonth ? 'current-month-card' : ''} ${row.isDeficit ? 'card-deficit' : 'card-surplus'}`}
              onClick={() => {
                if (!isExpanded) {
                  toggleMonthExpanded(row.monthKey);
                }
              }}
            >
              {/* Card Header: Competência, Badges, Botão Fechamento e Ícone de Expansão */}
              <div
                className="proj-card-header"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMonthExpanded(row.monthKey);
                }}
                title={isExpanded ? 'Toque para recolher' : 'Toque para abrir detalhes'}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="proj-card-competence-badge">
                    <span className="font-bold">{row.formattedCompetence}</span>
                    <span className="proj-card-competence-label">{row.competenceLabel}</span>
                  </div>
                  {isCurrentMonth && (
                    <span className="current-month-pill" title="Competência em andamento no Balder">
                      Atual
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {row.isClosed ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClosingModalRow(row);
                      }}
                      className="px-2 py-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg flex items-center gap-1"
                      title="Competência Fechada — Toque para gerenciar"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Fechado</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClosingModalRow(row);
                      }}
                      className="px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800/80 border border-slate-700 rounded-lg flex items-center gap-1"
                      title="Toque para fechar este mês"
                    >
                      <Lock className="w-3 h-3 opacity-60" />
                      <span>Fechar</span>
                    </button>
                  )}

                  <div
                    className="proj-card-toggle-icon"
                    title={isExpanded ? 'Recolher detalhes' : 'Abrir detalhes'}
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </div>

              {/* Versão Recolhida (Siglas e Valores Compactos) */}
              {!isExpanded && (
                <div className="proj-collapsed-metrics-row animate-fade-in">
                  <div className="proj-micro-badge" title="Saldo Inicial">
                    <span className="proj-sigla">SI</span>
                    <GlanceableCurrency value={row.initialBalance} className="proj-val text-secondary font-semibold" />
                  </div>
                  <div className="proj-micro-badge" title="Entradas (Receitas)">
                    <span className="proj-sigla text-emerald">ENT</span>
                    <GlanceableCurrency value={totalIncome} isPositivePrefix={true} className="proj-val text-emerald font-bold" />
                  </div>
                  <div className="proj-micro-badge" title="Saídas (Despesas)">
                    <span className="proj-sigla text-rose">SAÍ</span>
                    <GlanceableCurrency value={totalExpense} prefix="-" className="proj-val text-rose font-bold" />
                  </div>
                  <div className="proj-micro-badge" title="Resultado (Mês)">
                    <span className={`proj-sigla ${isSurplus ? 'text-emerald' : 'text-rose'}`}>RES</span>
                    <GlanceableCurrency
                      value={row.monthNet}
                      isPositivePrefix={true}
                      className={`proj-val font-bold ${isSurplus ? 'text-emerald' : 'text-rose'}`}
                    />
                  </div>
                  <div className="proj-micro-badge" title="Saldo Acumulado">
                    <span className={`proj-sigla ${row.accumulatedBalance < 0 ? 'text-rose' : 'text-amber'}`}>ACUM</span>
                    <GlanceableCurrency
                      value={row.accumulatedBalance}
                      className={`proj-val font-bold ${row.accumulatedBalance < 0 ? 'text-rose' : 'val-surplus-gold'}`}
                    />
                  </div>
                </div>
              )}

              {/* Versão Expandida (Detalhamento Completo) */}
              {isExpanded && (
                <div className="proj-expanded-details animate-fade-in">
                  {/* Grid 2x2 com os Valores Financeiros Principais */}
                  <div className="proj-card-metrics-grid">
                    {/* Saldo Inicial */}
                    <div
                      className="proj-card-metric-box cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCell(row, 'accumulated', 'Saldo Inicial do Ciclo', row.initialBalance || 0);
                      }}
                      title="Toque para ver o saldo inicial"
                    >
                      <span className="proj-metric-label">Saldo Inicial</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <GlanceableCurrency value={row.initialBalance} className="font-semibold text-xs" />
                        {row.isClosed && <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
                      </div>
                    </div>

                    {/* Entradas */}
                    <div
                      className="proj-card-metric-box cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCell(row, 'totalIncome', 'Detalhamento de Entradas (Receitas)', totalIncome);
                      }}
                      title="Toque para detalhar entradas"
                    >
                      <span className="proj-metric-label text-emerald">Entradas (Receitas)</span>
                      <div className="mt-0.5">
                        <GlanceableCurrency value={totalIncome} isPositivePrefix={true} className="text-emerald font-bold text-xs" />
                      </div>
                    </div>

                    {/* Saídas */}
                    <div
                      className="proj-card-metric-box cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCell(row, 'totalExpense', 'Detalhamento de Saídas (Despesas)', totalExpense);
                      }}
                      title="Toque para detalhar saídas"
                    >
                      <span className="proj-metric-label text-rose">Saídas (Despesas)</span>
                      <div className="mt-0.5">
                        <GlanceableCurrency value={totalExpense} prefix="-" className="text-rose font-bold text-xs" />
                      </div>
                    </div>

                    {/* Resultado Líquido */}
                    <div
                      className="proj-card-metric-box cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCell(row, 'monthNet', 'Resultado Líquido do Mês (Entradas - Saídas)', row.monthNet);
                      }}
                      title="Toque para detalhar o resultado do mês"
                    >
                      <span className="proj-metric-label">Resultado (Mês)</span>
                      <div className="flex items-center justify-between gap-1 w-full mt-0.5">
                        <GlanceableCurrency
                          value={row.monthNet}
                          isPositivePrefix={true}
                          className={`font-bold text-xs ${isSurplus ? 'text-emerald' : 'text-rose'}`}
                        />
                        <div className="mini-result-track flex-shrink-0">
                          <div
                            className={`mini-result-fill ${isSurplus ? 'surplus' : 'deficit'}`}
                            style={{ width: `${Math.max(barPercent, 12)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Barra Inferior do Card: Saldo Acumulado & Botão DRE */}
                  <div
                    className="proj-card-footer cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCell(row, 'accumulated', 'Saldo Acumulado Projetado', row.accumulatedBalance);
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted font-medium">Saldo Acumulado:</span>
                      <GlanceableCurrency
                        value={row.accumulatedBalance}
                        className={`font-bold text-sm ${row.accumulatedBalance < 0 ? 'text-rose' : 'val-surplus-gold'}`}
                      />
                    </div>

                    <button
                      type="button"
                      className="proj-card-dre-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCell(row, 'monthNet', `DRE Resumo: ${row.competenceLabel}`, row.monthNet);
                      }}
                      title="Ver demonstrativo completo"
                    >
                      <span>Ver DRE</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Card de Totais Consolidados no Mobile */}
        <div className="proj-mobile-totals-card">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              {viewMode === 'REALIZADO'
                ? 'Totais Realizados'
                : viewMode === 'PREVISTO'
                ? 'Totais Previstos'
                : 'Totais Consolidados'}
            </span>
            <span className={`badge text-[10px] ${
              viewMode === 'REALIZADO'
                ? 'badge-emerald'
                : viewMode === 'PREVISTO'
                ? 'badge-amber'
                : 'badge-cyan'
            }`}>
              {viewMode === 'REALIZADO' ? 'Efetivado' : viewMode === 'PREVISTO' ? 'Planejado' : 'Consolidado'} ({displayedRows.length}m)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <span className="text-[10px] text-muted block">
                {viewMode === 'REALIZADO' ? 'Total Recebido' : viewMode === 'PREVISTO' ? 'Total a Receber' : 'Total Entradas'}
              </span>
              <GlanceableCurrency value={totals.totalIncome} isPositivePrefix={true} className="text-emerald font-bold text-xs" />
            </div>
            <div>
              <span className="text-[10px] text-muted block">
                {viewMode === 'REALIZADO' ? 'Total Pago' : viewMode === 'PREVISTO' ? 'Total a Pagar' : 'Total Saídas'}
              </span>
              <GlanceableCurrency value={totals.totalExpense} prefix="-" className="text-rose font-bold text-xs" />
            </div>
            <div>
              <span className="text-[10px] text-muted block">
                {viewMode === 'REALIZADO' ? 'Resultado Efetivado' : viewMode === 'PREVISTO' ? 'Resultado Planejado' : 'Resultado Líquido'}
              </span>
              <GlanceableCurrency
                value={totals.monthNet}
                isPositivePrefix={true}
                className={`font-bold text-xs ${totals.monthNet >= 0 ? 'text-emerald' : 'text-rose'}`}
              />
            </div>
            <div>
              <span className="text-[10px] text-muted block">
                {viewMode === 'REALIZADO' ? 'Saldo Final Real' : viewMode === 'PREVISTO' ? 'Saldo Final Previsto' : 'Saldo Final Projetado'}
              </span>
              <GlanceableCurrency
                value={lastAccumulatedBalance}
                className={`font-bold text-xs ${lastAccumulatedBalance >= 0 ? 'text-amber' : 'text-rose'}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pop-up Modal de Detalhamento da Célula Clicada */}
      <GridCellDetailModal
        isOpen={!!cellSelection}
        onClose={() => setCellSelection(null)}
        selection={cellSelection}
      />

      {/* Modal de Fechamento Financeiro da Competência */}
      <MonthClosingModal
        isOpen={!!closingModalRow}
        onClose={() => setClosingModalRow(null)}
        row={closingModalRow}
        onCloseMonth={closeMonth}
        onReopenMonth={reopenMonth}
      />
    </div>
  );
};
