import React, { useState, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { Download, Info, Lock, CheckCircle2 } from 'lucide-react';
import { buildMonthlyProjectionGrid } from '../utils/projectionMath';
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
      <span className="cents-muted text-[0.82em] opacity-60">,{cents}</span>
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

  // Geração determinística dos dados mês a mês respeitando fechamentos e carryover
  const allRows: MonthlyGridProjectionRow[] = useMemo(() => {
    return buildMonthlyProjectionGrid(
      movements,
      natures,
      initialBalance,
      salaryContracts,
      monthlyClosings
    );
  }, [movements, natures, initialBalance, salaryContracts, monthlyClosings]);

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
      'Total_Entradas_Receitas',
      'Total_Saidas_Despesas',
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
    link.setAttribute('download', `Balder_Fluxo_Macro_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="monthly-projection-grid-container glass-card animate-fade-in mt-6">
      {/* Header com Título & Filtro por Ano */}
      <div className="grid-section-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-cyan text-xs">VISÃO GERAL GLANCEABLE</span>
            <span className="text-xs text-muted">Fluxo de Caixa Macro</span>
          </div>
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span>Projeção Orçamentária Mês a Mês</span>
            <span className="text-xs font-normal dre-competence-badge px-2 py-0.5 rounded">
              DRE Sintética
            </span>
          </h2>
          <p className="text-xs text-secondary mt-1">
            Visão consolidada sem rolagem. Clique nas células de <strong>Entradas</strong> ou <strong>Saídas</strong> para inspecionar o detalhamento completo dos lançamentos.
          </p>
        </div>

        <div className="grid-header-actions">
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
          <span className="grid-kpi-title">Média de Entradas ({selectedYear})</span>
          <strong className="grid-kpi-num text-emerald">
            <GlanceableCurrency value={displayedRows.length > 0 ? totals.totalIncome / displayedRows.length : 0} />
          </strong>
          <span className="grid-kpi-sub">Salários + Extras médios</span>
        </div>

        <div className="grid-kpi-card">
          <span className="grid-kpi-title">Média de Saídas ({selectedYear})</span>
          <strong className="grid-kpi-num text-rose">
            <GlanceableCurrency value={displayedRows.length > 0 ? totals.totalExpense / displayedRows.length : 0} prefix="-" />
          </strong>
          <span className="grid-kpi-sub">Cartões + Fixos + Avulsos</span>
        </div>

        <div className="grid-kpi-card">
          <span className="grid-kpi-title">Resultado Líquido do Ciclo</span>
          <strong className={`grid-kpi-num ${totals.monthNet >= 0 ? 'text-emerald' : 'text-rose'}`}>
            <GlanceableCurrency value={totals.monthNet} isPositivePrefix={true} />
          </strong>
          <span className="grid-kpi-sub">{totals.monthNet >= 0 ? 'Superávit acumulado' : 'Déficit acumulado'}</span>
        </div>

        <div className="grid-kpi-card highlight">
          <span className="grid-kpi-title">Saldo Final Projetado ({selectedYear})</span>
          <strong className={`grid-kpi-num ${lastAccumulatedBalance >= 0 ? 'text-emerald font-bold' : 'text-rose'}`}>
            <GlanceableCurrency value={lastAccumulatedBalance} />
          </strong>
          <span className="grid-kpi-sub">Posição de caixa ao fim do ano</span>
        </div>
      </div>

      {/* Dica de Interatividade */}
      <div className="grid-interactive-tip flex items-center gap-2 mb-2 text-xs px-3 py-2 rounded-lg">
        <Info size={14} className="flex-shrink-0" />
        <span>
          <strong>Layout Glanceable:</strong> 6 macro-colunas sem rolagem horizontal ou vertical. Clique em <strong>Total Entradas</strong> ou <strong>Total Saídas</strong> para abrir o modal com cartões, naturezas e datas agrupadas.
        </span>
      </div>

      {/* Tabela Glanceable em 100% de Largura (Sem Barra de Rolagem) */}
      <div className="projection-table-glanceable-wrapper">
        <table className="projection-glanceable-grid">
          <thead>
            <tr>
              <th className="th-competence" style={{ width: '18%' }}>Competência</th>
              <th style={{ width: '14%', textAlign: 'right' }}>Saldo Inicial</th>
              <th style={{ width: '17%', textAlign: 'right' }}>Total Entradas (Receitas)</th>
              <th style={{ width: '17%', textAlign: 'right' }}>Total Saídas (Despesas)</th>
              <th className="th-saldo" style={{ width: '20%', textAlign: 'right' }}>Resultado (Mês)</th>
              <th className="th-acumulado" style={{ width: '14%', textAlign: 'right' }}>Saldo Acumulado</th>
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
                  {/* 1. Competência com destaque do Mês Atual e Fechamento */}
                  <td
                    className="td-competence td-clickable"
                    title="Clique para ver o resumo completo desta competência"
                    onClick={() =>
                      handleOpenCell(row, 'monthNet', `DRE Resumo: ${row.competenceLabel}`, row.monthNet)
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0">
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
                      <span className="competence-sublabel text-xs text-muted truncate">{row.competenceLabel}</span>
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
              <th className="td-competence">TOTAIS CONSOLIDADOS</th>
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
