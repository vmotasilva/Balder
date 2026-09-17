import React, { useState, useEffect, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { Modal } from './Modal';
import {
  Flag,
  Calendar,
  DollarSign,
  Tag,
  Info,
  AlertTriangle,
  CheckCircle,
  CreditCard,
  CalendarDays,
  Plus,
  Trash2,
  Building2,
  Sparkles,
} from 'lucide-react';
import type { CreditCardItem, CheckpointBankDebt } from '../types';

interface CheckpointSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInitialSetup?: boolean;
}

// Utilitário robusto de conversão para moeda brasileira (trata milhares com ponto, vírgula e decimais)
const parseBRLNumber = (val: string): number => {
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

// Gera rótulo e data de vencimento precisa para um determinado deslocamento de mês (0 = mês da fatura atual)
const computeDueDateForMonth = (
  baseStartDate: string,
  targetDueDay: number,
  monthOffset: number
): { dueDate: string; monthLabel: string } => {
  const parts = (baseStartDate || new Date().toISOString().split('T')[0]).split('-').map(Number);
  const baseYear = parts[0] || new Date().getFullYear();
  const baseMonth = parts[1] || (new Date().getMonth() + 1); // 1-12
  const baseDay = parts[2] || new Date().getDate();

  // Se o dia inicial já passou do dia de vencimento, a fatura aberta atual vence no mês seguinte
  const startOffset = baseDay > targetDueDay ? 1 : 0;
  const effectiveOffset = startOffset + monthOffset;

  const d = new Date(baseYear, baseMonth - 1 + effectiveOffset, 1);
  const y = d.getFullYear();
  const m = d.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const actualDay = Math.min(Math.max(1, targetDueDay), lastDay);
  const dueDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const name = monthNames[m];
  const labelSuffix = monthOffset === 0 ? ' (Atual)' : ` (Futura ${monthOffset})`;
  const monthLabel = `${name}/${y}${labelSuffix}`;

  return { dueDate, monthLabel };
};

interface BankDebtInvoiceItem {
  id: string;
  monthIndex: number; // 0 = atual, 1 = futura 1, 2 = futura 2...
  monthLabel: string;
  dueDate: string;
  amountInput: string;
}

interface BankDebtFormItem {
  id: string;
  cardId?: string;
  bankName: string;
  cardName: string;
  dueDay: number;
  invoices: BankDebtInvoiceItem[];
  showQuickDivide?: boolean;
  quickTotalInput?: string;
  quickInstallments?: number;
}

const createDefaultBankDebt = (
  baseDate: string,
  card?: CreditCardItem,
  fallbackBankName = 'Nubank'
): BankDebtFormItem => {
  const bankId = `bank_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const dueDay = card?.dueDay || 10;
  const { dueDate, monthLabel } = computeDueDateForMonth(baseDate, dueDay, 0);

  return {
    id: bankId,
    cardId: card?.id,
    bankName: card?.bank || fallbackBankName,
    cardName: card?.name || `${card?.bank || fallbackBankName} Cartão`,
    dueDay,
    invoices: [
      {
        id: `inv_${Date.now()}_0`,
        monthIndex: 0,
        monthLabel,
        dueDate,
        amountInput: '0',
      },
    ],
    showQuickDivide: false,
    quickTotalInput: '',
    quickInstallments: 3,
  };
};

export const CheckpointSetupModal: React.FC<CheckpointSetupModalProps> = ({
  isOpen,
  onClose,
  isInitialSetup = false,
}) => {
  const { addCheckpoint, activeCheckpoint, checkpoints, cards, addMovement, updateCard } = useFinancial();

  const getTodayString = () => new Date().toISOString().split('T')[0];

  const getFirstDayOfMonthString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  const [startDate, setStartDate] = useState<string>(getTodayString());
  const [initialBalance, setInitialBalance] = useState<string>('0');
  const [label, setLabel] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Estados para Dívidas / Faturas de Múltiplos Bancos
  const [hasCreditCardDebt, setHasCreditCardDebt] = useState(false);
  const [bankDebts, setBankDebts] = useState<BankDebtFormItem[]>([]);
  const [launchAsMovement, setLaunchAsMovement] = useState(true);

  // Carrega / restaura os dados do checkpoint vigente ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      setSavedSuccess(false);
      const todayStr = getTodayString();
      const firstDay = getFirstDayOfMonthString();

      if (activeCheckpoint && !isInitialSetup) {
        const cDate = activeCheckpoint.startDate || todayStr;
        setStartDate(cDate);
        setInitialBalance(String(activeCheckpoint.initialBalance || 0));
        setLabel(activeCheckpoint.label || `Recomeço ${new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`);

        if (activeCheckpoint.cardDebts && activeCheckpoint.cardDebts.length > 0) {
          setHasCreditCardDebt(true);
          const restored: BankDebtFormItem[] = activeCheckpoint.cardDebts.map((bd) => ({
            id: bd.id,
            cardId: bd.cardId,
            bankName: bd.bankName,
            cardName: bd.cardName,
            dueDay: bd.dueDay || 10,
            invoices: bd.invoices.map((inv, idx) => ({
              id: `inv_${bd.id}_${idx}`,
              monthIndex: inv.monthIndex,
              monthLabel: inv.monthLabel,
              dueDate: inv.dueDate,
              amountInput: String(inv.amount),
            })),
            showQuickDivide: false,
            quickTotalInput: '',
            quickInstallments: 3,
          }));
          setBankDebts(restored);
        } else if (activeCheckpoint.creditCardDebt && activeCheckpoint.creditCardDebt > 0) {
          setHasCreditCardDebt(true);
          const total = activeCheckpoint.creditCardDebt;
          const inst = activeCheckpoint.cardInstallments || 1;
          const perM = Math.round((total / inst) * 100) / 100;
          const dueDay = activeCheckpoint.cardDueDate ? parseInt(activeCheckpoint.cardDueDate.split('-')[2], 10) || 10 : 10;

          const invs: BankDebtInvoiceItem[] = [];
          for (let i = 0; i < inst; i++) {
            const { dueDate, monthLabel } = computeDueDateForMonth(cDate, dueDay, i);
            invs.push({
              id: `inv_restored_${i}`,
              monthIndex: i,
              monthLabel,
              dueDate: i === 0 && activeCheckpoint.cardDueDate ? activeCheckpoint.cardDueDate : dueDate,
              amountInput: String(i === inst - 1 ? Math.round((total - perM * (inst - 1)) * 100) / 100 : perM),
            });
          }
          setBankDebts([
            {
              id: `bank_restored_${Date.now()}`,
              bankName: activeCheckpoint.cardName || 'Cartão de Crédito',
              cardName: activeCheckpoint.cardName || 'Cartão de Crédito',
              dueDay,
              invoices: invs,
              showQuickDivide: false,
              quickTotalInput: '',
              quickInstallments: 3,
            },
          ]);
        } else {
          setHasCreditCardDebt(false);
          setBankDebts([createDefaultBankDebt(cDate, cards[0])]);
        }
      } else {
        setStartDate(firstDay);
        setInitialBalance('0');
        setLabel(isInitialSetup ? 'Ponto de Partida Inicial' : '');
        setHasCreditCardDebt(false);
        setBankDebts([createDefaultBankDebt(firstDay, cards[0])]);
      }
    }
  }, [isOpen, activeCheckpoint, isInitialSetup, cards]);

  // Atualiza datas de vencimento quando o startDate do checkpoint muda
  const handleStartDateChange = (newStartDate: string) => {
    setStartDate(newStartDate);
    setBankDebts((prev) =>
      prev.map((b) => ({
        ...b,
        invoices: b.invoices.map((inv) => {
          const { dueDate, monthLabel } = computeDueDateForMonth(newStartDate, b.dueDay, inv.monthIndex);
          return {
            ...inv,
            dueDate,
            monthLabel,
          };
        }),
      }))
    );
  };

  // Funções de manipulação de Bancos
  const handleAddBankDebt = () => {
    const usedCardIds = new Set(bankDebts.map((b) => b.cardId).filter(Boolean));
    const availableCard = cards.find((c) => !usedCardIds.has(c.id));
    const fallbackName = `Banco ${bankDebts.length + 1}`;
    setBankDebts((prev) => [...prev, createDefaultBankDebt(startDate, availableCard, fallbackName)]);
  };

  const handleRemoveBankDebt = (bankId: string) => {
    if (bankDebts.length <= 1) {
      if (confirm('Deseja desativar o cadastro de dívidas de cartão de crédito?')) {
        setHasCreditCardDebt(false);
      }
      return;
    }
    setBankDebts((prev) => prev.filter((b) => b.id !== bankId));
  };

  const handleBankCardChange = (bankId: string, cardIdOrCustom: string) => {
    setBankDebts((prev) =>
      prev.map((b) => {
        if (b.id !== bankId) return b;

        if (cardIdOrCustom === 'CUSTOM') {
          return {
            ...b,
            cardId: undefined,
            bankName: 'Outro Banco',
            cardName: 'Cartão Personalizado',
          };
        }

        const selectedCard = cards.find((c) => c.id === cardIdOrCustom);
        if (!selectedCard) return b;

        const newDueDay = selectedCard.dueDay || 10;
        return {
          ...b,
          cardId: selectedCard.id,
          bankName: selectedCard.bank,
          cardName: selectedCard.name,
          dueDay: newDueDay,
          invoices: b.invoices.map((inv) => {
            const { dueDate, monthLabel } = computeDueDateForMonth(startDate, newDueDay, inv.monthIndex);
            return {
              ...inv,
              dueDate,
              monthLabel,
            };
          }),
        };
      })
    );
  };

  const handleDueDayChange = (bankId: string, newDueDayNum: number) => {
    const cleanDay = Math.min(31, Math.max(1, newDueDayNum || 10));
    setBankDebts((prev) =>
      prev.map((b) => {
        if (b.id !== bankId) return b;
        return {
          ...b,
          dueDay: cleanDay,
          invoices: b.invoices.map((inv) => {
            const { dueDate, monthLabel } = computeDueDateForMonth(startDate, cleanDay, inv.monthIndex);
            return {
              ...inv,
              dueDate,
              monthLabel,
            };
          }),
        };
      })
    );
  };

  // Manipulação de Faturas de um Banco
  const handleAddFutureInvoice = (bankId: string) => {
    setBankDebts((prev) =>
      prev.map((b) => {
        if (b.id !== bankId) return b;
        const maxIndex = b.invoices.reduce((max, inv) => Math.max(max, inv.monthIndex), 0);
        const nextIndex = maxIndex + 1;
        const { dueDate, monthLabel } = computeDueDateForMonth(startDate, b.dueDay, nextIndex);
        return {
          ...b,
          invoices: [
            ...b.invoices,
            {
              id: `inv_${Date.now()}_${nextIndex}`,
              monthIndex: nextIndex,
              monthLabel,
              dueDate,
              amountInput: '0',
            },
          ],
        };
      })
    );
  };

  const handleRemoveInvoice = (bankId: string, invoiceId: string) => {
    setBankDebts((prev) =>
      prev.map((b) => {
        if (b.id !== bankId) return b;
        // Não remove a fatura atual (monthIndex === 0)
        return {
          ...b,
          invoices: b.invoices.filter((inv) => inv.id !== invoiceId || inv.monthIndex === 0),
        };
      })
    );
  };

  const handleInvoiceAmountChange = (bankId: string, invoiceId: string, val: string) => {
    setBankDebts((prev) =>
      prev.map((b) => {
        if (b.id !== bankId) return b;
        return {
          ...b,
          invoices: b.invoices.map((inv) => (inv.id === invoiceId ? { ...inv, amountInput: val } : inv)),
        };
      })
    );
  };

  const handleInvoiceDueDateChange = (bankId: string, invoiceId: string, newDate: string) => {
    setBankDebts((prev) =>
      prev.map((b) => {
        if (b.id !== bankId) return b;
        return {
          ...b,
          invoices: b.invoices.map((inv) => (inv.id === invoiceId ? { ...inv, dueDate: newDate } : inv)),
        };
      })
    );
  };

  // Atalho de Parcelamento Rápido (Dividir valor total igualmente em parcelas)
  const handleApplyQuickDivide = (bankId: string) => {
    setBankDebts((prev) =>
      prev.map((b) => {
        if (b.id !== bankId) return b;
        const total = parseBRLNumber(b.quickTotalInput || '0');
        const installments = Math.max(1, Math.min(36, b.quickInstallments || 3));
        if (total <= 0) return { ...b, showQuickDivide: false };

        const perMonth = Math.round((total / installments) * 100) / 100;
        const newInvoices: BankDebtInvoiceItem[] = [];

        for (let i = 0; i < installments; i++) {
          const { dueDate, monthLabel } = computeDueDateForMonth(startDate, b.dueDay, i);
          const isLast = i === installments - 1;
          const adjustedAmount = isLast ? Math.round((total - perMonth * (installments - 1)) * 100) / 100 : perMonth;
          newInvoices.push({
            id: `inv_quick_${Date.now()}_${i}`,
            monthIndex: i,
            monthLabel,
            dueDate,
            amountInput: String(adjustedAmount),
          });
        }

        return {
          ...b,
          invoices: newInvoices,
          showQuickDivide: false,
          quickTotalInput: '',
        };
      })
    );
  };

  // Cálculos Consolidados
  const initialCashNum = parseBRLNumber(initialBalance);

  const banksWithTotals = useMemo(() => {
    return bankDebts.map((b) => {
      const total = b.invoices.reduce((acc, inv) => acc + parseBRLNumber(inv.amountInput), 0);
      const currentInvoice = b.invoices.find((inv) => inv.monthIndex === 0) || b.invoices[0];
      const currentAmount = currentInvoice ? parseBRLNumber(currentInvoice.amountInput) : 0;
      const futureInvoices = b.invoices.filter((inv) => inv.monthIndex > 0);
      const futureTotal = futureInvoices.reduce((acc, inv) => acc + parseBRLNumber(inv.amountInput), 0);
      return {
        ...b,
        total,
        currentAmount,
        futureTotal,
        futureCount: futureInvoices.length,
      };
    });
  }, [bankDebts]);

  const totalAllDebt = useMemo(() => {
    if (!hasCreditCardDebt) return 0;
    return banksWithTotals.reduce((acc, b) => acc + b.total, 0);
  }, [hasCreditCardDebt, banksWithTotals]);

  const totalAllInvoicesCount = useMemo(() => {
    if (!hasCreditCardDebt) return 0;
    return banksWithTotals.reduce((acc, b) => acc + b.invoices.length, 0);
  }, [hasCreditCardDebt, banksWithTotals]);

  const netStartingBalance = initialCashNum - totalAllDebt;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const balanceNum = initialCashNum;

    // Filtra e prepara a lista de faturas válidas por banco
    const validBankDebts: CheckpointBankDebt[] = banksWithTotals
      .filter((b) => b.total > 0)
      .map((b) => ({
        id: b.id,
        cardId: b.cardId,
        bankName: b.bankName,
        cardName: b.cardName,
        dueDay: b.dueDay,
        totalDebt: b.total,
        invoices: b.invoices
          .filter((inv) => parseBRLNumber(inv.amountInput) > 0)
          .map((inv) => ({
            monthIndex: inv.monthIndex,
            monthLabel: inv.monthLabel,
            dueDate: inv.dueDate,
            amount: parseBRLNumber(inv.amountInput),
          })),
      }));

    // Para retrocompatibilidade com campos legados
    const firstBank = validBankDebts[0];
    const firstInvoice = firstBank?.invoices[0];
    const summaryCardName =
      validBankDebts.length === 1
        ? validBankDebts[0].cardName
        : validBankDebts.length > 1
        ? `${validBankDebts.length} Bancos (${validBankDebts.map((b) => b.bankName).join(', ')})`
        : undefined;

    const maxInstallments = validBankDebts.reduce((max, b) => Math.max(max, b.invoices.length), 1);

    addCheckpoint({
      startDate: startDate || getTodayString(),
      initialBalance: balanceNum,
      creditCardDebt: totalAllDebt > 0 ? totalAllDebt : undefined,
      cardDueDate: firstInvoice?.dueDate,
      cardName: summaryCardName,
      cardInstallments: totalAllDebt > 0 ? maxInstallments : undefined,
      cardDebts: validBankDebts.length > 0 ? validBankDebts : undefined,
      label: label.trim() || (isInitialSetup ? 'Ponto de Partida Inicial' : `Marco de ${startDate}`),
    });

    // Se solicitado, agenda cada fatura no fluxo de caixa na sua respectiva data de vencimento
    if (hasCreditCardDebt && totalAllDebt > 0 && launchAsMovement) {
      validBankDebts.forEach((b) => {
        const installmentGroupId = `card_debt_${b.id}_${Date.now()}`;
        const totalInvs = b.invoices.length;

        b.invoices.forEach((inv, index) => {
          const instNum = index + 1;
          const isCurrent = inv.monthIndex === 0;

          addMovement({
            title: isCurrent
              ? `Fatura ${b.cardName} (Atual)`
              : `Fatura ${b.cardName} (${inv.monthLabel.split(' ')[0]})`,
            type: 'CARTAO',
            amount: inv.amount,
            dueDate: inv.dueDate,
            bank: b.bankName || 'Cartão de Crédito',
            status: 'PREVISTA',
            category: 'Fatura de Cartão',
            installmentNumber: instNum,
            installmentsTotal: totalInvs,
            installmentGroupId,
            notes: `Fatura cadastrada no Ponto de Partida (${startDate}) - ${inv.monthLabel}`,
          });
        });

        if (b.cardId) {
          updateCard(b.cardId, { limitUsed: b.totalDebt });
        }
      });
    }

    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 450);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isInitialSetup ? '🎯 Definir Ponto de Partida' : '🚩 Novo Marco de Acompanhamento'}
      subtitle={
        isInitialSetup
          ? 'Defina a data, saldo em caixa e faturas atuais e futuras de cada banco para calibrar suas métricas.'
          : 'Inicie uma nova fase de acompanhamento com faturas de cada banco organizadas.'
      }
      maxWidth="640px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {/* Banner Informativo */}
        <div
          style={{
            padding: '0.65rem 0.85rem',
            borderRadius: '10px',
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.2)',
            fontSize: '0.78rem',
            color: 'var(--text-primary)',
            display: 'flex',
            gap: '0.65rem',
            alignItems: 'flex-start',
          }}
        >
          <Info size={16} className="text-cyan" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--accent-cyan)' }}>Como funciona o Marco Financeiro?</strong>
            <p style={{ margin: '0.15rem 0 0', color: 'var(--text-secondary)', lineHeight: '1.35', fontSize: '0.75rem' }}>
              O sistema utiliza a <strong>data de início</strong>, o <strong>saldo em caixa</strong> e as <strong>faturas de cartão</strong> para calibrar seu saldo disponível, fluxo de caixa e patrimônio líquido inicial.
            </p>
          </div>
        </div>

        {checkpoints.length > 0 && !isInitialSetup && (
          <div
            style={{
              padding: '0.6rem 0.85rem',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              fontSize: '0.76rem',
              color: '#FCD34D',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <AlertTriangle size={15} className="text-amber" style={{ flexShrink: 0 }} />
            <span>
              O marco atual ativo será substituído por este novo ponto de partida. Seu histórico anterior continuará seguro.
            </span>
          </div>
        )}

        {/* Campo 1: Data de Início */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.82rem' }}>
              <Calendar size={14} className="text-cyan" />
              Data de Início do Acompanhamento
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                onClick={() => handleStartDateChange(getFirstDayOfMonthString())}
              >
                1º do Mês
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                onClick={() => handleStartDateChange(getTodayString())}
              >
                Hoje
              </button>
            </div>
          </label>
          <input
            type="date"
            required
            className="form-input"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
            Apenas transações a partir desta data influenciarão o saldo em caixa e fluxo do dashboard.
          </span>
        </div>

        {/* Campo 2: Saldo Inicial em Caixa */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.3rem' }}>
            <DollarSign size={14} className="text-emerald" />
            Saldo Total em Caixa nessa Data (R$)
          </label>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontWeight: 700,
                color: 'var(--accent-emerald)',
                fontSize: '0.9rem',
              }}
            >
              R$
            </span>
            <input
              type="text"
              required
              className="form-input"
              style={{ paddingLeft: '40px', fontWeight: 700, color: 'var(--accent-emerald)', fontSize: '1.05rem' }}
              placeholder="0,00"
              value={initialBalance}
              onFocus={(e) => {
                if (e.target.value === '0') setInitialBalance('');
              }}
              onChange={(e) => setInitialBalance(e.target.value)}
            />
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
            Valor real disponível em contas e carteira no dia inicial escolhido.
          </span>
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO PRINCIPAL: Faturas Atuais e Futuras de Cartão de Crédito por Banco */}
        {/* ========================================================================= */}
        <div
          style={{
            borderRadius: '12px',
            border: `1px solid ${hasCreditCardDebt ? 'rgba(244, 63, 94, 0.35)' : 'var(--border-default)'}`,
            background: hasCreditCardDebt ? 'rgba(244, 63, 94, 0.04)' : 'rgba(255, 255, 255, 0.02)',
            padding: '0.75rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            transition: 'all 0.2s ease',
          }}
        >
          {/* Header do Toggle */}
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setHasCreditCardDebt(!hasCreditCardDebt)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: hasCreditCardDebt ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: hasCreditCardDebt ? '#F43F5E' : 'var(--text-muted)',
                }}
              >
                <CreditCard size={17} />
              </div>
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                  Estabelecer Faturas Atuais e Futuras por Banco
                </span>
                <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>
                  {hasCreditCardDebt
                    ? 'Informe as faturas em aberto e futuras de cada banco para descontar do patrimônio e lançar no fluxo'
                    : 'Clique para definir faturas atuais e futuras (Nubank, Itaú, etc.)'}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={hasCreditCardDebt}
              onChange={(e) => setHasCreditCardDebt(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#F43F5E', cursor: 'pointer' }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Lista de Bancos e Faturas */}
          {hasCreditCardDebt && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingTop: '0.35rem', borderTop: '1px solid rgba(244, 63, 94, 0.15)' }}>
              
              {banksWithTotals.map((b) => {
                const currentInvoice = b.invoices.find((inv) => inv.monthIndex === 0) || b.invoices[0];
                const futureInvoices = b.invoices.filter((inv) => inv.monthIndex > 0);

                return (
                  <div
                    key={b.id}
                    style={{
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      padding: '0.75rem 0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                  >
                    {/* Topo do Card do Banco */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
                        <Building2 size={15} className="text-cyan" style={{ flexShrink: 0 }} />
                        
                        {/* Seletor de Cartão ou Custom */}
                        <select
                          className="form-input"
                          style={{ fontSize: '0.8rem', padding: '4px 8px', flex: 1 }}
                          value={b.cardId || (b.cardId === undefined ? 'CUSTOM' : '')}
                          onChange={(e) => handleBankCardChange(b.id, e.target.value)}
                        >
                          {cards.map((c) => (
                            <option key={c.id} value={c.id}>
                              💳 {c.name} ({c.bank})
                            </option>
                          ))}
                          <option value="CUSTOM">+ Outro Banco / Cartão Personalizado</option>
                        </select>
                      </div>

                      {/* Dia de Vencimento e Botão Remover Banco */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            Dia Venc.:
                          </span>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={b.dueDay}
                            onChange={(e) => handleDueDayChange(b.id, parseInt(e.target.value, 10))}
                            className="form-input"
                            style={{ width: '50px', padding: '3px 6px', fontSize: '0.78rem', textAlign: 'center' }}
                            title="Dia do vencimento fixo no mês"
                          />
                        </div>

                        {bankDebts.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-rose"
                            onClick={() => handleRemoveBankDebt(b.id)}
                            title="Remover este banco"
                            style={{ padding: '3px 6px' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Se for personalizado, exibe inputs de texto para nome do banco/cartão */}
                    {!b.cardId && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Nome do Banco (ex: Nubank, Itaú)"
                          value={b.bankName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBankDebts((prev) =>
                              prev.map((item) => (item.id === b.id ? { ...item, bankName: val } : item))
                            );
                          }}
                          className="form-input"
                          style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                        />
                        <input
                          type="text"
                          placeholder="Nome do Cartão (ex: Ultravioleta)"
                          value={b.cardName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBankDebts((prev) =>
                              prev.map((item) => (item.id === b.id ? { ...item, cardName: val } : item))
                            );
                          }}
                          className="form-input"
                          style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                        />
                      </div>
                    )}

                    {/* 1. Bloco de FATURA ATUAL (Mês Vigente) */}
                    {currentInvoice && (
                      <div
                        style={{
                          padding: '0.5rem 0.65rem',
                          borderRadius: '8px',
                          background: 'rgba(244, 63, 94, 0.08)',
                          border: '1px solid rgba(244, 63, 94, 0.25)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span>📌</span> Fatura Atual — {currentInvoice.monthLabel}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            Vencimento: {currentInvoice.dueDate.split('-').reverse().join('/')}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <span
                              style={{
                                position: 'absolute',
                                left: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontWeight: 700,
                                color: '#f87171',
                                fontSize: '0.85rem',
                              }}
                            >
                              R$
                            </span>
                            <input
                              type="text"
                              required={hasCreditCardDebt}
                              className="form-input"
                              style={{
                                paddingLeft: '34px',
                                fontWeight: 700,
                                color: '#f87171',
                                fontSize: '0.95rem',
                              }}
                              placeholder="0,00"
                              value={currentInvoice.amountInput}
                              onFocus={(e) => {
                                if (e.target.value === '0') handleInvoiceAmountChange(b.id, currentInvoice.id, '');
                              }}
                              onChange={(e) => handleInvoiceAmountChange(b.id, currentInvoice.id, e.target.value)}
                            />
                          </div>

                          <input
                            type="date"
                            value={currentInvoice.dueDate}
                            onChange={(e) => handleInvoiceDueDateChange(b.id, currentInvoice.id, e.target.value)}
                            className="form-input"
                            style={{ width: '130px', fontSize: '0.75rem', padding: '4px 6px' }}
                            title="Alterar data de vencimento da fatura atual"
                          />
                        </div>
                      </div>
                    )}

                    {/* 2. Bloco de FATURAS FUTURAS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.15rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CalendarDays size={13} className="text-cyan" />
                          Faturas Futuras ({futureInvoices.length} {futureInvoices.length === 1 ? 'mês' : 'meses'} adicionais)
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs text-cyan"
                            style={{ fontSize: '0.7rem', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '3px' }}
                            onClick={() => handleAddFutureInvoice(b.id)}
                            title="Adicionar próximo mês de fatura futura"
                          >
                            <Plus size={11} />
                            <span>Adicionar Mês Futuro</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-amber"
                            style={{ fontSize: '0.68rem', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '3px' }}
                            onClick={() => {
                              setBankDebts((prev) =>
                                prev.map((item) =>
                                  item.id === b.id ? { ...item, showQuickDivide: !item.showQuickDivide } : item
                                )
                              );
                            }}
                            title="Preencher parcelas iguais a partir de um valor total"
                          >
                            <Sparkles size={11} />
                            <span>Dividir Total</span>
                          </button>
                        </div>
                      </div>

                      {/* Painel expansível de divisão rápida em parcelas */}
                      {b.showQuickDivide && (
                        <div
                          style={{
                            padding: '0.5rem 0.65rem',
                            borderRadius: '8px',
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem',
                            fontSize: '0.72rem',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#fcd34d' }}>
                            ⚡ Gerador Rápido de Parcelas Iguais:
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <div style={{ position: 'relative', width: '130px' }}>
                              <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: '#fcd34d', fontSize: '0.75rem' }}>
                                R$
                              </span>
                              <input
                                type="text"
                                placeholder="Total a dividir"
                                value={b.quickTotalInput || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBankDebts((prev) =>
                                    prev.map((item) => (item.id === b.id ? { ...item, quickTotalInput: val } : item))
                                  );
                                }}
                                className="form-input"
                                style={{ paddingLeft: '28px', fontSize: '0.75rem', padding: '3px 6px' }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>em</span>
                              <select
                                className="form-input"
                                style={{ fontSize: '0.75rem', padding: '3px 6px', width: '70px' }}
                                value={b.quickInstallments || 3}
                                onChange={(e) => {
                                  const num = parseInt(e.target.value, 10);
                                  setBankDebts((prev) =>
                                    prev.map((item) => (item.id === b.id ? { ...item, quickInstallments: num } : item))
                                  );
                                }}
                              >
                                {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((n) => (
                                  <option key={n} value={n}>
                                    {n}x
                                  </option>
                                ))}
                              </select>
                            </div>

                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                              onClick={() => handleApplyQuickDivide(b.id)}
                            >
                              Distribuir
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs text-muted"
                              style={{ fontSize: '0.7rem' }}
                              onClick={() => {
                                setBankDebts((prev) =>
                                  prev.map((item) => (item.id === b.id ? { ...item, showQuickDivide: false } : item))
                                );
                              }}
                            >
                              Fechar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Lista de Faturas Futuras */}
                      {futureInvoices.length === 0 ? (
                        <div
                          style={{
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px dashed rgba(255, 255, 255, 0.08)',
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>Nenhuma fatura futura adicionada para este banco.</span>
                          <button
                            type="button"
                            className="btn btn-link btn-xs text-cyan"
                            style={{ fontSize: '0.7rem', padding: 0 }}
                            onClick={() => handleAddFutureInvoice(b.id)}
                          >
                            + Adicionar
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {futureInvoices.map((inv) => (
                            <div
                              key={inv.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '0.35rem 0.5rem',
                                borderRadius: '6px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: 'var(--text-primary)',
                                  width: '135px',
                                  flexShrink: 0,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={inv.monthLabel}
                              >
                                🗓️ {inv.monthLabel}
                              </span>

                              <div style={{ position: 'relative', flex: 1 }}>
                                <span
                                  style={{
                                    position: 'absolute',
                                    left: '8px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontWeight: 600,
                                    color: 'var(--accent-cyan)',
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  R$
                                </span>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{
                                    paddingLeft: '28px',
                                    fontWeight: 600,
                                    color: 'var(--accent-cyan)',
                                    fontSize: '0.8rem',
                                    padding: '3px 8px 3px 26px',
                                  }}
                                  placeholder="0,00"
                                  value={inv.amountInput}
                                  onFocus={(e) => {
                                    if (e.target.value === '0') handleInvoiceAmountChange(b.id, inv.id, '');
                                  }}
                                  onChange={(e) => handleInvoiceAmountChange(b.id, inv.id, e.target.value)}
                                />
                              </div>

                              <input
                                type="date"
                                value={inv.dueDate}
                                onChange={(e) => handleInvoiceDueDateChange(b.id, inv.id, e.target.value)}
                                className="form-input"
                                style={{ width: '120px', fontSize: '0.72rem', padding: '3px 5px' }}
                                title="Data de vencimento desta fatura futura"
                              />

                              <button
                                type="button"
                                className="btn btn-ghost btn-xs text-rose"
                                style={{ padding: '3px' }}
                                onClick={() => handleRemoveInvoice(b.id, inv.id)}
                                title="Remover este mês futuro"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Subtotal do Banco */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '0.35rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: '0.72rem',
                      }}
                    >
                      <span className="text-muted">
                        Subtotal {b.cardName}:{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Atual ({b.currentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) + Futuras ({b.futureTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                        </span>
                      </span>
                      <strong className="text-rose-400 font-mono">
                        {b.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>
                  </div>
                );
              })}

              {/* Botão para Adicionar Outro Banco */}
              <button
                type="button"
                className="btn btn-outline"
                style={{
                  width: '100%',
                  borderStyle: 'dashed',
                  fontSize: '0.78rem',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  color: 'var(--accent-cyan)',
                  borderColor: 'rgba(6, 182, 212, 0.4)',
                }}
                onClick={handleAddBankDebt}
              >
                <Plus size={14} />
                <span>Adicionar Outro Banco / Cartão</span>
              </button>

              {/* Card Consolidado Geral de Todas as Faturas */}
              <div
                style={{
                  padding: '0.6rem 0.8rem',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontSize: '0.74rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="text-muted">Dívida Total Consolidada ({bankDebts.length} {bankDebts.length === 1 ? 'banco' : 'bancos'}, {totalAllInvoicesCount} faturas):</span>
                  <strong className="text-rose-400 font-bold" style={{ fontSize: '0.9rem' }}>
                    {totalAllDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', paddingTop: '3px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span className="text-muted">Patrimônio Líquido Inicial (Caixa - Dívida Total):</span>
                  <span style={{ fontWeight: 700, color: netStartingBalance >= 0 ? 'var(--accent-emerald)' : '#F43F5E' }}>
                    {netStartingBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              {/* Checkbox de agendamento das faturas no fluxo */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', cursor: 'pointer', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={launchAsMovement}
                  onChange={(e) => setLaunchAsMovement(e.target.checked)}
                  style={{ accentColor: 'var(--accent-cyan)', marginTop: '2px' }}
                />
                <span>
                  Lançar todas as {totalAllInvoicesCount} faturas (atuais e futuras) no fluxo de caixa nas respectivas datas de vencimento de cada banco (status Prevista)
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Campo 3: Nome do Marco (Opcional) */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.3rem' }}>
            <Tag size={14} className="text-cyan" />
            Nome do Marco (Opcional)
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="ex: Ponto de Partida 2026, Novo Ciclo Março"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        {/* Botões do Rodapé */}
        <div
          className="modal-footer-actions"
          style={{
            marginTop: '0.35rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-default)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.65rem',
          }}
        >
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            disabled={savedSuccess}
          >
            {savedSuccess ? (
              <>
                <CheckCircle size={15} />
                <span>Salvo com Sucesso!</span>
              </>
            ) : (
              <>
                <Flag size={15} />
                <span>{isInitialSetup ? 'Salvar Ponto de Partida' : 'Ativar Novo Marco'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
