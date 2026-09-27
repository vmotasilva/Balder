import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { parseMoney } from '../utils/parseDecimal';
import { Modal } from './Modal';
import { DecimalInput } from './DecimalInput';
import { useFinancial } from '../context/FinancialContext';
import { buildMonthlyProjectionGrid } from '../utils/projectionMath';
import { groupLoanMovements } from '../utils/loanMath';
import {
  checkFeasibility,
  suggestGoal,
  type GoalAnswers,
  type GoalCategoryId,
  type IncomeStability,
} from '../utils/goalPlanner';

interface NewGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Categorias com ícone e cor sugeridos
const CATEGORIES: { id: GoalCategoryId; label: string; icon: string; color: string }[] = [
  { id: 'RESERVA', label: 'Reserva de Emergência', icon: '🛟', color: '#10B981' },
  { id: 'VIAGEM', label: 'Viagem', icon: '✈️', color: '#38BDF8' },
  { id: 'IMOVEL', label: 'Imóvel', icon: '🏠', color: '#F59E0B' },
  { id: 'VEICULO', label: 'Veículo', icon: '🚗', color: '#6366F1' },
  { id: 'EDUCACAO', label: 'Educação', icon: '🎓', color: '#A855F7' },
  { id: 'DIVIDA', label: 'Quitar Dívida', icon: '💳', color: '#EF4444' },
  { id: 'APOSENTADORIA', label: 'Aposentadoria', icon: '🌴', color: '#14B8A6' },
  { id: 'OUTRO', label: 'Outro', icon: '🎯', color: '#EC4899' },
];

const STABILITY_OPTIONS: { id: IncomeStability; label: string }[] = [
  { id: 'ESTAVEL', label: 'Estável (servidor, aposentado)' },
  { id: 'CLT', label: 'CLT' },
  { id: 'VARIAVEL', label: 'Autônomo / variável' },
];

// Valores digitados aceitam vírgula ou ponto como decimal ("1.234,56", "1234,56", "1234.56")
const parseBRL = (val: string): number => parseMoney(val);

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatInputBRL = (v: number) => (v > 0 ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

// Prazo YYYY-MM -> "Dezembro de 2026" (formato das metas existentes)
const formatTargetDate = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const monthsUntil = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number);
  const now = new Date();
  return (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1));
};

