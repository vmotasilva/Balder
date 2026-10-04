import React, { useState, useMemo } from 'react';
import { isExcludedState } from '../utils/mappingItemState';
import { useFinancial } from '../context/FinancialContext';
import {
  Clock,
  Edit3,
  X,
  AlertTriangle,
} from 'lucide-react';
import type { ExpenseNature, MonthlyGridProjectionRow, MappingItem } from '../types';
import { buildMonthlyProjectionGrid, movementCompetenceDate } from '../utils/projectionMath';
import { mappingItemMonthValue, resolveMappingItemMonth } from '../utils/mappingItemState';
import { userNatures } from '../utils/baseNatures';
import { buildPeriodItems, trackingPeriodRange, TRACKING_PERIOD_LABELS } from '../utils/periodSpending';
import type { TrackingPeriod } from '../utils/periodSpending';
import { GridCellDetailModal } from './GridCellDetailModal';
import type { GridCellSelection } from './GridCellDetailModal';

interface NatureBudgetRow {
  nature: ExpenseNature;
  natureId: string;
  name: string;
  color: string;
  type: string;
  category: string;
  plannedAmount: number;
  realizedAmount: number; // Real: já pago no mês
  pendingAmount: number;  // Previsto: ainda a pagar no mês
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

export const NatureBudgetGrid: React.FC<NatureBudgetGridProps> = () => {
  const {
    movements,
    natures,
    getNatureCeiling,
    updateNature,
    activeCheckpoint,
    monthlyClosings,
    viewPreferences,
    natureDetailModes,
  } = useFinancial();

  // Período avaliado: o escolhido no seletor do Início (semana, quinzena ou mês). Fora do mês, o teto é proporcional ao período.
  const period: TrackingPeriod = viewPreferences.trackingPeriod || 'MES';
  const periodLabels = TRACKING_PERIOD_LABELS[period];
  const periodRange = useMemo(() => trackingPeriodRange(period), [period]);

  // Mês selecionado para acompanhamento (padrão: mês atual; se não houver competência nele, a primeira disponível)
  const [pickedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  // Termo de busca rápida para filtrar naturezas
  // Filtro de status: ALL, OVER (Acima do teto), WITHIN (Dentro do teto)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVER' | 'WITHIN'>('ALL');
  // Modo de exibição: CARDS (padrão otimizado) ou TABLE
  // Estado para abrir modal de edição de observação da natureza
  const [editingNatureId, setEditingNatureId] = useState<string | null>(null);
  const [editingObservationText, setEditingObservationText] = useState<string>('');

  // Estado para abertura do modal de detalhamento da célula/natureza
  const [cellSelection, setCellSelection] = useState<GridCellSelection | null>(null);
  // Natureza com alerta: o pop-up com as descrições abre antes do detalhamento
  const [alertRow, setAlertRow] = useState<NatureBudgetRow | null>(null);

  const initialBalance = activeCheckpoint ? activeCheckpoint.initialBalance : 0;

  // Projeção financeira completa para recuperar os totais da competência selecionada
  const allRows: MonthlyGridProjectionRow[] = useMemo(() => {
    return buildMonthlyProjectionGrid(
      movements,
      natures,
      initialBalance,
      monthlyClosings,
      'PROJETADO',
      { startDate: activeCheckpoint?.startDate }
    );
  }, [movements, natures, initialBalance, monthlyClosings, activeCheckpoint?.startDate]);

  // Lista de competências disponíveis
  const availableMonths = useMemo(() => {
    return allRows.map((r) => ({
      key: r.monthKey,
      label: r.competenceLabel,
      formatted: r.formattedCompetence,
    }));
  }, [allRows]);

  const currentRow = useMemo(() => {
    return allRows.find((r) => r.monthKey === pickedMonthKey) || allRows[0];
  }, [allRows, pickedMonthKey]);
  // Competência efetivamente exibida: os valores das naturezas e o rótulo usam sempre a mesma
  const selectedMonthKey = currentRow?.monthKey ?? pickedMonthKey;

  // Formatação monetária
  const formatBRL = (val?: number) => {
    if (val === undefined || val === null) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Competências que o período corrente toca (uma semana pode cruzar dois meses)
  const periodMonthKeys = useMemo(() => {
    const [fy, fm] = periodRange.from.split('-').map(Number);
    const keys: string[] = [];
    for (let d = new Date(fy, fm - 1, 1); ; d.setMonth(d.getMonth() + 1)) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (k > periodRange.to.slice(0, 7)) break;
      keys.push(k);
    }
    return keys;
  }, [periodRange]);

  // Compras do período corrente (semana/quinzena), item a item, para apurar teto, real e previsto
  const periodItems = useMemo(
    () =>
      period === 'MES'
        ? []
        : buildPeriodItems({ natures, movements, range: periodRange, startDate: activeCheckpoint?.startDate, natureDetailModes }).items,
    [period, natures, movements, periodRange, activeCheckpoint?.startDate, natureDetailModes]
  );

  // Processamento e cálculo de cada linha do Grid de Naturezas
  const natureRows: NatureBudgetRow[] = useMemo(() => {
    const selectedMonthNumber = parseInt(selectedMonthKey.split('-')[1], 10);

    return userNatures(natures).map((nat) => {
      // 1. Previsto (Teto orçado mensal da natureza específico para este mês de competência)
      let planned = getNatureCeiling(nat, selectedMonthKey);

      // 2. Realizado: apurado via movimentos reais ou mapeamentos ativos no ciclo
      const matchingMovements = movements.filter((m) => {
        const isExpense = m.type === 'PAGAR' || m.type === 'CARTAO';
        const inMonth = movementCompetenceDate(m).startsWith(selectedMonthKey);
        const nameMatch = m.natureId === nat.id || m.category.toLowerCase() === nat.name.toLowerCase();
        const itemMatch = nat.mappings.some((mp) => {
          if (
            mp.applicableMonths &&
            mp.applicableMonths.length > 0 &&
            !mp.applicableMonths.includes(selectedMonthNumber)
          ) {
            return false;
          }
          return mp.items.some((it) => it.id === m.mappingItemId || it.description.toLowerCase() === m.title.toLowerCase());
        });
        return isExpense && inMonth && m.status !== 'CANCELADA' && (nameMatch || itemMatch);
      });

      // Mapeamentos ativos no mês de competência
      const natItems: Array<{
        natureName: string;
        natureColor: string;
        mappingName: string;
        item: MappingItem;
      }> = [];

      nat.mappings.forEach((m) => {
        if (
          m.applicableMonths &&
          m.applicableMonths.length > 0 &&
          !m.applicableMonths.includes(selectedMonthNumber)
        ) {
          return;
        }
        m.items.forEach((it) => {
          natItems.push({
            natureName: nat.name,
            natureColor: nat.color,
            mappingName: m.name,
            item: it,
          });
        });
      });

      // 2. Real (já pago) | Previsto (ainda a pagar) no mês.
      // Itens mapeados: pagamentos registrados no item; se o item também foi lançado como movimentação
      // de mesmo nome, vale a movimentação (evita contar duas vezes). Movimentações da natureza que não
      // correspondem a itens (avulsos, compras classificadas) entram pelo status.
      const norm = (t: string) => t.trim().toLowerCase();
      const itemTitles = new Set(natItems.map((ni) => norm(ni.item.description)));
      const itemIds = new Set(natItems.map((ni) => ni.item.id));
      let real = 0;
      let pending = 0;
      const payments: { date: string; description: string; amount: number }[] = [];
      // O que passou do previsto: itens pagos/lançados acima do valor do mês e lançamentos fora dos itens
      const overages: { name: string; amount: number }[] = [];
      natItems.forEach((ni) => {
        const summary = resolveMappingItemMonth(ni.item, selectedMonthKey);
        if (isExcludedState(summary.state)) return;
        const launched = matchingMovements.filter((m) => m.mappingItemId === ni.item.id || norm(m.title) === norm(ni.item.description));
        if (launched.length > 0) {
          let launchedTotal = 0;
          launched.forEach((m) => {
            launchedTotal += m.amount;
            if (m.status === 'REALIZADA') real += m.amount;
            else pending += m.amount;
          });
          if (launchedTotal - summary.base > 0.005) overages.push({ name: ni.item.description, amount: launchedTotal - summary.base });
          return;
        }
        real += summary.paid;
        pending += summary.pending;
        if (summary.paid + summary.pending - summary.base > 0.005) {
          overages.push({ name: ni.item.description, amount: summary.paid + summary.pending - summary.base });
        }
        summary.payments.forEach((p) => payments.push({ date: p.paidAt, description: ni.item.description, amount: p.amount }));
      });
      matchingMovements
        .filter((m) => !itemTitles.has(norm(m.title)) && !(m.mappingItemId && itemIds.has(m.mappingItemId)))
        .forEach((m) => {
          if (m.status === 'REALIZADA') real += m.amount;
          else pending += m.amount;
          overages.push({ name: m.title, amount: m.amount });
        });
      real = Math.round(real * 100) / 100;
      pending = Math.round(pending * 100) / 100;

      // Semana/quinzena: teto, real e previsto vêm só das compras do período (contas avulsas não entram no teto)
      const periodPayments: { date: string; description: string; amount: number }[] = [];
      if (period !== 'MES') {
        const mine = periodItems.filter((it) => it.natureId === nat.id);
        planned = Math.round(mine.filter((it) => !it.movementId).reduce((acc, it) => acc + it.planned, 0) * 100) / 100;
        // Real = o que foi pago DENTRO do período, pela data do pagamento (não pela data prevista da compra)
        const events: { date: string; description: string; amount: number }[] = [];
        periodMonthKeys.forEach((key) => {
          const monthNum = parseInt(key.slice(5, 7), 10);
          const monthItems = nat.mappings
            .filter((mp) => !(mp.applicableMonths && mp.applicableMonths.length > 0 && !mp.applicableMonths.includes(monthNum)))
            .flatMap((mp) => mp.items);
          const titles = new Set(monthItems.map((it) => norm(it.description)));
          const ids = new Set(monthItems.map((it) => it.id));
          const monthMovs = movements.filter(
            (m) =>
              (m.type === 'PAGAR' || m.type === 'CARTAO') &&
              movementCompetenceDate(m).startsWith(key) &&
              m.status !== 'CANCELADA' &&
              (m.natureId === nat.id ||
                m.category.toLowerCase() === nat.name.toLowerCase() ||
                monthItems.some((it) => it.id === m.mappingItemId || norm(it.description) === norm(m.title)))
          );
          const addPaid = (m: (typeof monthMovs)[number]) => {
            if (m.status === 'REALIZADA') events.push({ date: m.paymentDate || m.dueDate, description: m.title, amount: m.amount });
          };
          monthItems.forEach((it) => {
            const summary = resolveMappingItemMonth(it, key);
            if (isExcludedState(summary.state)) return;
            const launched = monthMovs.filter((m) => m.mappingItemId === it.id || norm(m.title) === norm(it.description));
            if (launched.length > 0) {
              launched.forEach(addPaid);
              return;
            }
            summary.payments.forEach((pay) => events.push({ date: pay.paidAt, description: it.description, amount: pay.amount }));
          });
          monthMovs.filter((m) => !titles.has(norm(m.title)) && !(m.mappingItemId && ids.has(m.mappingItemId))).forEach(addPaid);
        });
        const startDate = activeCheckpoint?.startDate || '';
        events
          .filter((e) => e.date >= periodRange.from && e.date <= periodRange.to && e.date >= startDate)
          .forEach((e) => periodPayments.push(e));
        real = Math.round(periodPayments.reduce((acc, e) => acc + e.amount, 0) * 100) / 100;
        pending = 0;
        mine.forEach((it) =>
          it.purchases.forEach((p) => {
            if (p.status === 'PREVISTA' || p.status === 'ATRASADA') pending += Math.max(0, p.plannedAmount - (p.paidAmount || 0));
          })
        );
        pending = Math.round(pending * 100) / 100;
      }
      const realized = real;

      // 3. Disponível (teto - real) e situação: acima do teto quando real + previsto passam do teto
      const diff = Math.round((planned - realized) * 100) / 100;
      const pct = planned > 0 ? Math.round((realized / planned) * 100) : (realized > 0 ? 100 : 0);
      const isOver = planned > 0 && realized + pending > planned + 0.005;

      // 4. Última transação: somente pagamentos reais (movimentações realizadas ou pagamentos de itens)
      if (period === 'MES') {
        matchingMovements.filter((m) => m.status === 'REALIZADA').forEach((m) =>
          payments.push({ date: m.paymentDate || m.dueDate, description: m.title, amount: m.amount })
        );
      }
      const latestPayment = [...(period === 'MES' ? payments : periodPayments)].sort((a, b) => b.date.localeCompare(a.date))[0];
      const lastTx: NatureBudgetRow['lastTransaction'] = latestPayment
        ? {
            dateFormatted: latestPayment.date.split('-').reverse().join('/'),
            description: latestPayment.description,
            amount: latestPayment.amount,
          }
        : null;

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

          // Verifica se o título do movimento corresponde a algum item da rotina fixa recorrente deste mês
          const isRecognizedRoutineItem = nat.mappings.some((mp) => {
            if (
              mp.applicableMonths &&
              mp.applicableMonths.length > 0 &&
              !mp.applicableMonths.includes(selectedMonthNumber)
            ) {
              return false;
            }
            return (
              mp.frequency !== 'PONTUAL' &&
              mp.items.some((it) => it.id === m.mappingItemId || it.description.trim().toLowerCase() === m.title.trim().toLowerCase())
            );
          });

          const isAtypical = hasAtypicalKeyword || !isRecognizedRoutineItem;
          allExpenses.push({
            name: m.title,
            amount: m.amount,
            isAtypical,
          });
        });
      } else if (natItems.length > 0) {
        nat.mappings.forEach((mp) => {
          if (
            mp.applicableMonths &&
            mp.applicableMonths.length > 0 &&
            !mp.applicableMonths.includes(selectedMonthNumber)
          ) {
            return;
          }
          const isMappingPontual =
            mp.frequency === 'PONTUAL' || ATYPICAL_KEYWORD_REGEX.test(mp.name);
          mp.items.forEach((it) => {
            const itemVal = mappingItemMonthValue(it, selectedMonthKey);
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

      // 6. Regra de Negócios para Observações Analíticas
      let autoObservation = '';

      if (isOver) {
        // Estouro de teto: aponta o que realmente passou do previsto (item acima do valor do mês ou gasto avulso)
        const overBy = Math.round((realized + pending - planned) * 100) / 100;
        const culprit = period !== 'MES' ? undefined : [...overages].sort((a, b) => b.amount - a.amount)[0];
        autoObservation = culprit
          ? `Excedente de ${formatBRL(overBy)} impactado por: ${culprit.name} (${formatBRL(culprit.amount)} acima do previsto).`
          : `Excedente de ${formatBRL(overBy)} sobre o teto ${period === 'MES' ? 'do mês' : `d${period === 'SEMANA' ? 'a semana' : 'a quinzena'}`}.`;
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
        pendingAmount: pending,
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
  }, [currentRow, natures, movements, selectedMonthKey, getNatureCeiling, period, periodItems, periodMonthKeys, periodRange, activeCheckpoint?.startDate]);

  // Filtragem por status do teto
  const filteredRows = useMemo(() => {
    return natureRows.filter((r) => {
      // Filtro de status
      let matchesStatus = true;
      if (statusFilter === 'OVER') matchesStatus = r.isOverCeiling;
      if (statusFilter === 'WITHIN') matchesStatus = !r.isOverCeiling;

      return matchesStatus;
    });
  }, [natureRows, statusFilter]);

  // Totais consolidados do grid de naturezas
  const summaryTotals = useMemo(() => {
    const totalPlanned = natureRows.reduce((acc, r) => acc + r.plannedAmount, 0);
    const totalRealized = natureRows.reduce((acc, r) => acc + r.realizedAmount, 0);
    const totalPending = natureRows.reduce((acc, r) => acc + r.pendingAmount, 0);
    const totalDiff = totalPlanned - totalRealized; // disponível: teto - real
    const overCount = natureRows.filter((r) => r.isOverCeiling).length;
    const withinCount = natureRows.length - overCount;
    const avgPct = totalPlanned > 0 ? Math.round((totalRealized / totalPlanned) * 100) : 0;

    return {
      totalPlanned,
      totalRealized,
      totalPending,
      totalDiff,
      overCount,
      withinCount,
      avgPct,
    };
  }, [natureRows]);

  // Abrir modal de detalhamento para uma natureza específica
  const hasAlert = (row: NatureBudgetRow) => row.hasAttentionPoint && !!row.observations && row.observations !== '-';

  // Com alerta, mostra primeiro o pop-up; sem alerta, abre direto as movimentações
  const handleNatureClick = (row: NatureBudgetRow) => {
    if (hasAlert(row)) setAlertRow(row);
    else handleOpenNatureDetail(row);
  };

  const handleOpenNatureDetail = (row: NatureBudgetRow) => {
    if (!currentRow) return;
    // Abre pelas saídas totais com foco na natureza: "Todas as naturezas" (subir um nível) mostra
    // todas as naturezas do mês, não só as que têm itens no cartão
    setCellSelection({
      columnKey: 'totalExpense',
      columnTitle: `Detalhes — ${row.name}`,
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
      <div className="nature-grid-header nature-grid-header-stacked">
        {/* Linha 1: título e período */}
        <div className="nature-grid-row">
          <h2 className="nature-grid-title">Naturezas</h2>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {period === 'MES' ? (
            /* Seletor de Competência */
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
          ) : null}
        </div>
        </div>

        {/* Linha 2: filtro do teto */}
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
      </div>

      {/* Visualização em Cards */}
        <div className="nature-cards-scroll">
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
              onClick={() => handleNatureClick(row)}
              title="Clique para ver os lançamentos desta natureza"
            >
              {(() => {
                const realPct = row.plannedAmount > 0 ? Math.min(100, (row.realizedAmount / row.plannedAmount) * 100) : 0;
                const pendingPct =
                  row.plannedAmount > 0 ? Math.min(100 - realPct, (row.pendingAmount / row.plannedAmount) * 100) : 0;
                return (
                  <>
                    {/* Nome e situação */}
                    <div className="nature-card-header">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="nature-color-dot flex-shrink-0" style={{ backgroundColor: row.color || '#38BDF8' }} />
                        <strong className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }} title={row.name}>
                          {row.name}
                        </strong>
                      </div>
                      <span
                        className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          row.isOverCeiling
                            ? 'bg-rose-500/20 text-rose border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald border border-emerald-500/30'
                        }`}
                        title={row.isOverCeiling ? 'Real + Previsto passam do teto' : 'Real + Previsto dentro do teto'}
                      >
                        {row.isOverCeiling ? '⚠️ Acima do teto' : '✓ No teto'}
                      </span>
                    </div>

                    {/* Barra: Real (sólido) + Previsto (claro) sobre o teto */}
                    <div
                      className="nature-card-rp-bar"
                      title={`Real ${formatBRL(row.realizedAmount)} + Previsto ${formatBRL(row.pendingAmount)} de ${formatBRL(row.plannedAmount)}`}
                    >
                      <div className={`real ${row.isOverCeiling ? 'over' : ''}`} style={{ width: `${realPct}%` }} />
                      <div className={`planned ${row.isOverCeiling ? 'over' : ''}`} style={{ width: `${pendingPct}%` }} />
                    </div>

                    {/* Real | Previsto e Teto */}
                    <div className="nature-card-rp-values">
                      <div>
                        <span className="nature-card-metric-label">Real</span>
                        <span className="font-mono font-bold text-xs text-emerald">{formatBRL(row.realizedAmount)}</span>
                      </div>
                      <div>
                        <span className="nature-card-metric-label">Previsto</span>
                        <span className="font-mono font-bold text-xs text-amber">{formatBRL(row.pendingAmount)}</span>
                      </div>
                      <div className="text-right">
                        <span className="nature-card-metric-label">Teto</span>
                        <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {formatBRL(row.plannedAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Estouro: aponta o maior causador */}
                    {hasAlert(row) && (
                      <p
                        className="nature-card-alert"
                        title={row.observations}
                        style={row.isOverCeiling ? undefined : { color: '#fbbf24' }}
                      >
                        <AlertTriangle size={11} className="flex-shrink-0" />
                        <span className="truncate">{row.observations}</span>
                      </p>
                    )}

                    {/* Último pagamento real */}
                    <div className="nature-card-last">
                      {row.lastTransaction ? (
                        <>
                          <span className="truncate">
                            Último pagamento: {row.lastTransaction.dateFormatted} • {row.lastTransaction.description}
                          </span>
                          <span className="font-mono font-bold flex-shrink-0">{formatBRL(row.lastTransaction.amount)}</span>
                        </>
                      ) : (
                        <span>Nenhum pagamento {periodLabels.this}</span>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          ))}

          {filteredRows.length === 0 && (
            <div className="glass-card text-center py-8 text-muted text-xs col-span-full" style={{ width: '100%' }}>
              Nenhuma natureza encontrada para o filtro selecionado.
            </div>
          )}
        </div>
        </div>

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

      {/* Pop-up com as descrições dos alertas da natureza */}
      {alertRow && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setAlertRow(null)}>
          <div
            className="glass-card p-4 rounded-xl max-w-md w-full"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <h3 className="text-sm font-bold flex items-center gap-2 min-w-0" style={{ color: 'var(--text-primary)' }}>
                <AlertTriangle size={15} className={alertRow.isOverCeiling ? 'text-rose' : 'text-amber'} />
                <span className="truncate">Alertas — {alertRow.name}</span>
              </h3>
              <button type="button" onClick={() => setAlertRow(null)} className="text-muted hover:text-primary cursor-pointer" aria-label="Fechar">
                <X size={16} />
              </button>
            </div>

            <ul className="my-3 flex flex-col gap-2">
              {alertRow.observations
                .split(' • ')
                .filter(Boolean)
                .map((text, i) => (
                  <li
                    key={i}
                    className="text-xs p-2.5 rounded-lg"
                    style={{
                      background: alertRow.isOverCeiling ? 'rgba(244,63,94,0.10)' : 'rgba(245,158,11,0.10)',
                      border: `1px solid ${alertRow.isOverCeiling ? 'rgba(244,63,94,0.30)' : 'rgba(245,158,11,0.30)'}`,
                      color: 'var(--text-primary)',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {text}
                  </li>
                ))}
            </ul>

            <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
              <div className="p-1.5 rounded-lg bg-black/20">
                <span className="text-[10px] text-muted block uppercase font-semibold">Real</span>
                <span className="font-mono font-bold text-emerald">{formatBRL(alertRow.realizedAmount)}</span>
              </div>
              <div className="p-1.5 rounded-lg bg-black/20">
                <span className="text-[10px] text-muted block uppercase font-semibold">Previsto</span>
                <span className="font-mono font-bold text-amber">{formatBRL(alertRow.pendingAmount)}</span>
              </div>
              <div className="p-1.5 rounded-lg bg-black/20">
                <span className="text-[10px] text-muted block uppercase font-semibold">Teto</span>
                <span className="font-mono">{formatBRL(alertRow.plannedAmount)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setAlertRow(null)} className="btn btn-secondary text-xs py-1 px-3">
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  const row = alertRow;
                  setAlertRow(null);
                  handleOpenNatureDetail(row);
                }}
                className="btn btn-primary text-xs py-1 px-3"
              >
                Ver movimentações
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
