import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  Zap,
  Building2,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Trash2,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';
import type { Movement, MovementStatus, InvoiceNatureItemBreakdown } from '../types';

interface MovementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: Movement | null;
  onOpenPrepaymentSimulator?: (groupId?: string, movementId?: string) => void;
}

interface ModalBreakdownRow {
  id: string;
  natureId: string;       // id da natureza ou 'OUTROS'
  natureName: string;     // Nome da natureza ou 'Outros'
  mappingId?: string;     // id do mapeamento
  mappingItemId?: string; // id do item
  description: string;    // Descrição do gasto
  amountInput: string;    // R$
}

const parseBRL = (val: string): number => {
  if (!val) return 0;
  const clean = val.replace(/[R$\s]/g, '').trim();
  if (!clean) return 0;
  if (clean.includes('.') && clean.includes(',')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.')) || 0;
  }
  if ((clean.match(/\./g) || []).length > 1) {
    return parseFloat(clean.replace(/\./g, '')) || 0;
  }
  return parseFloat(clean) || 0;
};

export const MovementDetailModal: React.FC<MovementDetailModalProps> = ({
  isOpen,
  onClose,
  movement,
  onOpenPrepaymentSimulator,
}) => {
  const {
    updateMovement,
    deleteMovement,
    accounts,
    cards,
    banks,
    natures,
    markMappingItemsFulfilled,
  } = useFinancial();

  // Estados locais do formulário
  const [title, setTitle] = useState('');
  const [nominalAmount, setNominalAmount] = useState<number>(0);
  const [actualAmountInput, setActualAmountInput] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [bank, setBank] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<MovementStatus>('PREVISTA');
  const [notes, setNotes] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Estados específicos para EMPRESTIMO
  const [loanPayMode, setLoanPayMode] = useState<'REGULAR' | 'DESCONTO' | 'AJUSTE'>('REGULAR');
  const [discountAmountInput, setDiscountAmountInput] = useState('');

  // Estados específicos para RECEBER (Salário / Holerite)
  const [isSalaryDetailMode, setIsSalaryDetailMode] = useState(false);
  const [salaryGrossInput, setSalaryGrossInput] = useState('');
  const [salaryDiscountsInput, setSalaryDiscountsInput] = useState('');
  const [salaryAdditionsInput, setSalaryAdditionsInput] = useState('');

  // Estados específicos para PAGAR (Vinculação com Naturezas)
  const [selectedNatureId, setSelectedNatureId] = useState('');
  const [selectedMappingItemId, setSelectedMappingItemId] = useState('');

  // Estados específicos para CARTAO (Detalhamento de Itens por Natureza)
  const [breakdownRows, setBreakdownRows] = useState<ModalBreakdownRow[]>([]);

  // Inicializa o modal quando o movement mudar
  useEffect(() => {
    if (!movement) return;

    setTitle(movement.title || '');
    const original = movement.originalAmount ?? movement.amount;
    setNominalAmount(original);
    
    // Valor real atual
    const currentActual = movement.actualAmount ?? movement.amount;
    setActualAmountInput(String(currentActual));

    setDueDate(movement.dueDate || new Date().toISOString().split('T')[0]);
    setPaymentDate(movement.paymentDate || movement.dueDate || new Date().toISOString().split('T')[0]);
    setBank(movement.bank || 'Nubank');
    setCategory(movement.category || 'Outros');
    setStatus(movement.status || 'PREVISTA');
    setNotes(movement.notes || '');
    setAdjustmentReason(movement.adjustmentReason || '');

    // Defaults por tipo
    if (movement.type === 'EMPRESTIMO') {
      if (movement.actualAmount && movement.actualAmount < original) {
        setLoanPayMode('DESCONTO');
        setDiscountAmountInput(String(Math.round((original - movement.actualAmount) * 100) / 100));
      } else if (movement.actualAmount && movement.actualAmount > original) {
        setLoanPayMode('AJUSTE');
      } else {
        setLoanPayMode('REGULAR');
        setDiscountAmountInput('');
      }
    }

    const isSalaryCat = movement.category.toLowerCase().includes('salár') || movement.title.toLowerCase().includes('salár');
    setIsSalaryDetailMode(isSalaryCat);
    if (isSalaryCat) {
      setSalaryGrossInput(String(currentActual));
      setSalaryDiscountsInput('0');
      setSalaryAdditionsInput('0');
    }

    setSelectedNatureId(movement.natureId || '');
    setSelectedMappingItemId(movement.mappingItemId || '');

    // Inicializa o detalhamento de fatura se for cartão
    if (movement.type === 'CARTAO') {
      if (movement.invoiceBreakdown && movement.invoiceBreakdown.length > 0) {
        setBreakdownRows(
          movement.invoiceBreakdown.map((item) => ({
            id: item.id,
            natureId: item.natureId || (item.natureName === 'Outros' ? 'OUTROS' : ''),
            natureName: item.natureName,
            mappingId: item.mappingId,
            mappingItemId: item.mappingItemId,
            description: item.description,
            amountInput: String(item.amount),
          }))
        );
      } else {
        setBreakdownRows([]);
      }
    }
  }, [movement]);

  // Lista consolidada de opções de bancos
  const bankOptions = useMemo(() => {
    const list: string[] = [];
    accounts.forEach((a) => {
      if (a.name && !list.includes(a.name)) list.push(a.name);
      if (a.bankName && !list.includes(a.bankName)) list.push(a.bankName);
    });
    cards.forEach((c) => {
      if (c.bank && !list.includes(c.bank)) list.push(c.bank);
    });
    banks.forEach((b) => {
      if (b.name && !list.includes(b.name)) list.push(b.name);
    });
    ['Nubank', 'Inter', 'Caixa', 'XP', 'Itaú', 'Bradesco', 'Santander', 'BB'].forEach((def) => {
      if (!list.includes(def)) list.push(def);
    });
    return list;
  }, [accounts, cards, banks]);

  // Cálculo da variação do valor real vs nominal
  const actualAmountNum = parseBRL(actualAmountInput);
  const diffAmount = Math.round((actualAmountNum - nominalAmount) * 100) / 100;
  const diffPercent = nominalAmount > 0 ? Math.round((diffAmount / nominalAmount) * 1000) / 10 : 0;

  // Cálculos de Detalhamento da Fatura de Cartão
  const totalAllocatedInNatures = useMemo(() => {
    return breakdownRows
      .filter((r) => r.natureId && r.natureId !== 'OUTROS')
      .reduce((sum, r) => sum + parseBRL(r.amountInput), 0);
  }, [breakdownRows]);

  const totalAllocatedInOutros = useMemo(() => {
    return breakdownRows
      .filter((r) => r.natureId === 'OUTROS')
      .reduce((sum, r) => sum + parseBRL(r.amountInput), 0);
  }, [breakdownRows]);

  const totalAllocated = totalAllocatedInNatures + totalAllocatedInOutros;
  const unanalyzedAmount = Math.max(0, Math.round((actualAmountNum - totalAllocated) * 100) / 100);
  const isOverAllocated = totalAllocated > actualAmountNum;

  // Helper para itens de mapeamento de uma natureza
  const getMappingItemsForNature = (natId: string) => {
    const nat = natures.find((n) => n.id === natId);
    if (!nat) return [];
    const list: Array<{
      id: string;
      mappingId: string;
      mappingName: string;
      description: string;
      totalValue: number;
    }> = [];

    (nat.mappings || []).forEach((m) => {
      (m.items || []).forEach((it) => {
        list.push({
          id: it.id,
          mappingId: m.id,
          mappingName: m.name,
          description: it.description,
          totalValue: it.totalValue,
        });
      });
    });
    return list;
  };

  // Manipuladores do detalhamento de fatura
  const handleAddBreakdownRow = () => {
    setBreakdownRows((prev) => [
      ...prev,
      {
        id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        natureId: '',
        natureName: '',
        description: '',
        amountInput: '',
      },
    ]);
  };

  const handleRemoveBreakdownRow = (rowId: string) => {
    setBreakdownRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleBreakdownNatureChange = (rowId: string, natureId: string) => {
    const selectedNat = natures.find((n) => n.id === natureId);
    const natureName = natureId === 'OUTROS' ? 'Outros' : selectedNat?.name || '';

    setBreakdownRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          natureId,
          natureName,
          mappingId: undefined,
          mappingItemId: undefined,
          description: r.description || (natureId === 'OUTROS' ? 'Gastos diversos' : `${selectedNat?.name || ''}`),
        };
      })
    );
  };

  const handleBreakdownMappingItemChange = (rowId: string, combinedVal: string) => {
    setBreakdownRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        if (!combinedVal) return { ...r, mappingId: undefined, mappingItemId: undefined };

        const [mappingId, mappingItemId] = combinedVal.split(':::');
        const nat = natures.find((n) => n.id === r.natureId);
        const map = nat?.mappings.find((m) => m.id === mappingId);
        const item = map?.items.find((it) => it.id === mappingItemId);

        return {
          ...r,
          mappingId,
          mappingItemId,
          description: r.description || item?.description || '',
          amountInput: r.amountInput || (item?.totalValue ? String(item.totalValue) : ''),
        };
      })
    );
  };

  const handleBreakdownDescriptionChange = (rowId: string, description: string) => {
    setBreakdownRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, description } : r)));
  };

  const handleBreakdownAmountChange = (rowId: string, amountInput: string) => {
    setBreakdownRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, amountInput } : r)));
  };

  const handleAllocateRestToOutros = () => {
    if (unanalyzedAmount <= 0) return;
    setBreakdownRows((prev) => [
      ...prev,
      {
        id: `row_outros_${Date.now()}`,
        natureId: 'OUTROS',
        natureName: 'Outros',
        description: 'Gastos diversos sem natureza específica',
        amountInput: String(unanalyzedAmount),
      },
    ]);
  };

  if (!isOpen || !movement) return null;

  // Manipuladores de modos específicos
  const handleLoanModeChange = (mode: 'REGULAR' | 'DESCONTO' | 'AJUSTE') => {
    setLoanPayMode(mode);
    if (mode === 'REGULAR') {
      setActualAmountInput(String(nominalAmount));
      setDiscountAmountInput('');
      setAdjustmentReason('Pagamento regular da parcela no valor contratual');
    } else if (mode === 'DESCONTO') {
      const discount = parseBRL(discountAmountInput) || 50;
      const discounted = Math.max(0, nominalAmount - discount);
      setActualAmountInput(String(discounted));
      setAdjustmentReason('Antecipação com desconto a valor presente (BACEN nº 3.516)');
    } else {
      setAdjustmentReason('Ajuste com encargos / juros de mora ou amortização extraordinária');
    }
  };

  const handleDiscountInputChange = (val: string) => {
    setDiscountAmountInput(val);
    const disc = parseBRL(val);
    const newActual = Math.max(0, nominalAmount - disc);
    setActualAmountInput(String(newActual));
  };

  const handleApplySalaryCalculation = () => {
    const gross = parseBRL(salaryGrossInput);
    const discounts = parseBRL(salaryDiscountsInput);
    const additions = parseBRL(salaryAdditionsInput);
    const net = Math.round((gross - discounts + additions) * 100) / 100;
    setActualAmountInput(String(net));
    setAdjustmentReason(`Holerite apurado: Bruto (${gross.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) - Descontos (${discounts.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) + Acréscimos (${additions.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`);
  };

  const handleSave = (finalStatus?: MovementStatus) => {
    const updatedStatus = finalStatus || status;
    const finalAmount = actualAmountNum > 0 ? actualAmountNum : nominalAmount;

    // 1. Processamento específico de fatura de cartão
    let finalBreakdown: InvoiceNatureItemBreakdown[] | undefined = undefined;
    let finalUnanalyzed: number | undefined = undefined;
    let finalCategory = category;

    if (movement.type === 'CARTAO' && breakdownRows.length > 0) {
      finalBreakdown = breakdownRows
        .filter((r) => parseBRL(r.amountInput) > 0)
        .map((r) => ({
          id: r.id,
          natureId: r.natureId === 'OUTROS' ? undefined : r.natureId,
          natureName: r.natureName || (r.natureId === 'OUTROS' ? 'Outros' : 'Não Analisada'),
          mappingId: r.mappingId,
          mappingItemId: r.mappingItemId,
          description: r.description || r.natureName || 'Item da Fatura',
          amount: parseBRL(r.amountInput),
          isAnalyzed: !!r.natureId,
        }));

      const allocatedTotal = finalBreakdown.reduce((sum, it) => sum + it.amount, 0);
      finalUnanalyzed = Math.max(0, Math.round((finalAmount - allocatedTotal) * 100) / 100);

      // Se todas as despesas foram analisadas e não sobrou saldo pendente, atualiza a categoria
      if (finalUnanalyzed === 0 && finalCategory === 'Não Analisada') {
        finalCategory = 'Fatura Conciliada';
      }

      // Cumprir itens de mapeamento vinculados no detalhamento
      const itemsToFulfill = finalBreakdown
        .filter((it) => it.natureId && it.mappingId && it.mappingItemId)
        .map((it) => ({
          natureId: it.natureId!,
          mappingId: it.mappingId!,
          itemId: it.mappingItemId!,
          realizedValue: it.amount,
        }));

      if (itemsToFulfill.length > 0) {
        markMappingItemsFulfilled(itemsToFulfill);
      }
    }

    // 2. Atualizar movimentação no Balder
    updateMovement(movement.id, {
      title: title.trim() || movement.title,
      amount: finalAmount,
      actualAmount: finalAmount,
      originalAmount: nominalAmount,
      dueDate,
      paymentDate: updatedStatus === 'REALIZADA' ? paymentDate : undefined,
      bank,
      category: finalCategory,
      status: updatedStatus,
      notes: notes.trim() || undefined,
      adjustmentReason: adjustmentReason.trim() || undefined,
      natureId: selectedNatureId || undefined,
      mappingItemId: selectedMappingItemId || undefined,
      invoiceBreakdown: finalBreakdown,
      unanalyzedAmount: finalUnanalyzed,
    });

    // 3. Se for PAGAR e tiver item de mapeamento selecionado, marca como cumprido
    if (movement.type === 'PAGAR' && selectedNatureId && selectedMappingItemId && updatedStatus === 'REALIZADA') {
      const nat = natures.find((n) => n.id === selectedNatureId);
      const targetMapping = nat?.mappings.find((m) => (m.items || []).some((it) => it.id === selectedMappingItemId));
      if (targetMapping) {
        markMappingItemsFulfilled([
          {
            natureId: selectedNatureId,
            mappingId: targetMapping.id,
            itemId: selectedMappingItemId,
            realizedValue: finalAmount,
          },
        ]);
      }
    }

    onClose();
  };

  const handleDelete = () => {
    if (confirm(`Deseja realmente excluir a movimentação "${movement.title}"?`)) {
      deleteMovement(movement.id);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        movement.type === 'EMPRESTIMO'
          ? '🏛️ Detalhes & Quitação de Parcela de Empréstimo'
          : movement.type === 'CARTAO'
          ? '💳 Detalhes & Conciliação de Fatura de Cartão'
          : movement.type === 'RECEBER'
          ? '💰 Detalhes & Apuração de Recebimento'
          : '🧾 Detalhes & Liquidação de Despesa'
      }
      subtitle="Ajuste o valor para a realidade que foi efetivamente aplicada e confirme a conciliação financeira."
      maxWidth={movement.type === 'CARTAO' ? '740px' : '680px'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* ========================================================================= */}
        {/* CABEÇALHO CONTEXTUAL DA TRANSAÇÃO                                         */}
        {/* ========================================================================= */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            background:
              movement.type === 'EMPRESTIMO'
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)'
                : movement.type === 'CARTAO'
                ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)'
                : movement.type === 'RECEBER'
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border:
              movement.type === 'EMPRESTIMO'
                ? '1px solid rgba(245, 158, 11, 0.35)'
                : movement.type === 'CARTAO'
                ? '1px solid rgba(168, 85, 247, 0.35)'
                : movement.type === 'RECEBER'
                ? '1px solid rgba(16, 185, 129, 0.35)'
                : '1px solid rgba(239, 68, 68, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background:
                  movement.type === 'EMPRESTIMO'
                    ? 'rgba(245, 158, 11, 0.2)'
                    : movement.type === 'CARTAO'
                    ? 'rgba(168, 85, 247, 0.2)'
                    : movement.type === 'RECEBER'
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(239, 68, 68, 0.2)',
                color:
                  movement.type === 'EMPRESTIMO'
                    ? '#fbbf24'
                    : movement.type === 'CARTAO'
                    ? '#c084fc'
                    : movement.type === 'RECEBER'
                    ? '#34d399'
                    : '#f87171',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {movement.type === 'EMPRESTIMO' && <Building2 size={22} />}
              {movement.type === 'CARTAO' && <CreditCard size={22} />}
              {movement.type === 'RECEBER' && <TrendingUp size={22} />}
              {movement.type === 'PAGAR' && <TrendingDown size={22} />}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                <span
                  className={`type-badge type-${movement.type.toLowerCase()}`}
                  style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                >
                  {movement.type}
                </span>

                {movement.installmentNumber && movement.installmentsTotal && (
                  <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
                    Parcela {movement.installmentNumber}/{movement.installmentsTotal}
                  </span>
                )}

                <span
                  className={`badge ${status === 'REALIZADA' ? 'badge-emerald' : 'badge-slate'}`}
                  style={{ fontSize: '0.7rem' }}
                >
                  {status === 'REALIZADA' ? '✓ REALIZADA / QUITADA' : '⏳ PREVISTA NO FLUXO'}
                </span>
              </div>

              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="form-input"
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  padding: '2px 6px',
                  background: 'transparent',
                  borderColor: 'transparent',
                  color: '#fff',
                  borderBottom: '1px dashed rgba(255, 255, 255, 0.25)',
                }}
                title="Clique para editar o título da transação"
              />
            </div>
          </div>

          {/* Destaque do Valor Nominal Original */}
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
              Valor Nominal Previsto
            </span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              {nominalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </strong>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TRATATIVAS ESPECÍFICAS DE ACORDO COM O TIPO DE TRANSAÇÃO                  */}
        {/* ========================================================================= */}

        {/* ------------------------------------------------------------------------- */}
        {/* 1. EMPRESTIMO: Pagamento Normal, Antecipação c/ Desconto ou Ajuste       */}
        {/* ------------------------------------------------------------------------- */}
        {movement.type === 'EMPRESTIMO' && (
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={14} /> Tratativa de Quitação do Empréstimo / Financiamento
            </span>

            {/* Modos de Quitação */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px' }}>
              <button
                type="button"
                className={`pill-btn ${loanPayMode === 'REGULAR' ? 'active' : ''}`}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '2px',
                  background: loanPayMode === 'REGULAR' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: loanPayMode === 'REGULAR' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                }}
                onClick={() => handleLoanModeChange('REGULAR')}
              >
                <strong style={{ color: '#fbbf24' }}>1. Parcela Integral</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Valor contratual ({nominalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                </span>
              </button>

              <button
                type="button"
                className={`pill-btn ${loanPayMode === 'DESCONTO' ? 'active' : ''}`}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '2px',
                  background: loanPayMode === 'DESCONTO' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: loanPayMode === 'DESCONTO' ? 'rgba(6, 182, 212, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                }}
                onClick={() => handleLoanModeChange('DESCONTO')}
              >
                <strong style={{ color: 'var(--accent-cyan)' }}>2. Antecipação c/ Desconto</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Deságio BACEN nº 3.516
                </span>
              </button>

              <button
                type="button"
                className={`pill-btn ${loanPayMode === 'AJUSTE' ? 'active' : ''}`}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '2px',
                  background: loanPayMode === 'AJUSTE' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: loanPayMode === 'AJUSTE' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                }}
                onClick={() => handleLoanModeChange('AJUSTE')}
              >
                <strong style={{ color: 'var(--accent-rose)' }}>3. Encargos / Extra</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Atraso ou amortização avulsa
                </span>
              </button>
            </div>

            {/* Painel do Desconto por Antecipação */}
            {loanPayMode === 'DESCONTO' && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(6, 182, 212, 0.08)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                    Economia Obtida / Desconto Concedido:
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>R$</span>
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: '110px', fontSize: '0.8rem', padding: '3px 8px' }}
                      placeholder="0,00"
                      value={discountAmountInput}
                      onChange={(e) => handleDiscountInputChange(e.target.value)}
                    />
                  </div>
                </div>

                {onOpenPrepaymentSimulator && (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs text-cyan"
                    style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => {
                      onClose();
                      onOpenPrepaymentSimulator(movement.installmentGroupId, movement.id);
                    }}
                  >
                    <Zap size={12} />
                    <span>Calcular Desconto Preciso no Simulador</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* 2. CARTAO: Detalhamento Completo por Natureza e Itens                    */}
        {/* ------------------------------------------------------------------------- */}
        {movement.type === 'CARTAO' && (
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CreditCard size={15} /> Detalhamento da Fatura & Composição por Natureza
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Vencimento da fatura no mês seguinte
              </span>
            </div>

            {/* Barra de Progresso e Alocação dos Gastos */}
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Total da Fatura: <strong style={{ color: '#fff' }}>{actualAmountNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--accent-cyan)' }}>
                    Naturezas: {totalAllocatedInNatures.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span style={{ color: '#c084fc' }}>
                    Outros: {totalAllocatedInOutros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span style={{ color: unanalyzedAmount > 0 ? '#fbbf24' : '#34d399', fontWeight: 700 }}>
                    {unanalyzedAmount > 0 ? `Não Analisada: ${unanalyzedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : '✓ 100% Analisada'}
                  </span>
                </div>
              </div>

              {/* Barra de Progresso Visual */}
              <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.1)', display: 'flex', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${actualAmountNum > 0 ? Math.min(100, (totalAllocatedInNatures / actualAmountNum) * 100) : 0}%`,
                    background: 'var(--accent-cyan)',
                    transition: 'width 0.2s',
                  }}
                  title="Alocado em Naturezas Fixas"
                />
                <div
                  style={{
                    width: `${actualAmountNum > 0 ? Math.min(100, (totalAllocatedInOutros / actualAmountNum) * 100) : 0}%`,
                    background: '#c084fc',
                    transition: 'width 0.2s',
                  }}
                  title="Alocado em Outros"
                />
                <div
                  style={{
                    width: `${actualAmountNum > 0 ? Math.min(100, (unanalyzedAmount / actualAmountNum) * 100) : 0}%`,
                    background: '#f59e0b',
                    transition: 'width 0.2s',
                  }}
                  title="Não Analisada (Pendente)"
                />
              </div>

              {isOverAllocated && (
                <span style={{ fontSize: '0.7rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={12} /> A soma dos itens detalhados ultrapassa o valor total da fatura.
                </span>
              )}
            </div>

            {/* Lista de Linhas Detalhadas da Fatura */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '2px' }}>
              {breakdownRows.length === 0 ? (
                <div
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px dashed rgba(255, 255, 255, 0.15)',
                    textAlign: 'center',
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Nenhum item destrinchado nesta fatura. Adicione itens abaixo para correlacionar seus gastos com as Naturezas.
                </div>
              ) : (
                breakdownRows.map((row) => {
                  const availableMappingItems = row.natureId && row.natureId !== 'OUTROS' ? getMappingItemsForNature(row.natureId) : [];
                  const combinedMappingValue = row.mappingId && row.mappingItemId ? `${row.mappingId}:::${row.mappingItemId}` : '';

                  return (
                    <div
                      key={row.id}
                      style={{
                        padding: '0.5rem 0.65rem',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Natureza */}
                      <select
                        className="form-input"
                        style={{ width: '150px', fontSize: '0.74rem', padding: '3px 6px' }}
                        value={row.natureId}
                        onChange={(e) => handleBreakdownNatureChange(row.id, e.target.value)}
                      >
                        <option value="">Selecione Natureza...</option>
                        {natures.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.icon || '🏷️'} {n.name}
                          </option>
                        ))}
                        <option value="OUTROS">📦 Outros (Sem Natureza)</option>
                      </select>

                      {/* Item de Mapeamento (se natureza selecionada) */}
                      {availableMappingItems.length > 0 && (
                        <select
                          className="form-input"
                          style={{ width: '140px', fontSize: '0.74rem', padding: '3px 6px' }}
                          value={combinedMappingValue}
                          onChange={(e) => handleBreakdownMappingItemChange(row.id, e.target.value)}
                        >
                          <option value="">Item do Teto...</option>
                          {availableMappingItems.map((it) => (
                            <option key={it.id} value={`${it.mappingId}:::${it.id}`}>
                              {it.description} ({it.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Descrição */}
                      <input
                        type="text"
                        placeholder="Descrição do gasto (ex: Compras de Mercado)"
                        className="form-input"
                        style={{ flex: 1, minWidth: '130px', fontSize: '0.74rem', padding: '3px 8px' }}
                        value={row.description}
                        onChange={(e) => handleBreakdownDescriptionChange(row.id, e.target.value)}
                      />

                      {/* Valor */}
                      <div style={{ position: 'relative', width: '105px' }}>
                        <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>
                          R$
                        </span>
                        <input
                          type="text"
                          placeholder="0,00"
                          className="form-input"
                          style={{ width: '100%', paddingLeft: '24px', fontSize: '0.74rem', padding: '3px 6px 3px 24px', fontWeight: 600, color: 'var(--accent-cyan)' }}
                          value={row.amountInput}
                          onChange={(e) => handleBreakdownAmountChange(row.id, e.target.value)}
                        />
                      </div>

                      {/* Remover Linha */}
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-rose"
                        style={{ padding: '3px' }}
                        onClick={() => handleRemoveBreakdownRow(row.id)}
                        title="Remover este item"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Ações Rápidas de Linha da Fatura */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', paddingTop: '0.35rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                type="button"
                className="btn btn-outline btn-xs text-cyan"
                style={{ fontSize: '0.72rem', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={handleAddBreakdownRow}
              >
                <Plus size={12} />
                <span>Adicionar Item / Gasto</span>
              </button>

              {unanalyzedAmount > 0 && (
                <button
                  type="button"
                  className="btn btn-outline btn-xs text-amber"
                  style={{ fontSize: '0.72rem', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                  onClick={handleAllocateRestToOutros}
                  title="Criar uma linha 'Outros' com todo o valor restante não analisado"
                >
                  <Sparkles size={12} />
                  <span>Classificar restante ({unanalyzedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) como "Outros"</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* 3. RECEBER: Salário / Holerite ou Receita Variável                        */}
        {/* ------------------------------------------------------------------------- */}
        {movement.type === 'RECEBER' && (
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={14} /> Tratativa de Recebimento & Apuração de Líquido
              </span>

              <button
                type="button"
                className="btn btn-outline btn-xs"
                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                onClick={() => setIsSalaryDetailMode(!isSalaryDetailMode)}
              >
                {isSalaryDetailMode ? 'Modo Simples (Valor Direto)' : '⚡ Apurar Holerite (Descontos/Extras)'}
              </button>
            </div>

            {/* Painel de Apuração de Holerite */}
            {isSalaryDetailMode ? (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.06)',
                  border: '1px dashed rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>1. Salário Base / Bruto</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.78rem', padding: '3px 6px' }}
                      value={salaryGrossInput}
                      onChange={(e) => setSalaryGrossInput(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--accent-rose)' }}>2. Descontos Folha (-)</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.78rem', padding: '3px 6px', color: 'var(--accent-rose)' }}
                      placeholder="INSS, IRRF, vales"
                      value={salaryDiscountsInput}
                      onChange={(e) => setSalaryDiscountsInput(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--accent-emerald)' }}>3. Acréscimos (+)</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.78rem', padding: '3px 6px', color: 'var(--accent-emerald)' }}
                      placeholder="Horas extras, bônus"
                      value={salaryAdditionsInput}
                      onChange={(e) => setSalaryAdditionsInput(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-outline btn-xs text-emerald"
                  style={{ alignSelf: 'flex-start', fontSize: '0.72rem', padding: '3px 8px' }}
                  onClick={handleApplySalaryCalculation}
                >
                  <Sparkles size={12} />
                  <span>Calcular Líquido Efetivo</span>
                </button>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                Se o valor depositado na sua conta foi diferente do valor previsto, informe abaixo a quantia real.
              </p>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* 4. PAGAR: Despesas, Boletos e Vinculação com Naturezas                   */}
        {/* ------------------------------------------------------------------------- */}
        {movement.type === 'PAGAR' && (
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingDown size={14} /> Tratativa de Pagamento & Vinculação com Natureza
            </span>

            {/* Seletor de Natureza e Item de Mapeamento */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Vincular à Natureza</label>
                <select
                  className="form-input"
                  style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                  value={selectedNatureId}
                  onChange={(e) => {
                    setSelectedNatureId(e.target.value);
                    setSelectedMappingItemId('');
                    const nat = natures.find((n) => n.id === e.target.value);
                    if (nat) setCategory(nat.name);
                  }}
                >
                  <option value="">Nenhuma / Categoria Avulsa</option>
                  {natures.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.icon || '🏷️'} {n.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedNatureId && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Item do Teto / Mapeamento</label>
                  <select
                    className="form-input"
                    style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                    value={selectedMappingItemId}
                    onChange={(e) => setSelectedMappingItemId(e.target.value)}
                  >
                    <option value="">Nenhum item específico</option>
                    {natures
                      .find((n) => n.id === selectedNatureId)
                      ?.mappings.flatMap((m) =>
                        (m.items || []).map((it) => (
                          <option key={it.id} value={it.id}>
                            {m.name}: {it.description} ({it.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                          </option>
                        ))
                      )}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BLOCO PRINCIPAL: AJUSTE DO VALOR REAL APLICADO                            */}
        {/* ========================================================================= */}
        <div
          style={{
            padding: '1rem',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                Valor Real Aplicado / Praticado
              </span>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Informe a quantia exata que foi debitada ou creditada.
              </p>
            </div>

            {/* Indicador de Diferença Real vs Nominal */}
            {diffAmount !== 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background:
                    movement.type === 'RECEBER'
                      ? diffAmount > 0
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(244, 63, 94, 0.15)'
                      : diffAmount < 0
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color:
                      movement.type === 'RECEBER'
                        ? diffAmount > 0
                          ? 'var(--accent-emerald)'
                          : 'var(--accent-rose)'
                        : diffAmount < 0
                        ? 'var(--accent-emerald)'
                        : 'var(--accent-rose)',
                  }}
                >
                  {diffAmount > 0 ? `+${diffAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : diffAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({diffPercent}%)
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {diffAmount < 0 ? (movement.type === 'RECEBER' ? 'a menos' : 'economia') : (movement.type === 'RECEBER' ? 'a mais' : 'acréscimo')}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                Valor Total Real da Transação (R$)
              </label>
              <span
                style={{
                  position: 'absolute',
                  left: '10px',
                  bottom: '8px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  color: movement.type === 'RECEBER' ? 'var(--accent-emerald)' : 'var(--accent-cyan)',
                }}
              >
                R$
              </span>
              <input
                type="text"
                className="form-input"
                style={{
                  paddingLeft: '34px',
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: movement.type === 'RECEBER' ? 'var(--accent-emerald)' : 'var(--accent-cyan)',
                }}
                value={actualAmountInput}
                onChange={(e) => setActualAmountInput(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                Motivo / Justificativa da Realidade Aplicada
              </label>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                placeholder="ex: Conta veio mais cara, antecipação, horas extras..."
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
              />
            </div>
          </div>

          {/* Dados de Liquidação: Data e Banco */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '0.25rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                Data de Vencimento
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.78rem', padding: '4px 8px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                Data do Pagamento / Crédito
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.78rem', padding: '4px 8px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                Banco / Conta
              </label>
              <select
                className="form-input"
                style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                value={bank}
                onChange={(e) => setBank(e.target.value)}
              >
                {bankOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Observações Opcionais */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
              Notas / Observações Adicionais
            </label>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: '0.78rem', padding: '5px 10px' }}
              placeholder="Anotações internas..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RODAPÉ DO MODAL COM AÇÕES E LIQUIDAÇÃO                                    */}
        {/* ========================================================================= */}
        <div
          style={{
            position: 'sticky',
            bottom: '-24px',
            margin: '0.5rem -24px -24px -24px',
            padding: '0.85rem 24px',
            background: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid var(--border-default)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.65rem',
            zIndex: 10,
          }}
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm text-rose"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px' }}
            onClick={handleDelete}
            title="Excluir movimentação permanentemente"
          >
            <Trash2 size={15} />
            <span>Excluir</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleSave('PREVISTA')}
              title="Salvar o novo valor real mantendo o status de previsto"
            >
              <Clock size={14} />
              <span>Salvar Previsão Retificada</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem' }}
              onClick={() => handleSave('REALIZADA')}
              title="Confirmar quitação/depósito com o valor real e mudar status para Realizada"
            >
              <CheckCircle2 size={16} />
              <span>
                Confirmar Realizado ({actualAmountNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
              </span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
