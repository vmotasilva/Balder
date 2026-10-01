import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { InfoButton } from '../components/InfoButton';
import { isCashInHand } from '../utils/cashInHand';
import { movementCompetenceDate } from '../utils/projectionMath';
import { useFinancial } from '../context/FinancialContext';
import {
  Plus,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  Zap,
  X,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  Layers,
  TrendingUp,
  TrendingDown,
  Building2,
  CreditCard,
} from 'lucide-react';
import type { Movement, MovementType } from '../types';
import { calculatePresentValue, groupLoanMovements } from '../utils/loanMath';
import { LoanPrepaymentModal } from '../components/LoanPrepaymentModal';
import { MovementDetailModal } from '../components/MovementDetailModal';
import { ImmediateActionsModal } from '../components/ImmediateActionsModal';
import { ConfirmDialog, useConfirmDialog } from '../components/ConfirmDialog';
import { RealizationConfirmModal, realizedMovementUpdates, reopenConfirmOptions, reopenedMovementUpdates, type RealizationTarget } from '../components/RealizationConfirmModal';
import { getPendingFixedBills, type PendingFixedBill } from '../utils/fixedBillsAlert';

interface MovementsPageProps {
  onOpenNewMovementModal: (defaultType?: MovementType, initialData?: Partial<Movement>) => void;
  onOpenNewRecordPicker?: () => void;
}

type TabFilter = 'TODOS' | 'RECEBER' | 'PAGAR' | 'EMPRESTIMO' | 'CARTAO';
type StatusFilter = 'TODOS' | 'PREVISTA' | 'REALIZADA';
type OriginFilter = 'TODOS' | 'CONTA' | 'DINHEIRO';

const SHORT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** "2026-10" → "Out/2026" */
const shortCompetenceLabel = (key: string) => `${SHORT_MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(0, 4)}`;

const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Tipos de movimentação exibidos como chips no filtro
const TYPE_TABS: { id: TabFilter; label: string; Icon: typeof Layers; tone: string }[] = [
  { id: 'TODOS', label: 'Tudo', Icon: Layers, tone: 'text-cyan' },
  { id: 'RECEBER', label: 'Receber', Icon: TrendingUp, tone: 'text-emerald' },
  { id: 'PAGAR', label: 'Pagar', Icon: TrendingDown, tone: 'text-rose' },
  { id: 'EMPRESTIMO', label: 'Empréstimos', Icon: Building2, tone: 'text-amber' },
  { id: 'CARTAO', label: 'Cartões', Icon: CreditCard, tone: 'text-purple' },
];

const getCompetenceLabel = (yearMonthStr: string): string => {
  if (!yearMonthStr || yearMonthStr.length < 7) return yearMonthStr || 'Sem Data';
  const [year, month] = yearMonthStr.split('-');
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const mIndex = parseInt(month, 10) - 1;
  if (mIndex >= 0 && mIndex < 12) {
    return `${monthNames[mIndex]} de ${year}`;
  }
  return yearMonthStr;
};