const monthKeyIn = (months: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + Math.max(1, months));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const defaultTargetMonth = () => monthKeyIn(12);

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Criação de meta: nome, categoria/ícone, valor alvo, valor já guardado, prazo e aporte mensal sugerido. */
export const NewGoalModal: React.FC<NewGoalModalProps> = ({ isOpen, onClose }) => {
  const {
    addGoal,
    natures,
    getNatureCeiling,
    movements,
    monthlyClosings,
    emergencyReserveAmount,
    goals,
    cards,
    activeCheckpoint,
    goalStatuses,
  } = useFinancial();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GoalCategoryId>('RESERVA');
  const [targetInput, setTargetInput] = useState('');
  const [currentInput, setCurrentInput] = useState('');
  const [targetMonth, setTargetMonth] = useState(defaultTargetMonth());
  const [contributionInput, setContributionInput] = useState('');
  const [contributionTouched, setContributionTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const [answers, setAnswers] = useState<GoalAnswers>({});
  const [debtChoice, setDebtChoice] = useState('ALL');

  // ── Dados do usuário usados pelo assistente ──
  // Custo de vida: soma do previsto das naturezas no mês atual
  const naturesMonthlyTotal = useMemo(() => {
    const key = currentMonthKey();
    return Math.round(natures.reduce((acc, n) => acc + getNatureCeiling(n, key), 0) * 100) / 100;
  }, [natures, getNatureCeiling]);

  // Ganho e gasto mensais: média dos próximos 6 meses da projeção (o usuário confirma ou corrige)
  const projectedMonth = useMemo(() => {
    const key = currentMonthKey();
    const rows = buildMonthlyProjectionGrid(movements, natures, 0, monthlyClosings, 'PROJETADO', {
      startDate: activeCheckpoint?.startDate,
    })
      .filter((r) => r.monthKey >= key)
      .slice(0, 6);
    if (rows.length === 0) return { income: 0, expense: 0 };
    const avg = (f: (r: (typeof rows)[number]) => number) =>
      Math.round((rows.reduce((acc, r) => acc + f(r), 0) / rows.length) * 100) / 100;
    return {
      income: avg((r) => r.salary + r.extrasTotal),
      expense: avg((r) => r.creditCardTotal + r.fixedCostDirect + r.variableCost + r.loanPayment),
    };
  }, [movements, natures, monthlyClosings, activeCheckpoint?.startDate]);
  const [incomeOverride, setIncomeOverride] = useState<number | null>(null);
  const [expenseOverride, setExpenseOverride] = useState<number | null>(null);
  const monthlyIncome = incomeOverride ?? projectedMonth.income;
  const monthlyExpense = expenseOverride ?? projectedMonth.expense;
  // Folga mensal = ganho − gasto (sem ganho informado, não há como avaliar)
  const monthlyCapacity = monthlyIncome > 0 ? Math.round((monthlyIncome - monthlyExpense) * 100) / 100 : null;

  const committedToOtherGoals = useMemo(
    // Só metas ativas (arquivadas e canceladas não comprometem a folga)
    () =>
      goals.reduce(
        (acc, g) => acc + (!goalStatuses[g.id] && g.currentAmount < g.targetAmount ? g.monthlyContribution || 0 : 0),
        0
      ),
    [goals, goalStatuses]
  );

  const debts = useMemo(() => {
    const loans = groupLoanMovements(movements)
      .filter((g) => g.nominalBalance > 0)
      .map((g) => ({ id: g.groupId, label: `${g.title} (empréstimo)`, amount: g.nominalBalance }));
    const cardUsed = cards.reduce((acc, c) => acc + (c.limitUsed || 0), 0);
    const list = [...loans];
    if (cardUsed > 0) list.push({ id: 'CARDS', label: 'Cartões (limite usado)', amount: Math.round(cardUsed * 100) / 100 });
    return list;
  }, [movements, cards]);
  const debtTotal = debts.reduce((acc, d) => acc + d.amount, 0);

  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setCategory('RESERVA');
    setTargetInput('');
    setCurrentInput('');
    setTargetMonth(defaultTargetMonth());
    setContributionInput('');
    setContributionTouched(false);
    setError(null);
    setAssistOpen(false);
    setAnswers({});
    setDebtChoice('ALL');
    setIncomeOverride(null);
    setExpenseOverride(null);
  }, [isOpen]);

  const target = parseBRL(targetInput);
  const current = parseBRL(currentInput);
  const months = monthsUntil(targetMonth);

  // Aporte sugerido: o que falta dividido pelos meses até o prazo
  const suggested = useMemo(() => {
    const missing = Math.max(0, target - current);
    if (missing === 0 || months <= 0) return 0;
    return Math.ceil((missing / months) * 100) / 100;
  }, [target, current, months]);

  useEffect(() => {
    if (!contributionTouched) {
      setContributionInput(suggested > 0 ? suggested.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
    }
  }, [suggested, contributionTouched]);

  const selected = CATEGORIES.find((c) => c.id === category) || CATEGORIES[CATEGORIES.length - 1];

  // Respostas com os valores do sistema quando o usuário ainda não informou
  const effectiveAnswers: GoalAnswers = {
    ...answers,
    monthlyCost: answers.monthlyCost ?? (naturesMonthlyTotal > 0 ? naturesMonthlyTotal : undefined),
    stability: answers.stability ?? 'CLT',
    vehiclePurchase: answers.vehiclePurchase ?? 'A_VISTA',
    debtAmount:
      answers.debtAmount ??
      (debtChoice === 'ALL' ? (debtTotal > 0 ? debtTotal : undefined) : debts.find((d) => d.id === debtChoice)?.amount),
  };
  const suggestion = suggestGoal(category, effectiveAnswers);
  const setAnswer = <K extends keyof GoalAnswers>(key: K, value: GoalAnswers[K]) => setAnswers((prev) => ({ ...prev, [key]: value }));

  const feasibility =
    target > 0 && months > 0
      ? checkFeasibility({ target, current, months, monthlyCapacity, committedToOtherGoals })
      : null;

  const applySuggestion = () => {
    if (!suggestion || suggestion.target <= 0) return;
    if (!title.trim()) setTitle(suggestion.title);
    setTargetInput(formatInputBRL(suggestion.target));
    const saved = category === 'RESERVA' ? Math.min(emergencyReserveAmount, suggestion.target) : current;
    if (category === 'RESERVA' && emergencyReserveAmount > 0) setCurrentInput(formatInputBRL(saved));
    // Prazo confortável: metade da folga mensal disponível
    const plan = checkFeasibility({ target: suggestion.target, current: saved, months: 12, monthlyCapacity, committedToOtherGoals });
    if (plan.comfortableMonths && plan.comfortableMonths > 0) setTargetMonth(monthKeyIn(Math.min(plan.comfortableMonths, 600)));
    setContributionTouched(false);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Informe o nome da meta.');
    if (target <= 0) return setError('Informe o valor que você quer alcançar.');
    if (current > target) return setError('O valor já guardado é maior que o valor da meta.');
    if (months <= 0) return setError('Escolha um prazo a partir do próximo mês.');

    addGoal({
      title: title.trim(),
      category: selected.label,
      currentAmount: current,
      targetAmount: target,
      monthlyContribution: parseBRL(contributionInput),
      targetDate: formatTargetDate(targetMonth),
      icon: selected.icon,
      color: selected.color,
    });
    onClose();
  };

  const renderQuestions = () => {
    switch (category) {
      case 'RESERVA':
        return (
          <>
            <div className="goal-assist-grid">
              <label className="goal-assist-field">
                <span>Custo de vida mensal (R$)</span>
                <DecimalInput
                  className="form-input form-input-sm"
                  value={effectiveAnswers.monthlyCost ?? 0}
                  emptyWhenZero
                  onValueChange={(v) => setAnswer('monthlyCost', v)}
                />
                <small>
                  {naturesMonthlyTotal > 0
                    ? `Das suas naturezas: ${formatBRL(naturesMonthlyTotal)} previstos neste mês.`
                    : 'Não há naturezas com valores previstos: quanto você gasta por mês com o essencial?'}
                </small>
              </label>
              <div className="goal-assist-field">
                <span>Como é a sua renda?</span>
                <div className="goal-assist-options">
                  {STABILITY_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={`goal-assist-option ${effectiveAnswers.stability === o.id ? 'is-active' : ''}`}
                      onClick={() => setAnswer('stability', o.id)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {emergencyReserveAmount > 0 && (
              <small className="goal-assist-note">
                Já guardado em reserva/poupança: {formatBRL(emergencyReserveAmount)}
                {effectiveAnswers.monthlyCost
                  ? ` (cobre ${(emergencyReserveAmount / effectiveAnswers.monthlyCost).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses de custo de vida)`
                  : ''}
                .
              </small>
            )}
            {suggestion && !suggestion.missing && emergencyReserveAmount >= suggestion.target && suggestion.target > 0 && (
              <p className="goal-feasibility goal-feasibility--ok">
                Sua reserva atual já cobre esta meta. Se quiser ir além, escolha “Autônomo / variável” (12 meses) ou
                ajuste o valor.
              </p>
            )}
          </>
        );
      case 'VIAGEM':
        return (
          <div className="goal-assist-grid">
            <label className="goal-assist-field">
              <span>Pessoas</span>
              <input type="number" min={1} className="form-input form-input-sm" value={answers.travelers ?? ''} onChange={(e) => setAnswer('travelers', Number(e.target.value) || undefined)} />
            </label>
            <label className="goal-assist-field">
              <span>Dias</span>
              <input type="number" min={1} className="form-input form-input-sm" value={answers.days ?? ''} onChange={(e) => setAnswer('days', Number(e.target.value) || undefined)} />
            </label>
            <label className="goal-assist-field">
              <span>Hospedagem + alimentação por pessoa/dia (R$)</span>
              <DecimalInput className="form-input form-input-sm" value={answers.dailyCostPerPerson ?? 0} emptyWhenZero onValueChange={(v) => setAnswer('dailyCostPerPerson', v)} />
            </label>
            <label className="goal-assist-field">
              <span>Passagem por pessoa (R$)</span>
              <DecimalInput className="form-input form-input-sm" value={answers.ticketPerPerson ?? 0} emptyWhenZero onValueChange={(v) => setAnswer('ticketPerPerson', v)} />
            </label>
          </div>
        );
      case 'IMOVEL':
        return (
          <div className="goal-assist-grid">
            <label className="goal-assist-field">
              <span>Valor do imóvel (R$)</span>
              <DecimalInput className="form-input form-input-sm" value={answers.assetPrice ?? 0} emptyWhenZero onValueChange={(v) => setAnswer('assetPrice', v)} />
            </label>
          </div>
        );
      case 'VEICULO':
        return (
          <div className="goal-assist-grid">
            <label className="goal-assist-field">
              <span>Valor do veículo (R$)</span>
              <DecimalInput className="form-input form-input-sm" value={answers.assetPrice ?? 0} emptyWhenZero onValueChange={(v) => setAnswer('assetPrice', v)} />
            </label>
            <div className="goal-assist-field">
              <span>Como pretende comprar?</span>
              <div className="goal-assist-options">
                {(['A_VISTA', 'ENTRADA'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`goal-assist-option ${effectiveAnswers.vehiclePurchase === opt ? 'is-active' : ''}`}
                    onClick={() => setAnswer('vehiclePurchase', opt)}
                  >
                    {opt === 'A_VISTA' ? 'À vista' : 'Entrada + financiamento'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 'EDUCACAO':
        return (
          <div className="goal-assist-grid">
            <label className="goal-assist-field">
              <span>Mensalidade (R$)</span>
              <DecimalInput className="form-input form-input-sm" value={answers.monthlyFee ?? 0} emptyWhenZero onValueChange={(v) => setAnswer('monthlyFee', v)} />
            </label>
            <label className="goal-assist-field">
              <span>Duração (meses)</span>
              <input type="number" min={1} className="form-input form-input-sm" value={answers.courseMonths ?? ''} onChange={(e) => setAnswer('courseMonths', Number(e.target.value) || undefined)} />
            </label>
            <label className="goal-assist-field">
              <span>Matrícula (R$, opcional)</span>
              <DecimalInput className="form-input form-input-sm" value={answers.enrollmentFee ?? 0} emptyWhenZero onValueChange={(v) => setAnswer('enrollmentFee', v)} />
            </label>
          </div>
        );
      case 'DIVIDA':
        return (
          <div className="goal-assist-grid">
            <label className="goal-assist-field">
              <span>Qual dívida?</span>
              <select
                className="form-input form-input-sm"
                value={debtChoice}
                onChange={(e) => {
                  setDebtChoice(e.target.value);
                  setAnswer('debtAmount', undefined);
                }}
              >
                <option value="ALL">Todas ({formatBRL(debtTotal)})</option>
                {debts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}: {formatBRL(d.amount)}
                  </option>
                ))}
              </select>
              {debts.length === 0 && <small>Nenhum empréstimo ou cartão com saldo. Informe o valor abaixo.</small>}
            </label>
            <label className="goal-assist-field">
              <span>Valor a quitar (R$)</span>
              <DecimalInput className="form-input form-input-sm" value={effectiveAnswers.debtAmount ?? 0} emptyWhenZero onValueChange={(v) => setAnswer('debtAmount', v)} />
            </label>
          </div>
        );
      case 'APOSENTADORIA':
        return (
          <div className="goal-assist-grid">
            <label className="goal-assist-field">
              <span>Renda mensal desejada (R$)</span>
              <DecimalInput className="form-input form-input-sm" value={answers.desiredMonthlyIncome ?? 0} emptyWhenZero onValueChange={(v) => setAnswer('desiredMonthlyIncome', v)} />
            </label>
          </div>
        );
      default:
        return (
          <p className="goal-assist-note">
            Para “Outro”, informe o valor e o prazo abaixo: a Forseti confere se o aporte cabe na sua folga mensal.
          </p>
        );
    }
  };

  const feasibilityMessage = () => {
    if (!feasibility) return null;
    const pct = feasibility.availableCapacity > 0 ? Math.round((feasibility.requiredMonthly / feasibility.availableCapacity) * 100) : 0;
    const committed = committedToOtherGoals > 0 ? ` (já descontados ${formatBRL(committedToOtherGoals)}/mês de outras metas)` : '';
    switch (feasibility.level) {
      case 'CONFORTAVEL':
        return {
          tone: 'ok',
          text: `Cabe com folga: ${formatBRL(feasibility.requiredMonthly)}/mês usam ${pct}% da sua folga mensal de ${formatBRL(feasibility.availableCapacity)}${committed}.`,
        };
      case 'APERTADA':
        return {
          tone: 'warn',
          text: `Cabe, mas aperta: ${formatBRL(feasibility.requiredMonthly)}/mês usam ${pct}% da folga de ${formatBRL(feasibility.availableCapacity)}${committed}. Prazo confortável: ${feasibility.comfortableMonths} meses (${formatTargetDate(monthKeyIn(feasibility.comfortableMonths || 1))}).`,
          adjustTo: feasibility.comfortableMonths,
        };
      case 'ACIMA':
        return {
          tone: 'bad',
          text: `Acima da folga: são ${formatBRL(feasibility.requiredMonthly)}/mês e sobram ${formatBRL(feasibility.availableCapacity)}${committed}. Usando toda a folga, o prazo mínimo é ${feasibility.minimumMonths} meses (${formatTargetDate(monthKeyIn(feasibility.minimumMonths || 1))}).`,
          adjustTo: feasibility.minimumMonths,
        };
      case 'SEM_FOLGA':
        return {
          tone: 'bad',
          text: `Não sobra folga no mês: ganho de ${formatBRL(monthlyIncome)} e gasto de ${formatBRL(monthlyExpense)} (${formatBRL(monthlyCapacity ?? 0)}/mês)${committedToOtherGoals > 0 ? `, e ${formatBRL(committedToOtherGoals)}/mês já vão para outras metas` : ''}. Revise gastos ou aumente as entradas para esta meta caber.`,
        };
      default:
        return null;
    }
  };
  const feasibilityInfo = feasibilityMessage();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Meta" subtitle="Defina o objetivo, o prazo e quanto guardar por mês" maxWidth="560px">
      <form onSubmit={handleSubmit}>
        <div className="form-group mb-3">
          <label htmlFor="goal-title">Nome da meta</label>
          <input
            id="goal-title"
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Viagem de férias, Reserva de 6 meses"
            autoFocus
          />
        </div>

        <div className="form-group mb-3">
          <div className="goal-category-header">
            <label>Categoria</label>
            <button type="button" className={`goal-assist-toggle ${assistOpen ? 'is-open' : ''}`} onClick={() => setAssistOpen((v) => !v)}>
              <Sparkles size={13} />
              <span>{assistOpen ? 'Fechar assistente' : 'Sugerir com a Forseti'}</span>
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {CATEGORIES.map((c) => {
              const active = c.id === category;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  aria-pressed={active}
                  className="btn btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: `1px solid ${active ? c.color : 'var(--border-default)'}`,
                    background: active ? `${c.color}22` : 'transparent',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {assistOpen && (
          <div className="goal-assist-panel mb-3">
            {/* Antes de propor: o ganho e o gasto do mês */}
            <div className="goal-base">
              <span className="goal-base-title">Seu mês (confirme ou corrija antes das sugestões)</span>
              <div className="goal-assist-grid">
                <label className="goal-assist-field">
                  <span>Ganho mensal (R$)</span>
                  <DecimalInput
                    className="form-input form-input-sm"
                    value={monthlyIncome}
                    emptyWhenZero
                    onValueChange={(v) => setIncomeOverride(v)}
                  />
                </label>
                <label className="goal-assist-field">
                  <span>Gasto mensal (R$)</span>
                  <DecimalInput
                    className="form-input form-input-sm"
                    value={monthlyExpense}
                    emptyWhenZero
                    onValueChange={(v) => setExpenseOverride(v)}
                  />
                </label>
              </div>
              <small>
                {projectedMonth.income > 0
                  ? `Da sua projeção: média dos próximos 6 meses (entradas previstas; saídas com naturezas, faturas e parcelas).`
                  : 'Não encontramos entradas previstas na projeção: informe quanto você ganha por mês.'}{' '}
                {monthlyCapacity !== null && (
                  <strong className={monthlyCapacity < 0 ? 'text-rose' : 'text-emerald'}>
                    Folga: {formatBRL(monthlyCapacity)}/mês.
                  </strong>
                )}
                {(incomeOverride !== null || expenseOverride !== null) && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setIncomeOverride(null);
                      setExpenseOverride(null);
                    }}
                  >
                    {' '}voltar aos valores da projeção
                  </button>
                )}
              </small>
            </div>

            <div className="goal-assist-title">
              <Sparkles size={14} />
              <span>
                {selected.icon} {selected.label}: vamos calcular juntos
              </span>
            </div>
            {renderQuestions()}
            {suggestion && suggestion.missing && <p className="goal-assist-note">{suggestion.missing}</p>}
            {suggestion && !suggestion.missing && suggestion.target > 0 && (
              <div className="goal-assist-result">
                <ul>
                  {suggestion.rationale.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <div className="goal-assist-result-row">
                  <span>
                    Valor sugerido: <strong>{formatBRL(suggestion.target)}</strong>
                  </span>
                  <button type="button" className="btn btn-primary btn-xs" onClick={applySuggestion}>
                    Usar sugestão
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mb-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="form-group">
            <label htmlFor="goal-target">Valor da meta (R$)</label>
            <input
              id="goal-target"
              type="text"
              inputMode="decimal"
              className="form-input"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="form-group">
            <label htmlFor="goal-current">Já guardado (R$)</label>
            <input
              id="goal-current"
              type="text"
              inputMode="decimal"
              className="form-input"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder="0,00"
            />
          </div>
        </div>

        <div className="mb-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="form-group">
            <label htmlFor="goal-month">Prazo</label>
            <input
              id="goal-month"
              type="month"
              className="form-input"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="goal-contribution">Aporte mensal (R$)</label>
            <input
              id="goal-contribution"
              type="text"
              inputMode="decimal"
              className="form-input"
              value={contributionInput}
              onChange={(e) => {
                setContributionTouched(true);
                setContributionInput(e.target.value);
              }}
              placeholder="0,00"
            />
          </div>
        </div>

        {suggested > 0 && (
          <p className="text-xs text-muted mb-3">
            Para chegar a {formatBRL(target)} em {formatTargetDate(targetMonth).toLowerCase()} ({months}{' '}
            {months === 1 ? 'mês' : 'meses'}), guarde cerca de <strong>{formatBRL(suggested)}</strong> por mês.
          </p>
        )}

        {feasibilityInfo && (
          <div className={`goal-feasibility goal-feasibility--${feasibilityInfo.tone} mb-3`}>
            <span>{feasibilityInfo.text}</span>
            {feasibilityInfo.adjustTo && feasibilityInfo.adjustTo !== months && (
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => {
                  setTargetMonth(monthKeyIn(Math.min(feasibilityInfo.adjustTo || 1, 600)));
                  setContributionTouched(false);
                }}
              >
                Ajustar prazo para {feasibilityInfo.adjustTo} meses
              </button>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs text-rose mb-3">
            {error}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary btn-sm">
            Criar meta
          </button>
        </div>
      </form>
    </Modal>
  );
};
