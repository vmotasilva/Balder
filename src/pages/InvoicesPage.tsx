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
  Upload,
  Copy,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import type { Movement, MovementStatus, InvoiceNatureItemBreakdown } from '../types';
import { MovementDetailModal } from '../components/MovementDetailModal';
import { NewInvoiceModal } from '../components/NewInvoiceModal';
import { InvoiceImportModal } from '../components/InvoiceImportModal';
import { ConfirmDialog, useConfirmDialog } from '../components/ConfirmDialog';
import { getBankBranding } from '../utils/bankBranding';

export const InvoicesPage: React.FC = () => {
  const {
    movements,
    updateMovement,
    addMovement,
    deleteMovement,
    cards,
    natures,
  } = useFinancial();

  // Confirm Dialog
  const { confirm: confirmAction, dialogProps: confirmDialogProps } = useConfirmDialog();

  // Estados de Filtros e Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBankFilter, setSelectedBankFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'PREVISTA' | 'REALIZADA'>('ALL');
  const [selectedConciliationFilter, setSelectedConciliationFilter] = useState<'ALL' | 'RECONCILED' | 'PARTIAL' | 'UNANALYZED'>('ALL');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('ALL');

  // Modal para Criar Nova Fatura
  const [isNewInvoiceModalOpen, setIsNewInvoiceModalOpen] = useState(false);

  // Modal para Importar Extrato de Fatura
  const [isNewInvoiceImportOpen, setIsNewInvoiceImportOpen] = useState(false);
  const [importingInvoice, setImportingInvoice] = useState<Movement | null>(null);

  // Modal de Detalhamento Pop-up (MovementDetailModal)
  const [selectedMovementForModal, setSelectedMovementForModal] = useState<Movement | null>(null);

  // Cards recolhidos / expandidos para detalhamento de itens
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});

  // Inline Quick Add Item por Fatura
  const [inlineItemNature, setInlineItemNature] = useState<Record<string, string>>({});
  const [inlineItemDesc, setInlineItemDesc] = useState<Record<string, string>>({});
  const [inlineItemAmount, setInlineItemAmount] = useState<Record<string, string>>({});
  const [inlineItemFinalAmount, setInlineItemFinalAmount] = useState<Record<string, string>>({});
  const [inlineItemInstallments, setInlineItemInstallments] = useState<Record<string, number>>({});

  // Obter todos os movimentos de Cartão de Crédito
  const cardMovements = useMemo(() => {
    return movements
      .filter((m) => m.type === 'CARTAO')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [movements]);

  // Lista de bancos presentes nos movimentos de cartão e nos cartões cadastrados
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
      if (selectedBankFilter !== 'ALL') {
        const bankMatch = (m.bank || '').toLowerCase() === selectedBankFilter.toLowerCase();
        if (!bankMatch) return false;
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

  // Detecção e Agrupamento de Faturas Duplicadas (mesmo banco e mês de vencimento)
  const duplicateInvoiceGroups = useMemo(() => {
    const groups: Record<string, Movement[]> = {};
    cardMovements.forEach((m) => {
      if (m.status === 'PREVISTA') {
        const bankKey = (m.bank || 'cartao').trim().toLowerCase();
        const monthKey = m.dueDate.substring(0, 7);
        const groupKey = `${bankKey}_${monthKey}`;
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(m);
      }
    });

    return Object.entries(groups)
      .filter(([_, list]) => list.length > 1)
      .map(([key, list]) => ({
        key,
        bank: list[0].bank || 'Cartão',
        monthKey: list[0].dueDate.substring(0, 7),
        dueDate: list[0].dueDate,
        invoices: list,
      }));
  }, [cardMovements]);

  const totalDuplicatesCount = useMemo(() => {
    return duplicateInvoiceGroups.reduce((acc, g) => acc + (g.invoices.length - 1), 0);
  }, [duplicateInvoiceGroups]);

  // Consolidar e Limpar Duplicatas em 1 Clique
  const handleConsolidateDuplicates = () => {
    if (duplicateInvoiceGroups.length === 0) return;

    const confirmMsg = `Detectamos ${totalDuplicatesCount} fatura(s) em duplicidade para o mesmo cartão e mês.\n\nDeseja consolidar o fluxo agora? O Balder manterá a fatura principal e removerá com segurança as cópias duplicadas.`;
    if (!window.confirm(confirmMsg)) return;

    let removed = 0;
    duplicateInvoiceGroups.forEach((group) => {
      // Priorização para manter a melhor fatura:
      // 1. Quem tem itens no breakdown
      // 2. Quem tem UUID persistido no Supabase
      // 3. Primeira da lista
      const sorted = [...group.invoices].sort((a, b) => {
        const aBreakdown = (a.invoiceBreakdown || []).length;
        const bBreakdown = (b.invoiceBreakdown || []).length;
        if (bBreakdown !== aBreakdown) return bBreakdown - aBreakdown;
        const aIsUuid = /^[0-9a-f-]{36}$/i.test(a.id);
        const bIsUuid = /^[0-9a-f-]{36}$/i.test(b.id);
        if (aIsUuid && !bIsUuid) return -1;
        if (!aIsUuid && bIsUuid) return 1;
        return 0;
      });

      const keep = sorted[0];
      const duplicates = sorted.slice(1);

      // Mescla itens do breakdown que possam estar apenas nas cópias
      const mergedBreakdown = [...(keep.invoiceBreakdown || [])];
      let hasBreakdownUpdates = false;

      duplicates.forEach((dup) => {
        (dup.invoiceBreakdown || []).forEach((item) => {
          if (!mergedBreakdown.some((mItem) => mItem.description === item.description && mItem.amount === item.amount)) {
            mergedBreakdown.push(item);
            hasBreakdownUpdates = true;
          }
        });
        deleteMovement(dup.id);
        removed++;
      });

      if (hasBreakdownUpdates) {
        const allocated = mergedBreakdown.reduce((sum, it) => sum + it.amount, 0);
        updateMovement(keep.id, {
          invoiceBreakdown: mergedBreakdown,
          unanalyzedAmount: Math.max(0, keep.amount - allocated),
          category: allocated >= keep.amount ? 'Fatura de Cartão' : keep.category,
        });
      }
    });

    if (removed > 0) {
      alert(`${removed} fatura(s) duplicada(s) foram consolidadas com sucesso!`);
    }
  };

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

  // Sincronização reativa de valores e parcelas no inline
  const handleInlineAmountChange = (movementId: string, val: string) => {
    setInlineItemAmount((prev) => ({ ...prev, [movementId]: val }));
    const clean = val.replace(/[R$\s]/g, '').trim();
    const parsed = clean.includes(',') ? parseFloat(clean.replace(/\./g, '').replace(',', '.')) : parseFloat(clean) || 0;
    const inst = inlineItemInstallments[movementId] || 1;
    if (parsed > 0) {
      setInlineItemFinalAmount((prev) => ({ ...prev, [movementId]: (parsed * inst).toFixed(2) }));
    }
  };

  const handleInlineFinalAmountChange = (movementId: string, val: string) => {
    setInlineItemFinalAmount((prev) => ({ ...prev, [movementId]: val }));
    const clean = val.replace(/[R$\s]/g, '').trim();
    const parsed = clean.includes(',') ? parseFloat(clean.replace(/\./g, '').replace(',', '.')) : parseFloat(clean) || 0;
    const inst = inlineItemInstallments[movementId] || 1;
    if (parsed > 0) {
      setInlineItemAmount((prev) => ({ ...prev, [movementId]: (parsed / inst).toFixed(2) }));
    }
  };

  const handleInlineInstallmentsChange = (movementId: string, inst: number) => {
    const instCount = Math.max(1, inst || 1);
    setInlineItemInstallments((prev) => ({ ...prev, [movementId]: instCount }));
    const rawFinal = inlineItemFinalAmount[movementId];
    const rawAmount = inlineItemAmount[movementId];
    if (rawFinal) {
      const clean = rawFinal.replace(/[R$\s]/g, '').trim();
      const parsed = clean.includes(',') ? parseFloat(clean.replace(/\./g, '').replace(',', '.')) : parseFloat(clean) || 0;
      if (parsed > 0) {
        setInlineItemAmount((prev) => ({ ...prev, [movementId]: (parsed / instCount).toFixed(2) }));
      }
    } else if (rawAmount) {
      const clean = rawAmount.replace(/[R$\s]/g, '').trim();
      const parsed = clean.includes(',') ? parseFloat(clean.replace(/\./g, '').replace(',', '.')) : parseFloat(clean) || 0;
      if (parsed > 0) {
        setInlineItemFinalAmount((prev) => ({ ...prev, [movementId]: (parsed * instCount).toFixed(2) }));
      }
    }
  };

  // Adicionar item inline ao detalhamento da fatura
  const handleAddInlineItem = (m: Movement) => {
    const natureId = inlineItemNature[m.id] || (natures[0]?.id ?? 'OUTROS');
    const desc = (inlineItemDesc[m.id] || '').trim();
    const rawAmount = inlineItemAmount[m.id] || '';
    const instCount = inlineItemInstallments[m.id] || 1;

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
    const finalTotal = parsedAmount * instCount;
    const cleanDesc = desc || (natureId === 'OUTROS' ? 'Gasto avulso' : `Item ${natureName}`);

    const currentBreakdown = m.invoiceBreakdown || [];
    const newRow: InvoiceNatureItemBreakdown = {
      id: `breakdown_${Date.now()}`,
      natureId,
      natureName,
      description: instCount > 1 ? `${cleanDesc} (1/${instCount})` : cleanDesc,
      amount: Math.round(parsedAmount * 100) / 100,
      isAnalyzed: true,
      installments: instCount,
      currentInstallment: 1,
      finalAmount: Math.round(finalTotal * 100) / 100,
    };

    const updatedBreakdown = [...currentBreakdown, newRow];
    const totalAllocated = updatedBreakdown.reduce((acc, i) => acc + i.amount, 0);
    const unanalyzed = Math.max(0, m.amount - totalAllocated);

    updateMovement(m.id, {
      invoiceBreakdown: updatedBreakdown,
      unanalyzedAmount: unanalyzed,
      category: unanalyzed > 0.01 ? 'Não Analisada' : 'Fatura de Cartão',
    });

    // Se parcelado, distribui as parcelas futuras 2..instCount nas próximas faturas
    if (instCount > 1) {
      const [yearStr, monthStr, dayStr] = m.dueDate.split('-');
      const baseYear = parseInt(yearStr, 10);
      const baseMonth = parseInt(monthStr, 10);
      const baseDay = parseInt(dayStr, 10);

      for (let p = 2; p <= instCount; p++) {
        const futureDate = new Date(baseYear, baseMonth - 1 + (p - 1), baseDay);
        const futureDueDate = futureDate.toISOString().split('T')[0];
        const futureMonthPrefix = futureDueDate.substring(0, 7);

        const targetInvoice = movements.find(
          (inv) =>
            inv.id !== m.id &&
            inv.type === 'CARTAO' &&
            (inv.bank === m.bank || inv.title.toLowerCase().includes((m.bank || '').toLowerCase())) &&
            inv.dueDate.startsWith(futureMonthPrefix)
        );

        const futureItem: InvoiceNatureItemBreakdown = {
          id: `breakdown_${newRow.id}_inst_${p}`,
          natureId,
          natureName,
          description: `${cleanDesc} (${p}/${instCount})`,
          amount: Math.round(parsedAmount * 100) / 100,
          isAnalyzed: true,
          installments: instCount,
          currentInstallment: p,
          finalAmount: Math.round(finalTotal * 100) / 100,
        };

        if (targetInvoice) {
          const currentFutureBreakdown = targetInvoice.invoiceBreakdown || [];
          const updatedFutureBreakdown = [...currentFutureBreakdown, futureItem];
          const allocatedFuture = updatedFutureBreakdown.reduce((sum, it) => sum + it.amount, 0);
          const futureUnanalyzed = Math.max(0, Math.round((targetInvoice.amount - allocatedFuture) * 100) / 100);

          updateMovement(targetInvoice.id, {
            invoiceBreakdown: updatedFutureBreakdown,
            unanalyzedAmount: futureUnanalyzed,
          });
        } else {
          const futureMonthLabel = futureDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
          const capMonth = futureMonthLabel.charAt(0).toUpperCase() + futureMonthLabel.slice(1);

          addMovement({
            title: `Fatura ${m.bank} (${capMonth.split(' ')[0]})`,
            type: 'CARTAO',
            amount: Math.round(parsedAmount * 100) / 100,
            dueDate: futureDueDate,
            bank: m.bank,
            status: 'PREVISTA',
            category: natureName,
            notes: `Parcelamento programado: ${cleanDesc} (${p}/${instCount})`,
            invoiceBreakdown: [futureItem],
            unanalyzedAmount: 0,
          });
        }
      }
    }

    // Limpar campos inline
    setInlineItemDesc((prev) => ({ ...prev, [m.id]: '' }));
    setInlineItemAmount((prev) => ({ ...prev, [m.id]: '' }));
    setInlineItemFinalAmount((prev) => ({ ...prev, [m.id]: '' }));
    setInlineItemInstallments((prev) => ({ ...prev, [m.id]: 1 }));
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

  // Confirmar importação de extrato para criar uma Nova Fatura
  const handleConfirmImportForNewInvoice = (
    items: InvoiceNatureItemBreakdown[],
    totalAmount: number,
    _shouldUpdate: boolean
  ) => {
    const effectiveBank = selectedBankFilter !== 'ALL' ? selectedBankFilter : (cards[0]?.bank || 'Nubank');
    const matchedCard = cards.find((c) => c.bank?.toLowerCase() === effectiveBank.toLowerCase());
    
    // Data de vencimento sugerida
    const now = new Date();
    const targetDay = matchedCard?.dueDay || 10;
    let dueYear = now.getFullYear();
    let dueMonth = now.getMonth();
    if (now.getDate() > targetDay) {
      dueMonth += 1;
      if (dueMonth > 11) {
        dueMonth = 0;
        dueYear += 1;
      }
    }
    const dueDayStr = String(targetDay).padStart(2, '0');
    const dueMonthStr = String(dueMonth + 1).padStart(2, '0');
    const initDueDate = `${dueYear}-${dueMonthStr}-${dueDayStr}`;
    
    const dateObj = new Date(initDueDate + 'T12:00:00');
    const monthLabel = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
    const capMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    const invoiceTitle = `Fatura ${effectiveBank} (${capMonth})`;

    const finalAmount = Math.round(totalAmount * 100) / 100;
    const allocated = items.reduce((acc, i) => acc + i.amount, 0);
    const unanalyzed = Math.max(0, finalAmount - allocated);

    addMovement({
      title: invoiceTitle,
      type: 'CARTAO',
      amount: finalAmount,
      dueDate: initDueDate,
      bank: effectiveBank,
      status: 'PREVISTA',
      category: unanalyzed > 0.01 ? 'Não Analisada' : 'Fatura de Cartão',
      notes: `Fatura importada via arquivo/extrato com ${items.length} itens classificados`,
      invoiceBreakdown: items,
      unanalyzedAmount: unanalyzed,
    });

    setIsNewInvoiceImportOpen(false);
  };

  // Confirmar importação de extrato para uma Fatura Existente
  const handleConfirmImportForExistingInvoice = (
    items: InvoiceNatureItemBreakdown[],
    totalAmount: number,
    shouldUpdateInvoiceAmount: boolean
  ) => {
    if (!importingInvoice) return;

    const m = importingInvoice;
    const newAmount = shouldUpdateInvoiceAmount && totalAmount > 0 
      ? Math.round(totalAmount * 100) / 100 
      : m.amount;

    const totalAllocated = items.reduce((acc, i) => acc + i.amount, 0);
    const unanalyzed = Math.max(0, newAmount - totalAllocated);

    updateMovement(m.id, {
      amount: newAmount,
      actualAmount: m.status === 'REALIZADA' ? newAmount : m.actualAmount,
      invoiceBreakdown: items,
      unanalyzedAmount: unanalyzed,
      category: unanalyzed > 0.01 ? 'Não Analisada' : 'Fatura de Cartão',
      notes: m.notes ? `${m.notes} | Importado extrato (${items.length} itens)` : `Extrato importado com ${items.length} itens`,
    });

    setImportingInvoice(null);
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
        <div className="page-header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {totalDuplicatesCount > 0 && (
            <button
              className="btn btn-secondary"
              onClick={handleConsolidateDuplicates}
              id="btn-consolidate-duplicates-top"
              title="Detectamos faturas duplicadas. Clique para consolidar e limpar."
              style={{
                background: 'rgba(239, 68, 68, 0.18)',
                borderColor: 'rgba(239, 68, 68, 0.45)',
                color: '#FCA5A5',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
            >
              <Copy size={16} />
              <span>Limpar Duplicadas ({totalDuplicatesCount})</span>
            </button>
          )}

          <button
            className="btn btn-secondary"
            onClick={() => setIsNewInvoiceImportOpen(true)}
            id="btn-import-invoice-top"
            title="Importar extrato em OFX, CSV ou Imagem para criar uma nova fatura detalhada"
          >
            <Upload size={16} />
            <span>Importar Extrato</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setIsNewInvoiceModalOpen(true)}
            id="btn-add-invoice"
          >
            <Plus size={16} />
            <span>Adicionar Fatura</span>
          </button>
        </div>
      </div>

      {/* Top KPIs Banner */}
      <div className="invoices-kpi-grid">
        <div className="invoices-kpi-card">
          <div className="invoices-kpi-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8' }}>
            <CreditCard size={22} />
          </div>
          <div className="invoices-kpi-content">
            <span className="invoices-kpi-label">Faturas em Aberto (Mês)</span>
            <strong className="invoices-kpi-value">{fmtBRL(kpis.openCurrentMonth)}</strong>
            <span className="invoices-kpi-hint" style={{ color: '#38BDF8' }}>Vencimento próximo</span>
          </div>
        </div>

        <div className="invoices-kpi-card">
          <div className="invoices-kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
            <Calendar size={22} />
          </div>
          <div className="invoices-kpi-content">
            <span className="invoices-kpi-label">Faturas Futuras</span>
            <strong className="invoices-kpi-value">{fmtBRL(kpis.openFuture)}</strong>
            <span className="invoices-kpi-hint" style={{ color: '#818CF8' }}>Parcelamentos a vencer</span>
          </div>
        </div>

        <div
          className="invoices-kpi-card"
          style={{
            borderColor: kpis.totalUnanalyzed > 0 ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)',
            background: kpis.totalUnanalyzed > 0 ? 'rgba(245, 158, 11, 0.05)' : 'rgba(16, 185, 129, 0.05)',
          }}
        >
          <div
            className="invoices-kpi-icon"
            style={{
              background: kpis.totalUnanalyzed > 0 ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.18)',
              color: kpis.totalUnanalyzed > 0 ? '#F59E0B' : '#10B981',
            }}
          >
            {kpis.totalUnanalyzed > 0 ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
          </div>
          <div className="invoices-kpi-content">
            <span className="invoices-kpi-label">Pendente de Análise</span>
            <strong
              className="invoices-kpi-value"
              style={{ color: kpis.totalUnanalyzed > 0 ? '#F59E0B' : '#10B981' }}
            >
              {fmtBRL(kpis.totalUnanalyzed)}
            </strong>
            <span
              className="invoices-kpi-hint"
              style={{ color: kpis.totalUnanalyzed > 0 ? '#F59E0B' : '#10B981' }}
            >
              {kpis.totalUnanalyzed > 0 ? 'Aguardando classificação' : '100% categorizado!'}
            </span>
          </div>
        </div>

        <div className="invoices-kpi-card">
          <div className="invoices-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
            <Layers size={22} />
          </div>
          <div className="invoices-kpi-content">
            <span className="invoices-kpi-label">Alocado em Naturezas</span>
            <strong className="invoices-kpi-value">{fmtBRL(kpis.totalReconciled)}</strong>
            <span className="invoices-kpi-hint" style={{ color: '#10B981' }}>Abatendo dos tetos</span>
          </div>
        </div>
      </div>

      {/* Notice box about Credit Card Logic */}
      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          background: 'rgba(99, 102, 241, 0.08)',
          borderRadius: '14px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: 'rgba(99, 102, 241, 0.2)',
            color: '#A5B4FC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          <Sparkles size={16} />
        </div>
        <div style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)', flex: 1 }}>
          <strong style={{ color: '#C7D2FE', display: 'block', marginBottom: '2px' }}>
            Regra de Competência e Vencimento de Cartão de Crédito
          </strong>
          Os gastos efetuados no mês atual (ex: Setembro) têm sua fatura fechada com vencimento no mês seguinte (ex: Outubro). Ao destrinchar os itens nas Naturezas, os valores abatem diretamente as metas e tetos orçamentários do Balder. O saldo não distribuído é mantido como <strong>Não Analisada</strong> até que você decida alocá-lo ou transferi-lo para <strong>Outros</strong>.
        </div>
      </div>

      {/* Banner de Alerta e Limpeza Inteligente de Duplicadas */}
      {duplicateInvoiceGroups.length > 0 && (
        <div
          className="duplicate-invoices-banner"
          style={{
            marginBottom: '20px',
            padding: '16px 20px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, rgba(245, 158, 11, 0.1) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.25)',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Copy size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ color: '#FCA5A5', fontSize: '15px' }}>
                  Faturas Duplicadas Detectadas ({totalDuplicatesCount} cópias redundantes)
                </strong>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                {duplicateInvoiceGroups
                  .map(
                    (g) =>
                      `${g.invoices.length}x ${g.bank} (${g.invoices[0].title} — ${fmtBRL(g.invoices[0].amount)})`
                  )
                  .join(' • ')}
                . O Balder pode manter a fatura principal e purgar as cópias clonadas com 1 clique.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
              borderColor: '#DC2626',
              color: '#fff',
              fontWeight: 600,
              fontSize: '13px',
              padding: '9px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={handleConsolidateDuplicates}
          >
            <CheckCircle2 size={16} />
            <span>Consolidar e Limpar Duplicadas</span>
          </button>
        </div>
      )}

      {/* Filter Panel com Abas Visuais por Banco */}
      <div className="invoices-filter-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SlidersHorizontal size={15} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Filtros & Distinção por Banco
            </span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Mostrando <strong style={{ color: 'var(--text-primary)' }}>{filteredInvoices.length}</strong> de {cardMovements.length} faturas
          </span>
        </div>

        {/* Abas Rápidas por Banco com cores da marca */}
        <div className="invoices-bank-pills">
          <button
            type="button"
            className={`invoices-bank-pill ${selectedBankFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedBankFilter('ALL')}
          >
            <span>💳 Todos os Bancos</span>
            <span style={{ fontSize: '11px', opacity: 0.85 }}>({cardMovements.length})</span>
          </button>

          {availableBanks.map((b) => {
            const brand = getBankBranding(b);
            const count = cardMovements.filter((m) => (m.bank || '').toLowerCase() === b.toLowerCase()).length;
            const isSelected = selectedBankFilter.toLowerCase() === b.toLowerCase();
            return (
              <button
                key={b}
                type="button"
                className={`invoices-bank-pill ${isSelected ? 'active' : ''}`}
                style={
                  isSelected
                    ? {
                        background: brand.badgeBg,
                        borderColor: brand.badgeBorder,
                        color: brand.textColor,
                        boxShadow: `0 0 12px ${brand.primaryColor}55`,
                      }
                    : undefined
                }
                onClick={() => setSelectedBankFilter(isSelected ? 'ALL' : b)}
              >
                <span>{brand.iconText}</span>
                <span>{b}</span>
                <span style={{ fontSize: '11px', opacity: 0.85 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Grid de Inputs de Filtros */}
        <div className="invoices-filter-grid">
          {/* Busca */}
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px' }}
              placeholder="Buscar por fatura, banco, item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filtro Banco */}
          <div>
            <select
              className="form-select"
              value={selectedBankFilter}
              onChange={(e) => setSelectedBankFilter(e.target.value)}
            >
              <option value="ALL">Todos os Bancos / Emissores</option>
              {availableBanks.map((b) => (
                <option key={b} value={b}>
                  {getBankBranding(b).iconText} {b}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Mês */}
          <div>
            <select
              className="form-select"
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
              className="form-select"
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
              className="form-select"
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
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center', borderRadius: '16px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
            }}
          >
            <CreditCard size={32} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Nenhuma fatura de cartão encontrada
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 20px auto' }}>
            Não encontramos faturas para os filtros ativos. Você pode cadastrar uma nova fatura com banco e valor personalizados ou redefinir os filtros.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              className="btn btn-secondary"
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
            <button className="btn btn-primary" onClick={() => setIsNewInvoiceModalOpen(true)}>
              <Plus size={15} />
              <span>Adicionar Fatura</span>
            </button>
          </div>
        </div>
      ) : (
        <div>
          {filteredInvoices.map((m) => {
            const breakdown = m.invoiceBreakdown || [];
            const isExpanded = !!expandedInvoices[m.id];
            const isPaid = m.status === 'REALIZADA';
            const bankBrand = getBankBranding(m.bank);

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
                className="invoice-card"
                style={{
                  borderLeft: `5px solid ${bankBrand.accentBorder}`,
                  boxShadow: `0 6px 20px rgba(0, 0, 0, 0.35), 0 0 16px ${bankBrand.primaryColor}15`,
                }}
              >
                {/* Header da Fatura com Cores Distintas por Banco */}
                <div
                  className="invoice-card-header"
                  style={{
                    background: bankBrand.headerGradient,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    {/* Avatar do Banco com Logo/Ícone da Marca */}
                    <div
                      className="invoice-bank-avatar"
                      style={{
                        background: bankBrand.primaryColor,
                        boxShadow: `0 0 16px ${bankBrand.primaryColor}55`,
                      }}
                      title={bankBrand.name}
                    >
                      {bankBrand.iconText}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        {/* Badge Oficial do Banco */}
                        <span
                          className="invoice-bank-badge"
                          style={{
                            background: bankBrand.badgeBg,
                            border: `1px solid ${bankBrand.badgeBorder}`,
                            color: bankBrand.textColor,
                          }}
                        >
                          {m.bank || 'Cartão de Crédito'}
                        </span>

                        {m.installmentNumber && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '9999px',
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Parcela {m.installmentNumber}/{m.installmentsTotal || 10}
                          </span>
                        )}

                        {/* Status da Fatura */}
                        <span
                          className="badge"
                          style={{
                            background: isPaid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                            border: isPaid ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(56, 189, 248, 0.35)',
                            color: isPaid ? '#34D399' : '#38BDF8',
                          }}
                        >
                          {isPaid ? 'REALIZADA (PAGA)' : 'PREVISTA NO FLUXO'}
                        </span>

                        {/* Indicador de Duplicidade */}
                        {duplicateInvoiceGroups.some((g) => g.invoices.some((inv) => inv.id === m.id) && g.invoices.length > 1) && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '9999px',
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.45)',
                              color: '#F87171',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Existe outra fatura para o mesmo cartão e mês de vencimento"
                          >
                            <Copy size={11} />
                            Duplicada no Fluxo
                          </span>
                        )}

                        {/* Status de Conciliação */}
                        {isFullyReconciled ? (
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              color: '#34D399',
                            }}
                          >
                            <CheckCircle2 size={12} />
                            100% Conciliada
                          </span>
                        ) : isPartiallyReconciled ? (
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              color: '#FBBF24',
                            }}
                          >
                            <AlertTriangle size={12} />
                            Parcial ({fmtBRL(unallocated)} pendente)
                          </span>
                        ) : (
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              color: '#F87171',
                            }}
                          >
                            <AlertTriangle size={12} />
                            Não Analisada
                          </span>
                        )}
                      </div>

                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {m.title}
                      </h3>

                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                        Vencimento: <strong style={{ color: 'var(--text-primary)' }}>{dueDateFormatted}</strong> ({monthName}) • Competência:{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>Gastos do mês anterior</span>
                      </p>
                    </div>
                  </div>

                  {/* Valor e Ações Rápidas */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="invoice-amount-box">
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                        Valor da Fatura
                      </span>
                      <strong className="invoice-amount-value">
                        {fmtBRL(m.amount)}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', padding: '8px 14px' }}
                        onClick={() => setSelectedMovementForModal(m)}
                        title="Abrir pop-up detalhado de conciliação da fatura"
                      >
                        <ArrowUpRight size={14} />
                        <span>Conciliar Itens</span>
                      </button>

                      <button
                        className="btn btn-outline"
                        style={{ fontSize: '12px', padding: '8px 12px', gap: '5px' }}
                        onClick={() => setImportingInvoice(m)}
                        title="Importar arquivo (OFX, CSV, Imagem) e interpretar gastos desta fatura"
                      >
                        <Upload size={14} />
                        <span>Importar Extrato</span>
                      </button>

                      <button
                        className={`btn ${isPaid ? 'btn-success' : 'btn-outline'}`}
                        style={{ padding: '8px 10px' }}
                        onClick={() => handleToggleInvoiceStatus(m)}
                        title={isPaid ? 'Marcar como prevista' : 'Marcar como paga / realizada'}
                      >
                        <Check size={16} />
                      </button>

                      <button
                        className="btn btn-outline"
                        style={{ padding: '8px 10px' }}
                        onClick={() => toggleExpand(m.id)}
                        title={isExpanded ? 'Recolher detalhes' : 'Expandir itens e naturezas'}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      <button
                        className="btn btn-outline"
                        style={{ padding: '8px 10px', color: 'var(--accent-rose)' }}
                        onClick={() => {
                          confirmAction({
                            title: 'Excluir Fatura',
                            message: `Deseja realmente excluir a fatura "${m.title}" (${fmtBRL(m.amount)})? Esta ação não pode ser desfeita.`,
                            confirmLabel: 'Excluir',
                            onConfirm: () => deleteMovement(m.id),
                          });
                        }}
                        title="Excluir fatura"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Barra de Progresso Visual da Composição */}
                <div className="invoice-composition-panel">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-emerald)', display: 'inline-block' }} />
                        Naturezas: <strong>{fmtBRL(natureAllocated)}</strong> ({naturePct.toFixed(0)}%)
                      </span>

                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-cyan)', display: 'inline-block' }} />
                        Outros: <strong>{fmtBRL(outrosAllocated)}</strong> ({outrosPct.toFixed(0)}%)
                      </span>

                      {unallocated > 0.01 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-amber)', fontWeight: 600 }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-amber)', display: 'inline-block' }} />
                          Não Analisada: <strong>{fmtBRL(unallocated)}</strong> ({unallocatedPct.toFixed(0)}%)
                        </span>
                      )}
                    </div>

                    {unallocated > 0.01 && (
                      <button
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--accent-cyan)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          textUnderlineOffset: '3px',
                        }}
                        onClick={() => handleQuickAllocateRemainingAsOutros(m)}
                      >
                        Classificar restante ({fmtBRL(unallocated)}) como Outros
                      </button>
                    )}
                  </div>

                  {/* Barra Visual */}
                  <div style={{ width: '100%', height: '8px', borderRadius: '9999px', background: 'var(--bg-card-elevated)', overflow: 'hidden', display: 'flex' }}>
                    <div
                      style={{
                        width: `${naturePct}%`,
                        height: '100%',
                        background: 'var(--accent-emerald)',
                        transition: 'width 0.3s ease',
                      }}
                      title={`Naturezas: ${fmtBRL(natureAllocated)}`}
                    />
                    <div
                      style={{
                        width: `${outrosPct}%`,
                        height: '100%',
                        background: 'var(--accent-cyan)',
                        transition: 'width 0.3s ease',
                      }}
                      title={`Outros: ${fmtBRL(outrosAllocated)}`}
                    />
                    <div
                      style={{
                        width: `${unallocatedPct}%`,
                        height: '100%',
                        background: 'var(--accent-amber)',
                        transition: 'width 0.3s ease',
                      }}
                      title={`Não Analisada: ${fmtBRL(unallocated)}`}
                    />
                  </div>
                </div>

                {/* Conteúdo Expandido (Lista de Itens e Inclusão Rápida) */}
                {isExpanded && (
                  <div style={{ padding: '20px 24px', background: 'rgba(6, 9, 15, 0.4)' }} className="animate-fade-in">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Tag size={14} style={{ color: 'var(--accent-cyan)' }} />
                        <span>Itens Detalhados da Fatura ({breakdown.length})</span>
                      </h4>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Cada item abatido alimenta a execução orçamentária do Balder
                      </span>
                    </div>

                    {breakdown.length === 0 ? (
                      <div
                        style={{
                          padding: '24px',
                          borderRadius: '12px',
                          border: '1px dashed var(--border-default)',
                          textAlign: 'center',
                          background: 'rgba(15, 23, 42, 0.3)',
                          marginBottom: '16px',
                        }}
                      >
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                          Esta fatura ainda não possui itens detalhados. O valor integral de{' '}
                          <strong style={{ color: 'var(--accent-amber)' }}>{fmtBRL(m.amount)}</strong> consta como{' '}
                          <strong>Não Analisada</strong>.
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '12px' }}
                            onClick={() => setSelectedMovementForModal(m)}
                          >
                            <ArrowUpRight size={13} className="mr-1" />
                            Detalhar no Pop-up
                          </button>
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: '12px' }}
                            onClick={() => handleQuickAllocateRemainingAsOutros(m)}
                          >
                            Classificar Tudo como Outros
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                        <table className="invoice-items-table">
                          <thead>
                            <tr>
                              <th>Natureza</th>
                              <th>Descrição do Item</th>
                              <th style={{ textAlign: 'center' }}>Parcela(s)</th>
                              <th style={{ textAlign: 'right' }}>Nesta Fatura (R$)</th>
                              <th style={{ textAlign: 'right', color: '#D8B4FE' }}>Valor Final (R$)</th>
                              <th style={{ textAlign: 'right' }}>% Fatura</th>
                              <th style={{ textAlign: 'center' }}>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {breakdown.map((item) => {
                              const itemPct = m.amount > 0 ? (item.amount / m.amount) * 100 : 0;
                              const isOutros = item.natureId === 'OUTROS';
                              const inst = item.installments || 1;
                              const finalVal = item.finalAmount ?? (item.amount * inst);

                              return (
                                <tr key={item.id}>
                                  <td>
                                    <span
                                      className="badge"
                                      style={{
                                        background: isOutros ? 'rgba(56, 189, 248, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                                        border: isOutros ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(99, 102, 241, 0.35)',
                                        color: isOutros ? '#38BDF8' : '#818CF8',
                                      }}
                                    >
                                      {item.natureName}
                                    </span>
                                  </td>
                                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {item.description}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    {inst > 1 ? (
                                      <span
                                        style={{
                                          padding: '2px 8px',
                                          borderRadius: '9999px',
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          background: 'rgba(168, 85, 247, 0.15)',
                                          color: '#C084FC',
                                          border: '1px solid rgba(168, 85, 247, 0.3)',
                                        }}
                                        title={`Parcela ${item.currentInstallment || 1} de ${inst}`}
                                      >
                                        {item.currentInstallment || 1}/{inst}
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>1x (à vista)</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {fmtBRL(item.amount)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#D8B4FE' }}>
                                    {fmtBRL(finalVal)}
                                  </td>
                                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                    {itemPct.toFixed(1)}%
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--accent-rose)',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        borderRadius: '6px',
                                      }}
                                      onClick={() => {
                                        confirmAction({
                                          title: 'Remover Item',
                                          message: `Remover "${item.description}" do detalhamento da fatura?`,
                                          confirmLabel: 'Remover',
                                          onConfirm: () => handleDeleteBreakdownItem(m, item.id),
                                        });
                                      }}
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

                    {/* Formulário Inline para adicionar item */}
                    <div
                      style={{
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-default)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ minWidth: '150px', flex: '1 1 150px' }}>
                        <select
                          className="form-select"
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

                      <div style={{ minWidth: '200px', flex: '2 1 200px' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Descrição do gasto (ex: Tênis, Mercado, Farmácia)..."
                          value={inlineItemDesc[m.id] || ''}
                          onChange={(e) =>
                            setInlineItemDesc((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                        />
                      </div>

                      <div style={{ width: '130px' }}>
                        <select
                          className="form-select"
                          value={inlineItemInstallments[m.id] || 1}
                          onChange={(e) =>
                            handleInlineInstallmentsChange(m.id, parseInt(e.target.value, 10))
                          }
                          title="Número de parcelas"
                        >
                          <option value={1}>1x (À vista)</option>
                          <option value={2}>2x (Nesta e próx.)</option>
                          <option value={3}>3x</option>
                          <option value={4}>4x</option>
                          <option value={5}>5x</option>
                          <option value={6}>6x</option>
                          <option value={10}>10x</option>
                          <option value={12}>12x</option>
                        </select>
                      </div>

                      <div style={{ width: '120px' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}
                          placeholder="Nesta Fatura"
                          value={inlineItemAmount[m.id] || ''}
                          onChange={(e) => handleInlineAmountChange(m.id, e.target.value)}
                          title="Valor que entra nesta fatura"
                        />
                      </div>

                      <div style={{ width: '120px' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontWeight: 700, color: '#D8B4FE' }}
                          placeholder="Valor Final"
                          value={inlineItemFinalAmount[m.id] || ''}
                          onChange={(e) => handleInlineFinalAmountChange(m.id, e.target.value)}
                          title="Valor Final total da compra parcelada"
                        />
                      </div>

                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '12px', padding: '8px 16px', flexShrink: 0 }}
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

      {/* Pop-up para Adicionar Nova Fatura (Banco e Valor) */}
      <NewInvoiceModal
        isOpen={isNewInvoiceModalOpen}
        onClose={() => setIsNewInvoiceModalOpen(false)}
        defaultBank={selectedBankFilter !== 'ALL' ? selectedBankFilter : undefined}
      />

      {/* Modal de Detalhamento Pop-up (MovementDetailModal) */}
      {selectedMovementForModal && (
        <MovementDetailModal
          isOpen={!!selectedMovementForModal}
          onClose={() => setSelectedMovementForModal(null)}
          movement={selectedMovementForModal}
        />
      )}

      {/* Pop-up de Importação de Extrato para Nova Fatura */}
      {isNewInvoiceImportOpen && (
        <InvoiceImportModal
          isOpen={isNewInvoiceImportOpen}
          onClose={() => setIsNewInvoiceImportOpen(false)}
          onConfirmImport={handleConfirmImportForNewInvoice}
          currentInvoiceAmount={0}
        />
      )}

      {/* Pop-up de Importação de Extrato para Fatura Existente */}
      {importingInvoice && (
        <InvoiceImportModal
          isOpen={!!importingInvoice}
          onClose={() => setImportingInvoice(null)}
          onConfirmImport={handleConfirmImportForExistingInvoice}
          currentInvoiceAmount={importingInvoice.actualAmount ?? importingInvoice.amount}
        />
      )}
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};
