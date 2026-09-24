import React, { useState, useEffect, useMemo } from 'react';
import { useFinancial, buildSuggestedMappingsForNature } from '../context/FinancialContext';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/supabaseService';
import { auditOnboardingProgress } from '../utils/onboardingProgress';
import {
  Sparkles,
  Flag,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  X,
  Building2,
  DollarSign,
  Calendar,
  Plus,
  Trash2,
  BookOpen,
  ListChecks,
  Layers,
  Briefcase,
  Check,
  Star,
} from 'lucide-react';
import type { SalaryContractType } from '../types';
import { getBankBranding, POPULAR_BANKS } from '../utils/bankBranding';

interface GetStartedOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: number; // 1 = Ponto de Partida, 2 = Faturas, 3 = Naturezas & Mapeamentos
  onComplete?: () => void;
}

// Naturezas recomendadas com ícones, cores, tetos padrão e rotinas de mapeamentos sugeridas
const DEFAULT_RECOMMENDED_NATURES = [
  {
    id: 'nat_alimentacao',
    name: 'Alimentação & Supermercado',
    icon: '🍽️',
    color: '#10b981', // emerald
    suggestedCeiling: 1800,
    type: 'ESSENCIAL' as const,
    description: 'Compras de supermercado, feira, açougue e refeições diárias',
    sampleMappings: ['🛒 Supermercado Mensal', '🥦 Feira Semanal', '🥩 Açougue Quinzenal'],
    keywords: ['mercado', 'supermercado', 'feira', 'hortifruti', 'acougue', 'padaria', 'ifood', 'compras'],
  },
  {
    id: 'nat_moradia',
    name: 'Moradia & Contas Fixas',
    icon: '🏠',
    color: '#06b6d4', // cyan
    suggestedCeiling: 2200,
    type: 'FIXA' as const,
    description: 'Aluguel/condomínio, energia, água, internet e serviços essenciais',
    sampleMappings: ['💡 Contas Fixas (Energia, Água, Net)', '🏢 Condomínio/Aluguel'],
    keywords: ['aluguel', 'condominio', 'luz', 'energia', 'agua', 'gas', 'internet', 'sabesp', 'enel'],
  },
  {
    id: 'nat_transporte',
    name: 'Transporte & Mobilidade',
    icon: '🚗',
    color: '#f59e0b', // amber
    suggestedCeiling: 650,
    type: 'VARIAVEL' as const,
    description: 'Combustível, aplicativos (Uber/99), estacionamento e manutenção',
    sampleMappings: ['⛽ Combustível Mensal', '📱 Apps (Uber/99)'],
    keywords: ['posto', 'gasolina', 'etanol', 'combustivel', 'ipiranga', 'shell', 'uber', '99', 'sem parar', 'pedagio'],
  },
  {
    id: 'nat_saude',
    name: 'Saúde & Cuidados',
    icon: '💊',
    color: '#8b5cf6', // purple
    suggestedCeiling: 450,
    type: 'ESSENCIAL' as const,
    description: 'Farmácia, consultas, exames, plano de saúde e bem-estar',
    sampleMappings: ['💊 Farmácia Mensal', '🩺 Consultas & Exames'],
    keywords: ['farmacia', 'drogaria', 'remedio', 'medico', 'consulta', 'exame', 'laboratorio', 'drogasil', 'droga raia', 'plano de saude'],
  },
  {
    id: 'nat_lazer',
    name: 'Lazer & Estilo de Vida',
    icon: '🎉',
    color: '#ec4899', // pink
    suggestedCeiling: 600,
    type: 'VARIAVEL' as const,
    description: 'Restaurantes, saídas, streaming, delivery e passeios',
    sampleMappings: ['🎬 Streaming & Assinaturas', '🍽️ Restaurantes & Delivery'],
    keywords: ['restaurante', 'bar', 'cinema', 'streaming', 'netflix', 'spotify', 'ifood', 'lazer', 'viagem'],
  },
];

