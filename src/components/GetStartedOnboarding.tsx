import React, { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  Flag,
  CreditCard,
  Tag,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Building2,
  DollarSign,
  Calendar,
  Plus,
  Trash2,
} from 'lucide-react';

interface GetStartedOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: number; // 1 = Ponto de Partida, 2 = Faturas, 3 = Naturezas
  onComplete?: () => void;
}

// Naturezas recomendadas com ícones, cores e tetos padrão
const DEFAULT_RECOMMENDED_NATURES = [
  {
    id: 'nat_alimentacao',
    name: 'Alimentação & Supermercado',
    icon: '🍽️',
    color: '#10b981', // emerald
    suggestedCeiling: 1800,
    type: 'ESSENCIAL' as const,
    description: 'Compras de supermercado, feira, açougue e refeições diárias',
  },
  {
    id: 'nat_moradia',
    name: 'Moradia & Contas Fixas',
    icon: '🏠',
    color: '#06b6d4', // cyan
    suggestedCeiling: 2200,
    type: 'FIXA' as const,
    description: 'Aluguel/condomínio, energia, água, internet e serviços essenciais',
  },
  {
    id: 'nat_transporte',
    name: 'Transporte & Mobilidade',
    icon: '🚗',
    color: '#f59e0b', // amber
    suggestedCeiling: 650,
    type: 'VARIAVEL' as const,
    description: 'Combustível, aplicativos (Uber/99), estacionamento e manutenção',
  },
  {
    id: 'nat_saude',
    name: 'Saúde & Cuidados',
    icon: '💊',
    color: '#8b5cf6', // purple
    suggestedCeiling: 450,
    type: 'ESSENCIAL' as const,
    description: 'Farmácia, consultas, exames, plano de saúde e bem-estar',
  },
  {
    id: 'nat_lazer',
    name: 'Lazer & Estilo de Vida',
    icon: '🎉',
    color: '#ec4899', // pink
    suggestedCeiling: 600,
    type: 'VARIAVEL' as const,
    description: 'Restaurantes, saídas, streaming, delivery e passeios',
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
    natures,
    activeCheckpoint,
  } = useFinancial();

  const [currentStep, setCurrentStep] = useState<number>(initialStep);

  // -------------------------------------------------------------
  // PASSO 1: Ponto de Partida
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

  // -------------------------------------------------------------
  // PASSO 2: Faturas de Cartão em Aberto (Atual & Futura)
  // -------------------------------------------------------------
  const [hasCards, setHasCards] = useState<boolean>(true);
  const [cardName, setCardName] = useState('Cartão Principal');
  const [cardBank, setCardBank] = useState('Nubank');
  const [cardDueDay, setCardDueDay] = useState(10);
  const [currentInvoiceAmount, setCurrentInvoiceAmount] = useState<string>('');
  const [futureInvoiceAmount, setFutureInvoiceAmount] = useState<string>('');
  const [hasSecondCard, setHasSecondCard] = useState<boolean>(false);
  const [secondCardName, setSecondCardName] = useState('Segundo Cartão');
  const [secondCardBank, setSecondCardBank] = useState('Inter');
  const [secondCardDueDay, setSecondCardDueDay] = useState(20);
  const [secondCurrentInvoice, setSecondCurrentInvoice] = useState<string>('');
  const [secondFutureInvoice, setSecondFutureInvoice] = useState<string>('');

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
    // Se o usuário já tiver naturezas, usa as existentes, caso contrário usa as recomendadas
    if (natures.length > 0) {
      return natures.map((n) => ({
        id: n.id,
        name: n.name,
        icon: n.icon || '🏷️',
        color: n.color || '#06b6d4',
        ceiling: (n as any).ceiling || 1000,
        type: n.type || 'VARIAVEL',
        description: n.description || '',
      }));
    }
    return DEFAULT_RECOMMENDED_NATURES.map((d) => ({
      id: d.id,
      name: d.name,
      icon: d.icon,
      color: d.color,
      ceiling: d.suggestedCeiling,
      type: d.type,
      description: d.description,
    }));
  });

  const [newNatureName, setNewNatureName] = useState('');
  const [newNatureCeiling, setNewNatureCeiling] = useState('');
  const [newNatureIcon, setNewNatureIcon] = useState('⚡');
  const [showAddNatureRow, setShowAddNatureRow] = useState(false);

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

  const handleFinishCalibration = () => {
    setIsFinishing(true);

    try {
      const parsedBalance = parseNumber(initialBalance);
      const parsedCurrentInv = parseNumber(currentInvoiceAmount);
      const parsedFutureInv = parseNumber(futureInvoiceAmount);

      const parsedSecondCurr = parseNumber(secondCurrentInvoice);
      const parsedSecondFut = parseNumber(secondFutureInvoice);

      const totalCardDebt =
        (hasCards ? parsedCurrentInv + parsedFutureInv : 0) +
        (hasSecondCard ? parsedSecondCurr + parsedSecondFut : 0);

      // 1. Cria ou Atualiza o Checkpoint (Ponto de Partida)
      addCheckpoint({
        label: `Marco Inicial (${startDate.split('-').reverse().join('/')})`,
        startDate: startDate || firstDayOfMonthStr,
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
                  {
                    monthIndex: 0,
                    monthLabel: 'Fatura Atual (Em Aberto)',
                    dueDate: `${startDate.substring(0, 7)}-${String(cardDueDay).padStart(2, '0')}`,
                    amount: parsedCurrentInv,
                  },
                  {
                    monthIndex: 1,
                    monthLabel: 'Fatura Futura (Comprometida)',
                    dueDate: `${startDate.substring(0, 7)}-${String(cardDueDay).padStart(2, '0')}`,
                    amount: parsedFutureInv,
                  },
                ],
                totalDebt: parsedCurrentInv + parsedFutureInv,
              },
              ...(hasSecondCard
                ? [
                    {
                      id: `debt_card_2`,
                      bankName: secondCardBank || 'Inter',
                      cardName: secondCardName || 'Segundo Cartão',
                      dueDay: secondCardDueDay,
                      invoices: [
                        {
                          monthIndex: 0,
                          monthLabel: 'Fatura Atual',
                          dueDate: `${startDate.substring(0, 7)}-${String(secondCardDueDay).padStart(2, '0')}`,
                          amount: parsedSecondCurr,
                        },
                        {
                          monthIndex: 1,
                          monthLabel: 'Fatura Futura',
                          dueDate: `${startDate.substring(0, 7)}-${String(secondCardDueDay).padStart(2, '0')}`,
                          amount: parsedSecondFut,
                        },
                      ],
                      totalDebt: parsedSecondCurr + parsedSecondFut,
                    },
                  ]
                : []),
            ]
          : [],
      });

      // 2. Se informou saldo inicial, garante que há uma Conta Bancária registrada
      if (parsedBalance > 0 && mainBankName) {
        addAccount({
          name: `Conta ${mainBankName}`,
          bankName: mainBankName,
          balance: parsedBalance,
          type: 'CORRENTE',
          color: '#10b981',
          icon: '🏦',
        });
      }

      // 3. Cadastra o(s) Cartão(ões) de Crédito se informado
      if (hasCards) {
        addCard({
          name: cardName || 'Cartão Principal',
          bank: cardBank || 'Nubank',
          brand: 'MASTERCARD',
          limitTotal: Math.max(5000, (parsedCurrentInv + parsedFutureInv) * 1.5),
          closingDay: Math.max(1, cardDueDay - 7),
          dueDay: cardDueDay,
          color: '#8b5cf6',
        });

        // Adiciona movimento previsto para a fatura atual
        if (parsedCurrentInv > 0) {
          addMovement({
            title: `Fatura ${cardName || 'Cartão'} (Atual)`,
            amount: parsedCurrentInv,
            dueDate: `${startDate.substring(0, 7)}-${String(cardDueDay).padStart(2, '0')}`,
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
          limitTotal: Math.max(4000, (parsedSecondCurr + parsedSecondFut) * 1.5),
          closingDay: Math.max(1, secondCardDueDay - 7),
          dueDay: secondCardDueDay,
          color: '#f59e0b',
        });

        addMovement({
          title: `Fatura ${secondCardName} (Atual)`,
          amount: parsedSecondCurr,
          dueDate: `${startDate.substring(0, 7)}-${String(secondCardDueDay).padStart(2, '0')}`,
          type: 'CARTAO',
          status: 'PREVISTA',
          category: 'Fatura de Cartão',
          bank: secondCardBank,
        });
      }

      // 4. Salva as Naturezas selecionadas com seus tetos
      if (natures.length === 0 && selectedNatures.length > 0) {
        selectedNatures.forEach((nat) => {
          addNature({
            name: nat.name,
            icon: nat.icon,
            color: nat.color,
            type: nat.type,
            description: nat.description,
          });
        });
      }

      // Marca onboarding como completado no localStorage
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_onboarding_completed_${user.$id}`, 'true');
      } else {
        localStorage.setItem('balder_onboarding_completed_guest', 'true');
      }

      setCurrentStep(4); // Passo final de celebração
    } catch (err) {
      console.error('Erro ao finalizar calibração:', err);
    } finally {
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
            <div className="onboarding-step-counter">
              <span>Etapa {Math.min(currentStep, 3)} de 3</span>
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
              width:
                currentStep === 1
                  ? '33%'
                  : currentStep === 2
                  ? '66%'
                  : '100%',
            }}
          />
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
                  Para que eu possa projetar seu futuro financeiro e auditar seus gastos com precisão
                  cirúrgica, precisamos de um <strong>Ponto de Partida</strong>.
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  A partir de qual data e com quanto em dinheiro disponível você deseja começar a
                  monitorar?
                </p>
              </div>

              {/* Card do Formulário do Ponto de Partida */}
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
                      Soma do saldo em conta corrente e carteiras hoje.
                    </span>
                  </div>
                </div>

                <div className="form-group mt-3">
                  <label className="flex items-center gap-1.5 font-semibold text-xs text-slate-300">
                    <Building2 size={14} className="text-cyan" />
                    <span>Banco / Conta Principal:</span>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {['Nubank', 'Inter', 'Itaú', 'Bradesco', 'Santander', 'Caixa'].map(
                      (b) => (
                        <button
                          key={b}
                          type="button"
                          className={`onboarding-pill-btn ${
                            mainBankName === b ? 'active' : ''
                          }`}
                          onClick={() => setMainBankName(b)}
                        >
                          {b}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Botões de Ação do Passo 1 */}
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
                  <span>Continuar para Faturas</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PASSO 2: FATURAS DE CARTÃO EM ABERTO                    */}
          {/* ======================================================== */}
          {currentStep === 2 && (
            <div className="onboarding-step-view animate-fade-in">
              <div className="forseti-speech-bubble">
                <div className="forseti-bubble-header">
                  <CreditCard size={16} className="text-cyan" />
                  <strong>Passo 2: Faturas de Cartão de Crédito em Aberto</strong>
                </div>
                <p>
                  Excelente! O segundo ponto crucial é registrar suas faturas de cartão. Compras
                  parceladas e faturas não provisionadas são o principal motivo de surpresas no
                  final do mês.
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Informe o valor da fatura que vence neste mês (atual) e o valor aproximado já
                  comprometido para o próximo mês (futura).
                </p>
              </div>

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
                    <div className="form-grid-3">
                      <div className="form-group">
                        <label className="text-xs text-slate-300 font-medium">
                          Nome do Cartão / Banco:
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          placeholder="Ex: Nubank Roxinho"
                        />
                      </div>
                      <div className="form-group">
                        <label className="text-xs text-slate-300 font-medium">
                          Dia de Vencimento:
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          className="form-input"
                          value={cardDueDay}
                          onChange={(e) => setCardDueDay(Number(e.target.value))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="text-xs text-slate-300 font-medium">
                          Instituição:
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={cardBank}
                          onChange={(e) => setCardBank(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-grid-2 mt-3">
                      <div className="form-group">
                        <label className="text-xs text-amber-300 font-semibold flex items-center gap-1">
                          <span>Fatura Atual em Aberto (R$):</span>
                        </label>
                        <input
                          type="text"
                          className="form-input text-base font-bold text-amber-400"
                          placeholder="Ex: 1.250,00"
                          value={currentInvoiceAmount}
                          onChange={(e) => setCurrentInvoiceAmount(e.target.value)}
                        />
                        <span className="text-[10px] text-muted">
                          Gastos que vencem na próxima data de vencimento.
                        </span>
                      </div>

                      <div className="form-group">
                        <label className="text-xs text-cyan-300 font-semibold flex items-center gap-1">
                          <span>Fatura Futura Prevista (R$):</span>
                        </label>
                        <input
                          type="text"
                          className="form-input text-base font-bold text-cyan-400"
                          placeholder="Ex: 840,00"
                          value={futureInvoiceAmount}
                          onChange={(e) => setFutureInvoiceAmount(e.target.value)}
                        />
                        <span className="text-[10px] text-muted">
                          Parcelas de compras já feitas para o mês seguinte.
                        </span>
                      </div>
                    </div>

                    {/* Adicionar Segundo Cartão Opcional */}
                    {!hasSecondCard ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm mt-3 flex items-center gap-1.5 text-xs"
                        onClick={() => setHasSecondCard(true)}
                      >
                        <Plus size={13} />
                        <span>Adicionar Outro Cartão de Crédito</span>
                      </button>
                    ) : (
                      <div className="mt-4 pt-3 border-t border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-xs text-slate-300">
                            Cartão de Crédito 2
                          </span>
                          <button
                            type="button"
                            className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 cursor-pointer"
                            onClick={() => setHasSecondCard(false)}
                          >
                            <Trash2 size={12} />
                            <span>Remover</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <input
                            type="text"
                            className="form-input text-xs"
                            value={secondCardName}
                            onChange={(e) => setSecondCardName(e.target.value)}
                            placeholder="Nome Cartão 2"
                          />
                          <input
                            type="text"
                            className="form-input text-xs"
                            value={secondCardBank}
                            onChange={(e) => setSecondCardBank(e.target.value)}
                            placeholder="Banco (ex: Inter)"
                          />
                          <input
                            type="number"
                            min="1"
                            max="31"
                            className="form-input text-xs"
                            value={secondCardDueDay}
                            onChange={(e) => setSecondCardDueDay(Number(e.target.value))}
                            placeholder="Dia Venc."
                            title="Dia do Vencimento"
                          />
                          <input
                            type="text"
                            className="form-input text-xs"
                            placeholder="Fatura Atual R$"
                            value={secondCurrentInvoice}
                            onChange={(e) => setSecondCurrentInvoice(e.target.value)}
                          />
                          <input
                            type="text"
                            className="form-input text-xs"
                            placeholder="Fatura Futura R$"
                            value={secondFutureInvoice}
                            onChange={(e) => setSecondFutureInvoice(e.target.value)}
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
                  <span>Continuar para Naturezas</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PASSO 3: NATUREZAS & TETOS DE GASTOS                     */}
          {/* ======================================================== */}
          {currentStep === 3 && (
            <div className="onboarding-step-view animate-fade-in">
              <div className="forseti-speech-bubble">
                <div className="forseti-bubble-header">
                  <Tag size={16} className="text-emerald" />
                  <strong>Passo 3: Naturezas Orçamentárias & Tetos de Gastos</strong>
                </div>
                <p>
                  Quase lá! No Balder, não usamos categorias chatas e soltas: nós definimos{' '}
                  <strong>Naturezas com tetos de gastos</strong>. Eu fico de olho nesses tetos em
                  tempo real para te avisar se houver risco de estouro.
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Revise as naturezas recomendadas abaixo e ajuste o teto mensal estimado para o seu
                  estilo de vida:
                </p>
              </div>

              <div className="onboarding-natures-container">
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

              <div className="onboarding-step-actions">
                <button
                  type="button"
                  className="btn btn-outline flex items-center gap-1.5"
                  onClick={() => setCurrentStep(2)}
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

          {/* ======================================================== */}
          {/* PASSO 4: SUCESSO & CELEBRAÇÃO                            */}
          {/* ======================================================== */}
          {currentStep === 4 && (
            <div className="onboarding-step-view animate-fade-in text-center py-6">
              <div className="onboarding-success-badge">
                <CheckCircle2 size={48} className="text-emerald" />
              </div>

              <h2 className="text-2xl font-extrabold text-white mt-3">
                Sistema 100% Calibrado pela Forseti!
              </h2>

              <p className="text-sm text-slate-300 max-w-md mx-auto mt-2 leading-relaxed">
                Excelente trabalho, <strong>{user?.name || 'Vinicius'}</strong>! Seu Ponto de Partida,
                suas faturas em aberto e suas naturezas orçamentárias foram salvos e sincronizados.
              </p>

              <div className="onboarding-summary-chips mt-5">
                <div className="summary-chip">
                  <Flag size={14} className="text-cyan" />
                  <span>Ponto de Partida Ativo</span>
                </div>
                <div className="summary-chip">
                  <CreditCard size={14} className="text-purple-400" />
                  <span>Faturas Provisionadas</span>
                </div>
                <div className="summary-chip">
                  <Tag size={14} className="text-emerald" />
                  <span>{selectedNatures.length} Naturezas com Tetos</span>
                </div>
              </div>

              <div className="mt-8">
                <button
                  type="button"
                  className="btn btn-primary px-8 py-3 text-base font-bold shadow-2xl inline-flex items-center gap-2 cursor-pointer"
                  onClick={() => {
                    onClose();
                    if (onComplete) onComplete();
                  }}
                >
                  <span>Acessar Meu Dinheiro (Dashboard)</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