export const MovementsPage: React.FC<MovementsPageProps> = ({ onOpenNewMovementModal, onOpenNewRecordPicker }) => {
  const {
    movements,
    natures,
    addMovement,
    deleteMovement,
    updateMovement,
    toggleItemFulfilled,
    exportToCSV,
    activeCheckpoint,
  } = useFinancial();

  // Confirm Dialog
  const { confirm: confirmAction, dialogProps: confirmDialogProps } = useConfirmDialog();
  // Pop-up que confere valor e data antes de dar baixa num pagamento ou recebimento
  const [realization, setRealization] = useState<RealizationTarget | null>(null);

  const [includePreCheckpoint, setIncludePreCheckpoint] = useState(false);

  // Contas fixas pendentes dispensadas temporariamente no banner
  const [dismissedBills, setDismissedBills] = useState<Record<string, boolean>>({});

  // Contas com vencimento fixo no mês pendentes de pagamento
  const pendingFixedBills = useMemo(() => {
    return getPendingFixedBills(natures, movements, new Date(), 3);
  }, [natures, movements]);

  const activePendingBills = useMemo(() => {
    return pendingFixedBills.filter((b) => !dismissedBills[`${b.natureId}_${b.mappingId}`]);
  }, [pendingFixedBills, dismissedBills]);

  // Ação rápida: Confirmar pagamento de conta fixa (valor e data conferidos no pop-up)
  const handleConfirmBillDirectly = (bill: PendingFixedBill, amount: number, paidAt: string) => {
    addMovement({
      title: `${bill.mappingName} (${bill.natureName})`,
      type: 'PAGAR',
      amount,
      actualAmount: amount,
      ...(Math.abs(amount - bill.totalAmount) >= 0.005 ? { originalAmount: bill.totalAmount } : {}),
      dueDate: bill.dueDate,
      paymentDate: paidAt,
      bank: 'Nubank',
      status: 'REALIZADA',
      category: bill.natureName,
      notes: `Pagamento automático de conta fixa mapeada (${bill.itemDescriptions.join(', ')})`,
    });

    bill.items.forEach((item) => {
      if (!item.isFulfilled) {
        toggleItemFulfilled(bill.natureId, bill.mappingId, item.id);
      }
    });

    setDismissedBills((prev) => ({ ...prev, [`${bill.natureId}_${bill.mappingId}`]: true }));
  };

  // Ação rápida: Ajustar valor antes de lançar
  const handleAdjustBillMovement = (bill: PendingFixedBill) => {
    onOpenNewMovementModal('PAGAR', {
      title: `${bill.mappingName} (${bill.natureName})`,
      amount: bill.totalAmount,
      dueDate: bill.dueDate,
      bank: 'Nubank',
      category: bill.natureName,
      status: 'REALIZADA',
      type: 'PAGAR',
      notes: `Conta fixa de ${bill.mappingName} com vencimento no dia ${bill.dayOfMonth}`,
    });
  };

  // Apenas movimentações reais do usuário (sem preencher com projeções virtuais)
  const allMovements = movements;

  const handleSalaryQuickAction = () => {
    onOpenNewMovementModal('RECEBER', {
      title: 'Salário',
      category: 'Salário',
      type: 'RECEBER',
    });
  };

  const [activeTab, setActiveTab] = useState<TabFilter>('TODOS');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS');
  const [bankFilter, setBankFilter] = useState<string>('TODOS');
  // Origem do dinheiro: em conta (bancos, cartões) ou em mãos
  const [originFilter, setOriginFilter] = useState<OriginFilter>('TODOS');
  const [searchQuery, setSearchQuery] = useState('');

  // Ordenação e agrupamento por competência
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [groupByCompetence, setGroupByCompetence] = useState<boolean>(true);
  // Abre no mês atual; "Todos os meses" continua na lista
  const currentMonthKey = monthKeyOf(new Date());
  const [selectedCompetence, setSelectedCompetence] = useState<string>(currentMonthKey);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFiltersOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtersOpen]);
  const [collapsedCompetences, setCollapsedCompetences] = useState<Record<string, boolean>>({});

  const preCheckpointCount = useMemo(() => {
    if (!activeCheckpoint) return 0;
    return allMovements.filter((m) => m.dueDate < activeCheckpoint.startDate).length;
  }, [allMovements, activeCheckpoint]);

  // Contagem de cada tipo no mês escolhido
  const tabCounts = useMemo(() => {
    const base = allMovements.filter(
      (m) =>
        (!activeCheckpoint || includePreCheckpoint || m.dueDate >= activeCheckpoint.startDate) &&
        (selectedCompetence === 'TODAS' || (!!m.dueDate && movementCompetenceDate(m).startsWith(selectedCompetence)))
    );
    return {
      TODOS: base.length,
      RECEBER: base.filter((m) => m.type === 'RECEBER').length,
      PAGAR: base.filter((m) => m.type === 'PAGAR').length,
      EMPRESTIMO: base.filter((m) => m.type === 'EMPRESTIMO').length,
      CARTAO: base.filter((m) => m.type === 'CARTAO').length,
    };
  }, [allMovements, activeCheckpoint, includePreCheckpoint, selectedCompetence]);

  // Setas do mês: sem mês escolhido, partem do mês atual
  const shiftCompetence = (delta: number) => {
    const [y, m] = (selectedCompetence === 'TODAS' ? currentMonthKey : selectedCompetence).split('-').map(Number);
    setSelectedCompetence(monthKeyOf(new Date(y, m - 1 + delta, 1)));
  };

  // Rótulos da situação conforme o tipo aberto
  const statusLabels =
    activeTab === 'RECEBER'
      ? { open: 'A receber', done: 'Recebidas' }
      : activeTab === 'TODOS'
      ? { open: 'Abertas', done: 'Quitadas' }
      : { open: 'A pagar', done: 'Pagas' };

  // Bancos que aparecem nos lançamentos (dinheiro em mãos tem filtro próprio em Origem)
  const bankOptions = useMemo(
    () =>
      Array.from(new Set(allMovements.map((m) => (m.bank || '').trim()).filter((b) => b && !isCashInHand(b)))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      ),
    [allMovements]
  );

  const advancedCount =
    (originFilter !== 'TODOS' ? 1 : 0) +
    (bankFilter !== 'TODOS' ? 1 : 0) +
    (sortOrder !== 'ASC' ? 1 : 0) +
    (!groupByCompetence ? 1 : 0) +
    (includePreCheckpoint ? 1 : 0);

  const clearAdvancedFilters = () => {
    setOriginFilter('TODOS');
    setBankFilter('TODOS');
    setSortOrder('ASC');
    setGroupByCompetence(true);
    setIncludePreCheckpoint(false);
  };

  // Modal de Simulação e Antecipação de Empréstimos
  const [prepaymentModalOpen, setPrepaymentModalOpen] = useState(false);
  const [selectedPrepayGroup, setSelectedPrepayGroup] = useState<string | undefined>(undefined);
  const [selectedPrepayMovement, setSelectedPrepayMovement] = useState<string | undefined>(undefined);

  // Modal de Detalhes e Ajuste de Realidade por Tipo de Transação
  const [selectedMovementForDetail, setSelectedMovementForDetail] = useState<Movement | null>(null);

  // Modal de Ações Imediatas
  const [isImmediateActionsOpen, setIsImmediateActionsOpen] = useState(false);

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

      // Origem
      if (originFilter === 'DINHEIRO' && !isCashInHand(item.bank)) return false;
      if (originFilter === 'CONTA' && isCashInHand(item.bank)) return false;

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
  }, [allMovements, activeTab, statusFilter, originFilter, bankFilter, searchQuery, activeCheckpoint, includePreCheckpoint]);

  // Ordenação prioritária por data de vencimento:
  // 'ASC' (Padrão): Vencimentos mais próximos e iminentes no topo (e.g. Set/2026 antes de 2027)
  // 'DESC': Vencimentos mais distantes no futuro no topo
  const sortedMovements = useMemo(() => {
    return [...filteredMovements].sort((a, b) => {
      const dateA = a.dueDate || '';
      const dateB = b.dueDate || '';
      const cmp = dateA.localeCompare(dateB);
      if (cmp !== 0) {
        return sortOrder === 'ASC' ? cmp : -cmp;
      }
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [filteredMovements, sortOrder]);

  // Lista de competências disponíveis nas movimentações filtradas
  const availableCompetences = useMemo(() => {
    const set = new Set<string>();
    filteredMovements.forEach((m) => {
      if (m.dueDate && m.dueDate.length >= 7) {
        set.add(movementCompetenceDate(m).substring(0, 7));
      }
    });
    const sorted = Array.from(set).sort();
    return sortOrder === 'ASC' ? sorted : sorted.reverse();
  }, [filteredMovements, sortOrder]);

  // Meses da lista: os que têm lançamentos, o atual e o escolhido
  const competenceOptions = useMemo(
    () =>
      Array.from(new Set([...availableCompetences, currentMonthKey, ...(selectedCompetence !== 'TODAS' ? [selectedCompetence] : [])])).sort(),
    [availableCompetences, currentMonthKey, selectedCompetence]
  );

  // Movimentações finais a exibir após filtro específico de competência
  const displayedMovements = useMemo(() => {
    if (selectedCompetence === 'TODAS') return sortedMovements;
    return sortedMovements.filter((m) => m.dueDate && movementCompetenceDate(m).startsWith(selectedCompetence));
  }, [sortedMovements, selectedCompetence]);

  // Resumo por origem (em conta × dinheiro em mãos) do que está na tela
  const originSummary = useMemo(() => {
    const blank = () => ({ income: 0, expense: 0, count: 0 });
    const result = { CONTA: blank(), DINHEIRO: blank() };
    displayedMovements.forEach((m) => {
      if (m.status === 'CANCELADA') return;
      const bucket = isCashInHand(m.bank) ? result.DINHEIRO : result.CONTA;
      if (m.type === 'RECEBER') bucket.income += m.amount;
      else bucket.expense += m.amount;
      bucket.count += 1;
    });
    return result;
  }, [displayedMovements]);

  // Estrutura agrupada por competência (Mês/Ano)
  interface CompetenceGroup {
    key: string;
    label: string;
    isCurrentMonth: boolean;
    isPast: boolean;
    items: Movement[];
    subtotalIncome: number;
    subtotalExpense: number;
    subtotalNet: number;
  }

  const competenceGroups = useMemo(() => {
    const map = new Map<string, Movement[]>();
    const nowMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    displayedMovements.forEach((item) => {
      const key = item.dueDate && item.dueDate.length >= 7 ? movementCompetenceDate(item).substring(0, 7) : 'Sem Data';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });

    const groups: CompetenceGroup[] = [];
    map.forEach((items, key) => {
      let subtotalIncome = 0;
      let subtotalExpense = 0;

      items.forEach((item) => {
        if (item.type === 'RECEBER') {
          subtotalIncome += item.amount;
        } else {
          subtotalExpense += item.amount;
        }
      });

      const isCurrentMonth = key === nowMonth;
      const isPast = key !== 'Sem Data' && key < nowMonth;

      groups.push({
        key,
        label: key !== 'Sem Data' ? getCompetenceLabel(key) : 'Sem Data Definida',
        isCurrentMonth,
        isPast,
        items,
        subtotalIncome,
        subtotalExpense,
        subtotalNet: subtotalIncome - subtotalExpense,
      });
    });

    return groups;
  }, [displayedMovements]);

  const toggleCompetenceCollapse = (key: string) => {
    setCollapsedCompetences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Totais
  const totalReceber = useMemo(() => {
    return displayedMovements
      .filter((m) => m.type === 'RECEBER' && m.status === 'PREVISTA')
      .reduce((acc, cur) => acc + cur.amount, 0);
  }, [displayedMovements]);

  const totalPagar = useMemo(() => {
    return displayedMovements
      .filter((m) => (m.type === 'PAGAR' || m.type === 'EMPRESTIMO' || m.type === 'CARTAO') && m.status === 'PREVISTA')
      .reduce((acc, cur) => acc + cur.amount, 0);
  }, [displayedMovements]);

  const renderMovementRow = (item: Movement) => {
    const isIncome = item.type === 'RECEBER';
    const isRealized = item.status === 'REALIZADA';

    // Cálculo reativo do valor se pago hoje para empréstimos
    let todayPrepayment = null;
    if (item.type === 'EMPRESTIMO' && !isRealized) {
      const rate = item.interestRatePercent || 3.03;
      todayPrepayment = calculatePresentValue(item.amount, item.dueDate, todayStr, rate);
    }

    const formattedDueDate = item.dueDate ? item.dueDate.split('-').reverse().join('/') : '-';

    return (
      <tr
        key={item.id}
        className={`${isRealized ? 'row-realized' : ''}`}
        style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
        onClick={() => setSelectedMovementForDetail(item)}
        title="Clique para abrir os detalhes e ajustar o valor real da transação"
      >
        {/* Toggle Status Checkbox */}
        <td>
          <button
            className={`status-toggle-btn ${isRealized ? 'checked' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isRealized) {
                confirmAction(reopenConfirmOptions(item, () => updateMovement(item.id, reopenedMovementUpdates(item))));
                return;
              }
              setRealization({
                kind: isIncome ? 'ENTRADA' : 'SAIDA',
                title: item.title,
                expectedAmount: item.amount,
                dueDate: item.dueDate,
                onConfirm: (amount, date) => updateMovement(item.id, realizedMovementUpdates(item, amount, date)),
              });
            }}
            title={isRealized ? 'Marcar como prevista' : 'Confirmar liquidação'}
          >
            {isRealized ? <CheckCircle2 size={18} className="text-emerald" /> : <Clock size={18} className="text-muted" />}
          </button>
        </td>

        {/* Title */}
        <td>
          <div className="item-title-col">
            <div className="flex items-center gap-2">
              <span className={`item-title ${isRealized ? 'line-through' : ''}`}>{item.title}</span>
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
          <span className="date-text font-mono">{formattedDueDate}</span>
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
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="btn btn-ghost btn-xs text-cyan"
              style={{ padding: '4px' }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMovementForDetail(item);
              }}
              title="Ajustar valor e tratativa da transação"
            >
              <SlidersHorizontal size={15} />
            </button>
            <button
              type="button"
              className="delete-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                confirmAction({
                  title: 'Excluir Movimentação',
                  message: `Deseja excluir a movimentação "${item.notes}"? Esta ação não pode ser desfeita.`,
                  confirmLabel: 'Excluir',
                  onConfirm: () => deleteMovement(item.id),
                });
              }}
              title="Excluir movimentação"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header movements-page-header">
        <div className="movements-header-title-box">
          <div className="kicker-badge">
            <span>CENTRAL OPERACIONAL</span>
          </div>
          <h1 className="page-title movements-page-title">Minhas Movimentações</h1>
          <p className="page-subtitle movements-page-subtitle">Acompanhe entradas, saídas, parcelas de empréstimos e faturas de cartão</p>
        </div>

        {/* No celular os três ficam lado a lado só com o ícone (o nome vai no title/aria-label) */}
        <div className="page-header-actions mv-header-actions">
          <button
            type="button"
            className="btn btn-outline mv-header-btn mv-btn-redundant"
            onClick={() => setIsImmediateActionsOpen(true)}
            title="Ações Imediatas"
            aria-label="Ações Imediatas (7 ações)"
          >
            <Zap size={16} className="text-amber-400 fill-amber-400" />
            <span className="mv-header-btn-label">Ações Imediatas</span>
            <span className="mv-header-btn-count" aria-hidden="true">7</span>
          </button>
          <button
            type="button"
            className="btn btn-outline mv-header-btn"
            onClick={exportToCSV}
            title="Exportar tabela para planilha CSV"
            aria-label="Exportar CSV"
          >
            <Download size={16} />
            <span className="mv-header-btn-label">Exportar CSV</span>
          </button>
          <button
            type="button"
            className="btn btn-primary mv-header-btn mv-btn-redundant"
            onClick={() => (onOpenNewRecordPicker ? onOpenNewRecordPicker() : onOpenNewMovementModal('PAGAR'))}
            title="Nova Movimentação"
            aria-label="Nova Movimentação"
          >
            <Plus size={16} />
            <span className="mv-header-btn-label">Nova Movimentação</span>
          </button>
        </div>
      </div>

      {/* BANNER DE LEMBRETE E CONFIRMAÇÃO DE CONTAS FIXAS PREVISTAS NO MÊS */}
      {activePendingBills.length > 0 && (
        <div className="pending-bills-movements-container mb-4">
          {activePendingBills.map((bill) => {
            const isLate = bill.isOverdue;
            const isToday = bill.isDueToday;

            return (
              <div
                key={`mov_bill_${bill.natureId}_${bill.mappingId}`}
                className="glass-card animate-fade-in mb-3"
                style={{
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  border: isLate
                    ? '1px solid rgba(239, 68, 68, 0.45)'
                    : isToday
                    ? '1px solid rgba(245, 158, 11, 0.45)'
                    : '1px solid rgba(6, 182, 212, 0.45)',
                  background: isLate
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)'
                    : isToday
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)'
                    : 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: isLate
                        ? 'rgba(239, 68, 68, 0.2)'
                        : isToday
                        ? 'rgba(245, 158, 11, 0.2)'
                        : 'rgba(6, 182, 212, 0.2)',
                      color: isLate ? '#f87171' : isToday ? '#fbbf24' : '#38bdf8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    <Calendar size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                      <span
                        className={`badge ${isLate ? 'badge-rose' : isToday ? 'badge-amber' : 'badge-cyan'}`}
                        style={{ fontSize: '0.7rem' }}
                      >
                        {isLate ? 'CONTA VENCIDA NESTE MÊS' : isToday ? 'VENCE HOJE' : 'VENCIMENTO PRÓXIMO'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Vencimento no Dia {bill.dayOfMonth} ({bill.dueDate.split('-').reverse().join('/')})
                      </span>
                    </div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Você já efetuou o pagamento de {bill.mappingName} ({bill.natureName})?
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>
                      Valor de referência mapeado:{' '}
                      <strong className="text-emerald font-bold" style={{ fontSize: '0.9rem' }}>
                        {bill.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                      {' • '}
                      <span style={{ color: 'var(--text-muted)' }}>
                        Itens: {bill.itemDescriptions.slice(0, 3).join(', ')}{bill.itemDescriptions.length > 3 ? '...' : ''}
                      </span>
                    </p>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {isLate
                        ? 'A data prevista já passou. Clique em "Confirmar" para registrar como pago ou "Ajustar Valor" se o boleto veio com valor diferente.'
                        : 'Confirme com 1 clique se a conta já foi quitada ou faça o ajuste pontual de valor.'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem' }}
                    onClick={() =>
                      setRealization({
                        kind: 'SAIDA',
                        title: `${bill.mappingName} (${bill.natureName})`,
                        expectedAmount: bill.totalAmount,
                        dueDate: bill.dueDate,
                        onConfirm: (amount, paidAt) => handleConfirmBillDirectly(bill, amount, paidAt),
                      })
                    }
                    title="Confirmar pagamento e registrar saída realizada"
                  >
                    <CheckCircle2 size={15} />
                    <span>Confirmar R$ {bill.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem' }}
                    onClick={() => handleAdjustBillMovement(bill)}
                    title="Abrir para alterar o valor real pago antes de lançar"
                  >
                    <Zap size={14} />
                    <span>Ajustar Valor</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '0.45rem 0.6rem', color: 'var(--text-muted)' }}
                    onClick={() => setDismissedBills((prev) => ({ ...prev, [`${bill.natureId}_${bill.mappingId}`]: true }))}
                    title="Lembrar mais tarde"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ImmediateActionsModal
        isOpen={isImmediateActionsOpen}
        onClose={() => setIsImmediateActionsOpen(false)}
        onSalaryAction={handleSalaryQuickAction}
        onOpenNewMovementModal={onOpenNewMovementModal}
      />

      {/* Summary KPI Pills */}
      <div className="movements-kpi-row mb-4">
        <div className="kpi-pill glass-card">
          <span className="kpi-pill-label">A receber</span>
          <span className="kpi-pill-val text-emerald">
            +{totalReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>

        <div className="kpi-pill glass-card">
          <span className="kpi-pill-label">A pagar</span>
          <span className="kpi-pill-val text-rose">
            -{totalPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>

        <div className="kpi-pill glass-card">
          <span className="kpi-pill-label">Resultado</span>
          <span className={`kpi-pill-val ${totalReceber - totalPagar >= 0 ? 'text-cyan' : 'text-rose'}`}>
            {totalReceber - totalPagar >= 0 ? '+' : ''}
            {(totalReceber - totalPagar).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
      </div>

      {/* Card de filtros: tipo, mês e situação, busca; o restante fica em "Filtros" */}
      <div className="movements-filter-panel glass-card mv-filter">
        {/* 1. Tipo (rola para o lado), com a quantidade do mês */}
        <div className="mv-type-chips" role="tablist" aria-label="Tipo de movimentação">
          {TYPE_TABS.map(({ id, label, Icon, tone }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              className={`mv-type-chip ${activeTab === id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={13} className={tone} />
              <span>{label}</span>
              <span className="mv-type-count">{tabCounts[id]}</span>
            </button>
          ))}
        </div>

        {/* 2. Mês (setas ou lista) e situação */}
        <div className="mv-filter-row">
          <div className="mv-month-step">
            <button type="button" onClick={() => shiftCompetence(-1)} aria-label="Mês anterior">
              <ChevronLeft size={15} />
            </button>
            <select
              value={selectedCompetence}
              onChange={(e) => setSelectedCompetence(e.target.value)}
              aria-label="Mês de competência"
            >
              <option value="TODAS">Todos os meses</option>
              {competenceOptions.map((comp) => (
                <option key={comp} value={comp}>
                  {shortCompetenceLabel(comp)}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => shiftCompetence(1)} aria-label="Próximo mês">
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="pill-selector mv-status">
            {(['TODOS', 'PREVISTA', 'REALIZADA'] as StatusFilter[]).map((s) => (
              <button key={s} type="button" className={`pill-btn ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                {s === 'TODOS' ? 'Todas' : s === 'PREVISTA' ? statusLabels.open : statusLabels.done}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Busca e filtros avançados */}
        <div className="mv-filter-row">
          <div className="search-input-box">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Buscar" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <button type="button" className={`mv-filters-btn ${advancedCount > 0 ? 'is-active' : ''}`} onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={14} />
            <span>Filtros</span>
            {advancedCount > 0 && <span className="mv-filters-badge">{advancedCount}</span>}
          </button>
        </div>

        {/* Empréstimos: resumo da carteira e antecipação */}
        {activeTab === 'EMPRESTIMO' && loanGroups.length > 0 && (
          <div className="loan-portfolio-banner glass-card animate-fade-in mt-1 mb-1">
            <div className="loan-portfolio-info">
              <h3 className="text-lg font-bold text-white label-with-info">
                Carteira de Empréstimos
                <InfoButton title="Carteira de empréstimos">
                  <p>
                    Você tem <strong>{loanGroups.reduce((acc, g) => acc + g.openInstallments.length, 0)} parcelas futuras</strong> em
                    aberto.
                  </p>
                  <p>
                    Ao antecipar parcelas, os juros futuros que ainda não correram são descontados por lei (Resolução BACEN nº 3.516,
                    valor presente). "Se quitado hoje" mostra quanto você pagaria antecipando tudo.
                  </p>
                </InfoButton>
              </h3>
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
      </div>

      {/* Filtros avançados: folha que sobe no celular, janela no computador */}
      {/* No body: um ancestral com transform prenderia o position: fixed dentro da página */}
      {filtersOpen && createPortal(
        <div className="mv-sheet-backdrop" onClick={() => setFiltersOpen(false)}>
          <div className="mv-sheet" role="dialog" aria-modal="true" aria-label="Filtros" onClick={(e) => e.stopPropagation()}>
            <div className="mv-sheet-head">
              <strong>Filtros</strong>
              <button type="button" className="mv-sheet-close" onClick={() => setFiltersOpen(false)} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>

            <div className="mv-sheet-field">
              <span>Origem</span>
              <div className="pill-selector">
                {(['TODOS', 'CONTA', 'DINHEIRO'] as OriginFilter[]).map((o) => (
                  <button key={o} type="button" className={`pill-btn ${originFilter === o ? 'active' : ''}`} onClick={() => setOriginFilter(o)}>
                    {o === 'TODOS' ? 'Todas' : o === 'CONTA' ? 'Em conta' : 'Dinheiro em mãos'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mv-sheet-field">
              <span>Banco</span>
              <select className="form-select select-sm" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}>
                <option value="TODOS">Todos os bancos</option>
                {bankOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="mv-sheet-field">
              <span>Ordem</span>
              <div className="pill-selector">
                <button type="button" className={`pill-btn ${sortOrder === 'ASC' ? 'active' : ''}`} onClick={() => setSortOrder('ASC')}>
                  Mais próximos primeiro
                </button>
                <button type="button" className={`pill-btn ${sortOrder === 'DESC' ? 'active' : ''}`} onClick={() => setSortOrder('DESC')}>
                  Mais distantes primeiro
                </button>
              </div>
            </div>

            <div className="mv-sheet-field">
              <span>Agrupar por mês</span>
              <div className="pill-selector">
                <button type="button" className={`pill-btn ${groupByCompetence ? 'active' : ''}`} onClick={() => setGroupByCompetence(true)}>
                  Sim
                </button>
                <button type="button" className={`pill-btn ${!groupByCompetence ? 'active' : ''}`} onClick={() => setGroupByCompetence(false)}>
                  Não
                </button>
              </div>
            </div>

            {activeCheckpoint && preCheckpointCount > 0 && (
              <div className="mv-sheet-field">
                <span>Antes do marco ({activeCheckpoint.startDate.split('-').reverse().join('/')})</span>
                <div className="pill-selector">
                  <button type="button" className={`pill-btn ${!includePreCheckpoint ? 'active' : ''}`} onClick={() => setIncludePreCheckpoint(false)}>
                    Ocultar
                  </button>
                  <button type="button" className={`pill-btn ${includePreCheckpoint ? 'active' : ''}`} onClick={() => setIncludePreCheckpoint(true)}>
                    Mostrar ({preCheckpointCount})
                  </button>
                </div>
              </div>
            )}

            <div className="mv-sheet-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={clearAdvancedFilters}>
                Limpar
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setFiltersOpen(false)}>
                Ver {displayedMovements.length} {displayedMovements.length === 1 ? 'resultado' : 'resultados'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Movements Table */}
      {/* Em conta × dinheiro em mãos, para o que está filtrado na tela */}
      <div className="origin-summary">
        {(['CONTA', 'DINHEIRO'] as const)
          .filter((k) => originFilter === 'TODOS' || (originFilter === 'CONTA' ? k === 'CONTA' : k === 'DINHEIRO'))
          .map((k) => {
            const s = originSummary[k];
            const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            return (
              <button
                key={k}
                type="button"
                className={`origin-summary-card ${originFilter === k ? 'is-active' : ''}`}
                onClick={() => setOriginFilter(originFilter === k ? 'TODOS' : k)}
                title="Filtrar por esta origem"
              >
                <span className="origin-summary-title">
                  {k === 'DINHEIRO' ? '💵 Dinheiro em mãos' : '🏦 Em conta'} <small>({s.count})</small>
                </span>
                <span className="origin-summary-values">
                  <span className="text-emerald">+{fmt(s.income)}</span>
                  <span className="text-rose">−{fmt(s.expense)}</span>
                  <strong className={s.income - s.expense < 0 ? 'text-rose' : 'text-emerald'}>= {fmt(s.income - s.expense)}</strong>
                </span>
              </button>
            );
          })}
      </div>

      <div className="movements-table-card glass-card">
        {displayedMovements.length > 0 ? (
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
                <th style={{ width: '80px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {groupByCompetence ? (
                competenceGroups.map((group) => {
                  const isCollapsed = !!collapsedCompetences[group.key];
                  return (
                    <React.Fragment key={`group_${group.key}`}>
                      <tr className="competence-group-header-row">
                        <td colSpan={8}>
                          <div className="competence-header-content">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <button
                                type="button"
                                className="competence-collapse-toggle"
                                onClick={() => toggleCompetenceCollapse(group.key)}
                                title={isCollapsed ? 'Expandir competência' : 'Recolher competência'}
                              >
                                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                              </button>
                              <span className="competence-title">
                                {group.label}
                              </span>
                              {group.isCurrentMonth && (
                                <span className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                                  COMPETÊNCIA ATUAL
                                </span>
                              )}
                              {group.isPast && (
                                <span className="badge badge-slate" style={{ fontSize: '0.68rem', padding: '2px 7px', background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>
                                  ANTERIOR
                                </span>
                              )}
                              <span className="competence-count-badge">
                                {group.items.length} {group.items.length === 1 ? 'lançamento' : 'lançamentos'}
                              </span>
                            </div>

                            <div className="competence-kpi-summary">
                              {group.subtotalIncome > 0 && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                                  Entradas: +{group.subtotalIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              )}
                              {group.subtotalExpense > 0 && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', fontWeight: 600 }}>
                                  Saídas: -{group.subtotalExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              )}
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: group.subtotalNet >= 0 ? 'var(--accent-cyan)' : 'var(--accent-rose)',
                                borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
                                paddingLeft: '10px'
                              }}>
                                Saldo: {group.subtotalNet >= 0 ? '+' : ''}{group.subtotalNet.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {!isCollapsed && group.items.map((item) => renderMovementRow(item))}
                    </React.Fragment>
                  );
                })
              ) : (
                displayedMovements.map((item) => renderMovementRow(item))
              )}
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

      {/* Modal de Detalhes & Ajuste Específico por Tipo de Transação */}
      <MovementDetailModal
        isOpen={!!selectedMovementForDetail}
        onClose={() => setSelectedMovementForDetail(null)}
        movement={selectedMovementForDetail}
        onOpenPrepaymentSimulator={handleOpenPrepayment}
      />
      <ConfirmDialog {...confirmDialogProps} />
      <RealizationConfirmModal target={realization} onClose={() => setRealization(null)} />
    </div>
  );
};
