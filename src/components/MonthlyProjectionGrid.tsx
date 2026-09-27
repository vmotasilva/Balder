import React, { useState, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { Download, Info, Lock, CheckCircle2, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
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

// Totais de entradas e saídas de uma linha da projeção
const rowIncome = (r?: MonthlyGridProjectionRow) => (r ? r.salary + r.extrasTotal + r.loanReceived : 0);
const rowExpense = (r?: MonthlyGridProjectionRow) =>
  r ? r.creditCardTotal + r.fixedCostMapped + r.variableCost + r.loanPayment : 0;

/**
 * Par Real | Previsto de uma coluna (Entradas ou Saídas).
 * Real (já recebido/pago) à esquerda e Previsto (ainda a receber/pagar) à direita; cada lado abre o detalhamento.
 */
const RealPlannedCell: React.FC<{
  real: number;
  planned: number;
  kind: 'in' | 'out';
  onReal: () => void;
  onPlanned: () => void;
}> = ({ real, planned, kind, onReal, onPlanned }) => {
  const tone = kind === 'in' ? 'text-emerald font-bold' : 'text-rose font-semibold';
  const what = kind === 'in' ? ['recebido', 'a receber'] : ['pago', 'a pagar'];
  return (
    <div className="rp-cell">
      <button
        type="button"
        className="rp-part"
        onClick={(e) => {
          e.stopPropagation();
          onReal();
        }}
        title={`Real: já ${what[0]} — clique para detalhar`}
      >
        <GlanceableCurrency value={real} prefix={kind === 'out' && real > 0 ? '-' : ''} isPositivePrefix={kind === 'in'} className={tone} />
      </button>
      <span className="rp-sep" aria-hidden="true">|</span>
      <button
        type="button"
        className="rp-part rp-planned"
        onClick={(e) => {
          e.stopPropagation();
          onPlanned();
        }}
        title={`Previsto: ainda ${what[1]} — clique para detalhar`}
      >
        <GlanceableCurrency value={planned} prefix={kind === 'out' && planned > 0 ? '-' : ''} isPositivePrefix={kind === 'in'} className={tone} />
      </button>
    </div>
  );
};

/** Cabeçalho de coluna com as legendas Real | Previsto alinhadas às partes da célula. */
const RealPlannedHeader: React.FC<{ title: string }> = ({ title }) => (
  <>
    <div>{title}</div>
    <div className="rp-head">
      <span>Real</span>
      <span className="rp-sep" aria-hidden="true">|</span>
      <span>Previsto</span>
    </div>
  </>
);

export const MonthlyProjectionGrid: React.FC = () => {
  const {
    movements,
    natures,
    activeCheckpoint,
    monthlyClosings,
    closeMonth,
    reopenMonth,
  } = useFinancial();

  const initialBalance = activeCheckpoint ? activeCheckpoint.initialBalance : 0;

  // Uma única visão: Entradas e Saídas mostram Real (realizado) | Previsto (a vencer);
  // Resultado e Saldo usam o consolidado (realizado + previsto)
  const allRows: MonthlyGridProjectionRow[] = useMemo(
    () => buildMonthlyProjectionGrid(movements, natures, initialBalance, monthlyClosings, 'PROJETADO'),
    [movements, natures, initialBalance, monthlyClosings]
  );
  const realizedByMonth = useMemo(() => {
    const rows = buildMonthlyProjectionGrid(movements, natures, initialBalance, monthlyClosings, 'REALIZADO');
    return new Map(rows.map((r) => [r.monthKey, r]));
  }, [movements, natures, initialBalance, monthlyClosings]);
  const plannedByMonth = useMemo(() => {
    const rows = buildMonthlyProjectionGrid(movements, natures, initialBalance, monthlyClosings, 'PREVISTO');
    return new Map(rows.map((r) => [r.monthKey, r]));
  }, [movements, natures, initialBalance, monthlyClosings]);

  // Anos disponíveis na base projetada
  const availableYears = useMemo(() => {
    const setYears = new Set(allRows.map((r) => r.monthKey.slice(0, 4)));
    return Array.from(setYears).sort();
  }, [allRows]);

  // Filtro por Ano: padrão '2026' para garantir máximo de 12 linhas e zero scroll vertical
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const periodLabel = selectedYear === 'ALL' ? 'Todos' : selectedYear;

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
    totalValue: number,
    viewMode: ProjectionViewMode = 'PROJETADO'
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

  // Atalhos de detalhamento Real | Previsto para Entradas e Saídas
  const openIncome = (row: MonthlyGridProjectionRow, mode: 'REALIZADO' | 'PREVISTO') => {
    const source = (mode === 'REALIZADO' ? realizedByMonth : plannedByMonth).get(row.monthKey) || row;
    handleOpenCell(
      source,
      'totalIncome',
      mode === 'REALIZADO' ? 'Entradas Reais (Recebidas)' : 'Entradas Previstas (A Receber)',
      rowIncome(source),
      mode
    );
  };
  const openExpense = (row: MonthlyGridProjectionRow, mode: 'REALIZADO' | 'PREVISTO') => {
    const source = (mode === 'REALIZADO' ? realizedByMonth : plannedByMonth).get(row.monthKey) || row;
    handleOpenCell(
      source,
      'totalExpense',
      mode === 'REALIZADO' ? 'Saídas Reais (Pagas)' : 'Saídas Previstas (A Pagar)',
      rowExpense(source),
      mode
    );
  };

  // Filtragem estrita por ano (máximo 12 linhas)
  const displayedRows = useMemo(() => {
    if (selectedYear === 'ALL') return allRows;
    return allRows.filter((r) => r.monthKey.startsWith(selectedYear));
  }, [allRows, selectedYear]);

  // Valores Real | Previsto por competência exibida
  const splitFor = (row: MonthlyGridProjectionRow) => {
    const realized = realizedByMonth.get(row.monthKey);
    const planned = plannedByMonth.get(row.monthKey);
    return {
      realIn: rowIncome(realized),
      plannedIn: rowIncome(planned),
      realOut: rowExpense(realized),
      plannedOut: rowExpense(planned),
    };
  };

  // Maior resultado absoluto do período para cálculo proporcional do micro-gráfico in-line
  const maxAbsNet = useMemo(() => {
    return Math.max(...displayedRows.map((r) => Math.abs(r.monthNet)), 1);
  }, [displayedRows]);

  // Totais do período filtrado: Real | Previsto para entradas e saídas; resultado consolidado
  const totals = useMemo(() => {
    return displayedRows.reduce(
      (acc, r) => {
        const s = splitFor(r);
        return {
          realIn: acc.realIn + s.realIn,
          plannedIn: acc.plannedIn + s.plannedIn,
          realOut: acc.realOut + s.realOut,
          plannedOut: acc.plannedOut + s.plannedOut,
          monthNet: acc.monthNet + r.monthNet,
        };
      },
      { realIn: 0, plannedIn: 0, realOut: 0, plannedOut: 0, monthNet: 0 }
    );
  }, [displayedRows, realizedByMonth, plannedByMonth]);

  const firstInitialBalance = displayedRows[0]?.initialBalance;
  const lastAccumulatedBalance = displayedRows[displayedRows.length - 1]?.accumulatedBalance || 0;

  // Exportar para CSV (Visão Macro & Glanceable)
  const handleExportCSV = () => {
    const headers = [
      'Competencia',
      'Saldo_Inicial',
      'Entradas_Real',
      'Entradas_Previsto',
      'Saidas_Real',
      'Saidas_Previsto',
      'Resultado_Mes',
      'Saldo_Acumulado',
    ];

    const csvRows = displayedRows.map((r) => {
      const s = splitFor(r);
      return [
        r.formattedCompetence,
        r.initialBalance !== undefined ? r.initialBalance.toFixed(2) : '',
        s.realIn.toFixed(2),
        s.plannedIn.toFixed(2),
        (-s.realOut).toFixed(2),
        (-s.plannedOut).toFixed(2),
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
        <div className="grid-header-title-col hide-on-mobile">
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-cyan text-xs">VISÃO GERAL</span>
            <span className="text-xs text-muted">Fluxo de Caixa Macro</span>
          </div>
          <h2 className="text-lg font-bold flex items-center gap-2 monthly-projection-heading hide-on-mobile" style={{ color: 'var(--text-primary)' }}>
            <span>Projeção Orçamentária Mês a Mês</span>
          </h2>
          <p className="text-xs text-secondary mt-1 monthly-projection-subtext hide-on-mobile">
            Entradas e saídas mostram o que já foi <strong>realizado</strong> (esquerda) e o que ainda está{' '}
            <strong>previsto</strong> (direita). Resultado e saldo consideram os dois.
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
          <span className="grid-kpi-title">Entradas ({periodLabel})</span>
          <div className="kpi-rp">
            <div>
              <span className="kpi-rp-label">Real</span>
              <strong className="grid-kpi-num text-emerald">
                <GlanceableCurrency value={totals.realIn} />
              </strong>
            </div>
            <div className="rp-planned">
              <span className="kpi-rp-label">Previsto</span>
              <strong className="grid-kpi-num text-emerald">
                <GlanceableCurrency value={totals.plannedIn} />
              </strong>
            </div>
          </div>
          <span className="grid-kpi-sub">Recebido | a receber</span>
        </div>

        <div className="grid-kpi-card">
          <span className="grid-kpi-title">Saídas ({periodLabel})</span>
          <div className="kpi-rp">
            <div>
              <span className="kpi-rp-label">Real</span>
              <strong className="grid-kpi-num text-rose">
                <GlanceableCurrency value={totals.realOut} prefix={totals.realOut > 0 ? '-' : ''} />
              </strong>
            </div>
            <div className="rp-planned">
              <span className="kpi-rp-label">Previsto</span>
              <strong className="grid-kpi-num text-rose">
                <GlanceableCurrency value={totals.plannedOut} prefix={totals.plannedOut > 0 ? '-' : ''} />
              </strong>
            </div>
          </div>
          <span className="grid-kpi-sub">Pago | a pagar</span>
        </div>

        <div className="grid-kpi-card">
          <span className="grid-kpi-title">Resultado ({periodLabel})</span>
          <strong className={`grid-kpi-num ${totals.monthNet >= 0 ? 'text-emerald' : 'text-rose'}`}>
            <GlanceableCurrency value={totals.monthNet} isPositivePrefix={true} />
          </strong>
          <span className="grid-kpi-sub">
            {totals.monthNet >= 0 ? 'Superávit' : 'Déficit'} considerando real + previsto
          </span>
        </div>

        <div className="grid-kpi-card highlight">
          <span className="grid-kpi-title">Saldo Final ({periodLabel})</span>
          <strong className={`grid-kpi-num ${lastAccumulatedBalance >= 0 ? 'text-emerald font-bold' : 'text-rose'}`}>
            <GlanceableCurrency value={lastAccumulatedBalance} />
          </strong>
          <span className="grid-kpi-sub">Posição de caixa ao fim do período</span>
        </div>
      </div>

      {/* Legenda Real | Previsto (Oculta na Versão Mobile) */}
      <div className="grid-interactive-tip hide-on-mobile flex items-center gap-2 mb-2 text-xs px-3 py-2 rounded-lg">
        <Info size={14} className="flex-shrink-0 text-cyan" />
        <span>
          Em <strong>Entradas</strong> e <strong>Saídas</strong>: <strong>Real</strong> (esquerda) é o que já foi recebido ou
          pago; <strong>Previsto</strong> (direita) é o que ainda vai acontecer. Clique em qualquer valor para ver os
          lançamentos e naturezas.
        </span>
      </div>

      {/* Tabela Glanceable em 100% de Largura (Desktop) */}
      <div className="projection-table-glanceable-wrapper projection-table-desktop-view">
        <table className="projection-glanceable-grid">
          <thead>
            <tr>
              <th className="th-competence" style={{ width: '16%' }}>Competência</th>
              <th style={{ width: '12%', textAlign: 'right' }}>Saldo Inicial</th>
              <th style={{ width: '22%', textAlign: 'right' }}>
                <RealPlannedHeader title="Entradas" />
              </th>
              <th style={{ width: '22%', textAlign: 'right' }}>
                <RealPlannedHeader title="Saídas" />
              </th>
              <th className="th-saldo" style={{ width: '16%', textAlign: 'right' }}>Resultado (Mês)</th>
              <th className="th-acumulado" style={{ width: '12%', textAlign: 'right' }}>Saldo Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((row) => {
              const s = splitFor(row);
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

                  {/* 3. Entradas: Real | Previsto */}
                  <td style={{ textAlign: 'right' }}>
                    <RealPlannedCell
                      kind="in"
                      real={s.realIn}
                      planned={s.plannedIn}
                      onReal={() => openIncome(row, 'REALIZADO')}
                      onPlanned={() => openIncome(row, 'PREVISTO')}
                    />
                  </td>

                  {/* 4. Saídas: Real | Previsto */}
                  <td style={{ textAlign: 'right' }}>
                    <RealPlannedCell
                      kind="out"
                      real={s.realOut}
                      planned={s.plannedOut}
                      onReal={() => openExpense(row, 'REALIZADO')}
                      onPlanned={() => openExpense(row, 'PREVISTO')}
                    />
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

          {/* Linha de Totais no Rodapé */}
          <tfoot>
            <tr className="tfoot-totals-row font-bold">
              <th className="td-competence">TOTAIS</th>
              <th style={{ textAlign: 'right' }}>
                <GlanceableCurrency value={firstInitialBalance} className="text-muted" />
              </th>
              <th style={{ textAlign: 'right' }}>
                <div className="rp-cell">
                  <GlanceableCurrency value={totals.realIn} isPositivePrefix={true} className="text-emerald" />
                  <span className="rp-sep" aria-hidden="true">|</span>
                  <span className="rp-planned">
                    <GlanceableCurrency value={totals.plannedIn} isPositivePrefix={true} className="text-emerald" />
                  </span>
                </div>
              </th>
              <th style={{ textAlign: 'right' }}>
                <div className="rp-cell">
                  <GlanceableCurrency value={totals.realOut} prefix={totals.realOut > 0 ? '-' : ''} className="text-rose" />
                  <span className="rp-sep" aria-hidden="true">|</span>
                  <span className="rp-planned">
                    <GlanceableCurrency value={totals.plannedOut} prefix={totals.plannedOut > 0 ? '-' : ''} className="text-rose" />
                  </span>
                </div>
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
            {displayedRows.length} competências ({periodLabel}) • Real | Previsto
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
          const s = splitFor(row);
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
                  <div className="proj-micro-badge" title="Entradas: Real | Previsto">
                    <span className="proj-sigla text-emerald">ENT</span>
                    <GlanceableCurrency value={s.realIn} className="proj-val text-emerald font-bold" />
                    <span className="rp-sep" aria-hidden="true">|</span>
                    <span className="rp-planned">
                      <GlanceableCurrency value={s.plannedIn} className="proj-val text-emerald font-bold" />
                    </span>
                  </div>
                  <div className="proj-micro-badge" title="Saídas: Real | Previsto">
                    <span className="proj-sigla text-rose">SAÍ</span>
                    <GlanceableCurrency value={s.realOut} className="proj-val text-rose font-bold" />
                    <span className="rp-sep" aria-hidden="true">|</span>
                    <span className="rp-planned">
                      <GlanceableCurrency value={s.plannedOut} className="proj-val text-rose font-bold" />
                    </span>
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

                    {/* Entradas: Real | Previsto */}
                    <div className="proj-card-metric-box" onClick={(e) => e.stopPropagation()}>
                      <span className="proj-metric-label text-emerald">Entradas · Real | Previsto</span>
                      <div className="mt-0.5">
                        <RealPlannedCell
                          kind="in"
                          real={s.realIn}
                          planned={s.plannedIn}
                          onReal={() => openIncome(row, 'REALIZADO')}
                          onPlanned={() => openIncome(row, 'PREVISTO')}
                        />
                      </div>
                    </div>

                    {/* Saídas: Real | Previsto */}
                    <div className="proj-card-metric-box" onClick={(e) => e.stopPropagation()}>
                      <span className="proj-metric-label text-rose">Saídas · Real | Previsto</span>
                      <div className="mt-0.5">
                        <RealPlannedCell
                          kind="out"
                          real={s.realOut}
                          planned={s.plannedOut}
                          onReal={() => openExpense(row, 'REALIZADO')}
                          onPlanned={() => openExpense(row, 'PREVISTO')}
                        />
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

        {/* Card de Totais no Mobile */}
        <div className="proj-mobile-totals-card">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Totais</span>
            <span className="badge badge-cyan text-[10px]">Real | Previsto ({displayedRows.length}m)</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <span className="text-[10px] text-muted block">Entradas · Real | Previsto</span>
              <div className="rp-cell">
                <GlanceableCurrency value={totals.realIn} className="text-emerald font-bold text-xs" />
                <span className="rp-sep" aria-hidden="true">|</span>
                <span className="rp-planned">
                  <GlanceableCurrency value={totals.plannedIn} className="text-emerald font-bold text-xs" />
                </span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-muted block">Saídas · Real | Previsto</span>
              <div className="rp-cell">
                <GlanceableCurrency value={totals.realOut} prefix={totals.realOut > 0 ? '-' : ''} className="text-rose font-bold text-xs" />
                <span className="rp-sep" aria-hidden="true">|</span>
                <span className="rp-planned">
                  <GlanceableCurrency value={totals.plannedOut} prefix={totals.plannedOut > 0 ? '-' : ''} className="text-rose font-bold text-xs" />
                </span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-muted block">Resultado</span>
              <GlanceableCurrency
                value={totals.monthNet}
                isPositivePrefix={true}
                className={`font-bold text-xs ${totals.monthNet >= 0 ? 'text-emerald' : 'text-rose'}`}
              />
            </div>
            <div>
              <span className="text-[10px] text-muted block">Saldo Final</span>
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
