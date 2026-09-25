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
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import type { CreditCardItem, CheckpointBankDebt, InvoiceNatureItemBreakdown, FinancialCheckpoint } from '../types';

interface CheckpointSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInitialSetup?: boolean;
  mode?: 'CREATE' | 'EDIT';
  checkpointToEdit?: FinancialCheckpoint | null;
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
// Regra fundamental: A fatura das compras do mês atual SEMPRE vence no mês seguinte.
const computeDueDateForMonth = (
  baseStartDate: string,
  targetDueDay: number,
  monthOffset: number
): { dueDate: string; monthLabel: string } => {
  const parts = (baseStartDate || new Date().toISOString().split('T')[0]).split('-').map(Number);
  const baseYear = parts[0] || new Date().getFullYear();
  const baseMonth = parts[1] || (new Date().getMonth() + 1); // 1-12

  // A fatura com as compras do mês atual vence SEMPRE no mês seguinte (+1)
  const effectiveOffset = 1 + monthOffset;

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

  // Competência dos gastos (mês base + monthOffset)
  const compDate = new Date(baseYear, baseMonth - 1 + monthOffset, 1);
  const compMonthName = monthNames[compDate.getMonth()];
  const compYear = compDate.getFullYear();
  const dueMonthName = monthNames[m];

  const labelSuffix = monthOffset === 0 ? ' (Atual)' : ` (Futura +${monthOffset})`;
  const monthLabel = `${compMonthName}/${compYear}${labelSuffix} — Vence em ${dueMonthName}`;

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

// Estrutura de cada linha de detalhamento da fatura na Etapa 2
interface InvoiceBreakdownRow {
  id: string;
  natureId: string;       // id da natureza ou 'OUTROS'
  natureName: string;     // Nome da natureza ou 'Outros'
  mappingId?: string;     // id da rotina/mapeamento se vinculado
  mappingItemId?: string; // id do item de teto se vinculado
  description: string;    // Descrição do gasto (ex: Compras de Mercado)
  amountInput: string;    // R$
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
  mode = 'CREATE',
  checkpointToEdit,
}) => {
  const {
    addCheckpoint,
    activeCheckpoint,
    checkpoints,
    cards,
    natures,
    addMovement,
    updateMovement,
    movements,
    updateCard,
    markMappingItemsFulfilled,
  } = useFinancial();

  const getTodayString = () => new Date().toISOString().split('T')[0];

  const getFirstDayOfMonthString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  // Controle de Etapa do Modal: 1 = Configuração do Marco / Faturas, 2 = Detalhamento por Natureza
  const [step, setStep] = useState<1 | 2>(1);

  const [startDate, setStartDate] = useState<string>(getTodayString());
  const [initialBalance, setInitialBalance] = useState<string>('0');
  const [label, setLabel] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Estados para Dívidas / Faturas de Múltiplos Bancos
  const [hasCreditCardDebt, setHasCreditCardDebt] = useState(false);
  const [bankDebts, setBankDebts] = useState<BankDebtFormItem[]>([]);
  const [launchAsMovement, setLaunchAsMovement] = useState(true);

  // Estado para Detalhamento das Faturas em Aberto (Etapa 2), indexado por bankId
  const [breakdownsByBank, setBreakdownsByBank] = useState<Record<string, InvoiceBreakdownRow[]>>({});

  // Carrega / restaura os dados apenas se estiver no modo EDIÇÃO ('EDIT')
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSavedSuccess(false);
      const todayStr = getTodayString();
      const firstDay = getFirstDayOfMonthString();

      // MODO EDIÇÃO: apenas se mode === 'EDIT'
      const targetCheckpoint = mode === 'EDIT' ? (checkpointToEdit || activeCheckpoint) : null;

      if (targetCheckpoint) {
        const cDate = targetCheckpoint.startDate || todayStr;
        setStartDate(cDate);
        setInitialBalance(String(targetCheckpoint.initialBalance || 0));
        setLabel(targetCheckpoint.label || `Recomeço ${new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`);

        if (targetCheckpoint.cardDebts && targetCheckpoint.cardDebts.length > 0) {
          setHasCreditCardDebt(true);
          const restored: BankDebtFormItem[] = targetCheckpoint.cardDebts.map((bd) => {
            // Deduplica faturas por dueDate para garantir que NUNCA apareça mais de uma fatura para a mesma data
            const seenDates = new Set<string>();
            const cleanInvoices: BankDebtInvoiceItem[] = [];
            bd.invoices.forEach((inv) => {
              if (!seenDates.has(inv.dueDate)) {
                seenDates.add(inv.dueDate);
                cleanInvoices.push({
                  id: `inv_${bd.id}_${cleanInvoices.length}`,
                  monthIndex: cleanInvoices.length,
                  monthLabel: inv.monthLabel,
                  dueDate: inv.dueDate,
                  amountInput: String(inv.amount),
                });
              }
            });

            return {
              id: bd.id,
              cardId: bd.cardId,
              bankName: bd.bankName,
              cardName: bd.cardName,
              dueDay: bd.dueDay || 10,
              invoices: cleanInvoices.length > 0 ? cleanInvoices : [
                {
                  id: `inv_${bd.id}_0`,
                  monthIndex: 0,
                  monthLabel: computeDueDateForMonth(cDate, bd.dueDay || 10, 0).monthLabel,
                  dueDate: computeDueDateForMonth(cDate, bd.dueDay || 10, 0).dueDate,
                  amountInput: '0',
                },
              ],
              showQuickDivide: false,
              quickTotalInput: '',
              quickInstallments: 3,
            };
          });
          setBankDebts(restored);

          // Restaura detalhamentos se existirem no checkpoint anterior
          const restoredBreakdowns: Record<string, InvoiceBreakdownRow[]> = {};
          targetCheckpoint.cardDebts.forEach((bd) => {
            const firstInv = bd.invoices[0];
            if (firstInv?.breakdown && firstInv.breakdown.length > 0) {
              restoredBreakdowns[bd.id] = firstInv.breakdown.map((item) => ({
                id: item.id,
                natureId: item.natureId || (item.natureName === 'Outros' ? 'OUTROS' : ''),
                natureName: item.natureName,
                mappingId: item.mappingId,
                mappingItemId: item.mappingItemId,
                description: item.description,
                amountInput: String(item.amount),
              }));
            }
          });
          setBreakdownsByBank(restoredBreakdowns);
        } else if (targetCheckpoint.creditCardDebt && targetCheckpoint.creditCardDebt > 0) {
          setHasCreditCardDebt(true);
          const total = targetCheckpoint.creditCardDebt;
          const inst = targetCheckpoint.cardInstallments || 1;
          const perM = Math.round((total / inst) * 100) / 100;
          const dueDay = targetCheckpoint.cardDueDate ? parseInt(targetCheckpoint.cardDueDate.split('-')[2], 10) || 10 : 10;

          const invs: BankDebtInvoiceItem[] = [];
          for (let i = 0; i < inst; i++) {
            const { dueDate, monthLabel } = computeDueDateForMonth(cDate, dueDay, i);
            invs.push({
              id: `inv_restored_${i}`,
              monthIndex: i,
              monthLabel,
              dueDate: i === 0 && targetCheckpoint.cardDueDate ? targetCheckpoint.cardDueDate : dueDate,
              amountInput: String(i === inst - 1 ? Math.round((total - perM * (inst - 1)) * 100) / 100 : perM),
            });
          }
          setBankDebts([
            {
              id: `bank_restored_${Date.now()}`,
              bankName: targetCheckpoint.cardName || 'Cartão de Crédito',
              cardName: targetCheckpoint.cardName || 'Cartão de Crédito',
              dueDay,
              invoices: invs,
              showQuickDivide: false,
              quickTotalInput: '',
              quickInstallments: 3,
            },
          ]);
          setBreakdownsByBank({});
        } else {
          setHasCreditCardDebt(false);
          setBankDebts([createDefaultBankDebt(cDate, cards[0])]);
          setBreakdownsByBank({});
        }
      } else {
        // MODO CRIAÇÃO (NOVO MARCO / PONTO DE PARTIDA):
        // NUNCA acusa faturas passadas! Inicia completamente limpo com checkbox desmarcado e valores zerados.
        setStartDate(firstDay);
        setInitialBalance('0');
        setLabel(isInitialSetup ? 'Ponto de Partida Inicial' : '');
        setHasCreditCardDebt(false);
        setBankDebts([createDefaultBankDebt(firstDay, cards[0])]);
        setBreakdownsByBank({});
      }
    }
  }, [isOpen, activeCheckpoint, isInitialSetup, mode, checkpointToEdit, cards]);

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

  // Cálculos Consolidados de Dívidas
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
        currentInvoice,
      };
    });
  }, [bankDebts]);

  const totalAllDebt = useMemo(() => {
    if (!hasCreditCardDebt) return 0;
    return banksWithTotals.reduce((acc, b) => acc + b.total, 0);
  }, [hasCreditCardDebt, banksWithTotals]);

  const totalOpenInvoicesAmount = useMemo(() => {
    if (!hasCreditCardDebt) return 0;
    return banksWithTotals.reduce((acc, b) => acc + b.currentAmount, 0);
  }, [hasCreditCardDebt, banksWithTotals]);

  const totalAllInvoicesCount = useMemo(() => {
    if (!hasCreditCardDebt) return 0;
    return banksWithTotals.reduce((acc, b) => acc + b.invoices.length, 0);
  }, [hasCreditCardDebt, banksWithTotals]);

  const netStartingBalance = initialCashNum - totalAllDebt;

  // Bancos que possuem fatura aberta no mês atual (elegíveis para destrinchamento na Etapa 2)
  const banksWithOpenInvoices = useMemo(() => {
    return banksWithTotals.filter((b) => b.currentAmount > 0);
  }, [banksWithTotals]);

  // Transição para Etapa 2 (Inicializa linhas se necessário)
  const handleProceedToStep2 = () => {
    const updatedBreakdowns = { ...breakdownsByBank };

    banksWithOpenInvoices.forEach((b) => {
      if (!updatedBreakdowns[b.id] || updatedBreakdowns[b.id].length === 0) {
        // Inicializa com uma primeira linha vazia para facilitar a digitação
        updatedBreakdowns[b.id] = [
          {
            id: `row_${Date.now()}_${b.id}_0`,
            natureId: '',
            natureName: '',
            description: '',
            amountInput: '',
          },
        ];
      }
    });

    setBreakdownsByBank(updatedBreakdowns);
    setStep(2);
  };

  // Manipulação de Linhas de Detalhamento na Etapa 2
  const handleAddBreakdownRow = (bankId: string) => {
    setBreakdownsByBank((prev) => ({
      ...prev,
      [bankId]: [
        ...(prev[bankId] || []),
        {
          id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          natureId: '',
          natureName: '',
          description: '',
          amountInput: '',
        },
      ],
    }));
  };

  const handleRemoveBreakdownRow = (bankId: string, rowId: string) => {
    setBreakdownsByBank((prev) => ({
      ...prev,
      [bankId]: (prev[bankId] || []).filter((r) => r.id !== rowId),
    }));
  };

  const handleBreakdownNatureChange = (bankId: string, rowId: string, natureId: string) => {
    const selectedNat = natures.find((n) => n.id === natureId);
    const natureName = natureId === 'OUTROS' ? 'Outros' : selectedNat?.name || '';

    setBreakdownsByBank((prev) => ({
      ...prev,
      [bankId]: (prev[bankId] || []).map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          natureId,
          natureName,
          mappingId: undefined,
          mappingItemId: undefined,
          description: r.description || (natureId === 'OUTROS' ? 'Gastos diversos' : `${selectedNat?.name || ''}`),
        };
      }),
    }));
  };

  const handleBreakdownMappingItemChange = (
    bankId: string,
    rowId: string,
    combinedValue: string // formato: `${mappingId}:::${itemId}`
  ) => {
    setBreakdownsByBank((prev) => ({
      ...prev,
      [bankId]: (prev[bankId] || []).map((r) => {
        if (r.id !== rowId) return r;
        if (!combinedValue) {
          return { ...r, mappingId: undefined, mappingItemId: undefined };
        }
        const [mappingId, mappingItemId] = combinedValue.split(':::');
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
      }),
    }));
  };

  const handleBreakdownDescriptionChange = (bankId: string, rowId: string, description: string) => {
    setBreakdownsByBank((prev) => ({
      ...prev,
      [bankId]: (prev[bankId] || []).map((r) => (r.id === rowId ? { ...r, description } : r)),
    }));
  };

  const handleBreakdownAmountChange = (bankId: string, rowId: string, amountInput: string) => {
    setBreakdownsByBank((prev) => ({
      ...prev,
      [bankId]: (prev[bankId] || []).map((r) => (r.id === rowId ? { ...r, amountInput } : r)),
    }));
  };

  // Atalho: Classificar o saldo restante da fatura como "Outros"
  const handleAllocateRestToOutros = (bankId: string, unanalyzedVal: number) => {
    if (unanalyzedVal <= 0) return;
    setBreakdownsByBank((prev) => ({
      ...prev,
      [bankId]: [
        ...(prev[bankId] || []),
        {
          id: `row_outros_${Date.now()}`,
          natureId: 'OUTROS',
          natureName: 'Outros',
          description: 'Gastos diversos sem natureza específica',
          amountInput: String(unanalyzedVal),
        },
      ],
    }));
  };

  // Helper para obter itens de mapeamento para uma natureza
  const getMappingItemsForNature = (natId: string) => {
    const nat = natures.find((n) => n.id === natId);
    if (!nat) return [];
    const list: Array<{
      id: string;
      mappingId: string;
      mappingName: string;
      mappingIcon?: string;
      description: string;
      totalValue: number;
    }> = [];

    (nat.mappings || []).forEach((m) => {
      (m.items || []).forEach((it) => {
        list.push({
          id: it.id,
          mappingId: m.id,
          mappingName: m.name,
          mappingIcon: m.icon || '📋',
          description: it.description,
          totalValue: it.totalValue,
        });
      });
    });
    return list;
  };

  // Conclusão e Gravação do Checkpoint
  const handleExecuteSave = () => {
    const balanceNum = initialCashNum;

    // Constrói os validBankDebts já com os breakdowns e unanalyzedAmount de cada banco
    const validBankDebts: CheckpointBankDebt[] = banksWithTotals
      .filter((b) => b.total > 0)
      .map((b) => {
        const rows = breakdownsByBank[b.id] || [];
        const allocatedItems: InvoiceNatureItemBreakdown[] = rows
          .filter((r) => parseBRLNumber(r.amountInput) > 0)
          .map((r) => ({
            id: r.id,
            natureId: r.natureId === 'OUTROS' ? undefined : r.natureId,
            natureName: r.natureName || (r.natureId === 'OUTROS' ? 'Outros' : 'Não Analisada'),
            mappingId: r.mappingId,
            mappingItemId: r.mappingItemId,
            description: r.description || r.natureName || 'Fatura de Cartão',
            amount: parseBRLNumber(r.amountInput),
            isAnalyzed: !!r.natureId,
          }));

        const allocatedSum = allocatedItems.reduce((acc, it) => acc + it.amount, 0);
        const unanalyzedAmount = Math.max(0, Math.round((b.currentAmount - allocatedSum) * 100) / 100);

        return {
          id: b.id,
          cardId: b.cardId,
          bankName: b.bankName,
          cardName: b.cardName,
          dueDay: b.dueDay,
          totalDebt: b.total,
          invoices: b.invoices
            .filter((inv) => parseBRLNumber(inv.amountInput) > 0)
            .map((inv) => {
              const isCurrent = inv.monthIndex === 0;
              return {
                monthIndex: inv.monthIndex,
                monthLabel: inv.monthLabel,
                dueDate: inv.dueDate,
                amount: parseBRLNumber(inv.amountInput),
                breakdown: isCurrent && allocatedItems.length > 0 ? allocatedItems : undefined,
                unanalyzedAmount: isCurrent && b.currentAmount > 0 ? unanalyzedAmount : undefined,
              };
            }),
        };
      });

    // Retrocompatibilidade
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

    // 1. Marcar itens de mapeamento das naturezas como atendidos se vinculados no detalhamento
    const itemsToFulfill: Array<{ natureId: string; mappingId: string; itemId: string; realizedValue?: number }> = [];
    Object.values(breakdownsByBank).forEach((rows) => {
      rows.forEach((r) => {
        if (r.natureId && r.natureId !== 'OUTROS' && r.mappingId && r.mappingItemId) {
          itemsToFulfill.push({
            natureId: r.natureId,
            mappingId: r.mappingId,
            itemId: r.mappingItemId,
            realizedValue: parseBRLNumber(r.amountInput),
          });
        }
      });
    });

    if (itemsToFulfill.length > 0) {
      markMappingItemsFulfilled(itemsToFulfill);
    }

    // 2. Lançar as movimentações categorizadas no fluxo de caixa
    if (hasCreditCardDebt && totalAllDebt > 0 && launchAsMovement) {
      validBankDebts.forEach((b) => {
        const installmentGroupId = `card_debt_${b.id}_${Date.now()}`;
        const totalInvs = b.invoices.length;

        b.invoices.forEach((inv, index) => {
          const instNum = index + 1;
          const isCurrent = inv.monthIndex === 0;

          if (isCurrent && inv.breakdown && inv.breakdown.length > 0) {
            // Lança cada item categorizado
            inv.breakdown.forEach((item) => {
              addMovement({
                title: `Fatura ${b.cardName} — ${item.description || item.natureName}`,
                type: 'CARTAO',
                amount: item.amount,
                dueDate: inv.dueDate,
                bank: b.bankName || 'Cartão de Crédito',
                status: 'PREVISTA',
                category: item.natureName,
                notes: `Item conciliado no Ponto de Partida (${startDate}) — ${item.description}`,
              });
            });

            // Se houver saldo não analisado, lança explicitamente como "Não Analisada"
            if (inv.unanalyzedAmount && inv.unanalyzedAmount > 0) {
              addMovement({
                title: `Fatura ${b.cardName} (Não Analisada)`,
                type: 'CARTAO',
                amount: inv.unanalyzedAmount,
                dueDate: inv.dueDate,
                bank: b.bankName || 'Cartão de Crédito',
                status: 'PREVISTA',
                category: 'Não Analisada',
                notes: `Diferença de fatura em aberto pendente de análise no Ponto de Partida (${startDate})`,
              });
            }
          } else {
            const existingSimilar = movements.find(
              (m) =>
                m.type === 'CARTAO' &&
                m.status === 'PREVISTA' &&
                (m.bank || '').toLowerCase() === (b.bankName || '').toLowerCase() &&
                m.dueDate === inv.dueDate
            );

            if (existingSimilar) {
              updateMovement(existingSimilar.id, {
                amount: inv.amount,
                title: isCurrent
                  ? `Fatura ${b.cardName} (Atual — Não Analisada)`
                  : `Fatura ${b.cardName} (${inv.monthLabel.split(' ')[0]})`,
                category: isCurrent ? 'Não Analisada' : 'Fatura de Cartão',
                notes: `Fatura atualizada no Ponto de Partida (${startDate}) - ${inv.monthLabel}`,
              });
            } else {
              // Fatura futura ou fatura atual sem detalhamento prévio
              addMovement({
                title: isCurrent
                  ? `Fatura ${b.cardName} (Atual — Não Analisada)`
                  : `Fatura ${b.cardName} (${inv.monthLabel.split(' ')[0]})`,
                type: 'CARTAO',
                amount: inv.amount,
                dueDate: inv.dueDate,
                bank: b.bankName || 'Cartão de Crédito',
                status: 'PREVISTA',
                category: isCurrent ? 'Não Analisada' : 'Fatura de Cartão',
                installmentNumber: instNum,
                installmentsTotal: totalInvs,
                installmentGroupId,
                notes: `Fatura cadastrada no Ponto de Partida (${startDate}) - ${inv.monthLabel}`,
              });
            }
          }
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
      title={
        step === 1
          ? isInitialSetup
            ? '🎯 Definir Ponto de Partida'
            : '🚩 Novo Marco de Acompanhamento'
          : '🧩 Detalhar Faturas em Aberto por Natureza'
      }
      subtitle={
        step === 1
          ? isInitialSetup
            ? 'Defina a data, saldo em caixa e faturas atuais e futuras de cada banco para calibrar suas métricas.'
            : 'Inicie uma nova fase de acompanhamento com faturas de cada banco organizadas.'
          : 'Etapa 2 de 2: Correlacione os gastos da fatura com suas naturezas para reconhecer itens já atendidos no mês.'
      }
      maxWidth={step === 1 ? '640px' : '720px'}
    >
      {/* ========================================================================= */}
      {/* ETAPA 1: PONTO DE PARTIDA, SALDO E FATURAS DOS BANCOS                     */}
      {/* ========================================================================= */}
      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (hasCreditCardDebt && totalOpenInvoicesAmount > 0) {
              handleProceedToStep2();
            } else {
              handleExecuteSave();
            }
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
        >
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
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.2rem', display: 'block' }}>
              Apenas transações a partir desta data influenciarão o saldo em caixa e fluxo do dashboard.
            </span>
          </div>

          {/* Campo 2: Saldo Inicial em Caixa */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.84rem', marginBottom: '0.3rem' }}>
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
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.2rem', display: 'block' }}>
              Valor real disponível em contas e carteira no dia inicial escolhido.
            </span>
          </div>

          {/* SEÇÃO: Faturas Atuais e Futuras por Banco */}
          <div
            style={{
              borderRadius: '12px',
              border: `1px solid ${hasCreditCardDebt ? 'rgba(244, 63, 94, 0.35)' : 'var(--border-default)'}`,
              background: hasCreditCardDebt ? 'rgba(244, 63, 94, 0.04)' : 'var(--bg-card)',
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
                    background: hasCreditCardDebt ? 'rgba(244, 63, 94, 0.15)' : 'rgba(56, 189, 248, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: hasCreditCardDebt ? 'var(--accent-rose)' : 'var(--text-secondary)',
                  }}
                >
                  <CreditCard size={17} />
                </div>
                <div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                    Estabelecer Faturas Atuais e Futuras por Banco
                  </span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
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
                  const futureInvoices = b.invoices.filter((inv) => inv.id !== currentInvoice?.id);

                  return (
                    <div
                      key={b.id}
                      style={{
                        borderRadius: '10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-default)',
                        padding: '0.75rem 0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {/* Topo do Card do Banco */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
                          <Building2 size={15} className="text-cyan" style={{ flexShrink: 0 }} />
                          <select
                            className="form-input"
                            style={{ fontSize: '0.82rem', fontWeight: 600, padding: '4px 8px', flex: 1 }}
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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              Dia Venc.:
                            </span>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={b.dueDay}
                              onChange={(e) => handleDueDayChange(b.id, parseInt(e.target.value, 10))}
                              className="form-input"
                              style={{ width: '50px', padding: '3px 6px', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}
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

                      {/* Se for personalizado */}
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
                            style={{ fontSize: '0.8rem', padding: '4px 8px' }}
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
                            style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                          />
                        </div>
                      )}

                      {/* 1. Bloco de FATURA ATUAL */}
                      {currentInvoice && (
                        <div
                          style={{
                            padding: '0.65rem 0.75rem',
                            borderRadius: '8px',
                            background: 'rgba(244, 63, 94, 0.08)',
                            border: '1px solid rgba(244, 63, 94, 0.3)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                            <div>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span>📌</span> Fatura Aberta — {currentInvoice.monthLabel}
                              </span>
                              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                                Gastos realizados no mês atual que serão pagos na fatura com vencimento no mês seguinte.
                              </p>
                            </div>
                            <span style={{ fontSize: '0.74rem', color: 'var(--accent-rose)', background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.25)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
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
                                  color: 'var(--accent-rose)',
                                  fontSize: '0.88rem',
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
                                  color: 'var(--accent-rose)',
                                  fontSize: '0.98rem',
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
                              style={{ width: '130px', fontSize: '0.8rem', padding: '4px 8px' }}
                              title="Data de vencimento da fatura no mês seguinte"
                            />
                          </div>
                        </div>
                      )}

                      {/* 2. Bloco de FATURAS FUTURAS */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.15rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CalendarDays size={13} className="text-cyan" />
                            Faturas Futuras ({futureInvoices.length} {futureInvoices.length === 1 ? 'mês' : 'meses'} adicionais)
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-xs text-cyan"
                              style={{ fontSize: '0.72rem', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '3px' }}
                              onClick={() => handleAddFutureInvoice(b.id)}
                              title="Adicionar próximo mês de fatura futura"
                            >
                              <Plus size={11} />
                              <span>Adicionar Mês Futuro</span>
                            </button>

                            <button
                              type="button"
                              className="btn btn-ghost btn-xs text-amber"
                              style={{ fontSize: '0.7rem', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '3px' }}
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

                        {/* Painel expansível de divisão rápida */}
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
                              fontSize: '0.74rem',
                            }}
                          >
                            <span style={{ fontWeight: 700, color: '#f59e0b' }}>
                              ⚡ Gerador Rápido de Parcelas Iguais:
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <div style={{ position: 'relative', width: '130px' }}>
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: '#f59e0b', fontSize: '0.75rem' }}>
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
                                  style={{ paddingLeft: '28px', fontSize: '0.78rem', padding: '3px 6px' }}
                                />
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>em</span>
                                <select
                                  className="form-input"
                                  style={{ fontSize: '0.78rem', padding: '3px 6px', width: '70px' }}
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
                                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                                onClick={() => handleApplyQuickDivide(b.id)}
                              >
                                Distribuir
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs text-muted"
                                style={{ fontSize: '0.72rem' }}
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
                              background: 'var(--bg-app)',
                              border: '1px dashed var(--border-default)',
                              fontSize: '0.74rem',
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>Nenhuma fatura futura adicionada para este banco.</span>
                            <button
                              type="button"
                              className="btn btn-link btn-xs text-cyan"
                              style={{ fontSize: '0.72rem', padding: 0 }}
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
                                  background: 'var(--bg-app)',
                                  border: '1px solid var(--border-default)',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '0.74rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    width: '145px',
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
                                      fontWeight: 700,
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
                                      fontWeight: 700,
                                      color: 'var(--accent-cyan)',
                                      fontSize: '0.85rem',
                                      padding: '3px 8px 3px 26px',
                                    }}
                                    placeholder="0,00"
                                    value={inv.amountInput}
                                    onFocus={(e) => {
                                      if (e.target.value === '0') handleInvoiceAmountChange(b.id, currentInvoice.id, '');
                                    }}
                                    onChange={(e) => handleInvoiceAmountChange(b.id, inv.id, e.target.value)}
                                  />
                                </div>

                                <input
                                  type="date"
                                  value={inv.dueDate}
                                  onChange={(e) => handleInvoiceDueDateChange(b.id, inv.id, e.target.value)}
                                  className="form-input"
                                  style={{ width: '120px', fontSize: '0.74rem', padding: '3px 5px' }}
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
                          paddingTop: '0.4rem',
                          borderTop: '1px solid var(--border-subtle)',
                          fontSize: '0.76rem',
                        }}
                      >
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                          Subtotal {b.cardName}:{' '}
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                            Atual ({b.currentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) + Futuras ({b.futureTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                          </span>
                        </span>
                        <strong style={{ color: 'var(--accent-rose)', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.85rem' }}>
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
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    color: 'var(--accent-cyan)',
                    borderColor: 'var(--accent-cyan)',
                  }}
                  onClick={handleAddBankDebt}
                >
                  <Plus size={14} />
                  <span>Adicionar Outro Banco / Cartão</span>
                </button>

                {/* Card Consolidado Geral de Todas as Faturas */}
                <div
                  style={{
                    padding: '0.7rem 0.9rem',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.1) 0%, var(--bg-card-hover) 100%)',
                    border: '1px solid rgba(244, 63, 94, 0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    fontSize: '0.78rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      Dívida Total Consolidada ({bankDebts.length} {bankDebts.length === 1 ? 'banco' : 'bancos'}, {totalAllInvoicesCount} faturas):
                    </span>
                    <strong style={{ color: 'var(--accent-rose)', fontWeight: 800, fontSize: '0.95rem' }}>
                      {totalAllDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Patrimônio Líquido Inicial (Caixa - Dívida Total):
                    </span>
                    <span style={{ fontWeight: 800, color: netStartingBalance >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                      {netStartingBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>

                {/* Checkbox de agendamento das faturas no fluxo */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-primary)' }}>
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

          {/* Botões do Rodapé na Etapa 1 */}
          <div
            className="modal-footer-actions"
            style={{
              position: 'sticky',
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.96)',
              backdropFilter: 'blur(10px)',
              marginTop: '0.65rem',
              paddingTop: '0.75rem',
              paddingBottom: '0.25rem',
              borderTop: '1px solid var(--border-default)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.65rem',
              zIndex: 10,
            }}
          >
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {hasCreditCardDebt && totalOpenInvoicesAmount > 0 ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline text-amber"
                    style={{ fontSize: '0.78rem' }}
                    onClick={handleExecuteSave}
                    title="Salvar o Ponto de Partida agora mantendo o valor da fatura como Não Analisada"
                  >
                    Salvar sem Detalhar
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <span>Avançar: Detalhar Faturas</span>
                    <ArrowRight size={15} />
                  </button>
                </>
              ) : (
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
              )}
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 2: DETALHAMENTO DAS FATURAS EM ABERTO POR NATUREZA                  */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Banner de instrução da Etapa 2 */}
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              fontSize: '0.78rem',
              color: 'var(--text-primary)',
              display: 'flex',
              gap: '0.65rem',
              alignItems: 'flex-start',
            }}
          >
            <Sparkles size={16} className="text-cyan" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--accent-cyan)' }}>Conciliação de Gastos em Aberto:</strong>
              <p style={{ margin: '0.15rem 0 0', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: '1.35', fontSize: '0.76rem' }}>
                As faturas em aberto já cobriram itens das suas naturezas neste mês. Destrinche cada valor abaixo. Tudo o que não for correlacionado pode ser chamado de <strong>"Outros"</strong>, e qualquer diferença restante constará como <strong>"Não Analisada"</strong> até que você a defina.
              </p>
            </div>
          </div>

          {/* Lista de Bancos com Fatura Aberta para Detalhar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '58vh', overflowY: 'auto', paddingRight: '4px' }}>
            {banksWithOpenInvoices.map((b) => {
              const rows = breakdownsByBank[b.id] || [];
              const totalAllocatedInNatures = rows
                .filter((r) => r.natureId && r.natureId !== 'OUTROS')
                .reduce((sum, r) => sum + parseBRLNumber(r.amountInput), 0);
              const totalAllocatedInOutros = rows
                .filter((r) => r.natureId === 'OUTROS')
                .reduce((sum, r) => sum + parseBRLNumber(r.amountInput), 0);
              const totalAllocated = totalAllocatedInNatures + totalAllocatedInOutros;
              const unanalyzedAmount = Math.max(0, Math.round((b.currentAmount - totalAllocated) * 100) / 100);
              const isOver = totalAllocated > b.currentAmount;

              return (
                <div
                  key={b.id}
                  style={{
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {/* Cabeçalho da Fatura do Banco */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CreditCard size={17} className="text-cyan" />
                      <div>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {b.cardName} ({b.bankName})
                        </strong>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'block' }}>
                          Vencimento: {b.currentInvoice?.dueDate.split('-').reverse().join('/')}
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>
                        Valor Total da Fatura em Aberto:
                      </span>
                      <strong className="text-rose-400 font-mono" style={{ fontSize: '1rem', color: 'var(--accent-rose)' }}>
                        {b.currentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>
                  </div>

                  {/* Status Visual da Análise da Fatura */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: '6px',
                      fontSize: '0.72rem',
                    }}
                  >
                    <div style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'block', fontSize: '0.68rem' }}>Em Naturezas:</span>
                      <strong className="text-emerald-400 font-mono" style={{ color: 'var(--accent-emerald)' }}>
                        {totalAllocatedInNatures.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>

                    <div style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'block', fontSize: '0.68rem' }}>Em "Outros":</span>
                      <strong className="text-cyan font-mono" style={{ color: 'var(--accent-cyan)' }}>
                        {totalAllocatedInOutros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: unanalyzedAmount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                        border: unanalyzedAmount > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-default)',
                      }}
                    >
                      <span style={{ color: unanalyzedAmount > 0 ? '#d97706' : 'var(--text-secondary)', display: 'block', fontSize: '0.68rem', fontWeight: 700 }}>
                        {unanalyzedAmount > 0 ? '⚠️ Não Analisada:' : 'Não Analisada:'}
                      </span>
                      <strong style={{ color: unanalyzedAmount > 0 ? 'var(--accent-amber)' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {unanalyzedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>
                  </div>

                  {/* Alerta se o usuário ultrapassar o total da fatura */}
                  {isOver && (
                    <div style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(244, 63, 94, 0.15)', color: '#fca5a5', fontSize: '0.72rem' }}>
                      ⚠️ O total detalhado ultrapassou a fatura em {(totalAllocated - b.currentAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.
                    </div>
                  )}

                  {/* Lista de Linhas Detalhadas para este Banco */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Gastos e Naturezas Atendidas nesta Fatura ({rows.length} {rows.length === 1 ? 'item' : 'itens'}):
                    </span>

                    {rows.length === 0 ? (
                      <div
                        style={{
                          padding: '0.6rem',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px dashed rgba(255, 255, 255, 0.1)',
                          textAlign: 'center',
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Nenhum item destrinchado ainda. Clique abaixo para correlacionar itens com suas naturezas.
                      </div>
                    ) : (
                      rows.map((row) => {
                        const availableMappingItems = row.natureId && row.natureId !== 'OUTROS' ? getMappingItemsForNature(row.natureId) : [];
                        const combinedMappingValue = row.mappingId && row.mappingItemId ? `${row.mappingId}:::${row.mappingItemId}` : '';

                        return (
                          <div
                            key={row.id}
                            style={{
                              padding: '0.55rem 0.65rem',
                              borderRadius: '8px',
                              background: 'var(--bg-app)',
                              border: '1px solid var(--border-default)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.4rem',
                            }}
                          >
                            {/* Linha 1: Seletor de Natureza e Item de Mapeamento */}
                            <div style={{ display: 'grid', gridTemplateColumns: availableMappingItems.length > 0 ? '1fr 1.2fr auto' : '1fr auto', gap: '6px', alignItems: 'center' }}>
                              {/* Seletor de Natureza */}
                              <select
                                className="form-input"
                                style={{ fontSize: '0.78rem', fontWeight: 600, padding: '4px 6px' }}
                                value={row.natureId}
                                onChange={(e) => handleBreakdownNatureChange(b.id, row.id, e.target.value)}
                              >
                                <option value="">-- Selecione a Natureza --</option>
                                {natures.map((nat) => (
                                  <option key={nat.id} value={nat.id}>
                                    {nat.icon || '🏷️'} {nat.name}
                                  </option>
                                ))}
                                <option value="OUTROS">📦 Outros (Sem Natureza Específica)</option>
                              </select>

                              {/* Seletor de Item de Mapeamento (se a natureza possuir itens cadastrados) */}
                              {availableMappingItems.length > 0 && (
                                <select
                                  className="form-input"
                                  style={{ fontSize: '0.78rem', padding: '4px 6px' }}
                                  value={combinedMappingValue}
                                  onChange={(e) => handleBreakdownMappingItemChange(b.id, row.id, e.target.value)}
                                >
                                  <option value="">(Geral da Natureza — Sem dar baixa em item específico)</option>
                                  {availableMappingItems.map((item) => (
                                    <option key={`${item.mappingId}:::${item.id}`} value={`${item.mappingId}:::${item.id}`}>
                                      {item.mappingIcon || '📋'} {item.description} ({item.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                                    </option>
                                  ))}
                                </select>
                              )}

                              {/* Botão Remover Linha */}
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs text-rose"
                                style={{ padding: '3px 6px' }}
                                onClick={() => handleRemoveBreakdownRow(b.id, row.id)}
                                title="Remover item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            {/* Linha 2: Descrição e Valor R$ */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '6px' }}>
                              <input
                                type="text"
                                className="form-input"
                                style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                                placeholder="Descrição do gasto (ex: Compras de Mercado, Farmácia...)"
                                value={row.description}
                                onChange={(e) => handleBreakdownDescriptionChange(b.id, row.id, e.target.value)}
                              />

                              <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--accent-emerald)', fontSize: '0.78rem' }}>
                                  R$
                                </span>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{
                                    paddingLeft: '28px',
                                    fontWeight: 700,
                                    color: 'var(--accent-emerald)',
                                    fontSize: '0.85rem',
                                    padding: '4px 6px 4px 26px',
                                  }}
                                  placeholder="0,00"
                                  value={row.amountInput}
                                  onChange={(e) => handleBreakdownAmountChange(b.id, row.id, e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Botões de Ação para o Banco */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', paddingTop: '0.35rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs text-cyan"
                      style={{ fontSize: '0.74rem', fontWeight: 600, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => handleAddBreakdownRow(b.id)}
                    >
                      <Plus size={12} />
                      <span>Adicionar Item / Natureza</span>
                    </button>

                    {unanalyzedAmount > 0 && (
                      <button
                        type="button"
                        className="btn btn-outline btn-xs text-amber"
                        style={{ fontSize: '0.74rem', fontWeight: 600, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                        onClick={() => handleAllocateRestToOutros(b.id, unanalyzedAmount)}
                        title="Criar uma linha 'Outros' com todo o valor restante não analisado"
                      >
                        <Sparkles size={12} />
                        <span>Classificar restante ({unanalyzedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) como "Outros"</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rodapé da Etapa 2 */}
          <div
            className="modal-footer-actions"
            style={{
              position: 'sticky',
              bottom: 0,
              background: 'var(--bg-sidebar)',
              backdropFilter: 'blur(10px)',
              marginTop: '0.65rem',
              paddingTop: '0.75rem',
              paddingBottom: '0.25rem',
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
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
              onClick={() => setStep(1)}
            >
              <ArrowLeft size={14} />
              <span>Voltar para Etapa 1</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={handleExecuteSave}
              disabled={savedSuccess}
            >
              {savedSuccess ? (
                <>
                  <CheckCircle size={15} />
                  <span>Salvo com Sucesso!</span>
                </>
              ) : (
                <>
                  <CheckCircle size={15} />
                  <span>Concluir e Salvar Ponto de Partida</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

