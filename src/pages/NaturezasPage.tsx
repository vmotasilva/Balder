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
} from 'lucide-react';
import { NatureModal } from '../components/NatureModal';
import { MappingModal } from '../components/MappingModal';

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
    toggleItemFulfilled,
    saveCeilingJustification,
    getNatureCeiling,
    getNatureSpent,
    getNatureMissingItems,
    addMovement,
    loadSuggestedMappingsForNature,
  } = useFinancial();

  // Selected Natureza
  const [selectedNatureId, setSelectedNatureId] = useState<string>(
    natures[0]?.id || 'nat_alimentacao'
  );
  const [justificationText, setJustificationText] = useState('');

  // Cards recolhíveis de diagnóstico inteligente (padrão: recolhidos)
  const [isDiagnosticExpanded, setIsDiagnosticExpanded] = useState(false);
  const [isOverCeilingExpanded, setIsOverCeilingExpanded] = useState(false);

  // Ao alternar entre naturezas, manter o diagnóstico recolhido como padrão
  useEffect(() => {
    setIsDiagnosticExpanded(false);
    setIsOverCeilingExpanded(false);
  }, [selectedNatureId]);

  // Inline Quick Add Items per Mapping
  const [newItemDesc, setNewItemDesc] = useState<Record<string, string>>({});
  const [newItemQty, setNewItemQty] = useState<Record<string, number>>({});
  const [newItemPrice, setNewItemPrice] = useState<Record<string, number>>({});
  const [newItemMult, setNewItemMult] = useState<Record<string, number>>({});

  // Inline Editing of existing items
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editQty, setEditQty] = useState<number | string>(1);
  const [editPrice, setEditPrice] = useState<number | string>(0);
  const [editMult, setEditMult] = useState(1);

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
  const [isMappingHelpOpen, setIsMappingHelpOpen] = useState(false);

  const handleOpenCreateMapping = () => {
    setMappingToEdit(null);
    setIsMappingModalOpen(true);
  };

  const handleOpenEditMapping = (mapping: FixedExpenseMapping) => {
    setMappingToEdit(mapping);
    setIsMappingModalOpen(true);
  };

  // Edição rápida do dia de vencimento de um mapeamento
  const [editingMappingDueDayId, setEditingMappingDueDayId] = useState<string | null>(null);
  const [editMappingDueDayVal, setEditMappingDueDayVal] = useState<number | ''>('');

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

  const startEditingItem = (item: {
    id: string;
    description: string;
    quantity: number;
    price: number;
    multiplierWeeks: number;
  }) => {
    setEditingItemId(item.id);
    setEditDesc(item.description);
    setEditQty(item.quantity);
    setEditPrice(item.price);
    setEditMult(item.multiplierWeeks || 1);
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

    updateMappingItem(selectedNature.id, mappingId, itemId, {
      description: editDesc.trim(),
      quantity: parsedQty > 0 ? Math.round(parsedQty * 1000) / 1000 : 0.001,
      price: Math.max(0, Math.round(parsedPrice * 1000) / 1000),
      multiplierWeeks: Math.max(1, editMult),
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

        {/* Seletor de Naturezas em Abas/Pills com Resumo de Teto */}
        <div className="naturezas-tabs-nav">
          {natures.map((nat) => {
            const ceil = getNatureCeiling(nat);
            const spent = getNatureSpent(nat);
            const isOver = ceil > 0 && spent > ceil;
            const isFar = ceil > 0 && spent < ceil * 0.75;
            const isSelected = selectedNature?.id === nat.id;

            return (
              <button
                key={nat.id}
                className={`natureza-tab-item ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedNatureId(nat.id)}
                style={{ borderLeftColor: nat.color }}
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
                              if (
                                confirm(
                                  `Deseja realmente excluir a natureza "${selectedNature.name}" e todos os seus mapeamentos?`
                                )
                              ) {
                                deleteNature(selectedNature.id);
                                const next = natures.find((n) => n.id !== selectedNature.id);
                                if (next) setSelectedNatureId(next.id);
                              }
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
                  </div>
                </div>
              </div>

              <div className="natureza-kpis-grid">
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

              {/* Barra de Progresso do Teto */}
              <div className="natureza-progress-container mt-4">
                <div className="natureza-progress-labels">
                  <span>Consumo do Teto Orçamentário</span>
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
              <div className="ceiling-alert-box alert-far-ceiling glass-card animate-fade-in mt-4">
                <div
                  className="ceiling-alert-header cursor-pointer select-none"
                  onClick={() => setIsDiagnosticExpanded(!isDiagnosticExpanded)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Info size={22} className="text-cyan flex-shrink-0" />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 className="text-cyan" style={{ margin: 0 }}>
                          Diagnóstico Orçamentário: Por que o Teto está distante?
                        </h4>
                        <span className="badge badge-cyan text-xs">
                          {missingItems.length} {missingItems.length === 1 ? 'item pendente' : 'itens pendentes'}
                        </span>
                      </div>
                      {!isDiagnosticExpanded && (
                        <p className="text-xs text-muted" style={{ margin: '3px 0 0' }}>
                          Falta realizar{' '}
                          <strong className="text-cyan">
                            {(natureCeiling - natureSpent).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 3,
                            })}
                          </strong>{' '}
                          em compras planejadas. Clique para expandir detalhes e itens faltantes.
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-cyan"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDiagnosticExpanded(!isDiagnosticExpanded);
                    }}
                  >
                    <span>{isDiagnosticExpanded ? 'Recolher' : 'Expandir'}</span>
                    {isDiagnosticExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {isDiagnosticExpanded && (
                  <div className="animate-fade-in mt-3" style={{ borderTop: '1px solid rgba(56, 189, 248, 0.15)', paddingTop: '12px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '12px' }}>
                      Você realizou{' '}
                      <strong>
                        {natureSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>{' '}
                      de um teto estipulado de{' '}
                      <strong>
                        {natureCeiling.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>{' '}
                      (restando{' '}
                      <strong className="text-cyan">
                        {(natureCeiling - natureSpent).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 3,
                        })}
                      </strong>
                      ). O BALDER identificou os seguintes{' '}
                      <strong>itens do mapeamento que ainda estão em falta / pendentes de compra</strong> no mês:
                    </p>

                    {missingItems.length > 0 ? (
                      <div className="missing-items-table-box mt-3">
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
                )}
              </div>
            )}

            {/* SEÇÃO DE MAPEAMENTOS DE GASTOS FIXOS */}
            <div className="natureza-mappings-section mt-4">
              <div className="mappings-section-header">
                <div>
                  <h4>Mapeamentos de Gastos Fixos ({selectedNature.mappings.length})</h4>
                  <p className="subtab-desc">
                    Ajuste os itens, quantidades e valores abaixo para redefinir e compor com precisão o teto orçamentário.
                  </p>
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
                  {selectedNature.mappings.map((mapping) => {
                    const mappingTotal = (mapping.items || []).reduce(
                      (acc, it) => acc + it.totalValue,
                      0
                    );

                    return (
                      <div key={mapping.id} className="mapping-card glass-card mt-4">
                        <div className="mapping-card-header">
                          <div className="mapping-header-info" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            {/* Emoji Próprio do Mapeamento */}
                            <div
                              className="mapping-icon-badge"
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '10px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.4rem',
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

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <h5 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{mapping.name}</h5>
                              <span className="badge badge-cyan">
                                Subtotal:{' '}
                                {mappingTotal.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 3,
                                })}
                              </span>
                              <span className="badge badge-emerald">
                                {mapping.items.length}{' '}
                                {mapping.items.length === 1 ? 'item' : 'itens'}
                              </span>

                            {/* Badge & Configuração de Vencimento Fixo no Mês */}
                            {editingMappingDueDayId === mapping.id ? (
                              <div className="flex items-center gap-1 bg-[rgba(15,23,42,0.8)] p-1 rounded border border-[var(--border-default)]">
                                <Calendar size={13} className="text-amber-400 ml-1" />
                                <span className="text-xs text-muted">Dia:</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="31"
                                  className="form-input form-input-sm text-center"
                                  style={{ width: '48px', padding: '2px 4px', height: '24px' }}
                                  value={editMappingDueDayVal}
                                  placeholder="Ex: 10"
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setEditMappingDueDayVal(isNaN(val) ? '' : Math.min(31, Math.max(1, val)));
                                  }}
                                  autoFocus
                                />
                                <button
                                  className="btn btn-primary btn-xs"
                                  style={{ padding: '2px 6px', height: '24px' }}
                                  title="Salvar dia de vencimento"
                                  onClick={() => {
                                    updateMapping(selectedNature.id, mapping.id, {
                                      dayOfMonth: editMappingDueDayVal !== '' ? Number(editMappingDueDayVal) : undefined,
                                    });
                                    setEditingMappingDueDayId(null);
                                  }}
                                >
                                  <Save size={12} />
                                </button>
                                <button
                                  className="btn btn-ghost btn-xs text-muted"
                                  style={{ padding: '2px 4px', height: '24px' }}
                                  title="Cancelar"
                                  onClick={() => setEditingMappingDueDayId(null)}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className={`badge ${mapping.dayOfMonth ? 'badge-amber' : 'badge-outline text-muted'} cursor-pointer hover:border-amber-400`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: mapping.dayOfMonth ? undefined : 'rgba(255,255,255,0.03)' }}
                                title="Clique para alterar a previsão fixa de vencimento"
                                onClick={() => {
                                  setEditingMappingDueDayId(mapping.id);
                                  setEditMappingDueDayVal(mapping.dayOfMonth || '');
                                }}
                              >
                                <Calendar size={12} />
                                <span>{mapping.dayOfMonth ? `Vence Dia ${mapping.dayOfMonth}` : '+ Definir Vencimento'}</span>
                                <Edit2 size={10} style={{ opacity: 0.6 }} />
                              </button>
                            )}
                          </div>
                          </div>
                          <div className="mapping-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-xs text-cyan"
                              title="Editar Nome, Emoji e Vencimento deste Mapeamento"
                              onClick={() => handleOpenEditMapping(mapping)}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Edit2 size={12} />
                              <span>Editar Mapeamento</span>
                            </button>

                            <button
                              className="btn btn-ghost btn-xs text-rose"
                              title="Excluir Mapeamento"
                              onClick={() => {
                                if (confirm(`Deseja remover o mapeamento "${mapping.name}"?`)) {
                                  deleteMapping(selectedNature.id, mapping.id);
                                }
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Trash2 size={13} />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </div>

                        {/* TABELA DE ITENS DO MAPEAMENTO COM EDIÇÃO INLINE */}
                        <div className="mapping-items-table-wrapper mt-3">
                          <table className="natureza-items-table">
                            <thead>
                              <tr>
                                <th style={{ width: '28%' }}>Descrição / Item</th>
                                <th style={{ width: '12%' }}>Quantidade</th>
                                <th style={{ width: '15%' }}>Preço Unitário</th>
                                <th style={{ width: '18%' }}>Multiplicador (Semanas)</th>
                                <th style={{ width: '15%' }}>Valor Total (Teto)</th>
                                <th style={{ width: '12%' }}>Ações</th>
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
                                        <input
                                          type="text"
                                          className="form-input form-input-sm"
                                          value={editDesc}
                                          onChange={(e) => setEditDesc(e.target.value)}
                                          autoFocus
                                        />
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
                                        <select
                                          className="form-input form-input-sm"
                                          value={editMult}
                                          onChange={(e) => setEditMult(parseInt(e.target.value) || 1)}
                                        >
                                          <option value={1}>1x (Pontual / Mensal)</option>
                                          <option value={2}>2x (Quinzenal)</option>
                                          <option value={4}>4x (Semanal - 4 sem)</option>
                                          <option value={5}>5x (Semanal longo - 5 sem)</option>
                                        </select>
                                      </td>
                                      <td>
                                        <strong className="text-emerald-500 font-bold">
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
                                      <div className="item-desc-cell">
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
                                              : 'font-semibold'
                                          }
                                        >
                                          {item.description}
                                        </span>
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
                                      <span className="badge badge-cyan">
                                        {item.multiplierWeeks}x{' '}
                                        {item.multiplierWeeks === 1
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
                                          className="btn btn-ghost btn-xs text-cyan"
                                          title="Ajustar item / teto"
                                          onClick={() => startEditingItem(item)}
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                        <button
                                          className="btn btn-ghost btn-xs text-rose"
                                          title="Excluir item"
                                          onClick={() =>
                                            deleteMappingItem(
                                              selectedNature.id,
                                              mapping.id,
                                              item.id
                                            )
                                          }
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
                                  <select
                                    className="form-input form-input-sm"
                                    value={
                                      newItemMult[mapping.id] !== undefined
                                        ? newItemMult[mapping.id]
                                        : 4
                                    }
                                    onChange={(e) =>
                                      setNewItemMult((prev) => ({
                                        ...prev,
                                        [mapping.id]: parseInt(e.target.value) || 1,
                                      }))
                                    }
                                  >
                                    <option value={1}>1x (Pontual / Mensal)</option>
                                    <option value={2}>2x (Quinzenal)</option>
                                    <option value={4}>4x (Semanal - 4 sem)</option>
                                    <option value={5}>5x (Semanal longo - 5 sem)</option>
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
                                            : 4) *
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
                                          : 4;

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

                                      addItemToMapping(selectedNature.id, mapping.id, {
                                        description: desc,
                                        quantity: Math.round(qty * 1000) / 1000,
                                        price: Math.round(prc * 1000) / 1000,
                                        unit: 'un',
                                        multiplierWeeks: mult,
                                        isFulfilled: false,
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
    </div>
  );
};
