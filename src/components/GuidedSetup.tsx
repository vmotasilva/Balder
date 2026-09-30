import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, Trash2, Check } from 'lucide-react';
import { DecimalInput } from './DecimalInput';
import { useFinancial } from '../context/FinancialContext';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/supabaseService';
import { POPULAR_BANKS, getBankBranding } from '../utils/bankBranding';
import { BILL_GROUPS, COMMON_BILLS, clampDay, formatBRL, isoOf, nextDateForDay } from '../utils/setupCatalog';
import { Bubble, ForsetiTopicSetup } from './ForsetiTopicSetup';
import type { TrackingPeriod } from '../utils/periodSpending';
import type { ExpenseNature, FixedExpenseMapping, MappingItem, Movement } from '../types';
import { NumberInput } from './NumberInput';

type Step = 'NAME' | 'MODE' | 'MANUAL' | 'BANKS' | 'BALANCE' | 'INCOME' | 'BILLS' | 'CARD' | 'PERIOD' | 'DONE';

interface IncomeRow {
  name: string;
  amount: number;
  day: number;
  /** Paga em duas partes: adiantamento (advance*) + restante (amount/day). */
  split?: boolean;
  advanceAmount?: number;
  advanceDay?: number;
}

interface BillRow {
  key: string;
  name: string;
  amount: number;
  day: number;
}

interface CardRow {
  name: string;
  dueDay: number;
  /** Dia em que a fatura fecha (vazio: uma semana antes do vencimento). */
  closingDay?: number;
  amount: number;
}

/** A fatura costuma fechar uma semana antes do vencimento. */
const defaultClosingDay = (dueDay: number) => (dueDay - 7 >= 1 ? dueDay - 7 : dueDay - 7 + 30);
const incomeOf = (i: IncomeRow) => (i.amount || 0) + (i.split ? i.advanceAmount || 0 : 0);

/** Criadas sempre: onde a Forseti classifica os gastos do dia a dia. */
const EVERYDAY_NATURES = [
  { name: 'Alimentação & Mercado', icon: '🛒', color: '#10b981', type: 'ESSENCIAL' as const, keywords: ['mercado', 'supermercado', 'feira', 'padaria', 'acougue', 'hortifruti'] },
  { name: 'Comer Fora & Delivery', icon: '🍽️', color: '#f97316', type: 'VARIAVEL' as const, keywords: ['restaurante', 'ifood', 'lanchonete', 'pizzaria', 'delivery', 'rappi', 'bar'] },
];

const PERIOD_CADENCE: Record<TrackingPeriod, string> = { SEMANA: 'toda semana', QUINZENA: 'a cada quinzena', MES: 'todo mês' };
const PERIOD_ANSWER: Record<TrackingPeriod, string> = { SEMANA: 'Toda semana', QUINZENA: 'A cada quinzena', MES: 'Todo mês' };

interface GuidedSetupProps {
  onFinished: () => void;
}

/**
 * Configuração inicial conduzida pela Forseti, em conversa roteirizada: modo de uso, onde está o
 * dinheiro, renda, contas do mês, cartão e período de acompanhamento. Monta marco, contas,
 * recebimentos recorrentes, naturezas com as contas do mês e faturas. Quem prefere configurar tudo
 * segue na mesma conversa escolhendo os assuntos (ForsetiTopicSetup).
 */
