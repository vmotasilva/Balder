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
  X,
  Calendar,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  SlidersHorizontal,
} from 'lucide-react';
import type { Movement, MovementType } from '../types';
import { calculatePresentValue, groupLoanMovements } from '../utils/loanMath';
import { LoanPrepaymentModal } from '../components/LoanPrepaymentModal';
import { MovementDetailModal } from '../components/MovementDetailModal';
import { getSalarySuggestion } from '../utils/salarySuggestion';
import { getPendingFixedBills, type PendingFixedBill } from '../utils/fixedBillsAlert';

interface MovementsPageProps {
  onOpenNewMovementModal: (defaultType?: MovementType, initialData?: Partial<Movement>) => void;
}

type TabFilter = 'TODOS' | 'RECEBER' | 'PAGAR' | 'EMPRESTIMO' | 'CARTAO';
type StatusFilter = 'TODOS' | 'PREVISTA' | 'REALIZADA';

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

export const MovementsPage: React.FC<MovementsPageProps> = ({ onOpenNewMovementModal }) => {
  const {
    movements,
    salaryContracts,
    natures,
    addMovement,
    deleteMovement,
    toggleMovementStatus,
    toggleItemFulfilled,
    exportToCSV,
    activeCheckpoint,
  } = useFinancial();

  const [includePreCheckpoint, setIncludePreCheckpoint] = useState(false);
  const [isSalaryPromptDismissed, setIsSalaryPromptDismissed] = useState(false);

  // Contas fixas pendentes dispensadas temporariamente no banner
  const [dismissedBills, setDismissedBills] = useState<Record<string, boolean>>({});

  // Contas com vencimento fixo no mês pendentes de pagamento
  const pendingFixedBills = useMemo(() => {
    return getPendingFixedBills(natures, movements, new Date(), 3);
  }, [natures, movements]);

  const activePendingBills = useMemo(() => {
    return pendingFixedBills.filter((b) => !dismissedBills[`${b.natureId}_${b.mappingId}`]);
  }, [pendingFixedBills, dismissedBills]);

  // Ação rápida: Confirmar pagamento de conta fixa com 1 clique
  const handleConfirmBillDirectly = (bill: PendingFixedBill) => {
    addMovement({
      title: `${bill.mappingName} (${bill.natureName})`,
      type: 'PAGAR',
      amount: bill.totalAmount,
      dueDate: bill.dueDate,
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

  // Sugestão inteligente de recebimento salarial para o período corrente
  const salarySuggestion = useMemo(
    () => getSalarySuggestion(salaryContracts ?? [], movements),
    [salaryContracts, movements]
  );

  const handleSalaryQuickAction = () => {
    onOpenNewMovementModal('RECEBER', {
      title: salarySuggestion.title,
      amount: salarySuggestion.amount,
      dueDate: salarySuggestion.dueDate,
      bank: salarySuggestion.bank,
      category: salarySuggestion.category,
      status: salarySuggestion.status,
      notes: salarySuggestion.notes,
      type: 'RECEBER',
    });
  };

  const handleConfirmSalaryDirectly = () => {
    addMovement({
      title: salarySuggestion.title,
      type: 'RECEBER',
      amount: salarySuggestion.amount,
      dueDate: salarySuggestion.dueDate,
      bank: salarySuggestion.bank,
      status: salarySuggestion.status,
      category: 'Salário',
      notes: salarySuggestion.notes,
    });
    setIsSalaryPromptDismissed(true);
  };

  const [activeTab, setActiveTab] = useState<TabFilter>('TODOS');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS');
  const [bankFilter, setBankFilter] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState('');

  // Ordenação e agrupamento por competência
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [groupByCompetence, setGroupByCompetence] = useState<boolean>(true);
  const [selectedCompetence, setSelectedCompetence] = useState<string>('TODAS');
  const [collapsedCompetences, setCollapsedCompetences] = useState<Record<string, boolean>>({});

  const preCheckpointCount = useMemo(() => {
    if (!activeCheckpoint) return 0;
    return allMovements.filter((m) => m.dueDate < activeCheckpoint.startDate).length;
  }, [allMovements, activeCheckpoint]);

  // Modal de Simulação e Antecipação de Empréstimos
  const [prepaymentModalOpen, setPrepaymentModalOpen] = useState(false);
  const [selectedPrepayGroup, setSelectedPrepayGroup] = useState<string | undefined>(undefined);
  const [selectedPrepayMovement, setSelectedPrepayMovement] = useState<string | undefined>(undefined);

  // Modal de Detalhes e Ajuste de Realidade por Tipo de Transação
  const [selectedMovementForDetail, setSelectedMovementForDetail] = useState<Movement | null>(null);

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
        set.add(m.dueDate.substring(0, 7));
      }
    });
    const sorted = Array.from(set).sort();
    return sortOrder === 'ASC' ? sorted : sorted.reverse();
  }, [filteredMovements, sortOrder]);

  // Movimentações finais a exibir após filtro específico de competência
  const displayedMovements = useMemo(() => {
    if (selectedCompetence === 'TODAS') return sortedMovements;
    return sortedMovements.filter((m) => m.dueDate && m.dueDate.startsWith(selectedCompetence));
  }, [sortedMovements, selectedCompetence]);

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
      const key = item.dueDate && item.dueDate.length >= 7 ? item.dueDate.substring(0, 7) : 'Sem Data';
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
              toggleMovementStatus(item.id);
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
                deleteMovement(item.id);
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

      {/* BANNER DE LEMBRETE E CONFIRMAÇÃO DE SALÁRIO PREVISTO */}
      {salarySuggestion.shouldPromptConfirmation && !isSalaryPromptDismissed && (
        <div
          className="glass-card animate-fade-in mb-4"
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.75) 100%)',
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
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px',
              }}
            >
              <Briefcase size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>
                  PREVISÃO SALARIAL ATINGIDA
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Previsto para o Dia {salarySuggestion.dueDay}
                </span>
              </div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                Você já recebeu o salário de {salarySuggestion.contract?.employer}?
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>
                Período identificado: <strong>{salarySuggestion.periodLabel}</strong> • Valor de referência: <strong className="text-emerald" style={{ fontSize: '0.9rem' }}>{salarySuggestion.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </p>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {salarySuggestion.isSecondQuinzena
                  ? 'A 2ª quinzena normalmente contém descontos da folha (INSS, IRRF, benefícios). Se o valor líquido recebido foi diferente, clique em "Ajustar Valor".'
                  : 'Adiantamento salarial de referência. Confirme com 1 clique ou ajuste se houve variação no valor.'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem' }}
              onClick={handleConfirmSalaryDirectly}
              title="Registrar recebimento com o valor exato sugerido"
            >
              <CheckCircle2 size={15} />
              <span>Confirmar R$ {salarySuggestion.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem' }}
              onClick={handleSalaryQuickAction}
              title="Abrir para alterar o valor real recebido antes de salvar"
            >
              <Zap size={14} />
              <span>Ajustar Valor</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: '0.45rem 0.6rem', color: 'var(--text-muted)' }}
              onClick={() => setIsSalaryPromptDismissed(true)}
              title="Lembrar mais tarde"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

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
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', margin: 0 }}>
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
                    onClick={() => handleConfirmBillDirectly(bill)}
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

      {/* Ações Rápidas de Cadastro */}
      <div className="movements-quick-actions-bar glass-card">
        <span className="quick-actions-label">Ações Imediatas:</span>
        <div className="quick-actions-buttons">
          <button
            className="quick-action-btn"
            style={{
              borderColor: 'rgba(16, 185, 129, 0.45)',
              background: 'rgba(16, 185, 129, 0.08)',
              fontWeight: 600,
            }}
            onClick={handleSalaryQuickAction}
            title={
              salarySuggestion.hasContract
                ? `Lançar ${salarySuggestion.periodLabel} (${salarySuggestion.dueDate.split('-').reverse().join('/')} • R$ ${salarySuggestion.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
                : 'Registrar recebimento de salário'
            }
          >
            <Briefcase size={14} className="text-emerald" />
            <span className="text-emerald">+ Salário</span>
          </button>
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

          {/* Competência Filter */}
          {availableCompetences.length > 1 && (
            <div className="control-group">
              <span className="control-label">Competência:</span>
              <select
                className="form-select select-sm"
                value={selectedCompetence}
                onChange={(e) => setSelectedCompetence(e.target.value)}
              >
                <option value="TODAS">Todas as Competências ({availableCompetences.length})</option>
                {availableCompetences.map((comp) => (
                  <option key={comp} value={comp}>
                    {getCompetenceLabel(comp)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort Order & Group View Controls */}
          <div className="control-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className={`pill-btn ${sortOrder === 'ASC' ? 'active' : ''}`}
              onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
              title={sortOrder === 'ASC' ? 'Ordenado: Mais Próximos / Recentes Primeiro (Clique para inverter)' : 'Ordenado: Mais Distantes no Futuro Primeiro (Clique para inverter)'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: sortOrder === 'ASC' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: sortOrder === 'ASC' ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
                color: sortOrder === 'ASC' ? '#38bdf8' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <ArrowUpDown size={13} />
              <span>{sortOrder === 'ASC' ? 'Mais Próximos 1º' : 'Mais Futuros 1º'}</span>
            </button>

            <button
              type="button"
              className={`pill-btn ${groupByCompetence ? 'active' : ''}`}
              onClick={() => setGroupByCompetence(!groupByCompetence)}
              title="Alternar agrupamento visual por mês de competência"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: groupByCompetence ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: groupByCompetence ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
                color: groupByCompetence ? '#a5b4fc' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <CalendarDays size={13} />
              <span>{groupByCompetence ? 'Agrupado por Mês' : 'Lista Direta'}</span>
            </button>
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
    </div>
  );
};
