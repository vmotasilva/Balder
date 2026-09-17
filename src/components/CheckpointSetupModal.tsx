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
} from 'lucide-react';

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

// Gera as datas de vencimento mensais subsequentes respeitando o dia alvo e viradas de ano/mês
const generateMonthlyDueDates = (firstDueDateStr: string, totalMonths: number): string[] => {
  const dates: string[] = [];
  const parts = firstDueDateStr.split('-').map(Number);
  const firstYear = parts[0] || new Date().getFullYear();
  const firstMonth = parts[1] || (new Date().getMonth() + 1); // 1-12
  const targetDay = parts[2] || 10;

  for (let i = 0; i < totalMonths; i++) {
    const d = new Date(firstYear, firstMonth - 1 + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-indexed
    const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
    const actualDay = Math.min(targetDay, lastDayOfMonth);
    const dueStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
    dates.push(dueStr);
  }
  return dates;
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

  // Estados para Dívida de Cartão de Crédito
  const [hasCreditCardDebt, setHasCreditCardDebt] = useState(false);
  const [creditCardDebt, setCreditCardDebt] = useState<string>('0');
  const [cardInstallments, setCardInstallments] = useState<number>(1);
  const [debtInputMode, setDebtInputMode] = useState<'TOTAL' | 'PER_MONTH'>('TOTAL');
  const [installmentAmountInput, setInstallmentAmountInput] = useState<string>('0');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [customCardName, setCustomCardName] = useState<string>('');
  const [cardDueDate, setCardDueDate] = useState<string>('');
  const [launchAsMovement, setLaunchAsMovement] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setSavedSuccess(false);
      if (activeCheckpoint && !isInitialSetup) {
        setStartDate(activeCheckpoint.startDate || getTodayString());
        setInitialBalance(String(activeCheckpoint.initialBalance || 0));
        setLabel(`Recomeço ${new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`);
        if (activeCheckpoint.creditCardDebt && activeCheckpoint.creditCardDebt > 0) {
          setHasCreditCardDebt(true);
          setCreditCardDebt(String(activeCheckpoint.creditCardDebt));
          setCardDueDate(activeCheckpoint.cardDueDate || '');
          setCustomCardName(activeCheckpoint.cardName || '');
          const inst = activeCheckpoint.cardInstallments || 1;
          setCardInstallments(inst);
          setDebtInputMode('TOTAL');
          const perM = Math.round((activeCheckpoint.creditCardDebt / inst) * 100) / 100;
          setInstallmentAmountInput(String(perM));
        } else {
          setHasCreditCardDebt(false);
          setCreditCardDebt('0');
          setCardInstallments(1);
          setDebtInputMode('TOTAL');
          setInstallmentAmountInput('0');
        }
      } else {
        const firstDay = getFirstDayOfMonthString();
        setStartDate(firstDay);
        setInitialBalance('0');
        setLabel(isInitialSetup ? 'Ponto de Partida Inicial' : '');
        setHasCreditCardDebt(false);
        setCreditCardDebt('0');
        setCardInstallments(1);
        setDebtInputMode('TOTAL');
        setInstallmentAmountInput('0');
        setSelectedCardId(cards[0]?.id || '');
        setCustomCardName('');

        // Vencimento padrão: dia 10 do mês do marco
        const [y, m] = firstDay.split('-');
        setCardDueDate(`${y}-${m}-10`);
      }
    }
  }, [isOpen, activeCheckpoint, isInitialSetup, cards]);

  const handleCardSelect = (cardId: string) => {
    setSelectedCardId(cardId);
    const card = cards.find((c) => c.id === cardId);
    if (card && card.dueDay) {
      const baseDate = new Date((startDate || getTodayString()) + 'T12:00:00');
      let year = baseDate.getFullYear();
      let month = baseDate.getMonth();
      if (baseDate.getDate() > card.dueDay) {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
      const dueStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(card.dueDay, 28)).padStart(2, '0')}`;
      setCardDueDate(dueStr);
    }
  };

  const initialCashNum = parseBRLNumber(initialBalance);
  const numInstallments = Math.max(1, cardInstallments);
  const rawDebtNum = debtInputMode === 'PER_MONTH'
    ? parseBRLNumber(installmentAmountInput) * numInstallments
    : parseBRLNumber(creditCardDebt);
  const debtNum = hasCreditCardDebt ? rawDebtNum : 0;
  const netStartingBalance = initialCashNum - debtNum;

  const calculatedMonthly = debtNum > 0 ? Math.round((debtNum / numInstallments) * 100) / 100 : 0;

  const dueDatesPreview = useMemo(() => {
    if (!cardDueDate || numInstallments <= 1) return [];
    return generateMonthlyDueDates(cardDueDate, numInstallments);
  }, [cardDueDate, numInstallments]);

  const lastDueDate = dueDatesPreview.length > 0 ? dueDatesPreview[dueDatesPreview.length - 1] : '';

  const handleInstallmentsChange = (num: number) => {
    const cleanNum = Math.max(1, Math.min(60, num));
    setCardInstallments(cleanNum);
    if (debtInputMode === 'PER_MONTH') {
      const perM = parseBRLNumber(installmentAmountInput);
      setCreditCardDebt(String(perM * cleanNum));
    } else {
      const tot = parseBRLNumber(creditCardDebt);
      setInstallmentAmountInput(String(Math.round((tot / cleanNum) * 100) / 100));
    }
  };

  const handleDebtModeToggle = (mode: 'TOTAL' | 'PER_MONTH') => {
    setDebtInputMode(mode);
    if (mode === 'PER_MONTH') {
      const tot = parseBRLNumber(creditCardDebt);
      setInstallmentAmountInput(String(Math.round((tot / numInstallments) * 100) / 100));
    } else {
      const perM = parseBRLNumber(installmentAmountInput);
      if (perM > 0) {
        setCreditCardDebt(String(perM * numInstallments));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const balanceNum = initialCashNum;
    const selectedCard = cards.find((c) => c.id === selectedCardId);
    const resolvedCardName = selectedCard ? selectedCard.name : (customCardName.trim() || 'Cartão de Crédito');
    const baseInstallmentAmount = debtNum > 0 ? Math.round((debtNum / numInstallments) * 100) / 100 : undefined;

    addCheckpoint({
      startDate: startDate || getTodayString(),
      initialBalance: balanceNum,
      creditCardDebt: debtNum > 0 ? debtNum : undefined,
      cardDueDate: debtNum > 0 && cardDueDate ? cardDueDate : undefined,
      cardName: debtNum > 0 ? resolvedCardName : undefined,
      cardInstallments: debtNum > 0 ? numInstallments : undefined,
      cardInstallmentAmount: debtNum > 0 ? baseInstallmentAmount : undefined,
      label: label.trim() || (isInitialSetup ? 'Ponto de Partida Inicial' : `Marco de ${startDate}`),
    });

    // Se solicitado, lança as parcelas de fatura no extrato e fluxo de caixa
    if (hasCreditCardDebt && debtNum > 0 && launchAsMovement) {
      const firstDue = cardDueDate || startDate || getTodayString();
      const dueDates = generateMonthlyDueDates(firstDue, numInstallments);
      const installmentGroupId = `card_debt_${Date.now()}`;

      dueDates.forEach((dDate, index) => {
        const instNum = index + 1;
        // Ajuste de arredondamento de centavos na última parcela se houver dízima
        const currentAmount = instNum === numInstallments
          ? Math.round((debtNum - (baseInstallmentAmount || 0) * (numInstallments - 1)) * 100) / 100
          : (baseInstallmentAmount || debtNum);

        addMovement({
          title: numInstallments > 1
            ? `Fatura ${resolvedCardName} (${instNum}/${numInstallments})`
            : `Fatura ${resolvedCardName} (Saldo Devedor Inicial)`,
          type: 'CARTAO',
          amount: currentAmount,
          dueDate: dDate,
          bank: selectedCard ? selectedCard.bank : 'Cartão de Crédito',
          status: 'PREVISTA',
          category: 'Fatura de Cartão',
          installmentNumber: instNum,
          installmentsTotal: numInstallments,
          installmentGroupId,
          notes: `Dívida de cartão cadastrada no Ponto de Partida (${startDate})${numInstallments > 1 ? ` - Parcela ${instNum} de ${numInstallments}` : ''}`,
        });
      });

      if (selectedCard) {
        updateCard(selectedCard.id, { limitUsed: debtNum });
      }
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
          ? 'Defina a data e o saldo inicial em caixa a partir de quando suas métricas serão calculadas.'
          : 'Inicie uma nova fase de acompanhamento sem perder seu histórico anterior.'
      }
      maxWidth="550px"
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
              O sistema utiliza a <strong>data de início</strong> e o <strong>saldo em caixa</strong> como âncora principal para calibrar seu saldo disponível e projeções futuras.
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
                onClick={() => setStartDate(getFirstDayOfMonthString())}
              >
                1º do Mês
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                onClick={() => setStartDate(getTodayString())}
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
            onChange={(e) => setStartDate(e.target.value)}
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

        {/* Opção: Cadastrar Dívida de Cartão de Crédito */}
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
                  Cadastrar Dívida / Fatura de Cartão de Crédito
                </span>
                <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>
                  {hasCreditCardDebt
                    ? 'Fatura em aberto será deduzida do patrimônio e lançada no fluxo'
                    : 'Clique para informar fatura ou saldo devedor nesta data'}
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

          {hasCreditCardDebt && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', paddingTop: '0.35rem', borderTop: '1px solid rgba(244, 63, 94, 0.15)' }}>
              {/* Em quantos meses a dívida se divide? */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.78rem', margin: 0 }}>
                    <CalendarDays size={13} className="text-cyan" />
                    Em quantos meses essa dívida se divide?
                  </label>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {cardInstallments === 1 ? 'Fatura única (1 mês)' : `Parcelado em ${cardInstallments} meses`}
                  </span>
                </div>

                {/* Atalhos rápidos de parcelas */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '0.45rem' }}>
                  {[1, 2, 3, 4, 5, 6, 10, 12, 18, 24].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleInstallmentsChange(num)}
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: cardInstallments === num ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        border: cardInstallments === num ? '1px solid rgba(6, 182, 212, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: cardInstallments === num ? '#38bdf8' : 'var(--text-secondary)',
                        fontWeight: cardInstallments === num ? 700 : 500,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {num === 1 ? '1x (À Vista)' : `${num}x`}
                    </button>
                  ))}
                </div>

                {/* Seletor numérico para parcelas customizadas */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ou digite a quantidade:</span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={cardInstallments}
                    onChange={(e) => handleInstallmentsChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="form-input"
                    style={{ width: '68px', padding: '3px 8px', fontSize: '0.8rem', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>meses/parcelas</span>
                </div>
              </div>

              {/* Valor da Dívida / Fatura (com alternador Total vs Parcela quando > 1) */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.78rem', margin: 0 }}>
                    <DollarSign size={13} className="text-rose-400" />
                    {debtInputMode === 'TOTAL' ? 'Valor Total da Dívida Acumulada (R$)' : 'Valor da Parcela Mensal (R$)'}
                  </label>

                  {cardInstallments > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleDebtModeToggle('TOTAL')}
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          background: debtInputMode === 'TOTAL' ? 'rgba(244, 63, 94, 0.25)' : 'transparent',
                          color: debtInputMode === 'TOTAL' ? '#F43F5E' : 'var(--text-muted)',
                          fontWeight: debtInputMode === 'TOTAL' ? 700 : 500,
                        }}
                      >
                        Total
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDebtModeToggle('PER_MONTH')}
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          background: debtInputMode === 'PER_MONTH' ? 'rgba(6, 182, 212, 0.25)' : 'transparent',
                          color: debtInputMode === 'PER_MONTH' ? '#38bdf8' : 'var(--text-muted)',
                          fontWeight: debtInputMode === 'PER_MONTH' ? 700 : 500,
                        }}
                      >
                        Por Mês
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontWeight: 700,
                      color: debtInputMode === 'TOTAL' ? '#F43F5E' : 'var(--accent-cyan)',
                      fontSize: '0.9rem',
                    }}
                  >
                    R$
                  </span>
                  <input
                    type="text"
                    required={hasCreditCardDebt}
                    className="form-input"
                    style={{
                      paddingLeft: '40px',
                      fontWeight: 700,
                      color: debtInputMode === 'TOTAL' ? '#F43F5E' : 'var(--accent-cyan)',
                      fontSize: '1rem',
                    }}
                    placeholder="0,00"
                    value={debtInputMode === 'TOTAL' ? creditCardDebt : installmentAmountInput}
                    onFocus={(e) => {
                      if (e.target.value === '0') {
                        if (debtInputMode === 'TOTAL') setCreditCardDebt('');
                        else setInstallmentAmountInput('');
                      }
                    }}
                    onChange={(e) => {
                      if (debtInputMode === 'TOTAL') {
                        setCreditCardDebt(e.target.value);
                        const val = parseBRLNumber(e.target.value);
                        if (cardInstallments > 0) {
                          setInstallmentAmountInput(String(Math.round((val / cardInstallments) * 100) / 100));
                        }
                      } else {
                        setInstallmentAmountInput(e.target.value);
                        const val = parseBRLNumber(e.target.value);
                        setCreditCardDebt(String(val * cardInstallments));
                      }
                    }}
                  />
                </div>
              </div>

              {/* Card de Resumo de Parcelamento em Vários Meses */}
              {cardInstallments > 1 && (
                <div
                  style={{
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%)',
                    border: '1px solid rgba(6, 182, 212, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    fontSize: '0.73rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                    <span className="text-muted">Desembolso Mensal:</span>
                    <strong className="text-white">
                      {cardInstallments}x de {calculatedMonthly.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                    <span className="text-muted">Total Acumulado:</span>
                    <strong className="text-rose-400">
                      {debtNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </div>
                  {cardDueDate && lastDueDate && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px', paddingTop: '3px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <span className="text-muted">Período de Cobertura:</span>
                      <span className="text-cyan font-mono" style={{ fontSize: '0.7rem' }}>
                        {cardDueDate.split('-').reverse().join('/')} até {lastDueDate.split('-').reverse().join('/')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Cartão & 1º Vencimento (2 Colunas) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Cartão de Crédito
                  </label>
                  {cards.length > 0 ? (
                    <select
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                      value={selectedCardId}
                      onChange={(e) => handleCardSelect(e.target.value)}
                    >
                      <option value="">Geral / Outro</option>
                      {cards.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.bank})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                      placeholder="ex: Nubank Mastercard"
                      value={customCardName}
                      onChange={(e) => setCustomCardName(e.target.value)}
                    />
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    {cardInstallments > 1 ? '1º Vencimento' : 'Vencimento da Fatura'}
                  </label>
                  <input
                    type="date"
                    required={hasCreditCardDebt}
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                    value={cardDueDate}
                    onChange={(e) => setCardDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Checkbox de agendamento das faturas */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', cursor: 'pointer', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={launchAsMovement}
                  onChange={(e) => setLaunchAsMovement(e.target.checked)}
                  style={{ accentColor: 'var(--accent-cyan)', marginTop: '2px' }}
                />
                <span>
                  {cardInstallments > 1
                    ? `Lançar as ${cardInstallments} parcelas mensais no fluxo de caixa (uma a cada mês na data de vencimento)`
                    : 'Lançar fatura a pagar no fluxo de caixa na data de vencimento'}
                </span>
              </label>

              {/* Preview de Impacto no Patrimônio Líquido */}
              <div
                style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid var(--border-default)',
                  fontSize: '0.73rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span className="text-muted">Patrimônio Líquido Inicial (Caixa - Dívida Total):</span>
                <span style={{ fontWeight: 700, color: netStartingBalance >= 0 ? 'var(--accent-emerald)' : '#F43F5E' }}>
                  {netStartingBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              {cardInstallments > 1 && (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginTop: '-0.3rem', lineHeight: '1.25' }}>
                  * O total de {debtNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} é abatido do ponto de partida e suas parcelas reduzem o caixa mês a mês conforme forem sendo quitadas.
                </span>
              )}
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
