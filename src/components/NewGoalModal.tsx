import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { useFinancial } from '../context/FinancialContext';

interface NewGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Categorias com ícone e cor sugeridos
const CATEGORIES: { label: string; icon: string; color: string }[] = [
  { label: 'Reserva de Emergência', icon: '🛟', color: '#10B981' },
  { label: 'Viagem', icon: '✈️', color: '#38BDF8' },
  { label: 'Imóvel', icon: '🏠', color: '#F59E0B' },
  { label: 'Veículo', icon: '🚗', color: '#6366F1' },
  { label: 'Educação', icon: '🎓', color: '#A855F7' },
  { label: 'Quitar Dívida', icon: '💳', color: '#EF4444' },
  { label: 'Aposentadoria', icon: '🌴', color: '#14B8A6' },
  { label: 'Outro', icon: '🎯', color: '#EC4899' },
];

// Converte valores digitados em pt-BR ("1.234,56", "1234,56", "1234.56")
const parseBRL = (val: string): number => {
  const clean = val.replace(/[R$\s]/g, '').trim();
  if (!clean) return 0;
  if (clean.includes('.') && clean.includes(',')) return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
  if (clean.includes(',')) return parseFloat(clean.replace(',', '.')) || 0;
  if ((clean.match(/\./g) || []).length > 1) return parseFloat(clean.replace(/\./g, '')) || 0;
  return parseFloat(clean) || 0;
};

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

const defaultTargetMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Criação de meta: nome, categoria/ícone, valor alvo, valor já guardado, prazo e aporte mensal sugerido. */
export const NewGoalModal: React.FC<NewGoalModalProps> = ({ isOpen, onClose }) => {
  const { addGoal } = useFinancial();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].label);
  const [targetInput, setTargetInput] = useState('');
  const [currentInput, setCurrentInput] = useState('');
  const [targetMonth, setTargetMonth] = useState(defaultTargetMonth());
  const [contributionInput, setContributionInput] = useState('');
  const [contributionTouched, setContributionTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setCategory(CATEGORIES[0].label);
    setTargetInput('');
    setCurrentInput('');
    setTargetMonth(defaultTargetMonth());
    setContributionInput('');
    setContributionTouched(false);
    setError(null);
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

  const selected = CATEGORIES.find((c) => c.label === category) || CATEGORIES[CATEGORIES.length - 1];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Informe o nome da meta.');
    if (target <= 0) return setError('Informe o valor que você quer alcançar.');
    if (current > target) return setError('O valor já guardado é maior que o valor da meta.');
    if (months <= 0) return setError('Escolha um prazo a partir do próximo mês.');

    addGoal({
      title: title.trim(),
      category,
      currentAmount: current,
      targetAmount: target,
      monthlyContribution: parseBRL(contributionInput),
      targetDate: formatTargetDate(targetMonth),
      icon: selected.icon,
      color: selected.color,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Meta" subtitle="Defina o objetivo, o prazo e quanto guardar por mês" maxWidth="520px">
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
          <label>Categoria</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {CATEGORIES.map((c) => {
              const active = c.label === category;
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setCategory(c.label)}
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