export const GuidedSetup: React.FC<GuidedSetupProps> = ({ onFinished }) => {
  const { user } = useAuth();
  const {
    addCheckpoint,
    addBank,
    addAccount,
    addMultipleMovements,
    addMovement,
    addNature,
    addCard,
    banks,
    accounts,
    natures,
    setViewPreferences,
  } = useFinancial();

  const [step, setStep] = useState<Step>('NAME');
  const [nickname, setNickname] = useState(() => (user?.name || '').trim().split(/\s+/)[0] || '');
  const panelRef = useRef<HTMLDivElement>(null);
  // A cada resposta, traz a pergunta seguinte para a tela
  useEffect(() => {
    if (step !== 'NAME') panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [step]);
  const [history, setHistory] = useState<{ step: Step; question: string; answer: string }[]>([]);

  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [customBank, setCustomBank] = useState('');
  const [balance, setBalance] = useState(0);
  const [incomes, setIncomes] = useState<IncomeRow[]>([{ name: 'Salário', amount: 0, day: 5 }]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [customBill, setCustomBill] = useState('');
  const [usesCard, setUsesCard] = useState<boolean | null>(null);
  const [cardsInfo, setCardsInfo] = useState<CardRow[]>([{ name: '', dueDay: 10, amount: 0 }]);
  const [period, setPeriod] = useState<TrackingPeriod>('SEMANA');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const QUESTIONS: Record<Step, string> = {
    NAME: 'Oi! Eu sou a Forseti e vou te ajudar a organizar o seu dinheiro. Como você quer ser chamado?',
    MODE: `Prazer, ${nickname.trim() || 'tudo bem'}! Como você prefere usar o Balder?`,
    BANKS: 'Em quais bancos você tem conta?',
    BALANCE: 'Quanto você tem hoje, somando tudo?',
    INCOME: 'Quanto entra por mês?',
    BILLS: 'Quais contas você paga todo mês?',
    CARD: 'Você usa cartão de crédito?',
    PERIOD: 'Como você prefere acompanhar os gastos?',
    MANUAL: '',
    DONE: '',
  };

  const ORDER: Step[] = ['NAME', 'MODE', 'BANKS', 'BALANCE', 'INCOME', 'BILLS', 'CARD', 'PERIOD', 'DONE'];

  const advance = (answer: string) => {
    setHistory((prev) => [...prev.filter((h) => h.step !== step), { step, question: QUESTIONS[step], answer }]);
    setStep(ORDER[ORDER.indexOf(step) + 1]);
  };

  const goBack = () => {
    const prevStep = ORDER[ORDER.indexOf(step) - 1];
    if (!prevStep) return;
    setHistory((prev) => prev.filter((h) => h.step !== prevStep));
    setStep(prevStep);
  };

  const incomeTotal = incomes.reduce((acc, i) => acc + incomeOf(i), 0);
  const updateIncome = (idx: number, changes: Partial<IncomeRow>) =>
    setIncomes((prev) => prev.map((r, i) => (i === idx ? { ...r, ...changes } : r)));
  const incomeAnswer = () => {
    const parts = incomes
      .filter((i) => i.split && incomeOf(i) > 0)
      .map((i) => `${i.name.trim() || 'renda'} em duas partes: ${formatBRL(i.advanceAmount || 0)} no dia ${i.advanceDay ?? 20} e ${formatBRL(i.amount)} no dia ${i.day}`);
    return `${formatBRL(incomeTotal)} por mês${parts.length ? ` (${parts.join('; ')})` : ''}`;
  };
  const billsTotal = bills.reduce((acc, b) => acc + (b.amount || 0), 0);
  const cardsTotal = usesCard ? cardsInfo.reduce((acc, c) => acc + (c.amount || 0), 0) : 0;
  const monthlyLeft = Math.round((incomeTotal - billsTotal - cardsTotal) * 100) / 100;

  const toggleBank = (name: string) =>
    setSelectedBanks((prev) => (prev.includes(name) ? prev.filter((b) => b !== name) : [...prev, name]));

  const toggleBill = (key: string, name: string) =>
    setBills((prev) =>
      prev.some((b) => b.key === key) ? prev.filter((b) => b.key !== key) : [...prev, { key, name, amount: 0, day: 10 }]
    );

  const updateBill = (key: string, updates: Partial<BillRow>) =>
    setBills((prev) => prev.map((b) => (b.key === key ? { ...b, ...updates } : b)));

  const save = () => {
    setSaving(true);
    setError(null);
    try {
      const today = new Date();
      const todayIso = isoOf(today);
      const monthKey = todayIso.slice(0, 7);
      const stamp = Date.now();
      const cardsToSave = usesCard ? cardsInfo.filter((c) => c.name.trim() || c.amount > 0) : [];

      // 1. Marco: o acompanhamento começa hoje, com o saldo informado
      addCheckpoint({
        label: `Início do acompanhamento (${todayIso.split('-').reverse().join('/')})`,
        startDate: todayIso,
        initialBalance: balance,
        creditCardDebt: cardsTotal,
        initialNetWorth: balance - cardsTotal,
        notes: 'Configuração guiada pela Forseti',
      });

      // 2. Bancos e contas (o saldo fica na primeira conta)
      selectedBanks.forEach((name, idx) => {
        const brand = getBankBranding(name);
        if (!banks.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
          addBank({ name, color: brand.primaryColor, icon: brand.iconText || '🏦', status: 'MANUAL', syncedAt: 'Ativo no Balder' });
        }
        if (!accounts.some((a) => (a.bankName || a.name).toLowerCase() === name.toLowerCase())) {
          addAccount({
            name: `Conta ${name}`,
            bankName: name,
            balance: idx === 0 ? balance : 0,
            type: 'CORRENTE',
            color: brand.primaryColor,
            icon: '🏦',
          });
        }
      });
      const mainBank = selectedBanks[0];

      // 3. Renda: recebimentos mensais pelos próximos 12 meses
      const incomeMovements: Omit<Movement, 'id'>[] = [];
      incomes
        .filter((i) => incomeOf(i) > 0)
        .forEach((income, idx) => {
          const name = income.name.trim() || 'Renda';
          const isSalary = /sal[aá]rio/i.test(name);
          // Em duas partes: adiantamento (q1) e restante (q2), como no detalhamento do salário
          const parts = income.split
            ? [
                { title: `${name} (adiantamento)`, amount: income.advanceAmount || 0, day: income.advanceDay || 20, group: `rec_${stamp}_${idx}_q1` },
                { title: `${name} (2ª parte)`, amount: income.amount, day: income.day, group: `rec_${stamp}_${idx}_q2` },
              ]
            : [{ title: name, amount: income.amount, day: income.day, group: `rec_${stamp}_${idx}` }];
          parts
            .filter((part) => part.amount > 0)
            .forEach((part) => {
              for (let n = 0; n < 12; n++) {
                incomeMovements.push({
                  title: part.title,
                  type: 'RECEBER',
                  amount: part.amount,
                  dueDate: nextDateForDay(part.day, today, n),
                  bank: mainBank,
                  status: 'PREVISTA',
                  category: isSalary ? 'Salário' : 'Receita',
                  notes: `Repetição mensal ${n + 1}/12`,
                  installmentGroupId: part.group,
                });
              }
            });
        });
      if (incomeMovements.length > 0) addMultipleMovements(incomeMovements);

      // 4. Contas do mês: viram itens mensais nas naturezas (as que já passaram neste mês ficam de fora)
      const billsByGroup = new Map<keyof typeof BILL_GROUPS, BillRow[]>();
      bills
        .filter((b) => b.amount > 0)
        .forEach((b) => {
          const group = COMMON_BILLS.find((c) => c.key === b.key)?.group || 'OUTRAS';
          billsByGroup.set(group, [...(billsByGroup.get(group) || []), b]);
        });

      const existing = (name: string) => natures.some((n: ExpenseNature) => n.name.toLowerCase() === name.toLowerCase());

      billsByGroup.forEach((rows, groupKey) => {
        const group = BILL_GROUPS[groupKey];
        if (existing(group.name)) return;
        const items: MappingItem[] = rows.map((b, i) => ({
          id: `item_${stamp}_${groupKey}_${i}`,
          description: b.name,
          quantity: 1,
          price: b.amount,
          unit: 'un',
          multiplierWeeks: 1,
          totalValue: b.amount,
          realizedValue: 0,
          isFulfilled: false,
          paymentMethod: 'BOLETO',
          recurrenceType: 'MENSAL',
          dayOfMonth: clampDay(b.day),
          ...(clampDay(b.day) < today.getDate()
            ? { monthStates: { [monthKey]: { skipped: true, skipReason: 'Antes do início do acompanhamento' } } }
            : {}),
        }));
        const mapping: FixedExpenseMapping = {
          id: `map_${stamp}_${groupKey}`,
          name: 'Contas do mês',
          natureId: '',
          icon: group.icon,
          applicableMonths: [],
          frequency: 'MENSAL',
          items,
          keywords: group.keywords,
        };
        addNature({ name: group.name, icon: group.icon, color: group.color, type: group.type, keywords: group.keywords, mappings: [mapping] });
      });

      EVERYDAY_NATURES.forEach((n) => {
        if (!existing(n.name)) addNature({ name: n.name, icon: n.icon, color: n.color, type: n.type, keywords: n.keywords, mappings: [] });
      });

      // 5. Cartões e a próxima fatura de cada um
      cardsToSave.forEach((card, idx) => {
        const name = card.name.trim() || `Cartão ${idx + 1}`;
        const dueDay = clampDay(card.dueDay);
        addCard({
          name,
          bank: name,
          brand: 'MASTERCARD',
          limitTotal: Math.max(1000, Math.round(card.amount * 2)),
          closingDay: clampDay(card.closingDay ?? defaultClosingDay(dueDay)),
          dueDay,
          color: getBankBranding(name).primaryColor,
        });
        if (card.amount > 0) {
          addMovement({
            title: `Fatura ${name}`,
            amount: card.amount,
            dueDate: nextDateForDay(dueDay, today),
            type: 'CARTAO',
            status: 'PREVISTA',
            category: 'Fatura de Cartão',
            bank: name,
          });
        }
      });

      // 6. Preferências e conclusão da configuração
      setViewPreferences({ experienceMode: 'GUIADO', homeScreen: 'INICIO', trackingPeriod: period });
      if (user && !user.isGuest) {
        localStorage.setItem(`balder_onboarding_completed_${user.$id}`, 'true');
        SupabaseService.saveUserProfileSettings({ onboardingCompleted: true }).catch(console.error);
      } else {
        localStorage.setItem('balder_onboarding_completed_guest', 'true');
      }
      setSaving(false);
      advance(PERIOD_ANSWER[period]);
    } catch (e) {
      console.error('Erro na configuração guiada:', e);
      setError('Não consegui salvar agora. Tente de novo.');
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'NAME':
        return (
          <>
            <input
              className="form-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Seu nome ou apelido"
              aria-label="Como você quer ser chamado"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nickname.trim()) {
                  setViewPreferences({ nickname: nickname.trim() });
                  advance(nickname.trim());
                }
              }}
            />
            <div className="guided-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!nickname.trim()}
                onClick={() => {
                  setViewPreferences({ nickname: nickname.trim() });
                  advance(nickname.trim());
                }}
              >
                Continuar
              </button>
            </div>
          </>
        );

      case 'MODE':
        return (
          <div className="guided-choices">
            <button
              type="button"
              className="guided-choice"
              onClick={() => {
                setViewPreferences({ experienceMode: 'GUIADO' });
                advance('Faça por mim');
              }}
            >
              <strong>Faça por mim</strong>
              <span>Eu pergunto o básico, monto tudo e depois te lembro do que fazer.</span>
            </button>
            <button
              type="button"
              className="guided-choice"
              onClick={() => {
                // Fica no Início enquanto a conversa segue (com o marco criado, o padrão seria o Painel)
                setViewPreferences({ experienceMode: 'MANUAL', homeScreen: 'INICIO' });
                setHistory((prev) => [...prev, { step, question: QUESTIONS[step], answer: 'Eu configuro tudo' }]);
                setStep('MANUAL');
              }}
            >
              <strong>Eu configuro tudo</strong>
              <span>Você escolhe por onde começar e eu te conduzo com perguntas.</span>
            </button>
          </div>
        );

      case 'BANKS':
        return (
          <>
            <div className="guided-chips">
              {POPULAR_BANKS.map((b) => (
                <button key={b} type="button" className={`guided-chip ${selectedBanks.includes(b) ? 'is-active' : ''}`} onClick={() => toggleBank(b)}>
                  {selectedBanks.includes(b) && <Check size={12} />} {b}
                </button>
              ))}
              {selectedBanks
                .filter((b) => !(POPULAR_BANKS as readonly string[]).includes(b))
                .map((b) => (
                  <button key={b} type="button" className="guided-chip is-active" onClick={() => toggleBank(b)}>
                    <Check size={12} /> {b}
                  </button>
                ))}
            </div>
            <div className="guided-inline">
              <input
                className="form-input form-input-sm"
                value={customBank}
                onChange={(e) => setCustomBank(e.target.value)}
                placeholder="Outro banco"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customBank.trim()) {
                    toggleBank(customBank.trim());
                    setCustomBank('');
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={!customBank.trim()}
                onClick={() => {
                  toggleBank(customBank.trim());
                  setCustomBank('');
                }}
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
            <div className="guided-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setSelectedBanks([]); advance('Só uso dinheiro'); }}>
                Só uso dinheiro
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={selectedBanks.length === 0} onClick={() => advance(selectedBanks.join(', '))}>
                Continuar
              </button>
            </div>
          </>
        );

      case 'BALANCE':
        return (
          <>
            <p className="guided-hint">Pode ser um valor aproximado. Dá para ajustar depois.</p>
            <label className="guided-field">
              <span>Saldo de hoje (R$)</span>
              <DecimalInput className="form-input" money value={balance} emptyWhenZero onValueChange={setBalance} />
            </label>
            <div className="guided-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setBalance(0); advance('Prefiro informar depois'); }}>
                Informar depois
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => advance(formatBRL(balance))}>
                Continuar
              </button>
            </div>
          </>
        );

      case 'INCOME':
        return (
          <>
            <p className="guided-hint">Salário e outras rendas que se repetem todo mês. Se vem em duas partes (adiantamento e restante), me diga cada uma.</p>
            {incomes.map((income, idx) => (
              <div key={idx} className="guided-income">
                <div className="guided-row">
                  <input
                    className="form-input form-input-sm"
                    value={income.name}
                    onChange={(e) => updateIncome(idx, { name: e.target.value })}
                    aria-label="Nome da renda"
                    placeholder="Renda (ex.: Pensão)"
                  />
                  {!income.split && (
                    <>
                      <DecimalInput
                        className="form-input form-input-sm"
                        money
                        value={income.amount}
                        emptyWhenZero
                        onValueChange={(v) => updateIncome(idx, { amount: v })}
                        aria-label="Valor mensal"
                        placeholder="Valor"
                      />
                      <label className="guided-day">
                        <span>dia</span>
                        <NumberInput min={1} max={31} className="form-input form-input-sm" value={income.day} onValueChange={(day) => updateIncome(idx, { day })} />
                      </label>
                    </>
                  )}
                  {idx > 0 && (
                    <button type="button" className="guided-icon-btn" aria-label="Remover" onClick={() => setIncomes((prev) => prev.filter((_, i) => i !== idx))}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="guided-chips">
                  <button type="button" className={`guided-chip ${!income.split ? 'is-active' : ''}`} onClick={() => updateIncome(idx, { split: false })}>
                    {!income.split && <Check size={12} />} Tudo de uma vez
                  </button>
                  <button
                    type="button"
                    className={`guided-chip ${income.split ? 'is-active' : ''}`}
                    onClick={() => updateIncome(idx, { split: true, advanceDay: income.advanceDay ?? 20 })}
                  >
                    {income.split && <Check size={12} />} Em duas partes
                  </button>
                </div>
                {income.split && (
                  <>
                    <div className="guided-row guided-subrow">
                      <span className="guided-row-name">Adiantamento</span>
                      <DecimalInput
                        className="form-input form-input-sm"
                        money
                        value={income.advanceAmount || 0}
                        emptyWhenZero
                        onValueChange={(v) => updateIncome(idx, { advanceAmount: v })}
                        aria-label="Valor do adiantamento"
                        placeholder="Valor"
                      />
                      <label className="guided-day">
                        <span>dia</span>
                        <NumberInput min={1} max={31} className="form-input form-input-sm" value={income.advanceDay ?? 20} onValueChange={(advanceDay) => updateIncome(idx, { advanceDay })} />
                      </label>
                    </div>
                    <div className="guided-row guided-subrow">
                      <span className="guided-row-name">Restante</span>
                      <DecimalInput
                        className="form-input form-input-sm"
                        money
                        value={income.amount}
                        emptyWhenZero
                        onValueChange={(v) => updateIncome(idx, { amount: v })}
                        aria-label="Valor do restante"
                        placeholder="Valor"
                      />
                      <label className="guided-day">
                        <span>dia</span>
                        <NumberInput min={1} max={31} className="form-input form-input-sm" value={income.day} onValueChange={(day) => updateIncome(idx, { day })} />
                      </label>
                    </div>
                  </>
                )}
              </div>
            ))}
            <button type="button" className="link-button" onClick={() => setIncomes((prev) => [...prev, { name: '', amount: 0, day: 10 }])}>
              + Outra renda
            </button>
            <div className="guided-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setIncomes([{ name: 'Salário', amount: 0, day: 5 }]); advance('Não tenho renda fixa'); }}>
                Não tenho renda fixa
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={incomeTotal <= 0} onClick={() => advance(incomeAnswer())}>
                Continuar
              </button>
            </div>
          </>
        );

      case 'BILLS':
        return (
          <>
            <p className="guided-hint">Toque nas que você tem e informe o valor e o dia do vencimento.</p>
            <div className="guided-chips">
              {COMMON_BILLS.map((b) => (
                <button key={b.key} type="button" className={`guided-chip ${bills.some((x) => x.key === b.key) ? 'is-active' : ''}`} onClick={() => toggleBill(b.key, b.name)}>
                  {bills.some((x) => x.key === b.key) && <Check size={12} />} {b.name}
                </button>
              ))}
            </div>
            {bills.map((b) => (
              <div key={b.key} className="guided-row">
                <span className="guided-row-name">{b.name}</span>
                <DecimalInput className="form-input form-input-sm" money value={b.amount} emptyWhenZero onValueChange={(v) => updateBill(b.key, { amount: v })} placeholder="Valor" aria-label={`Valor de ${b.name}`} />
                <label className="guided-day">
                  <span>dia</span>
                  <NumberInput min={1} max={31} className="form-input form-input-sm" value={b.day} onValueChange={(day) => updateBill(b.key, { day })} />
                </label>
                <button type="button" className="guided-icon-btn" aria-label="Remover" onClick={() => toggleBill(b.key, b.name)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="guided-inline">
              <input className="form-input form-input-sm" value={customBill} onChange={(e) => setCustomBill(e.target.value)} placeholder="Outra conta (ex.: seguro do carro)" />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={!customBill.trim()}
                onClick={() => {
                  setBills((prev) => [...prev, { key: `custom_${Date.now()}`, name: customBill.trim(), amount: 0, day: 10 }]);
                  setCustomBill('');
                }}
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
            <div className="guided-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setBills([]); advance('Nenhuma por enquanto'); }}>
                Nenhuma por enquanto
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={billsTotal <= 0} onClick={() => advance(`${bills.filter((b) => b.amount > 0).length} conta(s), ${formatBRL(billsTotal)} por mês`)}>
                Continuar
              </button>
            </div>
          </>
        );

      case 'CARD':
        return (
          <>
            {usesCard === null && (
              <div className="guided-actions is-start">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setUsesCard(false); advance('Não uso'); }}>
                  Não uso
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setUsesCard(true)}>
                  Sim, uso
                </button>
              </div>
            )}
            {usesCard && (
              <>
                <p className="guided-hint">
                  Informe o valor da próxima fatura, o dia em que ela vence e o dia em que fecha (compras depois do fechamento vão para a fatura
                  seguinte). As compras novas você me conta depois.
                </p>
                {cardsInfo.map((card, idx) => (
                  <div key={idx} className="guided-row guided-card-row">
                    <input
                      className="form-input form-input-sm"
                      list="guided-card-banks"
                      value={card.name}
                      onChange={(e) => setCardsInfo((prev) => prev.map((c, i) => (i === idx ? { ...c, name: e.target.value } : c)))}
                      placeholder="Cartão (ex.: Nubank)"
                      aria-label="Nome do cartão"
                    />
                    <DecimalInput
                      className="form-input form-input-sm"
                      money
                      value={card.amount}
                      emptyWhenZero
                      onValueChange={(v) => setCardsInfo((prev) => prev.map((c, i) => (i === idx ? { ...c, amount: v } : c)))}
                      placeholder="Próxima fatura"
                      aria-label="Valor da próxima fatura"
                    />
                    <label className="guided-day">
                      <span>vence dia</span>
                      <NumberInput
                        min={1}
                        max={31}
                        className="form-input form-input-sm"
                        value={card.dueDay}
                        onValueChange={(dueDay) => setCardsInfo((prev) => prev.map((c, i) => (i === idx ? { ...c, dueDay } : c)))}
                      />
                    </label>
                    <label className="guided-day">
                      <span>fecha dia</span>
                      <NumberInput
                        min={1}
                        max={31}
                        className="form-input form-input-sm"
                        value={card.closingDay ?? defaultClosingDay(card.dueDay)}
                        onValueChange={(closingDay) => setCardsInfo((prev) => prev.map((c, i) => (i === idx ? { ...c, closingDay } : c)))}
                      />
                    </label>
                    {idx > 0 && (
                      <button type="button" className="guided-icon-btn" aria-label="Remover" onClick={() => setCardsInfo((prev) => prev.filter((_, i) => i !== idx))}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <datalist id="guided-card-banks">
                  {[...selectedBanks, ...POPULAR_BANKS.filter((b) => !selectedBanks.includes(b))].map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
                <button type="button" className="link-button" onClick={() => setCardsInfo((prev) => [...prev, { name: '', dueDay: 10, amount: 0 }])}>
                  + Outro cartão
                </button>
                <div className="guided-actions">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setUsesCard(null)}>
                    Voltar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!cardsInfo.some((c) => c.name.trim())}
                    onClick={() => advance(cardsInfo.filter((c) => c.name.trim()).map((c) => `${c.name} (${formatBRL(c.amount)})`).join(', '))}
                  >
                    Continuar
                  </button>
                </div>
              </>
            )}
          </>
        );

      case 'PERIOD':
        return (
          <>
            <div className="guided-choices">
              {(
                [
                  ['SEMANA', 'Toda semana', 'Aviso na hora, ex.: "já gastamos bastante comendo fora nesta semana".'],
                  ['QUINZENA', 'A cada quinzena', 'Um resumo do dia 1 ao 15 e do 16 ao fim do mês.'],
                  ['MES', 'Todo mês', 'Uma visão do mês inteiro.'],
                ] as [TrackingPeriod, string, string][]
              ).map(([id, label, hint]) => (
                <button key={id} type="button" className={`guided-choice ${period === id ? 'is-active' : ''}`} onClick={() => setPeriod(id)}>
                  <strong>{label}</strong>
                  <span>{hint}</span>
                </button>
              ))}
            </div>
            {error && <p className="text-xs text-rose">{error}</p>}
            <div className="guided-actions">
              <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={save}>
                {saving ? 'Montando…' : 'Montar meu Balder'}
              </button>
            </div>
          </>
        );

      case 'MANUAL':
      case 'DONE':
        return null;
    }
  };

  return (
    <div className="guided-setup">
      {history.map((h) => (
        <React.Fragment key={h.step}>
          <Bubble from="forseti">{h.question}</Bubble>
          <Bubble from="user">{h.answer}</Bubble>
        </React.Fragment>
      ))}

      {step === 'MANUAL' ? (
        <ForsetiTopicSetup onFinished={onFinished} holdHomeScreen />
      ) : step !== 'DONE' ? (
        <>
          <Bubble from="forseti">{QUESTIONS[step]}</Bubble>
          <div className="guided-panel" ref={panelRef}>
            {renderStep()}
            {step !== 'NAME' && (
              <button type="button" className="guided-back" onClick={goBack}>
                <ArrowLeft size={12} /> Voltar à pergunta anterior
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <Bubble from="forseti">
            <p>
              Pronto, seu Balder está montado.{' '}
              {incomeTotal > 0 && (
                <>
                  Pelo que você me contou, {monthlyLeft >= 0 ? 'sobram' : 'faltam'}{' '}
                  <strong className={monthlyLeft >= 0 ? 'text-emerald' : 'text-rose'}>{formatBRL(Math.abs(monthlyLeft))}</strong> por mês depois das contas
                  {cardsTotal > 0 ? ' e da fatura' : ''}.
                </>
              )}
            </p>
            <p>
              Daqui pra frente é só me contar o que acontecer: "paguei 50 no mercado", "recebi 300 de um freela" ou uma foto do cupom.
              Eu te aviso {PERIOD_CADENCE[period]} como estão os gastos.
            </p>
          </Bubble>
          <div className="guided-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={onFinished}>
              Ir para o Início
            </button>
          </div>
        </>
      )}
    </div>
  );
};