export const GetStartedOnboarding: React.FC<GetStartedOnboardingProps> = ({
  isOpen,
  onClose,
  initialStep = 1,
  onComplete,
}) => {
  const { user } = useAuth();
  const {
    addCheckpoint,
    addAccount,
    addCard,
    addMovement,
    addNature,
    addBank,
    banks,
    accounts,
    natures,
    activeCheckpoint,
    addSalaryContract,
    updateSalaryContract,
    salaryContracts,
    movements,
    cards,
  } = useFinancial();

  const [currentStep, setCurrentStep] = useState<number>(initialStep);

  // Auditoria dos 5 pilares do Get Started
  const onboardingAudit = useMemo(
    () =>
      auditOnboardingProgress({
        activeCheckpoint,
        salaryContracts,
        movements,
        cards,
        accounts,
        banks,
        natures,
      }),
    [activeCheckpoint, salaryContracts, movements, cards, accounts, banks, natures]
  );

  // -------------------------------------------------------------
  // PASSO 1: Ponto de Partida & Configuração de Salário
  // -------------------------------------------------------------
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfMonthStr = `${todayStr.substring(0, 7)}-01`;

  const [startDate, setStartDate] = useState(
    activeCheckpoint?.startDate || firstDayOfMonthStr
  );
  const [initialBalance, setInitialBalance] = useState<string>(
    activeCheckpoint ? String(activeCheckpoint.initialBalance) : '0'
  );
  const [mainBankName, setMainBankName] = useState<string>('Nubank');

  // Estados de Bancos & Contas selecionados pelo usuário no Get Started
  const [selectedBanks, setSelectedBanks] = useState<
    Array<{ id: string; name: string; isMain: boolean; balanceInput: string }>
  >(() => {
    if (banks && banks.length > 0) {
      return banks.map((b, i) => ({
        id: b.id || `bank_${i}`,
        name: b.name,
        isMain: i === 0,
        balanceInput: '',
      }));
    }
    return [
      { id: 'bank_nu', name: 'Nubank', isMain: true, balanceInput: '' },
      { id: 'bank_inter', name: 'Banco Inter', isMain: false, balanceInput: '' },
    ];
  });
  const [customBankInput, setCustomBankInput] = useState('');
  const [showAddCustomBank, setShowAddCustomBank] = useState(false);
  const [salaryReceivingBank, setSalaryReceivingBank] = useState<string>('Nubank');

  // Estados de Salário / Remuneração Principal
  const [hasSalary, setHasSalary] = useState<boolean>(true);
  const [salaryAmount, setSalaryAmount] = useState<string>('');
  const [salaryEmployer, setSalaryEmployer] = useState<string>('Empresa / Empregador Principal');
  const [salaryRole, setSalaryRole] = useState<string>('Remuneração Principal');
  const [salaryPayDay, setSalaryPayDay] = useState<number>(5);
  const [salaryContractType, setSalaryContractType] = useState<SalaryContractType>('CLT');

  // Sincroniza passo e pre-carrega dados salvos quando o usuário abre ou refaz o Get Started
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(initialStep || 1);

      if (activeCheckpoint) {
        if (activeCheckpoint.startDate) setStartDate(activeCheckpoint.startDate);
        if (activeCheckpoint.initialBalance !== undefined) {
          setInitialBalance(String(activeCheckpoint.initialBalance));
        }

        if (activeCheckpoint.cardDebts && activeCheckpoint.cardDebts.length > 0) {
          const cd1 = activeCheckpoint.cardDebts[0];
          if (cd1.cardName) setCardName(cd1.cardName);
          if (cd1.bankName) setCardBank(cd1.bankName);
          if (cd1.dueDay) setCardDueDay(cd1.dueDay);

          const nextInv = (cd1.invoices || []).find((inv) => inv.monthIndex === 1);
          if (nextInv) setCurrentInvoiceAmount(String(nextInv.amount));

          if (activeCheckpoint.cardDebts.length > 1) {
            const cd2 = activeCheckpoint.cardDebts[1];
            setHasSecondCard(true);
            if (cd2.cardName) setSecondCardName(cd2.cardName);
            if (cd2.bankName) setSecondCardBank(cd2.bankName);
            if (cd2.dueDay) setSecondCardDueDay(cd2.dueDay);

            const nextInv2 = (cd2.invoices || []).find((inv) => inv.monthIndex === 1);
            if (nextInv2) setSecondCurrentInvoice(String(nextInv2.amount));
          }
        }
      }

      if (salaryContracts && salaryContracts.length > 0) {
        const prim = salaryContracts.find((s) => s.isActive) || salaryContracts[0];
        setHasSalary(true);
        if (prim.employer) setSalaryEmployer(prim.employer);
        if (prim.role) setSalaryRole(prim.role);
        if (prim.contractType) setSalaryContractType(prim.contractType);
        if (prim.paymentDay) setSalaryPayDay(prim.paymentDay);
        const salVal = prim.currentNetAmount || prim.currentGrossAmount;
        if (salVal) setSalaryAmount(String(salVal));
        if (prim.receivingBankName) {
          setMainBankName(prim.receivingBankName);
          setSalaryReceivingBank(prim.receivingBankName);
        }
      }

      if (banks && banks.length > 0) {
        setSelectedBanks(
          banks.map((b, i) => ({
            id: b.id || `bank_${i}`,
            name: b.name,
            isMain: i === 0,
            balanceInput: '',
          }))
        );
      }
    }
  }, [isOpen, initialStep, activeCheckpoint, salaryContracts, banks]);

  // Manipuladores de Seleção de Bancos
  const handleTogglePopularBank = (bankName: string) => {
    setSelectedBanks((prev) => {
      const exists = prev.some((b) => b.name.toLowerCase() === bankName.toLowerCase());
      if (exists) {
        if (prev.length <= 1) return prev; // Mantém ao menos 1 banco
        const filtered = prev.filter((b) => b.name.toLowerCase() !== bankName.toLowerCase());
        if (!filtered.some((b) => b.isMain) && filtered.length > 0) {
          filtered[0].isMain = true;
          setMainBankName(filtered[0].name);
          setSalaryReceivingBank(filtered[0].name);
        }
        return filtered;
      } else {
        const isFirst = prev.length === 0;
        const newBank = {
          id: `bank_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: bankName,
          isMain: isFirst,
          balanceInput: '',
        };
        if (isFirst) {
          setMainBankName(bankName);
          setSalaryReceivingBank(bankName);
        }
        return [...prev, newBank];
      }
    });
  };

  const handleAddCustomBank = () => {
    const trimmed = customBankInput.trim();
    if (!trimmed) return;
    const exists = selectedBanks.some((b) => b.name.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      const isFirst = selectedBanks.length === 0;
      const newBank = {
        id: `bank_custom_${Date.now()}`,
        name: trimmed,
        isMain: isFirst,
        balanceInput: '',
      };
      setSelectedBanks((prev) => [...prev, newBank]);
      if (isFirst) {
        setMainBankName(trimmed);
        setSalaryReceivingBank(trimmed);
      }
    }
    setCustomBankInput('');
    setShowAddCustomBank(false);
  };

  const handleSetMainBank = (bankName: string) => {
    setSelectedBanks((prev) =>
      prev.map((b) => ({
        ...b,
        isMain: b.name.toLowerCase() === bankName.toLowerCase(),
      }))
    );
    setMainBankName(bankName);
    setSalaryReceivingBank(bankName);
  };

  const handleRemoveBank = (bankName: string) => {
    if (selectedBanks.length <= 1) return;
    setSelectedBanks((prev) => {
      const filtered = prev.filter((b) => b.name.toLowerCase() !== bankName.toLowerCase());
      if (!filtered.some((b) => b.isMain) && filtered.length > 0) {
        filtered[0].isMain = true;
        setMainBankName(filtered[0].name);
        setSalaryReceivingBank(filtered[0].name);
      }
      return filtered;
    });
  };

  const handleBankBalanceChange = (bankName: string, val: string) => {
    setSelectedBanks((prev) => {
      const updated = prev.map((b) =>
        b.name.toLowerCase() === bankName.toLowerCase() ? { ...b, balanceInput: val } : b
      );
      const sum = updated.reduce((acc, b) => acc + parseNumber(b.balanceInput), 0);
      if (sum > 0) {
        setInitialBalance(sum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
      return updated;
    });
  };

  // -------------------------------------------------------------
  // PASSO 2: Faturas de Cartão em Aberto (Atual & Múltiplas Futuras por Banco)
  // -------------------------------------------------------------
  const [hasCards, setHasCards] = useState<boolean>(true);
  const [cardName, setCardName] = useState('Cartão Principal');
  const [cardBank, setCardBank] = useState('Nubank');
  const [cardDueDay, setCardDueDay] = useState(10);
  const [currentInvoiceAmount, setCurrentInvoiceAmount] = useState<string>('');

  // Cartão 2 Opcional
  const [hasSecondCard, setHasSecondCard] = useState<boolean>(false);
  const [secondCardName, setSecondCardName] = useState('Segundo Cartão');
  const [secondCardBank, setSecondCardBank] = useState('Inter');
  const [secondCardDueDay, setSecondCardDueDay] = useState(20);
  const [secondCurrentInvoice, setSecondCurrentInvoice] = useState<string>('');

  // Helpers de competência e vencimento
  const getMonthInfo = (baseDateStr: string, offset: number) => {
    try {
      const [y, m] = baseDateStr.split('-').map(Number);
      const targetDate = new Date(y, m - 1 + offset, 1);
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const fullMonths = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      return {
        short: `${months[targetDate.getMonth()]}/${targetDate.getFullYear()}`,
        full: `${fullMonths[targetDate.getMonth()]} de ${targetDate.getFullYear()}`,
        monthName: fullMonths[targetDate.getMonth()],
        year: targetDate.getFullYear(),
        month: targetDate.getMonth() + 1,
      };
    } catch {
      return { short: `Mês +${offset}`, full: `Mês +${offset}`, monthName: `Mês +${offset}`, year: 2026, month: 1 };
    }
  };

  const getMonthDueDate = (baseDateStr: string, offset: number, dueDay: number) => {
    try {
      const [y, m] = baseDateStr.split('-').map(Number);
      const targetDate = new Date(y, m - 1 + offset, 1);
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const safeDay = Math.min(Math.max(1, dueDay), 28);
      return `${year}-${month}-${String(safeDay).padStart(2, '0')}`;
    } catch {
      return `${baseDateStr.substring(0, 7)}-${String(dueDay).padStart(2, '0')}`;
    }
  };

  // (Faturas futuras removidas — simplificação: apenas fatura do mês seguinte)

  // -------------------------------------------------------------
  // PASSO 3: Naturezas & Tetos de Gastos
  // -------------------------------------------------------------
  const [selectedNatures, setSelectedNatures] = useState<
    Array<{
      id: string;
      name: string;
      icon: string;
      color: string;
      ceiling: number;
      type: 'FIXA' | 'VARIAVEL' | 'ESSENCIAL';
      description: string;
    }>
  >(() => {
    // Pré-seleciona apenas as DEFAULT_RECOMMENDED_NATURES que já existem no contexto
    // (comparando por id ou nome), ou usa todos os defaults se o usuário não tem nenhuma ainda.
    // Isso evita o bug "10 de 5 ativas" quando o usuário tem naturezas extras cadastradas.
    return DEFAULT_RECOMMENDED_NATURES.map((d) => {
      // Verifica se essa natureza-padrão já existe no contexto
      const existingNat = natures.find(
        (n) => n.id === d.id || n.name.toLowerCase().trim() === d.name.toLowerCase().trim()
      );
      return {
        id: existingNat?.id || d.id,
        name: d.name,
        icon: d.icon,
        color: d.color,
        ceiling: existingNat ? ((existingNat as any).ceiling || d.suggestedCeiling) : d.suggestedCeiling,
        type: d.type,
        description: d.description,
        _alreadyExists: !!existingNat,
      };
    });
  });

  const [newNatureName, setNewNatureName] = useState('');
  const [newNatureCeiling, setNewNatureCeiling] = useState('');
  const [newNatureIcon, setNewNatureIcon] = useState('⚡');
  const [showAddNatureRow, setShowAddNatureRow] = useState(false);
  const [autoLoadMappings, setAutoLoadMappings] = useState<boolean>(true);
  const [showMappingTutorial, setShowMappingTutorial] = useState<boolean>(true);

  const parseNumber = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/[R$\s]/g, '').trim();
    if (!clean) return 0;
    if (clean.includes('.') && clean.includes(',')) {
      return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
    }
    if (clean.includes(',')) {
      return parseFloat(clean.replace(',', '.')) || 0;
    }
    return parseFloat(clean) || 0;
  };

  const handleToggleNature = (natId: string) => {
    setSelectedNatures((prev) => {
      const exists = prev.some((n) => n.id === natId);
      if (exists) {
        return prev.filter((n) => n.id !== natId);
      } else {
        const found = DEFAULT_RECOMMENDED_NATURES.find((d) => d.id === natId);
        if (found) {
          return [
            ...prev,
            {
              id: found.id,
              name: found.name,
              icon: found.icon,
              color: found.color,
              ceiling: found.suggestedCeiling,
              type: found.type,
              description: found.description,
            },
          ];
        }
        return prev;
      }
    });
  };

  const handleUpdateNatureCeiling = (natId: string, val: string) => {
    const num = parseNumber(val);
    setSelectedNatures((prev) =>
      prev.map((n) => (n.id === natId ? { ...n, ceiling: num } : n))
    );
  };

  const handleAddCustomNature = () => {
    if (!newNatureName.trim()) return;
    const ceilingVal = parseNumber(newNatureCeiling) || 500;
    const newNat = {
      id: `nat_${Date.now()}`,
      name: newNatureName.trim(),
      icon: newNatureIcon || '🏷️',
      color: '#38bdf8',
      ceiling: ceilingVal,
      type: 'VARIAVEL' as const,
      description: 'Natureza personalizada criada no Onboarding',
    };
    setSelectedNatures((prev) => [...prev, newNat]);
    setNewNatureName('');
    setNewNatureCeiling('');
    setShowAddNatureRow(false);
  };

  // -------------------------------------------------------------
  // SALVAR TUDO E ATIVAR
  // -------------------------------------------------------------
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const handleFinishCalibration = () => {
    setIsFinishing(true);
    setFinishError(null);

    try {
      const safeStartDate = startDate || firstDayOfMonthStr || new Date().toISOString().split('T')[0];
      const parsedBalance = parseNumber(initialBalance);
      const parsedCurrentInv = parseNumber(currentInvoiceAmount);
      const parsedSecondCurr = parseNumber(secondCurrentInvoice);

      const totalCardDebt =
        (hasCards ? parsedCurrentInv : 0) +
        (hasSecondCard ? parsedSecondCurr : 0);

      // 1. Cria ou Atualiza o Checkpoint (Ponto de Partida) com faturas detalhadas
      try {
        addCheckpoint({
          label: `Marco Inicial (${safeStartDate.split('-').reverse().join('/')})`,
          startDate: safeStartDate,
          initialBalance: parsedBalance,
          creditCardDebt: totalCardDebt,
          initialNetWorth: parsedBalance - totalCardDebt,
          notes: 'Ponto de partida configurado no Get Started conversacional com a Forseti',
          cardDebts: hasCards
            ? [
                {
                  id: `debt_card_1`,
                  bankName: cardBank || 'Nubank',
                  cardName: cardName || 'Cartão Principal',
                  dueDay: cardDueDay,
                  invoices: [
                    ...(parsedCurrentInv > 0
                      ? [
                          {
                            monthIndex: 1,
                            monthLabel: `Fatura Mês Seguinte (${getMonthInfo(safeStartDate, 1).short})`,
                            dueDate: getMonthDueDate(safeStartDate, 1, cardDueDay),
                            amount: parsedCurrentInv,
                          },
                        ]
                      : []),
                  ],
                  totalDebt: parsedCurrentInv,
                },
                ...(hasSecondCard
                  ? [
                      {
                        id: `debt_card_2`,
                        bankName: secondCardBank || 'Inter',
                        cardName: secondCardName || 'Segundo Cartão',
                        dueDay: secondCardDueDay,
                        invoices: [
                          ...(parsedSecondCurr > 0
                            ? [
                                {
                                  monthIndex: 1,
                                  monthLabel: `Fatura Mês Seguinte (${getMonthInfo(safeStartDate, 1).short})`,
                                  dueDate: getMonthDueDate(safeStartDate, 1, secondCardDueDay),
                                  amount: parsedSecondCurr,
                                },
                              ]
                            : []),
                        ],
                        totalDebt: parsedSecondCurr,
                      },
                    ]
                  : []),
              ]
            : [],
        });
      } catch (cpErr) {
        console.warn('Erro ao salvar checkpoint:', cpErr);
      }

      // 2. Registra e Garante todos os Bancos e Contas selecionados pelo usuário
      try {
        selectedBanks.forEach((b) => {
          const brand = getBankBranding(b.name);
          const alreadyExists = banks.some(
            (ex) => ex.name.toLowerCase().trim() === b.name.toLowerCase().trim()
          );
          if (!alreadyExists) {
            addBank({
              name: b.name,
              color: brand.primaryColor,
              icon: brand.iconText || '🏦',
              status: 'CONECTADO',
              syncedAt: 'Ativo no Balder',
            });
          }
        });

        // Cria Conta Bancária correspondente para cada banco selecionado
        selectedBanks.forEach((b) => {
          const brand = getBankBranding(b.name);
          const indBal = parseNumber(b.balanceInput);
          const effectiveBal = indBal > 0 ? indBal : (b.isMain ? parsedBalance : 0);

          const accExists = accounts.some(
            (a) => (a.bankName || a.name).toLowerCase().trim() === b.name.toLowerCase().trim()
          );
          if (!accExists) {
            addAccount({
              name: `Conta ${b.name}`,
              bankName: b.name,
              balance: effectiveBal,
              type: 'CORRENTE',
              color: brand.primaryColor,
              icon: '🏦',
            });
          }
        });
      } catch (bankErr) {
        console.warn('Erro ao registrar bancos/contas:', bankErr);
      }

      // 3. Cadastra o(s) Cartão(ões) de Crédito com fatura do mês seguinte
      try {
        if (hasCards) {
          addCard({
            name: cardName || 'Cartão Principal',
            bank: cardBank || 'Nubank',
            brand: 'MASTERCARD',
            limitTotal: Math.max(5000, parsedCurrentInv * 1.5),
            closingDay: Math.max(1, cardDueDay - 7),
            dueDay: cardDueDay,
            color: '#8b5cf6',
          });

          // Adiciona movimento previsto para a fatura do mês seguinte
          if (parsedCurrentInv > 0) {
            addMovement({
              title: `Fatura ${cardName || 'Cartão'} (${getMonthInfo(safeStartDate, 1).short})`,
              amount: parsedCurrentInv,
              dueDate: getMonthDueDate(safeStartDate, 1, cardDueDay),
              type: 'CARTAO',
              status: 'PREVISTA',
              category: 'Fatura de Cartão',
              bank: cardBank,
            });
          }
        }

        if (hasSecondCard && parsedSecondCurr > 0) {
          addCard({
            name: secondCardName || 'Segundo Cartão',
            bank: secondCardBank || 'Inter',
            brand: 'VISA',
            limitTotal: Math.max(4000, parsedSecondCurr * 1.5),
            closingDay: Math.max(1, secondCardDueDay - 7),
            dueDay: secondCardDueDay,
            color: '#f59e0b',
          });

          addMovement({
            title: `Fatura ${secondCardName} (${getMonthInfo(safeStartDate, 1).short})`,
            amount: parsedSecondCurr,
            dueDate: getMonthDueDate(safeStartDate, 1, secondCardDueDay),
            type: 'CARTAO',
            status: 'PREVISTA',
            category: 'Fatura de Cartão',
            bank: secondCardBank,
          });
        }
      } catch (cardErr) {
        console.warn('Erro ao cadastrar cartões:', cardErr);
      }

      // 4. Salva ou atualiza a Configuração do Salário / Remuneração Principal
      try {
        const parsedSalary = parseNumber(salaryAmount);
        const safeMainBank = salaryReceivingBank || mainBankName || selectedBanks[0]?.name || 'Nubank';
        if (hasSalary && parsedSalary > 0) {
          const existingSalary = salaryContracts?.find((s) => s.isActive) || salaryContracts?.[0];
          if (existingSalary) {
            updateSalaryContract(existingSalary.id, {
              employer: salaryEmployer.trim() || 'Empregador Principal',
              role: salaryRole.trim() || 'Remuneração Principal',
              contractType: salaryContractType,
              paymentDay: Math.min(Math.max(1, salaryPayDay), 31),
              currentGrossAmount: parsedSalary,
              currentNetAmount: parsedSalary,
              receivingBankName: safeMainBank,
              startDate: safeStartDate,
              isActive: true,
            });
          } else {
            addSalaryContract({
              employer: salaryEmployer.trim() || 'Empregador Principal',
              role: salaryRole.trim() || 'Remuneração Principal',
              contractType: salaryContractType,
              paymentSchedule: 'UNICO',
              paymentDay: Math.min(Math.max(1, salaryPayDay), 31),
              currentGrossAmount: parsedSalary,
              currentNetAmount: parsedSalary,
              receivingBankName: safeMainBank,
              startDate: safeStartDate,
              isActive: true,
            });
          }

          // Adiciona movimento de receita prevista para o mês inicial
          addMovement({
            title: `Salário: ${salaryEmployer.trim() || 'Remuneração Principal'}`,
            amount: parsedSalary,
            dueDate: getMonthDueDate(safeStartDate, 0, salaryPayDay),
            type: 'RECEBER',
            status: 'PREVISTA',
            category: 'Salário',
            bank: safeMainBank,
          });
        }
      } catch (salErr) {
        console.warn('Erro ao cadastrar salário:', salErr);
      }

      // 5. Salva as Naturezas selecionadas com seus tetos e mapeamentos
      try {
        if (selectedNatures.length > 0) {
          selectedNatures.forEach((nat, idx) => {
            const alreadyExists = natures.some(
              (n) => n.name.toLowerCase().trim() === nat.name.toLowerCase().trim()
            );
            if (!alreadyExists) {
              const suggestedMappings = autoLoadMappings
                ? buildSuggestedMappingsForNature(`nat_seed_${Date.now()}_${idx}`, nat.name, nat.icon)
                : [];
              addNature({
                name: nat.name,
                icon: nat.icon,
                color: nat.color,
                type: nat.type,
                description: nat.description,
                keywords: (nat as any).keywords || [],
                mappings: suggestedMappings,
              });
            }
          });
        }
      } catch (natErr) {
        console.warn('Erro ao cadastrar naturezas:', natErr);
      }

      // Marca onboarding como completado no localStorage e no Supabase
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_onboarding_completed_${user.$id}`, 'true');
        SupabaseService.saveUserProfileSettings({ onboardingCompleted: true }).catch(console.error);
      } else {
        localStorage.setItem('balder_onboarding_completed_guest', 'true');
      }
      sessionStorage.setItem('balder_onboarding_dismissed', 'true');

      // Fecha e conclui com sucesso
      setIsFinishing(false);
      if (onComplete) onComplete();
      onClose();
    } catch (err: any) {
      console.error('Erro ao finalizar calibração:', err);
      setFinishError(
        err?.message || 'Ocorreu um erro ao salvar a calibração. Por favor, tente novamente.'
      );
      setIsFinishing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="onboarding-overlay animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Calibração Inicial com a Forseti"
    >
      <div className="onboarding-dialog glass-card">
        {/* Top Progress & Header */}
        <div className="onboarding-top-bar">
          <div className="flex items-center gap-3">
            <div className="forseti-avatar-box">
              <img
                src="/forseti-avatar.png"
                alt="Forseti IA"
                className="forseti-avatar-img"
                style={{ width: 44, height: 44, minWidth: 44, minHeight: 44, objectFit: 'cover', borderRadius: 12 }}
              />
              <span className="forseti-pulse-dot" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="onboarding-forseti-name">Forseti</span>
                <span className="badge-pill badge-pill-cyan">Auditora IA</span>
              </div>
              <p className="onboarding-top-sub">
                Calibração Inicial do Seu Sistema Financeiro
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`badge-pill text-xs font-semibold ${
                  onboardingAudit.isAllComplete ? 'badge-pill-emerald' : 'badge-pill-amber'
                }`}
              >
                {onboardingAudit.percent}% Calibrado
              </span>
              <div className="onboarding-step-counter">
                <span>Etapa {Math.min(currentStep, 5)} de 5</span>
              </div>
            </div>
            <button
              type="button"
              className="onboarding-close-btn"
              onClick={onClose}
              title="Continuar mais tarde / Ir ao Dashboard"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress Line */}
        <div className="onboarding-progress-track">
          <div
            className="onboarding-progress-fill"
            style={{
              width: `${(Math.min(currentStep, 5) / 5) * 100}%`,
            }}
          />
        </div>

        {/* Step Navigation Tabs with Progress Status */}
        <div className="flex items-center justify-between gap-2 px-6 py-2 bg-white/5 border-b border-white/5 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer ${
                currentStep === 1
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'bg-white/5 text-muted hover:text-white'
              }`}
            >
              <span>1. Ponto de Partida</span>
              {onboardingAudit.steps.find((s) => s.id === 'checkpoint')?.isComplete ? (
                <CheckCircle2 size={13} className="text-emerald-400" />
              ) : (
                <Clock size={13} className="text-amber-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer ${
                currentStep === 2
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'bg-white/5 text-muted hover:text-white'
              }`}
            >
              <span>2. Salário & Renda</span>
              {onboardingAudit.steps.find((s) => s.id === 'salary')?.isComplete ? (
                <CheckCircle2 size={13} className="text-emerald-400" />
              ) : (
                <Clock size={13} className="text-amber-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer ${
                currentStep === 3
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'bg-white/5 text-muted hover:text-white'
              }`}
            >
              <span>3. Cartões & Faturas</span>
              {onboardingAudit.steps.find((s) => s.id === 'invoices')?.isComplete ? (
                <CheckCircle2 size={13} className="text-emerald-400" />
              ) : (
                <Clock size={13} className="text-amber-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer ${
                currentStep === 4
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'bg-white/5 text-muted hover:text-white'
              }`}
            >
              <span>4. Naturezas & Tetos</span>
              {onboardingAudit.steps.find((s) => s.id === 'natures')?.isComplete ? (
                <CheckCircle2 size={13} className="text-emerald-400" />
              ) : (
                <Clock size={13} className="text-amber-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(5)}
              className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer ${
                currentStep === 5
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'bg-white/5 text-muted hover:text-white'
              }`}
            >
              <span>5. Mapeamentos & IA</span>
              {onboardingAudit.steps.find((s) => s.id === 'ai_mappings')?.isComplete ? (
                <CheckCircle2 size={13} className="text-emerald-400" />
              ) : (
                <Clock size={13} className="text-amber-400" />
              )}
            </button>
          </div>

          {onboardingAudit.nextSuggestedStep && !onboardingAudit.isAllComplete && (
            <span className="text-[11px] text-amber-300 flex items-center gap-1">
              <Sparkles size={11} className="text-amber-400 shrink-0" />
              <span>
                Pendente: <strong>{onboardingAudit.nextSuggestedStep.shortLabel}</strong>
              </span>
            </span>
          )}
        </div>

        {/* Stage Content */}
        <div className="onboarding-body-container">
          {/* ======================================================== */}
          {/* PASSO 1: PONTO DE PARTIDA                                */}
          {/* ======================================================== */}
          {currentStep === 1 && (
            <div className="onboarding-step-view animate-fade-in">
              {/* Balão de Fala da Forseti */}
              <div className="forseti-speech-bubble">
                <div className="forseti-bubble-header">
                  <Sparkles size={16} className="text-amber" />
                  <strong>Passo 1: Definindo sua Âncora na Realidade</strong>
                </div>
                <p>
                  Olá! Sou a <strong>Forseti</strong>, sua auditora financeira pessoal no Balder.
                  Para começarmos, me diga <strong>quais bancos e instituições você utiliza</strong> (contas, cartões ou investimentos) e qual seu saldo disponível hoje.
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Você pode selecionar múltiplos bancos. Isso calibrará suas contas, faturas e projeções de fluxo de caixa em todo o sistema.
                </p>
              </div>

              {/* Card de Seleção de Bancos que o Usuário Utiliza */}
              <div className="onboarding-form-card glass-card">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-cyan" />
                    <div>
                      <span className="font-bold text-sm text-slate-200 block">
                        Quais Bancos & Instituições Você Utiliza?
                      </span>
                      <span className="text-[11px] text-muted block">
                        Selecione todas as instituições onde você movimenta dinheiro, recebe salário ou tem cartão.
                      </span>
                    </div>
                  </div>
                  <span className="badge-pill badge-pill-cyan text-[11px] font-bold">
                    {selectedBanks.length} {selectedBanks.length === 1 ? 'banco' : 'bancos'}
                  </span>
                </div>

                {/* Grade de Bancos Populares */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', marginTop: '4px' }}>
                  {POPULAR_BANKS.map((bName) => {
                    const isSelected = selectedBanks.some((b) => b.name.toLowerCase() === bName.toLowerCase());
                    const brand = getBankBranding(bName);
                    return (
                      <button
                        key={bName}
                        type="button"
                        onClick={() => handleTogglePopularBank(bName)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 10px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          background: isSelected ? brand.badgeBg : 'rgba(255, 255, 255, 0.03)',
                          border: isSelected ? `1.5px solid ${brand.primaryColor}` : '1px solid rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                          boxShadow: isSelected ? `0 0 12px ${brand.primaryColor}33` : 'none',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>{brand.iconText || '🏦'}</span>
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {brand.name}
                        </span>
                        {isSelected && <Check size={13} style={{ color: brand.secondaryColor, flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>

                {/* Adicionar Outro Banco Customizado */}
                {!showAddCustomBank ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '2px' }}>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomBank(true)}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '11.5px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                    >
                      <Plus size={13} />
                      <span>Adicionar outro banco (ex: Sicoob, Nomad, Wise...)</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                    <input
                      type="text"
                      className="form-input text-xs"
                      placeholder="Nome do banco ou cooperativa..."
                      value={customBankInput}
                      onChange={(e) => setCustomBankInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomBank();
                        }
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ flexShrink: 0 }}
                      onClick={handleAddCustomBank}
                    >
                      Adicionar
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ flexShrink: 0 }}
                      onClick={() => setShowAddCustomBank(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                {/* Detalhes dos Bancos Selecionados & Definição de Conta Principal */}
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                    Bancos Ativos & Configuração de Saldo:
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedBanks.map((b) => {
                      const brand = getBankBranding(b.name);
                      return (
                        <div
                          key={b.id || b.name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            background: b.isMain ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                            border: b.isMain ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(255, 255, 255, 0.06)',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px' }}>
                            <span style={{ fontSize: '16px' }}>{brand.iconText || '🏦'}</span>
                            <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>{b.name}</span>
                            {b.isMain ? (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.25) 0%, rgba(56, 189, 248, 0.25) 100%)',
                                  color: '#FDE047',
                                  border: '1px solid rgba(212, 175, 55, 0.5)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Star size={10} />
                                <span>Principal</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetMainBank(b.name)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                }}
                              >
                                Tornar Principal
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                            <div style={{ width: '135px' }}>
                              <input
                                type="text"
                                className="form-input text-xs"
                                placeholder="Saldo R$ (opcional)"
                                value={b.balanceInput}
                                onChange={(e) => handleBankBalanceChange(b.name, e.target.value)}
                                title={`Saldo disponível na conta ${b.name}`}
                              />
                            </div>
                            {selectedBanks.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveBank(b.name)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                title={`Remover ${b.name}`}
                              >
                                <Trash2 size={13} className="text-rose-400" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Card do Formulário de Data & Saldo Consolidado */}
              <div className="onboarding-form-card glass-card">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="flex items-center gap-1.5 font-semibold text-xs text-slate-300">
                      <Calendar size={14} className="text-cyan" />
                      <span>Data do Ponto de Partida:</span>
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <span className="text-[11px] text-muted">
                      Normalmente o início do mês atual ou o dia de hoje.
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="flex items-center gap-1.5 font-semibold text-xs text-slate-300">
                      <DollarSign size={14} className="text-emerald" />
                      <span>Saldo Total em Caixa/Contas (R$):</span>
                    </label>
                    <input
                      type="text"
                      className="form-input text-lg font-bold text-emerald"
                      placeholder="Ex: 3.500,00"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                    />
                    <span className="text-[11px] text-muted">
                      Soma dos saldos disponíveis em todos os seus bancos hoje.
                    </span>
                  </div>
                </div>
              </div>

              {/* Botões de Ação da Etapa 1 */}
              <div className="onboarding-step-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={onClose}
                >
                  Configurar Depois
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex items-center gap-2 px-6"
                  onClick={() => setCurrentStep(2)}
                >
                  <span>Continuar para Salário & Renda</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ETAPA 2: REMUNERAÇÃO & SALÁRIO                           */}
          {/* ======================================================== */}
          {currentStep === 2 && (
            <div className="onboarding-step-view animate-fade-in">
              <div className="forseti-speech-bubble">
                <div className="forseti-bubble-header">
                  <Briefcase size={16} className="text-emerald" />
                  <strong>Etapa 2 de 5: Remuneração & Salário Mensal</strong>
                </div>
                <p>
                  Sua receita recorrente é a base para prever o fluxo de entradas dos próximos meses.
                  Configure aqui seu salário líquido e o dia em que o valor é creditado em conta.
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Sem a remuneração cadastrada, suas projeções futuras no Dashboard ficariam sem base de recebimentos.
                </p>
              </div>

              {/* Card de Configuração de Salário / Remuneração Principal */}
              <div className="onboarding-form-card glass-card">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Briefcase size={16} className="text-emerald" />
                    <span className="font-bold text-sm text-slate-200">
                      Remuneração & Salário Mensal
                    </span>
                    <span className="badge-pill badge-pill-emerald text-[10px]">Essencial para DRE</span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasSalary}
                      onChange={(e) => setHasSalary(e.target.checked)}
                    />
                    <span>Recebo salário / renda fixa</span>
                  </label>
                </div>

                {hasSalary ? (
                  <>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="flex items-center gap-1.5 font-semibold text-xs text-slate-300">
                          <DollarSign size={14} className="text-emerald" />
                          <span>Salário Líquido Mensal (R$):</span>
                        </label>
                        <input
                          type="text"
                          className="form-input text-base font-bold text-emerald"
                          placeholder="Ex: 4.500,00"
                          value={salaryAmount}
                          onChange={(e) => setSalaryAmount(e.target.value)}
                        />
                        <span className="text-[11px] text-muted">
                          Valor que cai na conta todo mês (livre de descontos).
                        </span>
                      </div>

                      <div className="form-group">
                        <label className="flex items-center gap-1.5 font-semibold text-xs text-slate-300">
                          <Calendar size={14} className="text-cyan" />
                          <span>Dia do Pagamento no Mês:</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          className="form-input"
                          value={salaryPayDay}
                          onChange={(e) => setSalaryPayDay(Number(e.target.value))}
                        />
                        <span className="text-[11px] text-muted">
                          Ex: dia 5 ou dia 1 (data em que o valor é creditado).
                        </span>
                      </div>
                    </div>

                    <div className="form-grid-2 mt-2">
                      <div className="form-group">
                        <label className="flex items-center gap-1.5 font-semibold text-xs text-slate-300">
                          <Building2 size={14} className="text-slate-400" />
                          <span>Empresa / Fonte:</span>
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Ex: Empresa Principal"
                          value={salaryEmployer}
                          onChange={(e) => setSalaryEmployer(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="flex items-center gap-1.5 font-semibold text-xs text-slate-300">
                          <span>Cargo / Função:</span>
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Ex: Especialista, Gestor"
                          value={salaryRole}
                          onChange={(e) => setSalaryRole(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Regime de Contrato — Flag Chips */}
                    <div className="form-group mt-3">
                      <label className="flex items-center gap-1.5 font-semibold text-xs text-slate-300 mb-2">
                        <span>Regime de Contrato:</span>
                      </label>
                      <div className="salary-regime-chips">
                        {(
                          [
                            { value: 'CLT',        label: 'CLT',        sub: 'Carteira Assinada' },
                            { value: 'PJ',         label: 'PJ',         sub: 'Pessoa Jurídica' },
                            { value: 'PRO_LABORE', label: 'Pró-Labore', sub: 'Empresário' },
                            { value: 'CONCURSO',   label: 'Servidor',   sub: 'Concurso Público' },
                            { value: 'AUTONOMO',   label: 'Autônomo',   sub: 'Liberal' },
                            { value: 'ESTAGIO',    label: 'Estágio',    sub: 'Bolsa' },
                            { value: 'OUTRO',      label: 'Outro',      sub: 'Benefício' },
                          ] as { value: SalaryContractType; label: string; sub: string }[]
                        ).map((opt) => {
                          const isActive = salaryContractType === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              className={`salary-regime-chip${isActive ? ' active' : ''}`}
                              onClick={() => setSalaryContractType(opt.value)}
                              title={opt.sub}
                            >
                              {isActive && <span className="salary-regime-chip-dot" />}
                              <span className="salary-regime-chip-label">{opt.label}</span>
                              <span className="salary-regime-chip-sub">{opt.sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="form-group mt-3 pt-2.5 border-t border-white/5">
                      <label className="flex items-center gap-1.5 font-semibold text-xs text-slate-300">
                        <Building2 size={14} className="text-cyan" />
                        <span>Banco de Recebimento do Salário:</span>
                      </label>
                      <div className="flex gap-2 flex-wrap mt-1.5">
                        {selectedBanks.map((b) => {
                          const brand = getBankBranding(b.name);
                          const isSelected = (salaryReceivingBank || mainBankName).toLowerCase() === b.name.toLowerCase();
                          return (
                            <button
                              key={b.name}
                              type="button"
                              onClick={() => setSalaryReceivingBank(b.name)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: isSelected ? 700 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: isSelected ? brand.badgeBg : 'rgba(255, 255, 255, 0.05)',
                                border: isSelected ? `1.5px solid ${brand.primaryColor}` : '1px solid rgba(255, 255, 255, 0.1)',
                                color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                              }}
                            >
                              <span>{brand.iconText || '🏦'}</span>
                              <span>{b.name}</span>
                              {b.isMain && <span style={{ fontSize: '10px', color: '#FDE047', fontWeight: 700 }}>(Principal)</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-3 rounded-xl bg-white/5 text-center text-xs text-slate-400">
                    Você optou por não cadastrar remuneração fixa. Suas receitas serão lançadas de forma avulsa quando ocorrerem.
                  </div>
                )}
              </div>

              {/* Botões de Ação da Etapa 2 */}
              <div className="onboarding-step-actions">
                <button
                  type="button"
                  className="btn btn-outline flex items-center gap-1.5"
                  onClick={() => setCurrentStep(1)}
                >
                  <ArrowLeft size={16} />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex items-center gap-2 px-6"
                  onClick={() => setCurrentStep(3)}
                >
                  <span>Continuar para Cartões & Faturas</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ETAPA 3: FATURAS DE CARTÃO EM ABERTO                    */}
          {/* ======================================================== */}
          {currentStep === 3 && (
            <div className="onboarding-step-view animate-fade-in">
              <div className="forseti-speech-bubble">
                <div className="forseti-bubble-header">
                  <CreditCard size={16} className="text-cyan" />
                  <strong>Etapa 3 de 5: Faturas de Cartão de Crédito em Aberto</strong>
                </div>
                <p>
                  Excelente! O segundo ponto é registrar a fatura do cartão que vence no
                  <strong> mês seguinte</strong>. Essa é a principal causa de surpresas no orçamento.
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  Informe o valor total da fatura que vencerá no próximo mês. Outras faturas podem ser ajustadas depois na tela de Movimentos.
                </p>
              </div>

              {/* Card de Faturas do Cartão 1 */}
              <div className="onboarding-form-card glass-card">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <CreditCard size={16} className="text-purple-400" />
                    <span className="font-bold text-sm text-slate-200">
                      Cartão de Crédito 1
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasCards}
                      onChange={(e) => setHasCards(e.target.checked)}
                    />
                    <span>Possuo cartão de crédito</span>
                  </label>
                </div>

                {hasCards ? (
                  <>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="text-xs text-slate-300 font-medium">Nome do Cartão:</label>
                        <input
                          type="text"
                          className="form-input"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          placeholder="Ex: Nubank Roxinho"
                        />
                      </div>
                      <div className="form-group">
                        <label className="text-xs text-slate-300 font-medium">Instituição / Banco:</label>
                        <select
                          className="form-input"
                          value={cardBank}
                          onChange={(e) => {
                            setCardBank(e.target.value);
                            if (cardName === 'Cartão Principal' || cardName.startsWith('Cartão ')) {
                              setCardName(`Cartão ${e.target.value}`);
                            }
                          }}
                        >
                          {selectedBanks.length > 0
                            ? selectedBanks.map((b) => (
                                <option key={b.name} value={b.name}>{b.name}</option>
                              ))
                            : ['Nubank', 'Banco Inter', 'Bradesco', 'Itaú', 'Santander', 'Caixa', 'Banco do Brasil', 'C6 Bank', 'Outro'].map((b) => (
                                <option key={b} value={b}>{b}</option>
                              ))
                          }
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="text-xs text-slate-300 font-medium">Dia de Vencimento:</label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          className="form-input"
                          value={cardDueDay}
                          onChange={(e) => setCardDueDay(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    {/* Fatura do Mês Seguinte */}
                    <div className="form-group mt-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
                          <span>Fatura do Mês Seguinte — {getMonthInfo(startDate, 1).short}:</span>
                        </label>
                        <span className="text-[11px] text-amber-300/80 font-medium">
                          Vence em {getMonthDueDate(startDate, 1, cardDueDay).split('-').reverse().join('/')}
                        </span>
                      </div>
                      <input
                        type="text"
                        className="form-input text-base font-bold text-amber-400"
                        placeholder="Ex: 1.250,00"
                        value={currentInvoiceAmount}
                        onChange={(e) => setCurrentInvoiceAmount(e.target.value)}
                      />
                      <span className="text-[10px] text-muted mt-1 block">
                        Total da fatura que vencerá no próximo mês neste cartão.
                      </span>
                    </div>

                    {/* Segundo Cartão Opcional */}
                    {!hasSecondCard ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm mt-4 flex items-center gap-1.5 text-xs"
                        onClick={() => setHasSecondCard(true)}
                      >
                        <Plus size={13} />
                        <span>Adicionar Outro Cartão / Banco</span>
                      </button>
                    ) : (
                      <div className="mt-4 pt-3 border-t border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CreditCard size={15} className="text-amber-400" />
                            <span className="font-bold text-xs text-slate-200">
                              Cartão de Crédito 2
                            </span>
                          </div>
                          <button
                            type="button"
                            className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 cursor-pointer"
                            onClick={() => setHasSecondCard(false)}
                          >
                            <Trash2 size={12} />
                            <span>Remover Cartão 2</span>
                          </button>
                        </div>

                        <div className="form-grid-2">
                          <div className="form-group">
                            <label className="text-xs text-slate-300 font-medium">Nome do Cartão 2:</label>
                            <input
                              type="text"
                              className="form-input text-xs"
                              value={secondCardName}
                              onChange={(e) => setSecondCardName(e.target.value)}
                              placeholder="Nome Cartão 2"
                            />
                          </div>
                          <div className="form-group">
                            <label className="text-xs text-slate-300 font-medium">Banco / Instituição:</label>
                            <select
                              className="form-input text-xs"
                              value={secondCardBank}
                              onChange={(e) => {
                                setSecondCardBank(e.target.value);
                                if (secondCardName === 'Segundo Cartão' || secondCardName.startsWith('Cartão ')) {
                                  setSecondCardName(`Cartão ${e.target.value}`);
                                }
                              }}
                            >
                              {selectedBanks.length > 0
                                ? selectedBanks.map((b) => (
                                    <option key={b.name} value={b.name}>{b.name}</option>
                                  ))
                                : ['Nubank', 'Banco Inter', 'Bradesco', 'Itaú', 'Santander', 'Caixa', 'Banco do Brasil', 'C6 Bank', 'Outro'].map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                  ))
                              }
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="text-xs text-slate-300 font-medium">Dia Vencimento:</label>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              className="form-input text-xs"
                              value={secondCardDueDay}
                              onChange={(e) => setSecondCardDueDay(Number(e.target.value))}
                            />
                          </div>
                        </div>

                        {/* Fatura Mês Seguinte Cartão 2 */}
                        <div className="form-group mt-2.5 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-amber-300 font-bold flex items-center gap-1">
                              <span>Fatura Mês Seguinte Cartão 2 — {getMonthInfo(startDate, 1).short}:</span>
                            </label>
                            <span className="text-[10px] text-amber-300/80">
                              Venc: {getMonthDueDate(startDate, 1, secondCardDueDay).split('-').reverse().join('/')}
                            </span>
                          </div>
                          <input
                            type="text"
                            className="form-input text-sm font-bold text-amber-400"
                            placeholder="Ex: 850,00"
                            value={secondCurrentInvoice}
                            onChange={(e) => setSecondCurrentInvoice(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 rounded-xl bg-white/5 text-center text-xs text-slate-300">
                    Você optou por não registrar cartões de crédito. Seus gastos serão monitorados
                    exclusivamente em contas correntes e dinheiro à vista.
                  </div>
                )}
              </div>

              <div className="onboarding-step-actions">
                <button
                  type="button"
                  className="btn btn-outline flex items-center gap-1.5"
                  onClick={() => setCurrentStep(2)}
                >
                  <ArrowLeft size={16} />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex items-center gap-2 px-6"
                  onClick={() => setCurrentStep(4)}
                >
                  <span>Continuar para Naturezas & Tetos</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ETAPA 4: NATUREZAS ORÇAMENTÁRIAS & TETOS                */}
          {/* ======================================================== */}
          {currentStep === 4 && (
            <div className="onboarding-step-view animate-fade-in">
              <div className="forseti-speech-bubble">
                <div className="forseti-bubble-header">
                  <Layers size={16} className="text-amber-400" />
                  <strong>Etapa 4 de 5: Naturezas Orçamentárias & Tetos de Gastos</strong>
                </div>
                <p>
                  Defina os limites mensais das suas principais categorias de despesa (Alimentação, Moradia, Transporte, etc.).
                  A Forseti audita desvios em tempo real antes de qualquer estouro orçamentário.
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  Você pode personalizar os tetos de acordo com a sua realidade financeira e adicionar categorias sob medida.
                </p>
              </div>

              <div className="onboarding-natures-container mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300">
                    Selecione suas Naturezas & Ajuste os Tetos:
                  </span>
                  <span className="text-xs text-muted">
                    {selectedNatures.filter((n) => DEFAULT_RECOMMENDED_NATURES.some((d) => d.id === n.id || d.name.toLowerCase() === n.name.toLowerCase())).length} de {DEFAULT_RECOMMENDED_NATURES.length} ativas
                  </span>
                </div>

                <div className="onboarding-natures-grid">
                  {DEFAULT_RECOMMENDED_NATURES.map((def) => {
                    const current = selectedNatures.find((n) => n.id === def.id);
                    const isSelected = !!current;

                    return (
                      <div
                        key={def.id}
                        className={`onboarding-nature-card glass-card ${
                          isSelected ? 'selected' : 'disabled'
                        }`}
                      >
                        <div className="nature-card-top">
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleNature(def.id)}
                            />
                            <span className="nature-icon">{def.icon}</span>
                            <strong className="nature-name">{def.name}</strong>
                          </label>
                        </div>
                        <p className="nature-desc">{def.description}</p>

                        {isSelected && (
                          <>
                            <div className="nature-ceiling-input-row">
                              <span className="text-xs text-muted">Teto Mensal:</span>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-400">R$</span>
                                <input
                                  type="number"
                                  className="nature-ceiling-input"
                                  value={current?.ceiling || ''}
                                  onChange={(e) =>
                                    handleUpdateNatureCeiling(def.id, e.target.value)
                                  }
                                />
                              </div>
                            </div>

                            {def.sampleMappings && def.sampleMappings.length > 0 && (
                              <div className="nature-sample-mappings-row mt-2.5 pt-2 border-t border-white/10">
                                <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                                  Mapeamentos previstos:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {def.sampleMappings.map((sm, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300"
                                    >
                                      {sm}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Linha para Adicionar Nova Natureza Customizada */}
                {!showAddNatureRow ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm mt-3 flex items-center gap-1.5 text-xs"
                    onClick={() => setShowAddNatureRow(true)}
                  >
                    <Plus size={13} />
                    <span>Adicionar Outra Natureza Personalizada</span>
                  </button>
                ) : (
                  <div className="glass-card p-3 mt-3 flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      placeholder="Ícone (ex: ⚡ ou 🐶)"
                      className="form-input text-xs w-20 text-center"
                      value={newNatureIcon}
                      onChange={(e) => setNewNatureIcon(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Nome da Natureza (ex: Pets, Cursos)"
                      className="form-input text-xs flex-1 min-w-[160px]"
                      value={newNatureName}
                      onChange={(e) => setNewNatureName(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Teto Mensal R$"
                      className="form-input text-xs w-32"
                      value={newNatureCeiling}
                      onChange={(e) => setNewNatureCeiling(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm text-xs"
                      onClick={handleAddCustomNature}
                    >
                      Adicionar
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm text-xs"
                      onClick={() => setShowAddNatureRow(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              {/* Botões de Ação da Etapa 4 */}
              <div className="onboarding-step-actions">
                <button
                  type="button"
                  className="btn btn-outline flex items-center gap-1.5"
                  onClick={() => setCurrentStep(3)}
                >
                  <ArrowLeft size={16} />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex items-center gap-2 px-6"
                  onClick={() => setCurrentStep(5)}
                >
                  <span>Continuar para Mapeamentos & IA</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ETAPA 5: MAPEAMENTOS DE ROTINAS & IA                    */}
          {/* ======================================================== */}
          {currentStep === 5 && (
            <div className="onboarding-step-view animate-fade-in">
              <div className="forseti-speech-bubble">
                <div className="forseti-bubble-header">
                  <Sparkles size={16} className="text-cyan" />
                  <strong>Etapa 5 de 5: Mapeamento de Rotinas & Inteligência Artificial</strong>
                </div>
                <p>
                  No Balder, nós não usamos tetos tirados do nada: cada Natureza (ex: Alimentação) é fundamentada por{' '}
                  <strong>compras e rotinas reais</strong> (Supermercado, Feira, Açougue).
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  A IA utiliza palavras-chave para classificar notas fiscais e comprovantes nas rotinas corretas sem esforço manual.
                </p>
              </div>

              {/* Guia Didático da Forseti: O que é e Como Criar um Mapeamento */}
              <div className="onboarding-mapping-guide glass-card mt-3.5 p-4 border border-cyan/25 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-cyan shrink-0" />
                    <h4 className="text-xs font-bold text-cyan uppercase tracking-wider">
                      Como funciona a criação de Mapeamentos nas Naturezas?
                    </h4>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-cyan underline cursor-pointer flex items-center gap-1"
                    onClick={() => setShowMappingTutorial(!showMappingTutorial)}
                  >
                    <BookOpen size={13} />
                    <span>{showMappingTutorial ? 'Ocultar Guia Didático' : 'Como Criar Mapeamentos'}</span>
                  </button>
                </div>

                {showMappingTutorial && (
                  <div className="space-y-3 text-xs text-slate-300 mt-3 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-1.5 mb-1 text-white font-bold">
                          <span className="w-5 h-5 rounded-full bg-cyan/20 text-cyan text-[11px] flex items-center justify-center font-bold">1</span>
                          <span>Escolha a Natureza</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          A Natureza representa o grupo orçamentário maior (ex: 🍽️ Alimentação ou 🏠 Moradia).
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-1.5 mb-1 text-white font-bold">
                          <span className="w-5 h-5 rounded-full bg-cyan/20 text-cyan text-[11px] flex items-center justify-center font-bold">2</span>
                          <span>Crie a Rotina de Gasto</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          Dê nome à rotina (ex: 🥦 Feira Semanal) e defina a periodicidade (Semanal, Quinzenal ou Mensal).
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-1.5 mb-1 text-white font-bold">
                          <span className="w-5 h-5 rounded-full bg-cyan/20 text-cyan text-[11px] flex items-center justify-center font-bold">3</span>
                          <span>Adicione os Itens</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          Lançe itens com quantidade e preço. O Balder calcula a multiplicação mensal automaticamente!
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-950/30 to-slate-900/40 border border-cyan-500/20 flex items-start gap-2.5">
                      <ListChecks size={18} className="text-cyan shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed text-slate-300">
                        <strong className="text-white">Cálculo Matemático Automático:</strong> Se você gasta <strong>R$ 65</strong> na feira todo sábado, o Balder multiplica pelas <strong>4 semanas do mês</strong> (total de <strong>R$ 260/mês</strong>). Somando feira, supermercado e açougue, o seu teto mensal fica matematicamente justificado e auditável pela Forseti.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Opção Inteligente de Inicialização com Mapeamentos Sugeridos */}
              <div className="mt-3.5 p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900/50 to-emerald-950/40 border border-cyan-500/30 shadow-md">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-cyan w-4 h-4 rounded cursor-pointer"
                    checked={autoLoadMappings}
                    onChange={(e) => setAutoLoadMappings(e.target.checked)}
                  />
                  <div>
                    <strong className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Ativar Mapeamentos Modelos da Forseti automaticamente</span>
                      <span className="badge-pill badge-pill-cyan text-[9px]">Recomendado</span>
                    </strong>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Cria rotinas reais pré-configuradas (Supermercado, Feira, Açougue e Contas) com itens e preços de referência para você apenas conferir e ajustar na tela de Naturezas.
                    </span>
                  </div>
                </label>
              </div>

              {/* Resumo consolidado da calibração */}
              <div className="onboarding-summary-chips mt-4">
                <div className="summary-chip">
                  <Flag size={14} className="text-cyan" />
                  <span>Ponto de Partida: {startDate ? startDate.split('-').reverse().join('/') : 'Atual'}</span>
                </div>
                {hasSalary && parseNumber(salaryAmount) > 0 && (
                  <div className="summary-chip">
                    <Briefcase size={14} className="text-emerald" />
                    <span>Salário Configurado: {Number(salaryAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                )}
                {hasCards && (
                  <div className="summary-chip">
                    <CreditCard size={14} className="text-purple-400" />
                    <span>Faturas Mapeadas</span>
                  </div>
                )}
                <div className="summary-chip">
                  <Layers size={14} className="text-emerald" />
                  <span>{selectedNatures.length} Naturezas & Tetos</span>
                </div>
              </div>

              {/* Banner de Erro caso ocorra */}
              {finishError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 mt-3">
                  <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                  <span>{finishError}</span>
                </div>
              )}

              {/* Botões de Ação da Etapa 5 */}
              <div className="onboarding-step-actions mt-4">
                <button
                  type="button"
                  className="btn btn-outline flex items-center gap-1.5"
                  onClick={() => setCurrentStep(4)}
                  disabled={isFinishing}
                >
                  <ArrowLeft size={16} />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex items-center gap-2 px-8 py-2.5 font-bold text-sm shadow-xl"
                  onClick={handleFinishCalibration}
                  disabled={isFinishing}
                >
                  {isFinishing ? (
                    <span>Calibrando Balder...</span>
                  ) : (
                    <>
                      <Sparkles size={16} className="text-amber-300" />
                      <span>Concluir Calibração e Ativar Balder</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
