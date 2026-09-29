import React, { useState, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { Download, Info, Lock, CheckCircle2, ArrowRight, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
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
  onReal?: () => void;
  onPlanned?: () => void;
}> = ({ real, planned, kind, onReal, onPlanned }) => {
  const tone = kind === 'in' ? 'text-emerald font-bold' : 'text-rose font-semibold';
  const what = kind === 'in' ? ['recebido', 'a receber'] : ['pago', 'a pagar'];
  if (!onReal || !onPlanned) {
    return (
      <div className="rp-cell">
        <span className="rp-part">
          <GlanceableCurrency value={real} prefix={kind === 'out' && real > 0 ? '-' : ''} isPositivePrefix={kind === 'in'} className={tone} />
        </span>
        <span className="rp-sep" aria-hidden="true">|</span>
        <span className="rp-part rp-planned">
          <GlanceableCurrency value={planned} prefix={kind === 'out' && planned > 0 ? '-' : ''} isPositivePrefix={kind === 'in'} className={tone} />
        </span>
      </div>
    );
  }
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

const SHORT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** "2026-10" → "Out/2026" */
const shortCompetence = (monthKey: string) => {
  const [y, m] = monthKey.split('-');
  return `${SHORT_MONTHS[Number(m) - 1]}/${y}`;
};

/** Situação da competência: fechada, em andamento (em aberto) ou ainda por vir (não iniciada). */
const competenceStatus = (row: MonthlyGridProjectionRow, currentMonthKey: string) => {
  if (row.isClosed) return { key: 'closed', label: 'Fechado' };
  if (row.monthKey > currentMonthKey) return { key: 'future', label: 'Não iniciado' };
  return { key: 'open', label: 'Em aberto' };
};

/** Rótulo principal com a legenda "Real | Previsto" na linha de baixo, em fonte menor. */
const CardLabel: React.FC<{ title: string; hint?: string; className?: string }> = ({ title, hint, className }) => (
  <div className="proj-card-label">
    <span className={`proj-card-label-main ${className || ''}`}>{title}</span>
    {hint && <span className="proj-card-label-hint">{hint}</span>}
  </div>
);

const HORIZON_OPTIONS = [
  { months: 12, label: '1 ano' },
  { months: 24, label: '2 anos' },
  { months: 36, label: '3 anos' },
  { months: 60, label: '5 anos' },
  { months: 120, label: '10 anos' },
];

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
    projectionHorizonMonths,
    setProjectionHorizonMonths,
  } = useFinancial();
  const gridOptions = { startDate: activeCheckpoint?.startDate, horizonMonths: projectionHorizonMonths };

  const initialBalance = activeCheckpoint ? activeCheckpoint.initialBalance : 0;

  // Uma única visão: Entradas e Saídas mostram Real (realizado) | Previsto (a vencer);
  // Resultado e Saldo usam o consolidado (realizado + previsto)
  const allRows: MonthlyGridProjectionRow[] = useMemo(
    () => buildMonthlyProjectionGrid(movements, natures, initialBalance, monthlyClosings, 'PROJETADO', gridOptions),
    [movements, natures, initialBalance, monthlyClosings, activeCheckpoint?.startDate, projectionHorizonMonths]
  );
  const realizedByMonth = useMemo(() => {
    const rows = buildMonthlyProjectionGrid(movements, natures, initialBalance, monthlyClosings, 'REALIZADO', gridOptions);
    return new Map(rows.map((r) => [r.monthKey, r]));
  }, [movements, natures, initialBalance, monthlyClosings, activeCheckpoint?.startDate, projectionHorizonMonths]);
  const plannedByMonth = useMemo(() => {
    const rows = buildMonthlyProjectionGrid(movements, natures, initialBalance, monthlyClosings, 'PREVISTO', gridOptions);
    return new Map(rows.map((r) => [r.monthKey, r]));
  }, [movements, natures, initialBalance, monthlyClosings, activeCheckpoint?.startDate, projectionHorizonMonths]);

  // Anos disponíveis na base projetada
  const availableYears = useMemo(() => {
    const setYears = new Set(allRows.map((r) => r.monthKey.slice(0, 4)));
    return Array.from(setYears).sort();
  }, [allRows]);

  // Mês atual de referência para ancorar a visão do usuário
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // Filtro por ano: padrão o ano atual (no máximo 12 linhas)
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));
  const periodLabel = selectedYear === 'ALL' ? 'Todos' : selectedYear;

  // Estado para abertura do pop-up modal de detalhamento da célula clicada
  const [cellSelection, setCellSelection] = useState<GridCellSelection | null>(null);

  // Estado para o modal de fechamento financeiro da competência
  const [closingModalRow, setClosingModalRow] = useState<MonthlyGridProjectionRow | null>(null);

  // Competências expandidas na visão mobile em cards: o mês atual já abre expandido
  const [expandedMonthKeys, setExpandedMonthKeys] = useState<Set<string>>(() => new Set([currentMonthKey]));

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

  // Card de Entrada/Saída (celular): abre o mês inteiro (real + previsto) na lista de naturezas
  const openMonthFlow = (row: MonthlyGridProjectionRow, kind: 'in' | 'out') => {
    // Sem o mês no título: o seletor de competência logo acima já mostra (e navega entre) os meses
    if (kind === 'in') handleOpenCell(row, 'totalIncome', 'Entradas do mês', rowIncome(row));
    else handleOpenCell(row, 'totalExpense', 'Saídas do mês', rowExpense(row));
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
          {/* Até onde enxergar e qual ano exibir */}
          <label className="grid-horizon-select" title="Até onde a projeção enxerga, a partir do mês atual">
            <span>Horizonte</span>
            <select
              className="form-input form-input-sm"
              value={projectionHorizonMonths}
              onChange={(e) => setProjectionHorizonMonths(Number(e.target.value))}
            >
              {!HORIZON_OPTIONS.some((o) => o.months === projectionHorizonMonths) && (
                <option value={projectionHorizonMonths}>{projectionHorizonMonths} meses</option>
              )}
              {HORIZON_OPTIONS.map((o) => (
                <option key={o.months} value={o.months}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid-horizon-select" title="Competências exibidas">
            <span>Exibir</span>
            <select
              className="form-input form-input-sm"
              value={availableYears.includes(selectedYear) || selectedYear === 'ALL' ? selectedYear : 'ALL'}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  Ano {year}
                </option>
              ))}
              <option value="ALL">Todos ({allRows.length} meses)</option>
            </select>
          </label>

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

      {/* Resumo do período em um card: Entrada | Saída | Saldo final. Cada valor é o consolidado
          (real + previsto): à medida que o real é lançado, ele toma o lugar do previsto, e a barra
          mostra quanto do total já é real */}
      <div className="grid-summary-one mt-3 mb-3">
        <span className="grid-summary-caption">
          {selectedYear === 'ALL' ? 'Todo o horizonte' : `Ano ${selectedYear}`} · real + previsto
        </span>
        {(
          [
            { key: 'in', title: 'Entrada', real: totals.realIn, total: totals.realIn + totals.plannedIn, tone: 'text-emerald' },
            { key: 'out', title: 'Saída', real: totals.realOut, total: totals.realOut + totals.plannedOut, tone: 'text-rose' },
          ] as const
        ).map((c) => {
          const pct = c.total > 0 ? Math.round((c.real / c.total) * 100) : 0;
          return (
            <div key={c.key} className="grid-summary-col">
              <span className="grid-summary-title">{c.title}</span>
              <strong className={`grid-summary-value ${c.tone}`}>
                <GlanceableCurrency
                  value={c.total}
                  prefix={c.key === 'out' && c.total > 0 ? '-' : ''}
                  isPositivePrefix={c.key === 'in'}
                />
              </strong>
              <span className={`grid-summary-bar is-${c.key}`} title={`${pct}% já realizado`}>
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="grid-summary-sub">
                <GlanceableCurrency value={c.real} /> real
              </span>
            </div>
          );
        })}
        <div className="grid-summary-col">
          <span className="grid-summary-title">Saldo final</span>
          <strong className={`grid-summary-value ${lastAccumulatedBalance >= 0 ? 'val-surplus-gold' : 'text-rose'}`}>
            <GlanceableCurrency value={lastAccumulatedBalance} />
          </strong>
          <span className="grid-summary-sub">
            Resultado{' '}
            <GlanceableCurrency
              value={totals.monthNet}
              isPositivePrefix={true}
              className={totals.monthNet >= 0 ? 'text-emerald' : 'text-rose'}
            />
          </span>
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
            {displayedRows.length} competências ({periodLabel})
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
          const status = competenceStatus(row, currentMonthKey);

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
              {/* Linha 1: competência · situação · saldo inicial · expandir */}
              <div
                className="proj-card-header"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMonthExpanded(row.monthKey);
                }}
                title={isExpanded ? 'Toque para recolher' : 'Toque para abrir detalhes'}
              >
                <span className="proj-card-month">{shortCompetence(row.monthKey)}</span>
                <button
                  type="button"
                  className={`proj-card-status is-${status.key}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setClosingModalRow(row);
                  }}
                  title={row.isClosed ? 'Competência fechada: toque para gerenciar' : 'Toque para fechar este mês'}
                >
                  {status.label}
                </button>
                <div
                  className="proj-card-initial"
                  onClick={(e) => {
                    if (!isExpanded) return;
                    e.stopPropagation();
                    handleOpenCell(row, 'accumulated', 'Saldo Inicial do Ciclo', row.initialBalance || 0);
                  }}
                >
                  <span className="proj-card-label-hint">Saldo inicial</span>
                  <GlanceableCurrency value={row.initialBalance} className="font-semibold text-xs" />
                </div>
                <div className="proj-card-toggle-icon" title={isExpanded ? 'Recolher detalhes' : 'Abrir detalhes'}>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Entrada · Saída (Real | Previsto), só com o mês aberto: o card inteiro abre as naturezas do mês.
                  Recolhido, o mês fica em 2 linhas: competência/situação/saldo inicial e saldo/acumulado */}
              {isExpanded && (
              <div className="proj-card-row animate-fade-in">
                <button
                  type="button"
                  className="proj-card-cell is-clickable proj-card-open"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMonthFlow(row, 'in');
                  }}
                  title={`Ver as entradas de ${shortCompetence(row.monthKey)} por natureza`}
                >
                  <CardLabel title="Entrada" hint="Real | Previsto" className="text-emerald" />
                  <RealPlannedCell kind="in" real={s.realIn} planned={s.plannedIn} />
                  <ChevronRight size={14} className="proj-card-open-icon" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="proj-card-cell is-clickable proj-card-open"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMonthFlow(row, 'out');
                  }}
                  title={`Ver as saídas de ${shortCompetence(row.monthKey)} por natureza`}
                >
                  <CardLabel title="Saída" hint="Real | Previsto" className="text-rose" />
                  <RealPlannedCell kind="out" real={s.realOut} planned={s.plannedOut} />
                  <ChevronRight size={14} className="proj-card-open-icon" aria-hidden="true" />
                </button>
              </div>
              )}

              {/* Saldo do mês (Entrada − Saída) · Saldo acumulado */}
              <div className="proj-card-row">
                <div
                  className={`proj-card-cell ${isExpanded ? 'is-clickable' : ''}`}
                  onClick={(e) => {
                    if (!isExpanded) return;
                    e.stopPropagation();
                    handleOpenCell(row, 'monthNet', 'Resultado Líquido do Mês (Entradas - Saídas)', row.monthNet);
                  }}
                >
                  <CardLabel title="Saldo" hint="Entrada − Saída" />
                  <div className="flex items-center gap-2">
                    <GlanceableCurrency
                      value={row.monthNet}
                      isPositivePrefix={true}
                      className={`font-bold text-xs ${isSurplus ? 'text-emerald' : 'text-rose'}`}
                    />
                    {isExpanded && (
                      <div className="mini-result-track flex-shrink-0">
                        <div
                          className={`mini-result-fill ${isSurplus ? 'surplus' : 'deficit'}`}
                          style={{ width: `${Math.max(barPercent, 12)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div
                  className={`proj-card-cell ${isExpanded ? 'is-clickable' : ''}`}
                  onClick={(e) => {
                    if (!isExpanded) return;
                    e.stopPropagation();
                    handleOpenCell(row, 'accumulated', 'Saldo Acumulado Projetado', row.accumulatedBalance);
                  }}
                >
                  <CardLabel title="Saldo acumulado" />
                  <GlanceableCurrency
                    value={row.accumulatedBalance}
                    className={`font-bold text-xs ${row.accumulatedBalance < 0 ? 'text-rose' : 'val-surplus-gold'}`}
                  />
                </div>
              </div>

              {/* Expandido: toques abrem os lançamentos; DRE do mês */}
              {isExpanded && (
                <div className="proj-card-footer animate-fade-in">
                  <span className="text-[11px] text-muted">Toque em Entrada ou Saída para ver as naturezas</span>
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
              )}
            </div>
          );
        })}

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
