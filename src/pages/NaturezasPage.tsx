import React, { useState, useMemo, useEffect } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { getPendingFixedBills, type PendingFixedBill } from '../utils/fixedBillsAlert';
import type { Movement, MovementType, FixedExpenseMapping } from '../types';
import {
  Layers,
  Plus,
  Trash2,
  AlertTriangle,
  Calculator,
  Info,
  FileText,
  Check,
  CheckCircle2,
  CreditCard,
  Edit2,
  Save,
  X,
  Calendar,
  Zap,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Tag,
  ArrowRightLeft,
  GripVertical,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { NatureModal } from '../components/NatureModal';
import { MappingModal } from '../components/MappingModal';
import { ConfirmDialog, useConfirmDialog } from '../components/ConfirmDialog';
import {
  WEEKDAY_OPTIONS,
  formatItemScheduleBadge,
} from '../utils/natureScheduling';
import type { MappingItem } from '../types';

interface NaturezasPageProps {
  embedded?: boolean;
  onOpenNewMovementModal?: (type?: MovementType, initialData?: Partial<Movement>) => void;
}

export const NaturezasPage: React.FC<NaturezasPageProps> = ({ embedded = false, onOpenNewMovementModal }) => {
  const {
    natures,
    movements,
    deleteNature,
    updateMapping,
    deleteMapping,
    addItemToMapping,
    updateMappingItem,
    deleteMappingItem,
    moveMappingItem,
    moveMappingOrder,
    reorderMappings,
    toggleItemFulfilled,
    saveCeilingJustification,
    getNatureCeiling,
    getNatureSpent,
    getNatureMissingItems,
    addMovement,
    loadSuggestedMappingsForNature,
  } = useFinancial();

  // Confirm Dialog
  const { confirm: confirmAction, dialogProps: confirmDialogProps } = useConfirmDialog();

  // Selected Natureza
  const [selectedNatureId, setSelectedNatureId] = useState<string>(
    natures[0]?.id || 'nat_alimentacao'
  );
  const [isNatureDropdownOpen, setIsNatureDropdownOpen] = useState(false);
  const [justificationText, setJustificationText] = useState('');

  // Cards recolhíveis de diagnóstico inteligente (padrão: recolhidos)
  const [isDiagnosticExpanded, setIsDiagnosticExpanded] = useState(false);
  const [isOverCeilingExpanded, setIsOverCeilingExpanded] = useState(false);
  const [isKpisExpanded, setIsKpisExpanded] = useState(false);

  // Ao alternar entre naturezas, manter o diagnóstico recolhido como padrão
  useEffect(() => {
    setIsDiagnosticExpanded(false);
    setIsOverCeilingExpanded(false);
    setIsKpisExpanded(false);
  }, [selectedNatureId]);

  // Inline Quick Add Items per Mapping
  const [newItemDesc, setNewItemDesc] = useState<Record<string, string>>({});
  const [newItemQty, setNewItemQty] = useState<Record<string, number>>({});
  const [newItemPrice, setNewItemPrice] = useState<Record<string, number>>({});
  const [newItemMult, setNewItemMult] = useState<Record<string, number>>({});
  const [newItemRecurrenceType, setNewItemRecurrenceType] = useState<Record<string, 'DIARIO' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL'>>({});
  const [newItemDayOfWeek, setNewItemDayOfWeek] = useState<Record<string, 'DOMINGO' | 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA' | 'SABADO'>>({});
  const [newItemDayOfFortnight, setNewItemDayOfFortnight] = useState<Record<string, number>>({});
  const [newItemDayOfMonth, setNewItemDayOfMonth] = useState<Record<string, number>>({});

  // Inline Editing of existing items
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editQty, setEditQty] = useState<number | string>(1);
  const [editPrice, setEditPrice] = useState<number | string>(0);
  const [editMult, setEditMult] = useState(1);
  const [editRecurrenceType, setEditRecurrenceType] = useState<'DIARIO' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL'>('MENSAL');
  const [editDayOfWeek, setEditDayOfWeek] = useState<'DOMINGO' | 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA' | 'SABADO'>('SABADO');
  const [editDayOfFortnight, setEditDayOfFortnight] = useState<number>(1);
  const [editDayOfMonth, setEditDayOfMonth] = useState<number>(10);
  const [editKeywords, setEditKeywords] = useState<string>('');

  // Modal para Gerenciar Palavras-chave da IA por Item
  const [keywordModalData, setKeywordModalData] = useState<{
    natureId: string;
    mappingId: string;
    item: MappingItem;
  } | null>(null);
  const [tagInputText, setTagInputText] = useState<string>('');

  // Modal para Mover Item entre Mapeamentos / Naturezas
  const [moveItemModalData, setMoveItemModalData] = useState<{
    item: MappingItem;
    sourceNatureId: string;
    sourceMappingId: string;
    targetNatureId: string;
    targetMappingId: string;
  } | null>(null);

  // Modal de Palavras-chave
  const [keywordsModalMapping, setKeywordsModalMapping] = useState<FixedExpenseMapping | null>(null);
  const [newKeywordVal, setNewKeywordVal] = useState('');

  // Mapeamentos Recolhidos / Expandidos (Persistidos localmente)
  // Default: mappings start collapsed (true). Undefined = not yet toggled = collapsed.
  const [collapsedMappings, setCollapsedMappings] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('balder_collapsed_mappings');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleMappingCollapse = (mappingId: string) => {
    setCollapsedMappings((prev) => {
      // undefined = collapsed by default, so toggling means expanding (false)
      const currentlyCollapsed = prev[mappingId] !== false;
      const next = { ...prev, [mappingId]: !currentlyCollapsed };
      try {
        localStorage.setItem('balder_collapsed_mappings', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleExpandCollapseAll = (collapse: boolean) => {
    if (!selectedNature) return;
    const next: Record<string, boolean> = { ...collapsedMappings };
    selectedNature.mappings.forEach((m) => {
      next[m.id] = collapse;
    });
    setCollapsedMappings(next);
    try {
      localStorage.setItem('balder_collapsed_mappings', JSON.stringify(next));
    } catch {}
  };

  // Drag and Drop para reordenar mapeamentos
  const [draggedMappingId, setDraggedMappingId] = useState<string | null>(null);
  const [dragOverMappingId, setDragOverMappingId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, mappingId: string) => {
    setDraggedMappingId(mappingId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, mappingId: string) => {
    e.preventDefault();
    if (mappingId !== dragOverMappingId) {
      setDragOverMappingId(mappingId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetMappingId: string) => {
    e.preventDefault();
    setDragOverMappingId(null);
    if (!draggedMappingId || draggedMappingId === targetMappingId || !selectedNature) return;

    const currentMappings = [...selectedNature.mappings];
    const fromIndex = currentMappings.findIndex((m) => m.id === draggedMappingId);
    const toIndex = currentMappings.findIndex((m) => m.id === targetMappingId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const [moved] = currentMappings.splice(fromIndex, 1);
      currentMappings.splice(toIndex, 0, moved);
      reorderMappings(selectedNature.id, currentMappings);
    }
    setDraggedMappingId(null);
  };

  // Modais de Criação e Edição de Natureza
  const [isNatureModalOpen, setIsNatureModalOpen] = useState(false);
  const [natureToEdit, setNatureToEdit] = useState<any | null>(null);

  const handleOpenCreateNature = () => {
    setNatureToEdit(null);
    setIsNatureModalOpen(true);
  };

  const handleOpenEditNature = (nat?: any | null) => {
    setNatureToEdit(nat || selectedNature || null);
    setIsNatureModalOpen(true);
  };

  // Modais de Criação e Edição de Mapeamento
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [mappingToEdit, setMappingToEdit] = useState<FixedExpenseMapping | null>(null);

  // Palavras-chave em tempo real para o modal de tags
  const currentModalItemKeywords: string[] = useMemo(() => {
    if (!keywordModalData) return [];
    const targetNat = natures.find((n) => n.id === keywordModalData.natureId);
    const targetMap = targetNat?.mappings.find((m) => m.id === keywordModalData.mappingId);
    const liveItem = targetMap?.items.find((i) => i.id === keywordModalData.item.id);
    return liveItem?.keywords || keywordModalData.item.keywords || [];
  }, [keywordModalData, natures]);

  const updateItemKeywords = (newKeywords: string[]) => {
    if (!keywordModalData) return;
    const cleanList = Array.from(new Set(newKeywords.map((k) => k.toLowerCase().trim()).filter((k) => k.length >= 2)));
    updateMappingItem(keywordModalData.natureId, keywordModalData.mappingId, keywordModalData.item.id, {
      keywords: cleanList,
    });
  };

  const handleAddSingleKeyword = (kw: string) => {
    const clean = kw.toLowerCase().trim();
    if (!clean || currentModalItemKeywords.includes(clean)) return;
    updateItemKeywords([...currentModalItemKeywords, clean]);
  };

  const handleAddTagFromInput = () => {
    if (!tagInputText.trim()) return;
    const rawItems = tagInputText.split(/[,;\n]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length >= 2);
    if (rawItems.length === 0) return;
    updateItemKeywords([...currentModalItemKeywords, ...rawItems]);
    setTagInputText('');
  };

  const suggestedKeywords = useMemo(() => {
    if (!keywordModalData) return [];
    const desc = keywordModalData.item.description.toLowerCase().trim();
    const cleanDesc = desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tokens = cleanDesc.split(/[\s,.\-\/]+/).filter((t) => t.length >= 3);
    const suggestions: string[] = [];

    if (cleanDesc && cleanDesc.length >= 3 && !currentModalItemKeywords.includes(cleanDesc)) {
      suggestions.push(cleanDesc);
    }
    tokens.forEach((t) => {
      if (!currentModalItemKeywords.includes(t)) suggestions.push(t);
    });

    return suggestions.slice(0, 5);
  }, [keywordModalData, currentModalItemKeywords]);
  const [isMappingHelpOpen, setIsMappingHelpOpen] = useState(false);

  const handleOpenCreateMapping = () => {
    setMappingToEdit(null);
    setIsMappingModalOpen(true);
  };

  const handleOpenEditMapping = (mapping: FixedExpenseMapping) => {
    setMappingToEdit(mapping);
    setIsMappingModalOpen(true);
  };

  // Contas fixas pendentes dispensadas temporariamente nesta sessão
  const [dismissedBills, setDismissedBills] = useState<Record<string, boolean>>({});

  // Contas pendentes com vencimento fixo chegado ou próximo
  const pendingFixedBills = useMemo(() => {
    return getPendingFixedBills(natures, movements, new Date(), 3);
  }, [natures, movements]);

  // Contas a exibir no banner (excluindo as dispensadas)
  const activePendingBills = useMemo(() => {
    return pendingFixedBills.filter((b) => !dismissedBills[`${b.natureId}_${b.mappingId}`]);
  }, [pendingFixedBills, dismissedBills]);

  // Ação rápida: Confirmar pagamento de conta fixa com 1 clique
  const handleConfirmBillDirectly = (bill: PendingFixedBill) => {
    // 1. Cria a movimentação de saída realizada
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

    // 2. Marca todos os itens do mapeamento como realizados no mês
    bill.items.forEach((item) => {
      if (!item.isFulfilled) {
        toggleItemFulfilled(bill.natureId, bill.mappingId, item.id);
      }
    });

    // 3. Remove o alerta do banner
    setDismissedBills((prev) => ({ ...prev, [`${bill.natureId}_${bill.mappingId}`]: true }));
  };

  // Ação rápida: Abrir modal de movimentação com os dados já preenchidos para ajuste
  const handleAdjustBillMovement = (bill: PendingFixedBill) => {
    if (onOpenNewMovementModal) {
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
    }
  };

  // Active Nature data
  const selectedNature = natures.find((n) => n.id === selectedNatureId) || natures[0];
  const natureCeiling = selectedNature ? getNatureCeiling(selectedNature) : 0;
  const natureSpent = selectedNature ? getNatureSpent(selectedNature) : 0;
  const ceilingPercentUsed =
    natureCeiling > 0 ? Math.round((natureSpent / natureCeiling) * 100) : 0;
  const isCeilingOver = natureCeiling > 0 && natureSpent > natureCeiling;
  const isCeilingFar = natureCeiling > 0 && !isCeilingOver && natureSpent < natureCeiling * 0.75;
  const missingItems = selectedNature ? getNatureMissingItems(selectedNature) : [];

  // Total ceiling of all natures combined
  const totalAllCeilings = natures.reduce((acc, nat) => acc + getNatureCeiling(nat), 0);
  const totalAllSpent = natures.reduce((acc, nat) => acc + getNatureSpent(nat), 0);

  const startEditingItem = (item: MappingItem) => {
    setEditingItemId(item.id);
    setEditDesc(item.description);
    setEditQty(item.quantity);
    setEditPrice(item.price);
    setEditMult(item.multiplierWeeks || 1);

    const rec =
      item.recurrenceType ||
      ((item.multiplierWeeks && item.multiplierWeeks >= 20)
        ? 'DIARIO'
        : item.dayOfWeek
        ? 'SEMANAL'
        : item.dayOfFortnight !== undefined && item.dayOfFortnight > 0
        ? 'QUINZENAL'
        : item.dayOfMonth !== undefined && item.dayOfMonth > 0
        ? 'MENSAL'
        : item.multiplierWeeks === 4 || item.multiplierWeeks === 5
        ? 'SEMANAL'
        : item.multiplierWeeks === 2
        ? 'QUINZENAL'
        : 'MENSAL');

    setEditRecurrenceType(rec);
    setEditDayOfWeek(item.dayOfWeek || 'SABADO');
    setEditDayOfFortnight(item.dayOfFortnight || 1);
    setEditDayOfMonth(item.dayOfMonth !== undefined && item.dayOfMonth > 0 ? item.dayOfMonth : 10);
    setEditKeywords(item.keywords ? item.keywords.join(', ') : '');
  };

  const handleSaveItemEdit = (mappingId: string, itemId: string) => {
    if (!selectedNature) return;
    const parsedQty =
      typeof editQty === 'number'
        ? editQty
        : parseFloat(String(editQty).replace(',', '.')) || 0;
    const parsedPrice =
      typeof editPrice === 'number'
        ? editPrice
        : parseFloat(String(editPrice).replace(',', '.')) || 0;

    const parsedKeywords = editKeywords
      .split(/[,;\n]+/)
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length >= 2);

    updateMappingItem(selectedNature.id, mappingId, itemId, {
      description: editDesc.trim(),
      quantity: parsedQty > 0 ? Math.round(parsedQty * 1000) / 1000 : 0.001,
      price: Math.max(0, Math.round(parsedPrice * 1000) / 1000),
      multiplierWeeks: Math.max(1, editMult),
      recurrenceType: editRecurrenceType,
      dayOfWeek: editRecurrenceType === 'SEMANAL' ? editDayOfWeek : undefined,
      dayOfFortnight: editRecurrenceType === 'QUINZENAL' ? editDayOfFortnight : undefined,
      dayOfMonth: editRecurrenceType === 'MENSAL' ? editDayOfMonth : undefined,
      keywords: Array.from(new Set(parsedKeywords)),
    });
    setEditingItemId(null);
  };

  return (
    <div className={`naturezas-page-container animate-fade-in ${embedded ? 'embedded' : 'page-container'}`}>
      {/* Page Header (if not embedded in Profile) */}
      {!embedded && (
        <div className="page-header">
          <div>
            <div className="kicker-badge">
              <Layers size={13} className="mr-1" />
              <span>PLANEJAMENTO ORÇAMENTÁRIO & TETOS</span>
            </div>
            <h1 className="page-title">Controle de Naturezas</h1>
            <p className="page-subtitle">
              Ajuste os tetos orçamentários, estruture mapeamentos matemáticos e componha os itens de gastos fixos
            </p>
          </div>
          <div className="page-header-actions">
            <button
              className="btn btn-primary"
              onClick={handleOpenCreateNature}
              id="btn-nova-natureza"
            >
              <Plus size={16} />
              <span>Nova Natureza</span>
            </button>
          </div>
        </div>
      )}

      {/* Global Ceilings Summary Bar */}
      {!embedded && (
        <div className="glass-card mb-4 p-4 flex items-center justify-between flex-wrap gap-4 border border-[var(--border-default)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[rgba(245,158,11,0.15)] text-amber-500 font-bold text-lg">
              🎯
            </div>
            <div>
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                Teto Global das Naturezas
              </span>
              <strong className="text-xl font-black text-[var(--text-primary)]">
                {totalAllCeilings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-[var(--text-muted)] block">Realizado no Mês</span>
              <strong className={`text-base font-bold ${totalAllSpent > totalAllCeilings ? 'text-rose-500' : 'text-emerald-500'}`}>
                {totalAllSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </strong>
            </div>

            <div>
              <span className="text-xs text-[var(--text-muted)] block">Naturezas Cadastradas</span>
              <strong className="text-base font-bold text-[var(--text-primary)]">
                {natures.length} naturezas
              </strong>
            </div>

            <div>
              <span className="text-xs text-[var(--text-muted)] block">Consumo Geral</span>
              <span className="badge badge-cyan font-bold">
                {totalAllCeilings > 0 ? Math.round((totalAllSpent / totalAllCeilings) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* BANNER INTELIGENTE: QUESTIONAMENTO DE CONTAS FIXAS PREVISTAS NO MÊS */}
      {activePendingBills.length > 0 && (
        <div className="pending-bills-prompt-container mb-4">
          {activePendingBills.map((bill) => {
            const isLate = bill.isOverdue;
            const isToday = bill.isDueToday;

            return (
              <div
                key={`bill_${bill.natureId}_${bill.mappingId}`}
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
                      width: '42px',
                      height: '42px',
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
                    {bill.mappingIcon ? (
                      <span style={{ fontSize: '1.4rem' }}>{bill.mappingIcon}</span>
                    ) : (
                      <Calendar size={20} />
                    )}
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
                        Vencimento fixo no Dia {bill.dayOfMonth} ({bill.dueDate.split('-').reverse().join('/')})
                      </span>
                    </div>
                    <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Você já efetuou o pagamento de {bill.mappingName} ({bill.natureName})?
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>
                      Valor previsto no mapeamento:{' '}
                      <strong className="text-emerald font-bold" style={{ fontSize: '0.95rem' }}>
                        {bill.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                      {' • '}
                      <span style={{ color: 'var(--text-muted)' }}>
                        Itens: {bill.itemDescriptions.slice(0, 3).join(', ')}{bill.itemDescriptions.length > 3 ? '...' : ''}
                      </span>
                    </p>
                    <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                      {isLate
                        ? 'O dia previsto de vencimento já passou. Se você já pagou este boleto/fatura, confirme abaixo para manter o teto e extrato em dia.'
                        : 'Confirme com 1 clique se já pagou ou clique em "Ajustar Valor" caso o valor da fatura deste mês tenha variado.'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.9rem' }}
                    onClick={() => handleConfirmBillDirectly(bill)}
                    title="Confirmar pagamento e registrar saída realizada"
                  >
                    <CheckCircle2 size={15} />
                    <span>Confirmar Pagamento ({bill.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>
                  </button>

                  {onOpenNewMovementModal && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.85rem' }}
                      onClick={() => handleAdjustBillMovement(bill)}
                      title="Abrir para alterar o valor real pago antes de lançar"
                    >
                      <Zap size={14} />
                      <span>Ajustar Valor</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)' }}
                    onClick={() => setDismissedBills((prev) => ({ ...prev, [`${bill.natureId}_${bill.mappingId}`]: true }))}
                    title="Lembrar mais tarde"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      <div className="naturezas-subtab">
        {embedded && (
          <div className="naturezas-header-row">
            <div>
              <h3>Naturezas & Mapeamento de Gastos Fixos</h3>
              <p className="subtab-desc">
                Cadastre suas naturezas orçamentárias e estruture mapeamentos matemáticos de gastos fixos para justificar cada Teto.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleOpenCreateNature}>
              <Plus size={16} />
              <span>Nova Natureza</span>
            </button>
          </div>
        )}

        {/* Seletor de Naturezas em Dropdown */}
        <div className="naturezas-dropdown-container" style={{ position: 'relative', marginBottom: '20px' }}>
          {selectedNature && (() => {
            const ceil = getNatureCeiling(selectedNature);
            const spent = getNatureSpent(selectedNature);
            const isOver = ceil > 0 && spent > ceil;
            const isFar = ceil > 0 && spent < ceil * 0.75;
            return (
              <button
                className="natureza-tab-item active"
                onClick={() => setIsNatureDropdownOpen(!isNatureDropdownOpen)}
                style={{ borderLeftColor: selectedNature.color, width: '100%', display: 'flex', flexDirection: 'column', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div className="natureza-tab-top" style={{ marginBottom: 0 }}>
                    <span className="natureza-tab-icon">{selectedNature.icon}</span>
                    <strong className="natureza-tab-name">{selectedNature.name}</strong>
                  </div>
                  {isNatureDropdownOpen ? <ChevronUp size={20} className="text-muted" /> : <ChevronDown size={20} className="text-muted" />}
                </div>
                <div className="natureza-tab-meta" style={{ marginTop: '8px' }}>
                  <span className="natureza-tab-ceiling">
                    Teto: {ceil.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  {isOver ? (
                    <span className="badge badge-rose text-xs">TETO EXCEDIDO</span>
                  ) : isFar ? (
                    <span className="badge badge-cyan text-xs">LONGE DO TETO</span>
                  ) : (
                    <span className="badge badge-emerald text-xs">NO LIMITE</span>
                  )}
                </div>
              </button>
            );
          })()}

          {isNatureDropdownOpen && (
            <div 
              className="naturezas-dropdown-menu" 
              style={{ 
                position: 'absolute', 
                top: '100%', 
                left: 0, 
                right: 0, 
                zIndex: 50, 
                background: 'var(--bg-space)', 
                border: '1px solid var(--border-default)', 
                borderRadius: '12px', 
                marginTop: '8px',
                maxHeight: '400px', 
                overflowY: 'auto',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px'
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', padding: '0 4px' }}>
                Selecione uma natureza para visualizar:
              </div>
              {natures.map((nat) => {
                const ceil = getNatureCeiling(nat);
                const spent = getNatureSpent(nat);
                const isOver = ceil > 0 && spent > ceil;
                const isFar = ceil > 0 && spent < ceil * 0.75;
                const isSelected = selectedNature?.id === nat.id;

                if (isSelected) return null;

                return (
                  <button
                    key={nat.id}
                    className="natureza-tab-item"
                    onClick={() => {
                      setSelectedNatureId(nat.id);
                      setIsNatureDropdownOpen(false);
                    }}
                    style={{ borderLeftColor: nat.color, margin: 0, width: '100%' }}
                  >
                    <div className="natureza-tab-top">
                      <span className="natureza-tab-icon">{nat.icon}</span>
                      <strong className="natureza-tab-name">{nat.name}</strong>
                    </div>
                    <div className="natureza-tab-meta">
                      <span className="natureza-tab-ceiling">
                        Teto: {ceil.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      {isOver ? (
                        <span className="badge badge-rose text-xs">TETO EXCEDIDO</span>
                      ) : isFar ? (
                        <span className="badge badge-cyan text-xs">LONGE DO TETO</span>
                      ) : (
                        <span className="badge badge-emerald text-xs">NO LIMITE</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedNature ? (
          <div className="natureza-selected-detail">
            {/* Card Resumo do Teto Matemático da Natureza */}
            <div className="natureza-kpi-banner glass-card">
              <div className="natureza-info-left">
                <div className="natureza-badge-title">
                  <div
                    className="natureza-large-icon-wrapper"
                    style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => handleOpenEditNature(selectedNature)}
                    title="Clique para editar nome, emoji e cor da natureza"
                  >
                    <span
                      className="natureza-large-icon"
                      style={{
                        boxShadow: `0 0 16px ${selectedNature.color}33`,
                        borderColor: `${selectedNature.color}66`,
                      }}
                    >
                      {selectedNature.icon}
                    </span>
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#38BDF8',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                      }}
                    >
                      <Edit2 size={11} />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="natureza-title-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 style={{ borderLeft: `3px solid ${selectedNature.color}`, paddingLeft: '8px', margin: 0 }}>
                        {selectedNature.name}
                      </h4>
                      <span
                        className={`badge ${
                          selectedNature.type === 'ESSENCIAL'
                            ? 'badge-cyan'
                            : selectedNature.type === 'FIXA'
                            ? 'badge-amber'
                            : 'badge-emerald'
                        }`}
                      >
                        {selectedNature.type}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-xs text-cyan"
                          title="Editar Nome, Emoji e Cor desta Natureza"
                          onClick={() => handleOpenEditNature(selectedNature)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Edit2 size={12} />
                          <span>Editar Natureza</span>
                        </button>

                        {natures.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-rose"
                            title="Excluir esta Natureza"
                            onClick={() => {
                              confirmAction({
                                title: 'Excluir Natureza',
                                message: `Deseja realmente excluir a natureza "${selectedNature.name}" e todos os seus mapeamentos e itens? Esta ação não pode ser desfeita.`,
                                confirmLabel: 'Sim, Excluir',
                                onConfirm: () => {
                                  deleteNature(selectedNature.id);
                                  const next = natures.find((n) => n.id !== selectedNature.id);
                                  if (next) setSelectedNatureId(next.id);
                                },
                              });
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Trash2 size={12} />
                            <span>Excluir</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="natureza-desc-text">
                      {selectedNature.description ||
                        'Mapeamentos matemáticos definem a fundamentação do teto de gastos desta natureza. Ajuste os itens abaixo para recalcular o teto.'}
                    </p>

                    {/* Palavras-chave da Natureza para a IA Forseti */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles size={11} className="text-cyan" />
                        <span>Palavras-chave IA:</span>
                      </span>
                      {selectedNature.keywords && selectedNature.keywords.length > 0 ? (
                        <>
                          {selectedNature.keywords.map((kw, kIdx) => (
                            <span
                              key={kIdx}
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 7px',
                                borderRadius: '4px',
                                background: 'rgba(6, 182, 212, 0.12)',
                                border: '1px solid rgba(6, 182, 212, 0.25)',
                                color: '#67E8F9',
                                fontWeight: 500,
                              }}
                            >
                              #{kw}
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleOpenEditNature(selectedNature)}
                            style={{
                              fontSize: '0.68rem',
                              color: 'var(--text-muted)',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0 2px',
                            }}
                            title="Editar palavras-chave da natureza"
                          >
                            <Edit2 size={10} style={{ display: 'inline', opacity: 0.6 }} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenEditNature(selectedNature)}
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            background: 'transparent',
                            border: 'none',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                          title="Cadastrar palavras-chave para a IA classificar faturas e notas nesta natureza"
                        >
                          + Adicionar palavras-chave para a IA
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra de Progresso do Teto (Clicável para expandir KPIs) */}
              <div 
                className="natureza-progress-container mt-4" 
                onClick={() => setIsKpisExpanded(!isKpisExpanded)}
                style={{ cursor: 'pointer' }}
                title="Clique para ver os subtotais do orçamento"
              >
                <div className="natureza-progress-labels">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Consumo do Teto Orçamentário
                    {isKpisExpanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                  </span>
                  <span>{ceilingPercentUsed}%</span>
                </div>
                <div className="natureza-progress-track">
                  <div
                    className={`natureza-progress-fill ${
                      isCeilingOver ? 'bg-rose' : ceilingPercentUsed < 75 ? 'bg-cyan' : 'bg-amber'
                    }`}
                    style={{ width: `${Math.min(ceilingPercentUsed, 100)}%` }}
                  />
                </div>
              </div>

              {/* Subtotais - Exibidos apenas se expandido */}
              {isKpisExpanded && (
                <div className="natureza-kpis-grid animate-fade-in" style={{ marginTop: '16px' }}>
                  <div className="nat-kpi-box">
                    <span className="nat-kpi-label">
                      <Calculator size={14} className="text-cyan" />
                      Teto Calculado
                    </span>
                    <strong className="nat-kpi-val text-cyan">
                      {natureCeiling.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                    <span className="nat-kpi-sub">
                      Soma de {selectedNature.mappings.length} mapeamento(s)
                    </span>
                  </div>

                  <div className="nat-kpi-box">
                    <span className="nat-kpi-label">
                      <CreditCard size={14} className="text-emerald" />
                      Gasto Real no Mês
                    </span>
                    <strong
                      className={`nat-kpi-val ${isCeilingOver ? 'text-rose' : 'text-emerald'}`}
                    >
                      {natureSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                    <span className="nat-kpi-sub">{ceilingPercentUsed}% do teto consumido</span>
                  </div>

                  <div className="nat-kpi-box">
                    <span className="nat-kpi-label">
                      {isCeilingOver ? (
                        <AlertTriangle size={14} className="text-rose" />
                      ) : (
                        <CheckCircle2 size={14} className="text-cyan" />
                      )}
                      Margem Orçamentária
                    </span>
                    <strong
                      className={`nat-kpi-val ${isCeilingOver ? 'text-rose' : 'text-white'}`}
                    >
                      {isCeilingOver
                        ? `+${(natureSpent - natureCeiling).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}`
                        : (natureCeiling - natureSpent).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                    </strong>
                    <span className="nat-kpi-sub">
                      {isCeilingOver ? 'Acima do Teto' : 'Disponível até o Teto'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* BLOCO INTELIGENTE 1: TETO ULTRAPASSADO -> JUSTIFICATIVA OU AJUSTE (RECOLHÍVEL) */}
            {isCeilingOver && (
              <div className="ceiling-alert-box alert-over-ceiling glass-card animate-fade-in mt-4">
                <div
                  className="ceiling-alert-header cursor-pointer select-none"
                  onClick={() => setIsOverCeilingExpanded(!isOverCeilingExpanded)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <AlertTriangle size={22} className="text-rose flex-shrink-0" />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 className="text-rose" style={{ margin: 0 }}>
                          Teto de Gastos Ultrapassado em{' '}
                          {(natureSpent - natureCeiling).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 3,
                          })}
                        </h4>
                        <span className="badge badge-rose text-xs">Excedido</span>
                      </div>
                      {!isOverCeilingExpanded && (
                        <p className="text-xs text-muted" style={{ margin: '3px 0 0' }}>
                          Clique para registrar justificativa contábil ou consultar o histórico de desvios.
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-rose"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOverCeilingExpanded(!isOverCeilingExpanded);
                    }}
                  >
                    <span>{isOverCeilingExpanded ? 'Recolher' : 'Expandir'}</span>
                    {isOverCeilingExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {isOverCeilingExpanded && (
                  <div className="animate-fade-in mt-3" style={{ borderTop: '1px solid rgba(244, 63, 94, 0.2)', paddingTop: '12px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '12px' }}>
                      A despesa acumulada nesta natureza superou o teto estipulado pelos mapeamentos.
                      Registre uma justificativa contábil para auditoria ou reajuste os valores dos itens abaixo.
                    </p>

                    <div className="justification-form-box mt-3">
                      <label>Justificativa do Desvio Orçamentário:</label>
                      <div className="justification-input-row">
                        <input
                          type="text"
                          className="form-input flex-1"
                          placeholder="Ex: Compra extraordinária para evento em casa e aumento de preços..."
                          value={justificationText}
                          onChange={(e) => setJustificationText(e.target.value)}
                        />
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            if (!justificationText.trim()) return;
                            saveCeilingJustification(selectedNature.id, justificationText);
                            setJustificationText('');
                            alert('Justificativa contábil registrada com sucesso!');
                          }}
                        >
                          <FileText size={16} />
                          <span>Gravar Justificativa</span>
                        </button>
                      </div>

                      {selectedNature.justificationHistory &&
                        selectedNature.justificationHistory.length > 0 && (
                          <div className="justification-history mt-3">
                            <span className="justification-history-title">
                              Histórico de Justificativas Registradas:
                            </span>
                            <div className="justification-history-list">
                              {selectedNature.justificationHistory.map((just) => (
                                <div key={just.id} className="just-item">
                                  <div className="just-item-meta">
                                    <strong>
                                      {just.date} ({just.month})
                                    </strong>
                                    <span className="text-rose">
                                      Excedente: +
                                      {(just.spentAmount - just.ceilingAmount).toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 3,
                                      })}
                                    </span>
                                  </div>
                                  <p className="just-item-reason">"{just.reason}"</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BLOCO INTELIGENTE 2: LONGE DO TETO -> DIAGNÓSTICO PRECISO DE ITENS EM FALTA (RECOLHÍVEL POR PADRÃO) */}
            {isCeilingFar && (
              <div className="mt-4" style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn glass-card flex items-center justify-center gap-2 w-full p-4 hover:bg-cyan/10"
                  onClick={() => setIsDiagnosticExpanded(true)}
                  style={{ border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '16px' }}
                >
                  <Info size={20} className="text-cyan" />
                  <span className="font-bold text-cyan text-sm">Diagnóstico Orçamentário</span>
                  <span className="badge badge-cyan ml-2 text-xs">
                    {missingItems.length} {missingItems.length === 1 ? 'item pendente' : 'itens pendentes'}
                  </span>
                </button>
              </div>
            )}

            <Modal
              isOpen={isDiagnosticExpanded}
              onClose={() => setIsDiagnosticExpanded(false)}
              title="Diagnóstico Orçamentário"
            >
              <div className="animate-fade-in" style={{ padding: '4px 0' }}>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
                  Falta realizar{' '}
                  <strong className="text-cyan">
                    {(natureCeiling - natureSpent).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 3,
                    })}
                  </strong>{' '}
                  em compras planejadas (Você realizou{' '}
                  <strong>{natureSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>{' '}
                  de um teto estipulado de{' '}
                  <strong>{natureCeiling.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>).<br /><br />
                  O BALDER identificou os seguintes{' '}
                  <strong>itens do mapeamento que ainda estão pendentes de compra</strong> no mês:
                </p>

                {missingItems.length > 0 ? (
                  <div className="missing-items-table-box" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <table className="natureza-items-table">
                      <thead>
                        <tr>
                          <th>Item Mapeado</th>
                          <th>Mapeamento Origem</th>
                          <th>Qtd × Preço × Semanas</th>
                          <th>Valor Previsto</th>
                          <th>Falta Realizar</th>
                          <th>Ação Rápida</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missingItems.map(({ item, mappingName, missingAmount }) => (
                          <tr key={item.id} className="missing-item-row">
                            <td>
                              <strong>{item.description}</strong>
                            </td>
                            <td>
                              <span className="badge badge-cyan text-xs">{mappingName}</span>
                            </td>
                            <td>
                              {typeof item.quantity === 'number'
                                ? item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
                                : item.quantity}{' '}
                              {item.unit || 'un'} ×{' '}
                              {item.price.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 3,
                              })}{' '}
                              × {item.multiplierWeeks}{' '}
                              {item.multiplierWeeks > 1 ? 'semanas' : 'sem'}
                            </td>
                            <td>
                              {item.totalValue.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 3,
                              })}
                            </td>
                            <td className="text-cyan font-bold">
                              {missingAmount.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 3,
                              })}
                            </td>
                            <td>
                              <button
                                className="btn btn-outline btn-xs"
                                title="Marcar item como comprado/liquidado no mês"
                                onClick={() => {
                                  const parentMap = selectedNature.mappings.find((m) =>
                                    m.items.some((it) => it.id === item.id)
                                  );
                                  if (parentMap) {
                                    toggleItemFulfilled(selectedNature.id, parentMap.id, item.id);
                                  }
                                }}
                              >
                                <Check size={12} className="text-emerald" />
                                <span>Marcar Comprado</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="subtab-desc mt-2">Todos os itens mapeados já foram marcados como realizados.</p>
                )}
              </div>
            </Modal>

            {/* SEÇÃO DE MAPEAMENTOS DE GASTOS FIXOS */}
            <div className="natureza-mappings-section mt-4">
              <div className="mappings-section-header">
                <div>
                  <h4>Mapeamentos ({selectedNature.mappings.length})</h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-cyan text-xs flex items-center gap-1.5 cursor-pointer"
                    onClick={() => setIsMappingHelpOpen(!isMappingHelpOpen)}
                    title="Aprenda como funcionam e como criar Mapeamentos"
                  >
                    <Sparkles size={14} className="text-cyan" />
                    <span>{isMappingHelpOpen ? 'Ocultar Guia' : 'Como Funciona?'}</span>
                  </button>
                  <button
                    className="btn btn-outline btn-sm flex items-center gap-1.5"
                    onClick={handleOpenCreateMapping}
                  >
                    <Plus size={14} />
                    <span>Novo Mapeamento</span>
                  </button>
                </div>
              </div>

              {/* Guia Didático da Forseti sobre Mapeamentos */}
              {isMappingHelpOpen && (
                <div className="glass-card p-4 mt-3 mb-3 border border-cyan/25 rounded-2xl animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={16} className="text-cyan" />
                    <h5 className="text-xs font-bold text-cyan uppercase tracking-wider">
                      Guia Prático da Forseti: O que é um Mapeamento e como ele calcula o Teto
                    </h5>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-300 mb-3">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <strong className="text-white block mb-1">1. Crie a Rotina</strong>
                      <span className="text-[11px] text-slate-400">
                        Clique em <strong>+ Novo Mapeamento</strong> e defina o nome (ex: 🥦 Feira Semanal ou 🛒 Supermercado).
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <strong className="text-white block mb-1">2. Lance os Itens</strong>
                      <span className="text-[11px] text-slate-400">
                        Informe os produtos com quantidade, preço unitário e multiplicador de semanas.
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <strong className="text-white block mb-1">3. Teto Matemático</strong>
                      <span className="text-[11px] text-slate-400">
                        A soma de todos os itens compõe o teto da natureza. Ao comprar no mês, basta dar check no item!
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    💡 <strong>Multiplicador Automático:</strong> Compras semanais (ex: Feira R$ 65) multiplicam por 4 semanas (R$ 260/mês). Compras quinzenais multiplicam por 2. O Balder compõe seu teto sem necessidade de palpites!
                  </p>
                </div>
              )}

              {selectedNature.mappings.length === 0 ? (
                <div className="empty-mappings-box glass-card mt-3" style={{ padding: '24px 20px', textAlign: 'center' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '14px',
                      background: 'rgba(6, 182, 212, 0.12)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px',
                      color: 'var(--accent-cyan)',
                    }}
                  >
                    <Sparkles size={24} />
                  </div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                    Como compor o teto de {selectedNature.name}?
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 16px', lineHeight: 1.5 }}>
                    No Balder, o teto de uma Natureza nasce da decomposição em <strong>Mapeamentos de Rotinas Reais</strong> (ex: feira semanal, compras de mercado, açougue ou contas fixas). Cadastre os itens com seus preços e o sistema calcula a soma mensal automaticamente.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm flex items-center gap-1.5"
                      onClick={handleOpenCreateMapping}
                    >
                      <Plus size={15} />
                      <span>Criar Primeiro Mapeamento</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm text-xs flex items-center gap-1.5 text-cyan border-cyan/40"
                      onClick={() => {
                        if (confirm(`Deseja carregar sugestões de rotina e mapeamentos padrão para "${selectedNature.name}"?`)) {
                          loadSuggestedMappingsForNature(selectedNature.id);
                        }
                      }}
                      title="Carregar itens e rotinas pré-configuradas para esta natureza"
                    >
                      <Sparkles size={13} className="text-amber-400" />
                      <span>💡 Carregar Modelos da Forseti</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mappings-list-container">
                  {/* Barra de Ferramentas dos Mapeamentos: Contagem, Instrução e Recolher/Expandir Todos */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '16px',
                      marginBottom: '6px',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {selectedNature.mappings.length}{' '}
                        {selectedNature.mappings.length === 1 ? 'Mapeamento' : 'Mapeamentos'} nesta Natureza
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        • Arraste ou use as setas para ordenar
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-muted hover:text-white"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '3px 8px' }}
                        onClick={() => handleExpandCollapseAll(false)}
                        title="Expandir todos os mapeamentos desta natureza"
                      >
                        <ChevronDown size={13} />
                        <span>Expandir Todos</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-muted hover:text-white"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '3px 8px' }}
                        onClick={() => handleExpandCollapseAll(true)}
                        title="Recolher todos os mapeamentos desta natureza"
                      >
                        <ChevronUp size={13} />
                        <span>Recolher Todos</span>
                      </button>
                    </div>
                  </div>

                  {selectedNature.mappings.map((mapping, mappingIndex) => {
                    // Default to collapsed (true) when mapping has no saved state
                    const isCollapsed = collapsedMappings[mapping.id] !== false;
                    const isDragging = draggedMappingId === mapping.id;
                    const isOver = dragOverMappingId === mapping.id;
                    const mappingTotal = (mapping.items || []).reduce(
                      (acc, it) => acc + it.totalValue,
                      0
                    );

                    return (
                      <div
                        key={mapping.id}
                        className={`mapping-card glass-card mt-4 ${isCollapsed ? 'mapping-collapsed' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, mapping.id)}
                        onDragOver={(e) => handleDragOver(e, mapping.id)}
                        onDrop={(e) => handleDrop(e, mapping.id)}
                        onDragEnd={() => {
                          setDraggedMappingId(null);
                          setDragOverMappingId(null);
                        }}
                        style={{
                          opacity: isDragging ? 0.35 : 1,
                          border: isOver ? '2px dashed var(--accent-cyan)' : undefined,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div className="mapping-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
                          {/* LINHA 1: Ícones de Arraste, Emoji e Título */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Alça de Arraste e Setas de Ordenação */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <div
                                style={{
                                  cursor: 'grab',
                                  color: 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '2px',
                                }}
                                title="Arraste para reordenar este mapeamento"
                              >
                                <GripVertical size={16} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs p-0 text-slate-400 hover:text-white"
                                  style={{
                                    height: '13px',
                                    width: '18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  disabled={mappingIndex === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveMappingOrder(selectedNature.id, mapping.id, 'UP');
                                  }}
                                  title="Mover mapeamento para cima"
                                >
                                  <ChevronUp size={11} style={{ opacity: mappingIndex === 0 ? 0.2 : 1 }} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs p-0 text-slate-400 hover:text-white"
                                  style={{
                                    height: '13px',
                                    width: '18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  disabled={mappingIndex === selectedNature.mappings.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveMappingOrder(selectedNature.id, mapping.id, 'DOWN');
                                  }}
                                  title="Mover mapeamento para baixo"
                                >
                                  <ChevronDown size={11} style={{ opacity: mappingIndex === selectedNature.mappings.length - 1 ? 0.2 : 1 }} />
                                </button>
                              </div>
                            </div>

                            {/* Emoji Próprio do Mapeamento */}
                            <div
                              className="mapping-icon-badge"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.1rem',
                                cursor: 'pointer',
                                flexShrink: 0,
                                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                                transition: 'all 0.15s ease',
                              }}
                              onClick={() => handleOpenEditMapping(mapping)}
                              title="Clique para editar este mapeamento e seu emoji"
                            >
                              {mapping.icon || '📋'}
                            </div>

                            <h5 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {mapping.name}
                            </h5>
                          </div>

                          {/* LINHA 2: Subtotal (apenas o valor), qtd Itens e o simbolo de palavras chave */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className="badge badge-cyan" style={{ fontSize: '12px', padding: '4px 10px', fontWeight: 600 }}>
                              {mappingTotal.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 3,
                              })}
                            </span>
                            <span className="badge badge-emerald" style={{ fontSize: '12px', padding: '4px 10px', fontWeight: 600 }}>
                              {mapping.items.length}{' '}
                              {mapping.items.length === 1 ? 'ITEM' : 'ITENS'}
                            </span>
                            <button
                              type="button"
                              className="badge badge-outline text-cyan hover:border-cyan cursor-pointer"
                              onClick={() => setKeywordsModalMapping(mapping)}
                              title="Gerenciar palavras-chave da IA"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', padding: 0, background: 'rgba(6, 182, 212, 0.05)' }}
                            >
                              <Tag size={13} />
                            </button>
                          </div>

                          {/* LINHA 3: Botões (Expandir, editar e Excluir) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-outline"
                              style={{
                                flex: 1,
                                padding: '6px 0',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                color: isCollapsed ? '#FCD34D' : '#94A3B8',
                                borderColor: isCollapsed ? 'rgba(252, 211, 77, 0.4)' : 'rgba(255, 255, 255, 0.12)',
                                background: isCollapsed ? 'rgba(252, 211, 77, 0.08)' : 'transparent',
                              }}
                              title={isCollapsed ? 'Expandir itens deste mapeamento' : 'Recolher itens deste mapeamento'}
                              onClick={() => toggleMappingCollapse(mapping.id)}
                            >
                              {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                              <span>{isCollapsed ? 'Expandir' : 'Recolher'}</span>
                            </button>

                            <button
                              type="button"
                              className="btn btn-outline text-cyan"
                              title="Editar Nome, Emoji e Vencimento deste Mapeamento"
                              onClick={() => handleOpenEditMapping(mapping)}
                              style={{ flex: 1, padding: '6px 0', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                              <Edit2 size={13} />
                              <span>Editar</span>
                            </button>

                            <button
                              className="btn btn-outline text-rose"
                              title="Excluir Mapeamento"
                              onClick={() => {
                                confirmAction({
                                  title: 'Excluir Mapeamento',
                                  message: `Deseja remover o mapeamento "${mapping.name}" e todos os seus itens? Esta ação não pode ser desfeita.`,
                                  confirmLabel: 'Sim, Excluir',
                                  onConfirm: () => deleteMapping(selectedNature.id, mapping.id),
                                });
                              }}
                              style={{ flex: 1, padding: '6px 0', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                              <Trash2 size={13} />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </div>

                        {/* Visualização da Tabela de Itens (ocultada se recolhido) */}
                        {!isCollapsed && (
                          <>
                            {/* TABELA DE ITENS DO MAPEAMENTO COM EDIÇÃO INLINE */}
                            <div className="mapping-items-table-wrapper mt-3">
                              <table className="natureza-items-table">
                            <thead>
                              <tr>
                                <th style={{ width: '25%' }}>Descrição / Item</th>
                                <th style={{ width: '9%' }}>Qtd</th>
                                <th style={{ width: '12%' }}>Preço Unit.</th>
                                <th style={{ width: '22%' }}>Dia de Manifestação</th>
                                <th style={{ width: '12%' }}>Multiplicador</th>
                                <th style={{ width: '12%' }}>Valor Total (Teto)</th>
                                <th style={{ width: '8%' }}>Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mapping.items.map((item) => {
                                const isEditing = editingItemId === item.id;

                                if (isEditing) {
                                  const numQty =
                                    typeof editQty === 'number'
                                      ? editQty
                                      : parseFloat(String(editQty).replace(',', '.')) || 0;
                                  const numPrice =
                                    typeof editPrice === 'number'
                                      ? editPrice
                                      : parseFloat(String(editPrice).replace(',', '.')) || 0;
                                  const previewTotal = Math.round(numQty * numPrice * editMult * 1000) / 1000;

                                  return (
                                    <tr key={item.id} className="item-row-editing bg-[rgba(2,132,199,0.08)]">
                                      <td>
                                        <div className="flex flex-col gap-1">
                                          <input
                                            type="text"
                                            className="form-input form-input-sm"
                                            value={editDesc}
                                            onChange={(e) => setEditDesc(e.target.value)}
                                            autoFocus
                                            placeholder="Descrição do item"
                                          />
                                          <input
                                            type="text"
                                            className="form-input form-input-sm text-xs py-1"
                                            placeholder="🏷️ Palavras-chave p/ IA (ex: pilão, melitta, 500g)"
                                            value={editKeywords}
                                            onChange={(e) => setEditKeywords(e.target.value)}
                                            title="Palavras-chave ou termos de notas fiscais separadas por vírgula"
                                          />
                                        </div>
                                      </td>
                                      <td>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          className="form-input form-input-sm text-center font-mono"
                                          placeholder="1"
                                          value={editQty}
                                          onChange={(e) => setEditQty(e.target.value)}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          className="form-input form-input-sm font-mono"
                                          placeholder="0,00"
                                          value={editPrice}
                                          onChange={(e) => setEditPrice(e.target.value)}
                                        />
                                      </td>
                                      <td>
                                        <div className="flex flex-col gap-1">
                                          <select
                                            className="form-input form-input-sm text-xs py-1"
                                            value={editRecurrenceType}
                                            onChange={(e) => {
                                              const val = e.target.value as 'DIARIO' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL';
                                              setEditRecurrenceType(val);
                                              if (val === 'DIARIO') setEditMult(30);
                                              if (val === 'SEMANAL' && editMult < 5) setEditMult(5);
                                              if (val === 'QUINZENAL') setEditMult(2);
                                              if (val === 'MENSAL') setEditMult(1);
                                            }}
                                          >
                                            <option value="DIARIO">☀️ Diário</option>
                                            <option value="SEMANAL">🗓️ Semanal</option>
                                            <option value="QUINZENAL">🌓 Quinzenal</option>
                                            <option value="MENSAL">📅 Mensal</option>
                                          </select>

                                          {editRecurrenceType === 'DIARIO' && (
                                            <span className="text-[11px] text-amber-300/90 font-mono py-0.5">
                                              ☀️ Todos os dias do mês
                                            </span>
                                          )}

                                          {editRecurrenceType === 'SEMANAL' && (
                                            <select
                                              className="form-input form-input-sm text-xs py-1"
                                              value={editDayOfWeek}
                                              onChange={(e) => setEditDayOfWeek(e.target.value as any)}
                                            >
                                              {WEEKDAY_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                  {opt.label}
                                                </option>
                                              ))}
                                            </select>
                                          )}

                                          {editRecurrenceType === 'QUINZENAL' && (
                                            <select
                                              className="form-input form-input-sm text-xs py-1 font-mono"
                                              value={editDayOfFortnight}
                                              onChange={(e) => setEditDayOfFortnight(parseInt(e.target.value) || 1)}
                                            >
                                              {Array.from({ length: 15 }, (_, i) => i + 1).map((d) => (
                                                <option key={d} value={d}>
                                                  Dia {d} (dias {d} e {d + 15})
                                                </option>
                                              ))}
                                            </select>
                                          )}

                                          {editRecurrenceType === 'MENSAL' && (
                                            <select
                                              className="form-input form-input-sm text-xs py-1 font-mono"
                                              value={editDayOfMonth}
                                              onChange={(e) => setEditDayOfMonth(parseInt(e.target.value) || 1)}
                                            >
                                              {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                                                <option key={d} value={d}>
                                                  Dia {d}
                                                </option>
                                              ))}
                                              <option value={31}>Dia 31 (Fim do Mês - ajuste auto 28-31)</option>
                                            </select>
                                          )}
                                        </div>
                                      </td>
                                      <td>
                                        <select
                                          className="form-input form-input-sm"
                                          value={editMult}
                                          onChange={(e) => setEditMult(parseInt(e.target.value) || 1)}
                                        >
                                          <option value={30}>30x (Diário Padrão - 30 dias)</option>
                                          <option value={31}>31x (Mês Longo - 31 dias)</option>
                                          <option value={22}>22x (Dias Úteis - 22 dias)</option>
                                          <option value={20}>20x (Dias Úteis - 20 dias)</option>
                                          <option value={5}>5x (Semanal Padrão - 5 sem)</option>
                                          <option value={4}>4x (Semanal - 4 sem)</option>
                                          <option value={2}>2x (Quinzenal)</option>
                                          <option value={1}>1x (Pontual / Mensal)</option>
                                        </select>
                                      </td>
                                      <td>
                                        <strong className="text-emerald-500 font-bold font-mono">
                                          {previewTotal.toLocaleString('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 3,
                                          })}
                                        </strong>
                                      </td>
                                      <td>
                                        <div className="flex items-center gap-1">
                                          <button
                                            className="btn btn-primary btn-xs"
                                            title="Salvar Alterações"
                                            onClick={() => handleSaveItemEdit(mapping.id, item.id)}
                                          >
                                            <Save size={13} />
                                          </button>
                                          <button
                                            className="btn btn-ghost btn-xs text-muted"
                                            title="Cancelar"
                                            onClick={() => setEditingItemId(null)}
                                          >
                                            <X size={13} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }

                                return (
                                  <tr
                                    key={item.id}
                                    className={item.isFulfilled ? 'item-row-fulfilled' : ''}
                                  >
                                    <td>
                                      <div className="item-desc-cell" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <button
                                          className={`item-check-circle ${
                                            item.isFulfilled ? 'checked' : ''
                                          }`}
                                          title={
                                            item.isFulfilled
                                              ? 'Realizado no mês'
                                              : 'Pendente de compra'
                                          }
                                          onClick={() =>
                                            toggleItemFulfilled(
                                              selectedNature.id,
                                              mapping.id,
                                              item.id
                                            )
                                          }
                                        >
                                          {item.isFulfilled ? '✓' : ''}
                                        </button>
                                        <span
                                            className={
                                              item.isFulfilled
                                                ? 'line-through text-muted'
                                                : 'font-semibold text-white'
                                            }
                                          >
                                            {item.description}
                                          </span>
                                          <button
                                            type="button"
                                            className="btn btn-ghost btn-xs text-indigo-400 hover:text-indigo-300 p-0.5 ml-1 transition-all"
                                            style={{ padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                            title="Gerenciar palavras-chave da IA para este item"
                                            onClick={() => {
                                              setKeywordModalData({
                                                natureId: selectedNature.id,
                                                mappingId: mapping.id,
                                                item,
                                              });
                                              setTagInputText('');
                                            }}
                                          >
                                            <Tag size={12} />
                                            {item.keywords && item.keywords.length > 0 ? (
                                              <span className="text-[10px] font-mono font-bold text-indigo-300">
                                                {item.keywords.length}
                                              </span>
                                            ) : (
                                              <span className="text-[10px] text-indigo-400/80 hover:underline">
                                                + palavras-chave
                                              </span>
                                            )}
                                          </button>
                                        </div>

                                        {item.keywords && item.keywords.length > 0 && (
                                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', paddingLeft: '24px', marginTop: '4px' }}>
                                            {item.keywords.map((kw, kwIdx) => (
                                              <span
                                                key={kwIdx}
                                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-mono"
                                                title={`Palavra-chave cadastrada para a IA: "${kw}"`}
                                              >
                                                <span>#{kw}</span>
                                                <button
                                                  type="button"
                                                  className="hover:text-rose-400 ml-0.5 text-[11px]"
                                                  title={`Remover palavra-chave "${kw}"`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const nextKws = (item.keywords || []).filter((_, idx) => idx !== kwIdx);
                                                    updateMappingItem(selectedNature.id, mapping.id, item.id, { keywords: nextKws });
                                                  }}
                                                >
                                                  ×
                                                </button>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      <span className="item-val-pill font-mono">
                                        {typeof item.quantity === 'number'
                                          ? item.quantity.toLocaleString('pt-BR', {
                                              minimumFractionDigits: 0,
                                              maximumFractionDigits: 3,
                                            })
                                          : item.quantity}
                                      </span>
                                    </td>
                                    <td className="font-mono">
                                      {item.price.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 3,
                                      })}
                                    </td>
                                    <td>
                                      {(() => {
                                        const badge = formatItemScheduleBadge(item);
                                        return (
                                          <div
                                            className="flex items-center gap-1.5 cursor-pointer group"
                                            title={`${badge.detail}. Clique no botão editar para alterar o dia.`}
                                            onClick={() => startEditingItem(item)}
                                          >
                                            <span
                                              className={`badge ${badge.badgeClass} flex items-center gap-1 text-[11px] font-medium py-0.5 px-2 group-hover:brightness-110 transition-all`}
                                            >
                                              <span>{badge.icon}</span>
                                              <span>{badge.label}</span>
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td>
                                      <span className="badge badge-cyan">
                                        {item.multiplierWeeks}x{' '}
                                        {item.multiplierWeeks >= 20
                                          ? 'dias'
                                          : item.multiplierWeeks === 1
                                          ? 'semana/mês'
                                          : 'semanas'}
                                      </span>
                                    </td>
                                    <td>
                                      <strong className="text-glow-cyan font-mono">
                                        {item.totalValue.toLocaleString('pt-BR', {
                                          style: 'currency',
                                          currency: 'BRL',
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 3,
                                        })}
                                      </strong>
                                    </td>
                                    <td>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-xs text-amber-400 hover:text-amber-300"
                                          title="Mover item para outra natureza ou mapeamento"
                                          onClick={() => {
                                            setMoveItemModalData({
                                              item,
                                              sourceNatureId: selectedNature.id,
                                              sourceMappingId: mapping.id,
                                              targetNatureId: selectedNature.id,
                                              targetMappingId: mapping.id,
                                            });
                                          }}
                                        >
                                          <ArrowRightLeft size={13} />
                                        </button>
                                        <button
                                          className="btn btn-ghost btn-xs text-cyan"
                                          title="Ajustar item / dia"
                                          onClick={() => startEditingItem(item)}
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                        <button
                                          className="btn btn-ghost btn-xs text-rose"
                                          title="Excluir item"
                                          onClick={() => {
                                            confirmAction({
                                              title: 'Excluir Item',
                                              message: `Excluir "${item.description}" do mapeamento? Esta ação não pode ser desfeita.`,
                                              confirmLabel: 'Excluir',
                                              onConfirm: () => deleteMappingItem(selectedNature.id, mapping.id, item.id),
                                            });
                                          }}
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* Linha de Cadastro Rápido de Novo Item no Mapeamento */}
                              <tr className="quick-add-item-row">
                                <td>
                                  <input
                                    type="text"
                                    className="form-input form-input-sm"
                                    placeholder="Ex: Frutas Frescas, Açougue..."
                                    value={newItemDesc[mapping.id] || ''}
                                    onChange={(e) =>
                                      setNewItemDesc((prev) => ({
                                        ...prev,
                                        [mapping.id]: e.target.value,
                                      }))
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    className="form-input form-input-sm text-center font-mono"
                                    placeholder="Qtd"
                                    value={
                                      newItemQty[mapping.id] !== undefined
                                        ? newItemQty[mapping.id]
                                        : 1
                                    }
                                    onChange={(e) =>
                                      setNewItemQty((prev) => ({
                                        ...prev,
                                        [mapping.id]: e.target.value as any,
                                      }))
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    className="form-input form-input-sm font-mono"
                                    placeholder="R$ 0,00"
                                    value={
                                      newItemPrice[mapping.id] !== undefined
                                        ? newItemPrice[mapping.id]
                                        : ''
                                    }
                                    onChange={(e) =>
                                      setNewItemPrice((prev) => ({
                                        ...prev,
                                        [mapping.id]: e.target.value as any,
                                      }))
                                    }
                                  />
                                </td>
                                <td>
                                  <div className="flex flex-col gap-1">
                                    <select
                                      className="form-input form-input-sm text-xs py-1"
                                      value={
                                        newItemRecurrenceType[mapping.id] ||
                                        (newItemMult[mapping.id] >= 20
                                          ? 'DIARIO'
                                          : newItemMult[mapping.id] === 2
                                          ? 'QUINZENAL'
                                          : newItemMult[mapping.id] === 1
                                          ? 'MENSAL'
                                          : 'SEMANAL')
                                      }
                                      onChange={(e) => {
                                        const val = e.target.value as 'DIARIO' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL';
                                        setNewItemRecurrenceType((prev) => ({ ...prev, [mapping.id]: val }));
                                        if (val === 'DIARIO') setNewItemMult((prev) => ({ ...prev, [mapping.id]: 30 }));
                                        if (val === 'SEMANAL') setNewItemMult((prev) => ({ ...prev, [mapping.id]: 5 }));
                                        if (val === 'QUINZENAL') setNewItemMult((prev) => ({ ...prev, [mapping.id]: 2 }));
                                        if (val === 'MENSAL') setNewItemMult((prev) => ({ ...prev, [mapping.id]: 1 }));
                                      }}
                                    >
                                      <option value="DIARIO">☀️ Diário</option>
                                      <option value="SEMANAL">🗓️ Semanal</option>
                                      <option value="QUINZENAL">🌓 Quinzenal</option>
                                      <option value="MENSAL">📅 Mensal</option>
                                    </select>

                                    {newItemRecurrenceType[mapping.id] === 'DIARIO' && (
                                      <span className="text-[11px] text-amber-300/90 font-mono py-0.5">
                                        ☀️ Todos os dias do mês
                                      </span>
                                    )}

                                    {(!newItemRecurrenceType[mapping.id] || newItemRecurrenceType[mapping.id] === 'SEMANAL') && (
                                      <select
                                        className="form-input form-input-sm text-xs py-1"
                                        value={newItemDayOfWeek[mapping.id] || 'SABADO'}
                                        onChange={(e) =>
                                          setNewItemDayOfWeek((prev) => ({
                                            ...prev,
                                            [mapping.id]: e.target.value as any,
                                          }))
                                        }
                                      >
                                        {WEEKDAY_OPTIONS.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                    )}

                                    {newItemRecurrenceType[mapping.id] === 'QUINZENAL' && (
                                      <select
                                        className="form-input form-input-sm text-xs py-1 font-mono"
                                        value={newItemDayOfFortnight[mapping.id] || 1}
                                        onChange={(e) =>
                                          setNewItemDayOfFortnight((prev) => ({
                                            ...prev,
                                            [mapping.id]: parseInt(e.target.value) || 1,
                                          }))
                                        }
                                      >
                                        {Array.from({ length: 15 }, (_, i) => i + 1).map((d) => (
                                          <option key={d} value={d}>
                                            Dia {d} (dias {d} e {d + 15})
                                          </option>
                                        ))}
                                      </select>
                                    )}

                                    {newItemRecurrenceType[mapping.id] === 'MENSAL' && (
                                      <select
                                        className="form-input form-input-sm text-xs py-1 font-mono"
                                        value={newItemDayOfMonth[mapping.id] || 10}
                                        onChange={(e) =>
                                          setNewItemDayOfMonth((prev) => ({
                                            ...prev,
                                            [mapping.id]: parseInt(e.target.value) || 1,
                                          }))
                                        }
                                      >
                                        {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                                          <option key={d} value={d}>
                                            Dia {d}
                                          </option>
                                        ))}
                                        <option value={31}>Dia 31 (Fim do Mês - ajuste auto 28-31)</option>
                                      </select>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <select
                                    className="form-input form-input-sm"
                                    value={
                                      newItemMult[mapping.id] !== undefined
                                        ? newItemMult[mapping.id]
                                        : newItemRecurrenceType[mapping.id] === 'DIARIO'
                                        ? 30
                                        : 5
                                    }
                                    onChange={(e) =>
                                      setNewItemMult((prev) => ({
                                        ...prev,
                                        [mapping.id]: parseInt(e.target.value) || 1,
                                      }))
                                    }
                                  >
                                    <option value={30}>30x (Diário Padrão - 30 dias)</option>
                                    <option value={31}>31x (Mês Longo - 31 dias)</option>
                                    <option value={22}>22x (Dias Úteis - 22 dias)</option>
                                    <option value={20}>20x (Dias Úteis - 20 dias)</option>
                                    <option value={5}>5x (Semanal Padrão - 5 sem)</option>
                                    <option value={4}>4x (Semanal - 4 sem)</option>
                                    <option value={2}>2x (Quinzenal)</option>
                                    <option value={1}>1x (Pontual / Mensal)</option>
                                  </select>
                                </td>
                                <td>
                                  <span className="text-xs text-muted font-mono">
                                    {(
                                      Math.round(
                                        (typeof newItemQty[mapping.id] === 'number'
                                          ? (newItemQty[mapping.id] as number)
                                          : parseFloat(String(newItemQty[mapping.id] || '1').replace(',', '.')) || 1) *
                                          (typeof newItemPrice[mapping.id] === 'number'
                                            ? (newItemPrice[mapping.id] as number)
                                            : parseFloat(String(newItemPrice[mapping.id] || '0').replace(',', '.')) || 0) *
                                          (newItemMult[mapping.id] !== undefined
                                            ? newItemMult[mapping.id]
                                            : 5) *
                                          1000
                                      ) / 1000
                                    ).toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 3,
                                    })}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    className="btn btn-primary btn-xs"
                                    title="Adicionar item ao mapeamento"
                                    onClick={() => {
                                      const desc = newItemDesc[mapping.id]?.trim();
                                      const rawQty = newItemQty[mapping.id];
                                      const qty =
                                        typeof rawQty === 'number'
                                          ? rawQty
                                          : parseFloat(String(rawQty || '1').replace(',', '.')) || 1;
                                      const rawPrc = newItemPrice[mapping.id];
                                      const prc =
                                        typeof rawPrc === 'number'
                                          ? rawPrc
                                          : parseFloat(String(rawPrc || '0').replace(',', '.')) || 0;
                                      const mult =
                                        newItemMult[mapping.id] !== undefined
                                          ? newItemMult[mapping.id]
                                          : 5;

                                      if (!desc) {
                                        alert('Informe a descrição do item.');
                                        return;
                                      }
                                      if (qty <= 0) {
                                        alert('Informe uma quantidade válida maior que zero.');
                                        return;
                                      }
                                      if (prc <= 0) {
                                        alert('Informe o preço unitário do item.');
                                        return;
                                      }

                                      const recType =
                                        newItemRecurrenceType[mapping.id] ||
                                        (mult >= 20
                                          ? 'DIARIO'
                                          : mult === 4 || mult === 5
                                          ? 'SEMANAL'
                                          : mult === 2
                                          ? 'QUINZENAL'
                                          : 'MENSAL');
                                      const dWeek = newItemDayOfWeek[mapping.id] || 'SABADO';
                                      const dFort = newItemDayOfFortnight[mapping.id] || 1;
                                      const dMonth = newItemDayOfMonth[mapping.id] || 10;

                                      addItemToMapping(selectedNature.id, mapping.id, {
                                        description: desc,
                                        quantity: Math.round(qty * 1000) / 1000,
                                        price: Math.round(prc * 1000) / 1000,
                                        unit: 'un',
                                        multiplierWeeks: mult,
                                        isFulfilled: false,
                                        recurrenceType: recType,
                                        dayOfWeek: recType === 'SEMANAL' ? dWeek : undefined,
                                        dayOfFortnight: recType === 'QUINZENAL' ? dFort : undefined,
                                        dayOfMonth: recType === 'MENSAL' ? dMonth : undefined,
                                      });

                                      // Limpar campos
                                      setNewItemDesc((prev) => ({ ...prev, [mapping.id]: '' }));
                                      setNewItemQty((prev) => ({ ...prev, [mapping.id]: 1 }));
                                      setNewItemPrice((prev) => ({ ...prev, [mapping.id]: 0 }));
                                    }}
                                  >
                                    <Plus size={14} />
                                    <span>Adicionar</span>
                                  </button>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="naturezas-empty-state glass-card p-6 text-center text-muted">
            <Layers size={48} className="mx-auto text-muted mb-2" />
            <p>Selecione ou crie uma natureza orçamentária para gerenciar seus tetos.</p>
            <button
              className="btn btn-primary btn-sm mt-3"
              onClick={handleOpenCreateNature}
            >
              <Plus size={16} />
              <span>Cadastrar Nova Natureza</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal de Nova ou Edição de Natureza */}
      <NatureModal
        isOpen={isNatureModalOpen}
        onClose={() => setIsNatureModalOpen(false)}
        natureToEdit={natureToEdit}
        onSuccess={(id) => {
          if (id) {
            setSelectedNatureId(id);
          }
        }}
      />

      {/* Modal de Criação ou Edição de Mapeamento de Gastos */}
      {selectedNature && (
        <MappingModal
          isOpen={isMappingModalOpen}
          onClose={() => setIsMappingModalOpen(false)}
          natureId={selectedNature.id}
          natureName={selectedNature.name}
          natureColor={selectedNature.color}
          mappingToEdit={mappingToEdit}
        />
      )}

      {/* Modal Interativo de Palavras-Chave para IA & Notas Fiscais */}
      {keywordModalData && (
        <Modal
          isOpen={!!keywordModalData}
          onClose={() => setKeywordModalData(null)}
          title={`Palavras-chave da IA — ${keywordModalData.item.description}`}
          subtitle="Ensinar a IA a reconhecer este item automaticamente em notas fiscais e fotos"
          maxWidth="560px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Box explicativo */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                fontSize: '12.5px',
                color: '#C7D2FE',
                lineHeight: '1.5',
              }}
            >
              <strong style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Sparkles size={14} className="text-indigo-400" />
                Como o Forseti IA usa as palavras-chave:
              </strong>
              Ao anexar fotos de cupons fiscais ou faturas, a IA lê o texto impresso (ex: <em>CAFE PILAO TRAD 500G</em>). Com as palavras-chave abaixo cadastradas, a IA reconhece o item imediatamente com 100% de assertividade!
            </div>

            {/* Input de Adição de Tags */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Adicionar palavra-chave ou termo de nota fiscal:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input form-input-sm"
                  style={{ flex: 1 }}
                  placeholder="Ex: pilao, cafe 500g, melitta (use vírgula para várias)..."
                  value={tagInputText}
                  onChange={(e) => setTagInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTagFromInput();
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                  onClick={handleAddTagFromInput}
                >
                  <Plus size={14} />
                  <span>Adicionar</span>
                </button>
              </div>
            </div>

            {/* Sugestões Inteligentes */}
            {suggestedKeywords.length > 0 && (
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                  Sugestões Rápidas:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {suggestedKeywords.map((sug, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px dashed rgba(99, 102, 241, 0.4)',
                        color: '#A5B4FC',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      onClick={() => handleAddSingleKeyword(sug)}
                      title="Clique para adicionar esta palavra-chave"
                    >
                      <Plus size={10} />
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Lista Atual de Palavras-Chave */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Palavras-chave Cadastradas ({currentModalItemKeywords.length})
                </span>
                {currentModalItemKeywords.length > 0 && (
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#F87171', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => {
                      if (window.confirm('Deseja limpar todas as palavras-chave deste item?')) {
                        updateItemKeywords([]);
                      }
                    }}
                  >
                    Limpar todas
                  </button>
                )}
              </div>

              {currentModalItemKeywords.length === 0 ? (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px dashed rgba(255, 255, 255, 0.08)',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  Nenhuma palavra-chave cadastrada ainda. Adicione termos acima para acelerar a IA!
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '180px', overflowY: 'auto', padding: '4px' }}>
                  {currentModalItemKeywords.map((kw, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        background: 'rgba(99, 102, 241, 0.18)',
                        border: '1px solid rgba(99, 102, 241, 0.35)',
                        color: '#C7D2FE',
                        fontSize: '12px',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>#{kw}</span>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#A5B4FC',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        className="hover:text-rose-400"
                        onClick={() => {
                          const next = currentModalItemKeywords.filter((_, i) => i !== idx);
                          updateItemKeywords(next);
                        }}
                        title={`Remover #${kw}`}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Rodapé com botão de fechar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setKeywordModalData(null)}
              >
                Concluir
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal para Mover Item entre Mapeamentos / Naturezas */}
      {moveItemModalData && (
        <Modal
          isOpen={!!moveItemModalData}
          onClose={() => setMoveItemModalData(null)}
          title={`Mover Item: "${moveItemModalData.item.description}"`}
          maxWidth="520px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Informações Atuais */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '12.5px',
                color: 'var(--text-secondary)',
                lineHeight: '1.6',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span className="badge badge-cyan font-semibold">Origem</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>
                  {natures.find((n) => n.id === moveItemModalData.sourceNatureId)?.name || 'Natureza Atual'}
                </span>
                <span>➔</span>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                  {natures
                    .find((n) => n.id === moveItemModalData.sourceNatureId)
                    ?.mappings.find((m) => m.id === moveItemModalData.sourceMappingId)?.name || 'Mapeamento Atual'}
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Item: <strong style={{ color: '#fff' }}>{moveItemModalData.item.description}</strong> • Valor:{' '}
                <strong style={{ color: '#67E8F9' }}>
                  {moveItemModalData.item.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </div>
            </div>

            {/* Selecionar Natureza de Destino */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Natureza de Destino:
              </label>
              <select
                className="form-input form-input-sm"
                style={{ width: '100%' }}
                value={moveItemModalData.targetNatureId}
                onChange={(e) => {
                  const newNatId = e.target.value;
                  const newNat = natures.find((n) => n.id === newNatId);
                  const firstMapId = newNat?.mappings[0]?.id || '';
                  setMoveItemModalData((prev) =>
                    prev
                      ? {
                          ...prev,
                          targetNatureId: newNatId,
                          targetMappingId: firstMapId,
                        }
                      : null
                  );
                }}
              >
                {natures.map((nat) => (
                  <option key={nat.id} value={nat.id}>
                    {nat.icon || '🏷️'} {nat.name} ({nat.mappings.length} {nat.mappings.length === 1 ? 'mapeamento' : 'mapeamentos'})
                  </option>
                ))}
              </select>
            </div>

            {/* Selecionar Mapeamento de Destino */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Mapeamento de Destino:
              </label>
              {(() => {
                const targetNat = natures.find((n) => n.id === moveItemModalData.targetNatureId);
                const availableMappings = targetNat?.mappings || [];

                if (availableMappings.length === 0) {
                  return (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#FCA5A5',
                        fontSize: '12px',
                      }}
                    >
                      ⚠️ A natureza selecionada ainda não possui nenhum mapeamento cadastrado. Crie um mapeamento nela primeiro.
                    </div>
                  );
                }

                return (
                  <select
                    className="form-input form-input-sm"
                    style={{ width: '100%' }}
                    value={moveItemModalData.targetMappingId}
                    onChange={(e) => {
                      const newMapId = e.target.value;
                      setMoveItemModalData((prev) => (prev ? { ...prev, targetMappingId: newMapId } : null));
                    }}
                  >
                    {availableMappings.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.icon || '📋'} {m.name} ({m.items.length} {m.items.length === 1 ? 'item' : 'itens'})
                      </option>
                    ))}
                  </select>
                );
              })()}
            </div>

            {/* Botões de Ação */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setMoveItemModalData(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                disabled={
                  !moveItemModalData.targetMappingId ||
                  (moveItemModalData.sourceNatureId === moveItemModalData.targetNatureId &&
                    moveItemModalData.sourceMappingId === moveItemModalData.targetMappingId)
                }
                onClick={() => {
                  const success = moveMappingItem(
                    moveItemModalData.sourceNatureId,
                    moveItemModalData.sourceMappingId,
                    moveItemModalData.targetNatureId,
                    moveItemModalData.targetMappingId,
                    moveItemModalData.item.id
                  );
                  if (success) {
                    setMoveItemModalData(null);
                  }
                }}
              >
                <ArrowRightLeft size={14} />
                <span>Confirmar e Mover Item</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* Modal de Palavras-Chave da IA */}
      {keywordsModalMapping && selectedNature && (
        <Modal
          isOpen={!!keywordsModalMapping}
          onClose={() => {
            setKeywordsModalMapping(null);
            setNewKeywordVal('');
          }}
          title={`Palavras-chave: ${keywordsModalMapping.name}`}
        >
          <div className="animate-fade-in" style={{ padding: '8px 0' }}>
            <p className="text-sm text-secondary mb-4">
              Adicione palavras-chave para ajudar a IA a associar automaticamente transações e faturas a este mapeamento.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                className="form-input flex-1"
                placeholder="Ex: carrefour, ifood, farmacia..."
                value={newKeywordVal}
                onChange={(e) => setNewKeywordVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!newKeywordVal.trim()) return;
                    const val = newKeywordVal.trim().toLowerCase();
                    const currentKws = keywordsModalMapping.keywords || [];
                    if (!currentKws.includes(val)) {
                      const kws = [...currentKws, val];
                      updateMapping(selectedNature.id, keywordsModalMapping.id, { keywords: kws });
                      setKeywordsModalMapping({ ...keywordsModalMapping, keywords: kws });
                    }
                    setNewKeywordVal('');
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                title="Adicionar Palavra-chave"
                onClick={() => {
                  if (!newKeywordVal.trim()) return;
                  const val = newKeywordVal.trim().toLowerCase();
                  const currentKws = keywordsModalMapping.keywords || [];
                  if (!currentKws.includes(val)) {
                    const kws = [...currentKws, val];
                    updateMapping(selectedNature.id, keywordsModalMapping.id, { keywords: kws });
                    setKeywordsModalMapping({ ...keywordsModalMapping, keywords: kws });
                  }
                  setNewKeywordVal('');
                }}
              >
                <Plus size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {keywordsModalMapping.keywords?.map((kw, idx) => (
                <span
                  key={idx}
                  className="badge badge-cyan"
                  style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '4px 8px', fontSize: '13px' }}
                >
                  #{kw}
                  <X
                    size={14}
                    className="cursor-pointer text-cyan hover:text-white"
                    onClick={() => {
                      const kws = keywordsModalMapping.keywords!.filter((_, i) => i !== idx);
                      updateMapping(selectedNature.id, keywordsModalMapping.id, { keywords: kws });
                      setKeywordsModalMapping({ ...keywordsModalMapping, keywords: kws });
                    }}
                  />
                </span>
              ))}
              {(!keywordsModalMapping.keywords || keywordsModalMapping.keywords.length === 0) && (
                <span className="text-muted text-sm italic">Nenhuma palavra-chave cadastrada.</span>
              )}
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setKeywordsModalMapping(null);
                  setNewKeywordVal('');
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};
